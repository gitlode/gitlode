import {
  compareCodeUnits,
  compareProfileScopes,
  deriveCounterNumericAvailability,
  deriveHistogramNumericAvailability,
  deriveSpanNumericAvailability,
} from "@gitlode/internal-contracts/telemetry";
import type {
  ProfileAttributeValue,
  ProfileCounterPoint,
  ProfileHistogramPoint,
  ProfileInstrumentationScope,
  ProfileReport,
  ProfileSpanAggregate,
} from "@gitlode/internal-contracts/telemetry";

import { formatCount, formatElapsed, humanizeBytes } from "../format-utils.js";
import { plainStyling, type Styling } from "../styling.js";
import { compareProfileIdentity } from "./profile-view.js";
import type { SummaryData } from "./types.js";

type ProfileMeasurement =
  | { kind: "span"; value: ProfileSpanAggregate }
  | { kind: "counter"; value: ProfileCounterPoint }
  | { kind: "histogram"; value: ProfileHistogramPoint };

interface NamespaceNode {
  readonly segment: string;
  readonly absoluteName: string;
  readonly rows: ProfileMeasurement[];
  readonly children: Map<string, NamespaceNode>;
}

const UNAVAILABLE = "—";
const TOKEN = /^[A-Za-z0-9_.@-]+$/u;

export function formatSummaryLines(data: SummaryData, styling: Styling = plainStyling): string[] {
  const bytes = humanizeBytes(data.bytesWritten);
  const elapsed = formatElapsed(data.elapsedMs);
  const fields: Array<[string, string]> = [
    ["Records written", styling.primaryValue(formatCount(data.recordsWritten))],
    ["Commits traversed", styling.primaryValue(formatCount(data.commitsTraversed))],
    ["Files created", styling.primaryValue(formatCount(data.filesCreated))],
    ["Bytes written", styling.primaryValue(bytes.value) + styling.unitSuffix(bytes.unit)],
    ["Elapsed time", styling.primaryValue(elapsed.value) + styling.unitSuffix(elapsed.unit)],
    ["Refs", styling.refsValue(data.refs.join(", ") || "(none)")],
  ];
  return [
    styling.summaryHeader("Extraction complete"),
    ...fields.map(([label, value]) =>
      `  ${styling.fieldKey(label.padEnd(18))}${styling.separator(":")} ${value}`,
    ),
  ];
}

export function formatProfileLines(
  report: ProfileReport,
  styling: Styling = plainStyling,
): string[] {
  const measurements: ProfileMeasurement[] = [
    ...report.spans.map((value) => ({ kind: "span" as const, value })),
    ...report.counters.map((value) => ({ kind: "counter" as const, value })),
    ...report.histograms.map((value) => ({ kind: "histogram" as const, value })),
  ].sort(compareMeasurements);
  if (measurements.length === 0 && report.diagnostics.length === 0) return [];

  const lines = [styling.sectionHeading("Profile")];
  const byScope = new Map<string, { scope: ProfileInstrumentationScope; rows: ProfileMeasurement[] }>();
  for (const measurement of measurements) {
    const scope = measurement.value.scope;
    const key = `${scope.name}\0${scope.version ?? ""}`;
    const entry = byScope.get(key) ?? { scope, rows: [] };
    entry.rows.push(measurement);
    byScope.set(key, entry);
  }
  for (const { scope, rows } of [...byScope.values()].sort((left, right) =>
    compareProfileScopes(left.scope, right.scope),
  )) {
    lines.push(`  ${styling.sectionHeading(`Scope: ${formatScope(scope)}`)}`);
    renderScope(lines, rows, styling);
  }
  return lines;
}

function compareMeasurements(left: ProfileMeasurement, right: ProfileMeasurement): number {
  return compareProfileIdentity(
    {
      scope: left.value.scope,
      name: left.value.name,
      kind: left.kind,
      attributes: left.kind === "span" ? [] : left.value.attributes,
    },
    {
      scope: right.value.scope,
      name: right.value.name,
      kind: right.kind,
      attributes: right.kind === "span" ? [] : right.value.attributes,
    },
  );
}

function renderScope(lines: string[], rows: ProfileMeasurement[], styling: Styling): void {
  const roots = new Map<string, NamespaceNode>();
  const malformed: ProfileMeasurement[] = [];
  for (const row of rows) {
    const segments = row.value.name.split(".");
    if (segments.some((segment) => segment.length === 0)) {
      malformed.push(row);
      continue;
    }
    const path = segments.slice(0, 2);
    let nodes = roots;
    let absoluteName = "";
    for (const segment of path) {
      absoluteName = absoluteName ? `${absoluteName}.${segment}` : segment;
      const node: NamespaceNode = nodes.get(segment) ?? {
        segment,
        absoluteName,
        rows: [],
        children: new Map(),
      };
      nodes.set(segment, node);
      nodes = node.children;
    }
    findNode(roots, path)!.rows.push(row);
  }
  for (const row of malformed) renderAbsoluteRow(lines, row, 2, styling, undefined, true);
  for (const node of [...roots.values()].sort((a, b) => compareCodeUnits(a.segment, b.segment)))
    renderNode(lines, node, 2, styling, true);
}

