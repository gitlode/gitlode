import {
  compareProfileAttributeValues,
  compareProfileScopes,
  getTelemetryAttributeMetadata,
  normalizeProfileAttributeValue,
  normalizeProfileInstrumentationScope,
  PROFILE_COLLECTION_LIMITS,
  CORE_INSTRUMENTATION_SCOPES,
  TELEMETRY_SPANS,
} from "@gitlode/internal-contracts/telemetry";
import type {
  ObservationAttributeMetadata,
  ProfileAttributeValue,
  ProfileSignalStatus,
  ProfileSpanAggregate,
  ProfileSpanAttributeSummary,
} from "@gitlode/internal-contracts/telemetry";
import { SpanStatusCode } from "@opentelemetry/api";
import type { Context } from "@opentelemetry/api";
import type { ReadableSpan, Span, SpanProcessor } from "@opentelemetry/sdk-trace-base";

import { FirstAcceptedBoundedMap } from "./bounded-retention.js";
import type {
  BoundedDiagnosticAccumulator,
  ProfileDiagnosticInput,
} from "./diagnostic-accumulator.js";

type MutableSummary =
  | {
      key: string;
      reducer: "single";
      value: ProfileAttributeValue;
      observedCount: number;
      conflictCount: number;
    }
  | {
      key: string;
      reducer: "distinct";
      values: FirstAcceptedBoundedMap<string, { value: ProfileAttributeValue; count: number }>;
      observedCount: number;
      overflowCount: number;
    }
  | {
      key: string;
      reducer: "min_max";
      minimum: number;
      maximum: number;
      observedCount: number;
    };
interface MutableSpanAggregate {
  scope: { name: string; version: string | null };
  name: string;
  callCount: number;
  errorCount: number;
  totalDurationSeconds: number;
  maxDurationSeconds: number;
  durationContributionCount: number;
  attributes: Map<string, MutableSummary>;
}

const scalarKey = (value: ProfileAttributeValue): string =>
  `${typeof value}:${typeof value === "number" && Object.is(value, -0) ? 0 : String(value)}`;

function acceptedAttributeValue(
  metadata: ObservationAttributeMetadata,
  input: unknown,
): ProfileAttributeValue | null {
  const normalized = normalizeProfileAttributeValue(input);
  if (!normalized.valid) return null;
  const value = normalized.value;
  if (metadata.valueType === "boolean") return typeof value === "boolean" ? value : null;
  if (metadata.valueType === "integer") {
    if (typeof value !== "number" || !Number.isSafeInteger(value)) return null;
    return value >= (metadata.numericConstraint?.minimum ?? -Infinity) ? value : null;
  }
  if (typeof value !== "string") return null;
  return metadata.boundedValues && !metadata.boundedValues.includes(value) ? null : value;
}

function allowedAttributes(span: ReadableSpan): readonly ObservationAttributeMetadata[] {
  const catalogSpan = TELEMETRY_SPANS.find((candidate) => {
    if (candidate.name !== span.name) return false;
    if (candidate.scope.type === "core")
      return candidate.scope.name === span.instrumentationScope.name;
    return !CORE_INSTRUMENTATION_SCOPES.includes(
      span.instrumentationScope.name as (typeof CORE_INSTRUMENTATION_SCOPES)[number],
    );
  });
  if (!catalogSpan) return [];
  const ids = new Set(Object.values(catalogSpan.attributes).flat());
  return [...ids].map((id) => getTelemetryAttributeMetadata(id));
}

