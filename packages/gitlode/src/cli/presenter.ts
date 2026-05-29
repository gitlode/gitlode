import type { ProfilingEntry, ProgressEvent } from "../core/index.js";
import { writeDiagnosticLines, splitMessageLines } from "./diagnostics.js";
import {
  ProgressController,
  type Clock,
  type Scheduler,
  type Styling,
  type TerminalSink,
  type UiMode,
} from "./progress/index.js";
import { formatProfileLines, formatSummaryLines, type SummaryData } from "./reporting/index.js";

export interface RunPresenter {
  handleProgressEvent(event: ProgressEvent): void;
  renderUserError(message: string): void;
  renderRuntimeError(error: Error): void;
  renderSummary(data: SummaryData): void;
  renderProfile(entries: readonly ProfilingEntry[], skippedDiffs?: number): void;
}

interface CreateRunPresenterOptions {
  sink: TerminalSink;
  clock: Clock;
  scheduler: Scheduler;
  uiMode: UiMode;
  styling: Styling;
}

export function createRunPresenter(options: CreateRunPresenterOptions): RunPresenter {
  const { sink, clock, scheduler, uiMode, styling } = options;
  const progressController =
    uiMode === "tty-interactive"
      ? new ProgressController(sink, clock, scheduler, uiMode, styling)
      : null;

  function prepareForNonProgressOutput(): void {
    progressController?.abortActiveDisplay();
  }

  function writePlainMessage(message: string): void {
    for (const line of splitMessageLines(message)) {
      sink.writeLine(line);
    }
  }

  return {
    handleProgressEvent(event) {
      if (progressController) {
        progressController.handleEvent(event);
        return;
      }

      if (event.type === "warning") {
        writeDiagnosticLines(sink.writeLine, "warn", event.message, styling);
      }
    },
    renderUserError(message) {
      prepareForNonProgressOutput();
      writePlainMessage(message);
    },
    renderRuntimeError(error) {
      prepareForNonProgressOutput();
      writePlainMessage(error.stack ?? error.message);
    },
    renderSummary(data) {
      prepareForNonProgressOutput();
      sink.newline();
      for (const line of formatSummaryLines(data, styling)) {
        sink.writeLine(line);
      }
    },
    renderProfile(entries, skippedDiffs) {
      const lines = formatProfileLines(entries, skippedDiffs, styling);
      if (lines.length === 0) {
        return;
      }
      prepareForNonProgressOutput();
      sink.newline();
      for (const line of lines) {
        sink.writeLine(line);
      }
    },
  };
}
