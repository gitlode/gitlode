import type { ProgressEvent, ProgressPhase } from "../../core/index.js";
import { HEARTBEAT_INTERVAL_MS, SPINNER_FRAMES } from "./constants.js";
import { formatActiveLine, formatDoneLine } from "./formatters.js";
import { DefaultHeartbeatScheduler } from "./heartbeat-scheduler.js";
import type {
  Clock,
  HeartbeatScheduler,
  PhaseSnapshot,
  Scheduler,
  TerminalSink,
  UiMode,
} from "./types.js";

export class ProgressController {
  private readonly sink: TerminalSink;
  private readonly clock: Clock;
  private readonly mode: UiMode;
  private readonly heartbeat: HeartbeatScheduler;

  private currentPhase: ProgressPhase | null = null;
  private phaseStartMs = 0;
  private spinnerIndex = 0;

  private branchIndex = 0;
  private branchCount = 0;
  private commitsTraversed = 0;
  private recordsWritten = 0;
  private bytesWritten = 0;

  constructor(sink: TerminalSink, clock: Clock, scheduler: Scheduler, mode: UiMode) {
    this.sink = sink;
    this.clock = clock;
    this.mode = mode;
    this.heartbeat = new DefaultHeartbeatScheduler(scheduler);
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

    this.heartbeat.start(HEARTBEAT_INTERVAL_MS, () => {
      this.onHeartbeatTick();
    });
  }

  private onHeartbeatTick(): void {
    this.spinnerIndex++;
    const nowMs = this.clock.nowMs();
    this.sink.rewriteLine(formatActiveLine(this.snapshot(nowMs), this.currentSpinnerFrame()));
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
  }

  private onPhaseEnd(_phase: ProgressPhase): void {
    this.heartbeat.dispose();

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
      // Immediately restore the progress line after a warning interruption.
      const now = this.clock.nowMs();
      this.sink.rewriteLine(formatActiveLine(this.snapshot(now), this.currentSpinnerFrame()));
    } else {
      // non-tty-summary and quiet both show warnings via plain writeLine
      this.sink.writeLine(message);
    }
  }
}
