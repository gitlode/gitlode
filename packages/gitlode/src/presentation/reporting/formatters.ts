import type {
  ProfileAttribute,
  ProfileDiagnostic,
  ProfileHistogramPoint,
  ProfileReport,
  ProfileSpanAggregate,
} from "@gitlode/internal-contracts/telemetry";

import { formatCount, formatElapsed, humanizeBytes } from "../format-utils.js";
import { plainStyling, type Styling } from "../styling.js";
import {
  findProfileViewEntry,
  isResolvedPluginScope,
  PROFILE_PRESENTATION_POLICY,
  PROFILE_VIEW_DIAGNOSTIC_LABELS,
} from "./profile-view.js";
import type { SummaryData } from "./types.js";

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
    ...fields.map(([label, value]) => `  ${styling.fieldKey(label.padEnd(18))}: ${value}`),
  ];
}

export function formatProfileLines(
  report: ProfileReport,
  styling: Styling = plainStyling,
): string[] {
  const incomplete = (["spans", "counters", "histograms"] as const).filter(
    (signal) => report.signalStatus[signal] !== "complete",
  );
  const lines = [styling.summaryHeader("Profile")];
  if (incomplete.length)
    lines.push(
      `  Status: ${incomplete.map((signal) => `${signal}=${report.signalStatus[signal]}`).join(", ")}`,
    );
  appendSpans(lines, report.signalStatus.spans, report.spans);
  appendMetrics(lines, "Counters", report.signalStatus.counters, report.counters, (point) => {
    const view = findProfileViewEntry("metric", point.name, point.scope.name);
    return metric(
      view?.label ??
        (isResolvedPluginScope(point.scope.name)
          ? point.name
          : `${displayScope(point.scope)} / ${point.name}`),
      point.value,
      point.unit,
      point.attributes,
    );
  });
  appendMetrics(lines, "Histograms", report.signalStatus.histograms, report.histograms, (point) => {
    const view = findProfileViewEntry("metric", point.name, point.scope.name);
    return histogram(
      point,
      view?.label ??
        (isResolvedPluginScope(point.scope.name)
          ? point.name
          : `${displayScope(point.scope)} / ${point.name}`),
    );
  });
  if (report.diagnostics.length || incomplete.length) {
    lines.push("  Diagnostics");
    if (report.diagnostics.length)
      for (const item of report.diagnostics) lines.push(`    ${diagnostic(item)}`);
    else lines.push("    (none)");
  }
  return lines.length === 1 ? [] : lines;
}

function appendSpans(
  lines: string[],
  status: string,
  spans: readonly ProfileSpanAggregate[],
): void {
  if (status === "complete" && !spans.length) return;
  lines.push(`  Spans${status === "complete" ? "" : ` (${status})`}`);
  if (status === PROFILE_PRESENTATION_POLICY.sectionPolicy.unavailable.statusLabel) {
    lines.push("    (no observations)");
    return;
  }
  const groups = new Map<
    string,
    { order: number; rows: Array<{ order: number; key: string; text: string }> }
  >();
  for (const span of spans) {
    const view = findProfileViewEntry("span", span.name, span.scope.name);
    const plugin = isResolvedPluginScope(span.scope.name);
    const group =
      view?.group ??
      (plugin
        ? PROFILE_PRESENTATION_POLICY.plugin.outerGroup
        : PROFILE_PRESENTATION_POLICY.fallback.spans.group);
    const subgroup = plugin ? displayScope(span.scope) : group;
    const key = `${displayScope(span.scope)}\0${span.name}`;
    const bucket = groups.get(`${group}\0${subgroup}`) ?? {
      order: view?.order ?? Number.MAX_SAFE_INTEGER,
      rows: [],
    };
    bucket.rows.push({
      order: view?.order ?? Number.MAX_SAFE_INTEGER,
      key,
      text: spanRow(span, view?.label, Boolean(view), plugin),
    });
    groups.set(`${group}\0${subgroup}`, bucket);
  }
  renderGroups(lines, groups);
  if (!spans.length) lines.push("    (no observations)");
}

function appendMetrics<T extends { name: string; scope: { name: string } }>(
  lines: string[],
  title: string,
  status: string,
  points: readonly T[],
  format: (point: T) => string,
): void {
  if (status === "complete" && !points.length) return;
  lines.push(`  ${title}${status === "complete" ? "" : ` (${status})`}`);
  if (status === PROFILE_PRESENTATION_POLICY.sectionPolicy.unavailable.statusLabel) {
    lines.push("    (no observations)");
    return;
  }
  const groups = new Map<
    string,
    { order: number; rows: Array<{ order: number; key: string; text: string }> }
  >();
  for (const point of points) {
    const view = findProfileViewEntry("metric", point.name, point.scope.name);
    const plugin = isResolvedPluginScope(point.scope.name);
    const fallback =
      title === "Counters"
        ? PROFILE_PRESENTATION_POLICY.fallback.counters.group
        : PROFILE_PRESENTATION_POLICY.fallback.histograms.group;
    const group =
      view?.group ?? (plugin ? PROFILE_PRESENTATION_POLICY.plugin.outerGroup : fallback);
    const subgroup = plugin ? displayScope(point.scope) : group;
    const key = `${displayScope(point.scope)}\0${point.name}\0${attributesKey((point as T & { attributes: readonly ProfileAttribute[] }).attributes)}`;
    const bucket = groups.get(`${group}\0${subgroup}`) ?? {
      order: view?.order ?? Number.MAX_SAFE_INTEGER,
      rows: [],
    };
    bucket.rows.push({ order: view?.order ?? Number.MAX_SAFE_INTEGER, key, text: format(point) });
    groups.set(`${group}\0${subgroup}`, bucket);
  }
  renderGroups(lines, groups);
  if (!points.length) lines.push("    (no observations)");
}

