import { describe, expect, it } from "vitest";

import {
  PROFILE_COLLECTION_LIMITS,
  PROFILE_DIAGNOSTIC_SEVERITY,
  PROFILE_REPORT_SCHEMA_VERSION,
  type ProfileReport,
} from "../../src/telemetry/profile-report.js";

describe("ProfileReport", () => {
  it("is a structured-clone-safe SDK-independent value contract", () => {
    const report: ProfileReport = {
      schemaVersion: PROFILE_REPORT_SCHEMA_VERSION,
      signalStatus: { spans: "complete", counters: "partial", histograms: "unavailable" },
      spans: [
        {
          scope: { name: "gitlode.execution", version: null },
          name: "gitlode.run",
          callCount: 1,
          errorCount: 0,
          totalDurationSeconds: 1,
          maxDurationSeconds: 1,
          attributes: [
            {
              key: "result",
              reducer: "single",
              value: "success",
              observedCount: 1,
              conflictCount: 0,
            },
            { key: "count", reducer: "min_max", minimum: 1, maximum: 2, observedCount: 2 },
            {
              key: "mode",
              reducer: "distinct",
              values: [{ value: true, count: 1 }],
              observedCount: 1,
              overflowCount: 0,
            },
          ],
        },
      ],
      counters: [
        {
          scope: { name: "gitlode.execution", version: null },
          name: "gitlode.commit.accepted",
          unit: "{commit}",
          attributes: [],
          value: 0,
        },
      ],
      histograms: [],
      diagnostics: [
        {
          code: "metric_point_overflow",
          severity: "info",
          stage: "metric_collection",
          signal: "counters",
          count: 1,
          message: null,
        },
      ],
    };
    expect(structuredClone(report)).toEqual(report);
    expect(PROFILE_COLLECTION_LIMITS).toMatchObject({ spanGroups: 128, diagnostics: 16 });
    expect(PROFILE_DIAGNOSTIC_SEVERITY.lifecycle_failure).toBe("warning");
  });
});
