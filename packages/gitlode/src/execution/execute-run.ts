import { performance } from "node:perf_hooks";

import type { DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import type { FactProjector } from "@gitlode/internal-contracts/extraction";
import { GitAdapterError } from "@gitlode/internal-contracts/git";
import type { ProgressReporter } from "@gitlode/internal-contracts/progress";
import {
  LocalInstrumentationRecorder,
  noopInstrumentation,
} from "@gitlode/internal-foundation/instrumentation";
import { recordSpanError } from "@gitlode/internal-foundation/otel-support";
import type { AbsolutePath } from "@gitlode/internal-foundation/support";
import {
  JsLineDiffCalculator,
  type JsLineDiffCalculatorDependencies,
} from "@gitlode/line-diff-adapters";
import {
  context,
  metrics,
  SpanStatusCode,
  trace,
  type Context,
  type Meter,
  type Span,
  type Tracer,
} from "@opentelemetry/api";

import {
  CommitFactExtractor,
  ExtractionPipeline,
  BuiltInFactProjector,
  FileChangeFactExpander,
  RepositoryTraversalPlanner,
  createExtractionPipelineMetricRecorder,
  createFileChangeFactExpanderMetricRecorder,
  createBuiltInFactProjectorMetricRecorder,
} from "../extraction/index.js";
import {
  formatSessionTimestamp,
  JsonlFileWriter,
  JsonlOutputSink,
  createJsonlFileWriterMetricRecorder,
} from "../output/index.js";
import {
  createEmptyCheckpoint,
  loadStateFile,
  NodeStateStore,
  saveStateFile,
  type StateStore,
  validatePriorCheckpoint,
} from "../state/index.js";
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
  ExecutionRunReporters,
  ExecutionRunInput,
  ExecutionRunResult,
  ExecutionSuccessPayload,
  WorkerRunRequest,
  WorkerRunResult,
} from "./types.js";
import { dispatchWorkerRunRequest } from "./worker-client.js";

interface WorkerExecutionReporters {
  readonly progressReporter: ProgressReporter;
  readonly diagnosticReporter: DiagnosticReporter;
}

async function finishUserError(runSpan: Span, message: string): Promise<WorkerRunResult> {
  runSpan.setAttribute("gitlode.result", "user-error");
  runSpan.setStatus({ code: SpanStatusCode.ERROR });
  runSpan.end();
  return {
    kind: "user-error",
    message,
  };
}

interface WorkerExecutionTelemetry {
  readonly executionTracer: Tracer;
  readonly extractionTracer: Tracer;
  readonly extractionMeter: Meter;
  readonly rootContext: Context;
}

const defaultWorkerExecutionTelemetry: WorkerExecutionTelemetry = {
  executionTracer: trace.getTracer("gitlode.execution"),
  extractionTracer: trace.getTracer("gitlode.extraction"),
  extractionMeter: metrics.getMeter("gitlode.extraction"),
  rootContext: context.active(),
};

async function withSetupAsyncSpan<T>(
  tracer: Tracer,
  name: string,
  callback: (span: Span) => Promise<T>,
  parentContext: Context,
): Promise<T> {
  const span = tracer.startSpan(name, undefined, parentContext);
  try {
    return await context.with(trace.setSpan(parentContext, span), () => callback(span));
  } catch (error) {
    if (error instanceof GitAdapterError) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    } else {
      recordSpanError(span, error);
    }
    throw error;
  } finally {
    span.end();
  }
}

function withSetupSpan<T>(
  tracer: Tracer,
  name: string,
  parentContext: Context,
  callback: (span: Span) => T,
): T {
  const span = tracer.startSpan(name, undefined, parentContext);
  try {
    return context.with(trace.setSpan(parentContext, span), () => callback(span));
  } catch (error) {
    if (error instanceof GitAdapterError) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    } else {
      recordSpanError(span, error);
    }
    throw error;
  } finally {
    span.end();
  }
}

