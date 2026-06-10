import { describe, expect, it } from "vitest";

import { formatProfileLines } from "../../../src/cli/reporting/formatters.js";
import type { ProfilingEntry } from "../../../src/core/index.js";

describe("formatProfileLines", () => {
  it("formats profile lines with consistent padding", () => {
    const entries: ProfilingEntry[] = [
      { name: "planning", wallMs: 123.456, workMs: 0 },
      { name: "traversal", wallMs: 9876.543, workMs: 5000 },
      { name: "projection", wallMs: 5.4321, workMs: 0 },
      { name: "write", wallMs: 78.9, workMs: 20.5 },
    ];

    const lines = formatProfileLines(entries);

    expect(lines).toEqual([
      "Profile",
      "  planning   : wall=   123.46ms  work=     0.00ms",
      "  traversal  : wall= 9,876.54ms  work= 5,000.00ms",
      "  projection : wall=     5.43ms  work=     0.00ms",
      "  write      : wall=    78.90ms  work=    20.50ms",
    ]);
  });

  it("includes skipped diffs line when provided", () => {
    const entries: ProfilingEntry[] = [
      { name: "planning", wallMs: 100, workMs: 0 },
      { name: "traversal", wallMs: 200, workMs: 150 },
    ];

    const lines = formatProfileLines(entries, 42);

    expect(lines).toEqual([
      "Profile",
      "  planning  : wall= 100.00ms  work=   0.00ms",
      "  traversal : wall= 200.00ms  work= 150.00ms",
      "  skipped_diffs : 42",
    ]);
  });

  it("returns empty array when no entries", () => {
    const lines = formatProfileLines([]);
    expect(lines).toEqual([]);
  });
});
