import type { ProfilingEntry } from "../../core/index.js";
import { formatElapsed, humanizeBytes } from "../format-utils.js";
import type { SummaryData } from "./types.js";

export function formatSummaryLines(data: SummaryData): string[] {
  const lines: string[] = ["Extraction complete"];
  const fields: Array<[string, string]> = [
    ["Records written", String(data.recordsWritten)],
    ["Commits traversed", String(data.commitsTraversed)],
    ["Files created", String(data.filesCreated)],
    ["Bytes written", humanizeBytes(data.bytesWritten)],
    ["Elapsed time", formatElapsed(data.elapsedMs)],
    ["Branches", data.branches.join(", ") || "(none)"],
  ];
  for (const [label, value] of fields) {
    lines.push(`  ${label.padEnd(18)}: ${value}`);
  }
  return lines;
}

export function formatProfileLines(entries: readonly ProfilingEntry[]): string[] {
  if (entries.length === 0) return [];
  const nameWidth = Math.max(...entries.map((e) => e.name.length));
  const wallWidth = Math.max(...entries.map((e) => e.wallMs.toFixed(2).length));
  const workWidth = Math.max(...entries.map((e) => e.workMs.toFixed(2).length));
  return [
    "Profile",
    ...entries.map((e) => {
      const label = e.name.padEnd(nameWidth);
      const wall = `${e.wallMs.toFixed(2)}ms`.padStart(wallWidth + 2);
      const work = `${e.workMs.toFixed(2)}ms`.padStart(workWidth + 2);
      return `  ${label} : wall= ${wall}  work= ${work}`;
    }),
  ];
}
