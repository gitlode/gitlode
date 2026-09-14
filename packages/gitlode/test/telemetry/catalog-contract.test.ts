import {
  PROFILE_COLLECTION_LIMITS,
  PROFILE_DIAGNOSTIC_SEVERITY,
  PROFILE_DIAGNOSTIC_SIGNALS,
  PROFILE_DIAGNOSTIC_STAGES,
  PROFILE_REPORT_SCHEMA_VERSION,
  PROFILE_SIGNAL_STATUSES,
  REMOVED_TELEMETRY_OBSERVATIONS,
  TELEMETRY_ATTRIBUTES,
  TELEMETRY_METRICS,
  TELEMETRY_SPANS,
} from "@gitlode/internal-contracts/telemetry";
import { beforeAll, describe, expect, it } from "vitest";

import {
  loadTelemetryCatalogs,
  validateTelemetryCatalogs,
  type CatalogSet,
} from "../support/telemetry-catalog.js";

const clone = (catalogs: CatalogSet): CatalogSet => structuredClone(catalogs);
let accepted: CatalogSet;
beforeAll(async () => {
  accepted = await loadTelemetryCatalogs();
});

describe("accepted telemetry catalog contract", () => {
  it("is internally consistent without production YAML loading", () => {
    expect(validateTelemetryCatalogs(accepted)).toEqual([]);
  });
  it("rejects schema/status drift", () => {
    const catalogs = clone(accepted);
    catalogs.metrics.schema_version = 2;
    catalogs.spans.status = "draft";
    expect(validateTelemetryCatalogs(catalogs)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("schema_version"),
        expect.stringContaining("status"),
      ]),
    );
  });
  it("rejects duplicate identities, names, and view placements", () => {
    const catalogs = clone(accepted);
    const spans = catalogs.spans.spans as Record<string, unknown>[];
    spans[1]!.id = spans[0]!.id;
    spans[1]!.name = spans[0]!.name;
    const groups = catalogs.profileView.span_groups as Record<string, unknown>[];
    (groups[1]!.observations as unknown[]).push(
      structuredClone((groups[0]!.observations as unknown[])[0]),
    );
    expect(validateTelemetryCatalogs(catalogs)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("duplicate span id"),
        expect.stringContaining("duplicate span name"),
        expect.stringContaining("duplicate span profile view placement"),
      ]),
    );
  });
  it("rejects unknown observation and attribute references", () => {
    const catalogs = clone(accepted);
    const spans = catalogs.spans.spans as Record<string, unknown>[];
    ((spans[0]!.attributes as Record<string, unknown>).initial as unknown[]).push({
      ref: "missing_attribute",
    });
    const groups = catalogs.profileView.metric_groups as Record<string, unknown>[];
    (groups[0]!.observations as unknown[]).push({ ref: "missing_metric", label: "Missing" });
    expect(validateTelemetryCatalogs(catalogs)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("unknown attribute"),
        expect.stringContaining("non-metric observation"),
      ]),
    );
  });
  it("rejects unreferenced attributes and missing view placements", () => {
    const catalogs = clone(accepted);
    (catalogs.attributes.attributes as unknown[]).push({
      id: "orphan",
      key: "gitlode.orphan",
      type: "string",
    });
    const groups = catalogs.profileView.metric_groups as Record<string, unknown>[];
    (groups[0]!.observations as unknown[]).splice(0, 1);
    expect(validateTelemetryCatalogs(catalogs)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("not referenced"),
        expect.stringMatching(/accepted metric .* has 0 profile view placements/),
      ]),
    );
  });
  it("rejects diagnostic labels and report/verification boundary drift", () => {
    const catalogs = clone(accepted);
    const labels = (catalogs.profileView.diagnostic_rendering as Record<string, unknown>)
      .labels as Record<string, unknown>;
    delete labels.lifecycle_failure;
    const reportFields = (catalogs.profileReport.report as Record<string, unknown>)
      .fields as Record<string, Record<string, unknown>>;
    reportFields.schemaVersion!.value = 2;
    const limits = catalogs.verification.limits as Record<string, unknown>[];
    limits[0]!.boundary_cases = [126, 128, 129];
    expect(validateTelemetryCatalogs(catalogs)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("no label"),
        expect.stringContaining("schemaVersion"),
        expect.stringContaining("boundary cases"),
      ]),
    );
  });
  it("rejects invalid parent and cross-signal profile placements", () => {
    const catalogs = clone(accepted);
    const spans = catalogs.spans.spans as Record<string, unknown>[];
    spans[3]!.parent = { type: "explicit_span_context", ref: "missing_parent" };
    const spanGroups = catalogs.profileView.span_groups as Record<string, unknown>[];
    (spanGroups[0]!.observations as Record<string, unknown>[])[0]!.ref = (
      catalogs.metrics.metrics as Record<string, unknown>[]
    )[0]!.id;
    const metricGroups = catalogs.profileView.metric_groups as Record<string, unknown>[];
    (metricGroups[0]!.observations as Record<string, unknown>[])[0]!.ref = spans[0]!.id;
    expect(validateTelemetryCatalogs(catalogs)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("unknown parent span: missing_parent"),
        expect.stringContaining("span profile group references non-span observation"),
        expect.stringContaining("metric profile group references non-metric observation"),
      ]),
    );
  });
  it("rejects missing and non-string required identity fields", () => {
    const catalogs = clone(accepted);
    delete (catalogs.spans.spans as Record<string, unknown>[])[0]!.id;
    (catalogs.metrics.metrics as Record<string, unknown>[])[0]!.name = 42;
    delete (catalogs.attributes.attributes as Record<string, unknown>[])[0]!.key;
    delete (catalogs.profileView.span_groups as Record<string, unknown>[])[0]!.id;
    delete (
      (catalogs.profileView.metric_groups as Record<string, unknown>[])[0]!.observations as Record<
        string,
        unknown
      >[]
    )[0]!.ref;
    expect(validateTelemetryCatalogs(catalogs)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("span 0 requires string id"),
        expect.stringContaining("metric 0 requires string name"),
        expect.stringContaining("attribute 0 requires string key"),
        expect.stringContaining("span profile group 0 requires string id"),
        expect.stringContaining("metric profile observation 0:0 requires string ref"),
      ]),
    );
  });
  it("rejects malformed and unsupported span parent policies", () => {
    const catalogs = clone(accepted);
    const spans = catalogs.spans.spans as Record<string, unknown>[];
    spans[1]!.parent = { type: "span" };
    spans[3]!.parent = { type: "explicit_span_context", ref: 42 };
    spans[0]!.parent = { type: "unknown" };
    spans[4]!.parent = { type: "active_caller", ref: "run" };
    spans[5]!.parent = { type: "root", ref: "run" };
    expect(validateTelemetryCatalogs(catalogs)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("parent span requires string ref"),
        expect.stringContaining("parent explicit_span_context requires string ref"),
        expect.stringContaining("unknown parent type"),
        expect.stringContaining("parent active_caller must not define ref"),
        expect.stringContaining("parent root must not define ref"),
      ]),
    );
  });
});

