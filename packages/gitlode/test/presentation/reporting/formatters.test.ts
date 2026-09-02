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
        "Projection",
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
        ["gitlode.extraction", "gitlode.projection.duration"],
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
        name: "plugin.metric",
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
        name: "plugin.metric",
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
});
