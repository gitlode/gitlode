import type { ProgressEvent } from "../core/index.js";
import type { ProfileSummaryEntry } from "../instrumentation/index.js";
import { writeDiagnosticLines, splitMessageLines, type DiagnosticSeverity } from "./diagnostics.js";
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
  renderDiagnostic(severity: DiagnosticSeverity, message: string): void;
  renderUserError(message: string): void;
  renderRuntimeError(error: unknown): void;
  renderSummary(data: SummaryData): void;
  renderProfile(entries: readonly ProfileSummaryEntry[], skippedDiffs?: number): void;
}

interface CreateRunPresenterOptions {
  sink: TerminalSink;
  clock: Clock;
  scheduler: Scheduler;
  uiMode: UiMode;
  styling: Styling;
}

export function normalizeUnknownError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(typeof error === "string" ? error : String(error));
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

  function renderDiagnostic(severity: DiagnosticSeverity, message: string): void {
    if (progressController) {
      progressController.renderDiagnostic(severity, message);
      return;
    }

    writeDiagnosticLines(sink.writeLine, severity, message, styling);
  }

  return {
    handleProgressEvent(event) {
      if (event.type === "warning") {
        renderDiagnostic("warn", event.message);
        return;
      }

      if (progressController) {
        progressController.handleEvent(event);
      }
    },
    renderDiagnostic,
    renderUserError(message) {
      prepareForNonProgressOutput();
      writePlainMessage(message);
    },
    renderRuntimeError(error) {
      prepareForNonProgressOutput();
      const normalizedError = normalizeUnknownError(error);
      writePlainMessage(normalizedError.stack ?? normalizedError.message);
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
