declare const _commitHashBrand: unique symbol;
export type CommitHash = string & { readonly [_commitHashBrand]: "CommitHash" };

export function isCommitHash(v: unknown): v is CommitHash {
  return typeof v === "string" && /^[0-9a-f]{40}$/.test(v);
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
  readonly oid: string;
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
  readonly parents: readonly string[];
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

export type Fact = CommitFact | FileChangeFact;

export interface RotationConfig {
  readonly maxLines?: number;
  readonly maxBytes?: number;
}

export type ExtractionRange =
  | { readonly type: "ref"; readonly ref: CommitHash }
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
}

export type ProgressPhase = "preparing" | "extracting" | "finalizing";

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

export interface BranchState {
  readonly name: string;
  readonly lastCommitHash: CommitHash;
}

export interface ExtractionState {
  readonly version: 1;
  readonly generatedAt: string;
  readonly repositoryPath: string;
  readonly branches: readonly BranchState[];
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
}

// ---------------------------------------------------------------------------
// Phase 2 planning/traversal-stage contract
// ---------------------------------------------------------------------------

/** Resolved branch traversal boundary for one branch in a single run. */
export interface TraversalPlan {
  readonly name: string;
  readonly head: CommitHash;
  readonly excludeHash: CommitHash | undefined;
  /** True when the ref is a branch (exists under refs/heads/). False for tags and raw OIDs. */
  readonly isBranch: boolean;
}

/** Input to the TraversalPlanner stage. */
export interface TraversalPlanningRequest {
  /** Resolved absolute path to the repository. */
  readonly repositoryPath: string;
  /** Ordered list of refs to plan. */
  readonly refs: readonly string[];
  /** Extraction mode; controls whether priorRefMap is used for exclude-hash selection. */
  readonly mode: "snapshot" | "incremental";
  /** Validated ref→lastCommitHash map loaded from a prior checkpoint.
   *  Empty in snapshot mode or when no prior checkpoint exists. */
  readonly priorRefMap: ReadonlyMap<string, CommitHash>;
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
}

// ---------------------------------------------------------------------------
// Phase 4 coordinator / sink contract
// ---------------------------------------------------------------------------

// OutputRecord is imported here (type-only) to define OutputSink and CoordinatorDeps.
// The circular path core/types.ts → output/types.ts → core/index.ts → core/types.ts
// is type-only in both directions; TypeScript resolves it without issues.
import type { OutputRecord } from "../output/types.js";

/** Core-owned interface for output sink. Wraps the output layer's write/close contract. */
export interface OutputSink {
  write(record: OutputRecord): Promise<void>;
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
}

/** Core-owned interface for the fact projection stage. */
export interface FactProjector {
  project(facts: AsyncIterable<Fact>): AsyncIterable<OutputRecord>;
}

/** Core-owned interface for the extraction orchestration stage. */
export interface ExtractionCoordinator {
  run(request: CoordinatorRequest): Promise<CoordinatorResult>;
}

/** Constructor dependencies injected into `DefaultExtractionCoordinator`. */
export interface CoordinatorDependencies {
  readonly traversalPlanner: TraversalPlanner;
  readonly traversalExtractor: CommitTraversalExtractor;
  readonly fileChangeExpander: FileChangeExpander;
  /** Accepts any projector whose `project()` returns `AsyncIterable<OutputRecord>`. */
  readonly projector: FactProjector;
  readonly sink: OutputSink;
  readonly stateStore: StateStore | undefined;
  readonly reporter: ProgressReporter;
  /** Optional profiler for accumulating writeMs across sink.write() and sink.close() calls. */
  readonly profiler?: StageProfiler;
}
