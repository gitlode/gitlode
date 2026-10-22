import {
  EMPTY_PROFILE_DETAIL_LOSS_MASK,
  mergeDetailLossMasks,
  normalizeAffectedFields,
  normalizeAttributeKeySelector,
  normalizeProfileEffects,
  normalizeProfileKinds,
  normalizeProfileTarget,
  PROFILE_COLLECTION_LIMITS,
  PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT,
  PROFILE_DIAGNOSTIC_SEVERITY,
} from "@gitlode/internal-contracts/telemetry";
import type {
  ProfileAffectedFields,
  ProfileAttributeKeySelector,
  ProfileDetailLossMask,
  ProfileDetailedDiagnosticCode,
  ProfileDiagnosticEffectSummary,
  ProfileDiagnosticEffect,
  ProfileDiagnosticExtent,
  ProfileDiagnosticSeverity,
  ProfileDiagnosticStage,
  ProfileDiagnosticSummary,
  ProfileDiagnostic,
  ProfileLossQuantityDescriptor,
  ProfileLossQuantity,
  ProfileObservationKind,
  ProfileTarget,
} from "@gitlode/internal-contracts/telemetry";

const MAXIMUM_COUNT = Number.MAX_SAFE_INTEGER;
const validStages = new Set<ProfileDiagnosticStage>([
  "span_aggregation",
  "trace_flush",
  "metric_collection",
  "report_build",
  "telemetry_shutdown",
]);
const validQuantityDescriptors = new Set<ProfileLossQuantityDescriptor>([
  "span_groups",
  "span_duration_contributions",
  "span_attribute_values",
  "metric_points",
  "observation_results",
]);

export interface ProfileLossQuantityInput {
  readonly descriptor: ProfileLossQuantityDescriptor;
  readonly unit: string;
  readonly value: number | null;
  readonly relationship: "disjoint" | "overlapping_or_unknown";
}

export interface ProfileDiagnosticInput {
  readonly code: ProfileDetailedDiagnosticCode;
  readonly stage: ProfileDiagnosticStage;
  readonly target: unknown;
  readonly signalCoverage: unknown;
  readonly effects: unknown;
  readonly extent: ProfileDiagnosticExtent;
  readonly attributeKey?: unknown;
  readonly affectedFields?: unknown;
  readonly detailLoss?: Partial<ProfileDetailLossMask>;
  readonly lossQuantity?: ProfileLossQuantityInput | null;
  readonly count?: number;
  readonly message?: unknown;
  readonly wholeResultUnavailable?: boolean;
}

interface StoredDiagnostic {
  diagnostic: ProfileDiagnostic;
  quantityComposable: boolean;
}

export interface ProfileDiagnosticsSnapshot {
  readonly diagnostics: readonly ProfileDiagnostic[];
  readonly summary: ProfileDiagnosticSummary | null;
}

const trustedSnapshots = new WeakSet<object>();

export function isTrustedProfileDiagnosticsSnapshot(
  value: unknown,
): value is ProfileDiagnosticsSnapshot {
  return typeof value === "object" && value !== null && trustedSnapshots.has(value);
}

function saturatingAdd(
  left: number,
  right: number,
): { readonly value: number; readonly saturated: boolean } {
  if (left > MAXIMUM_COUNT - right) return { value: MAXIMUM_COUNT, saturated: true };
  return { value: left + right, saturated: false };
}

function normalizeCount(value: unknown): number | null {
  if (value === undefined) return 1;
  return Number.isSafeInteger(value) && (value as number) > 0 ? (value as number) : null;
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

function normalizeDetailLoss(value: unknown): ProfileDetailLossMask | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const mask = value as Partial<Record<keyof ProfileDetailLossMask, unknown>>;
  for (const key of Object.keys(EMPTY_PROFILE_DETAIL_LOSS_MASK) as Array<
    keyof ProfileDetailLossMask
  >) {
    if (Object.hasOwn(mask, key) && typeof mask[key] !== "boolean") return null;
  }
  return {
    pointAttributes: mask.pointAttributes === true,
    observationIdentity: mask.observationIdentity === true,
    scopeIdentity: mask.scopeIdentity === true,
    attributeKey: mask.attributeKey === true,
    affectedFields: mask.affectedFields === true,
  };
}

function normalizeQuantity(
  value: ProfileLossQuantityInput | null | undefined,
): { quantity: ProfileLossQuantity | null; composable: boolean } | null {
  if (value === null || value === undefined) return { quantity: null, composable: false };
  if (
    !validQuantityDescriptors.has(value.descriptor) ||
    typeof value.unit !== "string" ||
    escapedStringLengthWithin(value.unit, PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT) === null ||
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

function broaderTarget(target: ProfileTarget): ProfileTarget | null {
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
  target: ProfileTarget;
  signalCoverage: readonly ProfileObservationKind[];
  effects: readonly ProfileDiagnosticEffect[];
  extent: ProfileDiagnosticExtent;
  attributeKey: ProfileAttributeKeySelector;
  affectedFields: readonly ProfileAffectedFields[];
  detailLoss: ProfileDetailLossMask;
  lossQuantity: ProfileLossQuantity | null;
}): typeof input {
  let value = input;
  const fits = () => JSON.stringify(value).length <= PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT;
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
    const target = broaderTarget(previous) as ProfileTarget;
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

function diagnosticIdentity(value: ProfileDiagnostic): string {
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
    value.wholeResultUnavailable,
  ]);
}

