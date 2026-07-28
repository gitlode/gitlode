export type { CommitFact, FileChangeFact } from "./facts.js";
export type {
  CoordinatorRequest,
  CoordinatorResult,
  ExtractionCoordinator,
  ExtractionState,
  RefCheckpoint,
} from "./extraction.js";
export type { ExtractionRange } from "./range.js";
export type {
  Fact,
  FactFor,
  FactType,
  ProjectedCommit,
  ProjectedExtensionValue,
  ProjectedExtensions,
  ProjectedFileChange,
  ProjectedRecord,
  ProjectedRecordFor,
} from "./records.js";
export type {
  CommitTraversalExtractor,
  CommitTraversalRequest,
  FactProjector,
  FileChangeExpander,
  OutputSink,
  TraversalPlan,
  TraversalPlanner,
  TraversalPlanningRequest,
} from "./stages.js";
