import * as git from "isomorphic-git";
import type { FsClient } from "isomorphic-git";

import { GitAdapterError } from "../git/errors.js";
import {
  DEFAULT_REPOSITORY_OBJECT_FORMAT,
  type DiffAdapter,
  type FileChange,
  type GitAdapter,
  type RawCommit,
  type RepositoryObjectFormat,
} from "../git/index.js";
import {
  instrumentAsyncIterable,
  type Instrumentation,
  type InstrumentationSpan,
} from "../instrumentation/index.js";
import type { RefType, CommitOid, OidProfile } from "../model/index.js";
import { isCommitOid } from "../model/index.js";
import { OrderedQueue } from "../support/index.js";
import {
  type BasicDagSchedulingContext,
  type DagFrontierItem,
  type DagSuccessor,
  type DagTopologyPort,
  walkDagNodeIdsCertifiedLazy,
} from "./dag-traversal-strategy.js";

export interface IsomorphicGitAdapterDependencies {
  readonly fs: FsClient;
  readonly diffAdapter: DiffAdapter;
  readonly instrumentation: Instrumentation;
}

export class IsomorphicGitAdapter implements GitAdapter {
  private readonly _fs: FsClient;
  private readonly _diffAdapter: DiffAdapter;
  private readonly _instrumentation: Instrumentation;

  constructor(dependencies: IsomorphicGitAdapterDependencies) {
    this._fs = dependencies.fs;
    this._diffAdapter = dependencies.diffAdapter;
    this._instrumentation = dependencies.instrumentation;
  }

  supportedObjectFormats(): readonly OidProfile[] {
    return ["sha1"];
  }

  async resolveRef(repoPath: string, ref: string): Promise<CommitOid> {
    let oid: string;
    try {
      oid = (await this._instrumentation.runAsync("git.resolve_ref", async () =>
        git.resolveRef({ fs: this._fs, dir: repoPath, ref }),
      )) as string;
    } catch (err) {
      if (err instanceof Error) {
        const name = err.name;
        if (name === "NotFoundError" || name === "ResolveRefError") {
          // Fallback: treat the input as a raw commit object ID.
          if (isCommitOid(ref)) {
            try {
              await git.readCommit({ fs: this._fs, dir: repoPath, oid: ref });
              return ref as CommitOid;
            } catch {
              // Not a valid commit object — fall through to REF_NOT_FOUND.
            }
          }
          throw new GitAdapterError(`Ref not found: ${ref}`, "REF_NOT_FOUND", err);
        }
        if (
          name === "NotGitDataError" ||
          name === "UnknownTransportError" ||
          err.message.includes("ENOENT")
        ) {
          throw new GitAdapterError(`Not a Git repository: ${repoPath}`, "NOT_A_REPOSITORY", err);
        }
      }
      throw new GitAdapterError(
        `Unexpected error resolving ref ${ref}: ${String(err)}`,
        "UNKNOWN",
        err,
      );
    }
    // Peel annotated tags to their target commit.
    oid = await this._peelToCommit(repoPath, oid);
    return oid as CommitOid;
  }

