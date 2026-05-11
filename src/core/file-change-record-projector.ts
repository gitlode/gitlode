import { splitMessage, toISO8601 } from "../output/index.js";
import type { OutputFileRecord } from "../output/index.js";
import { withProfiler } from "./profiler-utils.js";
import type { FileChangeFact, StageProfiler } from "./types.js";

export interface FileChangeRecordProjector {
  project(fileChanges: AsyncIterable<FileChangeFact>): AsyncIterable<OutputFileRecord>;
}

export class DefaultFileChangeRecordProjector implements FileChangeRecordProjector {
  private readonly repoName: string;
  private readonly remoteUrl: string | null;
  private readonly profiler?: StageProfiler;

  constructor(repoName: string, remoteUrl: string | null, profiler?: StageProfiler) {
    this.repoName = repoName;
    this.remoteUrl = remoteUrl;
    this.profiler = profiler;
  }

  async *project(fileChanges: AsyncIterable<FileChangeFact>): AsyncIterable<OutputFileRecord> {
    for await (const fact of fileChanges) {
      const buildRecord = (): OutputFileRecord => {
        const { subject, body } = splitMessage(fact.commit.message);
        return {
          oid: fact.commit.oid,
          subject,
          body,
          author: {
            name: fact.commit.author.name,
            email: fact.commit.author.email,
            timestamp: toISO8601(fact.commit.author.timestamp, fact.commit.author.timezoneOffset),
          },
          committer: {
            name: fact.commit.committer.name,
            email: fact.commit.committer.email,
            timestamp: toISO8601(
              fact.commit.committer.timestamp,
              fact.commit.committer.timezoneOffset,
            ),
          },
          parents: fact.commit.parents,
          repository: { name: this.repoName, url: this.remoteUrl },
          file: fact.file,
        };
      };

      const record: OutputFileRecord = withProfiler(this.profiler, buildRecord);
      yield record;
    }
  }
}
