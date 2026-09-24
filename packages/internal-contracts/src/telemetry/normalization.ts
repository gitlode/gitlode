import {
  PROFILE_COUNTER_FIELDS,
  PROFILE_COLLECTION_LIMITS,
  PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT,
  PROFILE_DIAGNOSTIC_EFFECTS,
  PROFILE_DIAGNOSTIC_EXTENTS,
  PROFILE_DIAGNOSTIC_SEVERITY,
  PROFILE_DIAGNOSTIC_STAGES,
  PROFILE_HISTOGRAM_FIELDS,
  PROFILE_LOSS_QUANTITY_DESCRIPTORS,
  PROFILE_OBSERVATION_KINDS,
  PROFILE_REPORT_SCHEMA_VERSION,
  PROFILE_SIGNAL_STATUSES,
  PROFILE_SPAN_FIELDS,
} from "./profile-report.js";
import type {
  ProfileAffectedFields,
  ProfileAttribute,
  ProfileAttributeKeySelector,
  ProfileAttributeValue,
  ProfileCounterPoint,
  ProfileDetailLossMask,
  ProfileDiagnosticEffect,
  ProfileDiagnostic,
  ProfileDiagnosticEffectSummary,
  ProfileDiagnosticSeverity,
  ProfileDiagnosticSummary,
  ProfileHistogramPoint,
  ProfileInstrumentationScope,
  ProfileLossQuantityDescriptor,
  ProfileObservationKind,
  ProfileReport,
  ProfileSpanAggregate,
  ProfileSpanAttributeSummary,
  ProfileTarget,
} from "./profile-report.js";
export type ProfileValueNormalization =
  | { readonly valid: true; readonly value: ProfileAttributeValue }
  | { readonly valid: false };
export function normalizeProfileAttributeValue(value: unknown): ProfileValueNormalization {
  if (typeof value === "string" || typeof value === "boolean") return { valid: true, value };
  if (typeof value === "number" && Number.isFinite(value))
    return { valid: true, value: Object.is(value, -0) ? 0 : value };
  return { valid: false };
}
export function normalizeProfileInstrumentationScope(
  name: string,
  version?: string | null,
): ProfileInstrumentationScope {
  return { name, version: version ?? null };
}
export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
const typeOrder = (value: ProfileAttributeValue): number =>
  typeof value === "boolean" ? 0 : typeof value === "number" ? 1 : 2;
export function compareProfileAttributeValues(
  left: ProfileAttributeValue,
  right: ProfileAttributeValue,
): number {
  const byType = typeOrder(left) - typeOrder(right);
  if (byType !== 0) return byType;
  if (typeof left === "string" && typeof right === "string") return compareCodeUnits(left, right);
  if (typeof left === "number" && typeof right === "number") return left - right;
  return left === right ? 0 : left === false ? -1 : 1;
}
export function compareProfileAttributes(left: ProfileAttribute, right: ProfileAttribute): number {
  return compareCodeUnits(left.key, right.key);
}
export function compareProfileScopes(
  left: ProfileInstrumentationScope,
  right: ProfileInstrumentationScope,
): number {
  const byName = compareCodeUnits(left.name, right.name);
  if (byName !== 0) return byName;
  if (left.version === null) return right.version === null ? 0 : -1;
  if (right.version === null) return 1;
  return compareCodeUnits(left.version, right.version);
}
export const EMPTY_PROFILE_DETAIL_LOSS_MASK: ProfileDetailLossMask = Object.freeze({
  pointAttributes: false,
  observationIdentity: false,
  scopeIdentity: false,
  attributeKey: false,
  affectedFields: false,
});

const allowedFields = {
  span: new Set<string>(PROFILE_SPAN_FIELDS),
  counter: new Set<string>(PROFILE_COUNTER_FIELDS),
  histogram: new Set<string>(PROFILE_HISTOGRAM_FIELDS),
} as const;
const fieldOrder = {
  span: new Map<string, number>(PROFILE_SPAN_FIELDS.map((field, index) => [field, index])),
  counter: new Map<string, number>(PROFILE_COUNTER_FIELDS.map((field, index) => [field, index])),
  histogram: new Map<string, number>(
    PROFILE_HISTOGRAM_FIELDS.map((field, index) => [field, index]),
  ),
} as const;

function uniqueSorted<Value extends string>(
  input: readonly unknown[],
  allowed: ReadonlySet<string>,
): Value[] | null {
  if (input.length > allowed.size) return null;
  const result = new Set<Value>();
  for (const value of input) {
    if (typeof value !== "string" || !allowed.has(value)) return null;
    result.add(value as Value);
  }
  return [...result].sort(compareCodeUnits);
}