  async getRepositoryObjectFormat(repoPath: string): Promise<RepositoryObjectFormat> {
    try {
      const raw = await this._instrumentation.runAsync("git.repository_object_format", async () =>
        git.getConfig({
          fs: this._fs,
          dir: repoPath,
          path: "extensions.objectformat",
        }),
      );

      // Per Git behavior, repository object format defaults to sha1 when unset.
      if (raw === undefined || raw === null) {
        return DEFAULT_REPOSITORY_OBJECT_FORMAT;
      }

      const normalized = String(raw).trim().toLowerCase();
      return normalized.length === 0 ? DEFAULT_REPOSITORY_OBJECT_FORMAT : normalized;
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === "NotGitDataError" ||
          err.name === "UnknownTransportError" ||
          err.message.includes("ENOENT"))
      ) {
        throw new GitAdapterError(`Not a Git repository: ${repoPath}`, "NOT_A_REPOSITORY", err);
      }
      throw new GitAdapterError(
        `Unexpected error reading repository object format: ${String(err)}`,
        "UNKNOWN",
        err,
      );
    }
  }

  async classifyRefType(repoPath: string, ref: string): Promise<RefType> {
    try {
      await git.resolveRef({ fs: this._fs, dir: repoPath, ref: `refs/heads/${ref}` });
      return "branch";
    } catch {
      // Not a branch under refs/heads.
    }

    try {
      const tagObjectOid = await git.resolveRef({
        fs: this._fs,
        dir: repoPath,
        ref: `refs/tags/${ref}`,
      });
      try {
        await git.readTag({ fs: this._fs, dir: repoPath, oid: tagObjectOid });
        return "tag-annotated";
      } catch {
        return "tag-lightweight";
      }
    } catch {
      // Not a tag under refs/tags.
    }

    if (isCommitOid(ref)) {
      return "commit-oid";
    }

    try {
      await git.resolveRef({ fs: this._fs, dir: repoPath, ref });
      // Refs such as HEAD or refs/remotes/origin/main are treated as branch-like
      // for merge-base fallback behavior.
      return "branch";
    } catch {
      // Unknown symbolic ref. Resolution will fail later and the planner will
      // emit the missing-ref warning based on resolveRef().
      return "commit-oid";
    }
  }

  private async _peelToCommit(repoPath: string, oid: string): Promise<string> {
    try {
      const result = await git.readTag({ fs: this._fs, dir: repoPath, oid });
      if (result.tag.type === "commit") return result.tag.object;
      // tag-of-tag: keep peeling
      return this._peelToCommit(repoPath, result.tag.object);
    } catch {
      // Not a tag object — the OID already points to a commit
      return oid;
    }
  }

  async getRemoteUrl(repoPath: string): Promise<string | null> {
    try {
      const url = await this._instrumentation.runAsync("git.get_remote_url", async () =>
        git.getConfig({
          fs: this._fs,
          dir: repoPath,
          path: "remote.origin.url",
        }),
      );
      if (url === undefined || url === null) {
        return null;
      }
      return String(url);
    } catch (err) {
      if (err instanceof Error && err.message.includes("ENOENT")) {
        throw new GitAdapterError(`Not a Git repository: ${repoPath}`, "NOT_A_REPOSITORY", err);
      }
      // Non-fatal: treat as no remote configured
      return null;
    }
  }

  async *walkCommits(
    repoPath: string,
    oid: CommitOid,
    excludeOid?: CommitOid,
  ): AsyncIterable<RawCommit> {
    yield* instrumentAsyncIterable(this._instrumentation, "git.walk_commits", (span) => {
      const topology = new CommitTopologyAdapter(this._fs, repoPath, span);
      const oidWalk = walkDagNodeIdsCertifiedLazy<CommitOid>(
        {
          graph: topology,
          instrumentation: this._instrumentation,
        },
        oid,
        excludeOid,
        {
          createFrontier: () =>
            new OrderedQueue<DagFrontierItem<CommitOid, BasicDagSchedulingContext>>({
              dequeueOrder: "lifo",
              blockOrder: "preserve",
            }),
        },
      );

      return commitObjectsFromOids(oidWalk, topology);
    });
  }

  async findMergeBase(repoPath: string, oids: readonly CommitOid[]): Promise<CommitOid | null> {
    try {
      const result = await this._instrumentation.runAsync("git.merge_base", async () =>
        git.findMergeBase({
          fs: this._fs,
          dir: repoPath,
          oids: oids as unknown as string[],
        }),
      );
      if (result.length === 0) return null;
      return result[0] as CommitOid;
    } catch (err) {
      throw new GitAdapterError(
        `Unexpected error finding merge base: ${String(err)}`,
        "MERGE_BASE_NOT_FOUND",
        err,
      );
    }
  }

  async getFileChanges(
    repoPath: string,
    commitOid: CommitOid,
    parentOid?: CommitOid,
  ): Promise<readonly FileChange[]> {
    return await this._instrumentation.runAsync("git.file_changes", async () => {
      const changes: FileChange[] = [];

      if (parentOid !== undefined) {
        await git.walk({
          fs: this._fs,
          dir: repoPath,
          trees: [git.TREE({ ref: parentOid }), git.TREE({ ref: commitOid })],
          map: async (filepath, entries) => {
            if (filepath === ".") return;

            const A = await classifyWalkerEntry(entries[0]);
            const B = await classifyWalkerEntry(entries[1]);

            // Skip submodules
            if (A.type === "commit" || B.type === "commit") return;

            // Both trees → walk() descends naturally; skip this entry from output
            if (A.type === "tree" && B.type === "tree") return;

            // Both blobs
            if (A.type === "blob" && B.type === "blob") {
              const [oidA, oidB] = await Promise.all([A.entry.oid(), B.entry.oid()]);
              if (oidA === oidB) return; // unchanged
              const [contentA, contentB] = await this._instrumentation.runAsync(
                "git.blob_read",
                async () => Promise.all([A.entry.content(), B.entry.content()]),
              );
              const change = await this._instrumentation.runAsync("git.diff", async () =>
                this._buildFileChange(
                  filepath,
                  "modified",
                  contentA ?? new Uint8Array(0),
                  contentB ?? new Uint8Array(0),
                ),
              );
              changes.push(change);
              return;
            }

            // Added (no parent blob at this path)
            if (B.type === "blob") {
              const contentB = await this._instrumentation.runAsync("git.blob_read", async () =>
                B.entry.content(),
              );
              const change = await this._instrumentation.runAsync("git.diff", async () =>
                this._buildFileChange(
                  filepath,
                  "added",
                  new Uint8Array(0),
                  contentB ?? new Uint8Array(0),
                ),
              );
              changes.push(change);
              return;
            }

            // Deleted (no child blob at this path)
            if (A.type === "blob") {
              const contentA = await this._instrumentation.runAsync("git.blob_read", async () =>
                A.entry.content(),
              );
              const change = await this._instrumentation.runAsync("git.diff", async () =>
                this._buildFileChange(
                  filepath,
                  "deleted",
                  contentA ?? new Uint8Array(0),
                  new Uint8Array(0),
                ),
              );
              changes.push(change);
            }
          },
        });
      } else {
        // Root commit: single-tree walk; every blob is "added"
        await git.walk({
          fs: this._fs,
          dir: repoPath,
          trees: [git.TREE({ ref: commitOid })],
          map: async (filepath, entries) => {
            if (filepath === ".") return;

            const A = await classifyWalkerEntry(entries[0]);
            if (A.type === null || A.type === undefined) return;

            if (A.type !== "blob") return;

            const contentA = await this._instrumentation.runAsync("git.blob_read", async () =>
              A.entry.content(),
            );
            const change = await this._instrumentation.runAsync("git.diff", async () =>
              this._buildFileChange(
                filepath,
                "added",
                new Uint8Array(0),
                contentA ?? new Uint8Array(0),
              ),
            );
            changes.push(change);
          },
        });
      }

      return changes;
    });
  }

  private async _buildFileChange(
    path: string,
    status: "added" | "modified" | "deleted",
    contentA: Uint8Array,
    contentB: Uint8Array,
  ): Promise<FileChange> {
    const beforeSize = contentA.length;
    const afterSize = contentB.length;
    if (this._isBinary(contentA) || this._isBinary(contentB)) {
      return { path, status, beforeSize, afterSize, additions: null, deletions: null };
    }

    const { additions, deletions } = this._diffAdapter.computeLineDiff(contentA, contentB);

    if (
      !Number.isFinite(additions) ||
      !Number.isInteger(additions) ||
      additions < 0 ||
      !Number.isFinite(deletions) ||
      !Number.isInteger(deletions) ||
      deletions < 0
    ) {
      throw new GitAdapterError(
        `DiffAdapter returned invalid values: additions=${String(additions)}, deletions=${String(deletions)}`,
        "UNKNOWN",
      );
    }

    return { path, status, beforeSize, afterSize, additions, deletions };
  }

  private _isBinary(content: Uint8Array): boolean {
    const limit = Math.min(content.length, 8000);
    for (let i = 0; i < limit; i++) {
      if (content[i] === 0) return true;
    }
    return false;
  }
}

