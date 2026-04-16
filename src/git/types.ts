import type { CommitHash, PersonIdentity } from "../core/index.js";

export interface RawPerson extends PersonIdentity {
  readonly timestamp: number;
  readonly timezoneOffset: number;
}

export interface RawCommit {
  readonly oid: CommitHash;
  readonly message: string;
  readonly author: RawPerson;
  readonly committer: RawPerson;
  readonly parents: readonly string[];
}

export interface GitAdapter {
  /** Resolve a ref (branch name) to a commit hash */
  resolveRef(repoPath: string, ref: string): Promise<CommitHash>;

  /** Walk commits reachable from `head`, stopping before `excludeHash` if provided */
  walkCommits(
    repoPath: string,
    head: CommitHash,
    excludeHash?: CommitHash,
  ): AsyncIterable<RawCommit>;

  /** Return the remote URL for `origin`, or null if not set */
  getRemoteUrl(repoPath: string): Promise<string | null>;
}