export function normalizeProfileKinds(input: unknown): ProfileObservationKind[] | null {
  if (!Array.isArray(input)) return null;
  return uniqueSorted(input, new Set(PROFILE_OBSERVATION_KINDS));
}

export function normalizeProfileEffects(input: unknown): ProfileDiagnosticEffect[] | null {
  if (!Array.isArray(input)) return null;
  return uniqueSorted(input, new Set(PROFILE_DIAGNOSTIC_EFFECTS));
}

export function normalizeAffectedFields(input: unknown): ProfileAffectedFields[] | null {
  if (!Array.isArray(input)) return null;
  if (input.length > PROFILE_OBSERVATION_KINDS.length) return null;
  const byKind = new Map<ProfileObservationKind, ProfileAffectedFields["fields"]>();
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const value = item as { kind?: unknown; fields?: unknown };
    if (
      typeof value.kind !== "string" ||
      !(value.kind in allowedFields) ||
      !Array.isArray(value.fields)
    )
      return null;
    const fields = uniqueSorted<ProfileAffectedFields["fields"][number]>(
      value.fields,
      allowedFields[value.kind as ProfileObservationKind],
    );
    if (!fields || fields.length === 0 || byKind.has(value.kind as ProfileObservationKind))
      return null;
    const kind = value.kind as ProfileObservationKind;
    fields.sort(
      (left, right) => (fieldOrder[kind].get(left) ?? 0) - (fieldOrder[kind].get(right) ?? 0),
    );
    byKind.set(kind, fields);
  }
  return [...byKind.entries()]
    .sort(([left], [right]) => compareCodeUnits(left, right))
    .map(([kind, fields]) => ({ kind, fields }));
}

export function normalizeAttributeKeySelector(input: unknown): ProfileAttributeKeySelector | null {
  if (!input || typeof input !== "object") return null;
  const selector = input as { type?: unknown; key?: unknown };
  if (selector.type === "not_applicable" || selector.type === "discarded")
    return { type: selector.type };
  return selector.type === "exact" && typeof selector.key === "string"
    ? { type: "exact", key: selector.key }
    : null;
}

function cloneScope(input: unknown): ProfileInstrumentationScope | null {
  if (!input || typeof input !== "object") return null;
  const scope = input as { name?: unknown; version?: unknown };
  return typeof scope.name === "string" &&
    (typeof scope.version === "string" || scope.version === null)
    ? { name: scope.name, version: scope.version }
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

function addStringBudget(value: string, used: number): number | null {
  const length = escapedStringLengthWithin(value, PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT - used);
  return length === null ? null : used + length;
}

function cloneAttributesBounded(input: unknown, initialBudget: number): ProfileAttribute[] | null {
  if (!Array.isArray(input)) return null;
  const attributes: ProfileAttribute[] = [];
  const keys = new Set<string>();
  let budget = initialBudget;
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const attribute = item as { key?: unknown; value?: unknown };
    if (typeof attribute.key !== "string" || keys.has(attribute.key)) return null;
    const normalized = normalizeProfileAttributeValue(attribute.value);
    if (!normalized.valid) return null;
    const keyBudget = addStringBudget(attribute.key, budget);
    if (keyBudget === null) return null;
    budget = keyBudget;
    if (typeof normalized.value === "string") {
      const valueBudget = addStringBudget(normalized.value, budget);
      if (valueBudget === null) return null;
      budget = valueBudget;
    } else budget += 24;
    if (budget > PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT) return null;
    keys.add(attribute.key);
    attributes.push({ key: attribute.key, value: normalized.value });
  }
  return attributes.sort((left, right) => {
    const byKey = compareCodeUnits(left.key, right.key);
    if (byKey !== 0) return byKey;
    return compareCodeUnits(
      `${typeof left.value}:${String(left.value)}`,
      `${typeof right.value}:${String(right.value)}`,
    );
  });
}

export interface BoundedProfileTarget {
  readonly target: ProfileTarget;
  readonly detailLoss: ProfileDetailLossMask;
}

