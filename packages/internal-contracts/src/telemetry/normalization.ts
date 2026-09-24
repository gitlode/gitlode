import {
  PROFILE_COUNTER_FIELDS,
  PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT,
  PROFILE_DIAGNOSTIC_EFFECTS,
  PROFILE_HISTOGRAM_FIELDS,
  PROFILE_OBSERVATION_KINDS,
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
  ProfileHistogramPoint,
  ProfileInstrumentationScope,
  ProfileObservationKind,
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
