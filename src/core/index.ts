export type {
  TraversalPlan,
  TraversalPlanner,
  TraversalPlanningRequest,
  CommitFact,
  CommitHash,
  CommitTraversalExtractor,
  CommitTraversalRequest,
  CoordinatorDependencies,
  CoordinatorRequest,
  CoordinatorResult,
  ExtractionCoordinator,
  ExtractionRange,
  ExtractionResult,
  ExtractionState,
  ExtractorConfig,
  Fact,
  FactProjector,
  FileChangeExpander,
  FileChangeFact,
  MonotonicClock,
  OutputSink,
  PersonIdentity,
  ProfilingEntry,
  ProgressEvent,
  ProgressPhase,
  ProgressReporter,
  BranchState,
  RotationConfig,
  StageProfiler,
  StateStore,
  WallClock,
} from "./types.js";
export { assertNever, isCommitHash } from "./types.js";
export { DefaultTraversalPlanner } from "./traversal-planner.js";
export { DefaultExtractionCoordinator } from "./extraction-coordinator.js";
export { DefaultCommitTraversalExtractor } from "./commit-traversal-extractor.js";
export { DefaultFileChangeExpander } from "./file-change-expander.js";
export { DefaultFactProjector } from "./fact-projector.js";
