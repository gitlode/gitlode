import {
  createMonotonicTiming,
  getTelemetryAttributeMetadata,
  getTelemetryMetricMetadata,
  type MonotonicTiming,
  type TelemetryAttributeValue,
  type TimingToken,
} from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";
export type LineDiffComputeOutcome = TelemetryAttributeValue<"line_diff_compute_outcome">;
export interface LineDiffMetricRecorder {
  startCompute(): TimingToken;
  completeCompute(
    token: TimingToken,
    outcome: LineDiffComputeOutcome,
    inputSizeBytes: number,
  ): void;
}
const token = createMonotonicTiming().start(false);
export const NOOP_LINE_DIFF_METRIC_RECORDER = Object.freeze<LineDiffMetricRecorder>({
  startCompute: () => token,
  completeCompute() {},
});
export function createLineDiffMetricRecorder(
  meter: Meter,
  timing: MonotonicTiming = createMonotonicTiming(),
): LineDiffMetricRecorder {
  const om = getTelemetryMetricMetadata("line_diff_compute_operation"),
    dm = getTelemetryMetricMetadata("line_diff_compute_duration"),
    sm = getTelemetryMetricMetadata("line_diff_compute_input_size"),
    operation = meter.createCounter(om.name, { description: om.description, unit: om.unit }),
    duration = meter.createHistogram(dm.name, {
      description: dm.description,
      unit: dm.unit,
      advice: { explicitBucketBoundaries: [...dm.explicitBucketBoundaries] },
    }),
    size = meter.createHistogram(sm.name, {
      description: sm.description,
      unit: sm.unit,
      advice: { explicitBucketBoundaries: [...sm.explicitBucketBoundaries] },
    }),
    outcomeKey = getTelemetryAttributeMetadata("line_diff_compute_outcome").key;
  return {
    startCompute: () => timing.start(true),
    completeCompute(token, outcome, inputSizeBytes) {
      const c = timing.complete(token);
      if (!c.firstCompletion) return;
      const attrs = { [outcomeKey]: outcome };
      operation.add(1, attrs);
      if (c.durationSeconds !== null) duration.record(c.durationSeconds, attrs);
      if (Number.isFinite(inputSizeBytes) && inputSizeBytes >= 0)
        size.record(inputSizeBytes, attrs);
    },
  };
}
