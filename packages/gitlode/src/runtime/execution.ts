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
import {
  EXPERIMENTAL_COMMIT_TRAVERSAL_ENV,
  GitCliAdapter,
  IsomorphicGitAdapter,
  JsDiffAdapter,
  createCommitTraversalStrategy,
  resolveCommitTraversalStrategyName,
} from "../git-impl/index.js";
import { type GitAdapter, GitAdapterError } from "../git/index.js";
import {
  LocalInstrumentationRecorder,
  noopInstrumentation,
  type Instrumentation,
} from "../instrumentation/index.js";
import { OutputWriter, OutputWriterSink, formatSessionTimestamp } from "../output/index.js";
import {
  checkPluginCompatibility,
  initializePlugins,
  type PluginInitializationFailure,
  resolvePluginEntries,
} from "../plugins/index.js";
import type { RunSuccessPayload } from "../presentation/types.js";
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

export interface RuntimeExecutionDependencies {
  readonly environment: Readonly<Record<string, string | undefined>>;
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

function formatPluginInitializationFailure(result: PluginInitializationFailure): string {
  return `Plugin "${result.entry.namespace}" init failed.`;
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

type BuildGitAdapterResult =
  | {
      readonly kind: "success";
      readonly adapter: GitAdapter;
      readonly gitVersion?: string;
    }
  | { readonly kind: "user-error"; readonly message: string };

function resolveIsomorphicCommitTraversalStrategyFromEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
) {
  return createCommitTraversalStrategy(
    resolveCommitTraversalStrategyName(environment[EXPERIMENTAL_COMMIT_TRAVERSAL_ENV]),
  );
}

async function buildGitAdapter(
  input: WorkerRunInput,
  instrumentation: Instrumentation,
  dependencies: RuntimeExecutionDependencies,
): Promise<BuildGitAdapterResult> {
  switch (input.gitAdapter) {
    case "isomorphic-git": {
      let commitTraversalStrategy;
      try {
        commitTraversalStrategy = resolveIsomorphicCommitTraversalStrategyFromEnvironment(
          dependencies.environment,
        );
      } catch (error) {
        return {
          kind: "user-error",
          message: error instanceof Error ? error.message : String(error),
        };
      }
      return {
        kind: "success",
        adapter: new IsomorphicGitAdapter({
          fs: nodeFs,
          instrumentation,
          commitTraversalStrategy,
        }),
      };
    }
    case "git-cli": {
      const adapter = new GitCliAdapter({
        instrumentation,
      });
      try {
        const gitVersion = await adapter.validateGitExecutable();
        return {
          kind: "success",
          adapter,
          gitVersion,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          kind: "user-error",
          message,
        };
      }
    }
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
  instrumentation: Instrumentation,
): Promise<BuildProjectorResult> {
  progress.reporter.emit({ type: "phase-start", phase: "initializing-plugins" });

  const pluginEntriesResult = await instrumentation.runAsync(
    "gitlode.plugins.resolve_entries",
    async () => await resolvePluginEntries(config.extensions, config.baseDir),
  );
  if (pluginEntriesResult.kind === "termination") {
    return {
      kind: "termination",
      message: pluginEntriesResult.termination.message,
    };
  }

  const pluginEntries = pluginEntriesResult.entries;

  await instrumentation.runAsync("gitlode.plugins.check_compatibility", async () => {
    await checkPluginCompatibility(pluginEntries, config.extensions, config.baseDir, {
      warn(message) {
        progress.renderDiagnostic("warn", message);
      },
    });
  });

  const pluginInitResults = await instrumentation.runAsync(
    "gitlode.plugins.initialize",
    async (span) => {
      span.incrementCounter("plugins", pluginEntries.length);
      return await initializePlugins(pluginEntries, (entry) => ({
        warn(message) {
          progress.renderDiagnostic("warn", `Plugin "${entry.namespace}": ${message}`);
        },
        error(message) {
          progress.renderDiagnostic("error", `Plugin "${entry.namespace}": ${message}`);
        },
        instrumentation,
      }));
    },
  );

  const pluginInitFailures = pluginInitResults.filter((result) => result.type === "fatal");
  if (pluginInitFailures.length > 0) {
    return {
      kind: "termination",
      message: pluginInitFailures
        .map((result) => formatPluginInitializationFailure(result))
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

async function finishUserError(
  runSpan: ReturnType<Instrumentation["startSpan"]>,
  message: string,
): Promise<RuntimeExecutionResult> {
  runSpan.setAttribute("gitlode.result", "user-error");
  runSpan.end();
  return {
    kind: "user-error",
    message,
  };
}

export async function executeWorkerRunRequest(
  request: WorkerRunRequest,
  progress: RuntimeExecutionProgress,
  dependencies: RuntimeExecutionDependencies = { environment: process.env },
): Promise<RuntimeExecutionResult> {
  const { input, priorState } = request;
  const recorder = input.profile
    ? new LocalInstrumentationRecorder(() => performance.now())
    : undefined;
  const instrumentation = recorder ?? noopInstrumentation;

  const sessionTimestamp = new Date();
  const startMs = performance.now();
  const resolvedRepoPath: AbsolutePath = input.repositoryPath;
  const runSpan = instrumentation.startSpan("gitlode.run", {
    attributes: {
      "gitlode.granularity": input.granularity,
      "gitlode.profile": input.profile,
      "git.adapter": input.gitAdapter,
    },
  });

  try {
    const gitAdapterResult = await buildGitAdapter(input, instrumentation, dependencies);
    if (gitAdapterResult.kind === "user-error") {
      return await finishUserError(runSpan, gitAdapterResult.message);
    }
    if (gitAdapterResult.gitVersion !== undefined) {
      runSpan.setAttribute("git.cli.version", gitAdapterResult.gitVersion);
    }
    await using gitAdapter = gitAdapterResult.adapter;

    await instrumentation.runAsync(
      "gitlode.validate_repository_access",
      async () => await validateRepositoryAccess(input, resolvedRepoPath, gitAdapter),
    );

    const repositoryObjectFormat = await instrumentation.runAsync(
      "gitlode.resolve_object_format",
      async (span) => {
        const objectFormat = await resolveRepositoryObjectFormat(resolvedRepoPath, gitAdapter);
        span.setAttribute("git.object_format", objectFormat);
        return objectFormat;
      },
    );

    instrumentation.run("gitlode.state.validate", () => {
      validateExtractionState(priorState, resolvedRepoPath, repositoryObjectFormat);
    });

    const { repoName: resolvedRepoName, repoUrl: resolvedRepoUrl } = await instrumentation.runAsync(
      "gitlode.repository_basics",
      async () =>
        await resolveRepositoryBasics(resolvedRepoPath, gitAdapter, input.repoName, input.repoUrl),
    );

    const resolvedRange = await instrumentation.runAsync(
      "gitlode.resolve_extraction_range",
      async (span) => {
        span.setAttribute("gitlode.range.kind", input.range?.type ?? "none");
        return await resolveExtractionRange(input.range, resolvedRepoPath, gitAdapter);
      },
    );

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

    const traversalPlanner = new DefaultTraversalPlanner(gitAdapter, instrumentation);
    const traversalExtractor = new DefaultCommitTraversalExtractor(gitAdapter, instrumentation);
    const fileChangeExpander = new DefaultFileChangeExpander(
      gitAdapter,
      new JsDiffAdapter(),
      instrumentation,
      extractorConfig.maxDiffSize,
    );

    let projector: FactProjector;
    const { configBaseDir: configPath, extensions } = input;
    if (!configPath || !hasEffectiveExtensionsConfig(extensions)) {
      projector = new DefaultFactProjector(resolvedRepoName, resolvedRepoUrl, instrumentation);
    } else {
      const projectorResult = await buildCustomProjector(
        {
          repoName: resolvedRepoName,
          repoUrl: resolvedRepoUrl,
          baseDir: configPath,
          extensions,
        },
        progress,
        instrumentation,
      );
      if (projectorResult.kind === "termination") {
        return await finishUserError(runSpan, projectorResult.message);
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
      instrumentation,
    });

    const result = await instrumentation.runAsync("gitlode.extract", async (span) => {
      span.incrementCounter("refs", extractorConfig.refs.length);
      const coordinatorResult = await coordinator.run({
        repositoryPath: resolvedRepoPath,
        repoName: resolvedRepoName,
        repoUrl: resolvedRepoUrl,
        refs: [...extractorConfig.refs],
        granularity: extractorConfig.granularity,
        range: extractorConfig.range,
        priorState,
        sessionTimestamp,
      });
      span.incrementCounter("records", coordinatorResult.recordsWritten);
      span.incrementCounter("commits", coordinatorResult.commitsTraversed);
      span.incrementCounter("skipped_diffs", coordinatorResult.skippedDiffs);
      return coordinatorResult;
    });

    // End run-scoped Git processes before taking the profiling snapshot. The
    // await-using declaration still guarantees cleanup on every earlier exit.
    await gitAdapter[Symbol.asyncDispose]();

    runSpan.incrementCounter("records", result.recordsWritten);
    runSpan.incrementCounter("commits", result.commitsTraversed);
    runSpan.setAttribute("gitlode.result", "success");
    runSpan.end();

    const success: RunSuccessPayload = {
      recordsWritten: result.recordsWritten,
      commitsTraversed: result.commitsTraversed,
      filesCreated: sink.filesCreated,
      bytesWritten: sink.bytesWritten,
      elapsedMs: performance.now() - startMs,
      refs: result.refs,
      profileEntries: recorder?.summary() ?? [],
      skippedDiffs: result.skippedDiffs,
    };

    return {
      kind: "success",
      success,
      state: result.state,
    };
  } catch (error) {
    runSpan.end(error);
    throw error;
  }
}
