import type { CommitOid, OidProfile, PersonIdentity, RefType } from "../model/index.js";

export type RepositoryObjectFormat = string;

/** Git's default object format when `extensions.objectformat` is unset. */
export const DEFAULT_REPOSITORY_OBJECT_FORMAT: OidProfile = "sha1";

export interface RawPerson extends PersonIdentity {
  readonly timestamp: number;
  readonly timezoneOffset: number;
}

export interface RawCommit {
  readonly oid: CommitOid;
  readonly message: string;
  readonly author: RawPerson;
  readonly committer: RawPerson;
  readonly parents: readonly CommitOid[];
}

export interface FileChange {
  readonly path: string;
  readonly status: "added" | "modified" | "deleted";
  /** Blob byte size before this change (0 for added files). */
  readonly beforeSize: number;
  /** Blob byte size after this change (0 for deleted files). */
  readonly afterSize: number;
  /** null for binary files */
  readonly additions: number | null;
  /** null for binary files */
  readonly deletions: number | null;
}

/**
 * Internal strategy interface for computing line-level diff statistics from
 * raw byte content. Owned exclusively by IsomorphicGitAdapter.
 *
 * DiffAdapter is not part of the GitAdapter public contract and must not be
 * exported through src/git/index.ts or referenced by Core layer modules.
 *
 * Contract invariants for any implementation:
 * - For identical byte inputs, computeLineDiff must return identical additions/deletions.
 * - additions and deletions must be finite non-negative integers.
 * - Binary detection and null-result responsibility belong to the caller
 *   (IsomorphicGitAdapter); computeLineDiff is only invoked for text content.
 */
export interface DiffAdapter {
  computeLineDiff(
    before: Uint8Array,
    after: Uint8Array,
  ): {
    additions: number;
    deletions: number;
  };
}

export interface GitAdapter {
  /** Object formats this adapter implementation can handle */
  supportedObjectFormats(): readonly OidProfile[];

  /** Resolve a ref (branch name, tag, or raw commit OID) to a commit OID. */
  resolveRef(repoPath: string, ref: string): Promise<CommitOid>;

  /** Detect repository object format. Defaults to "sha1" when unset. */
  getRepositoryObjectFormat(repoPath: string): Promise<RepositoryObjectFormat>;

  /** Classify a ref by runtime semantics for traversal/state handling. */
  classifyRefType(repoPath: string, ref: string): Promise<RefType>;

  /** Walk commits reachable from `head`, stopping before `excludeHash` if provided */
  walkCommits(repoPath: string, head: CommitOid, excludeHash?: CommitOid): AsyncIterable<RawCommit>;

  /** Return the remote URL for `origin`, or null if not set */
  getRemoteUrl(repoPath: string): Promise<string | null>;

  /** Find the lowest common ancestor of all given commit OIDs.
   *  Returns null if no common ancestor exists (detached histories). */
  findMergeBase(repoPath: string, oids: readonly CommitOid[]): Promise<CommitOid | null>;

  /** Return per-file change information between a commit and its parent.
   *  Pass parentOid for normal commits; omit for root commits (all files are "added"). */
  getFileChanges(
    repoPath: string,
    commitOid: CommitOid,
    parentOid?: CommitOid,
  ): Promise<readonly FileChange[]>;
}