export function normalizeProfileTarget(input: unknown): BoundedProfileTarget {
  const lost = { ...EMPTY_PROFILE_DETAIL_LOSS_MASK };
  if (!input || typeof input !== "object") {
    lost.scopeIdentity = true;
    lost.observationIdentity = true;
    lost.pointAttributes = true;
    return { target: { type: "report" }, detailLoss: lost };
  }
  const candidate = input as {
    type?: unknown;
    scope?: unknown;
    kind?: unknown;
    name?: unknown;
    attributes?: unknown;
  };
  if (candidate.type === "report") return { target: { type: "report" }, detailLoss: lost };
  const scope = cloneScope(candidate.scope);
  if (!scope) {
    lost.scopeIdentity = true;
    if (candidate.type === "observation" || candidate.type === "point")
      lost.observationIdentity = true;
    if (candidate.type === "point") lost.pointAttributes = true;
    return { target: { type: "report" }, detailLoss: lost };
  }
  let budget = 64;
  const scopeNameBudget = addStringBudget(scope.name, budget);
  const scopeVersionBudget =
    scopeNameBudget === null
      ? null
      : scope.version === null
        ? scopeNameBudget + 4
        : addStringBudget(scope.version, scopeNameBudget);
  budget = scopeVersionBudget ?? Infinity;
  if (!Number.isFinite(budget) || budget > PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT) {
    lost.scopeIdentity = true;
    lost.observationIdentity = candidate.type === "observation" || candidate.type === "point";
    lost.pointAttributes = candidate.type === "point";
    return { target: { type: "report" }, detailLoss: lost };
  }
  if (candidate.type === "scope") return { target: { type: "scope", scope }, detailLoss: lost };
  if (
    (candidate.type !== "observation" && candidate.type !== "point") ||
    typeof candidate.kind !== "string" ||
    !PROFILE_OBSERVATION_KINDS.includes(candidate.kind as ProfileObservationKind) ||
    typeof candidate.name !== "string"
  ) {
    lost.observationIdentity = true;
    lost.pointAttributes = candidate.type === "point";
    return { target: { type: "scope", scope }, detailLoss: lost };
  }
  const nameBudget = addStringBudget(candidate.name, budget + 32);
  if (nameBudget === null) {
    lost.observationIdentity = true;
    lost.pointAttributes = candidate.type === "point";
    return { target: { type: "scope", scope }, detailLoss: lost };
  }
  const observation: ProfileTarget = {
    type: "observation",
    scope,
    kind: candidate.kind as ProfileObservationKind,
    name: candidate.name,
  };
  if (candidate.type === "observation") return { target: observation, detailLoss: lost };
  if (candidate.kind !== "counter" && candidate.kind !== "histogram") {
    lost.pointAttributes = true;
    return { target: observation, detailLoss: lost };
  }
  const attributes = cloneAttributesBounded(candidate.attributes, nameBudget + 64);
  if (!attributes) {
    lost.pointAttributes = true;
    return { target: observation, detailLoss: lost };
  }
  return {
    target: { type: "point", scope, kind: candidate.kind, name: candidate.name, attributes },
    detailLoss: lost,
  };
}

export function mergeDetailLossMasks(
  left: ProfileDetailLossMask,
  right: ProfileDetailLossMask,
): ProfileDetailLossMask {
  return {
    pointAttributes: left.pointAttributes || right.pointAttributes,
    observationIdentity: left.observationIdentity || right.observationIdentity,
    scopeIdentity: left.scopeIdentity || right.scopeIdentity,
    attributeKey: left.attributeKey || right.attributeKey,
    affectedFields: left.affectedFields || right.affectedFields,
  };
}

const nonnegativeSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const positiveSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
const finiteNonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const canonicalNumber = (value: number): number => (Object.is(value, -0) ? 0 : value);

function cloneAttributes(input: unknown): ProfileAttribute[] | null {
  if (!Array.isArray(input)) return null;
  const result: ProfileAttribute[] = [];
  const keys = new Set<string>();
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const attribute = item as { key?: unknown; value?: unknown };
    if (typeof attribute.key !== "string" || keys.has(attribute.key)) return null;
    const value = normalizeProfileAttributeValue(attribute.value);
    if (!value.valid) return null;
    keys.add(attribute.key);
    result.push({ key: attribute.key, value: value.value });
  }
  return result.sort((left, right) => {
    const byKey = compareCodeUnits(left.key, right.key);
    return byKey !== 0 ? byKey : compareProfileAttributeValues(left.value, right.value);
  });
}

