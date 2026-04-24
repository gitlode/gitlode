export type {
  BranchCheckpoint,
  CheckpointStore,
  CommitFact,
  CommitHash,
  CommitTraversalExtractor,
  CommitTraversalRequest,
  CommitTraversalResult,
  ExtractionCheckpoint,
  ExtractionRange,
  ExtractionResult,
  ExtractorConfig,
  FileChangeFact,
  MonotonicClock,
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
export { Extractor } from "./extractor.js";
export { DefaultCommitTraversalExtractor } from "./commit-traversal-extractor.js";
