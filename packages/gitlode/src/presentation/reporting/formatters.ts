import type {
  ProfileAttribute,
  ProfileDiagnostic,
  ProfileHistogramPoint,
  ProfileReport,
  ProfileSpanAggregate,
} from "@gitlode/internal-contracts/telemetry";

import { formatCount, formatElapsed, humanizeBytes } from "../format-utils.js";
import { plainStyling, type Styling } from "../styling.js";
import type { SummaryData } from "./types.js";

export function formatSummaryLines(data: SummaryData, styling: Styling = plainStyling): string[] {
  const bytes = humanizeBytes(data.bytesWritten);
  const elapsed = formatElapsed(data.elapsedMs);
  const fields: Array<[string, string]> = [
    ["Records written", formatCount(data.recordsWritten)],
    ["Commits traversed", formatCount(data.commitsTraversed)],
    ["Files created", formatCount(data.filesCreated)],
    ["Bytes written", `${bytes.value}${bytes.unit}`],
    ["Elapsed time", `${elapsed.value}${elapsed.unit}`],
    ["Refs", data.refs.join(", ") || "(none)"],
  ];
  return [
    styling.summaryHeader("Extraction complete"),
    ...fields.map(
      ([label, value]) => `  ${styling.fieldKey(label.padEnd(18))}: ${styling.primaryValue(value)}`,
    ),
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
  append(lines, "Spans", report.signalStatus.spans, report.spans.map(formatSpan));
  append(
    lines,
    "Counters",
    report.signalStatus.counters,
    report.counters.map((p) =>
      metric(`${scope(p.scope)} / ${p.name}`, p.value, p.unit, p.attributes),
    ),
  );
  append(
    lines,
    "Histograms",
    report.signalStatus.histograms,
    report.histograms.map(formatHistogram),
  );
  if (report.diagnostics.length) {
    lines.push("  Diagnostics");
    for (const d of report.diagnostics) lines.push(`    ${diagnostic(d)}`);
  }
  return lines.length === 1 ? [] : lines;
}

function append(lines: string[], title: string, status: string, rows: string[]): void {
  if (status === "complete" && !rows.length) return;
  lines.push(`  ${title}${status === "complete" ? "" : ` (${status})`}`);
  lines.push(...(rows.length ? rows.map((r) => `    ${r}`) : ["    (no observations)"]));
}
function scope(s: { name: string; version: string | null }): string {
  return s.version === null ? s.name : `${s.name}@${s.version}`;
}
function formatSpan(s: ProfileSpanAggregate): string {
  const avg = s.callCount ? s.totalDurationSeconds / s.callCount : 0;
  const attrs = s.attributes.map((a) => `${a.key}=${spanValue(a)}`).join(", ");
  return `${scope(s.scope)} / ${s.name}: total=${unit(s.totalDurationSeconds, "s")}, calls=${formatCount(s.callCount)}, avg=${unit(avg, "s")}, max=${unit(s.maxDurationSeconds, "s")}, errors=${formatCount(s.errorCount)}${attrs ? `, ${attrs}` : ""}`;
}
function metric(
  name: string,
  value: number,
  unitName: string,
  attrs: readonly ProfileAttribute[],
): string {
  return `${name}: ${unit(value, unitName)}${attrs.length ? `, ${attrs.map((a) => `${a.key}=${a.value}`).join(", ")}` : ""}`;
}
function formatHistogram(p: ProfileHistogramPoint): string {
  const avg = p.count ? p.sum / p.count : 0;
  return `${scope(p.scope)} / ${p.name}: count=${formatCount(p.count)}, total=${unit(p.sum, p.unit)}, avg=${unit(avg, p.unit)}, min=${p.minimum === null ? "—" : unit(p.minimum, p.unit)}, max=${p.maximum === null ? "—" : unit(p.maximum, p.unit)}${p.attributes.length ? `, ${p.attributes.map((a) => `${a.key}=${a.value}`).join(", ")}` : ""}`;
}
function diagnostic(d: ProfileDiagnostic): string {
  return `${d.severity} ${d.signal}/${d.stage}: ${d.code}${d.count > 1 ? ` x${d.count}` : ""}${d.message ? ` (${d.message})` : ""}`;
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
