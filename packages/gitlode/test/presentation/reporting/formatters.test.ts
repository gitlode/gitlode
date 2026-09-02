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

  it("renders plugin scopes under one Plugins group and sorts independent of input order", () => {
    const report = emptyReport();
    report.spans = [
      {
        scope: { name: "@example/z", version: "1" },
        name: "gitlode.plugin.init",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
      {
        scope: { name: "@example/a", version: null },
        name: "custom.a",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
    ];
    const output = formatProfileLines(report).join("\n");
    expect(output.indexOf("      @example/a")).toBeLessThan(output.indexOf("      @example/z@1"));
    expect(output.match(/^    Plugins$/gm)).toHaveLength(1);
    expect(output).toContain("      @example/a");
    expect(output).toContain("      @example/z@1");
    expect(output).toContain("        Initialization:");
    expect(output).toContain("        custom.a:");
  });

  it("suppresses rows for unavailable signals while retaining headings and diagnostics", () => {
    const report = emptyReport();
    report.signalStatus.counters = "unavailable";
    report.counters = [
      {
        scope: { name: "gitlode.extraction", version: null },
        name: "hidden",
        unit: "unit",
        attributes: [],
        value: 1,
      },
    ];
    const output = formatProfileLines(report).join("\n");
    expect(output).toContain("Counters (unavailable)");
    expect(output).not.toContain("hidden");
    expect(output).toContain("Diagnostics");
  });

  it("classifies every non-core scope as a plugin and sorts canonical scope identities", () => {
    const report = emptyReport();
    report.spans = [
      ...[
        ["a-foo", null],
        ["a", "2"],
        ["gitlode.plugin.namespace", "1"],
        ["example-plugin", null],
        ["a", null],
      ].map(([name, version]) => ({
        scope: { name: name!, version },
        name: `custom.${name}`,
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      })),
    ];
    const output = formatProfileLines(report).join("\n");
    expect(output.match(/^    Plugins$/gm)).toHaveLength(1);
    const scopes = [
      "      a",
      "      a@2",
      "      a-foo",
      "      example-plugin",
      "      gitlode.plugin.namespace@1",
    ];
    for (let index = 1; index < scopes.length; index++) {
      expect(output.indexOf(scopes[index - 1]!)).toBeLessThan(output.indexOf(scopes[index]!));
    }
    expect(output).not.toContain("a / custom.a");
  });

  it.each([
    [
      "span groups",
      [
        "Overview",
        "Setup",
        "Pipeline",
        "Git operations",
        "Git traversal",
        "Git file access",
        "DAG",
        "Plugins",
      ],
    ],
    [
      "metric groups",
      [
        "Pipeline",
        "Git traversal",
        "Git object access",
        "Git file access",
        "DAG",
        "File expansion",
        "Line diff",
        "Output",
        "Plugins",
      ],
    ],
  ])("renders %s in catalog order regardless of input order", (kind, expectedGroups) => {
    const report = emptyReport();
    report.spans = [
      {
        scope: { name: "gitlode.dag", version: null },
        name: "gitlode.dag.traversal",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
      {
        scope: { name: "gitlode.execution", version: null },
        name: "gitlode.run",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
      {
        scope: { name: "gitlode.git", version: null },
        name: "gitlode.git.commit.walk",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
      {
        scope: { name: "gitlode.extraction", version: null },
        name: "gitlode.extract",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
      {
        scope: { name: "gitlode.execution", version: null },
        name: "gitlode.state.validate",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
      {
        scope: { name: "gitlode.git", version: null },
        name: "gitlode.git.resolve_ref",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
      {
        scope: { name: "gitlode.git", version: null },
        name: "gitlode.git.cli.file_blob_batch",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
      {
        scope: { name: "example-plugin", version: null },
        name: "plugin.span",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
    ];
    report.counters = [
      {
        scope: { name: "gitlode.dag", version: null },
        name: "gitlode.dag.node.yielded",
        unit: "{node}",
        attributes: [],
        value: 1,
      },
      {
        scope: { name: "gitlode.extraction", version: null },
        name: "gitlode.extraction.commit.accepted",
        unit: "{commit}",
        attributes: [],
        value: 0,
      },
      ...[
        ["gitlode.git", "gitlode.git.commit.yielded"],
        ["gitlode.git", "gitlode.git.object.read"],
        ["gitlode.git", "gitlode.git.file_change.yielded"],
        ["gitlode.dag", "gitlode.dag.node.yielded"],
        ["gitlode.extraction", "gitlode.file_change.expanded"],
        ["gitlode.line_diff", "gitlode.line_diff.compute.operation"],
        ["gitlode.extraction", "gitlode.output.write.record"],
      ].map(([scope, name]) => ({
        scope: { name: scope!, version: null },
        name: name!,
        unit: "{operation}",
        attributes: [],
        value: 1,
      })),
      {
        scope: { name: "example-plugin", version: "2" },
        name: "gitlode.plugin.projection.operation",
        unit: "{commit}",
        attributes: [],
        value: 1,
      },
    ];
    report.histograms = [
      {
        scope: { name: "gitlode.line_diff", version: null },
        name: "gitlode.line_diff.compute.duration",
        unit: "s",
        attributes: [],
        count: 1,
        sum: 0.000000001,
        minimum: null,
        maximum: null,
        explicitBounds: [1],
        bucketCounts: [1],
      },
      {
        scope: { name: "example-plugin", version: "2" },
        name: "gitlode.plugin.projection.duration",
        unit: "{commit}",
        attributes: [],
        count: 1,
        sum: 1,
        minimum: 1,
        maximum: 1,
        explicitBounds: [],
        bucketCounts: [],
      },
    ];
    const lines = formatProfileLines(report);
    const sectionTitle = kind === "span groups" ? "  Spans" : "  Counters";
    const start = lines.indexOf(sectionTitle);
    const end =
      kind === "span groups" ? lines.indexOf("  Counters") : lines.indexOf("  Histograms");
    const headings = lines
      .slice(start + 1, end)
      .filter((line) => /^    [^ ]/.test(line))
      .map((line) => line.trim());
    expect(headings).toEqual(expectedGroups);
  });

  it("routes exact core observations, wrong scopes, and independent fallbacks", () => {
    const report = emptyReport();
    report.spans = [
      {
        scope: { name: "gitlode.extraction", version: null },
        name: "gitlode.run",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
      {
        scope: { name: "gitlode.execution", version: null },
        name: "other",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
    ];
    report.counters = [
      {
        scope: { name: "gitlode.execution", version: null },
        name: "counter",
        unit: "mystery",
        attributes: [
          { key: "z", value: 1 },
          { key: "a", value: 2 },
        ],
        value: 0,
      },
    ];
    report.histograms = [
      {
        scope: { name: "gitlode.execution", version: null },
        name: "histogram",
        unit: "s",
        attributes: [],
        count: 1,
        sum: 0,
        minimum: null,
        maximum: null,
        explicitBounds: [],
        bucketCounts: [],
      },
    ];
    const output = formatProfileLines(report).join("\n");
    expect(output).toContain("Other spans");
    expect(output).toContain("Other counters");
    expect(output).toContain("Other histograms");
    expect(output).toContain("gitlode.extraction / gitlode.run");
    expect(output).toContain("0 mystery");
    expect(output).toContain("min=—");
    expect(output).not.toContain("bucket");
    expect(output).not.toContain("percentile");
  });

  it("renders every span reducer evidence contract", () => {
    const report = emptyReport();
    report.spans = [
      {
        scope: { name: "gitlode.execution", version: null },
        name: "gitlode.run",
        callCount: 3,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [
          {
            key: "single_equal",
            reducer: "single",
            value: "ok",
            observedCount: 3,
            conflictCount: 0,
          },
          {
            key: "single_partial",
            reducer: "single",
            value: "ok",
            observedCount: 2,
            conflictCount: 0,
          },
          {
            key: "single_conflict",
            reducer: "single",
            value: "ok",
            observedCount: 3,
            conflictCount: 2,
          },
          {
            key: "distinct",
            reducer: "distinct",
            values: [
              { value: "a", count: 2 },
              { value: "b", count: 1 },
            ],
            overflowCount: 4,
          },
          { key: "minmax", reducer: "min_max", minimum: 1, maximum: 9, observedCount: 2 },
        ],
      },
    ];
    const output = formatProfileLines(report).join("\n");
    expect(output).toContain("single_equal=ok");
    expect(output).not.toContain("single_equal=ok (observedCount=");
    expect(output).toContain("single_partial=ok (observedCount=2)");
    expect(output).toContain("single_conflict=ok (conflicts=2)");
    expect(output).toContain("distinct=a(2),b(1) (overflow=4)");
    expect(output).toContain("minmax=1…9 (observedCount=2)");
  });

  it("renders every canonical unit and preserves tiny nonzero values", () => {
    const report = emptyReport();
    report.counters = [
      ["s", 1e-9],
      ["s", 1e-6],
      ["s", 0.001],
      ["s", 1],
      ["By", 1],
      ["By", 1024],
      ["By", 1024 ** 2],
      ["By", 1024 ** 3],
      ["{commit}", 2],
      ["{operation}", 3],
      ["custom-unit", 7],
      ["s", 1e-12],
    ].map(([unit, value], index) => ({
      scope: { name: "gitlode.execution", version: null },
      name: `custom.counter.${index}`,
      unit: unit as string,
      attributes: [],
      value: value as number,
    }));
    const output = formatProfileLines(report).join("\n");
    expect(output).toContain("1.000 ns");
    expect(output).toContain("1.000 µs");
    expect(output).toContain("1.000 ms");
    expect(output).toContain("1 s");
    expect(output).toContain("1 B");
    expect(output).toContain("1 KiB");
    expect(output).toContain("1 MiB");
    expect(output).toContain("1 GiB");
    expect(output).toContain("2 commits");
    expect(output).toContain("3 operations");
    expect(output).toContain("7 custom-unit");
    expect(output).toContain("0.001000 ns");
  });

  it("keeps partial rows, suppresses unavailable rows, and omits absent complete signals", () => {
    const partial = emptyReport();
    partial.signalStatus.counters = "partial";
    partial.counters = [
      {
        scope: { name: "gitlode.execution", version: null },
        name: "custom.counter",
        unit: "{commit}",
        attributes: [],
        value: 0,
      },
    ];
    const partialOutput = formatProfileLines(partial).join("\n");
    expect(partialOutput).toContain("Counters (partial)");
    expect(partialOutput).toContain("0 commits");
    expect(partialOutput).toContain("Diagnostics");
    expect(partialOutput).not.toContain("Histograms");

    const unavailable = emptyReport();
    unavailable.signalStatus.spans = "unavailable";
    unavailable.spans = [
      {
        scope: { name: "gitlode.execution", version: null },
        name: "hidden",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
    ];
    const unavailableOutput = formatProfileLines(unavailable).join("\n");
    expect(unavailableOutput).toContain("Spans (unavailable)");
    expect(unavailableOutput).toContain("(no observations)");
    expect(unavailableOutput).not.toContain("hidden");
    expect(formatProfileLines(emptyReport())).toEqual([]);
  });

  it("sorts fallback spans and metrics by scope, name, then attributes", () => {
    const report = emptyReport();
    report.spans = [
      {
        scope: { name: "gitlode.execution", version: "2" },
        name: "z",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
      {
        scope: { name: "gitlode.execution", version: null },
        name: "a",
        callCount: 1,
        errorCount: 0,
        totalDurationSeconds: 1,
        maxDurationSeconds: 1,
        attributes: [],
      },
    ];
    report.counters = [
      {
        scope: { name: "gitlode.execution", version: null },
        name: "z",
        unit: "u",
        attributes: [{ key: "z", value: 1 }],
        value: 1,
      },
      {
        scope: { name: "gitlode.execution", version: null },
        name: "a",
        unit: "u",
        attributes: [{ key: "a", value: 1 }],
        value: 1,
      },
    ];
    report.histograms = [
      {
        scope: { name: "gitlode.execution", version: null },
        name: "z",
        unit: "s",
        attributes: [],
        count: 1,
        sum: 1,
        minimum: null,
        maximum: null,
        explicitBounds: [],
        bucketCounts: [],
      },
    ];
    const output = formatProfileLines(report).join("\n");
    expect(output.indexOf("gitlode.execution / a")).toBeLessThan(
      output.indexOf("gitlode.execution@2 / z"),
    );
    expect(output.indexOf("Other counters")).toBeLessThan(output.indexOf("Other histograms"));
    expect(output).not.toContain("projection");
  });

  it("renders valid histogram catalog groups independently from counters", () => {
    const report = emptyReport();
    report.histograms = [
      {
        scope: { name: "example-plugin", version: null },
        name: "gitlode.plugin.projection.duration",
        unit: "s",
        attributes: [],
        count: 1,
        sum: 1,
        minimum: 1,
        maximum: 1,
        explicitBounds: [],
        bucketCounts: [],
      },
      {
        scope: { name: "gitlode.extraction", version: null },
        name: "gitlode.projection.duration",
        unit: "s",
        attributes: [],
        count: 1,
        sum: 1,
        minimum: 1,
        maximum: 1,
        explicitBounds: [],
        bucketCounts: [],
      },
      {
        scope: { name: "gitlode.line_diff", version: null },
        name: "gitlode.line_diff.compute.duration",
        unit: "s",
        attributes: [],
        count: 1,
        sum: 1,
        minimum: 1,
        maximum: 1,
        explicitBounds: [],
        bucketCounts: [],
      },
    ];
    const lines = formatProfileLines(report);
    const start = lines.indexOf("  Histograms");
    const headings = lines
      .slice(start + 1)
      .filter((line) => /^    [^ ]/.test(line))
      .map((line) => line.trim());
    expect(headings).toEqual(["Line diff", "Projection", "Plugins"]);
  });
});
