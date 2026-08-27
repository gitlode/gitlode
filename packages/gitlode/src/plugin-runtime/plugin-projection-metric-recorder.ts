import {
  createMonotonicTiming,
  type MonotonicTiming,
  type TimingToken,
} from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";

import type { ProjectionFactType } from "../extraction/built-in-fact-projector-metric-recorder.js";
import {
  attribute,
  counter,
  finishDuration,
  histogram,
  type AttributeValue,
} from "../telemetry/metric-recorder-support.js";
export type PluginProjectionOutcome = AttributeValue<"plugin_projection_outcome">;
export interface PluginProjectionMetricRecorder {
  startProjection(): TimingToken;
  completeProjection(
    token: TimingToken,
    factType: ProjectionFactType,
    outcome: PluginProjectionOutcome,
  ): void;
}
const token = createMonotonicTiming(() => 0).start(false);
export const NOOP_PLUGIN_PROJECTION_METRIC_RECORDER: PluginProjectionMetricRecorder = Object.freeze(
  { startProjection: () => token, completeProjection() {} },
);
export function createPluginProjectionMetricRecorder(
  meter: Meter,
  timing: MonotonicTiming = createMonotonicTiming(),
): PluginProjectionMetricRecorder {
  const operations = counter(meter, "plugin_projection_operation"),
    duration = histogram(meter, "plugin_projection_duration"),
    factKey = attribute("projection_fact_type").key,
    outcomeKey = attribute("plugin_projection_outcome").key;
  return {
    startProjection: () => timing.start(true),
    completeProjection(token, factType, outcome) {
      const c = finishDuration(timing, token);
      if (!c.recordable) return;
      const attributes = { [factKey]: factType, [outcomeKey]: outcome };
      operations.add(1, attributes);
      duration.record(c.durationSeconds, attributes);
    },
  };
}
