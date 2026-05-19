import type { GitAdapter } from "../git/index.js";
import type { CommitFact, FileChangeExpander, FileChangeFact } from "./types.js";

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
      const parentOid = commit.parents[0];
      const fileChanges = await this.adapter.getFileChanges(repositoryPath, commit.oid, parentOid);
      for (const fileChange of fileChanges) {
        yield {
          type: "file-change",
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
