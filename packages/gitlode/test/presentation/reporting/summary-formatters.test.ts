import { describe, expect, it } from "vitest";

import { formatSummaryLines } from "../../../src/presentation/reporting/formatters.js";

describe("formatSummaryLines", () => {
  it("keeps the complete styled summary contract and field order", () => {
    const calls: string[] = [];
    const styling = {
      summaryHeader: (value: string) => (calls.push(`header:${value}`), `<h>${value}</h>`),
      fieldKey: (value: string) => (calls.push(`key:${value}`), `<k>${value}</k>`),
      primaryValue: (value: string) => (calls.push(`primary:${value}`), `<p>${value}</p>`),
      unitSuffix: (value: string) => (calls.push(`unit:${value}`), `<u>${value}</u>`),
      refsValue: (value: string) => (calls.push(`refs:${value}`), `<r>${value}</r>`),
      spinnerGlyph: (value: string) => value,
      doneMarker: (value: string) => value,
      stageLabel: (value: string) => value,
      warnBadge: (value: string) => value,
      errorBadge: (value: string) => value,
    };
    const lines = formatSummaryLines(
      {
        recordsWritten: 0,
        commitsTraversed: 0,
        filesCreated: 0,
        bytesWritten: 0,
        elapsedMs: 0,
        refs: [],
      },
      styling,
    );
    expect(lines.map((line) => line.replace(/<[^>]+>/g, ""))).toEqual([
      "Extraction complete",
      "  Records written   : 0",
      "  Commits traversed : 0",
      "  Files created     : 0",
      "  Bytes written     : 0B",
      "  Elapsed time      : 0.0s",
      "  Refs              : (none)",
    ]);
    expect(
      calls.filter((call) => call.startsWith("primary:")).map((call) => call.slice(8)),
    ).toEqual(["0", "0", "0", "0", "0.0"]);
    expect(calls).toContain("header:Extraction complete");
    expect(calls.filter((call) => call.startsWith("key:"))).toHaveLength(6);
    expect(calls.filter((call) => call.startsWith("unit:")).length).toBe(2);
    expect(calls).toContain("refs:(none)");
  });
});
