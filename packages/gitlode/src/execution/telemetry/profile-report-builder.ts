import {
  compareCodeUnits,
  compareProfileAttributeValues,
  compareProfileScopes,
  normalizeProfileAttributeValue,
  PROFILE_REPORT_SCHEMA_VERSION,
} from "@gitlode/internal-contracts/telemetry";
import type {
  ProfileAttribute,
  ProfileCounterPoint,
  ProfileHistogramPoint,
  ProfileInstrumentationScope,
  ProfileReport,
  ProfileSignalStatus,
  ProfileSpanAggregate,
  ProfileSpanAttributeSummary,
} from "@gitlode/internal-contracts/telemetry";

import type { BoundedDiagnosticAccumulator } from "./diagnostic-accumulator.js";

export interface ProfileSignalInput<Value> {
  readonly status: ProfileSignalStatus;
  readonly values: readonly Value[];
}
export interface ProfileReportBuildInput {
  readonly spans: ProfileSignalInput<ProfileSpanAggregate>;
  readonly counters: ProfileSignalInput<ProfileCounterPoint>;
  readonly histograms: ProfileSignalInput<ProfileHistogramPoint>;
}

const nonnegativeSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const positiveSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
const finiteNonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const normalizedNumber = (value: number): number => (Object.is(value, -0) ? 0 : value);

function cloneScope(scope: ProfileInstrumentationScope): ProfileInstrumentationScope | null {
  if (
    !scope ||
    typeof scope !== "object" ||
    typeof scope.name !== "string" ||
    (scope.version !== null && typeof scope.version !== "string")
  )
    return null;
  return { name: scope.name, version: scope.version };
}

function cloneAttribute(attribute: ProfileAttribute): ProfileAttribute | null {
  if (!attribute || typeof attribute !== "object" || typeof attribute.key !== "string") return null;
  const value = normalizeProfileAttributeValue(attribute.value);
  return value.valid ? { key: attribute.key, value: value.value } : null;
}

function cloneAttributes(attributes: readonly ProfileAttribute[]): ProfileAttribute[] | null {
  if (!Array.isArray(attributes)) return null;
  const result: ProfileAttribute[] = [];
  const keys = new Set<string>();
  for (const attribute of attributes) {
    const cloned = cloneAttribute(attribute);
    if (!cloned || keys.has(cloned.key)) return null;
    keys.add(cloned.key);
    result.push(cloned);
  }
  return result.sort((left, right) => compareCodeUnits(left.key, right.key));
}

function cloneSummary(summary: ProfileSpanAttributeSummary): ProfileSpanAttributeSummary | null {
  if (!summary || typeof summary !== "object" || typeof summary.key !== "string") return null;
  if (summary.reducer === "single") {
    const value = normalizeProfileAttributeValue(summary.value);
    if (
      !value.valid ||
      !positiveSafeInteger(summary.observedCount) ||
      !nonnegativeSafeInteger(summary.conflictCount)
    )
      return null;
    return {
      key: summary.key,
      reducer: "single",
      value: value.value,
      observedCount: summary.observedCount,
      conflictCount: summary.conflictCount,
    };
  }
  if (summary.reducer === "distinct") {
    if (
      !positiveSafeInteger(summary.observedCount) ||
      !nonnegativeSafeInteger(summary.overflowCount) ||
      !Array.isArray(summary.values) ||
      summary.values.length > 16
    )
      return null;
    const values: { value: string | number | boolean; count: number }[] = [];
    const identities = new Set<string>();
    for (const entry of summary.values) {
      const value = normalizeProfileAttributeValue(entry.value);
      if (!value.valid || !positiveSafeInteger(entry.count)) return null;
      const identity = `${typeof value.value}:${String(value.value)}`;
      if (identities.has(identity)) return null;
      identities.add(identity);
      values.push({ value: value.value, count: entry.count });
    }
    if (
      values.reduce((total, entry) => total + entry.count, summary.overflowCount) !==
      summary.observedCount
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
  if (
    summary.reducer !== "min_max" ||
    !positiveSafeInteger(summary.observedCount) ||
    typeof summary.minimum !== "number" ||
    typeof summary.maximum !== "number" ||
    !Number.isFinite(summary.minimum) ||
    !Number.isFinite(summary.maximum) ||
    summary.minimum > summary.maximum
  )
    return null;
  return {
    key: summary.key,
    reducer: "min_max",
    minimum: normalizedNumber(summary.minimum),
    maximum: normalizedNumber(summary.maximum),
    observedCount: summary.observedCount,
  };
}

function cloneSpan(span: ProfileSpanAggregate): ProfileSpanAggregate | null {
  const scope = cloneScope(span.scope);
  if (
    !scope ||
    typeof span.name !== "string" ||
    !nonnegativeSafeInteger(span.callCount) ||
    !nonnegativeSafeInteger(span.errorCount) ||
    span.errorCount > span.callCount ||
    !finiteNonnegative(span.totalDurationSeconds) ||
    !finiteNonnegative(span.maxDurationSeconds) ||
    !Array.isArray(span.attributes)
  )
    return null;
  const attributes: ProfileSpanAttributeSummary[] = [];
  const keys = new Set<string>();
  for (const summary of span.attributes) {
    const cloned = cloneSummary(summary);
    if (!cloned || keys.has(cloned.key)) return null;
    keys.add(cloned.key);
    attributes.push(cloned);
  }
  attributes.sort((left, right) => compareCodeUnits(left.key, right.key));
  return {
    scope,
    name: span.name,
    callCount: span.callCount,
    errorCount: span.errorCount,
    totalDurationSeconds: normalizedNumber(span.totalDurationSeconds),
    maxDurationSeconds: normalizedNumber(span.maxDurationSeconds),
    attributes,
  };
}

function cloneCounter(point: ProfileCounterPoint): ProfileCounterPoint | null {
  const scope = cloneScope(point.scope);
  const attributes = cloneAttributes(point.attributes);
  if (
    !scope ||
    !attributes ||
    typeof point.name !== "string" ||
    typeof point.unit !== "string" ||
    !finiteNonnegative(point.value)
  )
    return null;
  return {
    scope,
    name: point.name,
    unit: point.unit,
    attributes,
    value: normalizedNumber(point.value),
  };
}

function cloneHistogram(point: ProfileHistogramPoint): ProfileHistogramPoint | null {
  const scope = cloneScope(point.scope);
  const attributes = cloneAttributes(point.attributes);
  if (
    !scope ||
    !attributes ||
    typeof point.name !== "string" ||
    typeof point.unit !== "string" ||
    !positiveSafeInteger(point.count) ||
    !finiteNonnegative(point.sum) ||
    (point.minimum !== null && !finiteNonnegative(point.minimum)) ||
    (point.maximum !== null && !finiteNonnegative(point.maximum)) ||
    (point.minimum !== null && point.maximum !== null && point.minimum > point.maximum) ||
    !Array.isArray(point.explicitBounds) ||
    !Array.isArray(point.bucketCounts) ||
    point.bucketCounts.length !== point.explicitBounds.length + 1
  )
    return null;
  if (
    point.explicitBounds.some((bound, index) => {
      const previous = point.explicitBounds[index - 1];
      return (
        typeof bound !== "number" ||
        !Number.isFinite(bound) ||
        (previous !== undefined && bound <= previous)
      );
    }) ||
    point.bucketCounts.some((count) => !nonnegativeSafeInteger(count)) ||
    point.bucketCounts.reduce((sum, count) => sum + count, 0) !== point.count
  )
    return null;
  return {
    scope,
    name: point.name,
    unit: point.unit,
    attributes,
    count: point.count,
    sum: normalizedNumber(point.sum),
    minimum: point.minimum === null ? null : normalizedNumber(point.minimum),
    maximum: point.maximum === null ? null : normalizedNumber(point.maximum),
    explicitBounds: point.explicitBounds.map(normalizedNumber),
    bucketCounts: [...point.bucketCounts],
  };
}

function compareAttributes(
  left: readonly ProfileAttribute[],
  right: readonly ProfileAttribute[],
): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftAttribute = left[index];
    const rightAttribute = right[index];
    if (!leftAttribute || !rightAttribute) break;
    const byKey = compareCodeUnits(leftAttribute.key, rightAttribute.key);
    if (byKey !== 0) return byKey;
    const byValue = compareProfileAttributeValues(leftAttribute.value, rightAttribute.value);
    if (byValue !== 0) return byValue;
  }
  return left.length - right.length;
}

