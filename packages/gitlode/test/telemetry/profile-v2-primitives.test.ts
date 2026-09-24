import type {
  ProfileCounterPointV2,
  ProfileHistogramPointV2,
  ProfileSpanAggregateV2,
} from "@gitlode/internal-contracts/telemetry";
import { describe, expect, it } from "vitest";

import {
  BoundedProfileDiagnosticAccumulatorV2,
  createFixedProfileReportFallbackV2,
  deriveCounterNumericAvailabilityV2,
  deriveHistogramNumericAvailabilityV2,
  deriveProfileSignalStatusV2,
  deriveSpanNumericAvailabilityV2,
} from "../../src/execution/telemetry/index.js";
import type { ProfileDiagnosticInputV2 } from "../../src/execution/telemetry/index.js";

const scope = { name: "example.scope", version: null } as const;

function issue(
  name: string,
  overrides: Partial<ProfileDiagnosticInputV2> = {},
): ProfileDiagnosticInputV2 {
  return {
    code: "attribute_reducer_conflict",
    stage: "span_aggregation",
    target: { type: "observation", scope, kind: "span", name },
    signalCoverage: ["span"],
    effects: ["missing_attribute_detail"],
    extent: "unidentified_subset",
    attributeKey: { type: "exact", key: "example.mode" },
    affectedFields: [],
    ...overrides,
  };
}

