import { describe, expect, it } from "vitest";

import {
  PROFILE_METRIC_VIEW,
  PROFILE_SPAN_VIEW,
  PROFILE_VIEW_DIAGNOSTIC_LABELS,
} from "../../../src/presentation/reporting/profile-view.js";
import { loadTelemetryCatalogs, type CatalogSet } from "../../support/telemetry-catalog.js";

function objects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : [];
}

function catalogRows(catalog: CatalogSet, key: "span_groups" | "metric_groups") {
  return objects(catalog.profileView[key]).flatMap((group) =>
    objects(group.observations).map((observation) => ({
      ref: observation.ref,
      label: observation.label,
      group: group.label,
    })),
  );
}

function sourceRows(catalog: CatalogSet, key: "spans" | "metrics") {
  return objects(catalog[key][key]).map((entry) => ({
    ref: entry.id,
    name: entry.name,
    scope:
      typeof entry.scope === "string"
        ? entry.scope
        : ((entry.scope as Record<string, unknown>).name ??
          ((entry.scope as Record<string, unknown>).type === "resolved_plugin"
            ? "resolved_plugin_scope"
            : (entry.scope as Record<string, unknown>).type)),
  }));
}

describe("typed profile view drift", () => {
  it("matches every YAML group, observation, label, order, and source identity", async () => {
    const catalog = await loadTelemetryCatalogs();
    const spanYaml = catalogRows(catalog, "span_groups");
    const metricYaml = catalogRows(catalog, "metric_groups");
    expect(PROFILE_SPAN_VIEW.map(({ ref, label, group }) => ({ ref, label, group }))).toEqual(
      spanYaml,
    );
    expect(PROFILE_METRIC_VIEW.map(({ ref, label, group }) => ({ ref, label, group }))).toEqual(
      metricYaml,
    );
    expect(PROFILE_SPAN_VIEW.map((entry) => entry.ref)).toEqual(spanYaml.map((entry) => entry.ref));
    expect(PROFILE_METRIC_VIEW.map((entry) => entry.ref)).toEqual(
      metricYaml.map((entry) => entry.ref),
    );

    const spanSource = new Map(sourceRows(catalog, "spans").map((entry) => [entry.ref, entry]));
    const metricSource = new Map(sourceRows(catalog, "metrics").map((entry) => [entry.ref, entry]));
    for (const entry of PROFILE_SPAN_VIEW) {
      const source = spanSource.get(entry.ref);
      expect(source).toBeDefined();
      expect(entry.name).toBe(source?.name);
      expect(entry.scope).toBe(source?.scope);
    }
    for (const entry of PROFILE_METRIC_VIEW) {
      const source = metricSource.get(entry.ref);
      expect(source).toBeDefined();
      expect(entry.name).toBe(source?.name);
      expect(entry.scope).toBe(source?.scope ?? "resolved_plugin_scope");
    }
  });

  it("locks dynamic plugin and fallback policies to the YAML contract", async () => {
    const catalog = await loadTelemetryCatalogs();
    const view = catalog.profileView;
    expect(view.span_groups).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Plugins" })]),
    );
    expect(view.metric_groups).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Plugins" })]),
    );
    expect(view.fallback).toMatchObject({
      include_unknown: true,
      known_name_unexpected_scope: "treat_as_unknown",
      spans: { group_label: "Other spans", order: ["scope", "name"] },
      counters: { group_label: "Other counters", order: ["scope", "name", "attributes"] },
      histograms: { group_label: "Other histograms", order: ["scope", "name", "attributes"] },
    });
    const pluginSubgroup = {
      scope_subgroups: {
        order: ["scope"],
        label: { version_present: "<scope-name>@<version>", version_absent: "<scope-name>" },
      },
    };
    expect(view.span_groups).toEqual(
      expect.arrayContaining([expect.objectContaining(pluginSubgroup)]),
    );
    expect(view.metric_groups).toEqual(
      expect.arrayContaining([expect.objectContaining(pluginSubgroup)]),
    );
    expect(PROFILE_VIEW_DIAGNOSTIC_LABELS).toEqual(
      (view.diagnostic_rendering as Record<string, unknown>).labels,
    );
    expect((view.layout as Record<string, unknown>).section_policy).toMatchObject({
      complete_empty: "omit",
      partial: { show_section: true },
      unavailable: { show_section: true, rows: "none" },
    });
  });
});
