import { describe, expect, it } from "vitest";

import {
  normalizeAffectedFields,
  normalizeAttributeKeySelector,
  normalizeProfileCounterPoint,
  normalizeProfileHistogramPoint,
  normalizeProfileReport,
  normalizeProfileSpanAggregate,
  normalizeProfileTarget,
  PROFILE_REPORT_SCHEMA_VERSION,
} from "../../src/telemetry/index.js";

describe("active ProfileReport contracts", () => {
  it("activates schema version 2", () => {
    expect(PROFILE_REPORT_SCHEMA_VERSION).toBe(2);
  });

  it("keeps all attribute selector states distinct", () => {
    expect(normalizeAttributeKeySelector({ type: "not_applicable" })).toEqual({
      type: "not_applicable",
    });
    expect(normalizeAttributeKeySelector({ type: "exact", key: "a" })).toEqual({
      type: "exact",
      key: "a",
    });
    expect(normalizeAttributeKeySelector({ type: "discarded" })).toEqual({
      type: "discarded",
    });
  });

  it("validates fields per kind and canonicalizes their order", () => {
    expect(
      normalizeAffectedFields([
        { kind: "histogram", fields: ["max", "avg", "total", "avg"] },
        { kind: "span", fields: ["errors", "max", "avg", "total", "calls"] },
      ]),
    ).toEqual([
      { kind: "histogram", fields: ["total", "avg", "max"] },
      { kind: "span", fields: ["calls", "total", "avg", "max", "errors"] },
    ]);
    expect(normalizeAffectedFields([{ kind: "counter", fields: ["avg"] }])).toBeNull();
    expect(normalizeAffectedFields([{ kind: "span", fields: [] }])).toBeNull();
  });

  it("canonicalizes typed point identity without coercing attribute values", () => {
    expect(
      normalizeProfileTarget({
        type: "point",
        scope: { name: "scope", version: "1" },
        kind: "counter",
        name: "count",
        attributes: [
          { key: "b", value: "1" },
          { key: "a", value: 1 },
        ],
      }),
    ).toEqual({
      target: {
        type: "point",
        scope: { name: "scope", version: "1" },
        kind: "counter",
        name: "count",
        attributes: [
          { key: "a", value: 1 },
          { key: "b", value: "1" },
        ],
      },
      detailLoss: {
        pointAttributes: false,
        observationIdentity: false,
        scopeIdentity: false,
        attributeKey: false,
        affectedFields: false,
      },
    });
  });

  it("validates finite measurements, masks and duration contribution evidence", () => {
    const span = normalizeProfileSpanAggregate({
      scope: { name: "scope", version: null },
      name: "work",
      callCount: 2,
      errorCount: 0,
      totalDurationSeconds: -0,
      maxDurationSeconds: 0,
      durationContributionCount: 1,
      unavailableFields: ["avg", "total", "avg"],
      attributes: [],
    });
    expect(span).toMatchObject({
      totalDurationSeconds: 0,
      durationContributionCount: 1,
      unavailableFields: ["avg", "total"],
    });
    expect(Object.is(span?.totalDurationSeconds, -0)).toBe(false);
    expect(
      normalizeProfileSpanAggregate({
        ...span,
        totalDurationSeconds: Number.POSITIVE_INFINITY,
      }),
    ).toBeNull();
    expect(normalizeProfileSpanAggregate({ ...span, unavailableFields: ["value"] })).toBeNull();

    const counter = normalizeProfileCounterPoint({
      scope: { name: "scope", version: null },
      name: "count",
      unit: "{item}",
      attributes: [{ key: "kind", value: "x" }],
      value: -0,
      unavailableFields: [],
    });
    expect(counter?.value).toBe(0);
    expect(normalizeProfileCounterPoint({ ...counter, value: Number.NaN })).toBeNull();

    const histogram = normalizeProfileHistogramPoint({
      scope: { name: "scope", version: null },
      name: "duration",
      unit: "s",
      attributes: [],
      count: 2,
      sum: 0,
      minimum: null,
      maximum: null,
      explicitBounds: [0, 1],
      bucketCounts: [1, 1, 0],
      unavailableFields: [],
    });
    expect(histogram).not.toBeNull();
    expect(normalizeProfileHistogramPoint({ ...histogram, bucketCounts: [2] })).toBeNull();
  });

  it("validates the complete bounded report instead of repairing malformed input", () => {
    const report = {
      schemaVersion: 2,
      signalStatus: { spans: "complete", counters: "complete", histograms: "complete" },
      spans: [],
      counters: [
        {
          scope: { name: "scope", version: null },
          name: "count",
          unit: "{item}",
          attributes: [],
          value: 1,
          unavailableFields: [],
        },
      ],
      histograms: [],
      diagnostics: [],
    };
    expect(normalizeProfileReport(report)).toEqual(report);
    expect(
      normalizeProfileReport({
        ...report,
        counters: [{ ...report.counters[0], unavailableFields: ["not-a-counter-field"] }],
      }),
    ).toBeNull();
    const { value: _value, ...missingValue } = report.counters[0]!;
    expect(normalizeProfileReport({ ...report, counters: [missingValue] })).toBeNull();
    expect(normalizeProfileReport({ ...report, unexpected: true })).toBeNull();
    expect(
      normalizeProfileReport({
        ...report,
        signalStatus: { ...report.signalStatus, counters: "unavailable" },
      }),
    ).toBeNull();
    expect(
      normalizeProfileReport({
        ...report,
        counters: [],
        signalStatus: { ...report.signalStatus, counters: "unavailable" },
      }),
    ).toBeNull();
    expect(
      normalizeProfileReport({
        ...report,
        counters: [],
        signalStatus: { ...report.signalStatus, counters: "partial" },
      }),
    ).toBeNull();
  });

  it("accepts valid partial and fixed-fallback diagnostic variants but rejects malformed summaries", () => {
    const detailLoss = {
      pointAttributes: false,
      observationIdentity: false,
      scopeIdentity: false,
      attributeKey: false,
      affectedFields: false,
    };
    const delivery = {
      code: "lifecycle_failure",
      severity: "warning",
      stage: "report_build",
      target: { type: "report" },
      signalCoverage: ["counter", "histogram", "span"],
      effects: ["report_delivery_failure"],
      extent: "entire_target",
      attributeKey: { type: "not_applicable" },
      affectedFields: [],
      detailLoss,
      lossQuantity: null,
      wholeResultUnavailable: false,
      count: 1,
      countSaturated: false,
      message: null,
      reportDelivery: {
        path: "fixed_fallback",
        measurementResults: "none",
        priorIssueDetail: "unavailable",
      },
    };
    const summary = {
      code: "diagnostic_overflow",
      severity: "warning",
      stage: "report_build",
      target: { type: "report" },
      extent: "unidentified_subset",
      effects: ["lost_issue_detail"],
      signalCoverage: [],
      effectsByKind: [],
      reportEffects: [],
      detailLoss: {
        pointAttributes: true,
        observationIdentity: true,
        scopeIdentity: true,
        attributeKey: true,
        affectedFields: true,
      },
      omittedOccurrences: null,
      countSaturated: false,
      maximumSeverity: null,
      priorIssueDetail: "unavailable",
    };
    const fallback = {
      schemaVersion: 2,
      signalStatus: { spans: "unavailable", counters: "unavailable", histograms: "unavailable" },
      spans: [],
      counters: [],
      histograms: [],
      diagnostics: [delivery, summary],
    };
    expect(normalizeProfileReport(fallback)).toEqual(fallback);
    expect(
      normalizeProfileReport({
        ...fallback,
        diagnostics: [{ ...delivery, reportDelivery: null }, summary],
      }),
    ).toBeNull();
    expect(
      normalizeProfileReport({
        ...fallback,
        diagnostics: [{ ...delivery, effects: ["lifecycle_notice"] }, summary],
      }),
    ).toBeNull();
    expect(
      normalizeProfileReport({
        ...fallback,
        diagnostics: [
          {
            ...delivery,
            target: {
              type: "point",
              scope: { name: "scope", version: null },
              kind: "histogram",
              name: "duration",
              attributes: [],
            },
            signalCoverage: ["counter"],
            effects: ["incomplete_measurement_fields"],
            affectedFields: [{ kind: "span", fields: ["total"] }],
            reportDelivery: null,
          },
          summary,
        ],
      }),
    ).toBeNull();
    expect(
      normalizeProfileReport({
        ...fallback,
        diagnostics: [{ ...summary, effects: [] }],
      }),
    ).toBeNull();
    expect(
      normalizeProfileReport({
        ...fallback,
        diagnostics: [summary, delivery],
      }),
    ).toBeNull();
  });

  it("accepts legal kind subsets, broad targets and reserved-summary associations", () => {
    const detailLoss = {
      pointAttributes: false,
      observationIdentity: false,
      scopeIdentity: false,
      attributeKey: false,
      affectedFields: false,
    };
    const detail = {
      code: "invalid_aggregation",
      severity: "warning",
      stage: "report_build",
      target: { type: "scope", scope: { name: "scope", version: null } },
      signalCoverage: ["counter", "histogram"],
      effects: ["incomplete_measurement_fields"],
      extent: "unidentified_subset",
      attributeKey: { type: "not_applicable" },
      affectedFields: [{ kind: "counter", fields: ["value"] }],
      detailLoss,
      lossQuantity: null,
      wholeResultUnavailable: false,
      count: 1,
      countSaturated: false,
      message: null,
      reportDelivery: null,
    };
    const summary = {
      code: "diagnostic_overflow",
      severity: "warning",
      stage: "report_build",
      target: { type: "report" },
      extent: "unidentified_subset",
      effects: ["lost_issue_detail"],
      signalCoverage: ["histogram"],
      effectsByKind: [
        {
          kind: "histogram",
          effects: ["missing_observations"],
          wholeResultUnavailable: false,
        },
      ],
      reportEffects: ["lifecycle_notice"],
      detailLoss: {
        pointAttributes: true,
        observationIdentity: true,
        scopeIdentity: true,
        attributeKey: true,
        affectedFields: true,
      },
      omittedOccurrences: 2,
      countSaturated: false,
      maximumSeverity: "warning",
      priorIssueDetail: "retained",
    };
    const report = {
      schemaVersion: 2,
      signalStatus: { spans: "complete", counters: "partial", histograms: "partial" },
      spans: [],
      counters: [],
      histograms: [],
      diagnostics: [detail, summary],
    };
    expect(normalizeProfileReport(report)).toEqual(report);
    expect(
      normalizeProfileReport({
        schemaVersion: 2,
        signalStatus: { spans: "complete", counters: "complete", histograms: "complete" },
        spans: [],
        counters: [],
        histograms: [],
        diagnostics: [
          {
            ...detail,
            target: { type: "report" },
            signalCoverage: [],
            effects: ["lifecycle_notice"],
            affectedFields: [],
          },
        ],
      }),
    ).not.toBeNull();
    expect(
      normalizeProfileReport({
        ...report,
        diagnostics: [
          {
            ...detail,
            effects: ["missing_observations"],
            wholeResultUnavailable: true,
          },
          summary,
        ],
      }),
    ).toBeNull();
    expect(
      normalizeProfileReport({
        ...report,
        diagnostics: [detail, { ...summary, signalCoverage: ["counter", "histogram"] }],
      }),
    ).toBeNull();
  });
});