function cloneSpanSummary(input: unknown): ProfileSpanAttributeSummary | null {
  if (!input || typeof input !== "object") return null;
  const summary = input as Record<string, unknown>;
  if (typeof summary.key !== "string" || !positiveSafeInteger(summary.observedCount)) return null;
  if (summary.reducer === "single") {
    const value = normalizeProfileAttributeValue(summary.value);
    return value.valid && nonnegativeSafeInteger(summary.conflictCount)
      ? {
          key: summary.key,
          reducer: "single",
          value: value.value,
          observedCount: summary.observedCount,
          conflictCount: summary.conflictCount,
        }
      : null;
  }
  if (summary.reducer === "min_max")
    return typeof summary.minimum === "number" &&
      Number.isFinite(summary.minimum) &&
      typeof summary.maximum === "number" &&
      Number.isFinite(summary.maximum) &&
      summary.minimum <= summary.maximum
      ? {
          key: summary.key,
          reducer: "min_max",
          minimum: canonicalNumber(summary.minimum),
          maximum: canonicalNumber(summary.maximum),
          observedCount: summary.observedCount,
        }
      : null;
  if (
    summary.reducer !== "distinct" ||
    !Array.isArray(summary.values) ||
    summary.values.length > 16
  )
    return null;
  if (!nonnegativeSafeInteger(summary.overflowCount)) return null;
  const values: { value: string | number | boolean; count: number }[] = [];
  const identities = new Set<string>();
  for (const item of summary.values) {
    if (!item || typeof item !== "object") return null;
    const entry = item as { value?: unknown; count?: unknown };
    const value = normalizeProfileAttributeValue(entry.value);
    if (!value.valid || !positiveSafeInteger(entry.count)) return null;
    const identity = `${typeof value.value}:${String(value.value)}`;
    if (identities.has(identity)) return null;
    identities.add(identity);
    values.push({ value: value.value, count: entry.count });
  }
  if (
    values.reduce((sum, item) => sum + item.count, summary.overflowCount) !== summary.observedCount
  )
    return null;
  values.sort((left, right) => compareProfileAttributeValues(left.value, right.value));
  return {
    key: summary.key,
    reducer: "distinct",
    values,
    observedCount: summary.observedCount,
    overflowCount: summary.overflowCount,
  };
}

function normalizeUnavailableFields<Fields extends string>(
  input: unknown,
  allowed: ReadonlySet<string>,
): Fields[] | null {
  return Array.isArray(input) ? uniqueSorted<Fields>(input, allowed) : null;
}

export function normalizeProfileSpanAggregate(input: unknown): ProfileSpanAggregate | null {
  if (!input || typeof input !== "object") return null;
  const span = input as Record<string, unknown>;
  const scope = cloneScope(span.scope);
  const unavailableFields = normalizeUnavailableFields<
    ProfileSpanAggregate["unavailableFields"][number]
  >(span.unavailableFields, allowedFields.span);
  if (
    !scope ||
    !unavailableFields ||
    typeof span.name !== "string" ||
    !nonnegativeSafeInteger(span.callCount) ||
    !nonnegativeSafeInteger(span.errorCount) ||
    span.errorCount > span.callCount ||
    !finiteNonnegative(span.totalDurationSeconds) ||
    !finiteNonnegative(span.maxDurationSeconds) ||
    !nonnegativeSafeInteger(span.durationContributionCount) ||
    span.durationContributionCount > span.callCount ||
    !Array.isArray(span.attributes)
  )
    return null;
  const attributes: ProfileSpanAttributeSummary[] = [];
  const keys = new Set<string>();
  for (const item of span.attributes) {
    const summary = cloneSpanSummary(item);
    if (!summary || keys.has(summary.key)) return null;
    keys.add(summary.key);
    attributes.push(summary);
  }
  attributes.sort((left, right) => compareCodeUnits(left.key, right.key));
  return {
    scope,
    name: span.name,
    callCount: span.callCount,
    errorCount: span.errorCount,
    totalDurationSeconds: canonicalNumber(span.totalDurationSeconds),
    maxDurationSeconds: canonicalNumber(span.maxDurationSeconds),
    durationContributionCount: span.durationContributionCount,
    unavailableFields,
    attributes,
  };
}

export function normalizeProfileCounterPoint(input: unknown): ProfileCounterPoint | null {
  if (!input || typeof input !== "object") return null;
  const point = input as Record<string, unknown>;
  const scope = cloneScope(point.scope);
  const attributes = cloneAttributes(point.attributes);
  const unavailableFields = normalizeUnavailableFields<
    ProfileCounterPoint["unavailableFields"][number]
  >(point.unavailableFields, allowedFields.counter);
  return scope &&
    attributes &&
    unavailableFields &&
    typeof point.name === "string" &&
    typeof point.unit === "string" &&
    finiteNonnegative(point.value)
    ? {
        scope,
        name: point.name,
        unit: point.unit,
        attributes,
        value: canonicalNumber(point.value),
        unavailableFields,
      }
    : null;
}

