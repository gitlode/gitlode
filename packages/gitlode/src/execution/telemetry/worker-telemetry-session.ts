import { TELEMETRY_SPANS, type ProfileReport } from "@gitlode/internal-contracts/telemetry";
import {
  ROOT_CONTEXT,
  context,
  trace,
  type Context,
  type Meter,
  type Span,
  type Tracer,
} from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { AlwaysOffSampler, BasicTracerProvider } from "@opentelemetry/sdk-trace-base";

import { BoundedDiagnosticAccumulator } from "./diagnostic-accumulator.js";
import {
  createLocalMetricViews,
  LocalMetricReader,
  type LocalMetricSnapshot,
} from "./local-metric-reader.js";
import { LocalSpanProcessor } from "./local-span-processor.js";
import { ProfileReportBuilder } from "./profile-report-builder.js";

const runSpanMetadata = (() => {
  const metadata = TELEMETRY_SPANS.find((span) => span.id === "run");
  if (!metadata || metadata.scope.type !== "core")
    throw new Error("Invalid run span telemetry metadata");
  return metadata;
})();

export interface WorkerTelemetryInitializationWarning {
  readonly code: "telemetry_initialization_failed";
  readonly message: string | null;
}

export interface WorkerTelemetryFinalization<Result> {
  readonly applicationResult: Result;
  readonly profileReport?: ProfileReport;
  readonly initializationWarning?: WorkerTelemetryInitializationWarning;
}

export type WorkerTelemetryTestAttempt =
  | "provider_initialization"
  | "trace_provider_construction"
  | "meter_provider_construction"
  | "context_initialization"
  | "context_manager_construction"
  | "context_manager_enable"
  | "context_manager_registration"
  | "initialization_trace_provider_cleanup"
  | "initialization_meter_provider_cleanup"
  | "initialization_context_manager_cleanup"
  | "root_end"
  | "trace_flush"
  | "metric_collect"
  | "report_build"
  | "telemetry_shutdown"
  | "trace_provider_shutdown"
  | "meter_provider_shutdown"
  | "context_manager_cleanup";

export interface WorkerTelemetryTestHooks {
  readonly failures?: Partial<Record<WorkerTelemetryTestAttempt, unknown>>;
  readonly onAttempt?: (attempt: WorkerTelemetryTestAttempt) => void;
}

interface ActiveSessionResources {
  readonly diagnostics: BoundedDiagnosticAccumulator;
  readonly spanProcessor: LocalSpanProcessor;
  readonly metricReader: LocalMetricReader;
  readonly reportBuilder: ProfileReportBuilder;
}

interface SessionConstruction {
  readonly tracerProvider: BasicTracerProvider;
  readonly meterProvider: MeterProvider;
  readonly rootSpan: Span;
  readonly rootContext: Context;
  readonly ownedContextManager?: AsyncLocalStorageContextManager;
  readonly active?: ActiveSessionResources;
  readonly initializationWarning?: WorkerTelemetryInitializationWarning;
  readonly hooks?: WorkerTelemetryTestHooks;
}

function hasFailure(
  hooks: WorkerTelemetryTestHooks | undefined,
  attempt: WorkerTelemetryTestAttempt,
) {
  return Object.prototype.hasOwnProperty.call(hooks?.failures ?? {}, attempt);
}

function attempt(
  hooks: WorkerTelemetryTestHooks | undefined,
  name: WorkerTelemetryTestAttempt,
): void {
  hooks?.onAttempt?.(name);
  if (hasFailure(hooks, name)) throw hooks?.failures?.[name];
}

async function ignoreFailure(callback: () => void | Promise<void>): Promise<void> {
  try {
    await callback();
  } catch {
    // Telemetry cleanup must not escape into application work.
  }
}

async function cleanupInitializationResource(
  hooks: WorkerTelemetryTestHooks | undefined,
  attemptName:
    | "initialization_trace_provider_cleanup"
    | "initialization_meter_provider_cleanup"
    | "initialization_context_manager_cleanup",
  cleanup: () => void | Promise<void>,
): Promise<void> {
  try {
    attempt(hooks, attemptName);
  } catch {
    // Initialization cleanup continues after an injected cleanup failure.
  }
  await ignoreFailure(cleanup);
}

function createDegradedProviders(): {
  tracerProvider: BasicTracerProvider;
  meterProvider: MeterProvider;
  rootSpan: Span;
} {
  const tracerProvider = new BasicTracerProvider({ sampler: new AlwaysOffSampler() });
  const meterProvider = new MeterProvider();
  const tracer = tracerProvider.getTracer(runSpanMetadata.scope.name);
  return {
    tracerProvider,
    meterProvider,
    rootSpan: tracer.startSpan(runSpanMetadata.name, { root: true }, ROOT_CONTEXT),
  };
}

