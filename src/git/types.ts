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

export interface FileChange {
  readonly path: string;
  readonly status: "added" | "modified" | "deleted";
  /** null for binary files */
  readonly additions: number | null;
  /** null for binary files */
  readonly deletions: number | null;
}

export interface GitAdapter {
  /** Resolve a ref (branch name, tag, or raw OID) to a commit hash */
  resolveRef(repoPath: string, ref: string): Promise<CommitHash>;

  /** Return true if the given ref is a branch (i.e. exists under refs/heads/). Returns false
   *  for tags, raw commit OIDs, or any non-branch ref. */
  isRefBranch(repoPath: string, ref: string): Promise<boolean>;

  /** Walk commits reachable from `head`, stopping before `excludeHash` if provided */
  walkCommits(
    repoPath: string,
    head: CommitHash,
    excludeHash?: CommitHash,
  ): AsyncIterable<RawCommit>;

  /** Return the remote URL for `origin`, or null if not set */
  getRemoteUrl(repoPath: string): Promise<string | null>;

  /** Find the lowest common ancestor of all given commit hashes.
   *  Returns null if no common ancestor exists (detached histories). */
  findMergeBase(repoPath: string, oids: readonly CommitHash[]): Promise<CommitHash | null>;

  /** Return per-file change information between a commit and its parent.
   *  Pass parentOid for normal commits; omit for root commits (all files are "added"). */
  getFileChanges(
    repoPath: string,
    commitOid: CommitHash,
    parentOid?: CommitHash,
  ): Promise<readonly FileChange[]>;
}
