import {
  PROFILE_REPORT_V2_SCHEMA_VERSION,
  type PROFILE_COUNTER_FIELDS_V2,
  type PROFILE_HISTOGRAM_FIELDS_V2,
  type PROFILE_SPAN_FIELDS_V2,
  type ProfileCounterPointV2,
  type ProfileDiagnosticEffectV2,
  type ProfileDiagnosticSummaryV2,
  type ProfileDiagnosticV2,
  type ProfileHistogramPointV2,
  type ProfileReportV2,
  type ProfileSignalStatusSetV2,
  type ProfileSpanAggregateV2,
} from "@gitlode/internal-contracts/telemetry";

import {
  isTrustedProfileDiagnosticsSnapshotV2,
  profileDiagnosticV2Internals,
  type ProfileDiagnosticsSnapshotV2,
} from "./profile-diagnostic-v2-accumulator.js";

type NumericAvailability<Fields extends string> = Readonly<Record<Fields, boolean>>;

export function deriveSpanNumericAvailabilityV2(
  value: ProfileSpanAggregateV2,
): NumericAvailability<(typeof PROFILE_SPAN_FIELDS_V2)[number]> {
  const unavailable = new Set(value.unavailableFields);
  const hasDuration = value.durationContributionCount > 0;
  return {
    calls: !unavailable.has("calls"),
    total: hasDuration && !unavailable.has("total"),
    avg:
      hasDuration &&
      value.callCount > 0 &&
      value.durationContributionCount === value.callCount &&
      !unavailable.has("avg") &&
      !unavailable.has("calls") &&
      !unavailable.has("total"),
    max: hasDuration && !unavailable.has("max"),
    errors: !unavailable.has("errors"),
  };
}

export function deriveCounterNumericAvailabilityV2(
  value: ProfileCounterPointV2,
): NumericAvailability<(typeof PROFILE_COUNTER_FIELDS_V2)[number]> {
  return { value: !value.unavailableFields.includes("value") };
}

export function deriveHistogramNumericAvailabilityV2(
  value: ProfileHistogramPointV2,
): NumericAvailability<(typeof PROFILE_HISTOGRAM_FIELDS_V2)[number]> {
  const unavailable = new Set(value.unavailableFields);
  return {
    samples: !unavailable.has("samples"),
    total: !unavailable.has("total"),
    avg:
      value.count > 0 &&
      !unavailable.has("avg") &&
      !unavailable.has("samples") &&
      !unavailable.has("total"),
    min: value.minimum !== null && !unavailable.has("min"),
    max: value.maximum !== null && !unavailable.has("max"),
  };
}

export interface ProfileSignalEvidenceV2 {
  readonly spans: "complete" | "partial" | "unavailable";
  readonly counters: "complete" | "partial" | "unavailable";
  readonly histograms: "complete" | "partial" | "unavailable";
}

const dataImpactEffects = new Set<ProfileDiagnosticEffectV2>([
  "missing_observations",
  "incomplete_measurement_fields",
  "missing_attribute_detail",
  "unknown_collection_coverage",
]);

export function deriveProfileSignalStatusV2(
  evidence: ProfileSignalEvidenceV2,
  valueCounts: Readonly<Record<"spans" | "counters" | "histograms", number>>,
  snapshot: ProfileDiagnosticsSnapshotV2,
): ProfileSignalStatusSetV2 {
  if (!isTrustedProfileDiagnosticsSnapshotV2(snapshot))
    throw new TypeError("Profile signal status requires a trusted diagnostic snapshot");
  const result = { ...evidence };
  const mappings = [
    ["span", "spans"],
    ["counter", "counters"],
    ["histogram", "histograms"],
  ] as const;
  for (const [kind, signal] of mappings) {
    if (result[signal] === "unavailable" && valueCounts[signal] > 0) result[signal] = "partial";
    if (result[signal] === "complete") {
      const detailedImpact = snapshot.diagnostics.some(
        (item) =>
          item.signalCoverage.includes(kind) &&
          item.effects.some((effect) => dataImpactEffects.has(effect)),
      );
      const summaryImpact = snapshot.summary?.effectsByKind.some(
        (item) =>
          item.kind === kind && item.effects.some((effect) => dataImpactEffects.has(effect)),
      );
      if (detailedImpact || summaryImpact) result[signal] = "partial";
    }
    if (
      snapshot.summary?.effectsByKind.some(
        (item) => item.kind === kind && item.wholeResultUnavailable,
      ) &&
      valueCounts[signal] === 0
    )
      result[signal] = "unavailable";
  }
  return result;
}

function mandatoryFallbackDiagnostic(
  priorIssueDetail: "retained" | "unavailable",
): ProfileDiagnosticV2 {
  return {
    code: "lifecycle_failure",
    severity: "warning",
    stage: "report_build",
    target: { type: "report" },
    signalCoverage: ["counter", "histogram", "span"],
    effects: ["report_delivery_failure"],
    extent: "entire_target",
    attributeKey: { type: "not_applicable" },
    affectedFields: [],
    detailLoss: {
      pointAttributes: false,
      observationIdentity: false,
      scopeIdentity: false,
      attributeKey: false,
      affectedFields: false,
    },
    lossQuantity: null,
    count: 1,
    countSaturated: false,
    message: null,
    reportDelivery: {
      path: "fixed_fallback",
      measurementResults: "none",
      priorIssueDetail,
    },
  };
}

/**
 * Constructs the minimum fixed report without invoking the normal builder or reading untrusted input.
 * P2 may pass only a snapshot issued by the v2 accumulator; arbitrary lookalikes are ignored.
 */
export function createFixedProfileReportFallbackV2(possibleSnapshot?: unknown): ProfileReportV2 {
  const trusted = isTrustedProfileDiagnosticsSnapshotV2(possibleSnapshot)
    ? possibleSnapshot
    : undefined;
  const priorIssueDetail = trusted ? "retained" : "unavailable";
  const diagnostics: (ProfileDiagnosticV2 | ProfileDiagnosticSummaryV2)[] = [
    mandatoryFallbackDiagnostic(priorIssueDetail),
  ];
  let summary = trusted?.summary ?? null;
  if (trusted) {
    for (const diagnostic of trusted.diagnostics) {
      if (diagnostics.length < 15) diagnostics.push(structuredClone(diagnostic));
      else
        summary = profileDiagnosticV2Internals.mergeIntoSummary(
          summary ?? profileDiagnosticV2Internals.createEmptySummary("retained"),
          diagnostic,
          false,
        );
    }
  } else summary = profileDiagnosticV2Internals.createEmptySummary("unavailable");
  if (summary) diagnostics.push(summary);
  return {
    schemaVersion: PROFILE_REPORT_V2_SCHEMA_VERSION,
    signalStatus: { spans: "unavailable", counters: "unavailable", histograms: "unavailable" },
    spans: [],
    counters: [],
    histograms: [],
    diagnostics,
  };
}
