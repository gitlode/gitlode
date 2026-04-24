import type { GitAdapter, RawCommit } from "../git/index.js";
import { GitAdapterError } from "../git/index.js";
import type {
  BranchCheckpoint,
  CommitFact,
  CommitHash,
  CommitTraversalExtractor,
  CommitTraversalRequest,
  CommitTraversalResult,
  ExtractionCheckpoint,
  ExtractionRange,
  Reporter,
} from "./types.js";
import { assertNever } from "./types.js";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Resolved traversal context for a single branch. Private to this module. */
interface BranchTraversalPlan {
  readonly name: string;
  readonly head: CommitHash;
  readonly excludeHash: CommitHash | undefined;
}

function resolveExcludeHash(
  branchName: string,
  priorBranchMap: ReadonlyMap<string, CommitHash>,
  newBranchExclude: CommitHash | undefined,
  range: ExtractionRange | undefined,
): CommitHash | undefined {
  if (range === undefined) {
    return priorBranchMap.get(branchName) ?? newBranchExclude;
  }
  if (range.type === "ref") {
    return range.ref;
  } else if (range.type === "date") {
    return undefined;
  } else {
    assertNever(range);
  }
}

function toCommitFact(
  rawCommit: RawCommit,
  repoName: string,
  remoteUrl: string | null,
): CommitFact {
  return {
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

  constructor(adapter: GitAdapter) {
    this.adapter = adapter;
  }

  async extract(
    request: CommitTraversalRequest,
    reporter: Reporter,
  ): Promise<CommitTraversalResult> {
    const {
      repositoryPath,
      repoName,
      remoteUrl,
      branches,
      mode,
      priorBranchMap,
      range,
      generatedAt,
    } = request;

    // Identify new branches that have no prior checkpoint entry (incremental mode only).
    const newBranches = new Set<string>(
      mode === "incremental" ? branches.filter((b) => !priorBranchMap.has(b)) : [],
    );

    // Compute merge-base exclude for newly added branches to avoid cross-run duplicates.
    let newBranchExclude: CommitHash | undefined;
    if (newBranches.size > 0 && priorBranchMap.size > 0) {
      const mergeBase = await this.adapter.findMergeBase(
        repositoryPath,
        Array.from(priorBranchMap.values()),
      );
      newBranchExclude = mergeBase ?? undefined;
    }

    // Resolve branch heads and build traversal plans. Missing branches emit a warning and are
    // excluded from traversal and the candidate checkpoint.
    const plans: BranchTraversalPlan[] = [];
    const resolvedHeads = new Map<string, CommitHash>();

    for (const branch of branches) {
      let head: CommitHash;
      try {
        head = await this.adapter.resolveRef(repositoryPath, branch);
      } catch (err) {
        if (err instanceof GitAdapterError && err.code === "REF_NOT_FOUND") {
          reporter.warn(
            `Warning: Branch "${branch}" no longer exists in the repository. Skipping.`,
          );
          continue;
        }
        throw err;
      }
      resolvedHeads.set(branch, head);
      const excludeHash = resolveExcludeHash(branch, priorBranchMap, newBranchExclude, range);
      plans.push({ name: branch, head, excludeHash });
    }

    // Build candidate checkpoint from successfully resolved heads. The caller is responsible for
    // persisting this only after output writing and writer close succeed.
    const candidateCheckpoint: ExtractionCheckpoint = {
      version: 1,
      generatedAt,
      repositoryPath,
      branches: Array.from(resolvedHeads.entries()).map(
        ([name, lastCommitHash]): BranchCheckpoint => ({ name, lastCommitHash }),
      ),
    };

    // Build the lazy commit-facts stream. Branches are iterated sequentially to preserve
    // non-interleaved branch order; deduplication spans the full run.
    const commitFacts = this.iterateCommitFacts(
      plans,
      repositoryPath,
      repoName,
      remoteUrl,
      range,
      reporter,
    );

    return { commitFacts, candidateCheckpoint };
  }

  private async *iterateCommitFacts(
    plans: BranchTraversalPlan[],
    repositoryPath: string,
    repoName: string,
    remoteUrl: string | null,
    range: ExtractionRange | undefined,
    reporter: Reporter,
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
    plan: BranchTraversalPlan,
    repositoryPath: string,
    repoName: string,
    remoteUrl: string | null,
    range: ExtractionRange | undefined,
    visited: Set<string>,
    reporter: Reporter,
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
        const fact = processRawCommit(rawCommit);
        if (fact !== null) yield fact;
      }
    } catch (err) {
      if (err instanceof GitAdapterError && err.code === "COMMIT_NOT_FOUND") {
        reporter.warn(
          `Warning: Last commit hash for branch "${plan.name}" no longer exists. Falling back to full extraction.`,
        );
        // Full traversal without excludeHash; already-visited commits are skipped via deduplication.
        for await (const rawCommit of this.adapter.walkCommits(repositoryPath, plan.head)) {
          const fact = processRawCommit(rawCommit);
          if (fact !== null) yield fact;
        }
      } else {
        throw err;
      }
    }
  }
}
