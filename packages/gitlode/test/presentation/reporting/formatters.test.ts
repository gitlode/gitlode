import type {
  ProfileCounterPoint,
  ProfileDiagnostic,
  ProfileHistogramPoint,
  ProfileReport,
  ProfileSpanAggregate,
} from "@gitlode/internal-contracts/telemetry";
import { describe, expect, it } from "vitest";

import { formatProfileLines } from "../../../src/presentation/reporting/formatters.js";
import { createStyling, plainStyling, type Styling } from "../../../src/presentation/styling.js";

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

const diagnostic = (overrides: Partial<ProfileDiagnostic> = {}): ProfileDiagnostic => ({
  code: "invalid_aggregation",
  severity: "warning",
  stage: "report_build",
  target: { type: "report" },
  signalCoverage: ["counter"],
  effects: ["missing_observations"],
  extent: "unidentified_subset",
  attributeKey: { type: "not_applicable" },
  affectedFields: [],
  detailLoss: {
    pointAttributes: false,
    observationIdentity: false,
    scopeIdentity: false,
    attributeKey: false,
    affectedFields: false,
  },
  lossQuantity: null,
  wholeResultUnavailable: false,
  count: 1,
  countSaturated: false,
  message: null,
  reportDelivery: null,
  ...overrides,
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

  it("places Scope, observation and point issues at their narrowest evidenced targets", () => {
    const report = emptyReport();
    report.counters = [
      { ...counter("example", "example.cache.lookup", 1), attributes: [{ key: "mode", value: "a" }] },
      { ...counter("example", "example.cache.lookup", 2), attributes: [{ key: "mode", value: "b" }] },
    ];
    report.diagnostics = [
      diagnostic({
        code: "lifecycle_failure",
        stage: "telemetry_shutdown",
        target: { type: "scope", scope: { name: "example", version: null } },
        signalCoverage: [],
        effects: ["lifecycle_notice"],
      }),
      diagnostic({
        code: "metric_point_overflow",
        target: {
          type: "observation",
          scope: { name: "example", version: null },
          kind: "counter",
          name: "example.cache.lookup",
        },
        effects: ["missing_observations"],
      }),
      diagnostic({
        target: {
          type: "point",
          scope: { name: "example", version: null },
          kind: "counter",
          name: "example.cache.lookup",
          attributes: [{ key: "mode", value: "b" }],
        },
        effects: ["incomplete_measurement_fields"],
        affectedFields: [{ kind: "counter", fields: ["value"] }],
      }),
    ];
    const lines = formatProfileLines(report);
    expect(lines).toEqual([
      "Profile",
      "  ! Collection and telemetry lifecycle issues detected.",
      "  Scope: example",
      "    ! Telemetry shutdown failed.",
      "    /example",
      "      cache",
      "        lookup",
      "          ! Additional attribute combinations omitted: datapoint retention limit reached.",
      "        lookup : 1 operations",
      "          /mode = a",
      "        lookup : 2 operations",
      "          /mode = b",
      "          ! Invalid aggregation detail was discarded.",
    ]);
  });

  it("keeps missing-only observations and valid siblings without synthesizing values", () => {
    const report = emptyReport();
    report.counters = [counter("example", "example.output.count", 7)];
    report.diagnostics = [
      diagnostic({
        target: {
          type: "observation",
          scope: { name: "example", version: null },
          kind: "histogram",
          name: "example.output.duration",
        },
        signalCoverage: ["histogram"],
        extent: "entire_target",
        wholeResultUnavailable: true,
      }),
    ];
    const output = formatProfileLines(report).join("\n");
    expect(output).toContain("duration : unavailable");
    expect(output).toContain("! No valid result retained: invalid aggregation discarded.");
    expect(output).toContain("count : 7 operations");
  });

  it("distinguishes known loss, repetition and unknown omitted diagnostic detail", () => {
    const report = emptyReport();
    report.spans = [{ ...span("example", "example.operation"), durationContributionCount: 1 }];
    report.diagnostics = [
      diagnostic({
        target: {
          type: "observation",
          scope: { name: "example", version: null },
          kind: "span",
          name: "example.operation",
        },
        signalCoverage: ["span"],
        effects: ["incomplete_measurement_fields"],
        affectedFields: [{ kind: "span", fields: ["avg"] }],
        lossQuantity: {
          descriptor: "span_duration_contributions",
          unit: "{operation}",
          value: 1,
          saturated: false,
        },
        count: 3,
      }),
      {
        code: "diagnostic_overflow",
        severity: "warning",
        stage: "report_build",
        target: { type: "report" },
        extent: "unidentified_subset",
        effects: ["lost_issue_detail"],
        signalCoverage: ["span"],
        effectsByKind: [],
        reportEffects: [],
        detailLoss: {
          pointAttributes: false,
          observationIdentity: true,
          scopeIdentity: true,
          attributeKey: false,
          affectedFields: false,
        },
        omittedOccurrences: null,
        countSaturated: false,
        maximumSeverity: "warning",
        priorIssueDetail: "unavailable",
      },
    ];
    const output = formatProfileLines(report).join("\n");
    expect(output).toContain("Duration summary excludes 1 invalid duration; avg unavailable.");
    expect(output).toContain("Repeated 3 times.");
    expect(output).toContain("the number of omitted occurrences is unknown");
    expect(output).toContain("prior issue detail unavailable");
  });

  it("renders fixed fallback and lifecycle-only reports through the ordinary path", () => {
    const fallback = emptyReport();
    fallback.signalStatus = { spans: "unavailable", counters: "unavailable", histograms: "unavailable" };
    fallback.diagnostics = [
      diagnostic({
        code: "lifecycle_failure",
        stage: "report_build",
        signalCoverage: ["span", "counter", "histogram"],
        effects: ["report_delivery_failure"],
        extent: "entire_target",
        wholeResultUnavailable: true,
        reportDelivery: {
          path: "fixed_fallback",
          measurementResults: "none",
          priorIssueDetail: "unavailable",
        },
      }),
    ];
    expect(formatProfileLines(fallback)).toEqual([
      "Profile",
      "  ! Profile report construction failed; measurement results could not be provided.",
      "  ! Earlier collection issue details are unavailable.",
    ]);

    const lifecycle = emptyReport();
    lifecycle.diagnostics = [
      diagnostic({
        code: "lifecycle_failure",
        stage: "telemetry_shutdown",
        signalCoverage: [],
        effects: ["lifecycle_notice"],
      }),
    ];
    expect(formatProfileLines(lifecycle)).toEqual([
      "Profile",
      "  ! Telemetry lifecycle issues detected.",
      "  ! Telemetry shutdown failed; affected scopes and observation names are unknown.",
    ]);
  });

  it("uses semantic style roles while preserving styled/plain text parity", () => {
    const report = emptyReport();
    report.spans = [
      { ...span("example", "example.operation"), callCount: 1, durationContributionCount: 1 },
    ];
    report.counters = [counter("example", "example.count", 1)];
    report.diagnostics = [diagnostic()];
    const calls: string[] = [];
    const spy = Object.fromEntries(
      Object.keys(plainStyling).map((role) => [
        role,
        (text: string) => (calls.push(`${role}:${text}`), `<${role}>${text}</${role}>`),
      ]),
    ) as unknown as Styling;
    const styled = formatProfileLines(report, spy).join("\n");
    expect(styled.replace(/<\/?[^>]+>/gu, "")).toBe(formatProfileLines(report).join("\n"));
    expect(calls).toEqual(expect.arrayContaining([
      "sectionHeading:Profile",
      "sectionHeading:Scope: example",
      "fieldKey:calls",
      "separator: : ",
      "primaryValue:1",
      "unitSuffix: operations",
      "warnBadge:!",
    ]));

    const ansi = /\u001b\[[0-9;]*m/gu;
    expect(formatProfileLines(report, createStyling(true)).join("\n").replace(ansi, "")).toBe(
      formatProfileLines(report).join("\n"),
    );
  });
});
