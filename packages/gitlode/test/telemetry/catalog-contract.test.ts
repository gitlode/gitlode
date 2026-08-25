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
        expect.stringContaining("duplicate profile view placement"),
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
        expect.stringContaining("unknown observation"),
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
        expect.stringMatching(/has 0 profile view placements/),
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
});
