import { describe, expect, it } from "vitest";

import {
  PROFILE_METRIC_VIEW,
  PROFILE_PRESENTATION_POLICY,
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
    const layout = view.layout as Record<string, unknown>;
    expect(PROFILE_PRESENTATION_POLICY.signalSections).toEqual(layout.signal_sections);
    const units = view.unit_rendering as Record<string, unknown>;
    expect(PROFILE_PRESENTATION_POLICY.units).toEqual({
      seconds: (units.s as Record<string, unknown>).human_units,
      bytes: (units.By as Record<string, unknown>).human_units,
      annotatedEntity: (units.annotated_entity as Record<string, unknown>).display,
      unknown: (units.unknown as Record<string, unknown>).display,
      rounding: units.rounding,
    });
    expect({
      complete_empty: PROFILE_PRESENTATION_POLICY.sectionPolicy.completeEmpty,
      partial: {
        show_section: PROFILE_PRESENTATION_POLICY.sectionPolicy.partial.showSection,
        status_label: PROFILE_PRESENTATION_POLICY.sectionPolicy.partial.statusLabel,
      },
      unavailable: {
        show_section: PROFILE_PRESENTATION_POLICY.sectionPolicy.unavailable.showSection,
        status_label: PROFILE_PRESENTATION_POLICY.sectionPolicy.unavailable.statusLabel,
        rows: PROFILE_PRESENTATION_POLICY.sectionPolicy.unavailable.rows,
      },
    }).toEqual(layout.section_policy);
    expect({
      include_unknown: PROFILE_PRESENTATION_POLICY.fallback.includeUnknown,
      identity_label: {
        version_present: PROFILE_PRESENTATION_POLICY.fallback.identityVersionPresent,
        version_absent: PROFILE_PRESENTATION_POLICY.fallback.identityVersionAbsent,
      },
      spans: {
        group_label: PROFILE_PRESENTATION_POLICY.fallback.spans.group,
        order: PROFILE_PRESENTATION_POLICY.fallback.spans.sort,
        exception: {
          plugin_scope_unknown_spans: PROFILE_PRESENTATION_POLICY.fallback.pluginUnknownSpans,
        },
      },
      counters: {
        group_label: PROFILE_PRESENTATION_POLICY.fallback.counters.group,
        order: PROFILE_PRESENTATION_POLICY.fallback.counters.sort,
      },
      histograms: {
        group_label: PROFILE_PRESENTATION_POLICY.fallback.histograms.group,
        order: PROFILE_PRESENTATION_POLICY.fallback.histograms.sort,
      },
      known_name_unexpected_scope: PROFILE_PRESENTATION_POLICY.fallback.knownNameUnexpectedScope,
    }).toEqual(view.fallback);
    expect({
      outerGroup: view.span_groups.find(
        (group: Record<string, unknown>) =>
          group.label === PROFILE_PRESENTATION_POLICY.plugin.outerGroup,
      )?.label,
      subgroupOrder: view.span_groups.find(
        (group: Record<string, unknown>) =>
          group.label === PROFILE_PRESENTATION_POLICY.plugin.outerGroup,
      )?.scope_subgroups.order,
      versionPresent: view.span_groups.find(
        (group: Record<string, unknown>) =>
          group.label === PROFILE_PRESENTATION_POLICY.plugin.outerGroup,
      )?.scope_subgroups.label.version_present,
      versionAbsent: view.span_groups.find(
        (group: Record<string, unknown>) =>
          group.label === PROFILE_PRESENTATION_POLICY.plugin.outerGroup,
      )?.scope_subgroups.label.version_absent,
      remainder: view.span_groups.find(
        (group: Record<string, unknown>) =>
          group.label === PROFILE_PRESENTATION_POLICY.plugin.outerGroup,
      )?.remainder.order[0],
    }).toEqual(PROFILE_PRESENTATION_POLICY.plugin);
    const metricPluginGroup = view.metric_groups.find(
      (group: Record<string, unknown>) =>
        group.label === PROFILE_PRESENTATION_POLICY.plugin.outerGroup,
    ) as Record<string, unknown>;
    const metricScopeSubgroups = metricPluginGroup.scope_subgroups as Record<string, unknown>;
    const metricLabels = metricScopeSubgroups.label as Record<string, unknown>;
    const metricObservations = PROFILE_METRIC_VIEW.filter(
      (entry) => entry.scope === "resolved_plugin_scope",
    ).map(({ ref, label, order }) => ({ ref, label, order }));
    expect({
      label: metricPluginGroup.label,
      matchScopeClass: (metricPluginGroup.match as Record<string, unknown>).scope_class,
      subgroupOrder: metricScopeSubgroups.order,
      versionPresent: metricLabels.version_present,
      versionAbsent: metricLabels.version_absent,
      observations: metricObservations,
    }).toEqual({
      label: PROFILE_PRESENTATION_POLICY.plugin.outerGroup,
      matchScopeClass: "resolved_plugin_scope",
      subgroupOrder: PROFILE_PRESENTATION_POLICY.plugin.subgroupOrder,
      versionPresent: PROFILE_PRESENTATION_POLICY.plugin.versionPresent,
      versionAbsent: PROFILE_PRESENTATION_POLICY.plugin.versionAbsent,
      observations: objects(metricPluginGroup.observations).map((observation, index) => ({
        ref: observation.ref,
        label: observation.label,
        order: 90 + index,
      })),
    });
    expect(PROFILE_VIEW_DIAGNOSTIC_LABELS).toEqual(
      (view.diagnostic_rendering as Record<string, unknown>).labels,
    );
  });
});
