import type {
  ProfileAttribute,
  ProfileInstrumentationScope,
  ProfileSpanAttributeSummary,
} from "./profile-report.js";

/** Staged schema-v2 contract. P2 atomically replaces the active v1 contract with this model. */
export const PROFILE_REPORT_V2_SCHEMA_VERSION = 2 as const;
export const PROFILE_OBSERVATION_KINDS_V2 = ["span", "counter", "histogram"] as const;
export const PROFILE_DIAGNOSTIC_EFFECTS_V2 = [
  "missing_observations",
  "incomplete_measurement_fields",
  "missing_attribute_detail",
  "unknown_collection_coverage",
  "lost_issue_detail",
  "report_delivery_failure",
  "lifecycle_notice",
] as const;
export const PROFILE_DIAGNOSTIC_EXTENTS_V2 = ["entire_target", "unidentified_subset"] as const;
export const PROFILE_SPAN_FIELDS_V2 = ["calls", "total", "avg", "max", "errors"] as const;
export const PROFILE_COUNTER_FIELDS_V2 = ["value"] as const;
export const PROFILE_HISTOGRAM_FIELDS_V2 = ["samples", "total", "avg", "min", "max"] as const;
export const PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT_V2 = 4096 as const;

export type ProfileObservationKindV2 = (typeof PROFILE_OBSERVATION_KINDS_V2)[number];
export type ProfileDiagnosticEffectV2 = (typeof PROFILE_DIAGNOSTIC_EFFECTS_V2)[number];
export type ProfileDiagnosticExtentV2 = (typeof PROFILE_DIAGNOSTIC_EXTENTS_V2)[number];
export type ProfileSpanFieldV2 = (typeof PROFILE_SPAN_FIELDS_V2)[number];
export type ProfileCounterFieldV2 = (typeof PROFILE_COUNTER_FIELDS_V2)[number];
export type ProfileHistogramFieldV2 = (typeof PROFILE_HISTOGRAM_FIELDS_V2)[number];
export type ProfileMeasurementFieldV2 =
  | ProfileSpanFieldV2
  | ProfileCounterFieldV2
  | ProfileHistogramFieldV2;

export type ProfileTargetV2 =
  | { readonly type: "report" }
  | { readonly type: "scope"; readonly scope: ProfileInstrumentationScope }
  | {
      readonly type: "observation";
      readonly scope: ProfileInstrumentationScope;
      readonly kind: ProfileObservationKindV2;
      readonly name: string;
    }
  | {
      readonly type: "point";
      readonly scope: ProfileInstrumentationScope;
      readonly kind: "counter" | "histogram";
      readonly name: string;
      readonly attributes: readonly ProfileAttribute[];
    };

export type ProfileAttributeKeySelectorV2 =
  | { readonly type: "not_applicable" }
  | { readonly type: "exact"; readonly key: string }
  | { readonly type: "discarded" };

export interface ProfileAffectedFieldsV2 {
  readonly kind: ProfileObservationKindV2;
  readonly fields: readonly ProfileMeasurementFieldV2[];
}

export interface ProfileDetailLossMaskV2 {
  readonly pointAttributes: boolean;
  readonly observationIdentity: boolean;
  readonly scopeIdentity: boolean;
  readonly attributeKey: boolean;
  readonly affectedFields: boolean;
}

export const PROFILE_LOSS_QUANTITY_DESCRIPTORS_V2 = [
  "span_groups",
  "span_duration_contributions",
  "span_attribute_values",
  "metric_points",
  "observation_results",
] as const;
export type ProfileLossQuantityDescriptorV2 = (typeof PROFILE_LOSS_QUANTITY_DESCRIPTORS_V2)[number];
export interface ProfileLossQuantityV2 {
  readonly descriptor: ProfileLossQuantityDescriptorV2;
  readonly unit: string;
  /** Null means that the total is unknown or contributions may overlap. */
  readonly value: number | null;
  readonly saturated: boolean;
}

export interface ProfileDiagnosticV2 {
  readonly code: ProfileDetailedDiagnosticCodeV2;
  readonly severity: ProfileDiagnosticSeverityV2;
  readonly stage: ProfileDiagnosticStageV2;
  readonly target: ProfileTargetV2;
  readonly signalCoverage: readonly ProfileObservationKindV2[];
  readonly effects: readonly ProfileDiagnosticEffectV2[];
  readonly extent: ProfileDiagnosticExtentV2;
  readonly attributeKey: ProfileAttributeKeySelectorV2;
  readonly affectedFields: readonly ProfileAffectedFieldsV2[];
  readonly detailLoss: ProfileDetailLossMaskV2;
  readonly lossQuantity: ProfileLossQuantityV2 | null;
  /** Confirmed failure to obtain or safely supply the entire covered signal result. */
  readonly wholeResultUnavailable: boolean;
  readonly count: number;
  readonly countSaturated: boolean;
  readonly message: string | null;
  readonly reportDelivery: ProfileReportDeliveryProvenanceV2 | null;
}