describe("v2 diagnostic accumulation", () => {
  it("deduplicates only complete canonical identities", () => {
    const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
    accumulator.add(issue("work", { attributeKey: { type: "exact", key: "b" } }));
    accumulator.add(issue("work", { attributeKey: { type: "exact", key: "a" } }));
    accumulator.add(issue("work", { attributeKey: { type: "exact", key: "a" } }));
    accumulator.add(issue("work", { attributeKey: { type: "not_applicable" } }));
    accumulator.add(issue("work", { attributeKey: { type: "discarded" } }));
    accumulator.add(issue("work", { signalCoverage: ["span", "counter"] }));
    accumulator.add(issue("work", { effects: ["lifecycle_notice"] }));
    accumulator.add(
      issue("work", {
        effects: ["incomplete_measurement_fields"],
        affectedFields: [{ kind: "span", fields: ["total"] }],
      }),
    );

    const diagnostics = accumulator.snapshot().diagnostics;
    expect(diagnostics).toHaveLength(7);
    expect(
      diagnostics.find(
        (item) => item.attributeKey.type === "exact" && item.attributeKey.key === "a",
      )?.count,
    ).toBe(2);
  });

  it("canonicalizes sets and typed point attributes", () => {
    const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
    accumulator.add(
      issue("metric", {
        code: "invalid_aggregation",
        stage: "metric_collection",
        target: {
          type: "point",
          scope,
          kind: "counter",
          name: "metric",
          attributes: [
            { key: "z", value: "1" },
            { key: "a", value: 1 },
          ],
        },
        signalCoverage: ["span", "counter", "span"],
        effects: ["unknown_collection_coverage", "missing_observations"],
        affectedFields: [{ kind: "counter", fields: ["value"] }],
      }),
    );
    const diagnostic = accumulator.snapshot().diagnostics[0]!;
    expect(diagnostic.signalCoverage).toEqual(["counter", "span"]);
    expect(diagnostic.effects).toEqual(["missing_observations", "unknown_collection_coverage"]);
    expect(diagnostic.target).toMatchObject({
      type: "point",
      attributes: [
        { key: "a", value: 1 },
        { key: "z", value: "1" },
      ],
    });
  });

  it("merges only known disjoint quantities and saturates safely", () => {
    const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
    const quantity = {
      descriptor: "metric_points" as const,
      unit: "points",
      value: Number.MAX_SAFE_INTEGER,
      relationship: "disjoint" as const,
    };
    accumulator.add(issue("known", { lossQuantity: quantity, count: Number.MAX_SAFE_INTEGER }));
    accumulator.add(issue("known", { lossQuantity: { ...quantity, value: 2 } }));
    accumulator.add(issue("unknown", { lossQuantity: { ...quantity, value: 2 } }));
    accumulator.add(
      issue("unknown", {
        lossQuantity: { ...quantity, value: 3, relationship: "overlapping_or_unknown" },
      }),
    );
    accumulator.add(
      issue("different", {
        lossQuantity: {
          descriptor: "span_attribute_values",
          unit: "values",
          value: 2,
          relationship: "disjoint",
        },
      }),
    );
    const diagnostics = accumulator.snapshot().diagnostics;
    expect(
      diagnostics.find(
        (item) => item.target.type === "observation" && item.target.name === "known",
      ),
    ).toMatchObject({
      count: Number.MAX_SAFE_INTEGER,
      countSaturated: true,
      lossQuantity: { value: Number.MAX_SAFE_INTEGER, saturated: true },
    });
    expect(
      diagnostics.find(
        (item) => item.target.type === "observation" && item.target.name === "unknown",
      )?.lossQuantity?.value,
    ).toBeNull();
    expect(diagnostics).toHaveLength(3);

    const descriptors = new BoundedProfileDiagnosticAccumulatorV2();
    descriptors.add(issue("same", { lossQuantity: { ...quantity, value: 1 } }));
    descriptors.add(
      issue("same", {
        lossQuantity: {
          descriptor: "span_attribute_values",
          unit: "values",
          value: 1,
          relationship: "disjoint",
        },
      }),
    );
    expect(descriptors.snapshot().diagnostics).toHaveLength(2);
  });

  it("accounts for escaping within the 4096-code-unit structured detail budget", () => {
    const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
    accumulator.add(issue("plain", { attributeKey: { type: "exact", key: "x".repeat(3500) } }));
    accumulator.add(issue("escaped", { attributeKey: { type: "exact", key: "\\".repeat(3500) } }));
    const [plain, escaped] = accumulator.snapshot().diagnostics;
    expect(plain?.attributeKey.type).toBe("exact");
    expect(escaped?.attributeKey).toEqual({ type: "discarded" });
    expect(escaped?.detailLoss.attributeKey).toBe(true);
    for (const diagnostic of [plain, escaped]) {
      expect(
        JSON.stringify({
          target: diagnostic?.target,
          signalCoverage: diagnostic?.signalCoverage,
          effects: diagnostic?.effects,
          extent: diagnostic?.extent,
          attributeKey: diagnostic?.attributeKey,
          affectedFields: diagnostic?.affectedFields,
          detailLoss: diagnostic?.detailLoss,
          lossQuantity: diagnostic?.lossQuantity,
        }).length,
      ).toBeLessThanOrEqual(4096);
    }
  });

  it("summarizes a record whose retained fixed distinctions cannot fit the detail budget", () => {
    const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
    accumulator.add(
      issue("quantity", {
        lossQuantity: {
          descriptor: "metric_points",
          unit: "u".repeat(3900),
          value: 1,
          relationship: "disjoint",
        },
      }),
    );
    const snapshot = accumulator.snapshot();
    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.summary).toMatchObject({
      omittedOccurrences: 1,
      maximumSeverity: "warning",
      signalCoverage: ["span"],
    });
  });

  it("retains 15 details and uses one fixed summary above capacity", () => {
    for (const count of [14, 15, 16]) {
      const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
      for (let index = 0; index < count; index += 1) accumulator.add(issue(`work-${index}`));
      const snapshot = accumulator.snapshot();
      expect(snapshot.diagnostics).toHaveLength(Math.min(count, 15));
      expect(snapshot.summary === null).toBe(count <= 15);
      if (count > 15) {
        expect(snapshot.summary).toMatchObject({
          omittedOccurrences: 1,
          maximumSeverity: "warning",
          signalCoverage: ["span"],
          effectsByKind: [{ kind: "span", effects: ["missing_attribute_detail"] }],
        });
      }
    }
  });

  it("broadens over-budget escaped detail without claiming the enclosing target is wholly affected", () => {
    const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
    accumulator.add(
      issue(`${"\\".repeat(4096)}name`, {
        extent: "entire_target",
        effects: ["incomplete_measurement_fields"],
        affectedFields: [{ kind: "span", fields: ["total", "avg"] }],
      }),
    );
    const diagnostic = accumulator.snapshot().diagnostics[0]!;
    expect(diagnostic.target).toEqual({ type: "scope", scope });
    expect(diagnostic.extent).toBe("unidentified_subset");
    expect(diagnostic.detailLoss.observationIdentity).toBe(true);
    expect(diagnostic.affectedFields).toEqual([{ kind: "span", fields: ["total", "avg"] }]);
    expect(diagnostic.effects).toEqual(["incomplete_measurement_fields"]);
    expect(diagnostic.severity).toBe("warning");
    expect(JSON.stringify(diagnostic).length).toBeLessThanOrEqual(4096 + 1024);
  });

  it("does not invent measurement loss for lifecycle-only overflow", () => {
    const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
    for (let index = 0; index < 16; index += 1)
      accumulator.add(
        issue(`shutdown-${index}`, {
          code: "lifecycle_failure",
          stage: "telemetry_shutdown",
          signalCoverage: ["counter"],
          effects: ["lifecycle_notice"],
        }),
      );
    const summary = accumulator.snapshot().summary!;
    expect(summary.effectsByKind).toEqual([
      { kind: "counter", effects: ["lifecycle_notice"], wholeResultUnavailable: false },
    ]);
    expect(summary.effectsByKind[0]!.effects).not.toContain("missing_observations");
  });

  it("preserves signal meaning for lifecycle-only and confirmed whole-loss issues across compaction", () => {
    const statusFor = (
      input: ProfileDiagnosticInputV2,
      retainedBefore: number,
    ): "complete" | "partial" | "unavailable" => {
      const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
      for (let index = 0; index < retainedBefore; index += 1)
        accumulator.add(issue(`retained-${index}`));
      accumulator.add(input);
      return deriveProfileSignalStatusV2(
        { spans: "complete", counters: "complete", histograms: "complete" },
        { spans: retainedBefore, counters: 0, histograms: 0 },
        accumulator.snapshot(),
      ).counters;
    };
    const lifecycleOnly = issue("counter-shutdown", {
      code: "lifecycle_failure",
      stage: "telemetry_shutdown",
      signalCoverage: ["counter"],
      effects: ["lifecycle_notice"],
      wholeResultUnavailable: true,
    });
    const confirmedWholeLoss = issue("counter-collection", {
      code: "lifecycle_failure",
      stage: "metric_collection",
      signalCoverage: ["counter"],
      effects: ["unknown_collection_coverage"],
      wholeResultUnavailable: true,
    });
    const reportDeliveryOnly = issue("report-delivery", {
      code: "lifecycle_failure",
      stage: "report_build",
      signalCoverage: ["counter"],
      effects: ["report_delivery_failure"],
      wholeResultUnavailable: true,
    });

    expect([
      statusFor(lifecycleOnly, 0),
      statusFor(lifecycleOnly, 15),
      statusFor(lifecycleOnly, 16),
    ]).toEqual(["complete", "complete", "complete"]);
    expect([statusFor(confirmedWholeLoss, 0), statusFor(confirmedWholeLoss, 15)]).toEqual([
      "unavailable",
      "unavailable",
    ]);
    expect([statusFor(reportDeliveryOnly, 0), statusFor(reportDeliveryOnly, 15)]).toEqual([
      "complete",
      "complete",
    ]);
  });

  it("marks malformed supplied counts and detail-loss masks as invalid aggregation", () => {
    const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
    accumulator.add(issue("omitted"));
    accumulator.add(
      issue("explicit", {
        count: 2,
        detailLoss: { pointAttributes: false, attributeKey: true },
      }),
    );
    for (const count of [0, -1, 1.5, Number.POSITIVE_INFINITY])
      accumulator.add(issue(`invalid-count-${String(count)}`, { count }));
    for (const detailLoss of [
      null,
      "invalid",
      [],
      { attributeKey: "invalid" },
      { pointAttributes: 1 },
    ])
      accumulator.add(issue("invalid-mask", { detailLoss } as Partial<ProfileDiagnosticInputV2>));

    const diagnostics = accumulator.snapshot().diagnostics;
    expect(diagnostics).toHaveLength(3);
    expect(diagnostics.find((item) => item.code === "invalid_aggregation")).toMatchObject({
      count: 9,
      countSaturated: false,
      detailLoss: {
        pointAttributes: true,
        observationIdentity: true,
        scopeIdentity: true,
        attributeKey: true,
        affectedFields: true,
      },
    });
    expect(
      diagnostics.find(
        (item) => item.target.type === "observation" && item.target.name === "omitted",
      ),
    ).toMatchObject({ count: 1, detailLoss: { attributeKey: false } });
    expect(
      diagnostics.find(
        (item) => item.target.type === "observation" && item.target.name === "explicit",
      ),
    ).toMatchObject({ count: 2, detailLoss: { attributeKey: true } });
  });

  it("sets saturation only for actual overflow and preserves prior saturation", () => {
    const exact = new BoundedProfileDiagnosticAccumulatorV2();
    exact.add(issue("exact", { count: Number.MAX_SAFE_INTEGER - 1 }));
    exact.add(issue("exact", { count: 1 }));
    expect(exact.snapshot().diagnostics[0]).toMatchObject({
      count: Number.MAX_SAFE_INTEGER,
      countSaturated: false,
    });

    const overflow = new BoundedProfileDiagnosticAccumulatorV2();
    const quantity = {
      descriptor: "metric_points" as const,
      unit: "points",
      value: Number.MAX_SAFE_INTEGER - 1,
      relationship: "disjoint" as const,
    };
    overflow.add(issue("overflow", { count: Number.MAX_SAFE_INTEGER, lossQuantity: quantity }));
    overflow.add(issue("overflow", { count: 1, lossQuantity: { ...quantity, value: 2 } }));
    overflow.add(issue("overflow", { count: 1, lossQuantity: { ...quantity, value: 0 } }));
    expect(overflow.snapshot().diagnostics[0]).toMatchObject({
      count: Number.MAX_SAFE_INTEGER,
      countSaturated: true,
      lossQuantity: { value: Number.MAX_SAFE_INTEGER, saturated: true },
    });

    const summary = new BoundedProfileDiagnosticAccumulatorV2();
    for (let index = 0; index < 15; index += 1) summary.add(issue(`retained-${index}`));
    summary.add(issue("summary-exact", { count: Number.MAX_SAFE_INTEGER }));
    expect(summary.snapshot().summary).toMatchObject({
      omittedOccurrences: Number.MAX_SAFE_INTEGER,
      countSaturated: false,
    });
    summary.add(issue("summary-overflow", { count: 1 }));
    summary.add(issue("summary-preserves-saturation", { count: 1 }));
    expect(summary.snapshot().summary).toMatchObject({
      omittedOccurrences: Number.MAX_SAFE_INTEGER,
      countSaturated: true,
    });
  });

  it("bounds duplicate-kind reads before identity construction", () => {
    let indexedReads = 0;
    const kinds = new Proxy(
      Array.from({ length: 100_000 }, () => "span"),
      {
        get(target, property, receiver) {
          if (typeof property === "string" && /^\d+$/.test(property)) indexedReads += 1;
          return Reflect.get(target, property, receiver);
        },
      },
    );
    const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
    accumulator.add(issue("oversized-coverage", { signalCoverage: kinds }));

    expect(indexedReads).toBe(0);
    expect(accumulator.snapshot().diagnostics).toEqual([
      expect.objectContaining({ code: "invalid_aggregation", count: 1 }),
    ]);
  });
});

