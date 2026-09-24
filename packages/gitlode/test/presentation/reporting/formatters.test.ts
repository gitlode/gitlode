import type {
  ProfileCounterPoint,
  ProfileHistogramPoint,
  ProfileReport,
  ProfileSpanAggregate,
} from "@gitlode/internal-contracts/telemetry";
import { describe, expect, it } from "vitest";

import { formatProfileLines } from "../../../src/presentation/reporting/formatters.js";

const emptyReport = (): ProfileReport => ({
  schemaVersion: 2,
  signalStatus: { spans: "complete", counters: "complete", histograms: "complete" },
  spans: [],
  counters: [],
  histograms: [],
  diagnostics: [],
});

const span = (scope: string, name: string): ProfileSpanAggregate => ({
  scope: { name: scope, version: null },
  name,
  callCount: 2,
  errorCount: 0,
  totalDurationSeconds: 0.002,
  maxDurationSeconds: 0.0015,
  durationContributionCount: 2,
  unavailableFields: [],
  attributes: [],
});

const counter = (
  scope: string,
  name: string,
  value = 1,
  unit = "{operation}",
): ProfileCounterPoint => ({
  scope: { name: scope, version: null },
  name,
  value,
  unit,
  unavailableFields: [],
  attributes: [],
});

const histogram = (scope: string, name: string): ProfileHistogramPoint => ({
  scope: { name: scope, version: null },
  name,
  unit: "s",
  count: 2,
  sum: 0.003,
  minimum: 0.001,
  maximum: 0.002,
  explicitBounds: [],
  bucketCounts: [],
  unavailableFields: [],
  attributes: [],
});

describe("generic profile formatting", () => {
  it("organizes every kind in one Scope and two namespace levels", () => {
    const report = emptyReport();
    report.spans = [span("gitlode.git", "gitlode.git.commit.walk")];
    report.counters = [counter("gitlode.git", "gitlode.git.object.read", 0, "{object}")];
    report.histograms = [histogram("gitlode.git", "gitlode.git.blob.read.duration")];

    expect(formatProfileLines(report)).toEqual([
      "Profile",
      "  Scope: gitlode.git",
      "    /gitlode",
      "      git",
      "        blob.read.duration : samples=2, total=3 ms, avg=1.5 ms, min=1 ms, max=2 ms",
      "        commit.walk : calls=2, total=2 ms, avg=1 ms, max=1.5 ms, errors=0",
      "        object.read : 0 objects",
    ]);
  });

  it("renders short nodes, group-node collisions and cross-kind ties without invented labels", () => {
    const report = emptyReport();
    report.spans = [span("example", "root"), span("example", "root.child")];
    report.counters = [counter("example", "root", 3), counter("example", "root.child", 4)];

    expect(formatProfileLines(report)).toEqual([
      "Profile",
      "  Scope: example",
      "    /root",
      "      /root : calls=2, total=2 ms, avg=1 ms, max=1.5 ms, errors=0",
      "      /root : 3 operations",
      "      child",
      "        /root.child : calls=2, total=2 ms, avg=1 ms, max=1.5 ms, errors=0",
      "        /root.child : 4 operations",
    ]);
  });

  it("uses canonical Scope, kind and typed attribute ordering", () => {
    const report = emptyReport();
    const base = counter("a", "x", 1, "u");
    report.counters = [
      { ...base, scope: { name: "a", version: "1" }, attributes: [{ key: "k", value: false }] },
      { ...base, attributes: [{ key: "k", value: "1" }] },
      { ...base, attributes: [{ key: "k", value: 1 }] },
      { ...base, attributes: [{ key: "k", value: true }] },
    ];
    report.spans = [{ ...span("a", "x"), callCount: 1, durationContributionCount: 1 }];

    const output = formatProfileLines(report).join("\n");
    const positions = [
      "calls=1",
      "/k = true",
      "/k = 1",
      '/k = "1"',
      "Scope: a@1",
      "/k = false",
    ].map((text) => output.indexOf(text));
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });

  it("applies segment-boundary attribute bases and preserves span summary semantics", () => {
    const report = emptyReport();
    report.spans = [
      {
        ...span("example", "gitlode.projection"),
        attributes: [
          { key: "gitlode.projection.mode", reducer: "single", value: "ready", observedCount: 2, conflictCount: 0 },
          { key: "gitlode.project", reducer: "single", value: "true", observedCount: 1, conflictCount: 0 },
          { key: "gitlode.projection.outcome", reducer: "distinct", values: [{ value: "ok", count: 2 }], overflowCount: 0 },
          { key: "gitlode.projection.size", reducer: "min_max", minimum: 1, maximum: 9, observedCount: 2 },
        ],
      },
    ];

    expect(formatProfileLines(report).join("\n")).toContain(
      [
        "      projection : calls=2, total=2 ms, avg=1 ms, max=1.5 ms, errors=0",
        '        /gitlode.project = "true" (observed 1)',
        "        mode = ready",
        "        outcome = ok(2)",
        "        size = 1…9",
      ].join("\n"),
    );
  });

  it("quotes malformed names, delimiters, controls and type-ambiguous strings", () => {
    const report = emptyReport();
    report.counters = [
      {
        ...counter("scope name", "gitlode..read"),
        attributes: [
          { key: "line\nkey", value: "true" },
          { key: "number", value: "1" },
          { key: "slash", value: "/value" },
        ],
      },
    ];
    expect(formatProfileLines(report)).toEqual([
      "Profile",
      '  Scope: "scope name"',
      '    /"gitlode..read" : 1 operations',
      '      /"line\\nkey" = "true"',
      '      /number = "1"',
      '      /slash = "/value"',
    ]);
  });

  it("uses four significant digits, promotes rounded thresholds and never hides nonzero", () => {
    const report = emptyReport();
    report.counters = [
      counter("example", "a", 0, "s"),
      counter("example", "b", 0.00099996, "s"),
      counter("example", "c", 1023.96, "By"),
      counter("example", "d", 1e-15, "s"),
    ];
    expect(formatProfileLines(report).join("\n")).toContain("/a : 0 s");
    expect(formatProfileLines(report).join("\n")).toContain("/b : 1 ms");
    expect(formatProfileLines(report).join("\n")).toContain("/c : 1 KiB");
    expect(formatProfileLines(report).join("\n")).toContain("/d : 1e-6 ns");
  });

  it("preserves masks, duration coverage, exact counts and optional extrema", () => {
    const report = emptyReport();
    report.spans = [
      {
        ...span("example", "partial"),
        durationContributionCount: 1,
        unavailableFields: ["errors"],
      },
    ];
    report.counters = [{ ...counter("example", "zero", 0), unavailableFields: ["value"] }];
    report.histograms = [
      { ...histogram("example", "hist"), minimum: null, maximum: null, unavailableFields: [] },
    ];
    const output = formatProfileLines(report).join("\n");
    expect(output).toContain("calls=2, total=2 ms, avg=—, max=1.5 ms, errors=—");
    expect(output).toContain("/zero : —");
    expect(output).toContain("samples=2, total=3 ms, avg=1.5 ms, min=—, max=—");
  });

  it("omits a complete empty report", () => {
    expect(formatProfileLines(emptyReport())).toEqual([]);
  });
});
