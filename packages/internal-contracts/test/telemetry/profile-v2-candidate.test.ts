import { describe, expect, it } from "vitest";

import {
  normalizeAffectedFieldsV2,
  normalizeAttributeKeySelectorV2,
  normalizeProfileCounterPointV2,
  normalizeProfileHistogramPointV2,
  normalizeProfileSpanAggregateV2,
  normalizeProfileTargetV2,
  PROFILE_REPORT_SCHEMA_VERSION,
  PROFILE_REPORT_V2_SCHEMA_VERSION,
} from "../../src/telemetry/index.js";

describe("staged ProfileReport v2 contracts", () => {
  it("keeps v1 active while exposing the v2 candidate literal", () => {
    expect(PROFILE_REPORT_SCHEMA_VERSION).toBe(1);
    expect(PROFILE_REPORT_V2_SCHEMA_VERSION).toBe(2);
  });

  it("keeps all attribute selector states distinct", () => {
    expect(normalizeAttributeKeySelectorV2({ type: "not_applicable" })).toEqual({
      type: "not_applicable",
    });
    expect(normalizeAttributeKeySelectorV2({ type: "exact", key: "a" })).toEqual({
      type: "exact",
      key: "a",
    });
    expect(normalizeAttributeKeySelectorV2({ type: "discarded" })).toEqual({
      type: "discarded",
    });
  });

  it("validates fields per kind and canonicalizes their order", () => {
    expect(
      normalizeAffectedFieldsV2([
        { kind: "histogram", fields: ["max", "avg", "total", "avg"] },
        { kind: "span", fields: ["errors", "calls"] },
      ]),
    ).toEqual([
      { kind: "histogram", fields: ["total", "avg", "max"] },
      { kind: "span", fields: ["calls", "errors"] },
    ]);
    expect(normalizeAffectedFieldsV2([{ kind: "counter", fields: ["avg"] }])).toBeNull();
    expect(normalizeAffectedFieldsV2([{ kind: "span", fields: [] }])).toBeNull();
  });

  it("canonicalizes typed point identity without coercing attribute values", () => {
    expect(
      normalizeProfileTargetV2({
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
    const span = normalizeProfileSpanAggregateV2({
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
      normalizeProfileSpanAggregateV2({
        ...span,
        totalDurationSeconds: Number.POSITIVE_INFINITY,
      }),
    ).toBeNull();
    expect(normalizeProfileSpanAggregateV2({ ...span, unavailableFields: ["value"] })).toBeNull();

    const counter = normalizeProfileCounterPointV2({
      scope: { name: "scope", version: null },
      name: "count",
      unit: "{item}",
      attributes: [{ key: "kind", value: "x" }],
      value: -0,
      unavailableFields: [],
    });
    expect(counter?.value).toBe(0);
    expect(normalizeProfileCounterPointV2({ ...counter, value: Number.NaN })).toBeNull();

    const histogram = normalizeProfileHistogramPointV2({
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
    expect(normalizeProfileHistogramPointV2({ ...histogram, bucketCounts: [2] })).toBeNull();
  });
});
