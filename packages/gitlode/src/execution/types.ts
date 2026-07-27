import type { ExtractionState } from "../extraction-api/index.js";
import type { ProfileSummaryEntry } from "../instrumentation/index.js";
import type { PluginDeclarations } from "../plugin-runtime/index.js";
import type { ProgressEvent } from "../progress/index.js";
import type { MissingStatePolicy } from "../state/index.js";
import type { AbsoluteDirectoryPath, AbsolutePath, IsoDateTimeString } from "../support/index.js";

export type ExecutionGitAdapterName = "isomorphic-git" | "git-cli";

export type WorkerRunRange =
  | { readonly type: "ref"; readonly since: string }
  | { readonly type: "date"; readonly since: IsoDateTimeString };

export interface WorkerOutputRotation {
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
  readonly priorState: ExtractionState;
}

export interface ExecutionSuccessPayload {
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
  readonly success: ExecutionSuccessPayload;
  readonly state: ExtractionState;
}

export interface ExecutionRunSuccess {
  readonly kind: "success";
  readonly success: ExecutionSuccessPayload;
}

export interface ExecutionUserError {
  readonly kind: "user-error";
  readonly message: string;
}

export interface ExecutionRuntimeError {
  readonly kind: "runtime-error";
  readonly message: string;
  readonly stack?: string;
}

export type WorkerRunResult = WorkerRunSuccess | ExecutionUserError | ExecutionRuntimeError;
export type ExecutionRunResult = ExecutionRunSuccess | ExecutionUserError | ExecutionRuntimeError;

export type WorkerDiagnosticSeverity = "warn" | "error";

export interface ExecutionRunHandlers {
  readonly onProgress: (event: ProgressEvent) => void;
  readonly onDiagnostic: (severity: WorkerDiagnosticSeverity, message: string) => void;
}

export type WorkerRunMessage =
  | { readonly type: "progress"; readonly event: ProgressEvent }
  | {
      readonly type: "diagnostic";
      readonly severity: WorkerDiagnosticSeverity;
      readonly message: string;
    }
  | { readonly type: "result"; readonly result: WorkerRunResult };
