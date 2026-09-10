import {
  createMonotonicTiming,
  getTelemetryAttributeMetadata,
  getTelemetryMetricMetadata,
  type MonotonicTiming,
  type TelemetryAttributeValue,
  type TimingToken,
} from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";
export type ProjectionFactType = TelemetryAttributeValue<"projection_fact_type">;
export type ProjectionOutcome = TelemetryAttributeValue<"projection_outcome">;
export interface BuiltInFactProjectorMetricRecorder {
  startProjection(): TimingToken;
  completeProjection(
    token: TimingToken,
    factType: ProjectionFactType,
    outcome: ProjectionOutcome,
  ): void;
}
const token = createMonotonicTiming().start(false);
export const NOOP_BUILT_IN_FACT_PROJECTOR_METRIC_RECORDER =
  Object.freeze<BuiltInFactProjectorMetricRecorder>({
    startProjection: () => token,
    completeProjection() {},
  });
export function createBuiltInFactProjectorMetricRecorder(
  meter: Meter,
  timing: MonotonicTiming = createMonotonicTiming(),
): BuiltInFactProjectorMetricRecorder {
  const m = getTelemetryMetricMetadata("projection_duration"),
    duration = meter.createHistogram(m.name, {
      description: m.description,
      unit: m.unit,
      advice: { explicitBucketBoundaries: [...m.explicitBucketBoundaries] },
    }),
    factKey = getTelemetryAttributeMetadata("projection_fact_type").key,
    outcomeKey = getTelemetryAttributeMetadata("projection_outcome").key;
  return {
    startProjection: () => timing.start(true),
    completeProjection(token, factType, outcome) {
      const c = timing.complete(token);
      if (c.firstCompletion && c.durationSeconds !== null)
        duration.record(c.durationSeconds, { [factKey]: factType, [outcomeKey]: outcome });
    },
  };
}
