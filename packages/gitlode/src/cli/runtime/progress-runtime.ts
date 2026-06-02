import type { ProgressReporter } from "../../core/index.js";
import { createRunPresenter } from "../presenter.js";
import type { RunPresenter } from "../presenter.js";
import { resolveUiMode } from "../progress/index.js";
import type { TerminalSink } from "../progress/index.js";
import type { CreateProgressRuntimeOptions, ProgressRuntime } from "./types.js";
export const stderrSink: TerminalSink = {
  writeLine(text: string): void {
    process.stderr.write(text + "\n");
  },
  rewriteLine(text: string): void {
    process.stderr.write("\r\x1B[2K" + text);
  },
  newline(): void {
    process.stderr.write("\n");
  },
};

function createReporter(presenter: RunPresenter): ProgressReporter {
  return {
    emit(event) {
      presenter.handleProgressEvent(event);
    },
  };
}

export function createProgressRuntime(options: CreateProgressRuntimeOptions): ProgressRuntime {
  const uiMode = resolveUiMode(options.quiet, options.isTTY);
  const presenter = createRunPresenter({
    sink: options.sink,
    clock: options.clock,
    scheduler: options.scheduler,
    uiMode,
    styling: options.styling,
  });

  return {
    uiMode,
    presenter,
    reporter: createReporter(presenter),
  };
}