export async function executeWorkerRunRequest(
  request: WorkerRunRequest,
  reporters: WorkerExecutionReporters,
  dependencies: GitAdapterFactoryDependencies = { environment: process.env },
  telemetry: WorkerExecutionTelemetry = defaultWorkerExecutionTelemetry,
): Promise<WorkerRunResult> {
  const { input, priorCheckpoint } = request;
  const recorder = input.profile
    ? new LocalInstrumentationRecorder(() => performance.now())
    : undefined;
  const instrumentation = recorder ?? noopInstrumentation;
  const { executionTracer, extractionTracer, extractionMeter, rootContext } = telemetry;

  const sessionTimestamp = new Date();
  const startMs = performance.now();
  const resolvedRepoPath: AbsolutePath = input.repositoryPath;
  const runSpan = executionTracer.startSpan(
    "gitlode.run",
    {
      attributes: {
        "gitlode.granularity": input.granularity,
        "gitlode.profile": input.profile,
        "git.adapter": input.gitAdapter,
      },
    },
    rootContext,
  );
  const runContext = trace.setSpan(rootContext, runSpan);

  try {
    const gitAdapterResult = await buildGitAdapter(input.gitAdapter, instrumentation, dependencies);
    if (gitAdapterResult.kind === "user-error") {
      return await finishUserError(runSpan, gitAdapterResult.message);
    }
    if (gitAdapterResult.gitVersion !== undefined) {
      runSpan.setAttribute("git.cli.version", gitAdapterResult.gitVersion);
    }
    await using gitAdapter = gitAdapterResult.adapter;

    await withSetupAsyncSpan(
      executionTracer,
      "gitlode.repository.access.validate",
      async () => await validateRepositoryAccess(input, resolvedRepoPath, gitAdapter),
      runContext,
    );

    const repositoryObjectFormat = await withSetupAsyncSpan(
      executionTracer,
      "gitlode.repository.object_format.resolve",
      async (span) => {
        const objectFormat = await resolveRepositoryObjectFormat(resolvedRepoPath, gitAdapter);
        span.setAttribute("gitlode.git.object_format", objectFormat);
        return objectFormat;
      },
      runContext,
    );

    withSetupSpan(executionTracer, "gitlode.state.validate", runContext, (span) => {
      span.setAttribute("gitlode.ref.prior.count", priorCheckpoint.refs.length);
      validatePriorCheckpoint(priorCheckpoint, resolvedRepoPath, repositoryObjectFormat);
    });

    const { repoName: resolvedRepoName, repoUrl: resolvedRepoUrl } = await withSetupAsyncSpan(
      executionTracer,
      "gitlode.repository.metadata.resolve",
      async (span) => {
        const basics = await resolveRepositoryBasics(
          resolvedRepoPath,
          gitAdapter,
          input.repoName,
          input.repoUrl,
        );
        span.setAttribute(
          "gitlode.repository.name.source",
          input.repoName !== undefined ? "explicit" : basics.repoUrl ? "remote_url" : "path",
        );
        span.setAttribute(
          "gitlode.repository.url.source",
          input.repoUrl !== undefined ? "explicit" : basics.repoUrl ? "remote" : "missing",
        );
        return basics;
      },
      runContext,
    );

    const resolvedRange = await withSetupAsyncSpan(
      executionTracer,
      "gitlode.extraction.range.resolve",
      async (span) => {
        span.setAttribute("gitlode.extraction.range.kind", input.range?.type ?? "none");
        return await resolveExtractionRange(input.range, resolvedRepoPath, gitAdapter);
      },
      runContext,
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

    const traversalPlanner = new RepositoryTraversalPlanner(gitAdapter, extractionTracer);
    const traversalExtractor = new CommitFactExtractor(gitAdapter, extractionTracer);
    const fileChangeExpander = new FileChangeFactExpander(
      gitAdapter,
      new JsLineDiffCalculator({ instrumentation } satisfies JsLineDiffCalculatorDependencies),
      createFileChangeFactExpanderMetricRecorder(extractionMeter),
      extractionSettings.maxDiffSize,
    );

    let projector: FactProjector;
    const { pluginBaseDirectory, pluginDeclarations } = input;
    if (!pluginBaseDirectory || !hasEffectivePluginDeclarations(pluginDeclarations)) {
      projector = new BuiltInFactProjector(
        resolvedRepoName,
        resolvedRepoUrl,
        extractionTracer,
        createBuiltInFactProjectorMetricRecorder(extractionMeter),
      );
    } else {
      const baseProjector = new BuiltInFactProjector(
        resolvedRepoName,
        resolvedRepoUrl,
        extractionTracer,
        createBuiltInFactProjectorMetricRecorder(extractionMeter),
      );
      const projectorResult = await buildPluginProjector(
        pluginDeclarations,
        pluginBaseDirectory,
        baseProjector,
        reporters,
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
        createJsonlFileWriterMetricRecorder(extractionMeter),
      ),
    );

    const coordinator = new ExtractionPipeline({
      traversalPlanner,
      traversalExtractor,
      fileChangeExpander,
      projector,
      sink,
      progressReporter: reporters.progressReporter,
      diagnosticReporter: reporters.diagnosticReporter,
      tracer: extractionTracer,
      metricRecorder: createExtractionPipelineMetricRecorder(extractionMeter),
      parentContext: runContext,
    });

    const result = await coordinator.run({
      repositoryPath: resolvedRepoPath,
      repoName: resolvedRepoName,
      repoUrl: resolvedRepoUrl,
      refs: [...extractionSettings.refs],
      granularity: extractionSettings.granularity,
      range: extractionSettings.range,
      priorCheckpoint,
      sessionTimestamp,
    });

    // End run-scoped Git processes before taking the profiling snapshot. The
    // await-using declaration still guarantees cleanup on every earlier exit.
    await gitAdapter[Symbol.asyncDispose]();

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
      checkpoint: result.checkpoint,
    };
  } catch (error) {
    if (error instanceof GitAdapterError) {
      return await finishUserError(runSpan, error.message);
    }
    recordSpanError(runSpan, error);
    runSpan.end();
    throw error;
  }
}

