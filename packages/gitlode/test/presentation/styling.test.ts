import { stripVTControlCharacters } from "node:util";

import chalk from "chalk";
import { describe, expect, it } from "vitest";

import { formatSummaryLines } from "../../src/presentation/reporting/formatters.js";
import { createStyling, styleRules } from "../../src/presentation/styling.js";

describe("source-editable style rules", () => {
  it("pads before decoration and keeps identical layout without TTY decoration", () => {
    const calls: string[] = [];
    const rules = {
      ...styleRules,
      h1: {
        padding: 2,
        decorate: (text: string) => (calls.push(text), `<heading>${text}</heading>`),
      },
    };
    const plain = createStyling(false, rules);
    expect(plain.h1("Title")).toBe("  Title  ");
    expect(calls).toEqual([]);
    const styled = createStyling(true, rules);
    expect(styled.h1("Title")).toBe("<heading>  Title  </heading>");
    expect(calls).toEqual(["  Title  "]);
    expect(plain.primaryValue("12")).toBe("12");
  });

  it("keeps factory-styled and plain summaries equal after stripping ANSI", () => {
    const previousLevel = chalk.level;
    try {
      chalk.level = 1;
      const data = {
        recordsWritten: 12,
        commitsTraversed: 6,
        filesCreated: 1,
        bytesWritten: 1234,
        elapsedMs: 500,
        refs: ["main"],
      };
      const styled = formatSummaryLines(data, createStyling(true)).join("\n");
      const plain = formatSummaryLines(data, createStyling(false)).join("\n");
      expect(styled).not.toBe(stripVTControlCharacters(styled));
      expect(stripVTControlCharacters(styled)).toBe(plain);
      expect(stripVTControlCharacters(plain)).toBe(plain);
      chalk.level = 0;
      expect(formatSummaryLines(data, createStyling(true)).join("\n")).toBe(plain);
    } finally {
      chalk.level = previousLevel;
    }
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid padding %s before rendering",
    (padding) => {
      expect(() =>
        createStyling(false, { ...styleRules, h1: { ...styleRules.h1, padding } }),
      ).toThrow(RangeError);
    },
  );
});
