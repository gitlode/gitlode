import { createMonotonicTiming, TELEMETRY_METRICS } from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";
import { expect, test } from "vitest";

import {
  createLineDiffMetricRecorder,
  NOOP_LINE_DIFF_METRIC_RECORDER,
} from "../../src/line-diff-impl/line-diff-metric-recorder.js";
test("creates and atomically completes the three line-diff instruments once", () => {
  const creations: { kind: string; name: string; options: unknown }[] = [],
    calls: { name: string; value: number; attributes: Record<string, string> }[] = [],
    meter = {
      createCounter(name: string, options: unknown) {
        creations.push({ kind: "counter", name, options });
        return {
          add: (value: number, attributes: Record<string, string>) =>
            calls.push({ name, value, attributes }),
        };
      },
      createHistogram(name: string, options: unknown) {
        creations.push({ kind: "histogram", name, options });
        return {
          record: (value: number, attributes: Record<string, string>) =>
            calls.push({ name, value, attributes }),
        };
      },
    } as unknown as Meter;
  let now = 5;
  const recorder = createLineDiffMetricRecorder(
      meter,
      createMonotonicTiming(() => now),
    ),
    token = recorder.startCompute();
  now = 5;
  recorder.completeCompute(token, "success", 0);
  recorder.completeCompute(token, "error", 9);
  expect(creations.map((x) => x.name)).toEqual(
    [
      "line_diff_compute_operation",
      "line_diff_compute_duration",
      "line_diff_compute_input_size",
    ].map((id) => TELEMETRY_METRICS.find((x) => x.id === id)!.name),
  );
  expect(calls).toHaveLength(3);
  expect(calls.map((x) => x.value)).toEqual([1, 0, 0]);
  expect(calls.every((x) => x.attributes["gitlode.line_diff.compute.outcome"] === "success")).toBe(
    true,
  );
});
test("no-op does not read a clock", () => {
  let reads = 0;
  createMonotonicTiming(() => ++reads);
  const token = NOOP_LINE_DIFF_METRIC_RECORDER.startCompute();
  NOOP_LINE_DIFF_METRIC_RECORDER.completeCompute(token, "error", 0);
  expect(reads).toBe(0);
});