describe("v2 availability and fallback primitives", () => {
  const span = (overrides: Partial<ProfileSpanAggregateV2> = {}): ProfileSpanAggregateV2 => ({
    scope,
    name: "work",
    callCount: 2,
    errorCount: 0,
    totalDurationSeconds: 0,
    maxDurationSeconds: 0,
    durationContributionCount: 2,
    unavailableFields: [],
    attributes: [],
    ...overrides,
  });

  it("distinguishes genuine zero, partial duration, no duration and field masks", () => {
    expect(deriveSpanNumericAvailabilityV2(span())).toEqual({
      calls: true,
      total: true,
      avg: true,
      max: true,
      errors: true,
    });
    expect(deriveSpanNumericAvailabilityV2(span({ durationContributionCount: 1 })).avg).toBe(false);
    expect(deriveSpanNumericAvailabilityV2(span({ durationContributionCount: 0 }))).toMatchObject({
      total: false,
      avg: false,
      max: false,
    });
    expect(deriveSpanNumericAvailabilityV2(span({ unavailableFields: ["errors"] })).errors).toBe(
      false,
    );
  });

  it("derives counter/histogram optional and average availability", () => {
    const counter: ProfileCounterPointV2 = {
      scope,
      name: "count",
      unit: "{item}",
      attributes: [],
      value: 0,
      unavailableFields: [],
    };
    const histogram: ProfileHistogramPointV2 = {
      scope,
      name: "duration",
      unit: "s",
      attributes: [],
      count: 2,
      sum: 0,
      minimum: null,
      maximum: 0,
      explicitBounds: [],
      bucketCounts: [2],
      unavailableFields: [],
    };
    expect(deriveCounterNumericAvailabilityV2(counter)).toEqual({ value: true });
    expect(deriveHistogramNumericAvailabilityV2(histogram)).toEqual({
      samples: true,
      total: true,
      avg: true,
      min: false,
      max: true,
    });
  });

  it("derives status from trusted effects while ignoring lifecycle-only notices", () => {
    const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
    accumulator.add(issue("span-loss", { effects: ["incomplete_measurement_fields"] }));
    accumulator.add(
      issue("counter-shutdown", {
        code: "lifecycle_failure",
        stage: "telemetry_shutdown",
        signalCoverage: ["counter"],
        effects: ["lifecycle_notice"],
      }),
    );
    expect(
      deriveProfileSignalStatusV2(
        { spans: "complete", counters: "complete", histograms: "unavailable" },
        { spans: 1, counters: 1, histograms: 0 },
        accumulator.snapshot(),
      ),
    ).toEqual({ spans: "partial", counters: "complete", histograms: "unavailable" });
  });

  it("preserves whole-result unavailability through overflow compaction", () => {
    const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
    for (let index = 0; index < 15; index += 1) accumulator.add(issue(`retained-${index}`));
    accumulator.add(
      issue("unavailable", {
        code: "lifecycle_failure",
        stage: "metric_collection",
        signalCoverage: ["histogram"],
        effects: ["unknown_collection_coverage"],
        wholeResultUnavailable: true,
      }),
    );
    expect(
      deriveProfileSignalStatusV2(
        { spans: "complete", counters: "complete", histograms: "partial" },
        { spans: 1, counters: 1, histograms: 0 },
        accumulator.snapshot(),
      ).histograms,
    ).toBe("unavailable");
  });

  it("rejects contradictory unavailable status and retained values without rewriting values", () => {
    const empty = new BoundedProfileDiagnosticAccumulatorV2().snapshot();
    expect(() =>
      deriveProfileSignalStatusV2(
        { spans: "unavailable", counters: "complete", histograms: "complete" },
        { spans: 1, counters: 1, histograms: 0 },
        empty,
      ),
    ).toThrow(/unavailable.*retained/i);
    expect(
      deriveProfileSignalStatusV2(
        { spans: "complete", counters: "unavailable", histograms: "complete" },
        { spans: 1, counters: 0, histograms: 0 },
        empty,
      ),
    ).toEqual({ spans: "complete", counters: "unavailable", histograms: "complete" });

    const full = new BoundedProfileDiagnosticAccumulatorV2();
    for (let index = 0; index < 16; index += 1) full.add(issue(`capacity-${index}`));
    expect(() =>
      deriveProfileSignalStatusV2(
        { spans: "complete", counters: "complete", histograms: "unavailable" },
        { spans: 1, counters: 0, histograms: 1 },
        full.snapshot(),
      ),
    ).toThrow(/unavailable.*retained/i);
  });

  it("constructs a clone-safe minimum fallback without reading unsafe values", () => {
    let reads = 0;
    const unsafe = Object.defineProperty({}, "diagnostics", {
      get() {
        reads += 1;
        throw new Error("must not read");
      },
    });
    const report = createFixedProfileReportFallbackV2(unsafe);
    expect(reads).toBe(0);
    expect({ ...report, diagnostics: undefined }).toMatchObject({
      schemaVersion: 2,
      signalStatus: { spans: "unavailable", counters: "unavailable", histograms: "unavailable" },
      spans: [],
      counters: [],
      histograms: [],
    });
    expect(report.diagnostics[0]).toMatchObject({
      code: "lifecycle_failure",
      stage: "report_build",
      target: { type: "report" },
      effects: ["report_delivery_failure"],
      extent: "entire_target",
      reportDelivery: {
        measurementResults: "none",
        priorIssueDetail: "unavailable",
      },
    });
    expect(report.diagnostics[1]).toMatchObject({
      code: "diagnostic_overflow",
      priorIssueDetail: "unavailable",
      omittedOccurrences: null,
    });
    expect(structuredClone(report)).toEqual(report);
  });

  it("reserves the mandatory fallback record, 14 prior details and one summary", () => {
    const accumulator = new BoundedProfileDiagnosticAccumulatorV2();
    for (let index = 0; index < 15; index += 1) accumulator.add(issue(`prior-${index}`));
    const report = createFixedProfileReportFallbackV2(accumulator.snapshot());
    expect(report.diagnostics).toHaveLength(16);
    expect(report.diagnostics[0]).toMatchObject({ effects: ["report_delivery_failure"], count: 1 });
    expect(report.diagnostics[15]).toMatchObject({
      code: "diagnostic_overflow",
      priorIssueDetail: "retained",
      omittedOccurrences: 1,
      maximumSeverity: "warning",
    });
  });

  it("distinguishes a trusted empty diagnostic snapshot from no snapshot", () => {
    const snapshot = new BoundedProfileDiagnosticAccumulatorV2().snapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.diagnostics)).toBe(true);
    const report = createFixedProfileReportFallbackV2(snapshot);
    expect(report.diagnostics).toHaveLength(1);
    expect(report.diagnostics[0]).toMatchObject({
      reportDelivery: { priorIssueDetail: "retained", measurementResults: "none" },
    });
  });
});