export function normalizeProfileHistogramPoint(input: unknown): ProfileHistogramPoint | null {
  if (!input || typeof input !== "object") return null;
  const point = input as Record<string, unknown>;
  const scope = cloneScope(point.scope);
  const attributes = cloneAttributes(point.attributes);
  const unavailableFields = normalizeUnavailableFields<
    ProfileHistogramPoint["unavailableFields"][number]
  >(point.unavailableFields, allowedFields.histogram);
  if (
    !scope ||
    !attributes ||
    !unavailableFields ||
    typeof point.name !== "string" ||
    typeof point.unit !== "string" ||
    !positiveSafeInteger(point.count) ||
    !finiteNonnegative(point.sum) ||
    (point.minimum !== null && !finiteNonnegative(point.minimum)) ||
    (point.maximum !== null && !finiteNonnegative(point.maximum)) ||
    (typeof point.minimum === "number" &&
      typeof point.maximum === "number" &&
      point.minimum > point.maximum) ||
    !Array.isArray(point.explicitBounds) ||
    !Array.isArray(point.bucketCounts) ||
    point.bucketCounts.length !== point.explicitBounds.length + 1
  )
    return null;
  if (
    point.explicitBounds.some(
      (bound, index) =>
        typeof bound !== "number" ||
        !Number.isFinite(bound) ||
        (index > 0 && bound <= ((point.explicitBounds as number[])[index - 1] ?? Infinity)),
    ) ||
    point.bucketCounts.some((count) => !nonnegativeSafeInteger(count)) ||
    (point.bucketCounts as number[]).reduce((sum, count) => sum + count, 0) !== point.count
  )
    return null;
  return {
    scope,
    name: point.name,
    unit: point.unit,
    attributes,
    count: point.count,
    sum: canonicalNumber(point.sum),
    minimum: point.minimum === null ? null : canonicalNumber(point.minimum as number),
    maximum: point.maximum === null ? null : canonicalNumber(point.maximum as number),
    explicitBounds: (point.explicitBounds as number[]).map(canonicalNumber),
    bucketCounts: [...(point.bucketCounts as number[])],
    unavailableFields,
  };
}

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

function normalizeDetailLossMask(input: unknown): ProfileDetailLossMask | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const keys = Object.keys(EMPTY_PROFILE_DETAIL_LOSS_MASK) as Array<keyof ProfileDetailLossMask>;
  if (keys.some((key) => typeof value[key] !== "boolean")) return null;
  return Object.fromEntries(
    keys.map((key) => [key, value[key]]),
  ) as unknown as ProfileDetailLossMask;
}

function samePlainValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => samePlainValue(item, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) => Object.hasOwn(rightRecord, key) && samePlainValue(leftRecord[key], rightRecord[key]),
    )
  );
}

function normalizeDetailedDiagnostic(input: unknown): ProfileDiagnostic | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (
    typeof value.code !== "string" ||
    value.code === "diagnostic_overflow" ||
    !(value.code in PROFILE_DIAGNOSTIC_SEVERITY) ||
    value.severity !==
      PROFILE_DIAGNOSTIC_SEVERITY[value.code as keyof typeof PROFILE_DIAGNOSTIC_SEVERITY] ||
    !PROFILE_DIAGNOSTIC_STAGES.includes(value.stage as never) ||
    !PROFILE_DIAGNOSTIC_EXTENTS.includes(value.extent as never)
  )
    return null;
  const boundedTarget = normalizeProfileTarget(value.target);
  const signalCoverage = normalizeProfileKinds(value.signalCoverage);
  const effects = normalizeProfileEffects(value.effects);
  const attributeKey = normalizeAttributeKeySelector(value.attributeKey);
  const affectedFields = normalizeAffectedFields(value.affectedFields);
  const detailLoss = normalizeDetailLossMask(value.detailLoss);
  if (
    !samePlainValue(boundedTarget.target, value.target) ||
    !signalCoverage ||
    !effects ||
    effects.length === 0 ||
    !attributeKey ||
    !affectedFields ||
    !detailLoss ||
    typeof value.wholeResultUnavailable !== "boolean" ||
    !positiveSafeInteger(value.count) ||
    typeof value.countSaturated !== "boolean" ||
    (value.message !== null &&
      (typeof value.message !== "string" ||
        value.message.length > PROFILE_COLLECTION_LIMITS.diagnosticMessageUtf16CodeUnits))
  )
    return null;
  const hasWholeResultEffect =
    effects.includes("missing_observations") || effects.includes("unknown_collection_coverage");
  if (value.wholeResultUnavailable && !hasWholeResultEffect) return null;

  let lossQuantity: ProfileDiagnostic["lossQuantity"] = null;
  if (value.lossQuantity !== null) {
    if (!value.lossQuantity || typeof value.lossQuantity !== "object") return null;
    const quantity = value.lossQuantity as Record<string, unknown>;
    if (
      !PROFILE_LOSS_QUANTITY_DESCRIPTORS.includes(quantity.descriptor as never) ||
      typeof quantity.unit !== "string" ||
      escapedStringLengthWithin(quantity.unit, PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT) === null ||
      (quantity.value !== null && !nonnegativeSafeInteger(quantity.value)) ||
      typeof quantity.saturated !== "boolean"
    )
      return null;
    lossQuantity = {
      descriptor: quantity.descriptor as ProfileLossQuantityDescriptor,
      unit: quantity.unit,
      value: quantity.value as number | null,
      saturated: quantity.saturated,
    };
  }

  let reportDelivery: ProfileDiagnostic["reportDelivery"] = null;
  if (value.reportDelivery !== null) {
    if (!value.reportDelivery || typeof value.reportDelivery !== "object") return null;
    const delivery = value.reportDelivery as Record<string, unknown>;
    if (
      delivery.path !== "fixed_fallback" ||
      (delivery.measurementResults !== "none" &&
        delivery.measurementResults !== "trusted_snapshot") ||
      (delivery.priorIssueDetail !== "retained" && delivery.priorIssueDetail !== "unavailable")
    )
      return null;
    reportDelivery = {
      path: "fixed_fallback",
      measurementResults: delivery.measurementResults,
      priorIssueDetail: delivery.priorIssueDetail,
    };
  }

  const detail = {
    target: boundedTarget.target,
    signalCoverage,
    effects,
    extent: value.extent,
    attributeKey,
    affectedFields,
    detailLoss,
    lossQuantity,
  };
  if (JSON.stringify(detail).length > PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT) return null;
  return {
    code: value.code as ProfileDiagnostic["code"],
    severity: value.severity as ProfileDiagnosticSeverity,
    stage: value.stage as ProfileDiagnostic["stage"],
    ...detail,
    extent: value.extent as ProfileDiagnostic["extent"],
    wholeResultUnavailable: value.wholeResultUnavailable,
    count: value.count,
    countSaturated: value.countSaturated,
    message: value.message as string | null,
    reportDelivery,
  };
}

