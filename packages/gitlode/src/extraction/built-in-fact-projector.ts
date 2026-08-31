import type {
  CommitFact,
  Fact,
  FactProjector,
  FileChangeFact,
  ProjectedCommit,
  ProjectedFileChange,
  ProjectedRecord,
} from "@gitlode/internal-contracts/extraction";
import {
  instrumentAsyncIterable,
  getTelemetryAttributeMetadata,
} from "@gitlode/internal-contracts/telemetry";
import { assertNever, formatUnixTimestampWithOffset } from "@gitlode/internal-foundation/support";
import type { Context, Tracer } from "@opentelemetry/api";

import type { BuiltInFactProjectorMetricRecorder } from "./built-in-fact-projector-metric-recorder.js";
import { NOOP_BUILT_IN_FACT_PROJECTOR_METRIC_RECORDER } from "./built-in-fact-projector-metric-recorder.js";

export function projectCommit(
  fact: CommitFact,
  repoName: string,
  repoUrl: string | null,
): ProjectedCommit {
  return {
    oid: fact.oid,
    message: fact.message,
    author: {
      name: fact.author.name,
      email: fact.author.email,
      timestamp: formatUnixTimestampWithOffset(fact.author.timestamp, fact.author.timezoneOffset),
    },
    committer: {
      name: fact.committer.name,
      email: fact.committer.email,
      timestamp: formatUnixTimestampWithOffset(
        fact.committer.timestamp,
        fact.committer.timezoneOffset,
      ),
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
  return {
    oid: fact.commit.oid,
    message: fact.commit.message,
    author: {
      name: fact.commit.author.name,
      email: fact.commit.author.email,
      timestamp: formatUnixTimestampWithOffset(
        fact.commit.author.timestamp,
        fact.commit.author.timezoneOffset,
      ),
    },
    committer: {
      name: fact.commit.committer.name,
      email: fact.commit.committer.email,
      timestamp: formatUnixTimestampWithOffset(
        fact.commit.committer.timestamp,
        fact.commit.committer.timezoneOffset,
      ),
    },
    parents: fact.commit.parents,
    repository: { name: repoName, url: repoUrl },
    file: fact.file,
  };
}

export class BuiltInFactProjector implements FactProjector {
  private readonly repoName: string;
  private readonly repoUrl: string | null;
  private readonly tracer: Tracer;
  private readonly metricRecorder: BuiltInFactProjectorMetricRecorder;

  constructor(
    repoName: string,
    repoUrl: string | null,
    tracer: Tracer,
    metricRecorder: BuiltInFactProjectorMetricRecorder = NOOP_BUILT_IN_FACT_PROJECTOR_METRIC_RECORDER,
  ) {
    this.repoName = repoName;
    this.repoUrl = repoUrl;
    this.tracer = tracer;
    this.metricRecorder = metricRecorder;
  }

  project(facts: AsyncIterable<Fact>, parentContext?: Context): AsyncIterable<ProjectedRecord> {
    return instrumentAsyncIterable(
      this.tracer,
      "gitlode.projection",
      (span) => {
        span.setAttribute(getTelemetryAttributeMetadata("projection_mode").key, "built_in");
        return this.projectRecords(facts);
      },
      undefined,
      parentContext,
    );
  }

  private async *projectRecords(facts: AsyncIterable<Fact>): AsyncIterable<ProjectedRecord> {
    for await (const fact of facts) {
      switch (fact.type) {
        case "commit": {
          const token = this.metricRecorder.startProjection();
          try {
            const record = projectCommit(fact, this.repoName, this.repoUrl);
            this.metricRecorder.completeProjection(token, fact.type, "success");
            yield record;
          } catch (error) {
            this.metricRecorder.completeProjection(token, fact.type, "error");
            throw error;
          }
          break;
        }
        case "file-change": {
          const token = this.metricRecorder.startProjection();
          try {
            const record = projectFileChange(fact, this.repoName, this.repoUrl);
            this.metricRecorder.completeProjection(token, fact.type, "success");
            yield record;
          } catch (error) {
            this.metricRecorder.completeProjection(token, fact.type, "error");
            throw error;
          }
          break;
        }
        default:
          assertNever(fact);
      }
    }
  }
}
