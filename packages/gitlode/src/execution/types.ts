import type { Diagnostic, DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import type { ExtractionCheckpoint } from "@gitlode/internal-contracts/extraction";
import type { ProgressEvent, ProgressReporter } from "@gitlode/internal-contracts/progress";
import type { ProfileReport } from "@gitlode/internal-contracts/telemetry";
import type {
  AbsoluteDirectoryPath,
  AbsolutePath,
  IsoDateTimeString,
} from "@gitlode/internal-foundation/support";

import type { PluginDeclarations } from "../plugin-runtime/index.js";

export type ExecutionGitAdapterName = "isomorphic-git" | "git-cli";
export type MissingStatePolicy = "error" | "snapshot";

export type WorkerRunRange =
  | { readonly type: "ref"; readonly since: string }
  | { readonly type: "date"; readonly since: IsoDateTimeString };

interface WorkerOutputRotation {
  readonly maxLines?: number;
  readonly maxBytes?: number;
}

export interface WorkerRunInput {
  readonly repositoryPath: AbsolutePath;
  readonly refs: readonly string[];
  readonly outputDir: AbsolutePath;
  readonly outputPrefix?: string;
  readonly rotation: WorkerOutputRotation;
  readonly range?: WorkerRunRange;
  readonly granularity: "commit" | "file";
  readonly maxDiffSize?: number;
  readonly profile: boolean;
  readonly gitAdapter: ExecutionGitAdapterName;
  readonly repoName?: string;
  readonly repoUrl?: string;
  readonly pluginBaseDirectory?: AbsoluteDirectoryPath;
  readonly pluginDeclarations?: PluginDeclarations;
}

export interface ExecutionRunInput extends WorkerRunInput {
  readonly incremental: boolean;
  readonly missingState?: MissingStatePolicy;
  readonly stateFilePath?: AbsolutePath;
}

export interface WorkerRunRequest {
  readonly input: WorkerRunInput;
  readonly priorCheckpoint: ExtractionCheckpoint;
}

export interface ExecutionSuccessPayload {
  readonly recordsWritten: number;
  readonly commitsTraversed: number;
  readonly filesCreated: number;
  readonly bytesWritten: number;
  readonly elapsedMs: number;
  readonly refs: readonly string[];
  readonly skippedDiffs: number;
  readonly profileReport?: ProfileReport;
}

interface WorkerRunSuccess {
  readonly kind: "success";
  readonly success: ExecutionSuccessPayload;
  readonly checkpoint: ExtractionCheckpoint;
}

interface ExecutionRunSuccess {
  readonly kind: "success";
  readonly success: ExecutionSuccessPayload;
}

interface ExecutionUserError {
  readonly kind: "user-error";
  readonly message: string;
  readonly profileReport?: ProfileReport;
}

interface ExecutionRuntimeError {
  readonly kind: "runtime-error";
  readonly message: string;
  readonly stack?: string;
  readonly profileReport?: ProfileReport;
}

export type WorkerRunResult = WorkerRunSuccess | ExecutionUserError | ExecutionRuntimeError;
export type ExecutionRunResult = ExecutionRunSuccess | ExecutionUserError | ExecutionRuntimeError;

export interface ExecutionRunReporters {
  readonly progressReporter: ProgressReporter;
  readonly diagnosticReporter: DiagnosticReporter;
}

export type WorkerRunMessage =
  | { readonly type: "progress"; readonly event: ProgressEvent }
  | { readonly type: "diagnostic"; readonly diagnostic: Diagnostic }
  | { readonly type: "result"; readonly result: WorkerRunResult };
