declare const _commitOidBrand: unique symbol;
export type CommitOid = string & { readonly [_commitOidBrand]: "CommitOid" };

export type OidProfile = "sha1" | "sha256";

const OID_PATTERN_BY_PROFILE: Readonly<Record<OidProfile, RegExp>> = {
  sha1: /^[0-9a-f]{40}$/,
  sha256: /^[0-9a-f]{64}$/,
};

export function isCommitOidForProfile(v: unknown, profile: OidProfile): v is CommitOid {
  return typeof v === "string" && OID_PATTERN_BY_PROFILE[profile].test(v);
}

export function isCommitOid(v: unknown): v is CommitOid {
  return isCommitOidForProfile(v, "sha1") || isCommitOidForProfile(v, "sha256");
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}

export interface PersonIdentity {
  readonly name: string;
  readonly email: string;
}

/** Core-owned intermediate representation of a single commit, output-format-agnostic. */
export interface CommitFact {
  readonly type: "commit";
  readonly oid: CommitOid;
  readonly message: string;
  readonly author: {
    readonly name: string;
    readonly email: string;
    readonly timestamp: number; // Unix seconds
    readonly timezoneOffset: number; // minutes from UTC (isomorphic-git convention: negated)
  };
  readonly committer: {
    readonly name: string;
    readonly email: string;
    readonly timestamp: number;
    readonly timezoneOffset: number;
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
  readonly subject: string;
  readonly body: string;
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
  | { readonly type: "ref"; readonly ref: CommitOid }
  | { readonly type: "date"; readonly since: Date };

export interface ExtractorConfig {
  readonly repositoryPath: string;
  readonly refs: readonly string[];
  readonly outputDir: string;
  readonly outputPrefix: string;
  readonly rotation: RotationConfig;
  readonly incremental: boolean;
  readonly missingState?: "error" | "snapshot";
  readonly range?: ExtractionRange;
  readonly stateFilePath?: string;
  readonly perFile: boolean;
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

export type WallClock = () => Date;
export type MonotonicClock = () => number;

export const REF_TYPES = ["branch", "tag-lightweight", "tag-annotated", "commit-oid"] as const;

export type RefType = (typeof REF_TYPES)[number];

export interface RefCheckpoint {
  readonly ref: string;
  readonly refType: RefType;
  readonly tipOid: CommitOid;
  readonly updatedAt: string;
}

export interface ExtractionState {
  readonly version: 2;
  readonly generatedAt: string;
  readonly repositoryPath: string;
  readonly refs: readonly RefCheckpoint[];
}

// Compatibility aliases removed in Phase 7 cleanup

/** A single timing measurement produced by a {@link StageProfiler}. */
export interface ProfilingEntry {
  /** Full slash-separated path from the root, e.g. `"elapsed/traversal"`. */
  readonly name: string;
  /** Wall-clock duration in milliseconds (parallel overlap counted once). */
  readonly wallMs: number;
  /** Additive work duration in milliseconds (parallel overlap counted per interval). */
  readonly workMs: number;
}

/**
 * A named, accumulating timer that supports hierarchical scoping.
 *
 * ## Lifecycle
 * - `start()`: Resets wall/work durations to 0 and begins wall timing. No-op if already running.
 * - `resume()`: Begins accumulating without resetting. No-op if already running.
 * - `stop()`: Pauses accumulation. No-op if not running.
 * - `measureWork(fn)`: Measures one work interval and adds it to additive work time.
 * - `entries()`: Returns a snapshot of this profiler and all descendants in preorder.
 *   If called while running, includes elapsed time up to the current moment.
 *
 * ## Tree structure
 * Each profiler may have child profilers created via `createScopedProfiler()`.
 * Parent and child durations are completely independent: a parent's times are
 * determined solely by its own `start/resume/stop` calls, not by its children.
 * Siblings are ordered by creation order.
 *
 * ## Concurrency
 * Sharing a single profiler instance across concurrent async operations is not
 * recommended. Unexpected interleaving of `resume/stop` calls may produce inaccurate
 * measurements, but will not throw exceptions or affect the main extraction process.
 * Wall-clock timing is reference-count based so overlapping intervals are counted once.
 * Additive work timing should be recorded via `measureWork(...)`.
 *
 * ## Error tolerance
 * All methods are designed to be safe to call in any order. Unexpected call sequences
 * (e.g., `stop()` when not running) are silently treated as no-ops.
 */
export interface StageProfiler {
  /** The local name segment of this profiler (not the full path). */
  readonly name: string;
  /** Resets accumulated duration to 0 and begins timing. No-op if already running. */
  start(): void;
  /** Resumes timing without resetting accumulated duration. No-op if already running. */
  resume(): void;
  /** Pauses timing and adds elapsed duration to the accumulator. No-op if not running. */
  stop(): void;
  /**
   * Measures execution time of `fn` and adds it to additive work duration.
   * Works with both sync and async functions.
   */
  measureWork<T>(fn: () => T): T;
  /**
   * Creates and registers a new child profiler with the given name.
   * The child's full path in `entries()` is `parent_path/child_name`.
   * Children are listed in creation order in `entries()`.
   * If `name` contains `/`, it is escaped as `//` in the full path.
   */
  createScopedProfiler(name: string): StageProfiler;
  /**
   * Returns profiling entries for this profiler and all descendants in preorder
   * (self first, then each child's subtree in creation order).
   * Each entry's `name` is the full slash-separated path from the root.
   * If this profiler is currently running, `wallMs` includes time up to now.
   */
  entries(): readonly ProfilingEntry[];
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
  readonly remoteUrl: string | null;
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
  readonly repositoryPath: string;
  readonly repoName: string;
  readonly remoteUrl: string | null;
  readonly refs: readonly string[];
  /** Renamed from `outputMode`. */
  readonly granularity: "commit" | "file";
  readonly range?: ExtractionRange;
  /** Loaded and validated by `Extractor.loadPriorState()`. */
  readonly priorState: ExtractionState;
  /** Wall-clock time at which the extraction session started. Used for checkpoint `generatedAt`. */
  readonly sessionTimestamp: Date;
}

export interface CoordinatorResult {
  readonly recordsWritten: number;
  readonly commitsTraversed: number;
  /** Refs for which a head was successfully resolved (skipped refs are omitted). */
  readonly refs: readonly string[];
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

export type PluginFailurePolicy = "skip-fact" | "fatal";

export type PluginInitResult = { type: "ready" } | { type: "fatal"; message: string };

/**
 * The value a plugin may return as `success.data`. Scalars (`string`, `number`,
 * `boolean`) and plain objects are allowed. `null` is excluded — return
 * `{ type: "skip" }` to signal no data for a fact.
 */
export type PluginProjectionValue = string | number | boolean | Readonly<Record<string, unknown>>;

export type PluginProjectionResult =
  | { type: "success"; data: PluginProjectionValue }
  | { type: "skip"; message: string }
  | { type: "fatal"; message: string };

type ProjectionContextFor<Type extends FactType> = {
  readonly fact: FactFor<Type>;
  readonly baseRecord: Readonly<ProjectedRecordFor<Type>>;
};

/** Read-only snapshot of the projected base record; passed to plugins for enrichment context. */
export type ProjectionContext = {
  [Type in FactType]: ProjectionContextFor<Type>;
}[FactType];

/** Contract that every projector plugin must satisfy. */
export interface ProjectorPlugin {
  init?(): Promise<PluginInitResult>;
  project(context: ProjectionContext, profiler?: StageProfiler): Promise<PluginProjectionResult>;
}

/** Module default-export signature for plugin factory functions. ESM only. */
export type PluginFactory = (config: unknown) => ProjectorPlugin | Promise<ProjectorPlugin>;

/** Validated plugin namespace string — must match /^[a-z0-9-]+$/. */
export type Namespace = string & { readonly __brand: "Namespace" };

/** Runtime registry record for a loaded, initialized plugin. */
export interface PluginEntry {
  readonly namespace: Namespace;
  readonly plugin: ProjectorPlugin;
  readonly failurePolicy: PluginFailurePolicy;
  readonly profiler?: StageProfiler;
}

/** Constructor dependencies injected into `DefaultExtractionCoordinator`. */
export interface CoordinatorDependencies {
  readonly traversalPlanner: TraversalPlanner;
  readonly traversalExtractor: CommitTraversalExtractor;
  readonly fileChangeExpander: FileChangeExpander;
  /** Accepts any projector whose `project()` returns `AsyncIterable<ProjectedRecord>`. */
  readonly projector: FactProjector;
  readonly sink: OutputSink;
  readonly stateStore: StateStore | undefined;
  readonly reporter: ProgressReporter;
  /** Optional profiler for accumulating writeMs across sink.write() and sink.close() calls. */
  readonly profiler?: StageProfiler;
}
