import type { CommitOid } from "../model/index.js";

/** Output-format-independent representation of a single commit. */
export interface CommitFact {
  readonly type: "commit";
  readonly oid: CommitOid;
  readonly message: string;
  readonly author: {
    readonly name: string;
    readonly email: string;
    /** Unix timestamp in seconds. */
    readonly timestamp: number;
    /** UTC offset in minutes using the conventional sign (JST = +540). */
    readonly timezoneOffset: number;
  };
  readonly committer: {
    readonly name: string;
    readonly email: string;
    /** Unix timestamp in seconds. */
    readonly timestamp: number;
    /** UTC offset in minutes using the conventional sign (JST = +540). */
    readonly timezoneOffset: number;
  };
  readonly parents: readonly CommitOid[];
  readonly repository: {
    readonly name: string;
    readonly url: string | null;
  };
}

/** Output-format-independent representation of one file change within a commit. */
export interface FileChangeFact {
  readonly type: "file-change";
  readonly commit: CommitFact;
  readonly file: {
    readonly path: string;
    readonly status: "added" | "modified" | "deleted";
    readonly additions: number | null;
    readonly deletions: number | null;
  };
}
