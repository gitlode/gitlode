export type { GitAdapter, RawCommit, RawPerson };
export { GitAdapterError } from "./errors.js";

import type { PersonIdentity } from "../core/index.js";

interface RawPerson extends PersonIdentity {
  timestamp: number;
  timezoneOffset: number;
}

interface RawCommit {
  oid: string;
  message: string;
  author: RawPerson;
  committer: RawPerson;
  parents: string[];
}

interface GitAdapter {
  /** Resolve a ref (branch name) to a commit hash */
  resolveRef(repoPath: string, ref: string): Promise<string>;

  /** Walk commits reachable from `head`, stopping before `excludeHash` if provided */
  walkCommits(
    repoPath: string,
    head: string,
    excludeHash?: string,
  ): AsyncIterable<RawCommit>;

  /** Return the remote URL for `origin`, or null if not set */
  getRemoteUrl(repoPath: string): Promise<string | null>;
}
