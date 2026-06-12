import { describe, expect, it } from "vitest";

import { formatDiagnosticLines, splitMessageLines } from "../../src/presentation/diagnostics.js";
import type { Styling } from "../../src/presentation/progress/index.js";

const styled: Styling = {
  spinnerGlyph: (text) => text,
  doneMarker: (text) => text,
  stageLabel: (text) => text,
  summaryHeader: (text) => text,
  warnBadge: (text) => `<warn>${text}</warn>`,
  errorBadge: (text) => `<error>${text}</error>`,
  fieldKey: (text) => text,
  primaryValue: (text) => text,
  unitSuffix: (text) => text,
  refsValue: (text) => text,
};

describe("splitMessageLines", () => {
  it("splits multi-line messages with LF and CRLF", () => {
    expect(splitMessageLines("line 1\nline 2")).toEqual(["line 1", "line 2"]);
    expect(splitMessageLines("line 1\r\nline 2")).toEqual(["line 1", "line 2"]);
  });
});

describe("formatDiagnosticLines", () => {
  it("formats warning lines with the warn badge", () => {
    expect(formatDiagnosticLines("warn", "warning message", styled)).toEqual([
      "<warn>[WARN]</warn> warning message",
    ]);
  });

  it("formats error lines with the error badge", () => {
    expect(formatDiagnosticLines("error", "error message", styled)).toEqual([
      "<error>[ERROR]</error> error message",
    ]);
  });

  it("prefixes every line of a multi-line diagnostic", () => {
    expect(formatDiagnosticLines("error", "line 1\nline 2", styled)).toEqual([
      "<error>[ERROR]</error> line 1",
      "<error>[ERROR]</error> line 2",
    ]);
  });
});
