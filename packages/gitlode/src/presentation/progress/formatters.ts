import type { ProgressPhase } from "../../core/index.js";
import {
  formatCount,
  formatElapsed,
  formatElapsedRaw,
  humanizeBytes,
  humanizeBytesRaw,
} from "../format-utils.js";
import { plainStyling, type Styling } from "../styling.js";
import type { PhaseSnapshot } from "./types.js";

export { formatElapsed, humanizeBytes };

function phaseLabel(phase: ProgressPhase): string {
  switch (phase) {
    case "initializing-plugins":
      return "Initializing plugins";
    case "preparing":
      return "Preparing extraction";
    case "extracting":
      return "Extracting history";
    case "finalizing":
      return "Finalizing output";
  }
}

export function formatActiveLine(
  snapshot: PhaseSnapshot,
  spinnerFrame: string,
  styling: Styling = plainStyling,
): string {
  const label = phaseLabel(snapshot.phase);
  const elapsedMs = snapshot.nowMs - snapshot.startMs;
  const { value: elapsedVal, unit: elapsedUnit } = formatElapsedRaw(elapsedMs);
  const elapsedStr = styling.primaryValue(elapsedVal) + styling.unitSuffix(elapsedUnit);

  if (snapshot.phase === "extracting" && snapshot.refCount > 0) {
    const commits = formatCount(snapshot.commitsTraversed);
    const records = formatCount(snapshot.recordsWritten);
    const { value: bytesVal, unit: bytesUnit } = humanizeBytesRaw(snapshot.bytesWritten);
    const bytesStr = styling.primaryValue(bytesVal) + styling.unitSuffix(bytesUnit);

    return (
      `${styling.spinnerGlyph(spinnerFrame)} ${styling.stageLabel(label)}` +
      `  ${styling.fieldKey("refs")} ${styling.primaryValue(String(snapshot.refIndex + 1))}/${styling.primaryValue(String(snapshot.refCount))}` +
      `  ${styling.fieldKey("commits")} ${styling.primaryValue(commits)}` +
      `  ${styling.fieldKey("records")} ${styling.primaryValue(records)}` +
      `  ${styling.fieldKey("written")} ${bytesStr}` +
      `  ${styling.fieldKey("elapsed")} ${elapsedStr}`
    );
  }

  return (
    `${styling.spinnerGlyph(spinnerFrame)} ${styling.stageLabel(label)}` +
    `  ${styling.fieldKey("elapsed")} ${elapsedStr}`
  );
}

export function formatDoneLine(snapshot: PhaseSnapshot, styling: Styling = plainStyling): string {
  const label = phaseLabel(snapshot.phase);
  const elapsedMs = snapshot.nowMs - snapshot.startMs;
  const { value: elapsedVal, unit: elapsedUnit } = formatElapsedRaw(elapsedMs);
  const elapsedStr = styling.primaryValue(elapsedVal) + styling.unitSuffix(elapsedUnit);

  if (snapshot.phase === "extracting" && snapshot.refCount > 0) {
    const commits = formatCount(snapshot.commitsTraversed);
    const records = formatCount(snapshot.recordsWritten);
    const { value: bytesVal, unit: bytesUnit } = humanizeBytesRaw(snapshot.bytesWritten);
    const bytesStr = styling.primaryValue(bytesVal) + styling.unitSuffix(bytesUnit);

    return (
      `${styling.doneMarker("✓")} ${styling.stageLabel(label)}` +
      `  ${styling.fieldKey("refs")} ${styling.primaryValue(String(snapshot.refCount))}/${styling.primaryValue(String(snapshot.refCount))}` +
      `  ${styling.fieldKey("commits")} ${styling.primaryValue(commits)}` +
      `  ${styling.fieldKey("records")} ${styling.primaryValue(records)}` +
      `  ${styling.fieldKey("written")} ${bytesStr}` +
      `  ${styling.fieldKey("elapsed")} ${elapsedStr}`
    );
  }

  return (
    `${styling.doneMarker("✓")} ${styling.stageLabel(label)}` +
    `  ${styling.fieldKey("elapsed")} ${elapsedStr}`
  );
}
