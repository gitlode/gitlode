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
  profileMetricViewEntry,
  profileViewEntry,
  PROFILE_VIEW_DIAGNOSTIC_LABELS,
} from "./profile-view.js";
import type { SummaryData } from "./types.js";

export function formatSummaryLines(data: SummaryData, styling: Styling = plainStyling): string[] {
  const bytes = humanizeBytes(data.bytesWritten);
  const elapsed = formatElapsed(data.elapsedMs);
  const fields: Array<[string, string]> = [
    ["Records written", formatCount(data.recordsWritten)],
    ["Commits traversed", formatCount(data.commitsTraversed)],
    ["Files created", formatCount(data.filesCreated)],
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
  const lines = [styling.summaryHeader("Profile")];
  const incomplete = (["spans", "counters", "histograms"] as const).filter(
    (s) => report.signalStatus[s] !== "complete",
  );
  if (incomplete.length)
    lines.push(`  Status: ${incomplete.map((s) => `${s}=${report.signalStatus[s]}`).join(", ")}`);
  appendSpans(lines, report.signalStatus.spans, report.spans);
  appendMetrics(lines, "Counters", report.signalStatus.counters, report.counters, (p) =>
    metric(`${scope(p.scope)} / ${metricLabel(p.name)}`, p.value, p.unit, p.attributes),
  );
  appendMetrics(lines, "Histograms", report.signalStatus.histograms, report.histograms, (p) =>
    formatHistogram(p, metricLabel(p.name)),
  );
  if (report.diagnostics.length) {
    lines.push("  Diagnostics");
    for (const d of report.diagnostics) lines.push(`    ${diagnostic(d)}`);
  }
  return lines.length === 1 ? [] : lines;
}

function appendMetrics<T extends { name: string }>(
  lines: string[],
  title: string,
  status: string,
  points: readonly T[],
  format: (point: T) => string,
): void {
  if (status === "complete" && points.length === 0) return;
  lines.push(`  ${title}${status === "complete" ? "" : ` (${status})`}`);
  const groups = new Map<string, { order: number; rows: string[] }>();
  for (const point of points) {
    const view = profileMetricViewEntry(profileRef(point.name));
    const group = view?.group ?? "Other metrics";
    const value = groups.get(group) ?? { order: view?.order ?? Number.MAX_SAFE_INTEGER, rows: [] };
    value.rows.push(format(point));
    groups.set(group, value);
  }
  for (const [group, value] of [...groups.entries()].sort((a, b) => a[1].order - b[1].order)) {
    lines.push(`    ${group}`);
    lines.push(...value.rows.map((row) => `      ${row}`));
  }
  if (points.length === 0) lines.push("    (no observations)");
}

function appendSpans(
  lines: string[],
  status: string,
  spans: readonly ProfileSpanAggregate[],
): void {
  if (status === "complete" && spans.length === 0) return;
  lines.push(`  Spans${status === "complete" ? "" : ` (${status})`}`);
  const groups = new Map<string, { order: number; rows: string[] }>();
  for (const span of spans) {
    const view = PROFILE_VIEW_ENTRIES_BY_NAME(span.name);
    const group = view?.group ?? "Other spans";
    const order = view?.order ?? Number.MAX_SAFE_INTEGER;
    const value = groups.get(group) ?? { order, rows: [] };
    value.rows.push(formatSpan(span));
    groups.set(group, value);
  }
  for (const [group, value] of [...groups.entries()].sort((a, b) => a[1].order - b[1].order)) {
    lines.push(`    ${group}`);
    for (const row of value.rows) lines.push(`      ${row}`);
  }
  if (spans.length === 0) lines.push("    (no observations)");
}
function scope(s: { name: string; version: string | null }): string {
  return s.version === null ? s.name : `${s.name}@${s.version}`;
}
function formatSpan(s: ProfileSpanAggregate): string {
  const avg = s.callCount ? s.totalDurationSeconds / s.callCount : 0;
  const attrs = s.attributes.map((a) => `${a.key}=${spanValue(a)}`).join(", ");
  const view = PROFILE_VIEW_ENTRIES_BY_NAME(s.name);
  const label = view?.label ?? s.name;
  return `${scope(s.scope)} / ${label}: total=${unit(s.totalDurationSeconds, "s")}, calls=${formatCount(s.callCount)}, avg=${unit(avg, "s")}, max=${unit(s.maxDurationSeconds, "s")}, errors=${formatCount(s.errorCount)}${attrs ? `, ${attrs}` : ""}`;
}
function metric(
  name: string,
  value: number,
  unitName: string,
  attrs: readonly ProfileAttribute[],
): string {
  return `${name}: ${unit(value, unitName)}${attrs.length ? `, ${attrs.map((a) => `${a.key}=${a.value}`).join(", ")}` : ""}`;
}
function formatHistogram(p: ProfileHistogramPoint, label = p.name): string {
  const avg = p.count ? p.sum / p.count : 0;
  return `${scope(p.scope)} / ${label}: count=${formatCount(p.count)}, total=${unit(p.sum, p.unit)}, avg=${unit(avg, p.unit)}, min=${p.minimum === null ? "—" : unit(p.minimum, p.unit)}, max=${p.maximum === null ? "—" : unit(p.maximum, p.unit)}${p.attributes.length ? `, ${p.attributes.map((a) => `${a.key}=${a.value}`).join(", ")}` : ""}`;
}
function diagnostic(d: ProfileDiagnostic): string {
  const label = PROFILE_VIEW_DIAGNOSTIC_LABELS[d.code] ?? d.code;
  return `${d.severity} ${d.signal}/${d.stage}: ${label}${d.count > 1 ? ` x${d.count}` : ""}${d.message ? ` (${d.message})` : ""}`;
}

function PROFILE_VIEW_ENTRIES_BY_NAME(name: string) {
  return profileViewEntry(profileRef(name));
}
function metricLabel(name: string): string {
  return profileMetricViewEntry(profileRef(name))?.label ?? name;
}
function profileRef(name: string): string {
  return name.replace(/^gitlode\./, "").replaceAll(".", "_");
}
function spanValue(a: ProfileSpanAggregate["attributes"][number]): string {
  if (a.reducer === "single")
    return `${a.value}${a.conflictCount ? ` (conflicts=${a.conflictCount})` : ""}`;
  if (a.reducer === "distinct")
    return `${a.values.map((v) => `${v.value}(${v.count})`).join(",")}${a.overflowCount ? ` (overflow=${a.overflowCount})` : ""}`;
  return `${a.minimum}…${a.maximum}`;
}
function unit(value: number, name: string): string {
  if (name === "s") {
    const n = Math.abs(value);
    if (n && n < 1e-6) return `${(value * 1e9).toPrecision(4)} ns`;
    if (n && n < 1e-3) return `${(value * 1e6).toPrecision(4)} µs`;
    if (n && n < 1) return `${(value * 1e3).toPrecision(4)} ms`;
  }
  if (name === "By") {
    const u = ["B", "KiB", "MiB", "GiB"];
    let i = 0;
    while (Math.abs(value) >= 1024 && i < 3) {
      value /= 1024;
      i++;
    }
    return `${Number(value.toPrecision(4))} ${u[i]}`;
  }
  return `${value} ${name}`;
}
