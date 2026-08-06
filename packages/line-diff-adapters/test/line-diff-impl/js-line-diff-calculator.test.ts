import { LocalInstrumentationRecorder } from "@gitlode/internal-foundation/instrumentation";
import { describe, expect, it } from "vitest";

import { JsLineDiffCalculator } from "../../src/line-diff-impl/index.js";

describe("JsLineDiffCalculator instrumentation", () => {
  it("owns the concrete line-diff computation span", () => {
    const instrumentation = new LocalInstrumentationRecorder(() => 1);
    const calculator = new JsLineDiffCalculator({ instrumentation });
    const encoder = new TextEncoder();

    expect(
      calculator.computeLineDiff(encoder.encode("old\n"), encoder.encode("new\nadded\n")),
    ).toEqual({
      additions: 2,
      deletions: 1,
    });

    expect(
      instrumentation.records().filter(({ name }) => name === "line_diff.compute"),
    ).toHaveLength(1);
    expect(instrumentation.records().some(({ name }) => name === ["git", "diff"].join("."))).toBe(
      false,
    );
  });

  it.each([
    {
      name: "added lines",
      before: "",
      after: "one\ntwo\n",
      expected: { additions: 2, deletions: 0 },
    },
    {
      name: "deleted lines",
      before: "one\ntwo\n",
      after: "",
      expected: { additions: 0, deletions: 2 },
    },
    {
      name: "identical content",
      before: "same\n",
      after: "same\n",
      expected: { additions: 0, deletions: 0 },
    },
  ])("computes $name", ({ before, after, expected }) => {
    const calculator = new JsLineDiffCalculator({
      instrumentation: { run: (_name, operation) => operation() },
    });
    const encoder = new TextEncoder();

    expect(calculator.computeLineDiff(encoder.encode(before), encoder.encode(after))).toEqual(
      expected,
    );
  });
});
