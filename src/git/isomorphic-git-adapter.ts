import nodeFs from "node:fs";

import * as git from "isomorphic-git";
import type { FsClient } from "isomorphic-git";

import { GitAdapterError } from "./errors.js";
import type { GitAdapter, RawCommit } from "./index.js";

export class IsomorphicGitAdapter implements GitAdapter {
  private readonly _fs: FsClient;

  constructor(fsImpl?: FsClient) {
    this._fs = fsImpl ?? (nodeFs as FsClient);
  }

  async resolveRef(repoPath: string, ref: string): Promise<string> {
    try {
      return await git.resolveRef({ fs: this._fs, dir: repoPath, ref });
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
    head: string,
    excludeHash?: string,
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
        oid: hash,
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
