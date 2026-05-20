import type { GitAdapter } from "../git/index.js";
import type { CommitFact, FileChangeExpander, FileChangeFact } from "./types.js";

export class DefaultFileChangeExpander implements FileChangeExpander {
  private readonly adapter: GitAdapter;
  private readonly maxDiffSize: number | undefined;
  private _skippedDiffCount = 0;

  constructor(adapter: GitAdapter, maxDiffSize?: number) {
    this.adapter = adapter;
    this.maxDiffSize = maxDiffSize;
  }

  get skippedDiffCount(): number {
    return this._skippedDiffCount;
  }

  async *expand(
    commits: AsyncIterable<CommitFact>,
    repositoryPath: string,
  ): AsyncIterable<FileChangeFact> {
    for await (const commit of commits) {
      const parentOid = commit.parents[0];
      const fileChanges = await this.adapter.getFileChanges(repositoryPath, commit.oid, parentOid);
      for (const fileChange of fileChanges) {
        const skipDiff = this.shouldSkipDiff(fileChange);
        if (skipDiff) {
          this._skippedDiffCount++;
        }
        yield {
          type: "file-change",
          commit,
          file: {
            path: fileChange.path,
            status: fileChange.status,
            additions: skipDiff ? null : fileChange.additions,
            deletions: skipDiff ? null : fileChange.deletions,
          },
        };
      }
    }
  }

  private shouldSkipDiff(fileChange: {
    readonly additions: number | null;
    readonly deletions: number | null;
    readonly beforeSize: number;
    readonly afterSize: number;
  }): boolean {
    if (fileChange.additions === null || fileChange.deletions === null) {
      return true;
    }
    if (this.maxDiffSize === undefined) {
      return false;
    }
    return fileChange.beforeSize > this.maxDiffSize || fileChange.afterSize > this.maxDiffSize;
  }
}
