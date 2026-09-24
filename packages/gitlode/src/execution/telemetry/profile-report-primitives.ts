import {
  PROFILE_REPORT_SCHEMA_VERSION,
  type PROFILE_COUNTER_FIELDS,
  type PROFILE_HISTOGRAM_FIELDS,
  type PROFILE_SPAN_FIELDS,
  type ProfileCounterPoint,
  type ProfileDiagnosticEffect,
  type ProfileDiagnosticSummary,
  type ProfileDiagnostic,
  type ProfileHistogramPoint,
  type ProfileReport,
  type ProfileSignalStatusSet,
  type ProfileSpanAggregate,
} from "@gitlode/internal-contracts/telemetry";

import {
  isTrustedProfileDiagnosticsSnapshot,
  profileDiagnosticInternals,
  type ProfileDiagnosticsSnapshot,
} from "./diagnostic-accumulator.js";

type NumericAvailability<Fields extends string> = Readonly<Record<Fields, boolean>>;

export function deriveSpanNumericAvailability(
  value: ProfileSpanAggregate,
): NumericAvailability<(typeof PROFILE_SPAN_FIELDS)[number]> {
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

export function deriveCounterNumericAvailability(
  value: ProfileCounterPoint,
): NumericAvailability<(typeof PROFILE_COUNTER_FIELDS)[number]> {
  return { value: !value.unavailableFields.includes("value") };
}

export function deriveHistogramNumericAvailability(
  value: ProfileHistogramPoint,
): NumericAvailability<(typeof PROFILE_HISTOGRAM_FIELDS)[number]> {
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

export interface ProfileSignalEvidence {
  readonly spans: "complete" | "partial" | "unavailable";
  readonly counters: "complete" | "partial" | "unavailable";
  readonly histograms: "complete" | "partial" | "unavailable";
}

const dataImpactEffects = new Set<ProfileDiagnosticEffect>([
  "missing_observations",
  "incomplete_measurement_fields",
  "missing_attribute_detail",
  "unknown_collection_coverage",
]);

export function deriveProfileSignalStatus(
  evidence: ProfileSignalEvidence,
  valueCounts: Readonly<Record<"spans" | "counters" | "histograms", number>>,
  snapshot: ProfileDiagnosticsSnapshot,
): ProfileSignalStatusSet {
  if (!isTrustedProfileDiagnosticsSnapshot(snapshot))
    throw new TypeError("Profile signal status requires a trusted diagnostic snapshot");
  const result = { ...evidence };
  const mappings = [
    ["span", "spans"],
    ["counter", "counters"],
    ["histogram", "histograms"],
  ] as const;
  for (const [kind, signal] of mappings) {
    if (result[signal] === "unavailable" && valueCounts[signal] > 0)
      throw new TypeError(`Signal ${signal} is unavailable but has retained values`);
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
      (snapshot.diagnostics.some(
        (item) =>
          item.signalCoverage.includes(kind) &&
          item.wholeResultUnavailable &&
          item.effects.some(
            (effect) =>
              effect === "missing_observations" || effect === "unknown_collection_coverage",
          ),
      ) ||
        snapshot.summary?.effectsByKind.some(
          (item) =>
            item.kind === kind &&
            item.wholeResultUnavailable &&
            item.effects.some(
              (effect) =>
                effect === "missing_observations" || effect === "unknown_collection_coverage",
            ),
        )) &&
      valueCounts[signal] === 0
    )
      result[signal] = "unavailable";
  }
  return result;
}

function mandatoryFallbackDiagnostic(
  priorIssueDetail: "retained" | "unavailable",
): ProfileDiagnostic {
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
    wholeResultUnavailable: false,
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
export function createFixedProfileReportFallback(possibleSnapshot?: unknown): ProfileReport {
  const trusted = isTrustedProfileDiagnosticsSnapshot(possibleSnapshot)
    ? possibleSnapshot
    : undefined;
  const priorIssueDetail = trusted ? "retained" : "unavailable";
  const diagnostics: (ProfileDiagnostic | ProfileDiagnosticSummary)[] = [
    mandatoryFallbackDiagnostic(priorIssueDetail),
  ];
  let summary = trusted?.summary ?? null;
  if (trusted) {
    for (const diagnostic of trusted.diagnostics) {
      if (diagnostics.length < 15) diagnostics.push(structuredClone(diagnostic));
      else
        summary = profileDiagnosticInternals.mergeIntoSummary(
          summary ?? profileDiagnosticInternals.createEmptySummary("retained"),
          diagnostic,
        );
    }
  } else summary = profileDiagnosticInternals.createEmptySummary("unavailable");
  if (summary) diagnostics.push(summary);
  return {
    schemaVersion: PROFILE_REPORT_SCHEMA_VERSION,
    signalStatus: { spans: "unavailable", counters: "unavailable", histograms: "unavailable" },
    spans: [],
    counters: [],
    histograms: [],
    diagnostics,
  };
}