class CommitTopologyAdapter implements DagTopologyPort<CommitOid> {
  private readonly cache = new Map<CommitOid, RawCommit>();
  private readonly fs: FsClient;
  private readonly repoPath: string;
  private readonly span: InstrumentationSpan;

  constructor(fs: FsClient, repoPath: string, span: InstrumentationSpan) {
    this.fs = fs;
    this.repoPath = repoPath;
    this.span = span;
  }

  async getSuccessors(oid: CommitOid): Promise<readonly DagSuccessor<CommitOid>[]> {
    const commit = await this.readCommit(oid, "topology");
    return commit.parents.map((parentOid) => ({ nodeId: parentOid }));
  }

  async readCommit(oid: CommitOid, purpose: CommitReadPurpose): Promise<RawCommit> {
    const cached = this.cache.get(oid);
    if (cached !== undefined) {
      this.span.incrementCounter(`${purpose}_commit_cache_hits`);
      return cached;
    }

    try {
      this.span.incrementCounter("commit_reads");
      this.span.incrementCounter(`${purpose}_commit_reads`);
      const { commit } = await git.readCommit({ fs: this.fs, dir: this.repoPath, oid });
      const rawCommit = toRawCommit(oid, commit);
      this.cache.set(oid, rawCommit);
      return rawCommit;
    } catch (err) {
      if (err instanceof Error && err.name === "NotFoundError") {
        throw new GitAdapterError(`Commit not found: ${oid}`, "COMMIT_NOT_FOUND", err);
      }
      throw new GitAdapterError(
        `Unexpected error reading commit ${oid}: ${String(err)}`,
        "UNKNOWN",
        err,
      );
    }
  }

