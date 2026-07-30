import { describe, expect, it } from "vitest";

import { LocalInstrumentationRecorder } from "../../src/instrumentation/index.js";
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
});
