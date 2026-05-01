export type {
  BranchTraversalPlan,
  BranchTraversalPlanner,
  BranchTraversalPlanningRequest,
  BranchCheckpoint,
  CheckpointStore,
  CommitFact,
  CommitHash,
  CommitTraversalExtractor,
  CommitTraversalRequest,
  CoordinatorDependencies,
  CoordinatorRequest,
  CoordinatorResult,
  ExtractionCheckpoint,
  ExtractionRange,
  ExtractionResult,
  ExtractorConfig,
  FileChangeExpander,
  FileChangeFact,
  MonotonicClock,
  OutputSink,
  PersonIdentity,
  Reporter,
  RotationConfig,
  // Compatibility aliases (kept until Phase 4 cleanup)
  StateBranchEntry,
  StateFile,
  StateStore,
  WallClock,
} from "./types.js";
export { assertNever, isCommitHash } from "./types.js";
export { DefaultBranchTraversalPlanner } from "./branch-traversal-planner.js";
export { CommitRecordProjector, DefaultCommitRecordProjector } from "./commit-record-projector.js";
export { Extractor } from "./extractor.js";
export { ExtractionCoordinator, DefaultExtractionCoordinator } from "./extraction-coordinator.js";
export { DefaultCommitTraversalExtractor } from "./commit-traversal-extractor.js";
export { DefaultFileChangeExpander } from "./file-change-expander.js";
export {
  FileChangeRecordProjector,
  DefaultFileChangeRecordProjector,
} from "./file-change-record-projector.js";
