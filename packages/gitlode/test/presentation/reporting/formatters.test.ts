import { describe, expect, it } from "vitest";

import type { ProfileSummaryEntry } from "../../../src/instrumentation/index.js";
import { formatProfileLines } from "../../../src/presentation/reporting/formatters.js";

describe("formatProfileLines", () => {
  it("formats profile lines with consistent padding", () => {
    const entries: ProfileSummaryEntry[] = [
      {
        name: "gitlode.planning",
        totalMs: 123.456,
        calls: 1,
        averageMs: 123.456,
        maxMs: 123.456,
      },
      {
        name: "gitlode.traversal",
        totalMs: 9876.543,
        calls: 240,
        averageMs: 41.1522625,
        maxMs: 5000,
      },
      {
        name: "gitlode.projection",
        totalMs: 5.4321,
        calls: 12,
        averageMs: 0.452675,
        maxMs: 1.2,
      },
      { name: "gitlode.output.write", totalMs: 78.9, calls: 12, averageMs: 6.575, maxMs: 20.5 },
    ];

    const lines = formatProfileLines(entries);

    expect(lines).toEqual([
      "Profile",
      "  span                 :      total  calls       avg         max",
      "  gitlode.planning     :   123.46ms      1  123.46ms    123.46ms",
      "  gitlode.traversal    : 9,876.54ms    240   41.15ms  5,000.00ms",
      "  gitlode.projection   :     5.43ms     12    0.45ms      1.20ms",
      "  gitlode.output.write :    78.90ms     12    6.58ms     20.50ms",
    ]);
  });

  it("does not include a separate skipped diffs line", () => {
    const entries: ProfileSummaryEntry[] = [
      { name: "gitlode.planning", totalMs: 100, calls: 1, averageMs: 100, maxMs: 100 },
      { name: "gitlode.traversal", totalMs: 200, calls: 2, averageMs: 100, maxMs: 150 },
    ];

    const lines = formatProfileLines(entries, 42);

    expect(lines).toEqual([
      "Profile",
      "  span              :    total  calls       avg       max",
      "  gitlode.planning  : 100.00ms      1  100.00ms  100.00ms",
      "  gitlode.traversal : 200.00ms      2  100.00ms  150.00ms",
    ]);
  });

  it("formats profile details from attributes, counters, and errors", () => {
    const entries: ProfileSummaryEntry[] = [
      {
        name: "git.walk_commits",
        totalMs: 10,
        calls: 1,
        averageMs: 10,
        maxMs: 10,
        attributes: { strategy: ["certifiedLazy"], cached: [true], fallback: [false] },
        counters: { reads: 123 },
        errors: 1,
      },
    ];

    const lines = formatProfileLines(entries);

    expect(lines).toEqual([
      "Profile",
      "  span             :   total  calls      avg      max  details",
      "  git.walk_commits : 10.00ms      1  10.00ms  10.00ms  cached fallback=false strategy=certifiedLazy reads=123 errors=1",
    ]);
  });

  it("returns empty array when no entries", () => {
    const lines = formatProfileLines([]);
    expect(lines).toEqual([]);
  });
});
