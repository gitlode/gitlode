import { createMonotonicTiming, TELEMETRY_METRICS } from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";
import type { diffLines as DiffLines } from "diff";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createLineDiffMetricRecorder,
  JsLineDiffCalculator,
  NOOP_LINE_DIFF_METRIC_RECORDER,
} from "../../src/line-diff-impl/index.js";

const diffModule = vi.hoisted(() => ({
  defaultImplementation: undefined as unknown as typeof DiffLines,
  diffLines: vi.fn<typeof DiffLines>(),
}));

vi.mock("diff", async (importOriginal) => {
  const actual = await importOriginal<{ diffLines: typeof DiffLines }>();
  diffModule.defaultImplementation = actual.diffLines;
  diffModule.diffLines.mockImplementation(actual.diffLines);
  return { ...actual, diffLines: diffModule.diffLines };
});

type MetricCall = { readonly name: string; readonly value: number; readonly attributes: unknown };

class RecordingMeter {
  readonly creations: Array<{
    readonly kind: string;
    readonly name: string;
    readonly options: unknown;
  }> = [];
  readonly calls: MetricCall[] = [];

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

const encoder = new TextEncoder();
const asMeter = (meter: RecordingMeter) => meter as unknown as Meter;
const timing = (...values: number[]) => {
  let index = 0;
  return createMonotonicTiming(() => values[index++]!);
};
const metricIds = [
  "line_diff_compute_operation",
  "line_diff_compute_duration",
  "line_diff_compute_input_size",
] as const;
const successAttributes = { "gitlode.line_diff.compute.outcome": "success" };
const errorAttributes = { "gitlode.line_diff.compute.outcome": "error" };

function createCalculator(meter: RecordingMeter, clockValues: number[]) {
  return new JsLineDiffCalculator({
    metricRecorder: createLineDiffMetricRecorder(asMeter(meter), timing(...clockValues)),
  });
}

afterEach(() => {
  diffModule.diffLines.mockReset();
  diffModule.diffLines.mockImplementation(diffModule.defaultImplementation);
});

describe("JsLineDiffCalculator metric ownership", () => {
  it("records a non-empty successful computation with exact catalog instruments and call order", () => {
    const meter = new RecordingMeter();
    const calculator = createCalculator(meter, [100, 350]);
    const before = encoder.encode("old\n");
    const after = encoder.encode("new\nadded\n");

    expect(calculator.computeLineDiff(before, after)).toEqual({ additions: 2, deletions: 1 });

    expect(meter.creations).toHaveLength(3);
    for (const id of metricIds) {
      const metadata = TELEMETRY_METRICS.find((candidate) => candidate.id === id)!;
      const creations = meter.creations.filter(({ name }) => name === metadata.name);
      expect(creations).toHaveLength(1);
      expect(creations[0]).toEqual({
        kind: metadata.instrument,
        name: metadata.name,
        options:
          metadata.instrument === "histogram"
            ? {
                description: metadata.description,
                unit: metadata.unit,
                advice: { explicitBucketBoundaries: [...metadata.explicitBucketBoundaries] },
              }
            : { description: metadata.description, unit: metadata.unit },
      });
      if (metadata.instrument === "histogram") {
        const boundaries = (
          creations[0]!.options as { advice: { explicitBucketBoundaries: number[] } }
        ).advice.explicitBucketBoundaries;
        expect(boundaries).not.toBe(metadata.explicitBucketBoundaries);
      }
    }
    expect(meter.calls).toEqual([
      {
        name: "gitlode.line_diff.compute.operation",
        value: 1,
        attributes: successAttributes,
      },
      {
        name: "gitlode.line_diff.compute.duration",
        value: 0.25,
        attributes: successAttributes,
      },
      {
        name: "gitlode.line_diff.compute.input.size",
        value: before.byteLength + after.byteLength,
        attributes: successAttributes,
      },
    ]);
  });

  it("records zero combined input size when both inputs are empty", () => {
    const meter = new RecordingMeter();
    const calculator = createCalculator(meter, [0, 0]);

    expect(calculator.computeLineDiff(new Uint8Array(), new Uint8Array())).toEqual({
      additions: 0,
      deletions: 0,
    });
    expect(meter.calls).toEqual([
      {
        name: "gitlode.line_diff.compute.operation",
        value: 1,
        attributes: successAttributes,
      },
      {
        name: "gitlode.line_diff.compute.duration",
        value: 0,
        attributes: successAttributes,
      },
      {
        name: "gitlode.line_diff.compute.input.size",
        value: 0,
        attributes: successAttributes,
      },
    ]);
  });

  it("records concrete implementation failure once and preserves thrown identity", () => {
    const failure = { reason: "diff failed" };
    diffModule.diffLines.mockImplementationOnce(() => {
      throw failure;
    });
    const meter = new RecordingMeter();
    const calculator = createCalculator(meter, [10, 510]);

    let thrown: unknown;
    try {
      calculator.computeLineDiff(encoder.encode("a"), encoder.encode("bc"));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(failure);
    expect(meter.calls).toEqual([
      { name: "gitlode.line_diff.compute.operation", value: 1, attributes: errorAttributes },
      { name: "gitlode.line_diff.compute.duration", value: 0.5, attributes: errorAttributes },
      { name: "gitlode.line_diff.compute.input.size", value: 3, attributes: errorAttributes },
    ]);
  });

  it("records each repeated computation exactly once without creating more instruments", () => {
    const meter = new RecordingMeter();
    const calculator = createCalculator(meter, [0, 100, 200, 500]);

    expect(calculator.computeLineDiff(encoder.encode("a\n"), encoder.encode("b\n"))).toEqual({
      additions: 1,
      deletions: 1,
    });
    expect(calculator.computeLineDiff(encoder.encode("same\n"), encoder.encode("same\n"))).toEqual({
      additions: 0,
      deletions: 0,
    });

    expect(meter.creations).toHaveLength(3);
    expect(meter.calls).toHaveLength(6);
    expect(meter.calls.filter(({ name }) => name.endsWith(".operation"))).toHaveLength(2);
    expect(meter.calls.filter(({ name }) => name.endsWith(".duration"))).toHaveLength(2);
    expect(meter.calls.filter(({ name }) => name.endsWith(".input.size"))).toHaveLength(2);
  });

  it.each([
    ["added lines", "", "one\ntwo\n", { additions: 2, deletions: 0 }],
    ["deleted lines", "one\ntwo\n", "", { additions: 0, deletions: 2 }],
    ["identical content", "same\n", "same\n", { additions: 0, deletions: 0 }],
  ] as const)("preserves $0 behavior with the no-op recorder", (_name, before, after, expected) => {
    const calculator = new JsLineDiffCalculator({
      metricRecorder: NOOP_LINE_DIFF_METRIC_RECORDER,
    });

    expect(calculator.computeLineDiff(encoder.encode(before), encoder.encode(after))).toEqual(
      expected,
    );
  });
});
