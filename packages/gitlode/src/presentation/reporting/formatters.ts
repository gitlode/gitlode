import type { InstrumentAttributeValue, ProfileSummaryEntry } from "../../instrumentation/index.js";
import { firstOrThrow } from "../../support/helpers.js";
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
  entries: readonly ProfileSummaryEntry[],
  _skippedDiffs?: number,
  styling: Styling = plainStyling,
): string[] {
  if (entries.length === 0) return [];
  const nameWidth = Math.max(...entries.map((e) => e.name.length));
  const timeUnit = "ms";
  const totalWidth = Math.max(...entries.map((e) => formatMs(e.totalMs).length), "total".length);
  const callsWidth = Math.max(...entries.map((e) => formatCount(e.calls).length), "calls".length);
  const averageWidth = Math.max(...entries.map((e) => formatMs(e.averageMs).length), "avg".length);
  const maxWidth = Math.max(...entries.map((e) => formatMs(e.maxMs).length), "max".length);
  const header =
    `  ${styling.fieldKey("span".padEnd(nameWidth))} : ` +
    `${styling.fieldKey("total".padStart(totalWidth + timeUnit.length))}  ` +
    `${styling.fieldKey("calls".padStart(callsWidth))}  ` +
    `${styling.fieldKey("avg".padStart(averageWidth + timeUnit.length))}  ` +
    `${styling.fieldKey("max".padStart(maxWidth + timeUnit.length))}` +
    (entries.some((e) => formatProfileDetails(e) !== "") ? `  ${styling.fieldKey("details")}` : "");
  const lines = [
    styling.summaryHeader("Profile"),
    header,
    ...entries.map((e) => {
      const label = styling.fieldKey(e.name.padEnd(nameWidth));
      const total =
        styling.primaryValue(formatMs(e.totalMs).padStart(totalWidth)) +
        styling.unitSuffix(timeUnit);
      const calls = styling.primaryValue(formatCount(e.calls).padStart(callsWidth));
      const average =
        styling.primaryValue(formatMs(e.averageMs).padStart(averageWidth)) +
        styling.unitSuffix(timeUnit);
      const max =
        styling.primaryValue(formatMs(e.maxMs).padStart(maxWidth)) + styling.unitSuffix(timeUnit);
      const details = formatProfileDetails(e);
      return (
        `  ${label} : ${total}  ${calls}  ${average}  ${max}` +
        (details === "" ? "" : `  ${details}`)
      );
    }),
  ];
  return lines;
}

function formatProfileDetails(entry: ProfileSummaryEntry): string {
  const details: string[] = [];

  for (const [key, values] of Object.entries(entry.attributes ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    details.push(formatAttributeDetail(key, values));
  }

  for (const [key, value] of Object.entries(entry.counters ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    details.push(`${key}=${formatCount(value)}`);
  }

  if (entry.errors !== undefined) {
    details.push(`errors=${formatCount(entry.errors)}`);
  }

  return details.join(" ");
}

function formatAttributeDetail(key: string, values: readonly InstrumentAttributeValue[]): string {
  if (values.length === 1 && firstOrThrow(values) === true) return key;
  return `${key}=${formatAttributeValues(values)}`;
}

function formatAttributeValues(values: readonly InstrumentAttributeValue[]): string {
  if (values.length === 1) return formatAttributeValue(firstOrThrow(values));
  return `[${values.map(formatAttributeValue).join(",")}]`;
}

function formatAttributeValue(value: InstrumentAttributeValue): string {
  return typeof value === "number" ? formatCount(value) : String(value);
}
