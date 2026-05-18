import type { GitAdapter, RawCommit } from "../git/index.js";
import { GitAdapterError } from "../git/index.js";
import { withProfiler } from "./profile/index.js";
import type {
  TraversalPlan,
  CommitFact,
  CommitTraversalExtractor,
  CommitTraversalRequest,
  ExtractionRange,
  ProgressReporter,
  StageProfiler,
} from "./types.js";

function toCommitFact(
  rawCommit: RawCommit,
  repoName: string,
  remoteUrl: string | null,
): CommitFact {
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
    repository: { name: repoName, url: remoteUrl },
  };
}

// ---------------------------------------------------------------------------
// DefaultCommitTraversalExtractor
// ---------------------------------------------------------------------------

export class DefaultCommitTraversalExtractor implements CommitTraversalExtractor {
  private readonly adapter: GitAdapter;
  private readonly profiler?: StageProfiler;

  constructor(adapter: GitAdapter, profiler?: StageProfiler) {
    this.adapter = adapter;
    this.profiler = profiler;
  }

  extract(request: CommitTraversalRequest, reporter: ProgressReporter): AsyncIterable<CommitFact> {
    const { repositoryPath, repoName, remoteUrl, plans, range } = request;
    return this.iterateCommitFacts(plans, repositoryPath, repoName, remoteUrl, range, reporter);
  }

  private async *iterateCommitFacts(
    plans: readonly TraversalPlan[],
    repositoryPath: string,
    repoName: string,
    remoteUrl: string | null,
    range: ExtractionRange | undefined,
    reporter: ProgressReporter,
  ): AsyncIterable<CommitFact> {
    // Run-scoped visited set shared across all branches for cross-branch deduplication.
    const visited = new Set<string>();

    for (const plan of plans) {
      yield* this.traverseBranch(
        plan,
        repositoryPath,
        repoName,
        remoteUrl,
        range,
        visited,
        reporter,
      );
    }
  }

  private async *traverseBranch(
    plan: TraversalPlan,
    repositoryPath: string,
    repoName: string,
    remoteUrl: string | null,
    range: ExtractionRange | undefined,
    visited: Set<string>,
    reporter: ProgressReporter,
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
      return toCommitFact(rawCommit, repoName, remoteUrl);
    };

    try {
      for await (const rawCommit of this.adapter.walkCommits(
        repositoryPath,
        plan.head,
        plan.excludeHash,
      )) {
        const fact = withProfiler(this.profiler, () => processRawCommit(rawCommit));
        if (fact !== null) yield fact;
      }
    } catch (err) {
      if (err instanceof GitAdapterError && err.code === "COMMIT_NOT_FOUND") {
        reporter.emit({
          type: "warning",
          message: `Warning: Last commit hash for branch "${plan.name}" no longer exists. Falling back to full extraction.`,
        });
        // Full traversal without excludeHash; already-visited commits are skipped via deduplication.
        for await (const rawCommit of this.adapter.walkCommits(repositoryPath, plan.head)) {
          const fact = withProfiler(this.profiler, () => processRawCommit(rawCommit));
          if (fact !== null) yield fact;
        }
      } else {
        throw err;
      }
    }
  }
}
