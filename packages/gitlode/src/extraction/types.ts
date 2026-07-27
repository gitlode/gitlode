import type {
  CommitTraversalExtractor,
  FactProjector,
  FileChangeExpander,
  OutputSink,
  TraversalPlanner,
} from "../extraction-api/index.js";
import type { Instrumentation } from "../instrumentation/index.js";
import type { ProgressReporter } from "../progress/index.js";

/** Constructor dependencies injected into the extraction coordinator. */
export interface CoordinatorDependencies {
  readonly traversalPlanner: TraversalPlanner;
  readonly traversalExtractor: CommitTraversalExtractor;
  readonly fileChangeExpander: FileChangeExpander;
  /** Projector producing records accepted by the configured sink. */
  readonly projector: FactProjector;
  readonly sink: OutputSink;
  readonly reporter: ProgressReporter;
  /** Accumulates write spans across sink writes and close. */
  readonly instrumentation: Instrumentation;
}
