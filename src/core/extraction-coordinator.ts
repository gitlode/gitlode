import { withProfilerAsync } from "./profile/index.js";
import type {
  BranchState,
  CommitFact,
  CoordinatorDependencies,
  CoordinatorRequest,
  CoordinatorResult,
  ExtractionCoordinator,
  ExtractionState,
  Fact,
} from "./types.js";

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
      stateStore,
      reporter,
      profiler,
    } = this.deps;

    // -----------------------------------------------------------------------
    // 1. Preparing phase: plan branch traversal boundaries.
    // -----------------------------------------------------------------------
    reporter.emit({ type: "phase-start", phase: "preparing" });

    const priorRefMap = new Map(request.priorState.branches.map((b) => [b.name, b.lastCommitHash]));

    const plans = await traversalPlanner.plan(
      {
        repositoryPath: request.repositoryPath,
        refs: [...request.refs],
        mode: priorRefMap.size > 0 ? "incremental" : "snapshot",
        priorRefMap,
        range: request.range,
      },
      reporter,
    );

    reporter.emit({ type: "phase-end", phase: "preparing" });

    // Warn when state tracking is active but non-branch refs are present.
    // Non-branch refs (tags, raw OIDs) are not recorded in the state file, so
    // they will be re-extracted in full on every incremental run and may produce
    // duplicate records in downstream systems. Use snapshot mode for tag or OID
    // traversal, or track only branch refs in incremental workflows.
    if (stateStore !== undefined) {
      for (const plan of plans) {
        if (!plan.isBranch) {
          reporter.emit({
            type: "warning",
            message: `Warning: Ref "${plan.name}" is not a branch and will not be recorded in the state file. It will be re-extracted in full on every incremental run, which may produce duplicate records in downstream systems. Use snapshot mode for tag or raw OID traversal.`,
          });
        }
      }
    }

    // Build the candidate state from successfully resolved ref heads.
    const candidateState: ExtractionState = {
      version: 1,
      generatedAt: request.sessionTimestamp.toISOString(),
      repositoryPath: request.repositoryPath,
      branches: plans
        .filter((plan) => plan.isBranch)
        .map((plan): BranchState => ({ name: plan.name, lastCommitHash: plan.head })),
    };

    // -----------------------------------------------------------------------
    // 2. Extracting phase: per-branch extraction with coordinator-level dedup.
    // -----------------------------------------------------------------------
    reporter.emit({ type: "phase-start", phase: "extracting" });

    const allVisited = new Set<string>();
    let commitsTraversed = 0;
    let recordsWritten = 0;
    const refCount = plans.length;

    try {
      for (let i = 0; i < plans.length; i++) {
        const plan = plans[i]!;
        const refIndex = i;

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
            refIndex,
            refCount,
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
    // 3. Finalizing phase: persist state.
    // -----------------------------------------------------------------------
    reporter.emit({ type: "phase-start", phase: "finalizing" });

    if (stateStore !== undefined && candidateState.branches.length > 0) {
      await stateStore.write(candidateState);
    }

    reporter.emit({ type: "phase-end", phase: "finalizing" });

    return {
      recordsWritten,
      commitsTraversed,
      refs: plans.map((p) => p.name),
    };
  }
}
