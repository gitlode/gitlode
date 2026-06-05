import type { PreparedConfig, PreparedMappingRow } from "./config.js";

type MatchSource = "email" | "name";

export interface ResolvedProfile {
  readonly row: PreparedMappingRow;
  readonly matchedBy: MatchSource;
}

export interface PersonInput {
  readonly name: string;
  readonly email: string;
}

export function resolveProfile(
  prepared: PreparedConfig,
  person: PersonInput,
): ResolvedProfile | null {
  const emailMatches = prepared.emailIndex.get(person.email);
  if (emailMatches && emailMatches.length > 0) {
    return { row: emailMatches[0]!, matchedBy: "email" };
  }

  const nameMatches = prepared.nameIndex.get(person.name);
  if (nameMatches && nameMatches.length > 0) {
    return { row: nameMatches[0]!, matchedBy: "name" };
  }

  return null;
}
