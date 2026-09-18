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
      value: 2,
      relationship: "disjoint" as const,
    };
    accumulator.add(issue("known", { lossQuantity: quantity, count: Number.MAX_SAFE_INTEGER }));
    accumulator.add(issue("known", { lossQuantity: quantity }));
    accumulator.add(issue("unknown", { lossQuantity: quantity }));
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
      lossQuantity: { value: 4 },
    });
    expect(
      diagnostics.find(
        (item) => item.target.type === "observation" && item.target.name === "unknown",
      )?.lossQuantity?.value,
    ).toBeNull();
    expect(diagnostics).toHaveLength(3);
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
});
