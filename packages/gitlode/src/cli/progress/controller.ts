import type { ProgressEvent, ProgressPhase } from "../../core/index.js";
import { formatDiagnosticLines } from "../diagnostics.js";
import { plainStyling, type Styling } from "../styling.js";
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
  private readonly styling: Styling;

  private currentPhase: ProgressPhase | null = null;
  private phaseStartMs = 0;
  private spinnerIndex = 0;

  private refIndex = 0;
  private refCount = 0;
  private commitsTraversed = 0;
  private recordsWritten = 0;
  private bytesWritten = 0;

  constructor(
    sink: TerminalSink,
    clock: Clock,
    scheduler: Scheduler,
    mode: UiMode,
    styling: Styling = plainStyling,
  ) {
    this.sink = sink;
    this.clock = clock;
    this.mode = mode;
    this.styling = styling;
    this.heartbeat = new DefaultHeartbeatScheduler(scheduler);
  }

  handleEvent(event: ProgressEvent): void {
    switch (event.type) {
      case "phase-start":
        this.onPhaseStart(event.phase);
        break;
      case "extracting-progress":
        this.onProgress(
          event.refIndex,
          event.refCount,
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

  abortActiveDisplay(): void {
    this.heartbeat.dispose();

    if (this.mode === "tty-interactive" && this.currentPhase !== null) {
      this.sink.newline();
    }

    this.currentPhase = null;
    this.refIndex = 0;
    this.refCount = 0;
    this.commitsTraversed = 0;
    this.recordsWritten = 0;
    this.bytesWritten = 0;
  }

  private snapshot(nowMs: number): PhaseSnapshot {
    return {
      phase: this.currentPhase!,
      startMs: this.phaseStartMs,
      refIndex: this.refIndex,
      refCount: this.refCount,
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
    this.sink.rewriteLine(
      formatActiveLine(this.snapshot(now), this.currentSpinnerFrame(), this.styling),
    );

    this.heartbeat.start(HEARTBEAT_INTERVAL_MS, () => {
      this.onHeartbeatTick();
    });
  }

  private onHeartbeatTick(): void {
    this.spinnerIndex++;
    const nowMs = this.clock.nowMs();
    this.sink.rewriteLine(
      formatActiveLine(this.snapshot(nowMs), this.currentSpinnerFrame(), this.styling),
    );
  }

  private onProgress(
    refIndex: number,
    refCount: number,
    commitsTraversed: number,
    recordsWritten: number,
    bytesWritten: number,
  ): void {
    this.refIndex = refIndex;
    this.refCount = refCount;
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
    this.sink.rewriteLine(formatDoneLine(this.snapshot(now), this.styling));
    this.sink.newline();

    this.currentPhase = null;
    this.refIndex = 0;
    this.refCount = 0;
    this.commitsTraversed = 0;
    this.recordsWritten = 0;
    this.bytesWritten = 0;
  }

  private onWarning(message: string): void {
    const lines = formatDiagnosticLines("warn", message, this.styling);
    if (this.mode === "tty-interactive" && this.currentPhase !== null) {
      this.sink.newline();
      for (const line of lines) {
        this.sink.writeLine(line);
      }
      // Immediately restore the progress line after a warning interruption.
      const now = this.clock.nowMs();
      this.sink.rewriteLine(
        formatActiveLine(this.snapshot(now), this.currentSpinnerFrame(), this.styling),
      );
    } else {
      // non-tty-summary and quiet both show warnings via plain writeLine
      for (const line of lines) {
        this.sink.writeLine(line);
      }
    }
  }
}
