import {
  getTelemetryMetricMetadata,
  PROFILE_COLLECTION_LIMITS,
  TELEMETRY_METRICS,
} from "@gitlode/internal-contracts/telemetry";
import type {
  ProfileCounterPoint,
  ProfileHistogramPoint,
  ProfileReport,
  ProfileSpanAggregate,
} from "@gitlode/internal-contracts/telemetry";
import { SpanStatusCode } from "@opentelemetry/api";
import {
  DataPointType,
  MeterProvider,
  type ResourceMetrics,
  type SumMetricData,
} from "@opentelemetry/sdk-metrics";
import { BasicTracerProvider, type ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { describe, expect, test } from "vitest";

import { FirstAcceptedBoundedMap } from "../../src/execution/telemetry/bounded-retention.js";
import {
  BoundedDiagnosticAccumulator,
  convertLocalMetrics,
  createLocalMetricViews,
  DEFAULT_LOCAL_METRIC_COLLECTION_TIMEOUT_MILLIS,
  LocalMetricReader,
  LocalSpanProcessor,
  ProfileReportBuilder,
} from "../../src/execution/telemetry/index.js";
import { formatProfileLines } from "../../src/presentation/reporting/formatters.js";
import {
  evaluateRepositoryProfileReport,
  extractProfileReportMeasurements,
} from "../support/performance-harness.js";

function fakeSpan(
  name: string,
  options: {
    scope?: string;
    version?: string;
    duration?: [number, number];
    status?: number;
    attributes?: Record<string, unknown>;
    events?: unknown[];
  } = {},
): ReadableSpan {
  return {
    name,
    instrumentationScope: { name: options.scope ?? "plugin.example", version: options.version },
    duration: options.duration ?? [0, 10],
    status: { code: options.status ?? SpanStatusCode.UNSET },
    attributes: options.attributes ?? {},
    events: options.events ?? [],
  } as unknown as ReadableSpan;
}

function sumMetric(
  name: string,
  points: { value: number; attributes?: Record<string, unknown> }[],
): SumMetricData {
  return {
    descriptor: { name, description: "ignored", unit: "ignored", valueType: 1 },
    aggregationTemporality: 1,
    dataPointType: DataPointType.SUM,
    isMonotonic: true,
    dataPoints: points.map((point) => ({
      startTime: [0, 0],
      endTime: [0, 0],
      attributes: point.attributes ?? {},
      value: point.value,
    })),
  };
}

function histogramMetric(
  name: string,
  boundaries: readonly number[],
  attributes: Record<string, unknown> = {},
) {
  return {
    descriptor: { name, description: "ignored", unit: "ignored", valueType: 1 },
    aggregationTemporality: 1,
    dataPointType: DataPointType.HISTOGRAM,
    dataPoints: [
      {
        startTime: [0, 0],
        endTime: [0, 0],
        attributes,
        value: {
          count: 3,
          sum: 5,
          min: 0,
          max: 4,
          buckets: {
            boundaries: [...boundaries],
            counts: [1, ...boundaries.slice(1).map(() => 0), 2],
          },
        },
      },
    ],
  } as unknown as ResourceMetrics["scopeMetrics"][number]["metrics"][number];
}

function resourceMetrics(
  scope: string,
  metrics: ResourceMetrics["scopeMetrics"][number]["metrics"],
  version?: string,
): ResourceMetrics {
  return {
    resource: {} as ResourceMetrics["resource"],
    scopeMetrics: [{ scope: { name: scope, version }, metrics }],
  };
}

const emptyInput = () => ({
  spans: { status: "complete" as const, values: [] },
  counters: { status: "complete" as const, values: [] },
  histograms: { status: "complete" as const, values: [] },
});

describe("bounded diagnostic accumulator", () => {
  test.each([15, 16, 17])(
    "retains the reserved overflow slot at %i unique occurrences",
    (count) => {
      const diagnostics = new BoundedDiagnosticAccumulator();
      for (let index = 0; index < count; index += 1)
        diagnostics.add({
          code: "lifecycle_failure",
          stage: "report_build",
          target: {
            type: "observation",
            scope: { name: "test", version: null },
            kind: "span",
            name: `failure-${index}`,
          },
          signalCoverage: ["span"],
          effects: ["unknown_collection_coverage"],
          extent: "unidentified_subset",
          message: `failure-${index}`,
        });
      const snapshot = diagnostics.snapshot();
      expect(snapshot.diagnostics).toHaveLength(Math.min(count, 15));
      expect(snapshot.summary?.omittedOccurrences ?? 0).toBe(Math.max(0, count - 15));
    },
  );

  test("bounds an explicitly supplied safe message and never expands errors", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const long = "x".repeat(600);
    diagnostics.add({
      code: "lifecycle_failure",
      stage: "metric_collection",
      target: { type: "report" },
      signalCoverage: ["counter", "histogram"],
      effects: ["unknown_collection_coverage"],
      extent: "unidentified_subset",
      message: long,
    });
    diagnostics.add({
      code: "lifecycle_failure",
      stage: "metric_collection",
      target: { type: "report" },
      signalCoverage: ["counter", "histogram"],
      effects: ["unknown_collection_coverage"],
      extent: "unidentified_subset",
      message: long,
    });
    diagnostics.add({
      code: "lifecycle_failure",
      stage: "metric_collection",
      target: { type: "report" },
      signalCoverage: ["counter", "histogram"],
      effects: ["unknown_collection_coverage"],
      extent: "unidentified_subset",
      message: new Error("secret"),
    });
    expect(diagnostics.snapshot().diagnostics).toEqual([
      expect.objectContaining({ count: 3, message: "x".repeat(512), severity: "warning" }),
    ]);
  });
});