function findNode(roots: Map<string, NamespaceNode>, path: readonly string[]): NamespaceNode | null {
  let nodes = roots;
  let result: NamespaceNode | null = null;
  for (const segment of path) {
    result = nodes.get(segment) ?? null;
    if (!result) return null;
    nodes = result.children;
  }
  return result;
}

function renderNode(
  lines: string[],
  node: NamespaceNode,
  depth: number,
  styling: Styling,
  root: boolean,
): void {
  const indent = "  ".repeat(depth);
  const name = `${root ? "/" : ""}${formatToken(node.segment)}`;
  const rows = node.rows.sort(compareMeasurements);
  const ownRows = rows.filter((row) => row.value.name === node.absoluteName);
  const childRows = rows.filter((row) => row.value.name !== node.absoluteName);
  if (ownRows.length === 1) {
    lines.push(`${indent}${styling.sectionHeading(name)}${formatMeasurementFields(ownRows[0]!, styling)}`);
    renderAttributes(lines, ownRows[0]!, node.absoluteName, depth + 1, styling);
  } else {
    lines.push(`${indent}${styling.sectionHeading(name)}`);
    for (const row of ownRows)
      renderAbsoluteRow(lines, row, depth + 1, styling, node.absoluteName);
  }
  for (const row of childRows)
    renderNamedRow(
      lines,
      row,
      row.value.name.slice(node.absoluteName.length + 1),
      depth + 1,
      node.absoluteName,
      styling,
    );
  for (const child of [...node.children.values()].sort((a, b) =>
    compareCodeUnits(a.segment, b.segment),
  ))
    renderNode(lines, child, depth + 1, styling, false);
}

function renderAbsoluteRow(
  lines: string[],
  row: ProfileMeasurement,
  depth: number,
  styling: Styling,
  attributeBase?: string,
  forceQuote = false,
): void {
  renderNamedRow(
    lines,
    row,
    `/` + (forceQuote ? quote(row.value.name) : formatToken(row.value.name)),
    depth,
    attributeBase,
    styling,
  );
}

function renderNamedRow(
  lines: string[],
  row: ProfileMeasurement,
  name: string,
  depth: number,
  attributeBase: string | undefined,
  styling: Styling,
): void {
  lines.push(`${"  ".repeat(depth)}${name}${formatMeasurementFields(row, styling)}`);
  renderAttributes(lines, row, attributeBase, depth + 1, styling);
}

function formatMeasurementFields(row: ProfileMeasurement, styling: Styling): string {
  const separator = styling.separator(" : ");
  if (row.kind === "span") {
    const span = row.value;
    const available = deriveSpanNumericAvailability(span);
    const avg = available.avg ? span.totalDurationSeconds / span.callCount : null;
    return `${separator}${fields(
      [
        ["calls", available.calls ? exact(span.callCount, styling) : UNAVAILABLE],
        ["total", available.total ? unit(span.totalDurationSeconds, "s", styling) : UNAVAILABLE],
        ["avg", avg === null ? UNAVAILABLE : unit(avg, "s", styling)],
        ["max", available.max ? unit(span.maxDurationSeconds, "s", styling) : UNAVAILABLE],
        ["errors", available.errors ? exact(span.errorCount, styling) : UNAVAILABLE],
      ],
      styling,
    )}`;
  }
  if (row.kind === "counter") {
    const available = deriveCounterNumericAvailability(row.value);
    return `${separator}${available.value ? unit(row.value.value, row.value.unit, styling) : UNAVAILABLE}`;
  }
  const point = row.value;
  const available = deriveHistogramNumericAvailability(point);
  const avg = available.avg ? point.sum / point.count : null;
  return `${separator}${fields(
    [
      ["samples", available.samples ? exact(point.count, styling) : UNAVAILABLE],
      ["total", available.total ? unit(point.sum, point.unit, styling) : UNAVAILABLE],
      ["avg", avg === null ? UNAVAILABLE : unit(avg, point.unit, styling)],
      ["min", available.min && point.minimum !== null ? unit(point.minimum, point.unit, styling) : UNAVAILABLE],
      ["max", available.max && point.maximum !== null ? unit(point.maximum, point.unit, styling) : UNAVAILABLE],
    ],
    styling,
  )}`;
}

function fields(entries: readonly (readonly [string, string])[], styling: Styling): string {
  return entries
    .map(([key, value]) => `${styling.fieldKey(key)}${styling.separator("=")}${value}`)
    .join(styling.separator(", "));
}