describe("production observation metadata", () => {
  it("matches the accepted catalog structured projection", async () => {
    const scope = (value: unknown) =>
      typeof value === "string" ? { type: "core", name: value } : { type: "resolved_plugin" };
    const attributes = (accepted.attributes.attributes as Record<string, unknown>[]).map(
      (entry) => ({
        id: entry.id,
        key: entry.key,
        valueType: entry.type,
        ...(entry.values ? { boundedValues: entry.values } : {}),
        ...(entry.minimum !== undefined
          ? {
              numericConstraint: {
                minimum: entry.minimum,
                ...(entry.value_unit ? { unit: entry.value_unit } : {}),
              },
            }
          : {}),
        ...(entry.value_policy ? { valuePolicy: entry.value_policy } : {}),
        profileReducer: (entry.profile as Record<string, unknown>).reducer,
      }),
    );
    const spans = (accepted.spans.spans as Record<string, unknown>[]).map((entry) => ({
      id: entry.id,
      name: entry.name,
      scope: scope(entry.scope),
      owner: entry.owner,
      parent: entry.parent,
      attributes: Object.fromEntries(
        Object.entries(entry.attributes as Record<string, { ref: string }[]>).map(
          ([phase, refs]) => [phase, refs.map((item) => item.ref)],
        ),
      ),
    }));
    const metrics = (accepted.metrics.metrics as Record<string, unknown>[]).map((entry) => ({
      id: entry.id,
      name: entry.name,
      scope: scope(entry.scope),
      instrument: entry.instrument,
      description: entry.description,
      unit: entry.unit,
      owner: entry.owner,
      attributes: (entry.attributes as { ref: string; required: boolean }[]).map((item) => ({
        id: item.ref,
        required: item.required,
      })),
      ...(entry.explicit_bucket_boundaries
        ? { explicitBucketBoundaries: entry.explicit_bucket_boundaries }
        : {}),
      zeroPolicy: entry.zero_policy,
    }));
    const removed = (
      accepted.metrics.removed_observations as { ids: string[]; disposition: string }[]
    ).flatMap((group) => group.ids.map((id) => ({ id, disposition: group.disposition })));
    expect(TELEMETRY_ATTRIBUTES).toEqual(attributes);
    expect(TELEMETRY_SPANS).toEqual(spans);
    expect(TELEMETRY_METRICS).toEqual(metrics);
    expect(REMOVED_TELEMETRY_OBSERVATIONS).toEqual(removed);
    const acceptedIds = new Set([...spans, ...metrics].map((item) => item.id));
    for (const item of removed) expect(acceptedIds).not.toContain(item.id);
  });
});

