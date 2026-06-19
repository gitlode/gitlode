import type { CommitOid, PersonIdentity, RefType } from "../model/index.js";
import type { ProfilingEntry, StageProfiler } from "../profile/type.js";
import type { AbsolutePath } from "../support/index.js";
import type { Brand } from "../type-utils/index.js";

/** Core-owned intermediate representation of a single commit, output-format-agnostic. */
export interface CommitFact {
  readonly type: "commit";
  readonly oid: CommitOid;
  readonly message: string;
  readonly author: {
    readonly name: string;
    readonly email: string;
    readonly timestamp: number; // Unix seconds
    readonly timezoneOffset: number; // standard UTC offset minutes: JST = +540, PST = -480
  };
  readonly committer: {
    readonly name: string;
    readonly email: string;
    readonly timestamp: number;
    readonly timezoneOffset: number; // standard UTC offset minutes: JST = +540, PST = -480
  };
  readonly parents: readonly CommitOid[];
  readonly repository: {
    readonly name: string;
    readonly url: string | null;
  };
}

/** Core-owned intermediate representation of a single file change within a commit. */
export interface FileChangeFact {
  readonly type: "file-change";
  readonly commit: CommitFact;
  readonly file: {
    readonly path: string;
    readonly status: "added" | "modified" | "deleted";
    readonly additions: number | null;
    readonly deletions: number | null;
  };
}

// ---------------------------------------------------------------------------
// Projected record types
//
// These describe the shape produced by the `FactProjector` stage. They are
// the values flowing through `OutputSink.write()` and passed to plugins as
// `ProjectionContext.baseRecord`. The output layer serializes them as-is
// (1:1 JSONL projection) and does not redefine the shape.
// ---------------------------------------------------------------------------

export interface ProjectedPerson extends PersonIdentity {
  readonly timestamp: string; // ISO 8601 with commit's own timezone offset
}

export interface ProjectedRepository {
  readonly name: string;
  readonly url: string | null;
}

/**
 * The value written under an extension namespace key in a projected record.
 * `null` is core-reserved and means skip or fatal-with-skip-fact; plugins
 * cannot produce it directly — they return `{ type: "skip" }` instead.
 */
export type ProjectedExtensionValue = PluginProjectionValue | null;

export interface ProjectedExtensions {
  [namespace: string]: ProjectedExtensionValue;
}

export interface ProjectedCommit {
  readonly oid: string;
  readonly message: string;
  readonly author: ProjectedPerson;
  readonly committer: ProjectedPerson;
  readonly parents: readonly string[];
  readonly repository: ProjectedRepository;
  readonly extensions?: ProjectedExtensions;
}

export interface ProjectedFileChange extends ProjectedCommit {
  readonly file: {
    readonly path: string;
    readonly status: "added" | "modified" | "deleted";
    readonly additions: number | null;
    readonly deletions: number | null;
  };
}

// ---------------------------------------------------------------------------
// Fact / ProjectedRecord pairing — single source of truth.
//
// Each FactType maps to both its raw fact shape and the projected record
// shape produced from it. `FactFor<T>` and `ProjectedRecordFor<T>` are
// derived from this map so the pair invariant cannot drift.
// ---------------------------------------------------------------------------

interface FactPairMap {
  commit: { readonly fact: CommitFact; readonly record: ProjectedCommit };
  "file-change": { readonly fact: FileChangeFact; readonly record: ProjectedFileChange };
}

export type FactType = keyof FactPairMap;

export type FactFor<Type extends FactType> = FactPairMap[Type]["fact"];

export type Fact = FactFor<FactType>;

export type ProjectedRecordFor<Type extends FactType> = FactPairMap[Type]["record"];

export type ProjectedRecord = ProjectedRecordFor<FactType>;

export interface RotationConfig {
  readonly maxLines?: number;
  readonly maxBytes?: number;
}

export type ExtractionRange =
  | { readonly type: "ref"; readonly since: CommitOid }
  | { readonly type: "date"; readonly since: Date };

export interface ExtractorConfig {
  readonly refs: readonly string[];
  readonly outputDir: AbsolutePath;
  readonly outputPrefix: string;
  readonly rotation: RotationConfig;
  readonly range?: ExtractionRange;
  readonly granularity: "commit" | "file";
  readonly maxDiffSize?: number;
}

