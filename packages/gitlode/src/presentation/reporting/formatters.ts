import type { ProfilingEntry } from "../../profile/index.js";
import { formatCount, formatElapsedRaw, formatMs, humanizeBytesRaw } from "../format-utils.js";
import { plainStyling, type Styling } from "../styling.js";
import type { SummaryData } from "./types.js";

export function formatSummaryLines(data: SummaryData, styling: Styling = plainStyling): string[] {
  const header = styling.summaryHeader("Extraction complete");
  const { value: bytesVal, unit: bytesUnit } = humanizeBytesRaw(data.bytesWritten);
  const bytesStr = styling.primaryValue(bytesVal) + styling.unitSuffix(bytesUnit);
  const { value: elapsedVal, unit: elapsedUnit } = formatElapsedRaw(data.elapsedMs);
  const elapsedStr = styling.primaryValue(elapsedVal) + styling.unitSuffix(elapsedUnit);
  const refsStr = styling.refsValue(data.refs.join(", ") || "(none)");

  const fields: Array<[string, string]> = [
    ["Records written", styling.primaryValue(formatCount(data.recordsWritten))],
    ["Commits traversed", styling.primaryValue(formatCount(data.commitsTraversed))],
    ["Files created", styling.primaryValue(formatCount(data.filesCreated))],
    ["Bytes written", bytesStr],
    ["Elapsed time", elapsedStr],
    ["Refs", refsStr],
  ];
  const lines: string[] = [header];
  for (const [label, value] of fields) {
    lines.push(`  ${styling.fieldKey(label.padEnd(18))}: ${value}`);
  }
  return lines;
}

export function formatProfileLines(
  entries: readonly ProfilingEntry[],
  skippedDiffs?: number,
  styling: Styling = plainStyling,
): string[] {
  if (entries.length === 0) return [];
  const nameWidth = Math.max(...entries.map((e) => e.name.length));
  const wallWidth = Math.max(...entries.map((e) => formatMs(e.wallMs).length));
  const workWidth = Math.max(...entries.map((e) => formatMs(e.workMs).length));
  const lines = [
    styling.summaryHeader("Profile"),
    ...entries.map((e) => {
      const label = styling.fieldKey(e.name.padEnd(nameWidth));
      const wallVal = formatMs(e.wallMs).padStart(wallWidth);
      const workVal = formatMs(e.workMs).padStart(workWidth);
      const wall = styling.primaryValue(wallVal) + styling.unitSuffix("ms");
      const work = styling.primaryValue(workVal) + styling.unitSuffix("ms");
      return `  ${label} : ${styling.fieldKey("wall=")} ${wall}  ${styling.fieldKey("work=")} ${work}`;
    }),
  ];
  if (skippedDiffs !== undefined) {
    lines.push(
      `  ${styling.fieldKey("skipped_diffs")} : ${styling.primaryValue(formatCount(skippedDiffs))}`,
    );
  }
  return lines;
}