describe("production profile report contract", () => {
  it("matches the accepted catalog structured constants", () => {
    const report = accepted.profileReport;
    const reportFields = (report.report as Record<string, unknown>).fields as Record<
      string,
      Record<string, unknown>
    >;
    const types = report.types as Record<string, Record<string, unknown>>;
    const diagnosticFields = (types.ProfileDiagnostic!.fields as Record<
      string,
      Record<string, unknown>
    >)!;
    const severityPolicy = types.ProfileDiagnostic!.severity_policy as Record<string, string[]>;
    const severity = Object.fromEntries(
      Object.entries(severityPolicy).flatMap(([level, codes]) =>
        codes.map((code) => [code, level]),
      ),
    );
    const limits = report.limits as Record<string, Record<string, unknown>>;
    const diagnosticsLimit = limits.diagnostics!;

    expect(PROFILE_REPORT_SCHEMA_VERSION).toBe(report.schema_version);
    expect(PROFILE_SIGNAL_STATUSES).toEqual(types.ProfileSignalStatus!.enum);
    expect(Object.keys(PROFILE_DIAGNOSTIC_SEVERITY)).toEqual(diagnosticFields.code!.enum);
    expect(PROFILE_DIAGNOSTIC_SEVERITY).toEqual(severity);
    expect(PROFILE_DIAGNOSTIC_STAGES).toEqual(diagnosticFields.stage!.enum);
    expect(PROFILE_DIAGNOSTIC_SIGNALS).toEqual(diagnosticFields.signal!.enum);
    expect(PROFILE_COLLECTION_LIMITS).toEqual({
      spanGroups: (limits.span_groups as Record<string, unknown>).maximum,
      distinctSpanAttributeValuesPerAttribute: (
        limits.distinct_span_attribute_values as Record<string, unknown>
      ).maximum_per_attribute,
      metricPointsPerInstrument: (limits.metric_points as Record<string, unknown>)
        .maximum_per_instrument,
      diagnostics: {
        maximum: reportFields.diagnostics!.maximum_items,
        overflowReservedEntries: (diagnosticsLimit.reservation as Record<string, unknown>).entries,
      },
      diagnosticMessageUtf16CodeUnits: diagnosticFields.message!.maximum_utf16_code_units,
    });
  });
});
