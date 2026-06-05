import type { PreparedConfig } from "./config.js";
import type { PersonInput, ResolvedProfile } from "./resolver.js";

interface DebugOutput {
  readonly source: "master" | "input";
  readonly matchedBy?: "email" | "name";
}

export function buildPersonOutput(
  person: PersonInput,
  match: ResolvedProfile | null,
  prepared: PreparedConfig,
): Record<string, unknown> {
  if (match === null) {
    const output: Record<string, unknown> = {
      name: person.name,
      email: person.email,
    };
    if (prepared.debug) {
      output["_debug"] = { source: "input" } satisfies DebugOutput;
    }
    return output;
  }

  const output: Record<string, unknown> = {
    name: match.row.name,
    email: match.row.email,
  };

  if (Object.keys(match.row.attributes).length > 0) {
    output["attributes"] = match.row.attributes;
  }

  if (prepared.debug) {
    output["_debug"] = {
      source: "master",
      matchedBy: match.matchedBy,
    } satisfies DebugOutput;
  }

  return output;
}
