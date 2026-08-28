import {
  getTelemetryAttributeMetadata,
  normalizeProfileAttributeValue,
  normalizeProfileInstrumentationScope,
  PROFILE_COLLECTION_LIMITS,
  TELEMETRY_METRICS,
} from "@gitlode/internal-contracts/telemetry";
import type {
  MetricObservationMetadata,
  ObservationAttributeMetadata,
  ProfileAttribute,
  ProfileCounterPoint,
  ProfileHistogramPoint,
  ProfileSignalStatus,
  TelemetryAttributeId,
} from "@gitlode/internal-contracts/telemetry";
import {
  AggregationType,
  DataPointType,
  InstrumentType,
  MetricReader,
} from "@opentelemetry/sdk-metrics";
import type {
  CollectionResult,
  Histogram,
  MetricData,
  ResourceMetrics,
  ViewOptions,
} from "@opentelemetry/sdk-metrics";

import type { BoundedDiagnosticAccumulator } from "./diagnostic-accumulator.js";

export interface LocalMetricSnapshot {
  readonly counterStatus: ProfileSignalStatus;
  readonly histogramStatus: ProfileSignalStatus;
  readonly counters: readonly ProfileCounterPoint[];
  readonly histograms: readonly ProfileHistogramPoint[];
}

export function createLocalMetricViews(): ViewOptions[] {
  return TELEMETRY_METRICS.filter(
    (
      metadata,
    ): metadata is Extract<(typeof TELEMETRY_METRICS)[number], { instrument: "histogram" }> =>
      metadata.instrument === "histogram",
  ).map((metadata) => ({
    instrumentName: metadata.name,
    instrumentType: InstrumentType.HISTOGRAM,
    instrumentUnit: metadata.unit,
    ...(metadata.scope.type === "core" ? { meterName: metadata.scope.name } : {}),
    aggregation: {
      type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
      options: {
        boundaries: [...metadata.explicitBucketBoundaries],
        recordMinMax: true,
      },
    },
  }));
}

function acceptedMetric(
  scopeName: string,
  metric: MetricData,
): MetricObservationMetadata | undefined {
  return TELEMETRY_METRICS.find(
    (candidate) =>
      candidate.name === metric.descriptor.name &&
      candidate.scope.type === "core" &&
      candidate.scope.name === scopeName,
  );
}

function acceptedAttribute(
  metadata: ObservationAttributeMetadata,
  value: unknown,
): ProfileAttribute["value"] | null {
  const normalized = normalizeProfileAttributeValue(value);
  if (!normalized.valid) return null;
  if (metadata.valueType === "boolean")
    return typeof normalized.value === "boolean" ? normalized.value : null;
  if (metadata.valueType === "integer") {
    if (typeof normalized.value !== "number" || !Number.isSafeInteger(normalized.value))
      return null;
    return normalized.value >= (metadata.numericConstraint?.minimum ?? -Infinity)
      ? normalized.value
      : null;
  }
  if (typeof normalized.value !== "string") return null;
  return normalized.value;
}

function attributesFor(
  attributes: Readonly<Record<string, unknown>>,
  metric: MetricObservationMetadata,
): ProfileAttribute[] | null {
  const permitted = new Map(
    metric.attributes.map((entry) => {
      const metadata = getTelemetryAttributeMetadata(entry.id as TelemetryAttributeId);
      return [metadata.key, { ...entry, metadata }] as const;
    }),
  );
  if (Object.keys(attributes).some((key) => !permitted.has(key as never))) return null;
  const result: ProfileAttribute[] = [];
  for (const { required, metadata } of permitted.values()) {
    const input = attributes[metadata.key];
    if (input === undefined) {
      if (required) return null;
      continue;
    }
    const value = acceptedAttribute(metadata, input);
    if (value === null) return null;
    result.push({ key: metadata.key, value });
  }
  result.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  return result;
}

function finiteNonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function validHistogram(value: Histogram, boundaries: readonly number[]): boolean {
  if (!positiveSafeInteger(value.count) || !finiteNonnegative(value.sum)) return false;
  if (value.min !== undefined && !finiteNonnegative(value.min)) return false;
  if (value.max !== undefined && !finiteNonnegative(value.max)) return false;
  if (value.min !== undefined && value.max !== undefined && value.min > value.max) return false;
  if (
    value.buckets.boundaries.length !== boundaries.length ||
    value.buckets.boundaries.some((boundary, index) => boundary !== boundaries[index])
  )
    return false;
  if (
    boundaries.some((boundary, index) => {
      const previous = boundaries[index - 1];
      return !Number.isFinite(boundary) || (previous !== undefined && boundary <= previous);
    })
  )
    return false;
  if (value.buckets.counts.length !== boundaries.length + 1) return false;
  if (value.buckets.counts.some((count) => !Number.isSafeInteger(count) || count < 0)) return false;
  return value.buckets.counts.reduce((sum, count) => sum + count, 0) === value.count;
}

function metricIdentity(
  scope: { name: string; version: string | null },
  name: string,
  attributes: readonly ProfileAttribute[],
): string {
  return JSON.stringify([scope.name, scope.version, name, attributes]);
}

