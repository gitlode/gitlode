import type { PersonIdentity } from "../core/index.js";

export interface OutputPerson extends PersonIdentity {
  readonly timestamp: string; // ISO 8601 with commit's own timezone offset
}

export interface OutputRepository {
  readonly name: string;
  readonly url: string | null;
}

export interface OutputCommit {
  readonly oid: string;
  readonly subject: string;
  readonly body: string;
  readonly author: OutputPerson;
  readonly committer: OutputPerson;
  readonly parents: readonly string[];
  readonly repository: OutputRepository;
}
