import type { PersonIdentity } from "../core/index.js";

export interface OutputPerson extends PersonIdentity {
  timestamp: string; // ISO 8601 with commit's own timezone offset
}

export interface OutputRepository {
  name: string;
  url: string | null;
}

export interface OutputCommit {
  oid: string;
  subject: string;
  body: string;
  author: OutputPerson;
  committer: OutputPerson;
  parents: string[];
  repository: OutputRepository;
}
