import type { DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import type {
  CommitTraversalExtractor,
  FactProjector,
  FileChangeExpander,
  OutputSink,
  TraversalPlanner,
} from "@gitlode/internal-contracts/extraction";
import type { ProgressReporter } from "@gitlode/internal-contracts/progress";
import type { Instrumentation } from "@gitlode/internal-foundation/instrumentation";

/** Constructor dependencies injected into the extraction coordinator. */
export interface CoordinatorDependencies {
  readonly traversalPlanner: TraversalPlanner;
  readonly traversalExtractor: CommitTraversalExtractor;
  readonly fileChangeExpander: FileChangeExpander;
  /** Projector producing records accepted by the configured sink. */
  readonly projector: FactProjector;
  readonly sink: OutputSink;
  readonly progressReporter: ProgressReporter;
  readonly diagnosticReporter: DiagnosticReporter;
  /** Accumulates write spans across sink writes and close. */
  readonly instrumentation: Instrumentation;
}
