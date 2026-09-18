import {
  EMPTY_PROFILE_DETAIL_LOSS_MASK_V2,
  mergeDetailLossMasksV2,
  normalizeAffectedFieldsV2,
  normalizeAttributeKeySelectorV2,
  normalizeProfileEffectsV2,
  normalizeProfileKindsV2,
  normalizeProfileTargetV2,
  PROFILE_COLLECTION_LIMITS,
  PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT_V2,
  PROFILE_DIAGNOSTIC_SEVERITY_V2,
} from "@gitlode/internal-contracts/telemetry";
import type {
  ProfileAffectedFieldsV2,
  ProfileAttributeKeySelectorV2,
  ProfileDetailLossMaskV2,
  ProfileDetailedDiagnosticCodeV2,
  ProfileDiagnosticEffectSummaryV2,
  ProfileDiagnosticEffectV2,
  ProfileDiagnosticExtentV2,
  ProfileDiagnosticSeverityV2,
  ProfileDiagnosticStageV2,
  ProfileDiagnosticSummaryV2,
  ProfileDiagnosticV2,
  ProfileLossQuantityDescriptorV2,
  ProfileLossQuantityV2,
  ProfileObservationKindV2,
  ProfileTargetV2,
} from "@gitlode/internal-contracts/telemetry";

const MAXIMUM_COUNT = Number.MAX_SAFE_INTEGER;
const validStages = new Set<ProfileDiagnosticStageV2>([
  "span_aggregation",
  "trace_flush",
  "metric_collection",
  "report_build",
  "telemetry_shutdown",
]);
const validQuantityDescriptors = new Set<ProfileLossQuantityDescriptorV2>([
  "span_groups",
  "span_duration_contributions",
  "span_attribute_values",
  "metric_points",
  "observation_results",
]);

export interface ProfileLossQuantityInputV2 {
  readonly descriptor: ProfileLossQuantityDescriptorV2;
  readonly unit: string;
  readonly value: number | null;
  readonly relationship: "disjoint" | "overlapping_or_unknown";
}

export interface ProfileDiagnosticInputV2 {
  readonly code: ProfileDetailedDiagnosticCodeV2;
  readonly stage: ProfileDiagnosticStageV2;
  readonly target: unknown;
  readonly signalCoverage: unknown;
  readonly effects: unknown;
  readonly extent: ProfileDiagnosticExtentV2;
  readonly attributeKey?: unknown;
  readonly affectedFields?: unknown;
  readonly detailLoss?: Partial<ProfileDetailLossMaskV2>;
  readonly lossQuantity?: ProfileLossQuantityInputV2 | null;
  readonly count?: number;
  readonly message?: unknown;
  readonly wholeResultUnavailable?: boolean;
}

interface StoredDiagnostic {
  diagnostic: ProfileDiagnosticV2;
  quantityComposable: boolean;
}

export interface ProfileDiagnosticsSnapshotV2 {
  readonly diagnostics: readonly ProfileDiagnosticV2[];
  readonly summary: ProfileDiagnosticSummaryV2 | null;
}

const trustedSnapshots = new WeakSet<object>();

export function isTrustedProfileDiagnosticsSnapshotV2(
  value: unknown,
): value is ProfileDiagnosticsSnapshotV2 {
  return typeof value === "object" && value !== null && trustedSnapshots.has(value);
}

function saturatingAdd(
  left: number,
  right: number,
): { readonly value: number; readonly saturated: boolean } {
  if (left >= MAXIMUM_COUNT - right) return { value: MAXIMUM_COUNT, saturated: true };
  return { value: left + right, saturated: false };
}

function normalizeCount(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) > 0 ? (value as number) : 1;
}

function normalizeMessage(value: unknown): string | null {
  return typeof value === "string"
    ? value.slice(0, PROFILE_COLLECTION_LIMITS.diagnosticMessageUtf16CodeUnits)
    : null;
}

function escapedStringLengthWithin(value: string, maximum: number): number | null {
  let length = 2;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    length += code === 34 || code === 92 ? 2 : code <= 31 ? 6 : 1;
    if (length > maximum) return null;
  }
  return length;
}

