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
import type { OidProfile } from "../model/index.js";
import { OutputWriter, OutputWriterSink, formatSessionTimestamp } from "../output/index.js";
import { DefaultStageProfiler } from "../profile/index.js";
import { firstOrThrow } from "../support/index.js";
import type { WorkerRunRange, WorkerRunRequest } from "./types.js";

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

interface RuntimeExecutionInput {
  readonly repositoryPath: string;
  readonly refs: readonly string[];
  readonly outputDir: string;
  readonly outputPrefix?: string;
  readonly rotation: ExtractorConfig["rotation"];
  readonly range?: BootstrapInputRange | WorkerRunRange | ExtractionRange;
  readonly perFile: boolean;
  readonly maxDiffSize?: number;
  readonly profile: boolean;
  readonly repoName?: string;
  readonly repoUrl?: string;
  readonly configPath?: string;
  readonly extensions?: ConfigExtensionsSection;
}

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
  input: Pick<RuntimeExecutionInput, "repositoryPath" | "refs">,
  repoPath: string,
  runAdapter: GitAdapter,
): Promise<void> {
  try {
    await runAdapter.resolveRef(repoPath, firstOrThrow(input.refs));
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
  range: BootstrapInputRange | WorkerRunRange | ExtractionRange | undefined,
  repoPath: string,
  runAdapter: GitAdapter,
): Promise<ExtractionRange | undefined> {
  if (range === undefined) {
    return undefined;
  }
  if (range.type === "date") {
    if (range.since instanceof Date) {
      return { type: "date", since: range.since };
    }
    const since = new Date(range.since);
    if (Number.isNaN(since.getTime())) {
      throw new Error(`Invalid date format in worker request: ${range.since}`);
    }
    return { type: "date", since };
  }

  if ("ref" in range) {
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

async function executePreparedRuntimeSession(
  input: RuntimeExecutionInput,
  priorState: ExtractionState,
  progress: RuntimeExecutionProgress,
): Promise<RuntimeExecutionResult> {
  const rootProfiler = new DefaultStageProfiler("elapsed", () => performance.now());
  const profilingRootProfiler = input.profile ? rootProfiler : undefined;

  const sessionTimestamp = new Date();
  const startMs = performance.now();
  rootProfiler.start();

  const resolvedRepoPath = resolve(input.repositoryPath);

  try {
    const gitAdapter = new IsomorphicGitAdapter({
      fs: nodeFs,
      diffAdapter: new JsDiffAdapter(),
      profiler: profilingRootProfiler?.createScopedProfiler("git"),
    });

    await validateRepositoryAccess(input, resolvedRepoPath, gitAdapter);

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
      repositoryPath: input.repositoryPath,
      refs: input.refs,
      outputDir: input.outputDir,
      outputPrefix: resolvedOutputPrefix,
      rotation: input.rotation,
      incremental: false,
      missingState: undefined,
      range: resolvedRange,
      stateFilePath: undefined,
      perFile: input.perFile,
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
    const { configPath, extensions } = input;
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

export async function executeRuntimeSession(
  bootstrapInput: BootstrapInput,
  progress: RuntimeExecutionProgress,
): Promise<RuntimeExecutionResult> {
  const resolvedRepoPath = resolve(bootstrapInput.repositoryPath);
  const gitAdapter = new IsomorphicGitAdapter({
    fs: nodeFs,
    diffAdapter: new JsDiffAdapter(),
  });

  const repositoryObjectFormat = await resolveRepositoryObjectFormat(resolvedRepoPath, gitAdapter);
  const stateStore = bootstrapInput.stateFilePath
    ? new NodeStateStore(bootstrapInput.stateFilePath)
    : undefined;
  const priorState = await loadPriorState(
    stateStore,
    {
      incremental: bootstrapInput.incremental,
      missingState: bootstrapInput.missingState,
      stateFilePath: bootstrapInput.stateFilePath,
    },
    resolvedRepoPath,
    repositoryObjectFormat,
    progress.reporter,
  );

  return executePreparedRuntimeSession(
    {
      repositoryPath: bootstrapInput.repositoryPath,
      refs: bootstrapInput.refs,
      outputDir: bootstrapInput.outputDir,
      outputPrefix: bootstrapInput.outputPrefix,
      rotation: bootstrapInput.rotation,
      range: bootstrapInput.range,
      perFile: bootstrapInput.perFile,
      maxDiffSize: bootstrapInput.maxDiffSize,
      profile: bootstrapInput.profile,
      repoName: bootstrapInput.repoName,
      repoUrl: bootstrapInput.repoUrl,
      configPath: bootstrapInput.configPath,
      extensions: bootstrapInput.extensions,
    },
    priorState,
    progress,
  );
}

export async function executeWorkerRunRequest(
  request: WorkerRunRequest,
  progress: RuntimeExecutionProgress,
): Promise<RuntimeExecutionResult> {
  return executePreparedRuntimeSession(
    {
      repositoryPath: request.input.repositoryPath,
      refs: request.input.refs,
      outputDir: request.input.outputDir,
      outputPrefix: request.input.outputPrefix,
      rotation: request.input.rotation,
      range: request.input.range,
      perFile: request.input.perFile,
      maxDiffSize: request.input.maxDiffSize,
      profile: request.input.profile,
      repoName: request.input.repoName,
      repoUrl: request.input.repoUrl,
      configPath: request.input.configPath,
      extensions: request.input.extensions,
    },
    request.priorState,
    progress,
  );
}
