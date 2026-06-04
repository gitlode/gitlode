import { splitMessage, toISO8601 } from "../output/index.js";
import { withProfiler } from "./profile/index.js";
import type {
  CommitFact,
  Fact,
  FactProjector,
  FileChangeFact,
  ProjectedCommit,
  ProjectedFileChange,
  ProjectedRecord,
  StageProfiler,
} from "./types.js";
import { assertNever } from "./types.js";

export function projectCommit(
  fact: CommitFact,
  repoName: string,
  repoUrl: string | null,
): ProjectedCommit {
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
    repository: { name: repoName, url: repoUrl },
  };
}

export function projectFileChange(
  fact: FileChangeFact,
  repoName: string,
  repoUrl: string | null,
): ProjectedFileChange {
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
    repository: { name: repoName, url: repoUrl },
    file: fact.file,
  };
}

export class DefaultFactProjector implements FactProjector {
  private readonly repoName: string;
  private readonly repoUrl: string | null;
  private readonly profiler?: StageProfiler;

  constructor(repoName: string, repoUrl: string | null, profiler?: StageProfiler) {
    this.repoName = repoName;
    this.repoUrl = repoUrl;
    this.profiler = profiler;
  }

  async *project(facts: AsyncIterable<Fact>): AsyncIterable<ProjectedRecord> {
    for await (const fact of facts) {
      switch (fact.type) {
        case "commit": {
          yield withProfiler(this.profiler, () => projectCommit(fact, this.repoName, this.repoUrl));
          break;
        }
        case "file-change": {
          yield withProfiler(this.profiler, () =>
            projectFileChange(fact, this.repoName, this.repoUrl),
          );
          break;
        }
        default:
          assertNever(fact);
      }
    }
  }
}
