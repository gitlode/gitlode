import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { load } from "js-yaml";

export const catalogDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../docs/design/telemetry-catalog",
);

export type CatalogSet = Record<
  "verification" | "spans" | "metrics" | "attributes" | "profileReport" | "profileView",
  Record<string, unknown>
>;

const files: Record<keyof CatalogSet, string> = {
  verification: "verification.yaml",
  spans: "spans.yaml",
  metrics: "metrics.yaml",
  attributes: "attributes.yaml",
  profileReport: "profile-report.yaml",
  profileView: "profile-view.yaml",
};

export async function loadTelemetryCatalogs(): Promise<CatalogSet> {
  const entries = await Promise.all(
    Object.entries(files).map(async ([key, filename]) => {
      const parsed = load(await readFile(resolve(catalogDirectory, filename), "utf8"));
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error(`${filename}: expected a YAML mapping`);
      }
      return [key, parsed] as const;
    }),
  );
  return Object.fromEntries(entries) as CatalogSet;
}

function objects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : [];
}
function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function duplicateValues(values: readonly (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}
function refsFrom(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(refsFrom);
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  return [
    ...(typeof record.ref === "string" ? [record.ref] : []),
    ...Object.values(record).flatMap(refsFrom),
  ];
}

export function validateTelemetryCatalogs(catalogs: CatalogSet): string[] {
  const errors: string[] = [];
  for (const [name, catalog] of Object.entries(catalogs)) {
    if (catalog.schema_version !== 1) errors.push(`${name}: schema_version must be 1`);
    if (catalog.status !== "accepted_target")
      errors.push(`${name}: status must be accepted_target`);
  }

  const spans = objects(catalogs.spans.spans);
  const metrics = objects(catalogs.metrics.metrics);
  const attributes = objects(catalogs.attributes.attributes);
  for (const [kind, entries] of [
    ["span", spans],
    ["metric", metrics],
    ["attribute", attributes],
  ] as const) {
    for (const field of ["id", kind === "attribute" ? "key" : "name"] as const) {
      for (const value of duplicateValues(entries.map((entry) => text(entry[field])))) {
        errors.push(`duplicate ${kind} ${field}: ${value}`);
      }
    }
  }

  const spanIds = new Set(spans.map((entry) => text(entry.id)).filter(Boolean));
  const metricIds = new Set(metrics.map((entry) => text(entry.id)).filter(Boolean));
  const attributeIds = new Set(attributes.map((entry) => text(entry.id)).filter(Boolean));
  const observationIds = new Set([...spanIds, ...metricIds]);

  for (const span of spans) {
    for (const ref of refsFrom(span.attributes)) {
      if (!attributeIds.has(ref))
        errors.push(`span ${String(span.id)} references unknown attribute: ${ref}`);
    }
    const parent = span.parent as Record<string, unknown> | undefined;
    if (parent?.type === "span" && typeof parent.ref === "string" && !spanIds.has(parent.ref)) {
      errors.push(`span ${String(span.id)} references unknown parent span: ${parent.ref}`);
    }
  }
  for (const metric of metrics) {
    for (const ref of refsFrom(metric.attributes)) {
      if (!attributeIds.has(ref))
        errors.push(`metric ${String(metric.id)} references unknown attribute: ${ref}`);
    }
  }

  const referencedAttributes = new Set([
    ...spans.flatMap((span) => refsFrom(span.attributes)),
    ...metrics.flatMap((metric) => refsFrom(metric.attributes)),
  ]);
  for (const id of attributeIds) {
    if (!referencedAttributes.has(id))
      errors.push(`attribute is not referenced by a span or metric: ${id}`);
  }

  const view = catalogs.profileView;
  const spanGroups = objects(view.span_groups);
  const metricGroups = objects(view.metric_groups);
  for (const id of duplicateValues([...spanGroups, ...metricGroups].map((group) => text(group.id))))
    errors.push(`duplicate profile view group id: ${id}`);
  const placements = [
    ...spanGroups.flatMap((group) => objects(group.observations).map((entry) => text(entry.ref))),
    ...metricGroups.flatMap((group) => objects(group.observations).map((entry) => text(entry.ref))),
  ];
  for (const ref of placements) {
    if (ref && !observationIds.has(ref))
      errors.push(`profile view references unknown observation: ${ref}`);
  }
  for (const id of observationIds) {
    const count = placements.filter((placement) => placement === id).length;
    if (count !== 1) errors.push(`accepted observation ${id} has ${count} profile view placements`);
  }
  for (const ref of duplicateValues(placements))
    errors.push(`duplicate profile view placement: ${ref}`);

  const report = catalogs.profileReport;
  const reportDefinition = report.report as Record<string, unknown> | undefined;
  const fields = reportDefinition?.fields as Record<string, Record<string, unknown>> | undefined;
  if (fields?.schemaVersion?.value !== report.schema_version) {
    errors.push("ProfileReport schemaVersion does not match catalog schema_version");
  }
  const diagnosticType = (report.types as Record<string, Record<string, unknown>> | undefined)
    ?.ProfileDiagnostic;
  const diagnosticFields = diagnosticType?.fields as
    | Record<string, Record<string, unknown>>
    | undefined;
  const diagnosticCodes = Array.isArray(diagnosticFields?.code?.enum)
    ? diagnosticFields.code.enum.filter((code): code is string => typeof code === "string")
    : [];
  const labels = ((view.diagnostic_rendering as Record<string, unknown> | undefined)?.labels ??
    {}) as Record<string, unknown>;
  for (const code of Object.keys(labels))
    if (!diagnosticCodes.includes(code))
      errors.push(`diagnostic label has no report code: ${code}`);
  for (const code of diagnosticCodes)
    if (!(code in labels)) errors.push(`ProfileDiagnostic code has no label: ${code}`);

  const reportDiagnosticMaximum = Number(fields?.diagnostics?.maximum_items);
  const verificationLimits = objects(catalogs.verification.limits);
  const reportLimits = report.limits as Record<string, Record<string, unknown>> | undefined;
  const expectedLimits = new Map<string, number>([
    ["span_groups", Number(reportLimits?.span_groups?.maximum)],
    [
      "distinct_span_attribute_values",
      Number(reportLimits?.distinct_span_attribute_values?.maximum_per_attribute),
    ],
    ["metric_points_per_instrument", Number(reportLimits?.metric_points?.maximum_per_instrument)],
    ["diagnostics", reportDiagnosticMaximum],
  ]);
  for (const limit of verificationLimits) {
    const target = text(limit.target);
    const maximum = Number(limit.maximum);
    if (!target || expectedLimits.get(target) !== maximum)
      errors.push(`verification limit does not match report contract: ${String(target)}`);
    const cases = Array.isArray(limit.boundary_cases) ? limit.boundary_cases : [];
    if (
      cases.length !== 3 ||
      cases[0] !== maximum - 1 ||
      cases[1] !== maximum ||
      cases[2] !== maximum + 1
    ) {
      errors.push(
        `verification boundary cases must be maximum - 1, maximum, maximum + 1: ${String(target)}`,
      );
    }
  }
  for (const target of expectedLimits.keys())
    if (!verificationLimits.some((limit) => limit.target === target))
      errors.push(`missing verification limit: ${target}`);

  return errors;
}
