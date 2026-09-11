import type { Diagnostic } from "@gitlode/internal-contracts/diagnostics";
import type { ProgressEvent } from "@gitlode/internal-contracts/progress";
import type { ProfileReport } from "@gitlode/internal-contracts/telemetry";

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
  renderDiagnostic(diagnostic: Diagnostic): void;
  renderUserError(message: string): void;
  renderRuntimeError(error: unknown): void;
  renderSummary(data: SummaryData): void;
  renderProfile(report: ProfileReport): void;
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

  function renderDiagnostic(diagnostic: Diagnostic): void {
    if (progressController) {
      progressController.renderDiagnostic(diagnostic);
      return;
    }

    writeDiagnosticLines(sink.writeLine, diagnostic, styling);
  }

  return {
    handleProgressEvent(event) {
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
    renderProfile(report) {
      const lines = formatProfileLines(report, styling);
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