function normalizeEffectSummary(input: unknown): ProfileDiagnosticEffectSummary | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (!PROFILE_OBSERVATION_KINDS.includes(value.kind as never)) return null;
  const effects = normalizeProfileEffects(value.effects);
  return effects && effects.length > 0 && typeof value.wholeResultUnavailable === "boolean"
    ? {
        kind: value.kind as ProfileObservationKind,
        effects,
        wholeResultUnavailable: value.wholeResultUnavailable,
      }
    : null;
}

function normalizeDiagnosticSummary(input: unknown): ProfileDiagnosticSummary | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const signalCoverage = normalizeProfileKinds(value.signalCoverage);
  const reportEffects = normalizeProfileEffects(value.reportEffects);
  const detailLoss = normalizeDetailLossMask(value.detailLoss);
  if (
    value.code !== "diagnostic_overflow" ||
    value.severity !== "warning" ||
    value.stage !== "report_build" ||
    !samePlainValue(value.target, { type: "report" }) ||
    value.extent !== "unidentified_subset" ||
    !samePlainValue(value.effects, ["lost_issue_detail"]) ||
    !signalCoverage ||
    !reportEffects ||
    !detailLoss ||
    !Array.isArray(value.effectsByKind) ||
    value.effectsByKind.length > PROFILE_OBSERVATION_KINDS.length ||
    (value.omittedOccurrences !== null && !nonnegativeSafeInteger(value.omittedOccurrences)) ||
    typeof value.countSaturated !== "boolean" ||
    (value.maximumSeverity !== null &&
      value.maximumSeverity !== "info" &&
      value.maximumSeverity !== "warning") ||
    (value.priorIssueDetail !== "retained" && value.priorIssueDetail !== "unavailable")
  )
    return null;
  const effectsByKind: ProfileDiagnosticEffectSummary[] = [];
  const seenKinds = new Set<ProfileObservationKind>();
  for (const item of value.effectsByKind) {
    const normalized = normalizeEffectSummary(item);
    if (!normalized || seenKinds.has(normalized.kind)) return null;
    seenKinds.add(normalized.kind);
    effectsByKind.push(normalized);
  }
  if ((value.priorIssueDetail === "unavailable") !== (value.omittedOccurrences === null))
    return null;
  return {
    code: "diagnostic_overflow",
    severity: "warning",
    stage: "report_build",
    target: { type: "report" },
    extent: "unidentified_subset",
    effects: ["lost_issue_detail"],
    signalCoverage,
    effectsByKind: effectsByKind.sort((left, right) => compareCodeUnits(left.kind, right.kind)),
    reportEffects,
    detailLoss,
    omittedOccurrences: value.omittedOccurrences as number | null,
    countSaturated: value.countSaturated,
    maximumSeverity: value.maximumSeverity as ProfileDiagnosticSeverity | null,
    priorIssueDetail: value.priorIssueDetail,
  };
}

