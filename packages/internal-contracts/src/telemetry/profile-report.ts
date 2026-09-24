export const PROFILE_SIGNAL_STATUSES = ["complete", "partial", "unavailable"] as const;
export const PROFILE_DIAGNOSTIC_STAGES = [
  "span_aggregation",
  "trace_flush",
  "metric_collection",
  "report_build",
  "telemetry_shutdown",
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
export const PROFILE_REPORT_SCHEMA_VERSION = 2 as const;
export const PROFILE_OBSERVATION_KINDS = ["span", "counter", "histogram"] as const;
export const PROFILE_DIAGNOSTIC_EFFECTS = [
  "missing_observations",
  "incomplete_measurement_fields",
  "missing_attribute_detail",
  "unknown_collection_coverage",
  "lost_issue_detail",
  "report_delivery_failure",
  "lifecycle_notice",
] as const;
export const PROFILE_DIAGNOSTIC_EXTENTS = ["entire_target", "unidentified_subset"] as const;
export const PROFILE_SPAN_FIELDS = ["calls", "total", "avg", "max", "errors"] as const;
export const PROFILE_COUNTER_FIELDS = ["value"] as const;
export const PROFILE_HISTOGRAM_FIELDS = ["samples", "total", "avg", "min", "max"] as const;
export const PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT = 4096 as const;

export type ProfileObservationKind = (typeof PROFILE_OBSERVATION_KINDS)[number];
export type ProfileDiagnosticEffect = (typeof PROFILE_DIAGNOSTIC_EFFECTS)[number];
export type ProfileDiagnosticExtent = (typeof PROFILE_DIAGNOSTIC_EXTENTS)[number];
export type ProfileSpanField = (typeof PROFILE_SPAN_FIELDS)[number];
export type ProfileCounterField = (typeof PROFILE_COUNTER_FIELDS)[number];
export type ProfileHistogramField = (typeof PROFILE_HISTOGRAM_FIELDS)[number];
export type ProfileMeasurementField =
  | ProfileSpanField
  | ProfileCounterField
  | ProfileHistogramField;

export type ProfileTarget =
  | { readonly type: "report" }
  | { readonly type: "scope"; readonly scope: ProfileInstrumentationScope }
  | {
      readonly type: "observation";
      readonly scope: ProfileInstrumentationScope;
      readonly kind: ProfileObservationKind;
      readonly name: string;
    }
  | {
      readonly type: "point";
      readonly scope: ProfileInstrumentationScope;
      readonly kind: "counter" | "histogram";
      readonly name: string;
      readonly attributes: readonly ProfileAttribute[];
    };

export type ProfileAttributeKeySelector =
  | { readonly type: "not_applicable" }
  | { readonly type: "exact"; readonly key: string }
  | { readonly type: "discarded" };

export interface ProfileAffectedFields {
  readonly kind: ProfileObservationKind;
  readonly fields: readonly ProfileMeasurementField[];
}

export interface ProfileDetailLossMask {
  readonly pointAttributes: boolean;
  readonly observationIdentity: boolean;
  readonly scopeIdentity: boolean;
  readonly attributeKey: boolean;
  readonly affectedFields: boolean;
}

export const PROFILE_LOSS_QUANTITY_DESCRIPTORS = [
  "span_groups",
  "span_duration_contributions",
  "span_attribute_values",
  "metric_points",
  "observation_results",
] as const;
export type ProfileLossQuantityDescriptor = (typeof PROFILE_LOSS_QUANTITY_DESCRIPTORS)[number];
export interface ProfileLossQuantity {
  readonly descriptor: ProfileLossQuantityDescriptor;
  readonly unit: string;
  /** Null means that the total is unknown or contributions may overlap. */
  readonly value: number | null;
  readonly saturated: boolean;
}

export interface ProfileDiagnostic {
  readonly code: ProfileDetailedDiagnosticCode;
  readonly severity: ProfileDiagnosticSeverity;
  readonly stage: ProfileDiagnosticStage;
  readonly target: ProfileTarget;
  readonly signalCoverage: readonly ProfileObservationKind[];
  readonly effects: readonly ProfileDiagnosticEffect[];
  readonly extent: ProfileDiagnosticExtent;
  readonly attributeKey: ProfileAttributeKeySelector;
  readonly affectedFields: readonly ProfileAffectedFields[];
  readonly detailLoss: ProfileDetailLossMask;
  readonly lossQuantity: ProfileLossQuantity | null;
  /** Confirmed failure to obtain or safely supply the entire covered signal result. */
  readonly wholeResultUnavailable: boolean;
  readonly count: number;
  readonly countSaturated: boolean;
  readonly message: string | null;
  readonly reportDelivery: ProfileReportDeliveryProvenance | null;
}

export interface ProfileDiagnosticEffectSummary {
  readonly kind: ProfileObservationKind;
  readonly effects: readonly ProfileDiagnosticEffect[];
  readonly wholeResultUnavailable: boolean;
}

export interface ProfileDiagnosticSummary {
  readonly code: "diagnostic_overflow";
  readonly severity: "warning";
  readonly stage: "report_build";
  readonly target: { readonly type: "report" };
  readonly extent: "unidentified_subset";
  readonly effects: readonly ["lost_issue_detail"];
  readonly signalCoverage: readonly ProfileObservationKind[];
  readonly effectsByKind: readonly ProfileDiagnosticEffectSummary[];
  readonly reportEffects: readonly ProfileDiagnosticEffect[];
  readonly detailLoss: ProfileDetailLossMask;
  readonly omittedOccurrences: number | null;
  readonly countSaturated: boolean;
  readonly maximumSeverity: ProfileDiagnosticSeverity | null;
  readonly priorIssueDetail: "retained" | "unavailable";
}

export interface ProfileReportDeliveryProvenance {
  readonly path: "fixed_fallback";
  readonly measurementResults: "none" | "trusted_snapshot";
  readonly priorIssueDetail: "retained" | "unavailable";
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
export type ProfileDetailedDiagnosticCode = Exclude<ProfileDiagnosticCode, "diagnostic_overflow">;
export type ProfileDiagnosticSeverity = (typeof PROFILE_DIAGNOSTIC_SEVERITY)[ProfileDiagnosticCode];
export type ProfileDiagnosticStage =
  | "span_aggregation"
  | "trace_flush"
  | "metric_collection"
  | "report_build"
  | "telemetry_shutdown";

export interface ProfileSpanAggregate {
  readonly scope: ProfileInstrumentationScope;
  readonly name: string;
  readonly callCount: number;
  readonly errorCount: number;
  readonly totalDurationSeconds: number;
  readonly maxDurationSeconds: number;
  readonly durationContributionCount: number;
  readonly unavailableFields: readonly ProfileSpanField[];
  readonly attributes: readonly ProfileSpanAttributeSummary[];
}
export interface ProfileCounterPoint {
  readonly scope: ProfileInstrumentationScope;
  readonly name: string;
  readonly unit: string;
  readonly attributes: readonly ProfileAttribute[];
  readonly value: number;
  readonly unavailableFields: readonly ProfileCounterField[];
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
  readonly unavailableFields: readonly ProfileHistogramField[];
}

export interface ProfileSignalStatusSet {
  readonly spans: "complete" | "partial" | "unavailable";
  readonly counters: "complete" | "partial" | "unavailable";
  readonly histograms: "complete" | "partial" | "unavailable";
}

export interface ProfileReport {
  readonly schemaVersion: typeof PROFILE_REPORT_SCHEMA_VERSION;
  readonly signalStatus: ProfileSignalStatusSet;
  readonly spans: readonly ProfileSpanAggregate[];
  readonly counters: readonly ProfileCounterPoint[];
  readonly histograms: readonly ProfileHistogramPoint[];
  readonly diagnostics: readonly (ProfileDiagnostic | ProfileDiagnosticSummary)[];
}
