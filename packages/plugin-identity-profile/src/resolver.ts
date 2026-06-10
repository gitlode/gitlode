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
  const [firstEmailMatch] = emailMatches ?? [];
  if (firstEmailMatch) {
    return { row: firstEmailMatch, matchedBy: "email" };
  }

  const nameMatches = prepared.nameIndex.get(person.name);
  const [firstNameMatch] = nameMatches ?? [];
  if (firstNameMatch) {
    return { row: firstNameMatch, matchedBy: "name" };
  }

  return null;
}
