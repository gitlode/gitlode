import type { ProfileReport } from "@gitlode/internal-contracts/telemetry";
import { describe, expect, it } from "vitest";

import { formatProfileLines } from "../../../src/presentation/reporting/formatters.js";

const emptyReport = (): ProfileReport => ({
  schemaVersion: 1,
  signalStatus: { spans: "complete", counters: "complete", histograms: "complete" },
  spans: [],
  counters: [],
  histograms: [],
  diagnostics: [],
});

describe("formatProfileLines", () => {
  it("renders separated signal sections and span reducers", () => {
    const report = emptyReport();
    report.spans = [
      {
        scope: { name: "gitlode.execution", version: null },
        name: "gitlode.run",
        callCount: 2,
        errorCount: 1,
        totalDurationSeconds: 0.002,
        maxDurationSeconds: 0.0015,
        attributes: [
          { key: "mode", reducer: "single", value: "commit", observedCount: 2, conflictCount: 0 },
        ],
      },
    ];
    report.counters = [
      {
        scope: { name: "gitlode.extraction", version: null },
        name: "accepted",
        unit: "{commit}",
        attributes: [],
        value: 0,
      },
    ];
    report.histograms = [
      {
        scope: { name: "gitlode.output", version: null },
        name: "write",
        unit: "s",
        attributes: [],
        count: 2,
        sum: 0.003,
        minimum: 0.001,
        maximum: 0.002,
        explicitBounds: [],
        bucketCounts: [],
      },
    ];
    const lines = formatProfileLines(report);
    expect(lines.join("\n")).toContain("Spans");
    expect(lines.join("\n")).toContain("Counters");
    expect(lines.join("\n")).toContain("Histograms");
    expect(lines.join("\n")).not.toContain("percentile");
    expect(lines.join("\n")).toContain("errors=1");
  });

  it("renders diagnostic status and omits a complete empty report", () => {
    expect(formatProfileLines(emptyReport())).toEqual([]);
    const report = emptyReport();
    report.signalStatus.spans = "unavailable";
    report.diagnostics = [
      {
        code: "lifecycle_failure",
        severity: "warning",
        signal: "spans",
        stage: "trace_flush",
        count: 1,
        message: null,
      },
    ];
    expect(formatProfileLines(report).join("\n")).toContain("unavailable");
    expect(formatProfileLines(report).join("\n")).toContain("Telemetry lifecycle stage failed");
  });
});
