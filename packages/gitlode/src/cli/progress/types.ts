import type { ProgressPhase } from "../../core/index.js";

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

export interface HeartbeatScheduler {
  /** Start the heartbeat timer with the given interval and callback. */
  start(intervalMs: number, onTick: () => void): void;
  /** Stop the heartbeat timer (can be restarted with start()). */
  stop(): void;
  /** Dispose of the heartbeat scheduler and clean up resources. */
  dispose(): void;
}

export type UiMode = "quiet" | "tty-interactive" | "non-tty-summary";

export interface PhaseSnapshot {
  phase: ProgressPhase;
  startMs: number;
  refIndex: number;
  refCount: number;
  commitsTraversed: number;
  recordsWritten: number;
  bytesWritten: number;
  nowMs: number;
}
