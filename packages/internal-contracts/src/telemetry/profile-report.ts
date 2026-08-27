export const PROFILE_REPORT_SCHEMA_VERSION = 1 as const;
export const PROFILE_SIGNAL_STATUSES = ["complete", "partial", "unavailable"] as const;
export const PROFILE_DIAGNOSTIC_STAGES = [
  "span_aggregation",
  "trace_flush",
  "metric_collection",
  "report_build",
  "telemetry_shutdown",
] as const;
export const PROFILE_DIAGNOSTIC_SIGNALS = [
  "spans",
  "counters",
  "histograms",
  "report",
  "telemetry",
] as const;
export const PROFILE_COLLECTION_LIMITS = {
  spanGroups: 128,
  distinctSpanAttributeValuesPerAttribute: 16,
  metricPointsPerInstrument: 128,
  diagnostics: {
    maximum: 16,
    overflowReservedEntries: 1,
  },
  diagnosticMessageUtf16CodeUnits: 512,
} as const;

export type ProfileAttributeValue = string | number | boolean;
export interface ProfileInstrumentationScope {
  readonly name: string;
  readonly version: string | null;
}
export interface ProfileAttribute {
  readonly key: string;
  readonly value: ProfileAttributeValue;
}
interface ProfileSpanAttributeSummaryBase {
  readonly key: string;
  readonly observedCount: number;
}
export interface ProfileSingleSpanAttributeSummary extends ProfileSpanAttributeSummaryBase {
  readonly reducer: "single";
  readonly value: ProfileAttributeValue;
  readonly conflictCount: number;
}
export interface ProfileDistinctSpanAttributeSummary extends ProfileSpanAttributeSummaryBase {
  readonly reducer: "distinct";
  readonly values: readonly { readonly value: ProfileAttributeValue; readonly count: number }[];
  readonly overflowCount: number;
}
export interface ProfileMinMaxSpanAttributeSummary extends ProfileSpanAttributeSummaryBase {
  readonly reducer: "min_max";
  readonly minimum: number;
  readonly maximum: number;
}
export type ProfileSpanAttributeSummary =
  | ProfileSingleSpanAttributeSummary
  | ProfileDistinctSpanAttributeSummary
  | ProfileMinMaxSpanAttributeSummary;
export interface ProfileSpanAggregate {
  readonly scope: ProfileInstrumentationScope;
  readonly name: string;
  readonly callCount: number;
  readonly errorCount: number;
  readonly totalDurationSeconds: number;
  readonly maxDurationSeconds: number;
  readonly attributes: readonly ProfileSpanAttributeSummary[];
}
export interface ProfileCounterPoint {
  readonly scope: ProfileInstrumentationScope;
  readonly name: string;
  readonly unit: string;
  readonly attributes: readonly ProfileAttribute[];
  readonly value: number;
}
export interface ProfileHistogramPoint {
  readonly scope: ProfileInstrumentationScope;
  readonly name: string;
  readonly unit: string;
  readonly attributes: readonly ProfileAttribute[];
  readonly count: number;
  readonly sum: number;
  readonly minimum: number | null;
  readonly maximum: number | null;
  readonly explicitBounds: readonly number[];
  readonly bucketCounts: readonly number[];
}
export type ProfileSignalStatus = (typeof PROFILE_SIGNAL_STATUSES)[number];
export interface ProfileSignalStatusSet {
  readonly spans: ProfileSignalStatus;
  readonly counters: ProfileSignalStatus;
  readonly histograms: ProfileSignalStatus;
}
export const PROFILE_DIAGNOSTIC_SEVERITY = {
  span_group_overflow: "info",
  span_attribute_value_overflow: "info",
  metric_point_overflow: "info",
  attribute_reducer_conflict: "warning",
  invalid_aggregation: "warning",
  lifecycle_failure: "warning",
  diagnostic_overflow: "warning",
} as const;
export type ProfileDiagnosticCode = keyof typeof PROFILE_DIAGNOSTIC_SEVERITY;
export type ProfileDiagnosticSeverity = (typeof PROFILE_DIAGNOSTIC_SEVERITY)[ProfileDiagnosticCode];
export type ProfileDiagnosticStage = (typeof PROFILE_DIAGNOSTIC_STAGES)[number];
export type ProfileDiagnosticSignal = (typeof PROFILE_DIAGNOSTIC_SIGNALS)[number];
interface ProfileDiagnosticFields {
  readonly stage: ProfileDiagnosticStage;
  readonly signal: ProfileDiagnosticSignal;
  readonly count: number;
  readonly message: string | null;
}
export type ProfileDiagnostic = {
  readonly [Code in ProfileDiagnosticCode]: ProfileDiagnosticFields & {
    readonly code: Code;
    readonly severity: (typeof PROFILE_DIAGNOSTIC_SEVERITY)[Code];
  };
}[ProfileDiagnosticCode];
export interface ProfileReport {
  readonly schemaVersion: typeof PROFILE_REPORT_SCHEMA_VERSION;
  readonly signalStatus: ProfileSignalStatusSet;
  readonly spans: readonly ProfileSpanAggregate[];
  readonly counters: readonly ProfileCounterPoint[];
  readonly histograms: readonly ProfileHistogramPoint[];
  readonly diagnostics: readonly ProfileDiagnostic[];
}
