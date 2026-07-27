export type {
  CoordinatorDependencies,
  DiagnosticReporter,
  Namespace,
  PluginEntry,
  PluginFactory,
  PluginFailurePolicy,
  PluginInitSuccess,
  PluginInitFatal,
  PluginInitResult,
  PluginProjectionResult,
  PluginProjectionValue,
  PluginRuntimeContext,
  ProjectionContext,
  ProjectorPlugin,
} from "./types.js";
export { DefaultTraversalPlanner } from "./traversal-planner.js";
export { DefaultExtractionCoordinator } from "./extraction-coordinator.js";
export { DefaultCommitTraversalExtractor } from "./commit-traversal-extractor.js";
export { DefaultFileChangeExpander } from "./file-change-expander.js";
export { DefaultFactProjector, projectCommit, projectFileChange } from "./fact-projector.js";
export { EnrichingFactProjector } from "./enriching-fact-projector.js";
