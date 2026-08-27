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
export type FileChangeType = AttributeValue<"git_file_change_type">;
export type FileChangeExpansionOutcome = AttributeValue<"file_change_expansion_outcome">;
export type DiffSkipReason = AttributeValue<"file_change_diff_skip_reason">;
export interface FileChangeFactExpanderMetricRecorder {
  startExpansion(): TimingToken;
  completeExpansion(
    token: TimingToken,
    outcome: FileChangeExpansionOutcome,
    successfulSize?: number,
  ): void;
  recordExpanded(type: FileChangeType): void;
  recordDiffSkipped(reason: DiffSkipReason): void;
}
const noopToken = createMonotonicTiming(() => 0).start(false);
export const NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER: FileChangeFactExpanderMetricRecorder =
  Object.freeze({
    startExpansion: () => noopToken,
    completeExpansion() {},
    recordExpanded() {},
    recordDiffSkipped() {},
  });
export function createFileChangeFactExpanderMetricRecorder(
  meter: Meter,
  timing: MonotonicTiming = createMonotonicTiming(),
): FileChangeFactExpanderMetricRecorder {
  const duration = histogram(meter, "file_change_expansion_duration"),
    expanded = counter(meter, "file_change_expanded"),
    size = histogram(meter, "file_change_expansion_size"),
    skipped = counter(meter, "file_change_diff_skipped");
  const outcomeKey = attribute("file_change_expansion_outcome").key,
    typeKey = attribute("git_file_change_type").key,
    reasonKey = attribute("file_change_diff_skip_reason").key;
  return {
    startExpansion: () => timing.start(true),
    completeExpansion(token, outcome, successfulSize) {
      const c = finishDuration(timing, token);
      if (!c.recordable) return;
      duration.record(c.durationSeconds, { [outcomeKey]: outcome });
      if (outcome === "success" && successfulSize !== undefined) size.record(successfulSize);
    },
    recordExpanded(type) {
      expanded.add(1, { [typeKey]: type });
    },
    recordDiffSkipped(reason) {
      skipped.add(1, { [reasonKey]: reason });
    },
  };
}
