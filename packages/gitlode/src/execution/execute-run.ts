import { performance } from "node:perf_hooks";

import type { FactProjector } from "../extraction-api/index.js";
import {
  CommitFactExtractor,
  ExtractionPipeline,
  BuiltInFactProjector,
  FileChangeFactExpander,
  RepositoryTraversalPlanner,
} from "../extraction/index.js";
import {
  LocalInstrumentationRecorder,
  noopInstrumentation,
  type Instrumentation,
} from "../instrumentation/index.js";
import { JsLineDiffCalculator } from "../line-diff-impl/index.js";
import { formatSessionTimestamp, JsonlFileWriter, JsonlOutputSink } from "../output/index.js";
import type { ProgressReporter } from "../progress/index.js";
import {
  createEmptyState,
  loadStateFile,
  NodeStateStore,
  type StateStore,
  validatePriorState,
} from "../state/index.js";
import type { AbsolutePath } from "../support/index.js";
import { buildGitAdapter, type GitAdapterFactoryDependencies } from "./git-adapter-factory.js";
import { buildPluginProjector, hasEffectivePluginDeclarations } from "./plugin-bootstrap.js";
import {
  resolveExtractionRange,
  resolveOutputPrefix,
  resolveRepositoryObjectFormat,
  resolveRepositoryBasics,
  validateRepositoryAccess,
} from "./repository-context.js";
import type {
  ExecutionRunHandlers,
  ExecutionRunInput,
  ExecutionRunResult,
  ExecutionSuccessPayload,
  WorkerRunRequest,
  WorkerRunResult,
} from "./types.js";
import { dispatchWorkerRunRequest } from "./worker-client.js";

interface WorkerExecutionProgress {
  readonly reporter: ProgressReporter;
  readonly renderDiagnostic: (severity: "warn" | "error", message: string) => void;
}

async function finishUserError(
  runSpan: ReturnType<Instrumentation["startSpan"]>,
  message: string,
): Promise<WorkerRunResult> {
  runSpan.setAttribute("gitlode.result", "user-error");
  runSpan.end();
  return {
    kind: "user-error",
    message,
  };
}

export async function executeWorkerRunRequest(
  request: WorkerRunRequest,
  progress: WorkerExecutionProgress,
  dependencies: GitAdapterFactoryDependencies = { environment: process.env },
): Promise<WorkerRunResult> {
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
    const gitAdapterResult = await buildGitAdapter(input.gitAdapter, instrumentation, dependencies);
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
      validatePriorState(priorState, resolvedRepoPath, repositoryObjectFormat);
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
    const extractionSettings = {
      refs: input.refs,
      outputDir: input.outputDir,
      outputPrefix: resolvedOutputPrefix,
      rotation: input.rotation,
      range: resolvedRange,
      granularity: input.granularity,
      maxDiffSize: input.maxDiffSize,
    };

    const traversalPlanner = new RepositoryTraversalPlanner(gitAdapter, instrumentation);
    const traversalExtractor = new CommitFactExtractor(gitAdapter, instrumentation);
    const fileChangeExpander = new FileChangeFactExpander(
      gitAdapter,
      new JsLineDiffCalculator(),
      instrumentation,
      extractionSettings.maxDiffSize,
    );

    let projector: FactProjector;
    const { pluginBaseDirectory, pluginDeclarations } = input;
    if (!pluginBaseDirectory || !hasEffectivePluginDeclarations(pluginDeclarations)) {
      projector = new BuiltInFactProjector(resolvedRepoName, resolvedRepoUrl, instrumentation);
    } else {
      // Plugin-enabled projection historically omitted base-projection profiling.
      // Preserve that observable profile shape during this domain migration.
      const baseProjector = new BuiltInFactProjector(
        resolvedRepoName,
        resolvedRepoUrl,
        noopInstrumentation,
      );
      const projectorResult = await buildPluginProjector(
        pluginDeclarations,
        pluginBaseDirectory,
        baseProjector,
        progress,
        instrumentation,
      );
      if (projectorResult.kind === "termination") {
        return await finishUserError(runSpan, projectorResult.message);
      }
      projector = projectorResult.projector;
    }

    const sink = new JsonlOutputSink(
      new JsonlFileWriter(
        extractionSettings.outputDir,
        (seq) =>
          `${extractionSettings.outputPrefix}-${formatSessionTimestamp(sessionTimestamp)}-${String(seq).padStart(6, "0")}.jsonl`,
        extractionSettings.rotation,
      ),
    );

    const coordinator = new ExtractionPipeline({
      traversalPlanner,
      traversalExtractor,
      fileChangeExpander,
      projector,
      sink,
      reporter: progress.reporter,
      instrumentation,
    });

    const result = await instrumentation.runAsync("gitlode.extract", async (span) => {
      span.incrementCounter("refs", extractionSettings.refs.length);
      const coordinatorResult = await coordinator.run({
        repositoryPath: resolvedRepoPath,
        repoName: resolvedRepoName,
        repoUrl: resolvedRepoUrl,
        refs: [...extractionSettings.refs],
        granularity: extractionSettings.granularity,
        range: extractionSettings.range,
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

    const success: ExecutionSuccessPayload = {
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

export interface ExecuteRunDependencies {
  readonly dispatchWorkerRunRequest: typeof dispatchWorkerRunRequest;
  readonly createStateStore: (stateFilePath: AbsolutePath) => StateStore;
  readonly loadStateFile: typeof loadStateFile;
}

const defaultExecuteRunDependencies: ExecuteRunDependencies = {
  dispatchWorkerRunRequest,
  createStateStore(stateFilePath) {
    return new NodeStateStore(stateFilePath);
  },
  loadStateFile,
};

export async function executeRun(
  input: ExecutionRunInput,
  handlers: ExecutionRunHandlers,
  dependencies: ExecuteRunDependencies = defaultExecuteRunDependencies,
): Promise<ExecutionRunResult> {
  const { incremental, missingState, stateFilePath, ...workerInput } = input;
  const stateStore = stateFilePath ? dependencies.createStateStore(stateFilePath) : undefined;

  let priorState;
  if (!stateStore || !incremental) {
    priorState = createEmptyState(input.repositoryPath);
  } else {
    const loadedState = await dependencies.loadStateFile(stateStore);
    if (loadedState === undefined) {
      if (missingState === "error") {
        throw new Error(`State file not found: ${stateFilePath}`);
      }
      handlers.onProgress({
        type: "warning",
        message: `State file not found: ${stateFilePath}. Falling back to full snapshot extraction.`,
      });
      priorState = createEmptyState(input.repositoryPath);
    } else {
      priorState = loadedState;
    }
  }

  const result = await dependencies.dispatchWorkerRunRequest(
    {
      input: workerInput,
      priorState,
    },
    handlers,
  );

  if (result.kind !== "success") {
    return result;
  }

  if (stateStore !== undefined && result.state.refs.length > 0) {
    await stateStore.write(result.state);
  }

  return {
    kind: "success",
    success: result.success,
  };
}
