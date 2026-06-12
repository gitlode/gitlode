import nodeFs from "node:fs";
import { basename } from "node:path";
import { performance } from "node:perf_hooks";

import type { ConfigExtensionsSection } from "../config/index.js";
import type {
  ExtractionState,
  ExtractorConfig,
  ExtractionRange,
  FactProjector,
  ProgressReporter,
} from "../core/index.js";
import {
  DefaultCommitTraversalExtractor,
  DefaultExtractionCoordinator,
  DefaultFactProjector,
  DefaultFileChangeExpander,
  DefaultTraversalPlanner,
  EnrichingFactProjector,
} from "../core/index.js";
import { IsomorphicGitAdapter, JsDiffAdapter } from "../git-impl/index.js";
import { type GitAdapter, GitAdapterError } from "../git/index.js";
import { OutputWriter, OutputWriterSink, formatSessionTimestamp } from "../output/index.js";
import {
  checkPluginCompatibility,
  initializePlugins,
  resolvePluginEntries,
} from "../plugins/index.js";
import type { RunSuccessPayload } from "../presentation/types.js";
import { DefaultStageProfiler } from "../profile/index.js";
import { validateExtractionState } from "../state/state-store.js";
import { type AbsoluteDirectoryPath, type AbsolutePath, firstOrThrow } from "../support/index.js";
import type { WorkerRunInput, WorkerRunRange, WorkerRunRequest } from "./types.js";
import { deriveRepoName, resolveRepositoryObjectFormat } from "./utils.js";

type BuildProjectorResult =
  | {
      readonly kind: "success";
      readonly projector: FactProjector;
    }
  | {
      readonly kind: "termination";
      readonly message: string;
    };

export interface RuntimeExecutionProgress {
  readonly reporter: ProgressReporter;
  readonly renderDiagnostic: (severity: "warn" | "error", message: string) => void;
}

export type RuntimeExecutionResult =
  | {
      readonly kind: "success";
      readonly success: RunSuccessPayload;
      readonly state: ExtractionState;
    }
  | {
      readonly kind: "user-error";
      readonly message: string;
    };

function formatPluginInitializationFailure(entry: {
  entry: { namespace: string };
  result: { type: "fatal"; message: string };
}): string {
  return `Plugin "${entry.entry.namespace}" init failed: ${entry.result.message}`;
}

function hasEffectiveExtensionsConfig(
  extensions: ConfigExtensionsSection | undefined,
): extensions is ConfigExtensionsSection {
  return extensions !== undefined && Object.keys(extensions).length > 0;
}

async function validateRepositoryAccess(
  input: Pick<WorkerRunInput, "repositoryPath" | "refs">,
  repoPath: AbsolutePath,
  gitAdapter: GitAdapter,
): Promise<void> {
  try {
    await gitAdapter.resolveRef(repoPath, firstOrThrow(input.refs));
  } catch (error) {
    if (error instanceof GitAdapterError && error.code === "NOT_A_REPOSITORY") {
      throw new GitAdapterError(
        `Not a Git repository: ${input.repositoryPath}`,
        "NOT_A_REPOSITORY",
      );
    }
    if (error instanceof GitAdapterError && error.code === "REF_NOT_FOUND") {
      return;
    }
    throw error;
  }
}

async function resolveRepositoryBasics(
  repoPath: string,
  gitAdapter: GitAdapter,
  explicitRepoName?: string,
  explicitRepoUrl?: string,
): Promise<{ repoName: string; repoUrl: string | null }> {
  const repoUrl =
    explicitRepoUrl !== undefined ? explicitRepoUrl : await gitAdapter.getRemoteUrl(repoPath);
  const repoName =
    explicitRepoName !== undefined ? explicitRepoName : deriveRepoName(repoUrl, repoPath);

  return {
    repoName,
    repoUrl,
  };
}

