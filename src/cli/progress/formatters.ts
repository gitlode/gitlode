import type { ProgressPhase } from "../../core/index.js";
import { formatElapsed, humanizeBytes } from "../format-utils.js";
import type { PhaseSnapshot } from "./types.js";

export { formatElapsed, humanizeBytes };

function phaseLabel(phase: ProgressPhase): string {
  switch (phase) {
    case "preparing":
      return "Preparing extraction";
    case "extracting":
      return "Extracting history";
    case "finalizing":
      return "Finalizing output";
  }
}

export function formatActiveLine(snapshot: PhaseSnapshot, spinnerFrame: string): string {
  const elapsed = formatElapsed(snapshot.nowMs - snapshot.startMs);
  const label = phaseLabel(snapshot.phase);

  if (snapshot.phase === "extracting" && snapshot.refCount > 0) {
    const refField = `refs ${snapshot.refIndex + 1}/${snapshot.refCount}`;
    const bytes = humanizeBytes(snapshot.bytesWritten);
    const commits = snapshot.commitsTraversed.toLocaleString("en-US");
    const records = snapshot.recordsWritten.toLocaleString("en-US");
    return `${spinnerFrame} ${label}  ${refField}  commits ${commits}  records ${records}  written ${bytes}  elapsed ${elapsed}`;
  }

  return `${spinnerFrame} ${label}  elapsed ${elapsed}`;
}

export function formatDoneLine(snapshot: PhaseSnapshot): string {
  const elapsed = formatElapsed(snapshot.nowMs - snapshot.startMs);
  const label = phaseLabel(snapshot.phase);

  if (snapshot.phase === "extracting" && snapshot.refCount > 0) {
    const refField = `refs ${snapshot.refCount}/${snapshot.refCount}`;
    const bytes = humanizeBytes(snapshot.bytesWritten);
    const commits = snapshot.commitsTraversed.toLocaleString("en-US");
    const records = snapshot.recordsWritten.toLocaleString("en-US");
    return `  ${label}  ${refField}  commits ${commits}  records ${records}  written ${bytes}  elapsed ${elapsed}`;
  }

  return `  ${label}  elapsed ${elapsed}`;
}
