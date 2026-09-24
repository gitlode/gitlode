import { describe, expect, it } from "vitest";

import {
  normalizeAffectedFields,
  normalizeAttributeKeySelector,
  normalizeProfileCounterPoint,
  normalizeProfileHistogramPoint,
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
});
