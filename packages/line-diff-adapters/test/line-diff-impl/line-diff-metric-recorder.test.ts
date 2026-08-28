import { createMonotonicTiming, TELEMETRY_METRICS } from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";
import { describe, expect, test } from "vitest";

import {
  createLineDiffMetricRecorder,
  NOOP_LINE_DIFF_METRIC_RECORDER,
} from "../../src/line-diff-impl/line-diff-metric-recorder.js";
type Call = { name: string; value: number; attributes: unknown };
class FakeMeter {
  creations: { kind: string; name: string; options: unknown }[] = [];
  calls: Call[] = [];
  createCounter(name: string, options: unknown) {
    this.creations.push({ kind: "counter", name, options });
    return {
      add: (value: number, attributes: unknown) => this.calls.push({ name, value, attributes }),
    };
  }
  createHistogram(name: string, options: unknown) {
    this.creations.push({ kind: "histogram", name, options });
    return {
      record: (value: number, attributes: unknown) => this.calls.push({ name, value, attributes }),
    };
  }
}
const meter = (f: FakeMeter) => f as unknown as Meter;
const seq = (...v: number[]) => {
  let i = 0;
  return createMonotonicTiming(() => v[i++]!);
};
const ids = [
  "line_diff_compute_operation",
  "line_diff_compute_duration",
  "line_diff_compute_input_size",
] as const;
const attrs = { "gitlode.line_diff.compute.outcome": "success" };
describe("line diff metric recorder", () => {
  test("creates exactly the three cataloged instruments", () => {
    const fake = new FakeMeter();
    createLineDiffMetricRecorder(meter(fake));
    const expectedNames = ids.map(
      (id) => TELEMETRY_METRICS.find((metadata) => metadata.id === id)!.name,
    );
    expect(fake.creations).toHaveLength(ids.length);
    expect(fake.creations.map((creation) => creation.name).sort()).toEqual(
      [...expectedNames].sort(),
    );
  });
  test.each(ids)("creates %s with exact detached metadata", (id) => {
    const fake = new FakeMeter();
    createLineDiffMetricRecorder(meter(fake));
    const m = TELEMETRY_METRICS.find((x) => x.id === id)!;
    const matches = fake.creations.filter((creation) => creation.name === m.name);
    expect(matches).toHaveLength(1);
    const c = matches[0]!;
    expect(c).toEqual({
      kind: m.instrument,
      name: m.name,
      options:
        m.instrument === "histogram"
          ? {
              description: m.description,
              unit: m.unit,
              advice: { explicitBucketBoundaries: [...m.explicitBucketBoundaries] },
            }
          : { description: m.description, unit: m.unit },
    });
    if (m.instrument === "histogram") {
      const b = (c.options as { advice: { explicitBucketBoundaries: number[] } }).advice
        .explicitBucketBoundaries;
      expect(b).toEqual(m.explicitBucketBoundaries);
      expect(b).not.toBe(m.explicitBucketBoundaries);
    }
  });
  test("records operation, duration, zero size, and suppresses duplicate without creation", () => {
    const fake = new FakeMeter(),
      r = createLineDiffMetricRecorder(meter(fake), seq(0, 1000)),
      count = fake.creations.length,
      token = r.startCompute();
    r.completeCompute(token, "success", 0);
    r.completeCompute(token, "error", 9);
    expect(fake.calls).toEqual([
      { name: "gitlode.line_diff.compute.operation", value: 1, attributes: attrs },
      { name: "gitlode.line_diff.compute.duration", value: 1, attributes: attrs },
      { name: "gitlode.line_diff.compute.input.size", value: 0, attributes: attrs },
    ]);
    expect(fake.creations).toHaveLength(count);
  });
  const failures = [
    {
      label: "throwing start",
      timing: () =>
        createMonotonicTiming(() => {
          throw new Error("clock");
        }),
    },
    { label: "nonfinite completion", timing: () => seq(0, Infinity) },
  ];
  test.each(failures)("preserves operation and size for $label", ({ timing }) => {
    const fake = new FakeMeter(),
      r = createLineDiffMetricRecorder(meter(fake), timing()),
      token = r.startCompute();
    r.completeCompute(token, "success", 2);
    r.completeCompute(token, "success", 3);
    expect(fake.calls).toEqual([
      { name: "gitlode.line_diff.compute.operation", value: 1, attributes: attrs },
      { name: "gitlode.line_diff.compute.input.size", value: 2, attributes: attrs },
    ]);
  });
  test.each([-1, NaN, Infinity, -Infinity])("invalid input %s omits only size", (size) => {
    const fake = new FakeMeter(),
      r = createLineDiffMetricRecorder(meter(fake), seq(0, 1000));
    r.completeCompute(r.startCompute(), "success", size);
    expect(fake.calls).toEqual([
      { name: "gitlode.line_diff.compute.operation", value: 1, attributes: attrs },
      { name: "gitlode.line_diff.compute.duration", value: 1, attributes: attrs },
    ]);
  });
  test("no-op has shared token and all methods are harmless", () => {
    const a = NOOP_LINE_DIFF_METRIC_RECORDER.startCompute(),
      b = NOOP_LINE_DIFF_METRIC_RECORDER.startCompute();
    expect(a).toBe(b);
    expect(() => {
      NOOP_LINE_DIFF_METRIC_RECORDER.completeCompute(a, "success", 0);
      NOOP_LINE_DIFF_METRIC_RECORDER.completeCompute(a, "error", 1);
    }).not.toThrow();
  });
});
