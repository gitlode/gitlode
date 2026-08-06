import type {
  CommitFact,
  CoordinatorRequest,
  CoordinatorResult,
  ExtractionCoordinator,
  ExtractionCheckpoint,
  Fact,
  RefCheckpoint,
} from "@gitlode/internal-contracts/extraction";
import type { Instrumentation } from "@gitlode/internal-foundation/instrumentation";
import { atOrThrow } from "@gitlode/internal-foundation/support";

import type { CoordinatorDependencies } from "./types.js";

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

export class ExtractionPipeline implements ExtractionCoordinator {
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
      progressReporter,
      diagnosticReporter,
    } = this.deps;
    const instrumentation: Instrumentation = this.deps.instrumentation;

    // -----------------------------------------------------------------------
    // 1. Preparing phase: plan branch traversal boundaries.
    // -----------------------------------------------------------------------
    progressReporter.emit({ type: "phase-start", phase: "preparing" });

    const priorRefs = request.priorCheckpoint.refs;

    const plans = await traversalPlanner.plan(
      {
        repositoryPath: request.repositoryPath,
        refs: [...request.refs],
        mode: priorRefs.length > 0 ? "incremental" : "snapshot",
        priorRefs,
        range: request.range,
      },
      diagnosticReporter,
    );

    progressReporter.emit({ type: "phase-end", phase: "preparing" });

    // Static refs (non-branch) are tracked in the checkpoint, but they usually produce no
    // incremental delta unless the ref target itself changes between runs.
    for (const plan of plans) {
      if (plan.refType !== "branch") {
        diagnosticReporter.report({
          severity: "warn",
          message: `Warning: Ref "${plan.name}" (${plan.refType}) is included in checkpoint state, but future incremental runs usually produce no new records unless the ref target changes.`,
        });
      }
    }

    // Build the candidate checkpoint from successfully resolved ref heads.
    const candidateCheckpoint: ExtractionCheckpoint = {
      generatedAt: request.sessionTimestamp.toISOString(),
      repositoryPath: request.repositoryPath,
      refs: plans.map((plan): RefCheckpoint => ({
        ref: plan.name,
        refType: plan.refType,
        tipOid: plan.head,
        updatedAt: request.sessionTimestamp.toISOString(),
      })),
    };

    // -----------------------------------------------------------------------
    // 2. Extracting phase: per-branch extraction with coordinator-level dedupe.
    // -----------------------------------------------------------------------
    progressReporter.emit({ type: "phase-start", phase: "extracting" });

    const allVisited = new Set<string>();
    let commitsTraversed = 0;
    let recordsWritten = 0;
    const refCount = plans.length;

    try {
      for (let i = 0; i < plans.length; i++) {
        const plan = atOrThrow(plans, i);
        const refIndex = i;

        const rawStream = traversalExtractor.extract(
          {
            repositoryPath: request.repositoryPath,
            repoName: request.repoName,
            repoUrl: request.repoUrl,
            plans: [plan],
            range: request.range,
          },
          diagnosticReporter,
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
          await instrumentation.runAsync(
            "gitlode.output.write",
            async () => await sink.write(record),
          );
          recordsWritten++;
          progressReporter.emit({
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
      await instrumentation.runAsync("gitlode.output.close", async () => await sink.close());
    }

    progressReporter.emit({ type: "phase-end", phase: "extracting" });

    // -----------------------------------------------------------------------
    // 3. Finalizing phase: complete the checkpoint.
    // -----------------------------------------------------------------------
    progressReporter.emit({ type: "phase-start", phase: "finalizing" });

    progressReporter.emit({ type: "phase-end", phase: "finalizing" });

    return {
      recordsWritten,
      commitsTraversed,
      refs: plans.map((p) => p.name),
      checkpoint: candidateCheckpoint,
      skippedDiffs: request.granularity === "file" ? fileChangeExpander.skippedDiffCount : 0,
    };
  }
}