export class WorkerTelemetrySession {
  readonly #tracerProvider: BasicTracerProvider;
  readonly #meterProvider: MeterProvider;
  readonly #rootSpan: Span;
  readonly #rootContext: Context;
  readonly #ownedContextManager?: AsyncLocalStorageContextManager;
  readonly #active?: ActiveSessionResources;
  readonly #initializationWarning?: WorkerTelemetryInitializationWarning;
  readonly #hooks?: WorkerTelemetryTestHooks;
  #finalizationPromise?: Promise<WorkerTelemetryFinalization<unknown>>;

  constructor(construction: SessionConstruction) {
    this.#tracerProvider = construction.tracerProvider;
    this.#meterProvider = construction.meterProvider;
    this.#rootSpan = construction.rootSpan;
    this.#rootContext = construction.rootContext;
    this.#ownedContextManager = construction.ownedContextManager;
    this.#active = construction.active;
    this.#initializationWarning = construction.initializationWarning;
    this.#hooks = construction.hooks;
  }

  static create(): Promise<WorkerTelemetrySession> {
    return createSession();
  }

  getTracer(scopeName: string, scopeVersion?: string): Tracer {
    return this.#tracerProvider.getTracer(scopeName, scopeVersion);
  }

  getMeter(scopeName: string, scopeVersion?: string): Meter {
    return this.#meterProvider.getMeter(scopeName, scopeVersion);
  }

  get rootSpan(): Span {
    return this.#rootSpan;
  }

  get rootContext(): Context {
    return this.#rootContext;
  }

