export { RepositoryTraversalPlanner } from "./repository-traversal-planner.js";
export { ExtractionPipeline } from "./extraction-pipeline.js";
export { CommitFactExtractor } from "./commit-fact-extractor.js";
export { FileChangeFactExpander } from "./file-change-fact-expander.js";
export { BuiltInFactProjector } from "./built-in-fact-projector.js";
export {
  createExtractionPipelineMetricRecorder,
  NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER,
  type ExtractionPipelineMetricRecorder,
  type ExtractionGranularity,
  type OutputWriteOutcome,
} from "./extraction-pipeline-metric-recorder.js";
export {
  createFileChangeFactExpanderMetricRecorder,
  NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER,
  type FileChangeFactExpanderMetricRecorder,
  type FileChangeType,
  type FileChangeExpansionOutcome,
  type DiffSkipReason,
} from "./file-change-fact-expander-metric-recorder.js";
export {
  createBuiltInFactProjectorMetricRecorder,
  NOOP_BUILT_IN_FACT_PROJECTOR_METRIC_RECORDER,
  type BuiltInFactProjectorMetricRecorder,
  type ProjectionFactType,
  type ProjectionOutcome,
} from "./built-in-fact-projector-metric-recorder.js";
