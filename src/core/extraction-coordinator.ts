import { withProfilerAsync } from "./profiler-utils.js";
import type {
  BranchCheckpoint,
  CommitFact,
  CoordinatorDependencies,
  CoordinatorRequest,
  CoordinatorResult,
  ExtractionCheckpoint,
  Fact,
} from "./types.js";

/** Core-owned interface for the extraction orchestration stage. */
export interface ExtractionCoordinator {
  run(request: CoordinatorRequest): Promise<CoordinatorResult>;
}

async function* deduplicateCommits(
  source: AsyncIterable<CommitFact>,
  visited: Set<string>,
): AsyncIterable<CommitFact> {
  for await (const fact of source) {
    if (!visited.has(fact.oid)) {
      visited.add(fact.oid);
      yield fact;
    }
  }
}

async function* wrapCommitCounter(
  source: AsyncIterable<CommitFact>,
  onCommit: () => void,
): AsyncIterable<CommitFact> {
  for await (const fact of source) {
    onCommit();
    yield fact;
  }
}

export class DefaultExtractionCoordinator implements ExtractionCoordinator {
  private readonly deps: CoordinatorDependencies;

  constructor(deps: CoordinatorDependencies) {
    this.deps = deps;
  }

  async run(request: CoordinatorRequest): Promise<CoordinatorResult> {
    const {
      traversalPlanner,
      traversalExtractor,
      fileChangeExpander,
      projector,
      sink,
      checkpointStore,
      reporter,
      profiler,
    } = this.deps;

    // -----------------------------------------------------------------------
    // 1. Preparing phase: plan branch traversal boundaries.
    // -----------------------------------------------------------------------
    reporter.emit({ type: "phase-start", phase: "preparing" });

    const priorBranchMap = new Map(
      request.priorCheckpoint.branches.map((b) => [b.name, b.lastCommitHash]),
    );

    const plans = await traversalPlanner.plan(
      {
        repositoryPath: request.repositoryPath,
        branches: [...request.branches],
        mode: priorBranchMap.size > 0 ? "incremental" : "snapshot",
        priorBranchMap,
        range: request.range,
      },
      reporter,
    );

    reporter.emit({ type: "phase-end", phase: "preparing" });

    // Build the candidate checkpoint from successfully resolved branch heads.
    const candidateCheckpoint: ExtractionCheckpoint = {
      version: 1,
      generatedAt: request.sessionTimestamp.toISOString(),
      repositoryPath: request.repositoryPath,
      branches: plans.map(
        (plan): BranchCheckpoint => ({ name: plan.name, lastCommitHash: plan.head }),
      ),
    };

    // -----------------------------------------------------------------------
    // 2. Extracting phase: per-branch extraction with coordinator-level dedup.
    // -----------------------------------------------------------------------
    reporter.emit({ type: "phase-start", phase: "extracting" });

    const allVisited = new Set<string>();
    let commitsTraversed = 0;
    let recordsWritten = 0;
    const branchCount = plans.length;

    try {
      for (let i = 0; i < plans.length; i++) {
        const plan = plans[i]!;
        const branchIndex = i;

        const rawStream = traversalExtractor.extract(
          {
            repositoryPath: request.repositoryPath,
            repoName: request.repoName,
            remoteUrl: request.remoteUrl,
            plans: [plan],
            range: request.range,
          },
          reporter,
        );

        const dedupedStream = deduplicateCommits(rawStream, allVisited);
        const countedStream = wrapCommitCounter(dedupedStream, () => {
          commitsTraversed++;
        });

        const factStream: AsyncIterable<Fact> =
          request.granularity === "file"
            ? fileChangeExpander.expand(countedStream, request.repositoryPath)
            : countedStream;

        for await (const record of projector.project(factStream)) {
          await withProfilerAsync(profiler, () => sink.write(record));
          recordsWritten++;
          reporter.emit({
            type: "extracting-progress",
            phase: "extracting",
            branchIndex,
            branchCount,
            commitsTraversed,
            recordsWritten,
            bytesWritten: sink.bytesWritten,
          });
        }
      }
    } finally {
      await withProfilerAsync(profiler, () => sink.close());
    }

    reporter.emit({ type: "phase-end", phase: "extracting" });

    // -----------------------------------------------------------------------
    // 3. Finalizing phase: persist checkpoint.
    // -----------------------------------------------------------------------
    reporter.emit({ type: "phase-start", phase: "finalizing" });

    if (checkpointStore !== undefined && candidateCheckpoint.branches.length > 0) {
      await checkpointStore.write(candidateCheckpoint);
    }

    reporter.emit({ type: "phase-end", phase: "finalizing" });

    return {
      recordsWritten,
      commitsTraversed,
      branches: candidateCheckpoint.branches.map((b) => b.name),
    };
  }
}
