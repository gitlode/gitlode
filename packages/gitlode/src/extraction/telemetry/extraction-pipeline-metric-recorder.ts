import {
  createMonotonicTiming,
  getTelemetryAttributeMetadata,
  getTelemetryMetricMetadata,
  type MonotonicTiming,
  type TelemetryAttributeValue,
  type TimingToken,
} from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";

export type ExtractionGranularity = TelemetryAttributeValue<"extraction_granularity">;
export type OutputWriteOutcome = TelemetryAttributeValue<"output_write_outcome">;
export interface ExtractionPipelineMetricRecorder {
  recordCommitAccepted(granularity: ExtractionGranularity): void;
  startOutputWrite(): TimingToken;
  completeOutputWrite(
    token: TimingToken,
    granularity: ExtractionGranularity,
    outcome: OutputWriteOutcome,
  ): void;
}
const noop = createMonotonicTiming().start(false);
export const NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER =
  Object.freeze<ExtractionPipelineMetricRecorder>({
    recordCommitAccepted() {},
    startOutputWrite: () => noop,
    completeOutputWrite() {},
  });
export function createExtractionPipelineMetricRecorder(
  meter: Meter,
  timing: MonotonicTiming = createMonotonicTiming(),
): ExtractionPipelineMetricRecorder {
  const a = getTelemetryMetricMetadata("extraction_commit_accepted"),
    w = getTelemetryMetricMetadata("output_write_record"),
    d = getTelemetryMetricMetadata("output_write_duration");
  const accepted = meter.createCounter(a.name, { description: a.description, unit: a.unit }),
    written = meter.createCounter(w.name, { description: w.description, unit: w.unit }),
    duration = meter.createHistogram(d.name, {
      description: d.description,
      unit: d.unit,
      advice: { explicitBucketBoundaries: [...d.explicitBucketBoundaries] },
    });
  const granularityKey = getTelemetryAttributeMetadata("extraction_granularity").key,
    outcomeKey = getTelemetryAttributeMetadata("output_write_outcome").key;
  return {
    recordCommitAccepted(g) {
      accepted.add(1, { [granularityKey]: g });
    },
    startOutputWrite: () => timing.start(true),
    completeOutputWrite(token, g, outcome) {
      const c = timing.complete(token);
      if (!c.firstCompletion) return;
      const attrs = { [granularityKey]: g, [outcomeKey]: outcome };
      if (c.durationSeconds !== null) duration.record(c.durationSeconds, attrs);
      if (outcome === "success") written.add(1, { [granularityKey]: g });
    },
  };
}
