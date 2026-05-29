import { splitMessageLines } from "./diagnostics.js";
import type { BootstrapTermination } from "./errors.js";

export interface BootstrapRenderer {
  renderTermination(termination: BootstrapTermination): void;
  renderUserError(message: string): void;
  renderRuntimeError(error: Error): void;
}

export function createBootstrapRenderer(writeLine: (line: string) => void): BootstrapRenderer {
  function writeMessage(message: string): void {
    for (const line of splitMessageLines(message)) {
      writeLine(line);
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
      writeMessage(error.stack ?? error.message);
    },
  };
}