function normalizeDetailLoss(value: unknown): ProfileDetailLossMaskV2 {
  if (!value || typeof value !== "object") return { ...EMPTY_PROFILE_DETAIL_LOSS_MASK_V2 };
  const mask = value as Partial<Record<keyof ProfileDetailLossMaskV2, unknown>>;
  return {
    pointAttributes: mask.pointAttributes === true,
    observationIdentity: mask.observationIdentity === true,
    scopeIdentity: mask.scopeIdentity === true,
    attributeKey: mask.attributeKey === true,
    affectedFields: mask.affectedFields === true,
  };
}

function normalizeQuantity(
  value: ProfileLossQuantityInputV2 | null | undefined,
): { quantity: ProfileLossQuantityV2 | null; composable: boolean } | null {
  if (value === null || value === undefined) return { quantity: null, composable: false };
  if (
    !validQuantityDescriptors.has(value.descriptor) ||
    typeof value.unit !== "string" ||
    escapedStringLengthWithin(value.unit, PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT_V2) === null ||
    (value.value !== null && (!Number.isSafeInteger(value.value) || value.value < 0)) ||
    (value.relationship !== "disjoint" && value.relationship !== "overlapping_or_unknown")
  )
    return null;
  const composable = value.relationship === "disjoint" && value.value !== null;
  return {
    quantity: {
      descriptor: value.descriptor,
      unit: value.unit,
      value: composable ? value.value : null,
      saturated: false,
    },
    composable,
  };
}

function broaderTarget(target: ProfileTargetV2): ProfileTargetV2 | null {
  if (target.type === "point")
    return {
      type: "observation",
      scope: target.scope,
      kind: target.kind,
      name: target.name,
    };
  if (target.type === "observation") return { type: "scope", scope: target.scope };
  if (target.type === "scope") return { type: "report" };
  return null;
}

function broadenToBudget(input: {
  target: ProfileTargetV2;
  signalCoverage: readonly ProfileObservationKindV2[];
  effects: readonly ProfileDiagnosticEffectV2[];
  extent: ProfileDiagnosticExtentV2;
  attributeKey: ProfileAttributeKeySelectorV2;
  affectedFields: readonly ProfileAffectedFieldsV2[];
  detailLoss: ProfileDetailLossMaskV2;
  lossQuantity: ProfileLossQuantityV2 | null;
}): typeof input {
  let value = input;
  const fits = () => JSON.stringify(value).length <= PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT_V2;
  if (fits()) return value;
  if (value.attributeKey.type === "exact") {
    value = {
      ...value,
      attributeKey: { type: "discarded" },
      detailLoss: { ...value.detailLoss, attributeKey: true },
    };
    if (fits()) return value;
  }
  if (value.affectedFields.length > 0) {
    value = {
      ...value,
      affectedFields: [],
      detailLoss: { ...value.detailLoss, affectedFields: true },
    };
    if (fits()) return value;
  }
  while (value.target.type !== "report") {
    const previous = value.target;
    const target = broaderTarget(previous) as ProfileTargetV2;
    value = {
      ...value,
      target,
      extent: "unidentified_subset",
      detailLoss: {
        ...value.detailLoss,
        pointAttributes: value.detailLoss.pointAttributes || previous.type === "point",
        observationIdentity:
          value.detailLoss.observationIdentity || previous.type === "observation",
        scopeIdentity: value.detailLoss.scopeIdentity || previous.type === "scope",
      },
    };
    if (fits()) return value;
  }
  return value;
}

function diagnosticIdentity(value: ProfileDiagnosticV2): string {
  return JSON.stringify([
    value.code,
    value.stage,
    value.target,
    value.signalCoverage,
    value.effects,
    value.extent,
    value.attributeKey,
    value.affectedFields,
    value.detailLoss,
    value.lossQuantity && [value.lossQuantity.descriptor, value.lossQuantity.unit],
  ]);
}

function severityRank(value: ProfileDiagnosticSeverityV2): number {
  return value === "warning" ? 1 : 0;
}

function createEmptySummary(
  priorIssueDetail: "retained" | "unavailable",
): ProfileDiagnosticSummaryV2 {
  return {
    code: "diagnostic_overflow",
    severity: "warning",
    stage: "report_build",
    target: { type: "report" },
    extent: "unidentified_subset",
    effects: ["lost_issue_detail"],
    signalCoverage: [],
    effectsByKind: [],
    reportEffects: [],
    detailLoss:
      priorIssueDetail === "unavailable"
        ? {
            pointAttributes: true,
            observationIdentity: true,
            scopeIdentity: true,
            attributeKey: true,
            affectedFields: true,
          }
        : { ...EMPTY_PROFILE_DETAIL_LOSS_MASK_V2 },
    omittedOccurrences: priorIssueDetail === "unavailable" ? null : 0,
    countSaturated: false,
    maximumSeverity: null,
    priorIssueDetail,
  };
}