export interface ExecuteRunDependencies {
  readonly dispatchWorkerRunRequest: typeof dispatchWorkerRunRequest;
  readonly createStateStore: (stateFilePath: AbsolutePath) => StateStore;
  readonly loadStateFile: typeof loadStateFile;
  readonly saveStateFile?: typeof saveStateFile;
}

const defaultExecuteRunDependencies: ExecuteRunDependencies = {
  dispatchWorkerRunRequest,
  createStateStore(stateFilePath) {
    return new NodeStateStore(stateFilePath);
  },
  loadStateFile,
  saveStateFile,
};

export async function executeRun(
  input: ExecutionRunInput,
  reporters: ExecutionRunReporters,
  dependencies: ExecuteRunDependencies = defaultExecuteRunDependencies,
): Promise<ExecutionRunResult> {
  const { incremental, missingState, stateFilePath, ...workerInput } = input;
  const stateStore = stateFilePath ? dependencies.createStateStore(stateFilePath) : undefined;

  let priorCheckpoint;
  if (!stateStore || !incremental) {
    priorCheckpoint = createEmptyCheckpoint(input.repositoryPath);
  } else {
    const loadedCheckpoint = await dependencies.loadStateFile(stateStore);
    if (loadedCheckpoint === undefined) {
      if (missingState === "error") {
        throw new Error(`State file not found: ${stateFilePath}`);
      }
      reporters.diagnosticReporter.report({
        severity: "warn",
        message: `State file not found: ${stateFilePath}. Falling back to full snapshot extraction.`,
      });
      priorCheckpoint = createEmptyCheckpoint(input.repositoryPath);
    } else {
      priorCheckpoint = loadedCheckpoint;
    }
  }

  const result = await dependencies.dispatchWorkerRunRequest(
    {
      input: workerInput,
      priorCheckpoint,
    },
    reporters,
  );

  if (result.kind !== "success") {
    return result;
  }

  if (stateStore !== undefined && result.checkpoint.refs.length > 0) {
    await (dependencies.saveStateFile ?? saveStateFile)(stateStore, result.checkpoint);
  }

  return {
    kind: "success",
    success: result.success,
  };
}
