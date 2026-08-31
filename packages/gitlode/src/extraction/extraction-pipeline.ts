import type {
  CommitFact,
  CoordinatorRequest,
  CoordinatorResult,
  ExtractionCoordinator,
  ExtractionCheckpoint,
  Fact,
  RefCheckpoint,
} from "@gitlode/internal-contracts/extraction";
import { getTelemetryAttributeMetadata } from "@gitlode/internal-contracts/telemetry";
import { withAsyncSpan } from "@gitlode/internal-foundation/otel-support";
import { atOrThrow } from "@gitlode/internal-foundation/support";
import { context, trace, type Context } from "@opentelemetry/api";

import { NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER } from "./extraction-pipeline-metric-recorder.js";
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
    const tracer = this.deps.tracer ?? trace.getTracer("gitlode.extraction");
    return await withAsyncSpan(
      tracer,
      "gitlode.extract",
      async (span) => {
        const extractContext = trace.setSpan(this.deps.parentContext ?? context.active(), span);
        span.setAttribute(
          getTelemetryAttributeMetadata("extraction_granularity").key,
          request.granularity,
        );
        span.setAttribute(
          getTelemetryAttributeMetadata("extraction_range_kind").key,
          request.range?.type ?? "none",
        );
        span.setAttribute(
          getTelemetryAttributeMetadata("requested_ref_count").key,
          request.refs.length,
        );
        let commitsTraversed = 0;
        let recordsWritten = 0;
        try {
          const result = await this.runExtraction(request, extractContext, (commits, records) => {
            commitsTraversed = commits;
            recordsWritten = records;
          });
          return result;
        } finally {
          span.setAttribute(
            getTelemetryAttributeMetadata("unique_commit_count").key,
            commitsTraversed,
          );
          span.setAttribute(
            getTelemetryAttributeMetadata("output_record_count").key,
            recordsWritten,
          );
          if (request.granularity === "file")
            span.setAttribute(
              getTelemetryAttributeMetadata("skipped_diff_count").key,
              this.deps.fileChangeExpander.skippedDiffCount,
            );
        }
      },
      undefined,
      this.deps.parentContext,
    );
  }

  private async runExtraction(
    request: CoordinatorRequest,
    extractContext: Context,
    updateCounts: (commits: number, records: number) => void,
  ): Promise<CoordinatorResult> {
    const {
      traversalPlanner,
      traversalExtractor,
      fileChangeExpander,
      projector,
      sink,
      progressReporter,
      diagnosticReporter,
    } = this.deps;
    const metricRecorder = this.deps.metricRecorder ?? NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER;

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
      extractContext,
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
          extractContext,
        );

        const dedupedStream = deduplicateCommits(rawStream, allVisited);
        const countedStream = wrapCommitCounter(dedupedStream, () => {
          commitsTraversed++;
          metricRecorder.recordCommitAccepted(request.granularity);
          updateCounts(commitsTraversed, recordsWritten);
        });

        const factStream: AsyncIterable<Fact> =
          request.granularity === "file"
            ? fileChangeExpander.expand(countedStream, request.repositoryPath)
            : countedStream;

        for await (const record of projector.project(factStream, extractContext)) {
          const writeToken = metricRecorder.startOutputWrite();
          try {
            await sink.write(record);
            metricRecorder.completeOutputWrite(writeToken, request.granularity, "success");
          } catch (error) {
            metricRecorder.completeOutputWrite(writeToken, request.granularity, "error");
            throw error;
          }
          recordsWritten++;
          updateCounts(commitsTraversed, recordsWritten);
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
      await withAsyncSpan(
        this.deps.tracer ?? trace.getTracer("gitlode.extraction"),
        "gitlode.output.close",
        async () => await sink.close(),
        undefined,
        extractContext,
      );
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