export type ProgressPhase = "initializing-plugins" | "preparing" | "extracting" | "finalizing";

export type ProgressEvent =
  | { readonly type: "phase-start"; readonly phase: ProgressPhase }
  | {
      readonly type: "extracting-progress";
      readonly phase: "extracting";
      readonly refIndex: number;
      readonly refCount: number;
      readonly commitsTraversed: number;
      readonly recordsWritten: number;
      readonly bytesWritten: number;
    }
  | { readonly type: "phase-end"; readonly phase: ProgressPhase }
  | { readonly type: "warning"; readonly message: string };

export interface ProgressReporter {
  emit(event: ProgressEvent): void;
}

export interface StateStore {
  read(): Promise<ExtractionState | null>;
  write(state: ExtractionState): Promise<void>;
}

export interface RefCheckpoint {
  readonly ref: string;
  readonly refType: RefType;
  readonly tipOid: CommitOid;
  readonly updatedAt: string;
}

export interface ExtractionState {
  readonly version: 2;
  readonly generatedAt: string;
  readonly repositoryPath: AbsolutePath;
  readonly refs: readonly RefCheckpoint[];
}

export interface ExtractionResult {
  readonly recordsWritten: number;
  readonly filesCreated: number;
  readonly bytesWritten: number;
  readonly refs: readonly string[];
  /**
   * Profiling entries from the root profiler, in preorder.
   * The first entry is always the root (e.g. `"elapsed"`) and represents total run duration.
   * Populated on every successful run.
   */
  readonly profilingEntries: readonly ProfilingEntry[];
  /** Number of file diffs skipped due to size threshold (--max-diff-size). */
  readonly skippedDiffs: number;
}

// ---------------------------------------------------------------------------
// Phase 2 planning/traversal-stage contract
// ---------------------------------------------------------------------------

/** Resolved branch traversal boundary for one branch in a single run. */
export interface TraversalPlan {
  readonly name: string;
  readonly refType: RefType;
  readonly head: CommitOid;
  readonly excludeHash: CommitOid | undefined;
}

/** Input to the TraversalPlanner stage. */
export interface TraversalPlanningRequest {
  /** Resolved absolute path to the repository. */
  readonly repositoryPath: string;
  /** Ordered list of refs to plan. */
  readonly refs: readonly string[];
  /** Extraction mode; controls whether prior ref checkpoints are used for exclude-hash selection. */
  readonly mode: "snapshot" | "incremental";
  /** Validated ref checkpoints loaded from a prior state file.
   *  Empty in snapshot mode or when no prior checkpoint exists. */
  readonly priorRefs: readonly RefCheckpoint[];
  /** Optional extraction range; controls exclusion-boundary selection. */
  readonly range?: ExtractionRange;
}

/** Core-owned interface for the traversal-planning stage. */
export interface TraversalPlanner {
  plan(
    request: TraversalPlanningRequest,
    reporter: ProgressReporter,
  ): Promise<readonly TraversalPlan[]>;
}

/** Input to the CommitTraversalExtractor stage. */
export interface CommitTraversalRequest {
  /** Resolved absolute path to the repository. */
  readonly repositoryPath: string;
  /** Repository display name (derived from remote URL or directory name). */
  readonly repoName: string;
  /** Remote origin URL, or null if unavailable. */
  readonly repoUrl: string | null;
  /** Ordered list of per-branch traversal plans. */
  readonly plans: readonly TraversalPlan[];
  /** Optional extraction range; controls commit filtering within each branch. */
  readonly range?: ExtractionRange;
}

/** Core-owned interface for the commit traversal stage. */
export interface CommitTraversalExtractor {
  extract(request: CommitTraversalRequest, reporter: ProgressReporter): AsyncIterable<CommitFact>;
}

// ---------------------------------------------------------------------------
// Phase 3 expansion stage contract
// ---------------------------------------------------------------------------

/** Core-owned interface for the file-change expansion stage. */
export interface FileChangeExpander {
  expand(commits: AsyncIterable<CommitFact>, repositoryPath: string): AsyncIterable<FileChangeFact>;
  /** Get the count of file diffs skipped due to size threshold. */
  readonly skippedDiffCount: number;
}