async function resolveExtractionRange(
  range: WorkerRunRange | undefined,
  repoPath: AbsolutePath,
  runAdapter: GitAdapter,
): Promise<ExtractionRange | undefined> {
  if (range === undefined) {
    return undefined;
  }
  if (range.type === "date") {
    const since = new Date(range.since);
    if (Number.isNaN(since.getTime())) {
      throw new Error(`Invalid date format in worker request: ${range.since}`);
    }
    return { type: "date", since };
  }

  try {
    const resolvedSinceRef = await runAdapter.resolveRef(repoPath, range.since);
    return { type: "ref", since: resolvedSinceRef };
  } catch (error) {
    if (error instanceof GitAdapterError && error.code === "REF_NOT_FOUND") {
      throw new GitAdapterError(`Ref not found: ${range.since}`, "REF_NOT_FOUND");
    }
    throw error;
  }
}

function resolveOutputPrefix(
  outputPrefix: string | undefined,
  repoUrl: string | null,
  repoPath: string,
): string {
  if (outputPrefix !== undefined) {
    return outputPrefix;
  }
  if (repoUrl) {
    const lastSegment = repoUrl.split("/").pop() ?? "";
    const stripped = lastSegment.replace(/\.git$/, "");
    return stripped || basename(repoPath);
  }
  return basename(repoPath);
}

async function buildCustomProjector(
  config: {
    repoName: string;
    repoUrl: string | null;
    baseDir: AbsoluteDirectoryPath;
    extensions: ConfigExtensionsSection;
  },
  progress: RuntimeExecutionProgress,
  projectionProfiler?: ReturnType<typeof DefaultStageProfiler.prototype.createScopedProfiler>,
): Promise<BuildProjectorResult> {
  progress.reporter.emit({ type: "phase-start", phase: "initializing-plugins" });

  const pluginEntriesResult = await resolvePluginEntries(config.extensions, config.baseDir);
  if (pluginEntriesResult.kind === "termination") {
    return {
      kind: "termination",
      message: pluginEntriesResult.termination.message,
    };
  }

  const pluginEntries = pluginEntriesResult.entries;

  await checkPluginCompatibility(pluginEntries, config.extensions, config.baseDir, {
    warn(message) {
      progress.renderDiagnostic("warn", message);
    },
  });

  const pluginsProfiler = projectionProfiler?.createScopedProfiler("plugins");

  const pluginInitResults = await initializePlugins(pluginEntries, (entry) => ({
    warn(message) {
      progress.renderDiagnostic("warn", `Plugin "${entry.namespace}": ${message}`);
    },
    error(message) {
      progress.renderDiagnostic("error", `Plugin "${entry.namespace}": ${message}`);
    },
    profiler: pluginsProfiler?.createScopedProfiler(entry.namespace),
  }));

  const pluginInitFailures = pluginInitResults.filter(
    (entry): entry is typeof entry & { result: { type: "fatal"; message: string } } =>
      entry.result.type === "fatal",
  );
  if (pluginInitFailures.length > 0) {
    return {
      kind: "termination",
      message: pluginInitFailures
        .map((entry) => formatPluginInitializationFailure(entry))
        .join("\n"),
    };
  }

  progress.reporter.emit({ type: "phase-end", phase: "initializing-plugins" });
  return {
    kind: "success",
    projector: new EnrichingFactProjector(
      pluginEntries,
      progress.reporter,
      config.repoName,
      config.repoUrl,
    ),
  };
}

