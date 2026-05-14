import { splitMessage, toISO8601 } from "../output/index.js";
import type { OutputRecord } from "../output/types.js";
import { withProfiler } from "./profiler-utils.js";
import type { CommitFact, Fact, FileChangeFact, StageProfiler } from "./types.js";
import { assertNever } from "./types.js";

export interface FactProjector {
  project(facts: AsyncIterable<Fact>): AsyncIterable<OutputRecord>;
}

export class DefaultFactProjector implements FactProjector {
  private readonly repoName: string;
  private readonly remoteUrl: string | null;
  private readonly profiler?: StageProfiler;

  constructor(repoName: string, remoteUrl: string | null, profiler?: StageProfiler) {
    this.repoName = repoName;
    this.remoteUrl = remoteUrl;
    this.profiler = profiler;
  }

  async *project(facts: AsyncIterable<Fact>): AsyncIterable<OutputRecord> {
    for await (const fact of facts) {
      switch (fact.type) {
        case "commit": {
          yield withProfiler(this.profiler, () => this.projectCommit(fact));
          break;
        }
        case "file-change": {
          yield withProfiler(this.profiler, () => this.projectFileChange(fact));
          break;
        }
        default:
          assertNever(fact);
      }
    }
  }

  private projectCommit(fact: CommitFact): OutputRecord {
    const { subject, body } = splitMessage(fact.message);
    return {
      oid: fact.oid,
      subject,
      body,
      author: {
        name: fact.author.name,
        email: fact.author.email,
        timestamp: toISO8601(fact.author.timestamp, fact.author.timezoneOffset),
      },
      committer: {
        name: fact.committer.name,
        email: fact.committer.email,
        timestamp: toISO8601(fact.committer.timestamp, fact.committer.timezoneOffset),
      },
      parents: fact.parents,
      repository: { name: this.repoName, url: this.remoteUrl },
    };
  }

  private projectFileChange(fact: FileChangeFact): OutputRecord {
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
        timestamp: toISO8601(fact.commit.committer.timestamp, fact.commit.committer.timezoneOffset),
      },
      parents: fact.commit.parents,
      repository: { name: this.repoName, url: this.remoteUrl },
      file: fact.file,
    };
  }
}
