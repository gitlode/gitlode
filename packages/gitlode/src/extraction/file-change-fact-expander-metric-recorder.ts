import {
  createMonotonicTiming,
  getTelemetryAttributeMetadata,
  getTelemetryMetricMetadata,
  type MonotonicTiming,
  type TelemetryAttributeValue,
  type TimingToken,
} from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";
export type FileChangeType = TelemetryAttributeValue<"git_file_change_type">;
export type FileChangeExpansionOutcome = TelemetryAttributeValue<"file_change_expansion_outcome">;
export type DiffSkipReason = TelemetryAttributeValue<"file_change_diff_skip_reason">;
export type FileChangeExpansionCompletion =
  | { readonly outcome: "success"; readonly size: number }
  | { readonly outcome: "error" };
export interface FileChangeFactExpanderMetricRecorder {
  startExpansion(): TimingToken;
  completeExpansion(token: TimingToken, completion: FileChangeExpansionCompletion): void;
  recordExpanded(type: FileChangeType): void;
  recordDiffSkipped(reason: DiffSkipReason): void;
}
const noopToken = createMonotonicTiming().start(false);
export const NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER =
  Object.freeze<FileChangeFactExpanderMetricRecorder>({
    startExpansion: () => noopToken,
    completeExpansion() {},
    recordExpanded() {},
    recordDiffSkipped() {},
  });
export function createFileChangeFactExpanderMetricRecorder(
  meter: Meter,
  timing: MonotonicTiming = createMonotonicTiming(),
): FileChangeFactExpanderMetricRecorder {
  const dm = getTelemetryMetricMetadata("file_change_expansion_duration"),
    em = getTelemetryMetricMetadata("file_change_expanded"),
    sm = getTelemetryMetricMetadata("file_change_expansion_size"),
    km = getTelemetryMetricMetadata("file_change_diff_skipped");
  const duration = meter.createHistogram(dm.name, {
      description: dm.description,
      unit: dm.unit,
      advice: { explicitBucketBoundaries: [...dm.explicitBucketBoundaries] },
    }),
    expanded = meter.createCounter(em.name, { description: em.description, unit: em.unit }),
    size = meter.createHistogram(sm.name, {
      description: sm.description,
      unit: sm.unit,
      advice: { explicitBucketBoundaries: [...sm.explicitBucketBoundaries] },
    }),
    skipped = meter.createCounter(km.name, { description: km.description, unit: km.unit });
  const outcomeKey = getTelemetryAttributeMetadata("file_change_expansion_outcome").key,
    typeKey = getTelemetryAttributeMetadata("git_file_change_type").key,
    reasonKey = getTelemetryAttributeMetadata("file_change_diff_skip_reason").key;
  return {
    startExpansion: () => timing.start(true),
    completeExpansion(token, completion) {
      const c = timing.complete(token);
      if (!c.firstCompletion) return;
      if (c.durationSeconds !== null)
        duration.record(c.durationSeconds, { [outcomeKey]: completion.outcome });
      if (
        completion.outcome === "success" &&
        Number.isFinite(completion.size) &&
        completion.size >= 0
      )
        size.record(completion.size);
    },
    recordExpanded(type) {
      expanded.add(1, { [typeKey]: type });
    },
    recordDiffSkipped(reason) {
      skipped.add(1, { [reasonKey]: reason });
    },
  };
}