function renderGroups(
  lines: string[],
  groups: Map<string, { order: number; rows: Array<{ order: number; key: string; text: string }> }>,
): void {
  let currentGroup: string | undefined;
  for (const [key, bucket] of [...groups].sort(
    (a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]),
  )) {
    const [group, subgroup] = key.split("\0");
    if (group !== currentGroup) {
      lines.push(`    ${group}`);
      currentGroup = group;
    }
    if (subgroup !== group) lines.push(`      ${subgroup}`);
    for (const row of bucket.rows.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key)))
      lines.push(`      ${subgroup !== group ? "  " : ""}${row.text}`);
  }
}

function displayScope(scope: { name: string; version?: string | null }): string {
  return scope.version === null || scope.version === undefined
    ? scope.name
    : `${scope.name}@${scope.version}`;
}
function spanRow(
  span: ProfileSpanAggregate,
  label: string | undefined,
  known: boolean,
  plugin: boolean,
): string {
  const average = span.callCount ? span.totalDurationSeconds / span.callCount : 0;
  const identity = known
    ? label
    : plugin
      ? span.name
      : `${displayScope(span.scope)} / ${span.name}`;
  const attrs = span.attributes
    .map((attribute) => attributeSummary(attribute, span.callCount))
    .join(", ");
  return `${identity}: total=${unit(span.totalDurationSeconds, "s")}, calls=${formatCount(span.callCount)}, avg=${unit(average, "s")}, max=${unit(span.maxDurationSeconds, "s")}, errors=${formatCount(span.errorCount)}${attrs ? `, ${attrs}` : ""}`;
}
function metric(
  name: string,
  value: number,
  unitName: string,
  attrs: readonly ProfileAttribute[],
): string {
  return `${name}: ${unit(value, unitName)}${attrs.length ? `, ${attrs.map((a) => `${a.key}=${a.value}`).join(", ")}` : ""}`;
}
function histogram(point: ProfileHistogramPoint, label: string): string {
  const average = point.count ? point.sum / point.count : 0;
  return `${label}: count=${formatCount(point.count)}, total=${unit(point.sum, point.unit)}, avg=${unit(average, point.unit)}, min=${point.minimum === null ? "—" : unit(point.minimum, point.unit)}, max=${point.maximum === null ? "—" : unit(point.maximum, point.unit)}${point.attributes.length ? `, ${point.attributes.map((a) => `${a.key}=${a.value}`).join(", ")}` : ""}`;
}
function attributeSummary(
  attribute: ProfileSpanAggregate["attributes"][number],
  callCount: number,
): string {
  const observed =
    attribute.observedCount < callCount ? ` (observedCount=${attribute.observedCount})` : "";
  if (attribute.reducer === "single")
    return `${attribute.key}=${attribute.value}${observed}${attribute.conflictCount > 0 ? ` (conflicts=${attribute.conflictCount})` : ""}`;
  if (attribute.reducer === "distinct")
    return `${attribute.key}=${attribute.values.map((value) => `${value.value}(${value.count})`).join(",")}${attribute.overflowCount > 0 ? ` (overflow=${attribute.overflowCount})` : ""}`;
  return `${attribute.key}=${attribute.minimum}…${attribute.maximum}${observed}`;
}
function diagnostic(item: ProfileDiagnostic): string {
  const label = PROFILE_VIEW_DIAGNOSTIC_LABELS[item.code] ?? item.code;
  return `${item.severity} ${item.signal}/${item.stage}: ${label}${item.count > 1 ? ` x${item.count}` : ""}${item.message ? ` (${item.message})` : ""}`;
}
function attributesKey(attributes: readonly ProfileAttribute[]): string {
  return attributes.map((a) => `${a.key}=${String(a.value)}`).join("\0");
}
function unit(value: number, unitName: string): string {
  if (unitName === "s") {
    const n = Math.abs(value);
    if (n && n < 1e-6) return `${(value * 1e9).toPrecision(4)} ns`;
    if (n && n < 1e-3) return `${(value * 1e6).toPrecision(4)} µs`;
    if (n && n < 1) return `${(value * 1e3).toPrecision(4)} ms`;
  }
  if (unitName === "By") {
    const units = ["B", "KiB", "MiB", "GiB"];
    let index = 0;
    while (Math.abs(value) >= 1024 && index < 3) {
      value /= 1024;
      index++;
    }
    return `${Number(value.toPrecision(4))} ${units[index]}`;
  }
  const annotated: Record<string, string> = {
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
  return `${value} ${annotated[unitName] ?? unitName}`;
}
