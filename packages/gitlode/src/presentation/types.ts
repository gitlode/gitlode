import type { DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import type { ProgressReporter } from "@gitlode/internal-contracts/progress";
import type { ProfileReport } from "@gitlode/internal-contracts/telemetry";

import type { RunPresenter } from "./presenter.js";
import type { Clock, Scheduler, TerminalSink, UiMode } from "./progress/types.js";
import type { Styling } from "./styling.js";

export interface RenderSuccessReportOptions {
  readonly presenter: RunPresenter;
  readonly quiet: boolean;
  readonly profile: boolean;
  readonly data: SuccessReportData;
}
export interface ProgressRuntime {
  readonly uiMode: UiMode;
  readonly presenter: RunPresenter;
  readonly progressReporter: ProgressReporter;
  readonly diagnosticReporter: DiagnosticReporter;
}
export interface CreateProgressRuntimeOptions {
  readonly sink: TerminalSink;
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly quiet: boolean;
  readonly isTTY: boolean;
  readonly styling: Styling;
}
export interface SuccessReportData {
  readonly recordsWritten: number;
  readonly commitsTraversed: number;
  readonly filesCreated: number;
  readonly bytesWritten: number;
  readonly elapsedMs: number;
  readonly refs: readonly string[];
  readonly profileReport?: ProfileReport;
}
