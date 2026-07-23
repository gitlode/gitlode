import * as git from "isomorphic-git";
import type { FsClient } from "isomorphic-git";

import { type DagSuccessor, type DagTopologyPort } from "../dag/index.js";
import { GitAdapterError } from "../git/errors.js";
import {
  DEFAULT_REPOSITORY_OBJECT_FORMAT,
  type FileBlobChange,
  type FileBlobMode,
  type FileBlobSnapshot,
  type GitAdapter,
  type RawCommit,
  type RepositoryObjectFormat,
} from "../git/index.js";
import {
  instrumentAsyncIterable,
  type Instrumentation,
  type InstrumentationSpan,
} from "../instrumentation/index.js";
import type { BlobOid, RefType, CommitOid, OidProfile } from "../model/index.js";
import { isCommitOid } from "../model/index.js";
import {
  DEFAULT_COMMIT_TRAVERSAL_STRATEGY,
  createCommitTraversalStrategy,
  type CommitPathSchedulingHint,
  type CommitTraversalStrategy,
} from "./commit-traversal/index.js";

export interface IsomorphicGitAdapterDependencies {
  readonly fs: FsClient;
  readonly instrumentation: Instrumentation;
  readonly commitTraversalStrategy?: CommitTraversalStrategy;
}

export class IsomorphicGitAdapter implements GitAdapter {
  private readonly _fs: FsClient;
  private readonly _instrumentation: Instrumentation;
  private readonly _commitTraversalStrategy: CommitTraversalStrategy;

  constructor(dependencies: IsomorphicGitAdapterDependencies) {
    this._fs = dependencies.fs;
    this._instrumentation = dependencies.instrumentation;
    this._commitTraversalStrategy =
      dependencies.commitTraversalStrategy ??
      createCommitTraversalStrategy(DEFAULT_COMMIT_TRAVERSAL_STRATEGY);
  }

  supportedObjectFormats(): readonly OidProfile[] {
    return ["sha1"];
  }

