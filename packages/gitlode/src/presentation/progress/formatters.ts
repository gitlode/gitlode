import type { ProgressPhase } from "@gitlode/internal-contracts/progress";

import { formatCount, formatElapsed, humanizeBytes } from "../format-utils.js";
import { plainStyling, type Styling } from "../styling.js";
import type { PhaseSnapshot } from "./types.js";

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
  const { value: elapsedVal, unit: elapsedUnit } = formatElapsed(elapsedMs);
  const elapsedStr = styling.value(elapsedVal) + styling.unit(elapsedUnit);

  if (snapshot.phase === "extracting" && snapshot.refCount > 0) {
    const commits = formatCount(snapshot.commitsTraversed);
    const records = formatCount(snapshot.recordsWritten);
    const { value: bytesVal, unit: bytesUnit } = humanizeBytes(snapshot.bytesWritten);
    const bytesStr = styling.value(bytesVal) + styling.unit(bytesUnit);

    return (
      `${styling.active(spinnerFrame)} ${styling.label(label)}` +
      `  ${styling.fieldLabel("refs")} ${styling.value(String(snapshot.refIndex + 1))}/${styling.value(String(snapshot.refCount))}` +
      `  ${styling.fieldLabel("commits")} ${styling.value(commits)}` +
      `  ${styling.fieldLabel("records")} ${styling.value(records)}` +
      `  ${styling.fieldLabel("written")} ${bytesStr}` +
      `  ${styling.fieldLabel("elapsed")} ${elapsedStr}`
    );
  }

  return (
    `${styling.active(spinnerFrame)} ${styling.label(label)}` +
    `  ${styling.fieldLabel("elapsed")} ${elapsedStr}`
  );
}

export function formatDoneLine(snapshot: PhaseSnapshot, styling: Styling = plainStyling): string {
  const label = phaseLabel(snapshot.phase);
  const elapsedMs = snapshot.nowMs - snapshot.startMs;
  const { value: elapsedVal, unit: elapsedUnit } = formatElapsed(elapsedMs);
  const elapsedStr = styling.value(elapsedVal) + styling.unit(elapsedUnit);

  if (snapshot.phase === "extracting" && snapshot.refCount > 0) {
    const commits = formatCount(snapshot.commitsTraversed);
    const records = formatCount(snapshot.recordsWritten);
    const { value: bytesVal, unit: bytesUnit } = humanizeBytes(snapshot.bytesWritten);
    const bytesStr = styling.value(bytesVal) + styling.unit(bytesUnit);

    return (
      `${styling.success("✓")} ${styling.label(label)}` +
      `  ${styling.fieldLabel("refs")} ${styling.value(String(snapshot.refCount))}/${styling.value(String(snapshot.refCount))}` +
      `  ${styling.fieldLabel("commits")} ${styling.value(commits)}` +
      `  ${styling.fieldLabel("records")} ${styling.value(records)}` +
      `  ${styling.fieldLabel("written")} ${bytesStr}` +
      `  ${styling.fieldLabel("elapsed")} ${elapsedStr}`
    );
  }

  return (
    `${styling.success("✓")} ${styling.label(label)}` +
    `  ${styling.fieldLabel("elapsed")} ${elapsedStr}`
  );
}
