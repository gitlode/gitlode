import {
  TELEMETRY_ATTRIBUTES,
  TELEMETRY_METRICS,
  type MonotonicTiming,
} from "@gitlode/internal-contracts/telemetry";
import type { Counter, Histogram, Meter } from "@opentelemetry/api";

export type AttributeId = (typeof TELEMETRY_ATTRIBUTES)[number]["id"];
export type AttributeValue<I extends AttributeId> =
  Extract<(typeof TELEMETRY_ATTRIBUTES)[number], { id: I }> extends {
    boundedValues: readonly (infer V extends string)[];
  }
    ? V
    : never;
export type MetricId = (typeof TELEMETRY_METRICS)[number]["id"];

export function attribute<I extends AttributeId>(id: I) {
  const result = TELEMETRY_ATTRIBUTES.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing telemetry attribute metadata: ${id}`);
  return result as Extract<(typeof TELEMETRY_ATTRIBUTES)[number], { id: I }>;
}

export function counter(meter: Meter, id: MetricId): Counter {
  const metric = metricMetadata(id);
  if (metric.instrument !== "counter") throw new Error(`Telemetry metric ${id} is not a counter`);
  return meter.createCounter(metric.name, { description: metric.description, unit: metric.unit });
}

export function histogram(meter: Meter, id: MetricId): Histogram {
  const metric = metricMetadata(id);
  if (metric.instrument !== "histogram")
    throw new Error(`Telemetry metric ${id} is not a histogram`);
  return meter.createHistogram(metric.name, {
    description: metric.description,
    unit: metric.unit,
    advice: { explicitBucketBoundaries: metric.explicitBucketBoundaries },
  });
}

function metricMetadata<I extends MetricId>(id: I) {
  const result = TELEMETRY_METRICS.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing telemetry metric metadata: ${id}`);
  return result;
}

export function finishDuration(
  timing: MonotonicTiming,
  token: Parameters<MonotonicTiming["complete"]>[0],
) {
  return timing.complete(token);
}