function mergeIntoSummary(
  summary: ProfileDiagnosticSummaryV2,
  diagnostic: ProfileDiagnosticV2,
  wholeResultUnavailable: boolean,
): ProfileDiagnosticSummaryV2 {
  const coverage = new Set(summary.signalCoverage);
  const effectsByKind = new Map<ProfileObservationKindV2, ProfileDiagnosticEffectSummaryV2>();
  for (const item of summary.effectsByKind) effectsByKind.set(item.kind, item);
  for (const kind of diagnostic.signalCoverage) {
    coverage.add(kind);
    const prior = effectsByKind.get(kind);
    effectsByKind.set(kind, {
      kind,
      effects: [...new Set([...(prior?.effects ?? []), ...diagnostic.effects])].sort(),
      wholeResultUnavailable: (prior?.wholeResultUnavailable ?? false) || wholeResultUnavailable,
    });
  }
  const reportEffects =
    diagnostic.signalCoverage.length === 0
      ? [...new Set([...summary.reportEffects, ...diagnostic.effects])].sort()
      : summary.reportEffects;
  const count =
    summary.omittedOccurrences === null
      ? null
      : saturatingAdd(summary.omittedOccurrences, diagnostic.count);
  return {
    ...summary,
    signalCoverage: [...coverage].sort(),
    effectsByKind: [...effectsByKind.values()].sort((left, right) =>
      left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0,
    ),
    reportEffects,
    detailLoss: {
      pointAttributes: true,
      observationIdentity: true,
      scopeIdentity: true,
      attributeKey: true,
      affectedFields: true,
    },
    omittedOccurrences: count === null ? null : count.value,
    countSaturated: summary.countSaturated || (count !== null && count.saturated),
    maximumSeverity:
      summary.maximumSeverity === null ||
      severityRank(diagnostic.severity) > severityRank(summary.maximumSeverity)
        ? diagnostic.severity
        : summary.maximumSeverity,
  };
}

function freezeSnapshot(
  diagnostics: readonly ProfileDiagnosticV2[],
  summary: ProfileDiagnosticSummaryV2 | null,
): ProfileDiagnosticsSnapshotV2 {
  const freezePlain = <Value>(value: Value): Value => {
    if (value && typeof value === "object") {
      for (const child of Object.values(value)) freezePlain(child);
      Object.freeze(value);
    }
    return value;
  };
  const snapshot = freezePlain({
    diagnostics: diagnostics.map((item) => structuredClone(item)),
    summary: summary === null ? null : structuredClone(summary),
  });
  trustedSnapshots.add(snapshot);
  return snapshot;
}

export class BoundedProfileDiagnosticAccumulatorV2 {
  readonly #entries = new Map<string, StoredDiagnostic>();
  #summary: ProfileDiagnosticSummaryV2 | null = null;

