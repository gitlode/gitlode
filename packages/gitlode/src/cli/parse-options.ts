import { CommanderError } from "commander";
import { z } from "zod";

import { program } from "./command-definition.js";
import type { BootstrapResult, BootstrapTermination } from "./errors.js";
import { CommandArgsSchema, type ParsedCliOptions } from "./option-schema.js";

class TerminationSignal extends Error {
  readonly termination: BootstrapTermination;

  constructor(termination: BootstrapTermination) {
    super(
      termination.kind === "user-error" ? termination.message : "Bootstrap terminated successfully",
    );
    this.name = "TerminationSignal";
    this.termination = termination;
  }
}

function userError(message: string): never {
  throw new TerminationSignal({ kind: "user-error", message, exitCode: 1 });
}

function successTermination(): never {
  throw new TerminationSignal({ kind: "success-terminate", exitCode: 0 });
}

export function isCliValueProvided(name: string): boolean {
  return program.getOptionValueSource(name) === "cli";
}

export async function parseCliOptions(): Promise<BootstrapResult<ParsedCliOptions>> {
  try {
    program.exitOverride();
    try {
      program.parse(process.argv);
    } catch (error) {
      if (error instanceof CommanderError) {
        if (error.code === "commander.version") successTermination();
        if (error.code === "commander.helpDisplayed") successTermination();
        if (error.code === "commander.unknownOption") {
          // error.message format: "error: unknown option '--foo'"
          const match = /'(--[\w-]+)'/.exec(error.message);
          userError(`Unknown option: ${match?.[1] ?? error.message.replace(/^error: /, "")}`);
        }
        userError(error.message.replace(/^error: /, ""));
      }
      throw error;
    }

    try {
      return { kind: "success", value: CommandArgsSchema.parse(program.opts()) };
    } catch (error) {
      if (error instanceof z.ZodError) {
        userError(error.issues[0]?.message ?? "Invalid CLI options");
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof TerminationSignal) {
      return error.termination;
    }
    throw error;
  }
}
