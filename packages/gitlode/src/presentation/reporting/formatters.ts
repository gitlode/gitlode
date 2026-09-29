import type { ProfileReport } from "@gitlode/internal-contracts/telemetry";

import { formatCount, formatElapsed, humanizeBytes } from "../format-utils.js";
import { plainStyling, type Styling } from "../styling.js";
import { renderProfile } from "./profile-renderer.js";
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
    styling.h1("Extraction complete"),
    ...fields.map(
      ([label, value]) =>
        `  ${styling.fieldKey(label.padEnd(18))}${styling.separator(":")} ${value}`,
    ),
  ];
}

/** Collect the streaming renderer for callers that explicitly need an array. */
export function formatProfileLines(
  report: ProfileReport,
  styling: Styling = plainStyling,
): string[] {
  const lines: string[] = [];
  renderProfile(
    {
      writeLine: (line) => {
        lines.push(line);
      },
    },
    report,
    styling,
  );
  return lines;
}
