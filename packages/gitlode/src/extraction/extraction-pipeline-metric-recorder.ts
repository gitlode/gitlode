import {
  createMonotonicTiming,
  type MonotonicTiming,
  type TimingToken,
} from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";

import {
  attribute,
  counter,
  finishDuration,
  histogram,
  type AttributeValue,
} from "../telemetry/metric-recorder-support.js";

export type ExtractionGranularity = AttributeValue<"extraction_granularity">;
export type OutputWriteOutcome = AttributeValue<"output_write_outcome">;
export interface ExtractionPipelineMetricRecorder {
  recordCommitAccepted(granularity: ExtractionGranularity): void;
  startOutputWrite(): TimingToken;
  completeOutputWrite(
    token: TimingToken,
    granularity: ExtractionGranularity,
    outcome: OutputWriteOutcome,
  ): void;
}
const noop = createMonotonicTiming(() => 0).start(false);
export const NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER: ExtractionPipelineMetricRecorder =
  Object.freeze({
    recordCommitAccepted() {},
    startOutputWrite: () => noop,
    completeOutputWrite() {},
  });
export function createExtractionPipelineMetricRecorder(
  meter: Meter,
  timing: MonotonicTiming = createMonotonicTiming(),
): ExtractionPipelineMetricRecorder {
  const accepted = counter(meter, "extraction_commit_accepted");
  const written = counter(meter, "output_write_record");
  const duration = histogram(meter, "output_write_duration");
  const granularityKey = attribute("extraction_granularity").key;
  const outcomeKey = attribute("output_write_outcome").key;
  return {
    recordCommitAccepted(granularity) {
      accepted.add(1, { [granularityKey]: granularity });
    },
    startOutputWrite() {
      return timing.start(true);
    },
    completeOutputWrite(token, granularity, outcome) {
      const completion = finishDuration(timing, token);
      if (!completion.recordable) return;
      const attributes = { [granularityKey]: granularity, [outcomeKey]: outcome };
      duration.record(completion.durationSeconds, attributes);
      if (outcome === "success") written.add(1, { [granularityKey]: granularity });
    },
  };
}
