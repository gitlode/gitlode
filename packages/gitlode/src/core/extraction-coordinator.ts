import { withProfilerAsync } from "./profile/index.js";
import type {
  CommitFact,
  CoordinatorDependencies,
  CoordinatorRequest,
  CoordinatorResult,
  ExtractionCoordinator,
  ExtractionState,
  Fact,
  RefCheckpoint,
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

    const priorRefs = request.priorState.refs;

    const plans = await traversalPlanner.plan(
      {
        repositoryPath: request.repositoryPath,
        refs: [...request.refs],
        mode: priorRefs.length > 0 ? "incremental" : "snapshot",
        priorRefs,
        range: request.range,
      },
      reporter,
    );

    reporter.emit({ type: "phase-end", phase: "preparing" });

    // Static refs (non-branch) are tracked in v2 state, but they usually produce no
    // incremental delta unless the ref target itself changes between runs.
    if (stateStore !== undefined) {
      for (const plan of plans) {
        if (plan.refType !== "branch") {
          reporter.emit({
            type: "warning",
            message: `Warning: Ref "${plan.name}" (${plan.refType}) is tracked in state, but future incremental runs usually produce no new records unless the ref target changes.`,
          });
        }
      }
    }

    // Build the candidate state from successfully resolved ref heads.
    const candidateState: ExtractionState = {
      version: 2,
      generatedAt: request.sessionTimestamp.toISOString(),
      repositoryPath: request.repositoryPath,
      refs: plans.map(
        (plan): RefCheckpoint => ({
          ref: plan.name,
          refType: plan.refType,
          tipOid: plan.head,
          updatedAt: request.sessionTimestamp.toISOString(),
        }),
      ),
    };

    // -----------------------------------------------------------------------
    // 2. Extracting phase: per-branch extraction with coordinator-level dedupe.
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
            repoUrl: request.repoUrl,
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

    if (stateStore !== undefined && candidateState.refs.length > 0) {
      await stateStore.write(candidateState);
    }

    reporter.emit({ type: "phase-end", phase: "finalizing" });

    return {
      recordsWritten,
      commitsTraversed,
      refs: plans.map((p) => p.name),
      skippedDiffs: request.granularity === "file" ? fileChangeExpander.skippedDiffCount : 0,
    };
  }
}