const PROFILE_DATA_IMPACT_EFFECTS = new Set<ProfileDiagnosticEffect>([
  "missing_observations",
  "incomplete_measurement_fields",
  "missing_attribute_detail",
  "unknown_collection_coverage",
]);
const PROFILE_WHOLE_RESULT_EFFECTS = new Set<ProfileDiagnosticEffect>([
  "missing_observations",
  "unknown_collection_coverage",
]);

function hasEffect(
  effects: readonly ProfileDiagnosticEffect[],
  accepted: ReadonlySet<ProfileDiagnosticEffect>,
): boolean {
  return effects.some((effect) => accepted.has(effect));
}

function isMandatoryDeliveryDiagnostic(diagnostic: ProfileDiagnostic): boolean {
  return (
    diagnostic.code === "lifecycle_failure" &&
    diagnostic.stage === "report_build" &&
    samePlainValue(diagnostic.target, { type: "report" }) &&
    samePlainValue(diagnostic.signalCoverage, ["counter", "histogram", "span"]) &&
    samePlainValue(diagnostic.effects, ["report_delivery_failure"]) &&
    diagnostic.extent === "entire_target" &&
    samePlainValue(diagnostic.attributeKey, { type: "not_applicable" }) &&
    diagnostic.affectedFields.length === 0 &&
    samePlainValue(diagnostic.detailLoss, EMPTY_PROFILE_DETAIL_LOSS_MASK) &&
    diagnostic.lossQuantity === null &&
    !diagnostic.wholeResultUnavailable &&
    diagnostic.count === 1 &&
    !diagnostic.countSaturated &&
    diagnostic.message === null
  );
}

function validateDetailedDiagnosticRelationships(diagnostic: ProfileDiagnostic): boolean {
  if (
    (diagnostic.target.type === "observation" || diagnostic.target.type === "point") &&
    !diagnostic.signalCoverage.includes(diagnostic.target.kind)
  )
    return false;
  if (
    diagnostic.affectedFields.some((affected) => !diagnostic.signalCoverage.includes(affected.kind))
  )
    return false;
  if (
    diagnostic.wholeResultUnavailable &&
    !hasEffect(diagnostic.effects, PROFILE_WHOLE_RESULT_EFFECTS)
  )
    return false;
  const hasDeliveryEffect = diagnostic.effects.includes("report_delivery_failure");
  if (hasDeliveryEffect !== (diagnostic.reportDelivery !== null)) return false;
  return diagnostic.reportDelivery === null || isMandatoryDeliveryDiagnostic(diagnostic);
}

function validateDiagnosticSummaryRelationships(summary: ProfileDiagnosticSummary): boolean {
  if (
    summary.reportEffects.includes("report_delivery_failure") ||
    summary.effectsByKind.some((item) => item.effects.includes("report_delivery_failure"))
  )
    return false;
  if (
    !samePlainValue(
      summary.signalCoverage,
      summary.effectsByKind.map((item) => item.kind),
    )
  )
    return false;
  return summary.effectsByKind.every(
    (item) => !item.wholeResultUnavailable || hasEffect(item.effects, PROFILE_WHOLE_RESULT_EFFECTS),
  );
}

