import * as git from "isomorphic-git";
import type { FsClient } from "isomorphic-git";

import type { StageProfiler } from "../core/index.js";
import { withProfilerAsync } from "../core/profile/index.js";
import { GitAdapterError } from "../git/errors.js";
import {
  DEFAULT_REPOSITORY_OBJECT_FORMAT,
  type DiffAdapter,
  type FileChange,
  type GitAdapter,
  type RawCommit,
  type RepositoryObjectFormat,
} from "../git/types.js";
import type { RefType, CommitOid, OidProfile } from "../model/index.js";
import { isCommitOid } from "../model/index.js";
import { shiftOrThrow } from "../support/index.js";

export interface IsomorphicGitAdapterDependencies {
  readonly fs: FsClient;
  readonly diffAdapter: DiffAdapter;
  readonly profiler?: StageProfiler;
}

export class IsomorphicGitAdapter implements GitAdapter {
  private readonly _fs: FsClient;
  private readonly _diffAdapter: DiffAdapter;
  private _resolveRefProfiler?: StageProfiler;
  private _repositoryObjectFormatProfiler?: StageProfiler;
  private _getRemoteUrlProfiler?: StageProfiler;
  private _walkCommitsProfiler?: StageProfiler;
  private _walkReadCommitProfiler?: StageProfiler;
  private _excludeCollectProfiler?: StageProfiler;
  private _excludeReadCommitProfiler?: StageProfiler;
  private _mergeBaseProfiler?: StageProfiler;
  private _fileChangesProfiler?: StageProfiler;
  private _blobReadProfiler?: StageProfiler;
  private _diffProfiler?: StageProfiler;

  constructor(dependencies: IsomorphicGitAdapterDependencies) {
    this._fs = dependencies.fs;
    this._diffAdapter = dependencies.diffAdapter;
    this._configureProfilers(dependencies.profiler);
  }

  supportedObjectFormats(): readonly OidProfile[] {
    return ["sha1"];
  }

  private _configureProfilers(profiler: StageProfiler | undefined): void {
    if (profiler === undefined) {
      return;
    }

    this._resolveRefProfiler = profiler.createScopedProfiler("resolve-ref");
    this._repositoryObjectFormatProfiler = profiler.createScopedProfiler(
      "repository-object-format",
    );
    this._getRemoteUrlProfiler = profiler.createScopedProfiler("get-remote-url");
    this._walkCommitsProfiler = profiler.createScopedProfiler("walk-commits");
    this._walkReadCommitProfiler = this._walkCommitsProfiler.createScopedProfiler("read-commit");
    this._excludeCollectProfiler = profiler.createScopedProfiler("exclude-collect");
    this._excludeReadCommitProfiler =
      this._excludeCollectProfiler.createScopedProfiler("read-commit");
    this._mergeBaseProfiler = profiler.createScopedProfiler("merge-base");
    this._fileChangesProfiler = profiler.createScopedProfiler("file-changes");
    this._blobReadProfiler = profiler.createScopedProfiler("blob-read");
    this._diffProfiler = profiler.createScopedProfiler("diff");
  }

  async resolveRef(repoPath: string, ref: string): Promise<CommitOid> {
    let oid: string;
    try {
      oid = (await withProfilerAsync(this._resolveRefProfiler, async () =>
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
      const raw = await withProfilerAsync(this._repositoryObjectFormatProfiler, async () =>
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
      const url = await withProfilerAsync(this._getRemoteUrlProfiler, async () =>
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
    head: CommitOid,
    excludeHash?: CommitOid,
  ): AsyncIterable<RawCommit> {
    const excluded = excludeHash
      ? await this._collectReachable(repoPath, excludeHash)
      : new Set<string>();

    const queue: string[] = [head];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const next = await withProfilerAsync(this._walkCommitsProfiler, async () => {
        const hash = shiftOrThrow(queue);
        if (visited.has(hash) || excluded.has(hash)) return null;
        visited.add(hash);

        const { commit } = await withProfilerAsync(this._walkReadCommitProfiler, async () =>
          git.readCommit({
            fs: this._fs,
            dir: repoPath,
            oid: hash,
          }),
        );

        return { hash, commit };
      });

      if (next === null) continue;

      yield {
        oid: next.hash as CommitOid,
        message: next.commit.message,
        author: {
          name: next.commit.author.name,
          email: next.commit.author.email,
          timestamp: next.commit.author.timestamp,
          timezoneOffset: next.commit.author.timezoneOffset,
        },
        committer: {
          name: next.commit.committer.name,
          email: next.commit.committer.email,
          timestamp: next.commit.committer.timestamp,
          timezoneOffset: next.commit.committer.timezoneOffset,
        },
        parents: next.commit.parent as CommitOid[],
      };

      for (const parent of next.commit.parent) {
        if (!visited.has(parent) && !excluded.has(parent)) {
          queue.push(parent);
        }
      }
    }
  }

  async findMergeBase(repoPath: string, oids: readonly CommitOid[]): Promise<CommitOid | null> {
    try {
      const result = await withProfilerAsync(this._mergeBaseProfiler, async () =>
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
    return withProfilerAsync(this._fileChangesProfiler, async () => {
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
              const [contentA, contentB] = await withProfilerAsync(this._blobReadProfiler, () =>
                Promise.all([A.entry.content(), B.entry.content()]),
              );
              const change = await withProfilerAsync(this._diffProfiler, async () =>
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
              const contentB = await withProfilerAsync(this._blobReadProfiler, () =>
                B.entry.content(),
              );
              const change = await withProfilerAsync(this._diffProfiler, async () =>
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
              const contentA = await withProfilerAsync(this._blobReadProfiler, () =>
                A.entry.content(),
              );
              const change = await withProfilerAsync(this._diffProfiler, async () =>
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

            const contentA = await withProfilerAsync(this._blobReadProfiler, () =>
              A.entry.content(),
            );
            const change = await withProfilerAsync(this._diffProfiler, async () =>
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

  private async _collectReachable(repoPath: string, startHash: string): Promise<Set<string>> {
    return withProfilerAsync(this._excludeCollectProfiler, async () => {
      const reachable = new Set<string>();
      const queue = [startHash];
      while (queue.length > 0) {
        const hash = shiftOrThrow(queue);
        if (reachable.has(hash)) continue;
        reachable.add(hash);
        let commitParents: string[];
        try {
          const { commit } = await withProfilerAsync(this._excludeReadCommitProfiler, async () =>
            git.readCommit({
              fs: this._fs,
              dir: repoPath,
              oid: hash,
            }),
          );
          commitParents = commit.parent;
        } catch (err) {
          if (err instanceof Error && err.name === "NotFoundError") {
            throw new GitAdapterError(`Commit not found: ${hash}`, "COMMIT_NOT_FOUND", err);
          }
          throw new GitAdapterError(
            `Unexpected error reading commit ${hash}: ${String(err)}`,
            "UNKNOWN",
            err,
          );
        }
        for (const parent of commitParents) {
          queue.push(parent);
        }
      }
      return reachable;
    });
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