function compareObservations(
  left: {
    scope: ProfileInstrumentationScope;
    name: string;
    attributes?: readonly ProfileAttribute[];
  },
  right: {
    scope: ProfileInstrumentationScope;
    name: string;
    attributes?: readonly ProfileAttribute[];
  },
): number {
  const byScope = compareProfileScopes(left.scope, right.scope);
  if (byScope !== 0) return byScope;
  const byName = compareCodeUnits(left.name, right.name);
  if (byName !== 0) return byName;
  return compareAttributes(left.attributes ?? [], right.attributes ?? []);
}

export class ProfileReportBuilder {
  readonly #diagnostics: BoundedDiagnosticAccumulator;

  constructor(diagnostics: BoundedDiagnosticAccumulator) {
    this.#diagnostics = diagnostics;
  }

  build(input: ProfileReportBuildInput): ProfileReport {
    const spans = this.#buildSignal(input.spans, "spans", cloneSpan);
    const counters = this.#buildSignal(input.counters, "counters", cloneCounter);
    const histograms = this.#buildSignal(input.histograms, "histograms", cloneHistogram);
    spans.values.sort((left, right) => {
      const byScope = compareProfileScopes(left.scope, right.scope);
      return byScope !== 0 ? byScope : compareCodeUnits(left.name, right.name);
    });
    counters.values.sort(compareObservations);
    histograms.values.sort(compareObservations);

    for (const signal of [spans, counters, histograms] as const) {
      if (signal.status !== "complete" && !this.#diagnostics.hasExplanation(signal.signal))
        this.#diagnostics.add({
          code: "lifecycle_failure",
          stage: "report_build",
          signal: signal.signal,
        });
    }

    return {
      schemaVersion: PROFILE_REPORT_SCHEMA_VERSION,
      signalStatus: {
        spans: spans.status,
        counters: counters.status,
        histograms: histograms.status,
      },
      spans: spans.values,
      counters: counters.values,
      histograms: histograms.values,
      diagnostics: this.#diagnostics.snapshot(),
    };
  }

  #buildSignal<Value>(
    input: ProfileSignalInput<Value>,
    signal: "spans" | "counters" | "histograms",
    clone: (value: Value) => Value | null,
  ): { signal: typeof signal; status: ProfileSignalStatus; values: Value[] } {
    if (input.status === "unavailable") return { signal, status: "unavailable", values: [] };
    const values: Value[] = [];
    let status = input.status;
    try {
      for (const value of input.values) {
        const cloned = clone(value);
        if (cloned) values.push(cloned);
        else {
          status = "partial";
          this.#diagnostics.add({
            code: "invalid_aggregation",
            stage: "report_build",
            signal,
          });
        }
      }
    } catch {
      status = "partial";
      this.#diagnostics.add({
        code: "invalid_aggregation",
        stage: "report_build",
        signal,
      });
    }
    return { signal, status, values };
  }
}
