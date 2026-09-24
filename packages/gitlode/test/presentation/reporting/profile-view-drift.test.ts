import { describe, expect, it } from "vitest";

import {
  compareAttributeSets,
  compareProfileIdentity,
  PROFILE_KIND_ORDER,
  PROFILE_VIEW_DIAGNOSTIC_LABELS,
} from "../../../src/presentation/reporting/profile-view.js";
import { loadTelemetryCatalogs } from "../../support/telemetry-catalog.js";

describe("generic profile view drift", () => {
  it("contains no per-observation view table and accepts every catalog identity generically", async () => {
    const catalog = await loadTelemetryCatalogs();
    const view = catalog.profileView;
    expect(view.span_groups).toBeUndefined();
    expect(view.metric_groups).toBeUndefined();
    expect(view.fallback).toBeUndefined();

    for (const entry of [
      ...(catalog.spans.spans as Record<string, unknown>[]),
      ...(catalog.metrics.metrics as Record<string, unknown>[]),
    ]) {
      expect(entry.name).toEqual(expect.any(String));
      expect(String(entry.name).length).toBeGreaterThan(0);
      expect(entry.scope).toBeDefined();
    }
    expect((view.generic_hierarchy as Record<string, unknown>).group_by).toBe(
      "instrumentation_scope_name_and_version",
    );
    expect((view.generic_hierarchy as Record<string, unknown>).namespace_segments).toBe(2);
  });

  it("matches generic kind, diagnostic, unit and style policy", async () => {
    const view = (await loadTelemetryCatalogs()).profileView;
    expect(PROFILE_KIND_ORDER).toEqual({ span: 0, counter: 1, histogram: 2 });
    expect(PROFILE_VIEW_DIAGNOSTIC_LABELS).toEqual(
      (view.diagnostic_rendering as Record<string, unknown>).labels,
    );
    expect(view.unit_rendering).toEqual(
      expect.objectContaining({ significant_digits: 4, promotion_after_rounding: true }),
    );
    expect(view.styling).toEqual(
      expect.objectContaining({
        title_scope_namespace: "sectionHeading",
        separator: "separator",
        profile_uses_application_success_style: false,
        styled_plain_text_parity: true,
      }),
    );
  });

  it("orders typed identities without labels or policy tables", () => {
    const scope = { name: "example", version: null };
    const identities = [
      { scope, name: "same", kind: "histogram" as const, attributes: [] },
      { scope, name: "same", kind: "counter" as const, attributes: [{ key: "k", value: "1" }] },
      { scope, name: "same", kind: "counter" as const, attributes: [{ key: "k", value: 1 }] },
      { scope, name: "same", kind: "counter" as const, attributes: [{ key: "k", value: false }] },
      { scope, name: "same", kind: "span" as const, attributes: [] },
    ].sort(compareProfileIdentity);
    expect(identities.map((identity) => [identity.kind, identity.attributes[0]?.value])).toEqual([
      ["span", undefined],
      ["counter", false],
      ["counter", 1],
      ["counter", "1"],
      ["histogram", undefined],
    ]);
    expect(compareAttributeSets([], [{ key: "a", value: 1 }])).toBeLessThan(0);
  });
});
