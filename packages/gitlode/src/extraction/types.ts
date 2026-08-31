import type { DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import type {
  CommitTraversalExtractor,
  CommitTraversalRequest,
  CommitFact,
  Fact,
  ProjectedRecord,
  FactProjector,
  FileChangeExpander,
  OutputSink,
  TraversalPlanner,
  TraversalPlanningRequest,
  TraversalPlan,
} from "@gitlode/internal-contracts/extraction";
import type { ProgressReporter } from "@gitlode/internal-contracts/progress";
import type { Context, Tracer } from "@opentelemetry/api";

import type { ExtractionPipelineMetricRecorder } from "./extraction-pipeline-metric-recorder.js";

/** Constructor dependencies injected into the extraction coordinator. */
export interface CoordinatorDependencies {
  readonly traversalPlanner: TraversalPlanner & {
    plan(
      request: TraversalPlanningRequest,
      diagnosticReporter: DiagnosticReporter,
      parentContext?: Context,
    ): Promise<readonly TraversalPlan[]>;
  };
  readonly traversalExtractor: CommitTraversalExtractor & {
    extract(
      request: CommitTraversalRequest,
      diagnosticReporter: DiagnosticReporter,
      parentContext?: Context,
    ): AsyncIterable<CommitFact>;
  };
  readonly fileChangeExpander: FileChangeExpander;
  /** Projector producing records accepted by the configured sink. */
  readonly projector: FactProjector & {
    project(facts: AsyncIterable<Fact>, parentContext?: Context): AsyncIterable<ProjectedRecord>;
  };
  readonly sink: OutputSink;
  readonly progressReporter: ProgressReporter;
  readonly diagnosticReporter: DiagnosticReporter;
  readonly tracer: Tracer;
  readonly parentContext?: Context;
  readonly metricRecorder: ExtractionPipelineMetricRecorder;
}
