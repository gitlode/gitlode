import type {
  CommitTraversalExtractor,
  FactProjector,
  FileChangeExpander,
  OutputSink,
  TraversalPlanner,
} from "../extraction-api/index.js";
import type { Instrumentation } from "../instrumentation/index.js";
import type { Namespace, PluginFailurePolicy, ProjectorPlugin } from "../plugin-api/index.js";
import type { ProgressReporter } from "../progress/index.js";

/** Runtime registry entry for a loaded and initialized plugin. */
export interface PluginEntry {
  readonly namespace: Namespace;
  readonly plugin: ProjectorPlugin;
  readonly failurePolicy: PluginFailurePolicy;
}

/** Constructor dependencies injected into `DefaultExtractionCoordinator`. */
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