  [Symbol.asyncDispose](): Promise<void> {
    return Promise.resolve();
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
      await git.resolveRef({
        fs: this._fs,
        dir: repoPath,
        ref: `refs/heads/${ref}`,
      });
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
      const strategy = this._commitTraversalStrategy;
      span.setAttribute("strategy", strategy.name);
      const topology = new CommitTopologyAdapter(this._fs, repoPath, span);
      const oidWalk = strategy.walk(
        {
          graph: topology,
          instrumentation: this._instrumentation,
        },
        oid,
        excludeOid,
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

  async *getFileBlobChanges(
    repoPath: string,
    commitOid: CommitOid,
    parentOid?: CommitOid,
  ): AsyncIterable<FileBlobChange> {
    yield* instrumentAsyncIterable(this._instrumentation, "git.file_blob_changes", (span) =>
      this._getFileBlobChanges(repoPath, commitOid, parentOid, span),
    );
  }

  private async *_getFileBlobChanges(
    repoPath: string,
    commitOid: CommitOid,
    parentOid: CommitOid | undefined,
    span: InstrumentationSpan,
  ): AsyncIterable<FileBlobChange> {
    const descriptors: FileBlobChangeDescriptor[] = [];

    if (parentOid !== undefined) {
      await git.walk({
        fs: this._fs,
        dir: repoPath,
        trees: [git.TREE({ ref: parentOid }), git.TREE({ ref: commitOid })],
        map: async (filepath, entries) => {
          if (filepath === ".") return;

          const A = await classifyWalkerEntry(entries[0]);
          const B = await classifyWalkerEntry(entries[1]);

          // Both trees → walk() descends naturally; skip this entry from output
          if (A.type === "tree" && B.type === "tree") return;

          // Both blobs
          if (A.type === "blob" && B.type === "blob") {
            const [oidA, oidB] = await Promise.all([A.entry.oid(), B.entry.oid()]);
            const [before, after] = await Promise.all([
              describeFileBlobSnapshot(filepath, A.entry, oidA),
              describeFileBlobSnapshot(filepath, B.entry, oidB),
            ]);
            if (before.oid === after.oid && before.mode === after.mode) return;
            descriptors.push({ status: "modified", before, after });
            return;
          }

          // Added (no parent blob at this path)
          if (B.type === "blob") {
            const after = await describeFileBlobSnapshot(filepath, B.entry);
            descriptors.push({ status: "added", before: null, after });
            return;
          }

          // Deleted (no child blob at this path)
          if (A.type === "blob") {
            const before = await describeFileBlobSnapshot(filepath, A.entry);
            descriptors.push({ status: "deleted", before, after: null });
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

          const after = await describeFileBlobSnapshot(filepath, A.entry);
          descriptors.push({ status: "added", before: null, after });
        },
      });
    }

    // The walk buffers only lightweight descriptors. Blob contents are read one
    // change at a time so materialization follows the consumer's pace.
    for (const descriptor of descriptors) {
      const change = await materializeFileBlobChange(descriptor, this._instrumentation);
      span.incrementCounter("yielded");
      span.incrementCounter(change.status);
      span.incrementCounter(
        "blob_bytes",
        (change.before?.content.length ?? 0) + (change.after?.content.length ?? 0),
      );
      yield change;
    }
  }
}

interface FileBlobSnapshotDescriptor {
  readonly path: string;
  readonly oid: BlobOid;
  readonly mode: FileBlobMode;
  readonly entry: git.WalkerEntry;
}

type FileBlobChangeDescriptor =
  | {
      readonly status: "added";
      readonly before: null;
      readonly after: FileBlobSnapshotDescriptor;
    }
  | {
      readonly status: "modified";
      readonly before: FileBlobSnapshotDescriptor;
      readonly after: FileBlobSnapshotDescriptor;
    }
  | {
      readonly status: "deleted";
      readonly before: FileBlobSnapshotDescriptor;
      readonly after: null;
    };

async function describeFileBlobSnapshot(
  path: string,
  entry: git.WalkerEntry,
  knownOid?: string,
): Promise<FileBlobSnapshotDescriptor> {
  const [oid, mode] = await Promise.all([knownOid ?? entry.oid(), entry.mode()]);
  return {
    path,
    oid: oid as BlobOid,
    mode: normalizeFileBlobMode(mode),
    entry,
  };
}

async function materializeFileBlobChange(
  descriptor: FileBlobChangeDescriptor,
  instrumentation: Instrumentation,
): Promise<FileBlobChange> {
  switch (descriptor.status) {
    case "added":
      return {
        status: "added",
        before: null,
        after: await materializeFileBlobSnapshot(descriptor.after, instrumentation),
      };
    case "modified": {
      const [before, after] = await Promise.all([
        materializeFileBlobSnapshot(descriptor.before, instrumentation),
        materializeFileBlobSnapshot(descriptor.after, instrumentation),
      ]);
      return { status: "modified", before, after };
    }
    case "deleted":
      return {
        status: "deleted",
        before: await materializeFileBlobSnapshot(descriptor.before, instrumentation),
        after: null,
      };
  }
}

async function materializeFileBlobSnapshot(
  descriptor: FileBlobSnapshotDescriptor,
  instrumentation: Instrumentation,
): Promise<FileBlobSnapshot> {
  const content = await instrumentation.runAsync("git.blob_read", async () =>
    descriptor.entry.content(),
  );
  return {
    path: descriptor.path,
    oid: descriptor.oid,
    mode: descriptor.mode,
    content: content ?? new Uint8Array(0),
  };
}

class CommitTopologyAdapter implements DagTopologyPort<CommitOid, CommitPathSchedulingHint> {
  private readonly cache = new Map<CommitOid, RawCommit>();
  private readonly fs: FsClient;
  private readonly repoPath: string;
  private readonly span: InstrumentationSpan;

  constructor(fs: FsClient, repoPath: string, span: InstrumentationSpan) {
    this.fs = fs;
    this.repoPath = repoPath;
    this.span = span;
  }

  async getSuccessors(
    oid: CommitOid,
  ): Promise<readonly DagSuccessor<CommitOid, CommitPathSchedulingHint>[]> {
    const commit = await this.readCommit(oid, "topology");
    return projectCommitParentSuccessors(commit);
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
      const { commit } = await git.readCommit({
        fs: this.fs,
        dir: this.repoPath,
        oid,
      });
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

export function projectCommitParentSuccessors(
  commit: RawCommit,
): readonly DagSuccessor<CommitOid, CommitPathSchedulingHint>[] {
  const domainHint: CommitPathSchedulingHint = {
    sourceCommitterTimestamp: commit.committer.timestamp,
  };
  return commit.parents.map((parentOid) => ({ nodeId: parentOid, domainHint }));
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

function normalizeFileBlobMode(mode: number): FileBlobMode {
  const normalized = mode.toString(8).padStart(6, "0");
  if (normalized === "100644" || normalized === "100755" || normalized === "120000") {
    return normalized;
  }
  throw new GitAdapterError(`Unexpected file blob mode: ${normalized}`, "UNKNOWN");
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
