import type { ProgressReporter } from "../core/types.js";
import type { ProfilingEntry } from "../profile/type.js";
import type { RunPresenter } from "./presenter.js";
import type { Clock, Scheduler, TerminalSink, UiMode } from "./progress/types.js";
import type { Styling } from "./styling.js";

export interface RenderSuccessReportOptions {
  readonly presenter: RunPresenter;
  readonly quiet: boolean;
  readonly profile: boolean;
  readonly success: RunSuccessPayload;
}
export interface ProgressRuntime {
  readonly uiMode: UiMode;
  readonly presenter: RunPresenter;
  readonly reporter: ProgressReporter;
}
export interface CreateProgressRuntimeOptions {
  readonly sink: TerminalSink;
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly quiet: boolean;
  readonly isTTY: boolean;
  readonly styling: Styling;
}
export interface RunSuccessPayload {
  readonly recordsWritten: number;
  readonly commitsTraversed: number;
  readonly filesCreated: number;
  readonly bytesWritten: number;
  readonly elapsedMs: number;
  readonly refs: readonly string[];
  readonly profileEntries: readonly ProfilingEntry[];
  readonly skippedDiffs: number;
}