describe("first-accepted bounded retention", () => {
  test.each([15, 16, 17])("bounds distinct values at %i", (count) => {
    const retained = new FirstAcceptedBoundedMap<string, number>(
      PROFILE_COLLECTION_LIMITS.distinctSpanAttributeValuesPerAttribute,
    );
    let overflowCount = 0;
    for (let index = 0; index < count; index += 1) {
      const acceptance = retained.accept(`value-${index}`, () => index);
      if (!acceptance.accepted) overflowCount += 1;
    }
    expect([...retained.values()]).toEqual(
      Array.from({ length: Math.min(count, 16) }, (_, index) => index),
    );
    expect(overflowCount).toBe(Math.max(0, count - 16));
  });

  test.each([127, 128, 129])("bounds metric point identities at %i", (count) => {
    const retained = new FirstAcceptedBoundedMap<string, number>(
      PROFILE_COLLECTION_LIMITS.metricPointsPerInstrument,
    );
    let overflowCount = 0;
    for (let index = 0; index < count; index += 1) {
      const acceptance = retained.accept(`point-${index}`, () => index);
      if (!acceptance.accepted) overflowCount += 1;
    }
    expect([...retained.values()]).toEqual(
      Array.from({ length: Math.min(count, 128) }, (_, index) => index),
    );
    expect(overflowCount).toBe(Math.max(0, count - 128));
  });
});

