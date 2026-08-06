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
  | { readonly type: "phase-end"; readonly phase: ProgressPhase };

export interface ProgressReporter {
  emit(event: ProgressEvent): void;
}