export interface ProfileDiagnosticEffectSummaryV2 {
  readonly kind: ProfileObservationKindV2;
  readonly effects: readonly ProfileDiagnosticEffectV2[];
  readonly wholeResultUnavailable: boolean;
}

export interface ProfileDiagnosticSummaryV2 {
  readonly code: "diagnostic_overflow";
  readonly severity: "warning";
  readonly stage: "report_build";
  readonly target: { readonly type: "report" };
  readonly extent: "unidentified_subset";
  readonly effects: readonly ["lost_issue_detail"];
  readonly signalCoverage: readonly ProfileObservationKindV2[];
  readonly effectsByKind: readonly ProfileDiagnosticEffectSummaryV2[];
  readonly reportEffects: readonly ProfileDiagnosticEffectV2[];
  readonly detailLoss: ProfileDetailLossMaskV2;
  readonly omittedOccurrences: number | null;
  readonly countSaturated: boolean;
  readonly maximumSeverity: ProfileDiagnosticSeverityV2 | null;
  readonly priorIssueDetail: "retained" | "unavailable";
}

export interface ProfileReportDeliveryProvenanceV2 {
  readonly path: "fixed_fallback";
  readonly measurementResults: "none" | "trusted_snapshot";
  readonly priorIssueDetail: "retained" | "unavailable";
}

export const PROFILE_DIAGNOSTIC_SEVERITY_V2 = {
  span_group_overflow: "info",
  span_attribute_value_overflow: "info",
  metric_point_overflow: "info",
  attribute_reducer_conflict: "warning",
  invalid_aggregation: "warning",
  lifecycle_failure: "warning",
  diagnostic_overflow: "warning",
} as const;
export type ProfileDiagnosticCodeV2 = keyof typeof PROFILE_DIAGNOSTIC_SEVERITY_V2;
export type ProfileDetailedDiagnosticCodeV2 = Exclude<
  ProfileDiagnosticCodeV2,
  "diagnostic_overflow"
>;
export type ProfileDiagnosticSeverityV2 =
  (typeof PROFILE_DIAGNOSTIC_SEVERITY_V2)[ProfileDiagnosticCodeV2];
export type ProfileDiagnosticStageV2 =
  | "span_aggregation"
  | "trace_flush"
  | "metric_collection"
  | "report_build"
  | "telemetry_shutdown";

export interface ProfileSpanAggregateV2 {
  readonly scope: ProfileInstrumentationScope;
  readonly name: string;
  readonly callCount: number;
  readonly errorCount: number;
  readonly totalDurationSeconds: number;
  readonly maxDurationSeconds: number;
  readonly durationContributionCount: number;
  readonly unavailableFields: readonly ProfileSpanFieldV2[];
  readonly attributes: readonly ProfileSpanAttributeSummary[];
}
export interface ProfileCounterPointV2 {
  readonly scope: ProfileInstrumentationScope;
  readonly name: string;
  readonly unit: string;
  readonly attributes: readonly ProfileAttribute[];
  readonly value: number;
  readonly unavailableFields: readonly ProfileCounterFieldV2[];
}
export interface ProfileHistogramPointV2 {
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
  readonly unavailableFields: readonly ProfileHistogramFieldV2[];
}

export interface ProfileSignalStatusSetV2 {
  readonly spans: "complete" | "partial" | "unavailable";
  readonly counters: "complete" | "partial" | "unavailable";
  readonly histograms: "complete" | "partial" | "unavailable";
}

export interface ProfileReportV2 {
  readonly schemaVersion: typeof PROFILE_REPORT_V2_SCHEMA_VERSION;
  readonly signalStatus: ProfileSignalStatusSetV2;
  readonly spans: readonly ProfileSpanAggregateV2[];
  readonly counters: readonly ProfileCounterPointV2[];
  readonly histograms: readonly ProfileHistogramPointV2[];
  readonly diagnostics: readonly (ProfileDiagnosticV2 | ProfileDiagnosticSummaryV2)[];
}