  add(input: ProfileDiagnosticInputV2): void {
    try {
      const severity = PROFILE_DIAGNOSTIC_SEVERITY_V2[input.code];
      if (!severity || !validStages.has(input.stage)) return this.#recordInvalid();
      const signalCoverage = normalizeProfileKindsV2(input.signalCoverage);
      const effects = normalizeProfileEffectsV2(input.effects);
      const affectedFields = normalizeAffectedFieldsV2(input.affectedFields ?? []);
      let attributeKey = normalizeAttributeKeySelectorV2(
        input.attributeKey ?? { type: "not_applicable" },
      );
      const quantity = normalizeQuantity(input.lossQuantity);
      if (
        !signalCoverage ||
        !effects ||
        effects.length === 0 ||
        !affectedFields ||
        !attributeKey ||
        !quantity ||
        (input.extent !== "entire_target" && input.extent !== "unidentified_subset")
      )
        return this.#recordInvalid();
      let detailLoss = normalizeDetailLoss(input.detailLoss);
      if (
        attributeKey.type === "exact" &&
        escapedStringLengthWithin(attributeKey.key, PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT_V2) ===
          null
      ) {
        attributeKey = { type: "discarded" };
        detailLoss = { ...detailLoss, attributeKey: true };
      }
      const normalizedTarget = normalizeProfileTargetV2(input.target);
      detailLoss = mergeDetailLossMasksV2(detailLoss, normalizedTarget.detailLoss);
      const targetWasBroadened =
        normalizedTarget.detailLoss.pointAttributes ||
        normalizedTarget.detailLoss.observationIdentity ||
        normalizedTarget.detailLoss.scopeIdentity;
      const bounded = broadenToBudget({
        target: normalizedTarget.target,
        signalCoverage,
        effects,
        extent: targetWasBroadened ? "unidentified_subset" : input.extent,
        attributeKey,
        affectedFields,
        detailLoss,
        lossQuantity: quantity.quantity,
      });
      const diagnostic: ProfileDiagnosticV2 = {
        code: input.code,
        severity,
        stage: input.stage,
        ...bounded,
        count: normalizeCount(input.count),
        countSaturated: false,
        message: normalizeMessage(input.message),
        reportDelivery: null,
      };
      if (JSON.stringify(bounded).length > PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT_V2) {
        this.#summary = mergeIntoSummary(
          this.#summary ?? createEmptySummary("retained"),
          diagnostic,
          input.wholeResultUnavailable === true,
        );
        return;
      }
      const key = diagnosticIdentity(diagnostic);
      const current = this.#entries.get(key);
      if (current) {
        const count = saturatingAdd(current.diagnostic.count, diagnostic.count);
        let lossQuantity = current.diagnostic.lossQuantity;
        let quantityComposable = current.quantityComposable && quantity.composable;
        if (lossQuantity && diagnostic.lossQuantity) {
          if (
            quantityComposable &&
            lossQuantity.value !== null &&
            diagnostic.lossQuantity.value !== null
          ) {
            const sum = saturatingAdd(lossQuantity.value, diagnostic.lossQuantity.value);
            lossQuantity = { ...lossQuantity, value: sum.value, saturated: sum.saturated };
          } else lossQuantity = { ...lossQuantity, value: null, saturated: false };
        } else quantityComposable = false;
        current.diagnostic = {
          ...current.diagnostic,
          count: count.value,
          countSaturated: current.diagnostic.countSaturated || count.saturated,
          lossQuantity,
        };
        current.quantityComposable = quantityComposable;
        return;
      }
      const capacity =
        PROFILE_COLLECTION_LIMITS.diagnostics.maximum -
        PROFILE_COLLECTION_LIMITS.diagnostics.overflowReservedEntries;
      if (this.#entries.size >= capacity) {
        this.#summary = mergeIntoSummary(
          this.#summary ?? createEmptySummary("retained"),
          diagnostic,
          input.wholeResultUnavailable === true,
        );
        return;
      }
      this.#entries.set(key, { diagnostic, quantityComposable: quantity.composable });
    } catch {
      this.#recordInvalid();
    }
  }

  snapshot(): ProfileDiagnosticsSnapshotV2 {
    return freezeSnapshot(
      [...this.#entries.values()].map(({ diagnostic }) => diagnostic),
      this.#summary,
    );
  }

  #recordInvalid(): void {
    const diagnostic: ProfileDiagnosticV2 = {
      code: "invalid_aggregation",
      severity: "warning",
      stage: "report_build",
      target: { type: "report" },
      signalCoverage: [],
      effects: ["unknown_collection_coverage"],
      extent: "unidentified_subset",
      attributeKey: { type: "discarded" },
      affectedFields: [],
      detailLoss: {
        pointAttributes: true,
        observationIdentity: true,
        scopeIdentity: true,
        attributeKey: true,
        affectedFields: true,
      },
      lossQuantity: null,
      count: 1,
      countSaturated: false,
      message: null,
      reportDelivery: null,
    };
    const key = diagnosticIdentity(diagnostic);
    const current = this.#entries.get(key);
    if (current) {
      const count = saturatingAdd(current.diagnostic.count, 1);
      current.diagnostic = {
        ...current.diagnostic,
        count: count.value,
        countSaturated: count.saturated,
      };
    } else if (
      this.#entries.size <
      PROFILE_COLLECTION_LIMITS.diagnostics.maximum -
        PROFILE_COLLECTION_LIMITS.diagnostics.overflowReservedEntries
    )
      this.#entries.set(key, { diagnostic, quantityComposable: false });
    else
      this.#summary = mergeIntoSummary(
        this.#summary ?? createEmptySummary("retained"),
        diagnostic,
        false,
      );
  }
}

export const profileDiagnosticV2Internals = {
  createEmptySummary,
  freezeSnapshot,
  mergeIntoSummary,
};
