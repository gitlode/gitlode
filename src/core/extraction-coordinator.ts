import type {
  BranchCheckpoint,
  CoordinatorDependencies,
  CoordinatorRequest,
  CoordinatorResult,
  ExtractionCheckpoint,
} from "./types.js";

/** Core-owned interface for the extraction orchestration stage. */
export interface ExtractionCoordinator {
  run(request: CoordinatorRequest): Promise<CoordinatorResult>;
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
      commitProjector,
      fileProjector,
      sink,
      checkpointStore,
      reporter,
    } = this.deps;

    // -----------------------------------------------------------------------
    // 1. Plan branch traversal boundaries.
    // -----------------------------------------------------------------------
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
    // 2. Extract commit facts from all branches.
    // -----------------------------------------------------------------------
    const commitFacts = traversalExtractor.extract(
      {
        repositoryPath: request.repositoryPath,
        repoName: request.repoName,
        remoteUrl: request.remoteUrl,
        plans,
        range: request.range,
      },
      reporter,
    );

    // -----------------------------------------------------------------------
    // 3. Select the output pipeline once, before entering the write loop.
    // -----------------------------------------------------------------------
    const recordStream =
      request.granularity === "file"
        ? fileProjector.project(fileChangeExpander.expand(commitFacts, request.repositoryPath))
        : commitProjector.project(commitFacts);

    // -----------------------------------------------------------------------
    // 4. Write loop: advance progress only after a successful write.
    // -----------------------------------------------------------------------
    let recordsWritten = 0;
    try {
      for await (const record of recordStream) {
        await sink.write(record);
        recordsWritten++;
        reporter.progress(recordsWritten);
      }
    } finally {
      reporter.done(recordsWritten);
      await sink.close();
    }

    // -----------------------------------------------------------------------
    // 5. Persist checkpoint — only reached when the pipeline completed without
    //    exception AND sink.close() succeeded.
    // -----------------------------------------------------------------------
    if (checkpointStore !== undefined && candidateCheckpoint.branches.length > 0) {
      await checkpointStore.write(candidateCheckpoint);
    }

    return {
      recordsWritten,
      branches: candidateCheckpoint.branches.map((b) => b.name),
    };
  }
}
