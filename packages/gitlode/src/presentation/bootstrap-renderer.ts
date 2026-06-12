import type { BootstrapTermination } from "../cli/errors.js";
import { splitMessageLines } from "./diagnostics.js";
import { normalizeUnknownError } from "./presenter.js";
import type { TerminalSink } from "./progress/index.js";

export interface BootstrapRenderer {
  renderTermination(termination: BootstrapTermination): void;
  renderUserError(message: string): void;
  renderRuntimeError(error: unknown): void;
}

export function createBootstrapRenderer(sink: Pick<TerminalSink, "writeLine">): BootstrapRenderer {
  function writeMessage(message: string): void {
    for (const line of splitMessageLines(message)) {
      sink.writeLine(line);
    }
  }

  return {
    renderTermination(termination) {
      if (termination.kind === "user-error") {
        writeMessage(termination.message);
      }
    },
    renderUserError(message) {
      writeMessage(message);
    },
    renderRuntimeError(error) {
      const normalizedError = normalizeUnknownError(error);
      writeMessage(normalizedError.stack ?? normalizedError.message);
    },
  };
}