describe("local span processor", () => {
  test("uses scope/version/name identity and aggregates status-derived errors and duration", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const processor = new LocalSpanProcessor(diagnostics);
    processor.onEnd(
      fakeSpan("plugin.operation", {
        duration: [1, 0],
        events: [{ name: "exception" }],
        attributes: { arbitrary: "discarded" },
      }),
    );
    processor.onEnd(
      fakeSpan("plugin.operation", {
        version: "1.0.0",
        duration: [2, 0],
        status: SpanStatusCode.ERROR,
      }),
    );
    processor.onEnd(fakeSpan("plugin.operation", { version: "1.0.0", duration: [3, 0] }));
    expect(processor.snapshot()).toEqual({
      status: "complete",
      spans: [
        expect.objectContaining({
          scope: { name: "plugin.example", version: null },
          callCount: 1,
          errorCount: 0,
          totalDurationSeconds: 1,
          maxDurationSeconds: 1,
          attributes: [],
        }),
        expect.objectContaining({
          scope: { name: "plugin.example", version: "1.0.0" },
          callCount: 2,
          errorCount: 1,
          totalDurationSeconds: 5,
          maxDurationSeconds: 3,
          attributes: [],
        }),
      ],
    });
  });

  test("applies resolved-plugin span attributes only under non-core scopes", () => {
    const processor = new LocalSpanProcessor(new BoundedDiagnosticAccumulator());
    processor.onEnd(
      fakeSpan("gitlode.plugin.init", {
        scope: "@example/plugin",
        attributes: { "gitlode.plugin.init.result": "ready" },
      }),
    );
    processor.onEnd(
      fakeSpan("gitlode.plugin.init", {
        scope: "gitlode.execution",
        attributes: { "gitlode.plugin.init.result": "ready" },
      }),
    );
    const snapshot = processor.snapshot();
    expect(snapshot.spans).toEqual([
      expect.objectContaining({
        scope: { name: "@example/plugin", version: null },
        attributes: [expect.objectContaining({ key: "gitlode.plugin.init.result" })],
      }),
      expect.objectContaining({
        scope: { name: "gitlode.execution", version: null },
        attributes: [],
      }),
    ]);
  });

  test("applies single, distinct, min-max, conditional absence, and attribute allowlisting", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const processor = new LocalSpanProcessor(diagnostics);
    const first = fakeSpan("gitlode.run", {
      scope: "gitlode.execution",
      attributes: {
        "gitlode.extraction.granularity": "commit",
        "gitlode.run.result": "success",
        "gitlode.commit.unique.count": 3,
        arbitrary: "discarded",
      },
    });
    processor.onEnd(first);
    processor.onEnd(
      fakeSpan("gitlode.run", {
        scope: "gitlode.execution",
        attributes: {
          "gitlode.extraction.granularity": "commit",
          "gitlode.run.result": "runtime_error",
          "gitlode.commit.unique.count": 8,
        },
      }),
    );
    const snapshot = processor.snapshot();
    expect(snapshot.status).toBe("partial");
    expect(snapshot.spans[0]!.attributes).toEqual([
      {
        key: "gitlode.commit.unique.count",
        reducer: "min_max",
        minimum: 3,
        maximum: 8,
        observedCount: 2,
      },
      {
        key: "gitlode.extraction.granularity",
        reducer: "single",
        value: "commit",
        observedCount: 2,
        conflictCount: 0,
      },
      {
        key: "gitlode.run.result",
        reducer: "single",
        value: "success",
        observedCount: 1,
        conflictCount: 1,
      },
    ]);
    expect(diagnostics.snapshot().diagnostics).toEqual([
      expect.objectContaining({ code: "attribute_reducer_conflict", count: 1 }),
    ]);
    first.attributes.arbitrary = "mutated";
    expect(processor.snapshot()).toEqual(snapshot);
  });

  test("accepts every cataloged bounded value", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const processor = new LocalSpanProcessor(diagnostics);
    for (const value of ["branch", "tag-annotated", "tag-lightweight", "commit-oid"])
      processor.onEnd(
        fakeSpan("gitlode.git.classify_ref", {
          scope: "gitlode.git",
          attributes: { "gitlode.git.ref.type": value },
        }),
      );
    const summary = processor
      .snapshot()
      .spans.find((span) => span.name === "gitlode.git.classify_ref")!.attributes[0]!;
    expect(summary).toEqual({
      key: "gitlode.git.ref.type",
      reducer: "distinct",
      values: [
        { value: "branch", count: 1 },
        { value: "commit-oid", count: 1 },
        { value: "tag-annotated", count: 1 },
        { value: "tag-lightweight", count: 1 },
      ],
      observedCount: 4,
      overflowCount: 0,
    });
    expect(processor.snapshot().status).toBe("complete");
  });

  test("rejects an out-of-catalog enum while preserving valid sibling aggregation", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const processor = new LocalSpanProcessor(diagnostics);
    processor.onEnd(
      fakeSpan("gitlode.git.commit.walk", {
        scope: "gitlode.git",
        duration: [2, 0],
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.commit.walk.strategy": "not-a-strategy",
          "gitlode.git.commit.walk.has_exclusion": true,
        },
      }),
    );
    const snapshot = processor.snapshot();
    expect(snapshot.status).toBe("partial");
    expect(snapshot.spans[0]).toEqual(
      expect.objectContaining({
        callCount: 1,
        totalDurationSeconds: 2,
        maxDurationSeconds: 2,
        attributes: [
          expect.objectContaining({ key: "gitlode.git.adapter" }),
          expect.objectContaining({ key: "gitlode.git.commit.walk.has_exclusion" }),
        ],
      }),
    );
    expect(
      snapshot.spans[0]!.attributes.some(
        (attribute) => attribute.key === "gitlode.git.commit.walk.strategy",
      ),
    ).toBe(false);
    expect(diagnostics.snapshot().diagnostics).toEqual([
      expect.objectContaining({ code: "invalid_aggregation", signalCoverage: ["span"] }),
    ]);
  });

  test("accepts a non-enumerated sanitized-version string policy", () => {
    const processor = new LocalSpanProcessor(new BoundedDiagnosticAccumulator());
    processor.onEnd(
      fakeSpan("gitlode.git.cli.version.check", {
        scope: "gitlode.git",
        attributes: { "gitlode.git.cli.version": "2.51.0.windows.1" },
      }),
    );
    expect(processor.snapshot()).toEqual({
      status: "complete",
      spans: [
        expect.objectContaining({
          attributes: [
            expect.objectContaining({
              key: "gitlode.git.cli.version",
              value: "2.51.0.windows.1",
            }),
          ],
        }),
      ],
    });
  });

  test.each([127, 128, 129])("bounds span groups at %i", (count) => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const processor = new LocalSpanProcessor(diagnostics);
    const spans = Array.from({ length: count }, (_, index) => fakeSpan(`plugin.span.${index}`));
    expect(() => spans.forEach((span) => processor.onEnd(span))).not.toThrow();
    const snapshot = processor.snapshot();
    expect(snapshot.spans).toHaveLength(Math.min(count, 128));
    expect(snapshot.spans.some((span) => span.name === "span_group_overflow")).toBe(false);
    if (count > 128) {
      expect(snapshot.spans.some((span) => span.name === "plugin.span.0")).toBe(true);
      expect(snapshot.spans.some((span) => span.name === "plugin.span.128")).toBe(false);
    }
    expect(snapshot.status).toBe(count > 128 ? "partial" : "complete");
  });

  test("isolates invalid duration and attribute values and does not retain SDK spans", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const processor = new LocalSpanProcessor(diagnostics);
    const span = fakeSpan("gitlode.run", {
      scope: "gitlode.execution",
      duration: [-1, 0],
      attributes: {
        "gitlode.commit.unique.count": Number.NaN,
        "gitlode.run.result": "success",
      },
    });
    processor.onEnd(span);
    const before = processor.snapshot();
    (span as { name: string }).name = "mutated";
    span.attributes["gitlode.run.result"] = "mutated";
    expect(processor.snapshot()).toEqual(before);
    expect(before.status).toBe("partial");
    expect(before.spans[0]).toEqual(
      expect.objectContaining({
        name: "gitlode.run",
        callCount: 1,
        totalDurationSeconds: 0,
        attributes: [expect.objectContaining({ key: "gitlode.run.result" })],
      }),
    );
  });

  test.each([
    [
      "valid-first",
      [
        [0, 10],
        [-1, 0],
      ],
    ],
    [
      "invalid-first",
      [
        [-1, 0],
        [0, 10],
      ],
    ],
  ] as const)(
    "preserves retained mixed-duration values and discloses omission: %s",
    (_name, durations) => {
      const diagnostics = new BoundedDiagnosticAccumulator();
      const processor = new LocalSpanProcessor(diagnostics);
      for (const duration of durations)
        processor.onEnd(fakeSpan("plugin.operation", { duration: [...duration] }));
      const snapshot = processor.snapshot();
      const report = new ProfileReportBuilder(diagnostics).build({
        spans: { status: snapshot.status, values: snapshot.spans },
        counters: { status: "complete", values: [] },
        histograms: { status: "complete", values: [] },
      });
      expect(report.spans[0]).toMatchObject({
        callCount: 2,
        durationContributionCount: 1,
        totalDurationSeconds: 1e-8,
        maxDurationSeconds: 1e-8,
        unavailableFields: [],
      });
      expect(report.signalStatus.spans).toBe("partial");
      expect(formatProfileLines(report).join("\n")).toMatch(/total=.*calls=2, avg=.*max=/);
      expect(formatProfileLines(report).join("\n")).toContain("Invalid aggregation discarded");
      expect(extractProfileReportMeasurements(report).totalEndedSpanCount).toMatchObject({
        status: "available",
        value: 2,
      });
      expect(evaluateRepositoryProfileReport(report).status).toBe("fail");
    },
  );

  test("keeps all duration fields unavailable when every contribution is invalid", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const processor = new LocalSpanProcessor(diagnostics);
    processor.onEnd(fakeSpan("plugin.operation", { duration: [-1, 0] }));
    const report = new ProfileReportBuilder(diagnostics).build({
      spans: {
        status: processor.snapshot().status,
        values: processor.snapshot().spans,
      },
      counters: { status: "complete", values: [] },
      histograms: { status: "complete", values: [] },
    });
    const output = formatProfileLines(report).join("\n");
    expect(report.spans[0]).toMatchObject({
      callCount: 1,
      durationContributionCount: 0,
      totalDurationSeconds: 0,
      maxDurationSeconds: 0,
    });
    expect(output).toMatch(/total=.*calls=1, avg=.*max=/);
    expect(output).not.toContain("total=0 s");
  });

  test("keeps mixed-duration quality visible after diagnostic detail overflow", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    for (let index = 0; index < 15; index += 1)
      diagnostics.add({
        code: "lifecycle_failure",
        stage: "telemetry_shutdown",
        target: {
          type: "observation",
          scope: { name: "scope", version: null },
          kind: "span",
          name: `notice-${index}`,
        },
        signalCoverage: ["span"],
        effects: ["lifecycle_notice"],
        extent: "unidentified_subset",
      });
    const processor = new LocalSpanProcessor(diagnostics);
    processor.onEnd(fakeSpan("plugin.operation", { duration: [0, 0] }));
    processor.onEnd(fakeSpan("plugin.operation", { duration: [-1, 0] }));
    const snapshot = processor.snapshot();
    const report = new ProfileReportBuilder(diagnostics).build({
      spans: { status: snapshot.status, values: snapshot.spans },
      counters: { status: "complete", values: [] },
      histograms: { status: "complete", values: [] },
    });
    expect(report.spans[0]).toMatchObject({
      totalDurationSeconds: 0,
      maxDurationSeconds: 0,
      durationContributionCount: 1,
      unavailableFields: [],
    });
    expect(report.diagnostics.at(-1)).toMatchObject({
      code: "diagnostic_overflow",
      effectsByKind: [
        expect.objectContaining({ kind: "span", effects: ["incomplete_measurement_fields"] }),
      ],
    });
    const output = formatProfileLines(report).join("\n");
    expect(output).toContain("Spans (partial)");
    expect(output).toContain("Additional diagnostics omitted");
    expect(evaluateRepositoryProfileReport(report).status).toBe("fail");
  });

  test("works as a real SDK span processor", async () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const processor = new LocalSpanProcessor(diagnostics);
    const provider = new BasicTracerProvider({ spanProcessors: [processor] });
    const span = provider.getTracer("plugin.real").startSpan("real.operation");
    span.end();
    await provider.forceFlush();
    const aggregate = processor.snapshot().spans[0]!;
    expect(aggregate.scope).toEqual({ name: "plugin.real", version: null });
    expect(aggregate.callCount).toBe(1);
    expect(aggregate.totalDurationSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(aggregate.maxDurationSeconds)).toBe(true);
    await provider.shutdown();
  });
});

