import {
  createMonotonicTiming,
  TELEMETRY_ATTRIBUTES,
  TELEMETRY_METRICS,
  type MonotonicTiming,
  type TimingToken,
} from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";
type Outcome = Extract<
  (typeof TELEMETRY_ATTRIBUTES)[number],
  { id: "line_diff_compute_outcome" }
>["boundedValues"][number];
export type LineDiffComputeOutcome = Outcome;
export interface LineDiffMetricRecorder {
  startCompute(): TimingToken;
  completeCompute(token: TimingToken, outcome: Outcome, inputSizeBytes: number): void;
}
const token = createMonotonicTiming(() => 0).start(false);
export const NOOP_LINE_DIFF_METRIC_RECORDER: LineDiffMetricRecorder = Object.freeze({
  startCompute: () => token,
  completeCompute() {},
});
function metric<
  I extends
    | "line_diff_compute_operation"
    | "line_diff_compute_duration"
    | "line_diff_compute_input_size",
>(id: I) {
  const value = TELEMETRY_METRICS.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Missing telemetry metric metadata: ${id}`);
  return value as Extract<(typeof TELEMETRY_METRICS)[number], { id: I }>;
}
export function createLineDiffMetricRecorder(
  meter: Meter,
  timing: MonotonicTiming = createMonotonicTiming(),
): LineDiffMetricRecorder {
  const operationMetadata = metric("line_diff_compute_operation"),
    durationMetadata = metric("line_diff_compute_duration"),
    sizeMetadata = metric("line_diff_compute_input_size");
  const operation = meter.createCounter(operationMetadata.name, {
    description: operationMetadata.description,
    unit: operationMetadata.unit,
  });
  const duration = meter.createHistogram(durationMetadata.name, {
    description: durationMetadata.description,
    unit: durationMetadata.unit,
    advice: { explicitBucketBoundaries: durationMetadata.explicitBucketBoundaries },
  });
  const size = meter.createHistogram(sizeMetadata.name, {
    description: sizeMetadata.description,
    unit: sizeMetadata.unit,
    advice: { explicitBucketBoundaries: sizeMetadata.explicitBucketBoundaries },
  });
  const outcomeMetadata = TELEMETRY_ATTRIBUTES.find(
    (candidate) => candidate.id === "line_diff_compute_outcome",
  );
  if (!outcomeMetadata) throw new Error("Missing line diff outcome metadata");
  const outcomeKey = outcomeMetadata.key;
  return {
    startCompute: () => timing.start(true),
    completeCompute(token, outcome, inputSizeBytes) {
      const completion = timing.complete(token);
      if (!completion.recordable) return;
      const attributes = { [outcomeKey]: outcome };
      operation.add(1, attributes);
      duration.record(completion.durationSeconds, attributes);
      size.record(inputSizeBytes, attributes);
    },
  };
}
