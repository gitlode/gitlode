import type { ProfileReport } from "@gitlode/internal-contracts/telemetry";
import type { Context, Meter, Span, Tracer } from "@opentelemetry/api";

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
  | "enabled_module_import"
  | "root_construction"
  | "root_context_construction"
  | "span_snapshot"
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
  | "report_builder_body"
  | "diagnostic_snapshot"
  | "telemetry_shutdown"
  | "trace_provider_shutdown"
  | "meter_provider_shutdown"
  | "context_manager_cleanup";

export interface WorkerTelemetryTestHooks {
  readonly loadEnabledModule?: () => Promise<{
    createEnabledBackend(hooks?: WorkerTelemetryTestHooks): Promise<WorkerTelemetryBackend>;
  }>;
  readonly failures?: Partial<Record<WorkerTelemetryTestAttempt, unknown>>;
  readonly onAttempt?: (attempt: WorkerTelemetryTestAttempt) => void;
  readonly metricCollectionTimeoutMillis?: number;
}

export interface WorkerTelemetryBackend {
  getTracer(scopeName: string, scopeVersion?: string): Tracer;
  getMeter(scopeName: string, scopeVersion?: string): Meter;
  readonly rootSpan: Span;
  readonly rootContext: Context;
  readonly recordingEnabled: boolean;
  finalize(): Promise<ProfileReport | undefined>;
}
