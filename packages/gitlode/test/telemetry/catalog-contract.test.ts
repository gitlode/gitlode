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
