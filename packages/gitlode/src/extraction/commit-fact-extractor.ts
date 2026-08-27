import type { DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import type {
  CommitFact,
  CommitTraversalExtractor,
  CommitTraversalRequest,
  ExtractionRange,
  TraversalPlan,
} from "@gitlode/internal-contracts/extraction";
import type { GitAdapter, RawCommit } from "@gitlode/internal-contracts/git";
import { GitAdapterError } from "@gitlode/internal-contracts/git";
import {
  instrumentAsyncIterable,
  type Instrumentation,
} from "@gitlode/internal-foundation/instrumentation";

function toCommitFact(rawCommit: RawCommit, repoName: string, repoUrl: string | null): CommitFact {
  return {
    type: "commit",
    oid: rawCommit.oid,
    message: rawCommit.message,
    author: {
      name: rawCommit.author.name,
      email: rawCommit.author.email,
      timestamp: rawCommit.author.timestamp,
      timezoneOffset: rawCommit.author.timezoneOffset,
    },
    committer: {
      name: rawCommit.committer.name,
      email: rawCommit.committer.email,
      timestamp: rawCommit.committer.timestamp,
      timezoneOffset: rawCommit.committer.timezoneOffset,
    },
    parents: rawCommit.parents,
    repository: { name: repoName, url: repoUrl },
  };
}

export class CommitFactExtractor implements CommitTraversalExtractor {
  private readonly adapter: GitAdapter;
  private readonly instrumentation: Instrumentation;

  constructor(adapter: GitAdapter, instrumentation: Instrumentation) {
    this.adapter = adapter;
    this.instrumentation = instrumentation;
  }

  extract(
    request: CommitTraversalRequest,
    diagnosticReporter: DiagnosticReporter,
  ): AsyncIterable<CommitFact> {
    const { repositoryPath, repoName, repoUrl, plans, range } = request;
    return instrumentAsyncIterable(this.instrumentation, "gitlode.traversal", (span) => {
      span.incrementCounter("plans", plans.length);
      span.setAttribute("gitlode.range.kind", range?.type ?? "none");
      return this.iterateCommitFacts(
        plans,
        repositoryPath,
        repoName,
        repoUrl,
        range,
        diagnosticReporter,
      );
    });
  }

  private async *iterateCommitFacts(
    plans: readonly TraversalPlan[],
    repositoryPath: string,
    repoName: string,
    repoUrl: string | null,
    range: ExtractionRange | undefined,
    diagnosticReporter: DiagnosticReporter,
  ): AsyncIterable<CommitFact> {
    // Run-scoped visited set shared across all branches for cross-branch deduplication.
    const visited = new Set<string>();

    for (const plan of plans) {
      yield* this.traverseBranch(
        plan,
        repositoryPath,
        repoName,
        repoUrl,
        range,
        visited,
        diagnosticReporter,
      );
    }
  }

  private async *traverseBranch(
    plan: TraversalPlan,
    repositoryPath: string,
    repoName: string,
    repoUrl: string | null,
    range: ExtractionRange | undefined,
    visited: Set<string>,
    diagnosticReporter: DiagnosticReporter,
  ): AsyncIterable<CommitFact> {
    // Process a single raw commit: deduplication + --since-date skip-and-continue filter.
    // Returns null to signal "skip this commit" without aborting traversal.
    const processRawCommit = (rawCommit: RawCommit): CommitFact | null => {
      if (visited.has(rawCommit.oid)) return null;
      visited.add(rawCommit.oid);
      if (range?.type === "date") {
        if (rawCommit.committer.timestamp * 1000 <= range.since.getTime()) {
          // skip-and-continue: do not terminate traversal early
          return null;
        }
      }
      return toCommitFact(rawCommit, repoName, repoUrl);
    };

    try {
      for await (const rawCommit of this.adapter.walkCommits(
        repositoryPath,
        plan.head,
        plan.excludeHash,
      )) {
        const fact = this.instrumentation.run("gitlode.traversal.process_commit", () =>
          processRawCommit(rawCommit),
        );
        if (fact !== null) yield fact;
      }
    } catch (err) {
      if (err instanceof GitAdapterError && err.code === "COMMIT_NOT_FOUND") {
        diagnosticReporter.report({
          severity: "warn",
          message: `Warning: Last commit hash for branch "${plan.name}" no longer exists. Falling back to full extraction.`,
        });
        // Full traversal without excludeHash; already-visited commits are skipped via deduplication.
        for await (const rawCommit of this.adapter.walkCommits(repositoryPath, plan.head)) {
          const fact = this.instrumentation.run("gitlode.traversal.process_commit", () =>
            processRawCommit(rawCommit),
          );
          if (fact !== null) yield fact;
        }
      } else {
        throw err;
      }
    }
  }
}
