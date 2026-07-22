import type { BlobOid, CommitOid, OidProfile, PersonIdentity, RefType } from "../model/index.js";

export type RepositoryObjectFormat = string;

export interface RawPerson extends PersonIdentity {
  readonly timestamp: number;
  /**
   * UTC offset in minutes, using the standard sign convention:
   * positive = east of UTC (JST +09:00 → +540), negative = west (PST -08:00 → -480).
   *
   * GitAdapter implementations are responsible for normalizing any library-specific
   * convention to this standard before returning RawPerson.
   */
  readonly timezoneOffset: number;
}

export interface RawCommit {
  readonly oid: CommitOid;
  readonly message: string;
  readonly author: RawPerson;
  readonly committer: RawPerson;
  readonly parents: readonly CommitOid[];
}

export type FileBlobMode = "100644" | "100755" | "120000";

export interface FileBlobSnapshot {
  readonly path: string;
  readonly oid: BlobOid;
  readonly mode: FileBlobMode;
  readonly content: Uint8Array;
}

export type FileBlobChange =
  | {
      readonly status: "added";
      readonly before: null;
      readonly after: FileBlobSnapshot;
    }
  | {
      readonly status: "modified";
      readonly before: FileBlobSnapshot;
      readonly after: FileBlobSnapshot;
    }
  | {
      readonly status: "deleted";
      readonly before: FileBlobSnapshot;
      readonly after: null;
    };

/**
 * Interface for computing line-level diff statistics from
 * raw byte content.
 *
 * Contract invariants for any implementation:
 * - For identical byte inputs, computeLineDiff must return identical additions/deletions.
 * - additions and deletions must be finite non-negative integers.
 * - Binary detection and null-result responsibility belong to the caller;
 *   computeLineDiff is only invoked for text content.
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

  /** Walk commits reachable from `oid`, stopping before `excludeOid` if provided */
  walkCommits(repoPath: string, oid: CommitOid, excludeOid?: CommitOid): AsyncIterable<RawCommit>;

  /** Return the remote URL for `origin`, or null if not set */
  getRemoteUrl(repoPath: string): Promise<string | null>;

  /** Find the lowest common ancestor of all given commit OIDs.
   *  Returns null if no common ancestor exists (detached histories). */
  findMergeBase(repoPath: string, oids: readonly CommitOid[]): Promise<CommitOid | null>;

  /** Return changed file-backed blobs between a commit and its parent.
   *  Pass parentOid for normal commits; omit for root commits (all blobs are "added").
   *  The iteration order of file changes is unspecified. */
  getFileBlobChanges(
    repoPath: string,
    commitOid: CommitOid,
    parentOid?: CommitOid,
  ): AsyncIterable<FileBlobChange>;
}
