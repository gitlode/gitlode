import {
  compareCodeUnits,
  compareProfileAttributeValues,
  normalizeProfileAttributeValue,
} from "./normalization.js";
import {
  PROFILE_COUNTER_FIELDS_V2,
  PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT_V2,
  PROFILE_DIAGNOSTIC_EFFECTS_V2,
  PROFILE_HISTOGRAM_FIELDS_V2,
  PROFILE_OBSERVATION_KINDS_V2,
  PROFILE_SPAN_FIELDS_V2,
} from "./profile-report-v2.js";
import type {
  ProfileAffectedFieldsV2,
  ProfileAttributeKeySelectorV2,
  ProfileCounterPointV2,
  ProfileDetailLossMaskV2,
  ProfileDiagnosticEffectV2,
  ProfileHistogramPointV2,
  ProfileObservationKindV2,
  ProfileSpanAggregateV2,
  ProfileTargetV2,
} from "./profile-report-v2.js";
import type {
  ProfileAttribute,
  ProfileInstrumentationScope,
  ProfileSpanAttributeSummary,
} from "./profile-report.js";

export const EMPTY_PROFILE_DETAIL_LOSS_MASK_V2: ProfileDetailLossMaskV2 = Object.freeze({
  pointAttributes: false,
  observationIdentity: false,
  scopeIdentity: false,
  attributeKey: false,
  affectedFields: false,
});

const FIELD_ORDER = new Map<string, number>(
  [...PROFILE_SPAN_FIELDS_V2, ...PROFILE_COUNTER_FIELDS_V2, ...PROFILE_HISTOGRAM_FIELDS_V2].map(
    (field, index) => [field, index],
  ),
);
const allowedFields = {
  span: new Set<string>(PROFILE_SPAN_FIELDS_V2),
  counter: new Set<string>(PROFILE_COUNTER_FIELDS_V2),
  histogram: new Set<string>(PROFILE_HISTOGRAM_FIELDS_V2),
} as const;

function uniqueSorted<Value extends string>(
  input: readonly unknown[],
  allowed: ReadonlySet<string>,
): Value[] | null {
  const result = new Set<Value>();
  for (const value of input) {
    if (typeof value !== "string" || !allowed.has(value)) return null;
    result.add(value as Value);
  }
  return [...result].sort(compareCodeUnits);
}

export function normalizeProfileKindsV2(input: unknown): ProfileObservationKindV2[] | null {
  if (!Array.isArray(input)) return null;
  return uniqueSorted(input, new Set(PROFILE_OBSERVATION_KINDS_V2));
}

export function normalizeProfileEffectsV2(input: unknown): ProfileDiagnosticEffectV2[] | null {
  if (!Array.isArray(input)) return null;
  return uniqueSorted(input, new Set(PROFILE_DIAGNOSTIC_EFFECTS_V2));
}

export function normalizeAffectedFieldsV2(input: unknown): ProfileAffectedFieldsV2[] | null {
  if (!Array.isArray(input)) return null;
  const byKind = new Map<ProfileObservationKindV2, ProfileAffectedFieldsV2["fields"]>();
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const value = item as { kind?: unknown; fields?: unknown };
    if (
      typeof value.kind !== "string" ||
      !(value.kind in allowedFields) ||
      !Array.isArray(value.fields)
    )
      return null;
    const fields = uniqueSorted<ProfileAffectedFieldsV2["fields"][number]>(
      value.fields,
      allowedFields[value.kind as ProfileObservationKindV2],
    );
    if (!fields || fields.length === 0 || byKind.has(value.kind as ProfileObservationKindV2))
      return null;
    fields.sort((left, right) => (FIELD_ORDER.get(left) ?? 0) - (FIELD_ORDER.get(right) ?? 0));
    byKind.set(value.kind as ProfileObservationKindV2, fields);
  }
  return [...byKind.entries()]
    .sort(([left], [right]) => compareCodeUnits(left, right))
    .map(([kind, fields]) => ({ kind, fields }));
}

export function normalizeAttributeKeySelectorV2(
  input: unknown,
): ProfileAttributeKeySelectorV2 | null {
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
  const length = escapedStringLengthWithin(value, PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT_V2 - used);
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
    if (budget > PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT_V2) return null;
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

export interface BoundedProfileTargetV2 {
  readonly target: ProfileTargetV2;
  readonly detailLoss: ProfileDetailLossMaskV2;
}

export function normalizeProfileTargetV2(input: unknown): BoundedProfileTargetV2 {
  const lost = { ...EMPTY_PROFILE_DETAIL_LOSS_MASK_V2 };
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
  if (!Number.isFinite(budget) || budget > PROFILE_DIAGNOSTIC_DETAIL_UTF16_LIMIT_V2) {
    lost.scopeIdentity = true;
    lost.observationIdentity = candidate.type === "observation" || candidate.type === "point";
    lost.pointAttributes = candidate.type === "point";
    return { target: { type: "report" }, detailLoss: lost };
  }
  if (candidate.type === "scope") return { target: { type: "scope", scope }, detailLoss: lost };
  if (
    (candidate.type !== "observation" && candidate.type !== "point") ||
    typeof candidate.kind !== "string" ||
    !PROFILE_OBSERVATION_KINDS_V2.includes(candidate.kind as ProfileObservationKindV2) ||
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
  const observation: ProfileTargetV2 = {
    type: "observation",
    scope,
    kind: candidate.kind as ProfileObservationKindV2,
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

export function mergeDetailLossMasksV2(
  left: ProfileDetailLossMaskV2,
  right: ProfileDetailLossMaskV2,
): ProfileDetailLossMaskV2 {
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

export function normalizeProfileSpanAggregateV2(input: unknown): ProfileSpanAggregateV2 | null {
  if (!input || typeof input !== "object") return null;
  const span = input as Record<string, unknown>;
  const scope = cloneScope(span.scope);
  const unavailableFields = normalizeUnavailableFields<
    ProfileSpanAggregateV2["unavailableFields"][number]
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

export function normalizeProfileCounterPointV2(input: unknown): ProfileCounterPointV2 | null {
  if (!input || typeof input !== "object") return null;
  const point = input as Record<string, unknown>;
  const scope = cloneScope(point.scope);
  const attributes = cloneAttributes(point.attributes);
  const unavailableFields = normalizeUnavailableFields<
    ProfileCounterPointV2["unavailableFields"][number]
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

export function normalizeProfileHistogramPointV2(input: unknown): ProfileHistogramPointV2 | null {
  if (!input || typeof input !== "object") return null;
  const point = input as Record<string, unknown>;
  const scope = cloneScope(point.scope);
  const attributes = cloneAttributes(point.attributes);
  const unavailableFields = normalizeUnavailableFields<
    ProfileHistogramPointV2["unavailableFields"][number]
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
