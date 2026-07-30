import type { DiagnosticReporter } from "../diagnostics/index.js";
import type { CommitOid, RefType } from "../model/index.js";
import type { RefCheckpoint } from "./extraction.js";
import type { CommitFact, FileChangeFact } from "./facts.js";
import type { ExtractionRange } from "./range.js";
import type { Fact, ProjectedRecord } from "./records.js";

export interface TraversalPlan {
  readonly name: string;
  readonly refType: RefType;
  readonly head: CommitOid;
  readonly excludeHash: CommitOid | undefined;
}

/** Input for planning the traversal boundary of each requested ref. */
export interface TraversalPlanningRequest {
  /** Resolved absolute repository path. */
  readonly repositoryPath: string;
  /** Ordered refs to plan. */
  readonly refs: readonly string[];
  /** Controls whether prior checkpoints participate in boundary selection. */
  readonly mode: "snapshot" | "incremental";
  /** Empty in snapshot mode or when no prior checkpoint exists. */
  readonly priorRefs: readonly RefCheckpoint[];
  readonly range?: ExtractionRange;
}

export interface TraversalPlanner {
  plan(
    request: TraversalPlanningRequest,
    diagnosticReporter: DiagnosticReporter,
  ): Promise<readonly TraversalPlan[]>;
}

export interface CommitTraversalRequest {
  /** Resolved absolute repository path. */
  readonly repositoryPath: string;
  readonly repoName: string;
  readonly repoUrl: string | null;
  readonly plans: readonly TraversalPlan[];
  readonly range?: ExtractionRange;
}

export interface CommitTraversalExtractor {
  extract(
    request: CommitTraversalRequest,
    diagnosticReporter: DiagnosticReporter,
  ): AsyncIterable<CommitFact>;
}

export interface FileChangeExpander {
  expand(commits: AsyncIterable<CommitFact>, repositoryPath: string): AsyncIterable<FileChangeFact>;
  /** Number of file diffs skipped because of the configured size threshold. */
  readonly skippedDiffCount: number;
}

export interface FactProjector {
  project(facts: AsyncIterable<Fact>): AsyncIterable<ProjectedRecord>;
}

export interface OutputSink {
  write(record: ProjectedRecord): Promise<void>;
  close(): Promise<void>;
  readonly filesCreated: number;
  readonly bytesWritten: number;
}
