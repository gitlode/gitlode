import nodeFs from "node:fs";

import { diffLines } from "diff";
import * as git from "isomorphic-git";
import type { FsClient } from "isomorphic-git";

import type { CommitHash } from "../core/index.js";
import { GitAdapterError } from "./errors.js";
import type { FileChange, GitAdapter, RawCommit } from "./index.js";

export class IsomorphicGitAdapter implements GitAdapter {
  private readonly _fs: FsClient;

  constructor(fsImpl?: FsClient) {
    this._fs = fsImpl ?? (nodeFs as FsClient);
  }

  async resolveRef(repoPath: string, ref: string): Promise<CommitHash> {
    try {
      return (await git.resolveRef({ fs: this._fs, dir: repoPath, ref })) as CommitHash;
    } catch (err) {
      if (err instanceof Error) {
        const name = err.name;
        if (name === "NotFoundError" || name === "ResolveRefError") {
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
  }

  async getRemoteUrl(repoPath: string): Promise<string | null> {
    try {
      const url = await git.getConfig({
        fs: this._fs,
        dir: repoPath,
        path: "remote.origin.url",
      });
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
    head: CommitHash,
    excludeHash?: CommitHash,
  ): AsyncIterable<RawCommit> {
    const excluded = excludeHash
      ? await this._collectReachable(repoPath, excludeHash)
      : new Set<string>();

    const queue: string[] = [head];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const hash = queue.shift()!;
      if (visited.has(hash) || excluded.has(hash)) continue;
      visited.add(hash);

      const { commit } = await git.readCommit({
        fs: this._fs,
        dir: repoPath,
        oid: hash,
      });

      yield {
        oid: hash as CommitHash,
        message: commit.message,
        author: {
          name: commit.author.name,
          email: commit.author.email,
          timestamp: commit.author.timestamp,
          timezoneOffset: commit.author.timezoneOffset,
        },
        committer: {
          name: commit.committer.name,
          email: commit.committer.email,
          timestamp: commit.committer.timestamp,
          timezoneOffset: commit.committer.timezoneOffset,
        },
        parents: commit.parent,
      };

      for (const parent of commit.parent) {
        if (!visited.has(parent) && !excluded.has(parent)) {
          queue.push(parent);
        }
      }
    }
  }

  async findMergeBase(repoPath: string, oids: readonly CommitHash[]): Promise<CommitHash | null> {
    try {
      const result = await git.findMergeBase({
        fs: this._fs,
        dir: repoPath,
        oids: oids as unknown as string[],
      });
      if (result.length === 0) return null;
      return result[0] as CommitHash;
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
    commitOid: CommitHash,
    parentOid?: CommitHash,
  ): Promise<readonly FileChange[]> {
    const changes: FileChange[] = [];

    if (parentOid !== undefined) {
      await git.walk({
        fs: this._fs,
        dir: repoPath,
        trees: [git.TREE({ ref: parentOid }), git.TREE({ ref: commitOid })],
        map: async (filepath, entries) => {
          if (filepath === ".") return;

          const A = entries[0];
          const B = entries[1];
          const typeA = A ? await A.type() : null;
          const typeB = B ? await B.type() : null;

          // Skip submodules
          if (typeA === "commit" || typeB === "commit") return;

          // Both trees → walk() descends naturally; skip this entry from output
          if (typeA === "tree" && typeB === "tree") return;

          // Both blobs
          if (typeA === "blob" && typeB === "blob") {
            const [oidA, oidB] = await Promise.all([A!.oid(), B!.oid()]);
            if (oidA === oidB) return; // unchanged
            const [contentA, contentB] = await Promise.all([A!.content(), B!.content()]);
            changes.push(
              this._buildFileChange(
                filepath,
                "modified",
                contentA ?? new Uint8Array(0),
                contentB ?? new Uint8Array(0),
              ),
            );
            return;
          }

          // Added (no parent blob at this path)
          if (typeB === "blob") {
            const contentB = await B!.content();
            changes.push(
              this._buildFileChange(
                filepath,
                "added",
                new Uint8Array(0),
                contentB ?? new Uint8Array(0),
              ),
            );
            return;
          }

          // Deleted (no child blob at this path)
          if (typeA === "blob") {
            const contentA = await A!.content();
            changes.push(
              this._buildFileChange(
                filepath,
                "deleted",
                contentA ?? new Uint8Array(0),
                new Uint8Array(0),
              ),
            );
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

          const A = entries[0];
          if (!A) return;

          const typeA = await A.type();
          if (typeA !== "blob") return;

          const contentA = await A.content();
          changes.push(
            this._buildFileChange(
              filepath,
              "added",
              new Uint8Array(0),
              contentA ?? new Uint8Array(0),
            ),
          );
        },
      });
    }

    return changes;
  }

  private _buildFileChange(
    path: string,
    status: "added" | "modified" | "deleted",
    contentA: Uint8Array,
    contentB: Uint8Array,
  ): FileChange {
    if (this._isBinary(contentA) || this._isBinary(contentB)) {
      return { path, status, additions: null, deletions: null };
    }

    const decoder = new TextDecoder("utf-8");
    const oldStr = decoder.decode(contentA);
    const newStr = decoder.decode(contentB);

    const parts = diffLines(oldStr, newStr);
    let additions = 0;
    let deletions = 0;
    for (const part of parts) {
      if (part.added) additions += part.count;
      if (part.removed) deletions += part.count;
    }

    return { path, status, additions, deletions };
  }

  private _isBinary(content: Uint8Array): boolean {
    const limit = Math.min(content.length, 8000);
    for (let i = 0; i < limit; i++) {
      if (content[i] === 0) return true;
    }
    return false;
  }

  private async _collectReachable(repoPath: string, startHash: string): Promise<Set<string>> {
    const reachable = new Set<string>();
    const queue = [startHash];
    while (queue.length > 0) {
      const hash = queue.shift()!;
      if (reachable.has(hash)) continue;
      reachable.add(hash);
      let commitParents: string[];
      try {
        const { commit } = await git.readCommit({
          fs: this._fs,
          dir: repoPath,
          oid: hash,
        });
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
  }
}
