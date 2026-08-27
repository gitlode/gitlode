import {
  createMonotonicTiming,
  type MonotonicTiming,
  type TimingToken,
} from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";

import {
  attribute,
  finishDuration,
  histogram,
  type AttributeValue,
} from "../telemetry/metric-recorder-support.js";
export type ProjectionFactType = AttributeValue<"projection_fact_type">;
export type ProjectionOutcome = AttributeValue<"projection_outcome">;
export interface BuiltInFactProjectorMetricRecorder {
  startProjection(): TimingToken;
  completeProjection(
    token: TimingToken,
    factType: ProjectionFactType,
    outcome: ProjectionOutcome,
  ): void;
}
const token = createMonotonicTiming(() => 0).start(false);
export const NOOP_BUILT_IN_FACT_PROJECTOR_METRIC_RECORDER: BuiltInFactProjectorMetricRecorder =
  Object.freeze({ startProjection: () => token, completeProjection() {} });
export function createBuiltInFactProjectorMetricRecorder(
  meter: Meter,
  timing: MonotonicTiming = createMonotonicTiming(),
): BuiltInFactProjectorMetricRecorder {
  const duration = histogram(meter, "projection_duration"),
    factKey = attribute("projection_fact_type").key,
    outcomeKey = attribute("projection_outcome").key;
  return {
    startProjection: () => timing.start(true),
    completeProjection(token, factType, outcome) {
      const c = finishDuration(timing, token);
      if (c.recordable)
        duration.record(c.durationSeconds, { [factKey]: factType, [outcomeKey]: outcome });
    },
  };
}
