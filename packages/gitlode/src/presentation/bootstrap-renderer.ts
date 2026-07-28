import { splitMessageLines } from "./diagnostics.js";
import { normalizeUnknownError } from "./presenter.js";
import type { TerminalSink } from "./progress/index.js";

interface BootstrapRenderer {
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
    renderUserError(message) {
      writeMessage(message);
    },
    renderRuntimeError(error) {
      const normalizedError = normalizeUnknownError(error);
      writeMessage(normalizedError.stack ?? normalizedError.message);
    },
  };
}
