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

import {
  BoundedDiagnosticAccumulator,
  convertLocalMetrics,
  createLocalMetricViews,
  LocalMetricReader,
  LocalSpanProcessor,
  ProfileReportBuilder,
} from "../../src/execution/telemetry/index.js";

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
          signal: "report",
          message: `failure-${index}`,
        });
      const snapshot = diagnostics.snapshot();
      expect(snapshot).toHaveLength(Math.min(count, PROFILE_COLLECTION_LIMITS.diagnostics.maximum));
      const overflow = snapshot.find((entry) => entry.code === "diagnostic_overflow");
      expect(overflow?.count ?? 0).toBe(Math.max(0, count - 15));
    },
  );

  test("deduplicates, derives severity, bounds messages, and never expands errors", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const long = "x".repeat(600);
    diagnostics.add({
      code: "lifecycle_failure",
      stage: "metric_collection",
      signal: "telemetry",
      message: long,
    });
    diagnostics.add({
      code: "lifecycle_failure",
      stage: "metric_collection",
      signal: "telemetry",
      message: long,
    });
    diagnostics.add({
      code: "lifecycle_failure",
      stage: "metric_collection",
      signal: "telemetry",
      message: new Error("secret"),
    });
    expect(diagnostics.snapshot()).toEqual([
      expect.objectContaining({ count: 1, message: null, severity: "warning" }),
      expect.objectContaining({ count: 2, message: "x".repeat(512), severity: "warning" }),
    ]);
  });
});

describe("local span processor", () => {
  test("uses scope/version/name identity and aggregates status-derived errors and duration", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const processor = new LocalSpanProcessor(diagnostics);
    processor.onEnd(
      fakeSpan("plugin.operation", { duration: [1, 0], events: [{ name: "exception" }] }),
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
        }),
        expect.objectContaining({
          scope: { name: "plugin.example", version: "1.0.0" },
          callCount: 2,
          errorCount: 1,
          totalDurationSeconds: 5,
          maxDurationSeconds: 3,
        }),
      ],
    });
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
    expect(diagnostics.snapshot()).toEqual([
      expect.objectContaining({ code: "attribute_reducer_conflict", count: 1 }),
    ]);
    first.attributes.arbitrary = "mutated";
    expect(processor.snapshot()).toEqual(snapshot);
  });

  test.each([15, 16, 17])("bounds distinct values at %i observations", (count) => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const processor = new LocalSpanProcessor(diagnostics);
    for (let index = 0; index < count; index += 1)
      processor.onEnd(
        fakeSpan("gitlode.git.resolve_ref", {
          scope: "gitlode.git",
          attributes: { "gitlode.git.adapter": "isomorphic-git" },
        }),
      );
    // resolve_ref has a single reducer; use classify_ref's distinct terminal attribute.
    for (let index = 0; index < count; index += 1)
      processor.onEnd(
        fakeSpan("gitlode.git.classify_ref", {
          scope: "gitlode.git",
          attributes: { "gitlode.git.ref.type": `type-${index}` },
        }),
      );
    const summary = processor
      .snapshot()
      .spans.find((span) => span.name === "gitlode.git.classify_ref")!.attributes[0]!;
    expect(summary.reducer).toBe("distinct");
    if (summary.reducer !== "distinct") return;
    expect(summary.values).toHaveLength(Math.min(count, 16));
    expect(summary.overflowCount).toBe(Math.max(0, count - 16));
    if (count > 16) {
      expect(summary.values.some((entry) => entry.value === "type-0")).toBe(true);
      expect(summary.values.some((entry) => entry.value === "type-16")).toBe(false);
    }
    expect(processor.snapshot().status).toBe(count > 16 ? "partial" : "complete");
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

  test("distinguishes absence from explicit zero and excludes plugin and unknown metrics", () => {
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
    expect(
      convertLocalMetrics(
        resourceMetrics("plugin.package", [
          sumMetric("gitlode.plugin.projection.operation", [{ value: 1 }]),
        ]),
        diagnostics,
      ).counters,
    ).toEqual([]);
  });

  test.each([127, 128, 129])("bounds metric points per instrument at %i", (count) => {
    const metric = getTelemetryMetricMetadata("git_object_read");
    const diagnostics = new BoundedDiagnosticAccumulator();
    const points = Array.from({ length: count }, (_, index) => ({
      value: 1,
      attributes: {
        "gitlode.git.adapter": "isomorphic-git",
        "gitlode.git.object.type": "commit",
        "gitlode.git.object.purpose": `purpose-${index}`,
      },
    }));
    const snapshot = convertLocalMetrics(
      resourceMetrics("gitlode.git", [sumMetric(metric.name, points)]),
      diagnostics,
    );
    expect(snapshot.counters).toHaveLength(Math.min(count, 128));
    expect(snapshot.counters.some((point) => point.name === "metric_point_overflow")).toBe(false);
    if (count > 128) {
      expect(
        snapshot.counters.some((point) =>
          point.attributes.some((attribute) => attribute.value === "purpose-0"),
        ),
      ).toBe(true);
      expect(
        snapshot.counters.some((point) =>
          point.attributes.some((attribute) => attribute.value === "purpose-128"),
        ),
      ).toBe(false);
    }
    expect(snapshot.counterStatus).toBe(count > 128 ? "partial" : "complete");
    expect(
      diagnostics.snapshot().find((entry) => entry.code === "metric_point_overflow")?.count ?? 0,
    ).toBe(Math.max(0, count - 128));
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
    expect(diagnostics.snapshot()).toEqual([
      expect.objectContaining({ code: "invalid_aggregation", signal: "counters" }),
    ]);
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
    attributes: [],
  });
  const counter = (name: string, value = 1): ProfileCounterPoint => ({
    scope,
    name,
    unit: "{item}",
    attributes: [],
    value,
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
  });

  test("distinguishes complete, partial, and unavailable empty signals", () => {
    const diagnostics = new BoundedDiagnosticAccumulator();
    const report = new ProfileReportBuilder(diagnostics).build({
      spans: { status: "complete", values: [] },
      counters: { status: "partial", values: [] },
      histograms: { status: "unavailable", values: [histogram("discarded")] },
    });
    expect(report.schemaVersion).toBe(1);
    expect(report.signalStatus).toEqual({
      spans: "complete",
      counters: "partial",
      histograms: "unavailable",
    });
    expect(report.spans).toEqual([]);
    expect(report.counters).toEqual([]);
    expect(report.histograms).toEqual([]);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({ code: "lifecycle_failure", signal: "counters" }),
      expect.objectContaining({ code: "lifecycle_failure", signal: "histograms" }),
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
      expect.objectContaining({ code: "invalid_aggregation", signal: "counters" }),
    ]);
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