describe("local metrics", () => {
  test("uses the documented finite collection timeout by default", () => {
    expect(DEFAULT_LOCAL_METRIC_COLLECTION_TIMEOUT_MILLIS).toBe(1_000);
  });

  test("derives exact histogram views from catalog metadata", () => {
    const views = createLocalMetricViews();
    const histograms = TELEMETRY_METRICS.filter((metric) => metric.instrument === "histogram");
    expect(views).toHaveLength(histograms.length);
    for (const metric of histograms) {
      const view = views.find((candidate) => candidate.instrumentName === metric.name)!;
      expect(view).toMatchObject({ instrumentName: metric.name, instrumentUnit: metric.unit });
      expect(view.aggregation).toEqual({
        type: 4,
        options: { boundaries: [...metric.explicitBucketBoundaries], recordMinMax: true },
      });
    }
  });

  test("separates counters and histograms, sorts attributes, and uses canonical units", () => {
    const counter = getTelemetryMetricMetadata("git_object_read");
    const histogram = getTelemetryMetricMetadata("file_change_expansion_size");
    const diagnostics = new BoundedDiagnosticAccumulator();
    const snapshot = convertLocalMetrics(
      {
        resource: {} as ResourceMetrics["resource"],
        scopeMetrics: [
          {
            scope: { name: "gitlode.git" },
            metrics: [
              sumMetric(counter.name, [
                {
                  value: 0,
                  attributes: {
                    "gitlode.git.object.purpose": "topology",
                    "gitlode.git.object.type": "commit",
                    "gitlode.git.adapter": "isomorphic-git",
                  },
                },
              ]),
            ],
          },
          {
            scope: { name: "gitlode.extraction" },
            metrics: [histogramMetric(histogram.name, histogram.explicitBucketBoundaries)],
          },
        ],
      },
      diagnostics,
    );
    expect(snapshot.counters).toEqual([
      expect.objectContaining({
        name: counter.name,
        unit: counter.unit,
        value: 0,
        attributes: [
          { key: "gitlode.git.adapter", value: "isomorphic-git" },
          { key: "gitlode.git.object.purpose", value: "topology" },
          { key: "gitlode.git.object.type", value: "commit" },
        ],
      }),
    ]);
    expect(snapshot.histograms).toEqual([
      expect.objectContaining({
        name: histogram.name,
        unit: histogram.unit,
        count: 3,
        sum: 5,
        minimum: 0,
        maximum: 4,
        explicitBounds: [...histogram.explicitBucketBoundaries],
      }),
    ]);
    expect("samples" in snapshot.histograms[0]!).toBe(false);
  });

  test("distinguishes absence from explicit zero and excludes unknown metrics", () => {
    const metric = getTelemetryMetricMetadata("output_file_created");
    const diagnostics = new BoundedDiagnosticAccumulator();
    expect(
      convertLocalMetrics(resourceMetrics("gitlode.extraction", []), diagnostics).counters,
    ).toEqual([]);
    const snapshot = convertLocalMetrics(
      resourceMetrics("gitlode.extraction", [
        sumMetric(metric.name, [{ value: 0 }]),
        sumMetric("unknown.metric", [{ value: 1 }]),
      ]),
      diagnostics,
    );
    expect(snapshot.counters).toHaveLength(1);
    expect(snapshot.counters[0]!.value).toBe(0);
  });

  test("retains host-owned projection metrics under resolved and fallback plugin scopes", () => {
    const counter = getTelemetryMetricMetadata("plugin_projection_operation");
    const histogram = getTelemetryMetricMetadata("plugin_projection_duration");
    const diagnostics = new BoundedDiagnosticAccumulator();
    const snapshot = convertLocalMetrics(
      {
        resource: {} as ResourceMetrics["resource"],
        scopeMetrics: [
          {
            scope: { name: "@example/plugin", version: "1.2.3" },
            metrics: [
              sumMetric(counter.name, [
                {
                  value: 1,
                  attributes: {
                    "gitlode.projection.fact.type": "commit",
                    "gitlode.plugin.projection.outcome": "success",
                  },
                },
              ]),
            ],
          },
          {
            scope: { name: "@example/plugin" },
            metrics: [
              sumMetric(counter.name, [
                {
                  value: 1,
                  attributes: {
                    "gitlode.projection.fact.type": "commit",
                    "gitlode.plugin.projection.outcome": "success",
                  },
                },
              ]),
              histogramMetric(histogram.name, histogram.explicitBucketBoundaries, {
                "gitlode.projection.fact.type": "file-change",
                "gitlode.plugin.projection.outcome": "failure_continued",
              }),
            ],
          },
          {
            scope: { name: "gitlode.plugin.fallback" },
            metrics: [
              sumMetric(counter.name, [
                {
                  value: 1,
                  attributes: {
                    "gitlode.projection.fact.type": "file-change",
                    "gitlode.plugin.projection.outcome": "skip",
                  },
                },
              ]),
            ],
          },
        ],
      },
      diagnostics,
    );
    expect(snapshot.counterStatus).toBe("complete");
    expect(snapshot.histogramStatus).toBe("complete");
    expect(snapshot.counters).toHaveLength(3);
    expect(snapshot.counters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scope: { name: "@example/plugin", version: null } }),
        expect.objectContaining({ scope: { name: "@example/plugin", version: "1.2.3" } }),
        expect.objectContaining({ scope: { name: "gitlode.plugin.fallback", version: null } }),
      ]),
    );
    expect(snapshot.histograms).toEqual([
      expect.objectContaining({ scope: { name: "@example/plugin", version: null } }),
    ]);
    expect(diagnostics.snapshot().diagnostics).toEqual([]);
  });

  test("excludes unknown plugin metrics and core metrics recorded under plugin scopes", () => {
    const coreCounter = getTelemetryMetricMetadata("output_file_created");
    const coreHistogram = getTelemetryMetricMetadata("file_change_expansion_size");
    const diagnostics = new BoundedDiagnosticAccumulator();
    const snapshot = convertLocalMetrics(
      resourceMetrics("plugin.package", [
        sumMetric("plugin.created.counter", [{ value: 1 }]),
        histogramMetric("plugin.created.histogram", [0, 1]),
        sumMetric(coreCounter.name, [{ value: 1 }]),
        histogramMetric(coreHistogram.name, coreHistogram.explicitBucketBoundaries),
      ]),
      diagnostics,
    );
    expect(snapshot.counters).toEqual([]);
    expect(snapshot.histograms).toEqual([]);
    expect(snapshot.counterStatus).toBe("complete");
    expect(snapshot.histogramStatus).toBe("complete");
    expect(diagnostics.snapshot().diagnostics).toEqual([]);
  });

  test("isolates a resolved-plugin metric missing a required attribute", () => {
    const metric = getTelemetryMetricMetadata("plugin_projection_operation");
    const diagnostics = new BoundedDiagnosticAccumulator();
    const snapshot = convertLocalMetrics(
      resourceMetrics("@example/plugin", [
        sumMetric(metric.name, [
          {
            value: 1,
            attributes: { "gitlode.projection.fact.type": "commit" },
          },
        ]),
      ]),
      diagnostics,
    );
    expect(snapshot.counterStatus).toBe("partial");
    expect(snapshot.counters).toEqual([]);
    expect(diagnostics.snapshot().diagnostics).toEqual([
      expect.objectContaining({ code: "invalid_aggregation", signalCoverage: ["counter"] }),
    ]);
  });

  test("excludes arbitrary plugin metrics even beside a host-reserved name", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    expect(
      convertLocalMetrics(
        resourceMetrics("plugin.package", [sumMetric("plugin.package.custom", [{ value: 1 }])]),
        diagnostics,
      ).counters,
    ).toEqual([]);
  });

  test("rejects an out-of-catalog enum while preserving a valid sibling point", () => {
    const metric = getTelemetryMetricMetadata("git_object_read");
    const diagnostics = new BoundedDiagnosticAccumulator();
    const snapshot = convertLocalMetrics(
      resourceMetrics("gitlode.git", [
        sumMetric(metric.name, [
          {
            value: 1,
            attributes: {
              "gitlode.git.adapter": "isomorphic-git",
              "gitlode.git.object.type": "commit",
              "gitlode.git.object.purpose": "topology",
            },
          },
          {
            value: 1,
            attributes: {
              "gitlode.git.adapter": "isomorphic-git",
              "gitlode.git.object.type": "blob",
              "gitlode.git.object.purpose": "not-a-purpose",
            },
          },
        ]),
      ]),
      diagnostics,
    );
    expect(snapshot.counterStatus).toBe("partial");
    expect(snapshot.counters).toEqual([
      expect.objectContaining({
        attributes: expect.arrayContaining([
          { key: "gitlode.git.object.purpose", value: "topology" },
        ]),
      }),
    ]);
    expect(diagnostics.snapshot().diagnostics).toEqual([
      expect.objectContaining({ code: "invalid_aggregation", signalCoverage: ["counter"] }),
    ]);
  });

  test("isolates invalid datapoints while retaining valid siblings", () => {
    const metric = getTelemetryMetricMetadata("output_file_created");
    const diagnostics = new BoundedDiagnosticAccumulator();
    const snapshot = convertLocalMetrics(
      resourceMetrics("gitlode.extraction", [
        sumMetric(metric.name, [{ value: Number.NaN }, { value: 2 }]),
      ]),
      diagnostics,
    );
    expect(snapshot.counterStatus).toBe("partial");
    expect(snapshot.counters).toEqual([expect.objectContaining({ value: 2 })]);
    expect(diagnostics.snapshot().diagnostics).toEqual([
      expect.objectContaining({
        code: "invalid_aggregation",
        signalCoverage: ["counter"],
        target: {
          type: "point",
          scope: { name: "gitlode.extraction", version: null },
          kind: "counter",
          name: metric.name,
          attributes: [],
        },
        effects: ["missing_observations"],
        extent: "entire_target",
        lossQuantity: expect.objectContaining({ descriptor: "observation_results", value: 1 }),
      }),
    ]);
  });

  test("broadens invalid attributes only to the known observation", () => {
    const metric = getTelemetryMetricMetadata("git_object_read");
    const diagnostics = new BoundedDiagnosticAccumulator();
    convertLocalMetrics(
      resourceMetrics("gitlode.git", [
        sumMetric(metric.name, [{ value: 1, attributes: { unexpected: "value" } }]),
      ]),
      diagnostics,
    );
    expect(diagnostics.snapshot().diagnostics[0]).toMatchObject({
      target: {
        type: "observation",
        scope: { name: "gitlode.git", version: null },
        kind: "counter",
        name: metric.name,
      },
      extent: "unidentified_subset",
    });
  });

  test("keeps exact point identity for histogram invalidity and point overflow", () => {
    const histogram = getTelemetryMetricMetadata("line_diff_compute_duration");
    const invalidMetric = histogramMetric(histogram.name, histogram.explicitBucketBoundaries, {
      "gitlode.line_diff.compute.outcome": "success",
    });
    (invalidMetric.dataPoints[0]!.value as { count: number }).count = 0;
    const invalidDiagnostics = new BoundedDiagnosticAccumulator();
    convertLocalMetrics(resourceMetrics("gitlode.line_diff", [invalidMetric]), invalidDiagnostics);
    expect(invalidDiagnostics.snapshot().diagnostics[0]).toMatchObject({
      target: {
        type: "point",
        scope: { name: "gitlode.line_diff", version: null },
        kind: "histogram",
        name: histogram.name,
        attributes: [{ key: "gitlode.line_diff.compute.outcome", value: "success" }],
      },
    });

    const counter = getTelemetryMetricMetadata("extraction_commit_accepted");
    const limits = PROFILE_COLLECTION_LIMITS as { metricPointsPerInstrument: number };
    const originalLimit = limits.metricPointsPerInstrument;
    limits.metricPointsPerInstrument = 1;
    try {
      const overflowDiagnostics = new BoundedDiagnosticAccumulator();
      convertLocalMetrics(
        resourceMetrics("gitlode.extraction", [
          sumMetric(counter.name, [
            { value: 1, attributes: { "gitlode.extraction.granularity": "commit" } },
            { value: 1, attributes: { "gitlode.extraction.granularity": "file" } },
          ]),
        ]),
        overflowDiagnostics,
      );
      expect(overflowDiagnostics.snapshot().diagnostics[0]).toMatchObject({
        code: "metric_point_overflow",
        target: {
          type: "point",
          scope: { name: "gitlode.extraction", version: null },
          kind: "counter",
          name: counter.name,
          attributes: [{ key: "gitlode.extraction.granularity", value: "file" }],
        },
        effects: ["missing_observations"],
        extent: "entire_target",
        lossQuantity: expect.objectContaining({ descriptor: "metric_points", value: 1 }),
      });
    } finally {
      limits.metricPointsPerInstrument = originalLimit;
    }
  });

  test("isolates an invalid histogram aggregation from a valid sibling", () => {
    const metric = getTelemetryMetricMetadata("line_diff_compute_duration");
    const valid = histogramMetric(metric.name, metric.explicitBucketBoundaries, {
      "gitlode.line_diff.compute.outcome": "success",
    });
    const invalid = histogramMetric(metric.name, metric.explicitBucketBoundaries, {
      "gitlode.line_diff.compute.outcome": "error",
    });
    const invalidValue = invalid.dataPoints[0]!.value;
    if (typeof invalidValue !== "number" && "buckets" in invalidValue)
      invalidValue.buckets.counts = [1];
    const diagnostics = new BoundedDiagnosticAccumulator();
    const snapshot = convertLocalMetrics(
      resourceMetrics("gitlode.line_diff", [valid, invalid]),
      diagnostics,
    );
    expect(snapshot.histogramStatus).toBe("partial");
    expect(snapshot.histograms).toHaveLength(1);
    expect(snapshot.histograms[0]!.attributes).toEqual([
      { key: "gitlode.line_diff.compute.outcome", value: "success" },
    ]);
  });

  test("collects once from a real SDK provider with catalog views", async () => {
    const reader = new LocalMetricReader();
    const provider = new MeterProvider({ readers: [reader], views: createLocalMetricViews() });
    const metric = getTelemetryMetricMetadata("file_change_expansion_size");
    provider
      .getMeter("gitlode.extraction")
      .createHistogram(metric.name, { unit: metric.unit })
      .record(0);
    const diagnostics = new BoundedDiagnosticAccumulator();
    const snapshot = await reader.collectSnapshot(diagnostics);
    expect(snapshot.histogramStatus).toBe("complete");
    expect(snapshot.histograms[0]).toEqual(
      expect.objectContaining({ count: 1, sum: 0, minimum: 0, maximum: 0 }),
    );
    expect(snapshot.histograms[0]!.explicitBounds).toEqual(metric.explicitBucketBoundaries);
    await provider.shutdown();
  });
});