  runInRootContext<Value>(callback: () => Value): Value {
    return context.with(this.#rootContext, callback);
  }

  finalize<Result>(applicationResult: Result): Promise<WorkerTelemetryFinalization<Result>> {
    if (!this.#finalizationPromise) {
      const initial: WorkerTelemetryFinalization<Result> = this.#initializationWarning
        ? {
            applicationResult,
            initializationWarning: this.#initializationWarning,
          }
        : { applicationResult };
      this.#finalizationPromise = this.#finalize(initial);
    }
    return this.#finalizationPromise as Promise<WorkerTelemetryFinalization<Result>>;
  }

  async #finalize<Result>(
    initial: WorkerTelemetryFinalization<Result>,
  ): Promise<WorkerTelemetryFinalization<Result>> {
    const active = this.#active;
    let traceFailed = false;
    let profileReport: ProfileReport | undefined;

    try {
      attempt(this.#hooks, "root_end");
    } catch {
      traceFailed = true;
      active?.diagnostics.add({
        code: "lifecycle_failure",
        stage: "trace_flush",
        signal: "spans",
      });
    }
    try {
      this.#rootSpan.end();
    } catch {
      traceFailed = true;
      active?.diagnostics.add({
        code: "lifecycle_failure",
        stage: "trace_flush",
        signal: "spans",
      });
    }

    try {
      attempt(this.#hooks, "trace_flush");
    } catch {
      traceFailed = true;
      active?.diagnostics.add({
        code: "lifecycle_failure",
        stage: "trace_flush",
        signal: "spans",
      });
    }
    try {
      await this.#tracerProvider.forceFlush();
    } catch {
      traceFailed = true;
      active?.diagnostics.add({
        code: "lifecycle_failure",
        stage: "trace_flush",
        signal: "spans",
      });
    }

    if (active) {
      const spanSnapshot = active.spanProcessor.snapshot();
      let metricSnapshot: LocalMetricSnapshot = {
        counterStatus: "unavailable" as const,
        histogramStatus: "unavailable" as const,
        counters: [],
        histograms: [],
      };
      let metricFailed = false;
      try {
        attempt(this.#hooks, "metric_collect");
      } catch {
        metricFailed = true;
      }
      try {
        const collected = await active.metricReader.collectSnapshot(active.diagnostics);
        if (!metricFailed) metricSnapshot = collected;
      } catch {
        metricFailed = true;
      }
      if (metricFailed) {
        for (const signal of ["counters", "histograms"] as const)
          active.diagnostics.add({
            code: "lifecycle_failure",
            stage: "metric_collection",
            signal,
          });
      }

      const reportInput = {
        spans: {
          status: traceFailed ? ("partial" as const) : spanSnapshot.status,
          values: spanSnapshot.spans,
        },
        counters: { status: metricSnapshot.counterStatus, values: metricSnapshot.counters },
        histograms: { status: metricSnapshot.histogramStatus, values: metricSnapshot.histograms },
      };
      try {
        attempt(this.#hooks, "report_build");
      } catch {
        active.diagnostics.add({
          code: "lifecycle_failure",
          stage: "report_build",
          signal: "report",
        });
      }
      try {
        profileReport = active.reportBuilder.build(reportInput);
      } catch {
        active.diagnostics.add({
          code: "lifecycle_failure",
          stage: "report_build",
          signal: "report",
        });
      }
    }

    let shutdownFailureCount = 0;
    try {
      attempt(this.#hooks, "telemetry_shutdown");
    } catch {
      shutdownFailureCount += 1;
    }
    shutdownFailureCount += await this.#shutdownResource("trace_provider_shutdown", () =>
      this.#tracerProvider.shutdown(),
    );
    shutdownFailureCount += await this.#shutdownResource("meter_provider_shutdown", () =>
      this.#meterProvider.shutdown(),
    );
    if (this.#ownedContextManager)
      shutdownFailureCount += await this.#shutdownResource("context_manager_cleanup", () =>
        context.disable(),
      );

    if (active && shutdownFailureCount > 0) {
      for (let index = 0; index < shutdownFailureCount; index += 1)
        active.diagnostics.add({
          code: "lifecycle_failure",
          stage: "telemetry_shutdown",
          signal: "telemetry",
        });
      if (profileReport)
        profileReport = { ...profileReport, diagnostics: active.diagnostics.snapshot() };
    }

    return profileReport ? { ...initial, profileReport } : initial;
  }

  async #shutdownResource(
    attemptName: "trace_provider_shutdown" | "meter_provider_shutdown" | "context_manager_cleanup",
    shutdown: () => void | Promise<void>,
  ): Promise<number> {
    let failureCount = 0;
    try {
      attempt(this.#hooks, attemptName);
    } catch {
      failureCount += 1;
    }
    try {
      await shutdown();
    } catch {
      failureCount += 1;
    }
    return failureCount;
  }
}

async function createSession(hooks?: WorkerTelemetryTestHooks): Promise<WorkerTelemetrySession> {
  let tracerProvider: BasicTracerProvider | undefined;
  let meterProvider: MeterProvider | undefined;
  let spanProcessor: LocalSpanProcessor | undefined;
  let metricReader: LocalMetricReader | undefined;
  let ownedContextManager: AsyncLocalStorageContextManager | undefined;
  let candidateContextManager: AsyncLocalStorageContextManager | undefined;
  try {
    attempt(hooks, "provider_initialization");
    const diagnostics = new BoundedDiagnosticAccumulator();
    spanProcessor = new LocalSpanProcessor(diagnostics);
    metricReader = new LocalMetricReader();
    const reportBuilder = new ProfileReportBuilder(diagnostics);
    attempt(hooks, "trace_provider_construction");
    tracerProvider = new BasicTracerProvider({ spanProcessors: [spanProcessor] });
    attempt(hooks, "meter_provider_construction");
    meterProvider = new MeterProvider({ readers: [metricReader], views: createLocalMetricViews() });

    attempt(hooks, "context_initialization");
    attempt(hooks, "context_manager_construction");
    candidateContextManager = new AsyncLocalStorageContextManager();
    attempt(hooks, "context_manager_enable");
    candidateContextManager.enable();
    attempt(hooks, "context_manager_registration");
    if (context.setGlobalContextManager(candidateContextManager)) {
      ownedContextManager = candidateContextManager;
      candidateContextManager = undefined;
    } else {
      await cleanupInitializationResource(hooks, "initialization_context_manager_cleanup", () => {
        candidateContextManager?.disable();
      });
      candidateContextManager = undefined;
    }

    const tracer = tracerProvider.getTracer(runSpanMetadata.scope.name);
    const rootSpan = tracer.startSpan(runSpanMetadata.name, { root: true }, ROOT_CONTEXT);
    return new WorkerTelemetrySession({
      tracerProvider,
      meterProvider,
      rootSpan,
      rootContext: trace.setSpan(ROOT_CONTEXT, rootSpan),
      ownedContextManager,
      active: { diagnostics, spanProcessor, metricReader, reportBuilder },
      hooks,
    });
  } catch {
    if (candidateContextManager)
      await cleanupInitializationResource(hooks, "initialization_context_manager_cleanup", () => {
        candidateContextManager?.disable();
      });
    if (ownedContextManager)
      await cleanupInitializationResource(hooks, "initialization_context_manager_cleanup", () =>
        context.disable(),
      );
    if (tracerProvider)
      await cleanupInitializationResource(hooks, "initialization_trace_provider_cleanup", () =>
        tracerProvider?.shutdown(),
      );
    else if (spanProcessor)
      await cleanupInitializationResource(hooks, "initialization_trace_provider_cleanup", () =>
        spanProcessor?.shutdown(),
      );
    if (meterProvider)
      await cleanupInitializationResource(hooks, "initialization_meter_provider_cleanup", () =>
        meterProvider?.shutdown(),
      );
    else if (metricReader)
      await cleanupInitializationResource(hooks, "initialization_meter_provider_cleanup", () =>
        metricReader?.shutdown(),
      );
    const degraded = createDegradedProviders();
    return new WorkerTelemetrySession({
      ...degraded,
      rootContext: ROOT_CONTEXT,
      initializationWarning: {
        code: "telemetry_initialization_failed",
        message: null,
      },
      hooks,
    });
  }
}

export function createWorkerTelemetrySessionForTest(
  hooks: WorkerTelemetryTestHooks,
): Promise<WorkerTelemetrySession> {
  return createSession(hooks);
}
