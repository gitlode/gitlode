import { performance } from "node:perf_hooks";

import {
  createDagTelemetryBinding,
  createGitMetricRecorder,
  type DagTelemetryBinding,
  type GitMetricRecorder,
} from "@gitlode/git-adapters";
import type { DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import type { FactProjector } from "@gitlode/internal-contracts/extraction";
import { GitAdapterError } from "@gitlode/internal-contracts/git";
import type { ProgressReporter } from "@gitlode/internal-contracts/progress";
import { recordSpanError } from "@gitlode/internal-foundation/otel-support";
import type { AbsolutePath } from "@gitlode/internal-foundation/support";
import {
  createLineDiffMetricRecorder,
  JsLineDiffCalculator,
  type JsLineDiffCalculatorDependencies,
} from "@gitlode/line-diff-adapters";
import {
  ROOT_CONTEXT,
  context,
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
import { WorkerTelemetrySession } from "./telemetry/worker-telemetry-session.js";
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

export function createExecutionDagTelemetryBinding(
  tracer: Tracer,
  meter: Meter,
): DagTelemetryBinding {
  return createDagTelemetryBinding(tracer, meter);
}

async function finishUserError(runSpan: Span, message: string): Promise<WorkerRunResult> {
  runSpan.setAttribute("gitlode.run.result", "user_error");
  runSpan.setStatus({ code: SpanStatusCode.ERROR });
  return {
    kind: "user-error",
    message,
  };
}

interface WorkerExecutionTelemetry {
  readonly rootSpan?: Span;
  readonly executionTracer: Tracer;
  readonly extractionTracer: Tracer;
  readonly extractionMeter: Meter;
  readonly lineDiffMeter: Meter;
  readonly rootContext: Context;
  readonly gitTracer: Tracer;
  readonly gitMetricRecorder: GitMetricRecorder;
  readonly dagTelemetryBinding: DagTelemetryBinding;
  readonly pluginRuntimeTracer: Tracer;
  readonly getPluginTracer: (name: string, version?: string) => Tracer;
  readonly getPluginMeter: (name: string, version?: string) => Meter;
}

function createDefaultWorkerExecutionTelemetry(
  adapter: ExecutionRunInput["gitAdapter"],
  session: WorkerTelemetrySession,
): WorkerExecutionTelemetry {
  const gitTracer = session.getTracer("gitlode.git");
  return {
    rootSpan: session.rootSpan,
    executionTracer: session.getTracer("gitlode.execution"),
    extractionTracer: session.getTracer("gitlode.extraction"),
    extractionMeter: session.getMeter("gitlode.extraction"),
    lineDiffMeter: session.getMeter("gitlode.line_diff"),
    rootContext: session.rootContext,
    gitTracer,
    gitMetricRecorder: createGitMetricRecorder(session.getMeter("gitlode.git"), adapter),
    dagTelemetryBinding: createExecutionDagTelemetryBinding(
      session.getTracer("gitlode.dag"),
      session.getMeter("gitlode.dag"),
    ),
    pluginRuntimeTracer: session.getTracer("gitlode.plugin_runtime"),
    getPluginTracer: (name, version) => session.getTracer(name, version),
    getPluginMeter: (name, version) => session.getMeter(name, version),
  };
}

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
  telemetry?: WorkerExecutionTelemetry,
): Promise<WorkerRunResult> {
  const { input, priorCheckpoint } = request;
  const session = telemetry ? undefined : await WorkerTelemetrySession.create(input.profile);
  const activeTelemetry =
    telemetry ??
    createDefaultWorkerExecutionTelemetry(
      input.gitAdapter,
      session ??
        (() => {
          throw new Error("Telemetry session was not created.");
        })(),
    );
  const { executionTracer, extractionTracer, extractionMeter } = activeTelemetry;

  const sessionTimestamp = new Date();
  const startMs = performance.now();
  const resolvedRepoPath: AbsolutePath = input.repositoryPath;
  const runSpan =
    activeTelemetry.rootSpan ??
    activeTelemetry.executionTracer.startSpan("gitlode.run", { root: true }, ROOT_CONTEXT);
  const rootContext = trace.setSpan(activeTelemetry.rootContext, runSpan);
  runSpan.setAttributes({
    "gitlode.extraction.granularity": input.granularity,
    "gitlode.git.adapter": input.gitAdapter,
    "gitlode.extraction.range.kind": input.range?.type ?? "none",
  });

  const applicationWork = async (): Promise<WorkerRunResult> => {
    try {
      const gitAdapterResult = await buildGitAdapter(
        input.gitAdapter,
        {
          gitTracer: activeTelemetry.gitTracer,
          gitMetricRecorder: activeTelemetry.gitMetricRecorder,
          dagTelemetryBinding: activeTelemetry.dagTelemetryBinding,
          rootContext,
        },
        dependencies,
      );
      if (gitAdapterResult.kind === "user-error") {
        return await finishUserError(runSpan, gitAdapterResult.message);
      }
      if (gitAdapterResult.gitVersion !== undefined) {
        runSpan.setAttribute("gitlode.git.cli.version", gitAdapterResult.gitVersion);
      }
      await using gitAdapter = gitAdapterResult.adapter;

      await withSetupAsyncSpan(
        executionTracer,
        "gitlode.repository.access.validate",
        async () => await validateRepositoryAccess(input, resolvedRepoPath, gitAdapter),
        rootContext,
      );

      const repositoryObjectFormat = await withSetupAsyncSpan(
        executionTracer,
        "gitlode.repository.object_format.resolve",
        async (span) => {
          const objectFormat = await resolveRepositoryObjectFormat(resolvedRepoPath, gitAdapter);
          span.setAttribute("gitlode.git.object_format", objectFormat);
          runSpan.setAttribute("gitlode.git.object_format", objectFormat);
          return objectFormat;
        },
        rootContext,
      );

      withSetupSpan(executionTracer, "gitlode.state.validate", rootContext, (span) => {
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
        rootContext,
      );

      const resolvedRange = await withSetupAsyncSpan(
        executionTracer,
        "gitlode.extraction.range.resolve",
        async (span) => {
          span.setAttribute("gitlode.extraction.range.kind", input.range?.type ?? "none");
          return await resolveExtractionRange(input.range, resolvedRepoPath, gitAdapter);
        },
        rootContext,
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
        new JsLineDiffCalculator({
          metricRecorder: createLineDiffMetricRecorder(activeTelemetry.lineDiffMeter),
        } satisfies JsLineDiffCalculatorDependencies),
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
          false,
        );
        const projectorResult = await buildPluginProjector(
          pluginDeclarations,
          pluginBaseDirectory,
          baseProjector,
          reporters,
          {
            pluginRuntimeTracer: activeTelemetry.pluginRuntimeTracer,
            projectionTracer: extractionTracer,
            rootContext,
            getPluginTracer: activeTelemetry.getPluginTracer,
            getPluginMeter: activeTelemetry.getPluginMeter,
          },
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

      const success: ExecutionSuccessPayload = {
        recordsWritten: result.recordsWritten,
        commitsTraversed: result.commitsTraversed,
        filesCreated: sink.filesCreated,
        bytesWritten: sink.bytesWritten,
        elapsedMs: performance.now() - startMs,
        refs: result.refs,
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
      runSpan.setAttribute("gitlode.run.result", "runtime_error");
      recordSpanError(runSpan, error);
      if (telemetry) {
        runSpan.end();
        throw error;
      }
      return {
        kind: "runtime-error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  };
  const applicationResult = await (session
    ? session.runInRootContext(applicationWork)
    : context.with(rootContext, applicationWork));

  if (applicationResult.kind === "success") {
    runSpan.setAttributes({
      "gitlode.run.result": "success",
      "gitlode.commit.unique.count": applicationResult.success.commitsTraversed,
      "gitlode.output.record.count": applicationResult.success.recordsWritten,
      "gitlode.output.file.count": applicationResult.success.filesCreated,
      "gitlode.output.size": applicationResult.success.bytesWritten,
    });
  }
  if (!session) {
    runSpan.end();
    return applicationResult;
  }
  const finalized = await session.finalize(applicationResult);
  if (finalized.initializationWarning) {
    reporters.diagnosticReporter.report({
      severity: "warn",
      message: "Telemetry initialization degraded; profile data is unavailable.",
    });
  }
  if (!finalized.profileReport) return finalized.applicationResult;
  if (finalized.applicationResult.kind === "success") {
    return {
      ...finalized.applicationResult,
      success: { ...finalized.applicationResult.success, profileReport: finalized.profileReport },
    };
  }
  return { ...finalized.applicationResult, profileReport: finalized.profileReport };
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
