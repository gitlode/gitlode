import type { GitAdapter } from "../git/index.js";
import type { CommitFact, CommitHash, FileChangeExpander, FileChangeFact } from "./types.js";

export class DefaultFileChangeExpander implements FileChangeExpander {
  private readonly adapter: GitAdapter;

  constructor(adapter: GitAdapter) {
    this.adapter = adapter;
  }

  async *expand(
    commits: AsyncIterable<CommitFact>,
    repositoryPath: string,
  ): AsyncIterable<FileChangeFact> {
    for await (const commit of commits) {
      const parentOid = commit.parents[0] as CommitHash | undefined;
      const fileChanges = await this.adapter.getFileChanges(
        repositoryPath,
        commit.oid as CommitHash,
        parentOid,
      );
      for (const fileChange of fileChanges) {
        yield {
          commit,
          file: {
            path: fileChange.path,
            status: fileChange.status,
            additions: fileChange.additions,
            deletions: fileChange.deletions,
          },
        };
      }
    }
  }
}