function validateProfileReportRelationships(report: ProfileReport): boolean {
  const details = report.diagnostics.filter(
    (diagnostic): diagnostic is ProfileDiagnostic => diagnostic.code !== "diagnostic_overflow",
  );
  const summary = report.diagnostics.find(
    (diagnostic): diagnostic is ProfileDiagnosticSummary =>
      diagnostic.code === "diagnostic_overflow",
  );
  if (
    details.some((diagnostic) => !validateDetailedDiagnosticRelationships(diagnostic)) ||
    (summary && !validateDiagnosticSummaryRelationships(summary))
  )
    return false;

  const fixedDeliveryWithoutMeasurements = details.some(
    (diagnostic) => diagnostic.reportDelivery?.measurementResults === "none",
  );
  const signals = [
    ["span", "spans"],
    ["counter", "counters"],
    ["histogram", "histograms"],
  ] as const;
  for (const [kind, signal] of signals) {
    const status = report.signalStatus[signal];
    const detailedImpact = details.some(
      (diagnostic) =>
        diagnostic.signalCoverage.includes(kind) &&
        hasEffect(diagnostic.effects, PROFILE_DATA_IMPACT_EFFECTS),
    );
    const detailedWhole = details.some(
      (diagnostic) =>
        diagnostic.signalCoverage.includes(kind) &&
        diagnostic.wholeResultUnavailable &&
        hasEffect(diagnostic.effects, PROFILE_WHOLE_RESULT_EFFECTS),
    );
    const summaryEvidence = summary?.effectsByKind.find((item) => item.kind === kind);
    const summaryImpact =
      summaryEvidence !== undefined &&
      hasEffect(summaryEvidence.effects, PROFILE_DATA_IMPACT_EFFECTS);
    const summaryWhole =
      summaryEvidence !== undefined &&
      summaryEvidence.wholeResultUnavailable &&
      hasEffect(summaryEvidence.effects, PROFILE_WHOLE_RESULT_EFFECTS);
    const hasImpact = detailedImpact || summaryImpact;
    const hasWholeResultEvidence = detailedWhole || summaryWhole;

    if (status === "unavailable" && report[signal].length > 0) return false;
    if (hasWholeResultEvidence && (status !== "unavailable" || report[signal].length > 0))
      return false;
    if (status === "complete" && (hasImpact || hasWholeResultEvidence)) return false;
    if (status === "partial" && !hasImpact) return false;
    if (status === "unavailable" && !hasWholeResultEvidence && !fixedDeliveryWithoutMeasurements)
      return false;
  }
  if (
    fixedDeliveryWithoutMeasurements &&
    signals.some(
      ([, signal]) => report.signalStatus[signal] !== "unavailable" || report[signal].length !== 0,
    )
  )
    return false;
  return true;
}

/** Validates and detaches a complete active ProfileReport without repairing invalid fields. */
export function normalizeProfileReport(input: unknown): ProfileReport | null {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const value = input as Record<string, unknown>;
    if (
      value.schemaVersion !== PROFILE_REPORT_SCHEMA_VERSION ||
      !value.signalStatus ||
      typeof value.signalStatus !== "object" ||
      !Array.isArray(value.spans) ||
      !Array.isArray(value.counters) ||
      !Array.isArray(value.histograms) ||
      !Array.isArray(value.diagnostics) ||
      value.spans.length > PROFILE_COLLECTION_LIMITS.spanGroups ||
      value.diagnostics.length > PROFILE_COLLECTION_LIMITS.diagnostics.maximum
    )
      return null;
    const status = value.signalStatus as Record<string, unknown>;
    if (
      !PROFILE_SIGNAL_STATUSES.includes(status.spans as never) ||
      !PROFILE_SIGNAL_STATUSES.includes(status.counters as never) ||
      !PROFILE_SIGNAL_STATUSES.includes(status.histograms as never)
    )
      return null;
    const spans = value.spans.map(normalizeProfileSpanAggregate);
    const counters = value.counters.map(normalizeProfileCounterPoint);
    const histograms = value.histograms.map(normalizeProfileHistogramPoint);
    if ([...spans, ...counters, ...histograms].some((item) => item === null)) return null;
    const instrumentCounts = new Map<string, number>();
    for (const [kind, points] of [
      ["counter", counters],
      ["histogram", histograms],
    ] as const) {
      for (const point of points) {
        if (!point) return null;
        const key = JSON.stringify([kind, point.scope.name, point.scope.version, point.name]);
        const count = (instrumentCounts.get(key) ?? 0) + 1;
        if (count > PROFILE_COLLECTION_LIMITS.metricPointsPerInstrument) return null;
        instrumentCounts.set(key, count);
      }
    }
    const diagnostics: Array<ProfileDiagnostic | ProfileDiagnosticSummary> = [];
    let summarySeen = false;
    for (const [index, item] of value.diagnostics.entries()) {
      const isSummary =
        !!item &&
        typeof item === "object" &&
        (item as Record<string, unknown>).code === "diagnostic_overflow";
      const normalized = isSummary
        ? normalizeDiagnosticSummary(item)
        : normalizeDetailedDiagnostic(item);
      if (!normalized || summarySeen || (isSummary && index !== value.diagnostics.length - 1))
        return null;
      summarySeen = isSummary;
      diagnostics.push(normalized);
    }
    const report: ProfileReport = {
      schemaVersion: PROFILE_REPORT_SCHEMA_VERSION,
      signalStatus: {
        spans: status.spans as ProfileReport["signalStatus"]["spans"],
        counters: status.counters as ProfileReport["signalStatus"]["counters"],
        histograms: status.histograms as ProfileReport["signalStatus"]["histograms"],
      },
      spans: spans as ProfileSpanAggregate[],
      counters: counters as ProfileCounterPoint[],
      histograms: histograms as ProfileHistogramPoint[],
      diagnostics,
    };
    return samePlainValue(value, report) && validateProfileReportRelationships(report)
      ? report
      : null;
  } catch {
    return null;
  }
}