function renderAttributes(
  lines: string[],
  row: ProfileMeasurement,
  base: string | undefined,
  depth: number,
  styling: Styling,
): void {
  if (row.kind === "span") {
    for (const attribute of [...row.value.attributes].sort((a, b) => compareCodeUnits(a.key, b.key)))
      renderAttributeLine(
        lines,
        attribute.key,
        formatSpanAttribute(attribute, row.value.callCount, styling),
        base,
        depth,
        styling,
      );
    return;
  }
  for (const attribute of [...row.value.attributes].sort((a, b) => compareCodeUnits(a.key, b.key)))
    renderAttributeLine(
      lines,
      attribute.key,
      styling.primaryValue(formatAttributeValue(attribute.value)),
      base,
      depth,
      styling,
    );
}

function renderAttributeLine(
  lines: string[],
  key: string,
  value: string,
  base: string | undefined,
  depth: number,
  styling: Styling,
): void {
  lines.push(
    `${"  ".repeat(depth)}${styling.fieldKey(formatAttributeKey(key, base))} ${styling.separator("=")} ${value}`,
  );
}

function formatSpanAttribute(
  attribute: ProfileSpanAggregate["attributes"][number],
  callCount: number,
  styling: Styling,
): string {
  const observed =
    attribute.observedCount < callCount ? ` (observed ${attribute.observedCount})` : "";
  if (attribute.reducer === "single")
    return styling.primaryValue(formatAttributeValue(attribute.value)) + observed;
  if (attribute.reducer === "distinct")
    return attribute.values
      .map(
        ({ value, count }) =>
          styling.primaryValue(formatAttributeValue(value)) + styling.separator(`(${count})`),
      )
      .join(styling.separator(", "));
  return (
    styling.primaryValue(formatNumber(attribute.minimum)) +
    styling.separator("…") +
    styling.primaryValue(formatNumber(attribute.maximum)) +
    observed
  );
}

function formatAttributeKey(key: string, base: string | undefined): string {
  if (base && key.startsWith(`${base}.`) && key.length > base.length + 1)
    return formatToken(key.slice(base.length + 1));
  return `/` + formatToken(key);
}

function formatAttributeValue(value: ProfileAttributeValue): string {
  if (typeof value !== "string") return String(value);
  if (value === "true" || value === "false" || isFiniteNumberString(value)) return quote(value);
  return formatToken(value);
}

function isFiniteNumberString(value: string): boolean {
  if (value.trim() === "") return false;
  return Number.isFinite(Number(value));
}

function formatScope(scope: ProfileInstrumentationScope): string {
  const name = formatScopeToken(scope.name);
  return scope.version === null ? name : `${name}@${formatScopeToken(scope.version)}`;
}

function formatScopeToken(value: string): string {
  return /[\s"\\\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u.test(value)
    ? quote(value)
    : value;
}

function formatToken(value: string): string {
  return TOKEN.test(value) && !value.startsWith("/") ? value : quote(value);
}

function quote(value: string): string {
  return JSON.stringify(value).replace(
    /[\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function exact(value: number, styling: Styling): string {
  return styling.primaryValue(formatCount(value));
}

function unit(value: number, canonicalUnit: string, styling: Styling): string {
  const formatted = formatUnit(value, canonicalUnit);
  return styling.primaryValue(formatted.value) + styling.unitSuffix(` ${formatted.unit}`);
}

function formatUnit(value: number, canonicalUnit: string): { value: string; unit: string } {
  if (canonicalUnit === "s") return scaledUnit(value, ["ns", "µs", "ms", "s"], 1000, 1e9);
  if (canonicalUnit === "By") return scaledUnit(value, ["B", "KiB", "MiB", "GiB"], 1024, 1);
  const entityUnits: Readonly<Record<string, string>> = {
    "{commit}": "commits",
    "{record}": "records",
    "{file}": "files",
    "{object}": "objects",
    "{change}": "changes",
    "{node}": "nodes",
    "{step}": "steps",
    "{operation}": "operations",
    "{expansion}": "expansions",
    "{fallback}": "fallbacks",
  };
  return {
    value: Number.isSafeInteger(value) ? String(value) : formatNumber(value),
    unit: entityUnits[canonicalUnit] ?? canonicalUnit,
  };
}

function scaledUnit(
  value: number,
  units: readonly string[],
  threshold: number,
  initialScale: number,
): { value: string; unit: string } {
  if (value === 0)
    return { value: "0", unit: units[initialScale === 1 ? 0 : units.length - 1]! };
  let scaled = value * initialScale;
  let index = 0;
  while (Math.abs(scaled) >= threshold && index < units.length - 1) {
    scaled /= threshold;
    index += 1;
  }
  let rendered = formatNumber(scaled);
  if (Math.abs(Number(rendered)) >= threshold && index < units.length - 1) {
    scaled /= threshold;
    index += 1;
    rendered = formatNumber(scaled);
  }
  return { value: rendered, unit: units[index]! };
}

function formatNumber(value: number): string {
  if (value === 0) return "0";
  const absolute = Math.abs(value);
  if (absolute >= 1e-3 && absolute < 1e7) return Number(value.toPrecision(4)).toString();
  return value
    .toExponential(3)
    .replace(/\.0+(?=e)/u, "")
    .replace(/(\.\d*?[1-9])0+(?=e)/u, "$1");
}
