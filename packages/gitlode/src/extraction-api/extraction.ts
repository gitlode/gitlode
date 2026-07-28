import type { CommitOid, RefType } from "../model/index.js";
import type { AbsolutePath } from "../support/index.js";
import type { ExtractionRange } from "./range.js";

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

export interface CoordinatorRequest {
  readonly repositoryPath: AbsolutePath;
  readonly repoName: string;
  readonly repoUrl: string | null;
  readonly refs: readonly string[];
  readonly granularity: "commit" | "file";
  readonly range?: ExtractionRange;
  readonly priorState: ExtractionState;
  /** Wall-clock time at which this extraction session started. */
  readonly sessionTimestamp: Date;
}

export interface CoordinatorResult {
  readonly recordsWritten: number;
  readonly commitsTraversed: number;
  /** Refs whose heads were resolved successfully; skipped refs are omitted. */
  readonly refs: readonly string[];
  /** Checkpoint state produced only after output completion and sink close. */
  readonly state: ExtractionState;
  readonly skippedDiffs: number;
}

export interface ExtractionCoordinator {
  run(request: CoordinatorRequest): Promise<CoordinatorResult>;
}
