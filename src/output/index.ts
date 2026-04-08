export type { OutputCommit, OutputPerson, OutputRepository };

import type { PersonIdentity } from "../core/index.js";

interface OutputPerson extends PersonIdentity {
  timestamp: string; // ISO 8601 with commit's own timezone offset
}

interface OutputRepository {
  name: string;
  url: string | null;
}

interface OutputCommit {
  oid: string;
  subject: string;
  body: string;
  author: OutputPerson;
  committer: OutputPerson;
  parents: string[];
  repository: OutputRepository;
}
