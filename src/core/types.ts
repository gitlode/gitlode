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
  readonly commit: CommitFact;
  readonly file: {
    readonly path: string;
    readonly status: "added" | "modified" | "deleted";
    readonly additions: number | null;
    readonly deletions: number | null;
  };
}

export interface RotationConfig {
  readonly maxLines?: number;
  readonly maxBytes?: number;
}

export type ExtractionRange =
  | { readonly type: "ref"; readonly ref: CommitHash }
  | { readonly type: "date"; readonly since: Date };

export interface ExtractorConfig {
  readonly repositoryPath: string;
  readonly branches: readonly string[];
  readonly outputDir: string;
  readonly outputPrefix: string;
  readonly rotation: RotationConfig;
  readonly incremental: boolean;
  readonly missingState?: "error" | "snapshot";
  readonly range?: ExtractionRange;
  readonly stateFilePath?: string;
  readonly perFile: boolean;
}

export interface Reporter {
  warn(message: string): void;
  progress(recordsWritten: number): void;
  done(recordsWritten: number): void;
}

export interface CheckpointStore {
  read(): Promise<ExtractionCheckpoint | null>;
  write(state: ExtractionCheckpoint): Promise<void>;
}

export type WallClock = () => Date;
export type MonotonicClock = () => number;

export interface BranchCheckpoint {
  readonly name: string;
  readonly lastCommitHash: CommitHash;
}

export interface ExtractionCheckpoint {
  readonly version: 1;
  readonly generatedAt: string;
  readonly repositoryPath: string;
  readonly branches: readonly BranchCheckpoint[];
}

// Compatibility aliases — kept until Phase 4 cleanup
export type StateBranchEntry = BranchCheckpoint;
export type StateFile = ExtractionCheckpoint;
export type StateStore = CheckpointStore;

export interface ExtractionResult {
  readonly recordsWritten: number;
  readonly filesCreated: number;
  readonly bytesWritten: number;
  readonly elapsedMs: number;
  readonly branches: readonly string[];
}

// ---------------------------------------------------------------------------
// Phase 2 planning/traversal-stage contract
// ---------------------------------------------------------------------------

/** Resolved branch traversal boundary for one branch in a single run. */
export interface BranchTraversalPlan {
  readonly name: string;
  readonly head: CommitHash;
  readonly excludeHash: CommitHash | undefined;
}

/** Input to the BranchTraversalPlanner stage. */
export interface BranchTraversalPlanningRequest {
  /** Resolved absolute path to the repository. */
  readonly repositoryPath: string;
  /** Ordered list of branches to plan. */
  readonly branches: readonly string[];
  /** Extraction mode; controls whether priorBranchMap is used for exclude-hash selection. */
  readonly mode: "snapshot" | "incremental";
  /** Validated branch→lastCommitHash map loaded from a prior checkpoint.
   *  Empty in snapshot mode or when no prior checkpoint exists. */
  readonly priorBranchMap: ReadonlyMap<string, CommitHash>;
  /** Optional extraction range; controls exclusion-boundary selection. */
  readonly range?: ExtractionRange;
}

/** Core-owned interface for the branch-planning stage. */
export interface BranchTraversalPlanner {
  plan(
    request: BranchTraversalPlanningRequest,
    reporter: Reporter,
  ): Promise<readonly BranchTraversalPlan[]>;
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
  readonly plans: readonly BranchTraversalPlan[];
  /** Optional extraction range; controls commit filtering within each branch. */
  readonly range?: ExtractionRange;
}

/** Core-owned interface for the commit traversal stage. */
export interface CommitTraversalExtractor {
  extract(request: CommitTraversalRequest, reporter: Reporter): AsyncIterable<CommitFact>;
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
  readonly branches: readonly string[];
  /** Renamed from `outputMode`. */
  readonly granularity: "commit" | "file";
  readonly range?: ExtractionRange;
  /** Loaded and validated by `Extractor.loadPriorCheckpoint()`. */
  readonly priorCheckpoint: ExtractionCheckpoint;
  /** Wall-clock time at which the extraction session started. Used for checkpoint `generatedAt`. */
  readonly sessionTimestamp: Date;
}

export interface CoordinatorResult {
  readonly recordsWritten: number;
  /** Branches for which a head was successfully resolved (skipped branches are omitted). */
  readonly branches: readonly string[];
}

/** Constructor dependencies injected into `DefaultExtractionCoordinator`.
 *  Projector slots use inline structural types to avoid importing from projector
 *  files (those files import from the output layer, which would create a circular
 *  import through core/index.ts). */
export interface CoordinatorDependencies {
  readonly traversalPlanner: BranchTraversalPlanner;
  readonly traversalExtractor: CommitTraversalExtractor;
  readonly fileChangeExpander: FileChangeExpander;
  /** Accepts any projector whose `project()` returns `AsyncIterable<OutputRecord>`. */
  readonly commitProjector: {
    project(commits: AsyncIterable<CommitFact>): AsyncIterable<OutputRecord>;
  };
  /** Accepts any projector whose `project()` returns `AsyncIterable<OutputRecord>`. */
  readonly fileProjector: {
    project(fileChanges: AsyncIterable<FileChangeFact>): AsyncIterable<OutputRecord>;
  };
  readonly sink: OutputSink;
  readonly checkpointStore: CheckpointStore | undefined;
  readonly reporter: Reporter;
}
