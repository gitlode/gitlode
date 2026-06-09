import nodeFs from "node:fs";
import { basename, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import type { BootstrapInput, BootstrapInputRange } from "../cli/args.js";
import type { ConfigExtensionsSection } from "../cli/config/index.js";
import {
  checkPluginCompatibility,
  initializePlugins,
  resolvePluginEntries,
} from "../cli/plugins.js";
import {
  NodeStateStore,
  assertSupportedRepositoryObjectFormat,
  deriveRepoName,
  loadPriorState,
  type RunSuccessPayload,
} from "../cli/runtime/index.js";
import {
  DefaultCommitTraversalExtractor,
  DefaultExtractionCoordinator,
  type ExtractionState,
  type ExtractorConfig,
  type ExtractionRange,
  type FactProjector,
  type OidProfile,
  type ProgressReporter,
  DefaultFactProjector,
  DefaultFileChangeExpander,
  DefaultTraversalPlanner,
  EnrichingFactProjector,
} from "../core/index.js";
import { DefaultStageProfiler } from "../core/profile/index.js";
import {
  GitAdapterError,
  type GitAdapter,
  IsomorphicGitAdapter,
  JsDiffAdapter,
} from "../git/index.js";
import { OutputWriter, OutputWriterSink, formatSessionTimestamp } from "../output/index.js";

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
  input: BootstrapInput,
  repoPath: string,
  runAdapter: GitAdapter,
): Promise<void> {
  try {
    await runAdapter.resolveRef(repoPath, input.refs[0]!);
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

async function resolveRepositoryObjectFormat(
  repoPath: string,
  runAdapter: GitAdapter,
): Promise<OidProfile> {
  const supportedObjectFormats = runAdapter.supportedObjectFormats();
  const repositoryObjectFormat = await runAdapter.getRepositoryObjectFormat(repoPath);
  assertSupportedRepositoryObjectFormat(repositoryObjectFormat, supportedObjectFormats);
  return repositoryObjectFormat;
}

async function resolveExtractionRange(
  range: BootstrapInputRange | undefined,
  repoPath: string,
  runAdapter: GitAdapter,
): Promise<ExtractionRange | undefined> {
  if (range === undefined) {
    return undefined;
  }
  if (range.type === "date") {
    return range;
  }

  try {
    const resolvedSinceRef = await runAdapter.resolveRef(repoPath, range.sinceRef);
    return { type: "ref", ref: resolvedSinceRef };
  } catch (error) {
    if (error instanceof GitAdapterError && error.code === "REF_NOT_FOUND") {
      throw new GitAdapterError(`Ref not found: ${range.sinceRef}`, "REF_NOT_FOUND");
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

function buildExtractorConfig(
  input: BootstrapInput,
  resolvedRange: ExtractionRange | undefined,
  resolvedOutputPrefix: string,
): ExtractorConfig {
  return {
    repositoryPath: input.repositoryPath,
    refs: input.refs,
    outputDir: input.outputDir,
    outputPrefix: resolvedOutputPrefix,
    rotation: input.rotation,
    incremental: input.incremental,
    missingState: input.missingState,
    range: resolvedRange,
    stateFilePath: input.stateFilePath,
    perFile: input.perFile,
    maxDiffSize: input.maxDiffSize,
  };
}

async function buildCustomProjector(
  config: {
    repoName: string;
    repoUrl: string | null;
    configPath: string;
    extensions: ConfigExtensionsSection;
  },
  progress: RuntimeExecutionProgress,
  projectionProfiler?: ReturnType<typeof DefaultStageProfiler.prototype.createScopedProfiler>,
): Promise<BuildProjectorResult> {
  progress.reporter.emit({ type: "phase-start", phase: "initializing-plugins" });

  const pluginEntriesResult = await resolvePluginEntries(config.extensions, config.configPath);
  if (pluginEntriesResult.kind === "termination") {
    return {
      kind: "termination",
      message: pluginEntriesResult.termination.message,
    };
  }

  const pluginEntries = pluginEntriesResult.entries;

  await checkPluginCompatibility(pluginEntries, config.extensions, config.configPath, {
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

export async function executeRuntimeSession(
  bootstrapInput: BootstrapInput,
  progress: RuntimeExecutionProgress,
): Promise<RuntimeExecutionResult> {
  const rootProfiler = new DefaultStageProfiler("elapsed", () => performance.now());
  const profilingRootProfiler = bootstrapInput.profile ? rootProfiler : undefined;

  const sessionTimestamp = new Date();
  const startMs = performance.now();
  rootProfiler.start();

  const resolvedRepoPath = resolve(bootstrapInput.repositoryPath);

  try {
    const gitAdapter = new IsomorphicGitAdapter({
      fs: nodeFs,
      diffAdapter: new JsDiffAdapter(),
      profiler: profilingRootProfiler?.createScopedProfiler("git"),
    });

    await validateRepositoryAccess(bootstrapInput, resolvedRepoPath, gitAdapter);

    const repositoryObjectFormat = await resolveRepositoryObjectFormat(
      resolvedRepoPath,
      gitAdapter,
    );

    const { repoName: resolvedRepoName, repoUrl: resolvedRepoUrl } = await resolveRepositoryBasics(
      resolvedRepoPath,
      gitAdapter,
      bootstrapInput.repoName,
      bootstrapInput.repoUrl,
    );

    const resolvedRange = await resolveExtractionRange(
      bootstrapInput.range,
      resolvedRepoPath,
      gitAdapter,
    );
    const resolvedOutputPrefix = resolveOutputPrefix(
      bootstrapInput.outputPrefix,
      resolvedRepoUrl,
      resolvedRepoPath,
    );
    const extractorConfig = buildExtractorConfig(
      bootstrapInput,
      resolvedRange,
      resolvedOutputPrefix,
    );

    const stateStore = extractorConfig.stateFilePath
      ? new NodeStateStore(extractorConfig.stateFilePath)
      : undefined;
    const priorState = await loadPriorState(
      stateStore,
      {
        incremental: extractorConfig.incremental,
        missingState: extractorConfig.missingState,
        stateFilePath: extractorConfig.stateFilePath,
      },
      resolvedRepoPath,
      repositoryObjectFormat,
      progress.reporter,
    );

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
    const { configPath, extensions } = bootstrapInput;
    if (!configPath || !hasEffectiveExtensionsConfig(extensions)) {
      projector = new DefaultFactProjector(resolvedRepoName, resolvedRepoUrl, projectionProfiler);
    } else {
      const projectorResult = await buildCustomProjector(
        {
          repoName: resolvedRepoName,
          repoUrl: resolvedRepoUrl,
          configPath,
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
      granularity: extractorConfig.perFile ? "file" : "commit",
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
