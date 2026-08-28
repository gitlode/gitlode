import {
  createMonotonicTiming,
  getTelemetryAttributeMetadata,
  getTelemetryMetricMetadata,
  type MonotonicTiming,
  type TelemetryAttributeValue,
  type TimingToken,
} from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";
type ProjectionFactType = TelemetryAttributeValue<"projection_fact_type">;
export type PluginProjectionOutcome = TelemetryAttributeValue<"plugin_projection_outcome">;
export interface PluginProjectionMetricRecorder {
  startProjection(): TimingToken;
  completeProjection(
    token: TimingToken,
    factType: ProjectionFactType,
    outcome: PluginProjectionOutcome,
  ): void;
}
const token = createMonotonicTiming().start(false);
export const NOOP_PLUGIN_PROJECTION_METRIC_RECORDER = Object.freeze<PluginProjectionMetricRecorder>(
  { startProjection: () => token, completeProjection() {} },
);
export function createPluginProjectionMetricRecorder(
  meter: Meter,
  timing: MonotonicTiming = createMonotonicTiming(),
): PluginProjectionMetricRecorder {
  const om = getTelemetryMetricMetadata("plugin_projection_operation"),
    dm = getTelemetryMetricMetadata("plugin_projection_duration"),
    operations = meter.createCounter(om.name, { description: om.description, unit: om.unit }),
    duration = meter.createHistogram(dm.name, {
      description: dm.description,
      unit: dm.unit,
      advice: { explicitBucketBoundaries: [...dm.explicitBucketBoundaries] },
    }),
    factKey = getTelemetryAttributeMetadata("projection_fact_type").key,
    outcomeKey = getTelemetryAttributeMetadata("plugin_projection_outcome").key;
  return {
    startProjection: () => timing.start(true),
    completeProjection(token, factType, outcome) {
      const c = timing.complete(token);
      if (!c.firstCompletion) return;
      const attrs = { [factKey]: factType, [outcomeKey]: outcome };
      operations.add(1, attrs);
      if (c.durationSeconds !== null) duration.record(c.durationSeconds, attrs);
    },
  };
}
