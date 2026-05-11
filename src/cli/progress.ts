import type { ProfilingEntry, ProgressEvent, ProgressPhase } from "../core/index.js";

// ---------------------------------------------------------------------------
// Interfaces for dependency injection (testable without real I/O or timers)
// ---------------------------------------------------------------------------

export interface TerminalSink {
  /** Write a line followed by a newline. */
  writeLine(text: string): void;
  /** Overwrite the current line (TTY only). */
  rewriteLine(text: string): void;
  /** Move to a new line. */
  newline(): void;
}

export interface Clock {
  nowMs(): number;
}

export interface Scheduler {
  setInterval(fn: () => void, ms: number): () => void;
}

// ---------------------------------------------------------------------------
// UI mode
// ---------------------------------------------------------------------------

export type UiMode = "quiet" | "tty-interactive" | "non-tty-summary";

export function resolveUiMode(quiet: boolean, isTTY: boolean): UiMode {
  if (quiet) return "quiet";
  if (isTTY) return "tty-interactive";
  return "non-tty-summary";
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// ---------------------------------------------------------------------------
// Stage snapshot (carries all display state for a phase)
// ---------------------------------------------------------------------------

interface PhaseSnapshot {
  phase: ProgressPhase;
  startMs: number;
  branchIndex: number;
  branchCount: number;
  commitsTraversed: number;
  recordsWritten: number;
  bytesWritten: number;
  nowMs: number;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function humanizeBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

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

  if (snapshot.phase === "extracting" && snapshot.branchCount > 0) {
    const branchField = `branch ${snapshot.branchIndex + 1}/${snapshot.branchCount}`;
    const bytes = humanizeBytes(snapshot.bytesWritten);
    return `${spinnerFrame} ${label}  ${branchField}  commits ${snapshot.commitsTraversed}  records ${snapshot.recordsWritten}  ${bytes}  ${elapsed}`;
  }

  return `${spinnerFrame} ${label}  ${elapsed}`;
}

export function formatDoneLine(snapshot: PhaseSnapshot): string {
  const elapsed = formatElapsed(snapshot.nowMs - snapshot.startMs);
  const label = phaseLabel(snapshot.phase);

  if (snapshot.phase === "extracting" && snapshot.branchCount > 0) {
    const branchField = `branch ${snapshot.branchCount}/${snapshot.branchCount}`;
    const bytes = humanizeBytes(snapshot.bytesWritten);
    return `  ${label}  ${branchField}  commits ${snapshot.commitsTraversed}  records ${snapshot.recordsWritten}  ${bytes}  ${elapsed}`;
  }

  return `  ${label}  ${elapsed}`;
}

// ---------------------------------------------------------------------------
// Summary block
// ---------------------------------------------------------------------------

export interface SummaryData {
  recordsWritten: number;
  commitsTraversed: number;
  filesCreated: number;
  bytesWritten: number;
  elapsedMs: number;
  branches: readonly string[];
}

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

// ---------------------------------------------------------------------------
// Profile block
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ProgressController
// ---------------------------------------------------------------------------

export class ProgressController {
  private readonly sink: TerminalSink;
  private readonly clock: Clock;
  private readonly scheduler: Scheduler;
  private readonly mode: UiMode;

  private currentPhase: ProgressPhase | null = null;
  private phaseStartMs = 0;
  private spinnerIndex = 0;
  private lastSemanticRedrawMs = 0;
  private cancelHeartbeat: (() => void) | null = null;

  private branchIndex = 0;
  private branchCount = 0;
  private commitsTraversed = 0;
  private recordsWritten = 0;
  private bytesWritten = 0;

  constructor(sink: TerminalSink, clock: Clock, scheduler: Scheduler, mode: UiMode) {
    this.sink = sink;
    this.clock = clock;
    this.scheduler = scheduler;
    this.mode = mode;
  }

  handleEvent(event: ProgressEvent): void {
    switch (event.type) {
      case "phase-start":
        this.onPhaseStart(event.phase);
        break;
      case "extracting-progress":
        this.onProgress(
          event.branchIndex,
          event.branchCount,
          event.commitsTraversed,
          event.recordsWritten,
          event.bytesWritten,
        );
        break;
      case "phase-end":
        this.onPhaseEnd(event.phase);
        break;
      case "warning":
        this.onWarning(event.message);
        break;
    }
  }

  private snapshot(nowMs: number): PhaseSnapshot {
    return {
      phase: this.currentPhase!,
      startMs: this.phaseStartMs,
      branchIndex: this.branchIndex,
      branchCount: this.branchCount,
      commitsTraversed: this.commitsTraversed,
      recordsWritten: this.recordsWritten,
      bytesWritten: this.bytesWritten,
      nowMs,
    };
  }

  private currentSpinnerFrame(): string {
    return SPINNER_FRAMES[this.spinnerIndex % SPINNER_FRAMES.length]!;
  }

  private onPhaseStart(phase: ProgressPhase): void {
    this.currentPhase = phase;
    this.phaseStartMs = this.clock.nowMs();
    this.spinnerIndex = 0;

    if (this.mode !== "tty-interactive") return;

    const now = this.phaseStartMs;
    this.sink.rewriteLine(formatActiveLine(this.snapshot(now), this.currentSpinnerFrame()));
    this.lastSemanticRedrawMs = now;

    this.cancelHeartbeat = this.scheduler.setInterval(() => {
      const nowMs = this.clock.nowMs();
      // Suppress heartbeat redraw if a semantic redraw was very recent (< 100ms ago).
      if (nowMs - this.lastSemanticRedrawMs < 100) return;
      this.spinnerIndex++;
      this.sink.rewriteLine(formatActiveLine(this.snapshot(nowMs), this.currentSpinnerFrame()));
    }, 500);
  }

  private onProgress(
    branchIndex: number,
    branchCount: number,
    commitsTraversed: number,
    recordsWritten: number,
    bytesWritten: number,
  ): void {
    this.branchIndex = branchIndex;
    this.branchCount = branchCount;
    this.commitsTraversed = commitsTraversed;
    this.recordsWritten = recordsWritten;
    this.bytesWritten = bytesWritten;

    if (this.mode !== "tty-interactive") return;

    const now = this.clock.nowMs();
    this.lastSemanticRedrawMs = now;
    this.sink.rewriteLine(formatActiveLine(this.snapshot(now), this.currentSpinnerFrame()));
  }

  private onPhaseEnd(_phase: ProgressPhase): void {
    if (this.cancelHeartbeat !== null) {
      this.cancelHeartbeat();
      this.cancelHeartbeat = null;
    }

    if (this.mode !== "tty-interactive") {
      this.currentPhase = null;
      return;
    }

    const now = this.clock.nowMs();
    this.sink.rewriteLine(formatDoneLine(this.snapshot(now)));
    this.sink.newline();

    this.currentPhase = null;
    this.branchIndex = 0;
    this.branchCount = 0;
    this.commitsTraversed = 0;
    this.recordsWritten = 0;
    this.bytesWritten = 0;
  }

  private onWarning(message: string): void {
    if (this.mode === "tty-interactive" && this.currentPhase !== null) {
      this.sink.newline();
      this.sink.writeLine(message);
      const now = this.clock.nowMs();
      this.sink.rewriteLine(formatActiveLine(this.snapshot(now), this.currentSpinnerFrame()));
      this.lastSemanticRedrawMs = now;
    } else {
      // non-tty-summary and quiet both show warnings via plain writeLine
      this.sink.writeLine(message);
    }
  }
}