export async function executeWorkerRunRequest(
  request: WorkerRunRequest,
  progress: RuntimeExecutionProgress,
): Promise<RuntimeExecutionResult> {
  const { input, priorState } = request;
  const rootProfiler = new DefaultStageProfiler("elapsed", () => performance.now());
  const profilingRootProfiler = input.profile ? rootProfiler : undefined;

  const sessionTimestamp = new Date();
  const startMs = performance.now();
  rootProfiler.start();

  const resolvedRepoPath: AbsolutePath = input.repositoryPath;

  try {
    const gitAdapter = new IsomorphicGitAdapter({
      fs: nodeFs,
      diffAdapter: new JsDiffAdapter(),
      profiler: profilingRootProfiler?.createScopedProfiler("git"),
    });

    await validateRepositoryAccess(input, resolvedRepoPath, gitAdapter);

    const repositoryObjectFormat = await resolveRepositoryObjectFormat(
      resolvedRepoPath,
      gitAdapter,
    );

    validateExtractionState(priorState, resolvedRepoPath, repositoryObjectFormat);

    const { repoName: resolvedRepoName, repoUrl: resolvedRepoUrl } = await resolveRepositoryBasics(
      resolvedRepoPath,
      gitAdapter,
      input.repoName,
      input.repoUrl,
    );

    const resolvedRange = await resolveExtractionRange(input.range, resolvedRepoPath, gitAdapter);
    const resolvedOutputPrefix = resolveOutputPrefix(
      input.outputPrefix,
      resolvedRepoUrl,
      resolvedRepoPath,
    );
    const extractorConfig: ExtractorConfig = {
      refs: input.refs,
      outputDir: input.outputDir,
      outputPrefix: resolvedOutputPrefix,
      rotation: input.rotation,
      range: resolvedRange,
      granularity: input.granularity,
      maxDiffSize: input.maxDiffSize,
    };

    const planningProfiler = profilingRootProfiler?.createScopedProfiler("planning");
    const traversalProfiler = profilingRootProfiler?.createScopedProfiler("traversal");
    const projectionProfiler = profilingRootProfiler?.createScopedProfiler("projection");
    const writeProfiler = profilingRootProfiler?.createScopedProfiler("write");

    const traversalPlanner = new DefaultTraversalPlanner(gitAdapter, planningProfiler);
    const traversalExtractor = new DefaultCommitTraversalExtractor(gitAdapter, traversalProfiler);
    const fileChangeExpander = new DefaultFileChangeExpander(
      gitAdapter,
      extractorConfig.maxDiffSize,
    );

    let projector: FactProjector;
    const { configBaseDir: configPath, extensions } = input;
    if (!configPath || !hasEffectiveExtensionsConfig(extensions)) {
      projector = new DefaultFactProjector(resolvedRepoName, resolvedRepoUrl, projectionProfiler);
    } else {
      const projectorResult = await buildCustomProjector(
        {
          repoName: resolvedRepoName,
          repoUrl: resolvedRepoUrl,
          baseDir: configPath,
          extensions,
        },
        progress,
        projectionProfiler,
      );
      if (projectorResult.kind === "termination") {
        return {
          kind: "user-error",
          message: projectorResult.message,
        };
      }
      projector = projectorResult.projector;
    }

    const sink = new OutputWriterSink(
      new OutputWriter(
        extractorConfig.outputDir,
        (seq) =>
          `${extractorConfig.outputPrefix}-${formatSessionTimestamp(sessionTimestamp)}-${String(seq).padStart(6, "0")}.jsonl`,
        extractorConfig.rotation,
      ),
    );

    const coordinator = new DefaultExtractionCoordinator({
      traversalPlanner,
      traversalExtractor,
      fileChangeExpander,
      projector,
      sink,
      reporter: progress.reporter,
      profiler: writeProfiler,
    });

    const result = await coordinator.run({
      repositoryPath: resolvedRepoPath,
      repoName: resolvedRepoName,
      repoUrl: resolvedRepoUrl,
      refs: [...extractorConfig.refs],
      granularity: extractorConfig.granularity,
      range: extractorConfig.range,
      priorState,
      sessionTimestamp,
    });

    const success: RunSuccessPayload = {
      recordsWritten: result.recordsWritten,
      commitsTraversed: result.commitsTraversed,
      filesCreated: sink.filesCreated,
      bytesWritten: sink.bytesWritten,
      elapsedMs: performance.now() - startMs,
      refs: result.refs,
      profileEntries: rootProfiler.entries(),
      skippedDiffs: result.skippedDiffs,
    };

    return {
      kind: "success",
      success,
      state: result.state,
    };
  } finally {
    rootProfiler.stop();
  }
}