function durationSeconds(span: ReadableSpan): number | null {
  const [seconds, nanoseconds] = span.duration;
  if (
    !Number.isSafeInteger(seconds) ||
    !Number.isSafeInteger(nanoseconds) ||
    seconds < 0 ||
    nanoseconds < 0 ||
    nanoseconds >= 1_000_000_000
  )
    return null;
  const duration = seconds + nanoseconds / 1_000_000_000;
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

export interface LocalSpanSnapshot {
  readonly status: ProfileSignalStatus;
  readonly spans: readonly ProfileSpanAggregate[];
}

export class LocalSpanProcessor implements SpanProcessor {
  readonly #aggregates = new FirstAcceptedBoundedMap<string, MutableSpanAggregate>(
    PROFILE_COLLECTION_LIMITS.spanGroups,
  );
  readonly #diagnostics: BoundedDiagnosticAccumulator;
  #partial = false;

  constructor(diagnostics: BoundedDiagnosticAccumulator) {
    this.#diagnostics = diagnostics;
  }

  onStart(_span: Span, _parentContext: Context): void {}

  onEnd(span: ReadableSpan): void {
    try {
      const scope = normalizeProfileInstrumentationScope(
        span.instrumentationScope.name,
        span.instrumentationScope.version,
      );
      const key = JSON.stringify([scope.name, scope.version, span.name]);
      const acceptance = this.#aggregates.accept(key, () => ({
        scope,
        name: span.name,
        callCount: 0,
        errorCount: 0,
        totalDurationSeconds: 0,
        maxDurationSeconds: 0,
        durationContributionCount: 0,
        attributes: new Map(),
      }));
      if (!acceptance.accepted) {
        this.#recordIssue({
          code: "span_group_overflow",
          stage: "span_aggregation",
          target: { type: "observation", scope, kind: "span", name: span.name },
          signalCoverage: ["span"],
          effects: ["missing_observations"],
          extent: "unidentified_subset",
          lossQuantity: {
            descriptor: "span_groups",
            unit: "groups",
            value: 1,
            relationship: "overlapping_or_unknown",
          },
        });
        return;
      }
      const aggregate = acceptance.value;
      aggregate.callCount += 1;
      if (span.status.code === SpanStatusCode.ERROR) aggregate.errorCount += 1;
      const duration = durationSeconds(span);
      if (duration === null)
        this.#recordIssue({
          code: "invalid_aggregation",
          stage: "span_aggregation",
          target: { type: "observation", scope, kind: "span", name: span.name },
          signalCoverage: ["span"],
          effects: ["incomplete_measurement_fields"],
          extent: "unidentified_subset",
          affectedFields: [{ kind: "span", fields: ["total", "avg", "max"] }],
          lossQuantity: {
            descriptor: "span_duration_contributions",
            unit: "contributions",
            value: 1,
            relationship: "disjoint",
          },
        });
      else {
        const total = aggregate.totalDurationSeconds + duration;
        if (!Number.isFinite(total))
          this.#recordIssue({
            code: "invalid_aggregation",
            stage: "span_aggregation",
            target: { type: "observation", scope, kind: "span", name: span.name },
            signalCoverage: ["span"],
            effects: ["incomplete_measurement_fields"],
            extent: "unidentified_subset",
            affectedFields: [{ kind: "span", fields: ["total", "avg", "max"] }],
            lossQuantity: {
              descriptor: "span_duration_contributions",
              unit: "contributions",
              value: 1,
              relationship: "disjoint",
            },
          });
        else {
          aggregate.totalDurationSeconds = Object.is(total, -0) ? 0 : total;
          aggregate.maxDurationSeconds = Math.max(aggregate.maxDurationSeconds, duration);
          aggregate.durationContributionCount += 1;
        }
      }
      for (const metadata of allowedAttributes(span)) {
        const input = span.attributes[metadata.key];
        if (input === undefined) continue;
        const value = acceptedAttributeValue(metadata, input);
        if (value === null) {
          this.#recordIssue({
            code: "invalid_aggregation",
            stage: "span_aggregation",
            target: { type: "observation", scope, kind: "span", name: span.name },
            signalCoverage: ["span"],
            effects: ["missing_attribute_detail"],
            extent: "unidentified_subset",
            attributeKey: { type: "exact", key: metadata.key },
            lossQuantity: {
              descriptor: "span_attribute_values",
              unit: "values",
              value: 1,
              relationship: "disjoint",
            },
          });
          continue;
        }
        this.#reduceAttribute(aggregate, metadata, value);
      }
    } catch {
      this.#recordIssue({
        code: "invalid_aggregation",
        stage: "span_aggregation",
        target: { type: "report" },
        signalCoverage: ["span"],
        effects: ["unknown_collection_coverage"],
        extent: "unidentified_subset",
      });
    }
  }

  #recordIssue(input: ProfileDiagnosticInput): void {
    this.#partial = true;
    this.#diagnostics.add(input);
  }

  #reduceAttribute(
    aggregate: MutableSpanAggregate,
    metadata: ObservationAttributeMetadata,
    value: ProfileAttributeValue,
  ): void {
    const current = aggregate.attributes.get(metadata.key);
    if (!current) {
      if (metadata.profileReducer === "single") {
        aggregate.attributes.set(metadata.key, {
          key: metadata.key,
          reducer: "single",
          value,
          observedCount: 1,
          conflictCount: 0,
        });
      } else if (metadata.profileReducer === "distinct") {
        const values = new FirstAcceptedBoundedMap<
          string,
          { value: ProfileAttributeValue; count: number }
        >(PROFILE_COLLECTION_LIMITS.distinctSpanAttributeValuesPerAttribute);
        values.accept(scalarKey(value), () => ({ value, count: 1 }));
        aggregate.attributes.set(metadata.key, {
          key: metadata.key,
          reducer: "distinct",
          values,
          observedCount: 1,
          overflowCount: 0,
        });
      } else {
        aggregate.attributes.set(metadata.key, {
          key: metadata.key,
          reducer: "min_max",
          minimum: value as number,
          maximum: value as number,
          observedCount: 1,
        });
      }
      return;
    }
    if (current.reducer === "single") {
      if (compareProfileAttributeValues(current.value, value) === 0) current.observedCount += 1;
      else {
        current.conflictCount += 1;
        this.#partial = true;
        this.#diagnostics.add({
          code: "attribute_reducer_conflict",
          stage: "span_aggregation",
          target: {
            type: "observation",
            scope: aggregate.scope,
            kind: "span",
            name: aggregate.name,
          },
          signalCoverage: ["span"],
          effects: ["missing_attribute_detail"],
          extent: "unidentified_subset",
          attributeKey: { type: "exact", key: metadata.key },
          lossQuantity: {
            descriptor: "span_attribute_values",
            unit: "values",
            value: 1,
            relationship: "disjoint",
          },
        });
      }
      return;
    }
    if (current.reducer === "distinct") {
      current.observedCount += 1;
      const key = scalarKey(value);
      const acceptance = current.values.accept(key, () => ({ value, count: 0 }));
      if (acceptance.accepted) acceptance.value.count += 1;
      else {
        current.overflowCount += 1;
        this.#partial = true;
        this.#diagnostics.add({
          code: "span_attribute_value_overflow",
          stage: "span_aggregation",
          target: {
            type: "observation",
            scope: aggregate.scope,
            kind: "span",
            name: aggregate.name,
          },
          signalCoverage: ["span"],
          effects: ["missing_attribute_detail"],
          extent: "unidentified_subset",
          attributeKey: { type: "exact", key: metadata.key },
          lossQuantity: {
            descriptor: "span_attribute_values",
            unit: "values",
            value: 1,
            relationship: "disjoint",
          },
        });
      }
      return;
    }
    const numeric = value as number;
    current.minimum = Math.min(current.minimum, numeric);
    current.maximum = Math.max(current.maximum, numeric);
    current.observedCount += 1;
  }

  snapshot(): LocalSpanSnapshot {
    try {
      const spans = [...this.#aggregates.values()].map((aggregate): ProfileSpanAggregate => ({
        scope: { ...aggregate.scope },
        name: aggregate.name,
        callCount: aggregate.callCount,
        errorCount: aggregate.errorCount,
        totalDurationSeconds: aggregate.totalDurationSeconds,
        maxDurationSeconds: aggregate.maxDurationSeconds,
        durationContributionCount: aggregate.durationContributionCount,
        unavailableFields: [],
        attributes: [...aggregate.attributes.values()]
          .map((summary): ProfileSpanAttributeSummary => {
            if (summary.reducer === "distinct")
              return {
                key: summary.key,
                reducer: summary.reducer,
                values: [...summary.values.values()]
                  .map((entry) => ({ ...entry }))
                  .sort((left, right) => compareProfileAttributeValues(left.value, right.value)),
                observedCount: summary.observedCount,
                overflowCount: summary.overflowCount,
              };
            return { ...summary };
          })
          .sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0)),
      }));
      spans.sort((left, right) => {
        const scope = compareProfileScopes(left.scope, right.scope);
        return scope !== 0 ? scope : left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
      });
      return { status: this.#partial ? "partial" : "complete", spans };
    } catch {
      this.#recordIssue({
        code: "invalid_aggregation",
        stage: "span_aggregation",
        target: { type: "report" },
        signalCoverage: ["span"],
        effects: ["unknown_collection_coverage"],
        extent: "unidentified_subset",
      });
      return { status: "partial", spans: [] };
    }
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