  incrementYieldedCommit(): void {
    this.span.incrementCounter("commits_yielded");
  }
}

type CommitReadPurpose = "topology" | "materialize";

async function* commitObjectsFromOids(
  oids: AsyncIterable<CommitOid>,
  topology: CommitTopologyAdapter,
): AsyncIterable<RawCommit> {
  for await (const oid of oids) {
    const commit = await topology.readCommit(oid, "materialize");
    topology.incrementYieldedCommit();
    yield commit;
  }
}

type ClassifiedWalkerEntry =
  | {
      type: null;
      entry: null;
    }
  | {
      type: "tree" | "blob" | "special" | "commit";
      entry: git.WalkerEntry;
    };

async function classifyWalkerEntry(
  entry: git.WalkerEntry | null | undefined,
): Promise<ClassifiedWalkerEntry> {
  if (entry === null || entry === undefined) {
    return { type: null, entry: null };
  }
  return {
    type: await entry.type(),
    entry,
  };
}

function toRawCommit(oid: CommitOid, commit: git.CommitObject): RawCommit {
  return {
    oid,
    message: commit.message,
    author: {
      name: commit.author.name,
      email: commit.author.email,
      timestamp: commit.author.timestamp,
      // isomorphic-git stores UTC offsets with inverted sign: JST (+09:00) is timezoneOffset -540.
      // this behavior is based on JavaScript Date.getTimezoneOffset().
      // the adapter negates that value before populating this field.
      timezoneOffset: -commit.author.timezoneOffset,
    },
    committer: {
      name: commit.committer.name,
      email: commit.committer.email,
      timestamp: commit.committer.timestamp,
      // isomorphic-git stores UTC offsets with inverted sign: JST (+09:00) is timezoneOffset -540.
      // this behavior is based on JavaScript Date.getTimezoneOffset().
      // the adapter negates that value before populating this field.
      timezoneOffset: -commit.committer.timezoneOffset,
    },
    parents: commit.parent as CommitOid[],
  };
}
