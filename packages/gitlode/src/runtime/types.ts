import type { ConfigExtensionsSection } from "../config/index.js";
import type { ExtractionState, ProgressEvent, RotationConfig } from "../core/index.js";
import type { ProfileSummaryEntry } from "../instrumentation/index.js";
import type { AbsoluteDirectoryPath, AbsolutePath, IsoDateTimeString } from "../support/index.js";

export type WorkerRunRange =
  | { readonly type: "ref"; readonly since: string }
  | { readonly type: "date"; readonly since: IsoDateTimeString };

export interface WorkerRunInput {
  readonly repositoryPath: AbsolutePath;
  readonly refs: readonly string[];
  readonly outputDir: AbsolutePath;
  readonly outputPrefix?: string;
  readonly rotation: RotationConfig;
  readonly range?: WorkerRunRange;
  readonly granularity: "commit" | "file";
  readonly maxDiffSize?: number;
  readonly profile: boolean;
  readonly repoName?: string;
  readonly repoUrl?: string;
  readonly configBaseDir?: AbsoluteDirectoryPath;
  readonly extensions?: ConfigExtensionsSection;
}

export interface WorkerRunRequest {
  readonly input: WorkerRunInput;
  readonly priorState: ExtractionState;
}

export interface WorkerRunSuccessPayload {
  readonly recordsWritten: number;
  readonly commitsTraversed: number;
  readonly filesCreated: number;
  readonly bytesWritten: number;
  readonly elapsedMs: number;
  readonly refs: readonly string[];
  readonly profileEntries: readonly ProfileSummaryEntry[];
  readonly skippedDiffs: number;
}

export interface WorkerRunSuccess {
  readonly kind: "success";
  readonly success: WorkerRunSuccessPayload;
  readonly state: ExtractionState;
}

export interface WorkerRunUserError {
  readonly kind: "user-error";
  readonly message: string;
}

export interface WorkerRunRuntimeError {
  readonly kind: "runtime-error";
  readonly message: string;
  readonly stack?: string;
}

export type WorkerRunResult = WorkerRunSuccess | WorkerRunUserError | WorkerRunRuntimeError;

export type WorkerDiagnosticSeverity = "warn" | "error";

export type WorkerRunMessage =
  | { readonly type: "progress"; readonly event: ProgressEvent }
  | {
      readonly type: "diagnostic";
      readonly severity: WorkerDiagnosticSeverity;
      readonly message: string;
    }
  | { readonly type: "result"; readonly result: WorkerRunResult };