describe("profile report builder", () => {
  const scope = { name: "scope", version: null } as const;
  const span = (name: string): ProfileSpanAggregate => ({
    scope,
    name,
    callCount: 1,
    errorCount: 0,
    totalDurationSeconds: 0,
    maxDurationSeconds: 0,
    durationContributionCount: 1,
    unavailableFields: [],
    attributes: [],
  });
  const counter = (name: string, value = 1): ProfileCounterPoint => ({
    scope,
    name,
    unit: "{item}",
    attributes: [],
    value,
    unavailableFields: [],
  });
  const histogram = (name: string): ProfileHistogramPoint => ({
    scope,
    name,
    unit: "s",
    attributes: [],
    count: 1,
    sum: 0,
    minimum: 0,
    maximum: 0,
    explicitBounds: [0],
    bucketCounts: [1, 0],
    unavailableFields: [],
  });

  test("distinguishes complete, partial, and unavailable empty signals", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const report = new ProfileReportBuilder(diagnostics).build({
      spans: { status: "complete", values: [] },
      counters: { status: "partial", values: [] },
      histograms: { status: "unavailable", values: [histogram("discarded")] },
    });
    expect(report.schemaVersion).toBe(2);
    expect(report.signalStatus).toEqual({
      spans: "complete",
      counters: "partial",
      histograms: "partial",
    });
    expect(report.spans).toEqual([]);
    expect(report.counters).toEqual([]);
    expect(report.histograms).toEqual([expect.objectContaining({ name: "discarded" })]);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({ code: "invalid_aggregation", signalCoverage: ["histogram"] }),
    ]);
  });

  test("canonicalizes shuffled inputs and creates a structured-clone-safe detached report", () => {
    const build = (reverse: boolean): ProfileReport => {
      const input = emptyInput();
      const values = reverse ? [span("z"), span("a")] : [span("a"), span("z")];
      return new ProfileReportBuilder(new BoundedDiagnosticAccumulator()).build({
        ...input,
        spans: { status: "complete", values },
        counters: { status: "complete", values: [counter("z"), counter("a")] },
        histograms: { status: "complete", values: [histogram("z"), histogram("a")] },
      });
    };
    const report = build(true);
    expect(report).toEqual(build(false));
    expect(structuredClone(report)).toEqual(report);
    expect(report.spans.map((item) => item.name)).toEqual(["a", "z"]);
    (report.spans[0] as { callCount: number }).callCount = 99;
    expect(build(true).spans[0]!.callCount).toBe(1);
  });

  test("drops invalid values, normalizes negative zero, and preserves valid siblings", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const report = new ProfileReportBuilder(diagnostics).build({
      spans: { status: "complete", values: [span("valid")] },
      counters: {
        status: "complete",
        values: [
          counter("negative-zero", -0),
          counter("nan", Number.NaN),
          counter("infinity", Number.POSITIVE_INFINITY),
          { ...counter("undefined"), value: undefined } as unknown as ProfileCounterPoint,
        ],
      },
      histograms: { status: "complete", values: [histogram("valid")] },
    });
    expect(report.signalStatus.counters).toBe("partial");
    expect(report.counters).toEqual([expect.objectContaining({ name: "negative-zero", value: 0 })]);
    expect(Object.is(report.counters[0]!.value, -0)).toBe(false);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({ code: "invalid_aggregation", signalCoverage: ["counter"] }),
    ]);
  });

  test("isolates throwing values and separately reports unknown iterator loss", () => {
    const throwing = counter("throwing") as ProfileCounterPoint & { value: number };
    Object.defineProperty(throwing, "value", {
      get() {
        throw new Error("unsafe getter");
      },
    });
    for (const values of [
      [throwing, counter("later")],
      [counter("before"), throwing, counter("after")],
    ]) {
      const diagnostics = new BoundedDiagnosticAccumulator();
      const report = new ProfileReportBuilder(diagnostics).build({
        spans: { status: "complete", values: [] },
        counters: { status: "complete", values },
        histograms: { status: "complete", values: [] },
      });
      expect(report.counters.map((point) => point.name)).toEqual(
        values.length === 2 ? ["later"] : ["after", "before"],
      );
      expect(report.diagnostics[0]).toMatchObject({
        lossQuantity: expect.objectContaining({ value: 1 }),
      });
    }

    const iterable = {
      [Symbol.iterator]() {
        let read = false;
        return {
          next() {
            if (!read) {
              read = true;
              return { done: false as const, value: counter("obtained") };
            }
            throw new Error("iterator failed");
          },
        };
      },
    };
    const iteratorDiagnostics = new BoundedDiagnosticAccumulator();
    const iteratorReport = new ProfileReportBuilder(iteratorDiagnostics).build({
      spans: { status: "complete", values: [] },
      counters: {
        status: "complete",
        values: iterable as unknown as readonly ProfileCounterPoint[],
      },
      histograms: { status: "complete", values: [] },
    });
    expect(iteratorReport.counters.map((point) => point.name)).toEqual(["obtained"]);
    expect(iteratorReport.diagnostics[0]).toMatchObject({
      lossQuantity: expect.objectContaining({ value: null }),
    });
  });

  test("detaches the report from source input mutation", () => {
    const sourceSpan = span("original");
    const sourceCounter = counter("counter");
    const report = new ProfileReportBuilder(new BoundedDiagnosticAccumulator()).build({
      spans: { status: "complete", values: [sourceSpan] },
      counters: { status: "complete", values: [sourceCounter] },
      histograms: { status: "complete", values: [] },
    });
    (sourceSpan as { name: string }).name = "mutated";
    (sourceCounter as { value: number }).value = 99;
    expect(report.spans[0]!.name).toBe("original");
    expect(report.counters[0]!.value).toBe(1);
  });

  test("contains no schema-external runtime values", () => {
    const report = new ProfileReportBuilder(new BoundedDiagnosticAccumulator()).build(emptyInput());
    const visit = (value: unknown): void => {
      if (value === null || typeof value === "string" || typeof value === "boolean") return;
      if (typeof value === "number") {
        expect(Number.isFinite(value)).toBe(true);
        expect(Object.is(value, -0)).toBe(false);
        return;
      }
      expect(typeof value).toBe("object");
      expect(value).not.toBeInstanceOf(Map);
      expect(value).not.toBeInstanceOf(Set);
      expect(value).not.toBeInstanceOf(Error);
      expect(ArrayBuffer.isView(value)).toBe(false);
      if (Array.isArray(value)) value.forEach(visit);
      else {
        expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
        Object.values(value as Record<string, unknown>).forEach(visit);
      }
    };
    visit(report);
  });
});