export function convertLocalMetrics(
  resourceMetrics: ResourceMetrics,
  diagnostics: BoundedDiagnosticAccumulator,
): LocalMetricSnapshot {
  const counters: ProfileCounterPoint[] = [];
  const histograms: ProfileHistogramPoint[] = [];
  const retainedIdentities = new Set<string>();
  const acceptedPerInstrument = new Map<string, number>();
  let counterStatus: ProfileSignalStatus = "complete";
  let histogramStatus: ProfileSignalStatus = "complete";

  const invalid = (signal: "counters" | "histograms") => {
    if (signal === "counters") counterStatus = "partial";
    else histogramStatus = "partial";
    diagnostics.add({
      code: "invalid_aggregation",
      stage: "metric_collection",
      signal,
    });
  };
  const overflow = (signal: "counters" | "histograms") => {
    if (signal === "counters") counterStatus = "partial";
    else histogramStatus = "partial";
    diagnostics.add({
      code: "metric_point_overflow",
      stage: "metric_collection",
      signal,
    });
  };

  try {
    for (const scopeMetrics of resourceMetrics.scopeMetrics) {
      const scope = normalizeProfileInstrumentationScope(
        scopeMetrics.scope.name,
        scopeMetrics.scope.version,
      );
      for (const metric of scopeMetrics.metrics) {
        const metadata = acceptedMetric(scope.name, metric);
        if (!metadata) continue;
        const signal = metadata.instrument === "counter" ? "counters" : "histograms";
        const expectedType =
          metadata.instrument === "counter" ? DataPointType.SUM : DataPointType.HISTOGRAM;
        if (metric.dataPointType !== expectedType) {
          invalid(signal);
          continue;
        }
        const instrumentKey = JSON.stringify([scope.name, scope.version, metadata.name]);
        for (const point of metric.dataPoints) {
          try {
            const attributes = attributesFor(point.attributes, metadata);
            if (!attributes) {
              invalid(signal);
              continue;
            }
            const identity = metricIdentity(scope, metadata.name, attributes);
            if (retainedIdentities.has(identity)) {
              invalid(signal);
              continue;
            }
            const accepted = acceptedPerInstrument.get(instrumentKey) ?? 0;
            if (accepted >= PROFILE_COLLECTION_LIMITS.metricPointsPerInstrument) {
              overflow(signal);
              continue;
            }
            if (metadata.instrument === "counter" && metric.dataPointType === DataPointType.SUM) {
              if (!metric.isMonotonic || !finiteNonnegative(point.value)) {
                invalid("counters");
                continue;
              }
              counters.push({
                scope: { ...scope },
                name: metadata.name,
                unit: metadata.unit,
                attributes,
                value: Object.is(point.value, -0) ? 0 : point.value,
              });
            } else if (
              metadata.instrument === "histogram" &&
              metric.dataPointType === DataPointType.HISTOGRAM
            ) {
              const boundaries = metadata.explicitBucketBoundaries ?? [];
              const histogramValue = point.value as Histogram;
              if (!validHistogram(histogramValue, boundaries)) {
                invalid("histograms");
                continue;
              }
              histograms.push({
                scope: { ...scope },
                name: metadata.name,
                unit: metadata.unit,
                attributes,
                count: histogramValue.count,
                sum: Object.is(histogramValue.sum, -0) ? 0 : (histogramValue.sum ?? 0),
                minimum:
                  histogramValue.min === undefined
                    ? null
                    : Object.is(histogramValue.min, -0)
                      ? 0
                      : histogramValue.min,
                maximum:
                  histogramValue.max === undefined
                    ? null
                    : Object.is(histogramValue.max, -0)
                      ? 0
                      : histogramValue.max,
                explicitBounds: [...histogramValue.buckets.boundaries],
                bucketCounts: [...histogramValue.buckets.counts],
              });
            } else {
              invalid(signal);
              continue;
            }
            retainedIdentities.add(identity);
            acceptedPerInstrument.set(instrumentKey, accepted + 1);
          } catch {
            invalid(signal);
          }
        }
      }
    }
  } catch {
    counterStatus = "partial";
    histogramStatus = "partial";
    invalid("counters");
    invalid("histograms");
  }
  return { counterStatus, histogramStatus, counters, histograms };
}

export class LocalMetricReader extends MetricReader {
  async collectSnapshot(diagnostics: BoundedDiagnosticAccumulator): Promise<LocalMetricSnapshot> {
    let result: CollectionResult;
    try {
      result = await this.collect();
    } catch {
      diagnostics.add({
        code: "lifecycle_failure",
        stage: "metric_collection",
        signal: "counters",
      });
      diagnostics.add({
        code: "lifecycle_failure",
        stage: "metric_collection",
        signal: "histograms",
      });
      return {
        counterStatus: "unavailable",
        histogramStatus: "unavailable",
        counters: [],
        histograms: [],
      };
    }
    const snapshot = convertLocalMetrics(result.resourceMetrics, diagnostics);
    if (result.errors.length === 0) return snapshot;
    diagnostics.add({
      code: "lifecycle_failure",
      stage: "metric_collection",
      signal: "counters",
    });
    diagnostics.add({
      code: "lifecycle_failure",
      stage: "metric_collection",
      signal: "histograms",
    });
    return {
      ...snapshot,
      counterStatus: "partial",
      histogramStatus: "partial",
    };
  }

  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }
}