// ---------------------------------------------------------------------------
// Phase 4 coordinator / sink contract
// ---------------------------------------------------------------------------

/** Core-owned interface for output sink. Wraps the output layer's write/close contract. */
export interface OutputSink {
  write(record: ProjectedRecord): Promise<void>;
  close(): Promise<void>;
  readonly filesCreated: number;
  readonly bytesWritten: number;
}

/** Core-preferred request type passed to the coordinator. Field names are
 *  Core-vocabulary terms, not CLI-facing names. `Extractor` translates
 *  `ExtractorConfig` into `CoordinatorRequest` before calling the coordinator. */
export interface CoordinatorRequest {
  readonly repositoryPath: AbsolutePath;
  readonly repoName: string;
  readonly repoUrl: string | null;
  readonly refs: readonly string[];
  readonly granularity: "commit" | "file";
  readonly range?: ExtractionRange;
  readonly priorState: ExtractionState;
  /** Wall-clock time at which the extraction session started.*/
  readonly sessionTimestamp: Date;
}

export interface CoordinatorResult {
  readonly recordsWritten: number;
  readonly commitsTraversed: number;
  /** Refs for which a head was successfully resolved (skipped refs are omitted). */
  readonly refs: readonly string[];
  /** Checkpoint state produced after successful output completion and sink close. */
  readonly state: ExtractionState;
  /** Number of file diffs skipped due to size threshold (--max-diff-size). */
  readonly skippedDiffs: number;
}

/** Core-owned interface for the fact projection stage. */
export interface FactProjector {
  project(facts: AsyncIterable<Fact>): AsyncIterable<ProjectedRecord>;
}

/** Core-owned interface for the extraction orchestration stage. */
export interface ExtractionCoordinator {
  run(request: CoordinatorRequest): Promise<CoordinatorResult>;
}

// ---------------------------------------------------------------------------
// Plugin contract types
// ---------------------------------------------------------------------------

export interface DiagnosticReporter {
  warn(message: string): void;
  error(message: string): void;
}

export type PluginFailurePolicy = "skip-fact" | "fatal";

export type PluginInitSuccess = { type: "ready" };

export type PluginInitFatal = { type: "fatal" };

export type PluginInitResult = PluginInitSuccess | PluginInitFatal;

/**
 * The value a plugin may return as `success.data`. Scalars (`string`, `number`,
 * `boolean`) and plain objects are allowed. `null` is excluded — return
 * `{ type: "skip" }` to signal no data for a fact.
 */
export type PluginProjectionValue = string | number | boolean | Readonly<Record<string, unknown>>;

export type PluginProjectionResult =
  | { type: "success"; data: PluginProjectionValue }
  | { type: "skip" }
  | { type: "fatal" };

type ProjectionContextFor<Type extends FactType> = {
  readonly fact: FactFor<Type>;
  readonly baseRecord: Readonly<ProjectedRecordFor<Type>>;
};

/** Read-only snapshot of the projected base record; passed to plugins for enrichment context. */
export type ProjectionContext = {
  [Type in FactType]: ProjectionContextFor<Type>;
}[FactType];

export interface PluginRuntimeContext extends DiagnosticReporter {
  readonly profiler?: StageProfiler;
}

/** Contract that every projector plugin must satisfy. */
export interface ProjectorPlugin {
  init(runtime: PluginRuntimeContext): Promise<PluginInitResult>;
  project(context: ProjectionContext): Promise<PluginProjectionResult>;
}

/** Module default-export signature for plugin factory functions. ESM only. */
export type PluginFactory = (config: unknown) => ProjectorPlugin | Promise<ProjectorPlugin>;

/** Validated plugin namespace string — must match /^[a-z0-9-]+$/. */
export type Namespace = Brand<string, "Namespace">;

/** Runtime registry record for a loaded, initialized plugin. */
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
  /** Accepts any projector whose `project()` returns `AsyncIterable<ProjectedRecord>`. */
  readonly projector: FactProjector;
  readonly sink: OutputSink;
  readonly reporter: ProgressReporter;
  /** Optional profiler for accumulating writeMs across sink.write() and sink.close() calls. */
  readonly profiler?: StageProfiler;
}