function severityRank(value: ProfileDiagnosticSeverity): number {
  return value === "warning" ? 1 : 0;
}

function createEmptySummary(
  priorIssueDetail: "retained" | "unavailable",
): ProfileDiagnosticSummary {
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
        : { ...EMPTY_PROFILE_DETAIL_LOSS_MASK },
    omittedOccurrences: priorIssueDetail === "unavailable" ? null : 0,
    countSaturated: false,
    maximumSeverity: null,
    priorIssueDetail,
  };
}

function mergeIntoSummary(
  summary: ProfileDiagnosticSummary,
  diagnostic: ProfileDiagnostic,
): ProfileDiagnosticSummary {
  const coverage = new Set(summary.signalCoverage);
  const effectsByKind = new Map<ProfileObservationKind, ProfileDiagnosticEffectSummary>();
  for (const item of summary.effectsByKind) effectsByKind.set(item.kind, item);
  for (const kind of diagnostic.signalCoverage) {
    coverage.add(kind);
    const prior = effectsByKind.get(kind);
    effectsByKind.set(kind, {
      kind,
      effects: [...new Set([...(prior?.effects ?? []), ...diagnostic.effects])].sort(),
      wholeResultUnavailable:
        (prior?.wholeResultUnavailable ?? false) || diagnostic.wholeResultUnavailable,
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
  diagnostics: readonly ProfileDiagnostic[],
  summary: ProfileDiagnosticSummary | null,
): ProfileDiagnosticsSnapshot {
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

export class BoundedDiagnosticAccumulator {
  readonly #entries = new Map<string, StoredDiagnostic>();
  #summary: ProfileDiagnosticSummary | null = null;

  add(input: ProfileDiagnosticInput): void {
    try {
      const severity = PROFILE_DIAGNOSTIC_SEVERITY[input.code];
      if (!severity || !validStages.has(input.stage)) return this.#recordInvalid();
      const signalCoverage = normalizeProfileKinds(input.signalCoverage);
      const effects = normalizeProfileEffects(input.effects);
      const affectedFields = normalizeAffectedFields(input.affectedFields ?? []);
      let attributeKey = normalizeAttributeKeySelector(
        input.attributeKey ?? { type: "not_applicable" },
      );
      const quantity = normalizeQuantity(input.lossQuantity);
      const count = normalizeCount(input.count);
      const detailLoss =
        input.detailLoss === undefined
          ? { ...EMPTY_PROFILE_DETAIL_LOSS_MASK }
          : normalizeDetailLoss(input.detailLoss);
      const wholeResultUnavailable = input.wholeResultUnavailable ?? false;
      const hasWholeResultLossEffect =
        effects?.includes("missing_observations") ||
        effects?.includes("unknown_collection_coverage");
      if (
        !signalCoverage ||
        !effects ||
        effects.length === 0 ||
        !affectedFields ||
        !attributeKey ||
        !quantity ||
        count === null ||
        detailLoss === null ||
        typeof wholeResultUnavailable !== "boolean" ||
        (wholeResultUnavailable && !hasWholeResultLossEffect) ||
        (input.extent !== "entire_target" && input.extent !== "unidentified_subset")
      )
        return this.#recordInvalid();
      let boundedDetailLoss = detailLoss;
      if (
        attributeKey.type === "exact" &&
        escapedStringLengthWithin(attributeKey.key, PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT) === null
      ) {
        attributeKey = { type: "discarded" };
        boundedDetailLoss = { ...boundedDetailLoss, attributeKey: true };
      }
      const normalizedTarget = normalizeProfileTarget(input.target);
      boundedDetailLoss = mergeDetailLossMasks(boundedDetailLoss, normalizedTarget.detailLoss);
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
        detailLoss: boundedDetailLoss,
        lossQuantity: quantity.quantity,
      });
      const diagnostic: ProfileDiagnostic = {
        code: input.code,
        severity,
        stage: input.stage,
        ...bounded,
        wholeResultUnavailable,
        count,
        countSaturated: false,
        message: normalizeMessage(input.message),
        reportDelivery: null,
      };
      if (JSON.stringify(bounded).length > PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT) {
        this.#summary = mergeIntoSummary(
          this.#summary ?? createEmptySummary("retained"),
          diagnostic,
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
            lossQuantity = {
              ...lossQuantity,
              value: sum.value,
              saturated: lossQuantity.saturated || sum.saturated,
            };
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
        );
        return;
      }
      this.#entries.set(key, { diagnostic, quantityComposable: quantity.composable });
    } catch {
      this.#recordInvalid();
    }
  }

  snapshot(): ProfileDiagnosticsSnapshot {
    return freezeSnapshot(
      [...this.#entries.values()].map(({ diagnostic }) => diagnostic),
      this.#summary,
    );
  }

  #recordInvalid(): void {
    const diagnostic: ProfileDiagnostic = {
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
      wholeResultUnavailable: false,
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
        countSaturated: current.diagnostic.countSaturated || count.saturated,
      };
    } else if (
      this.#entries.size <
      PROFILE_COLLECTION_LIMITS.diagnostics.maximum -
        PROFILE_COLLECTION_LIMITS.diagnostics.overflowReservedEntries
    )
      this.#entries.set(key, { diagnostic, quantityComposable: false });
    else
      this.#summary = mergeIntoSummary(this.#summary ?? createEmptySummary("retained"), diagnostic);
  }
}

export const profileDiagnosticInternals = {
  createEmptySummary,
  freezeSnapshot,
  mergeIntoSummary,
};
