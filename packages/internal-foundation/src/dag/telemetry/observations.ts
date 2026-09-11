export type DagTraversalRole = "main" | "exclude";

export type DagFallbackReason =
  | "open_include_path"
  | "exclude_path_split"
  | "no_stop_points"
  | "uncertified_stop_point";

export type DagStreamCompletion = "exhausted" | "cancelled" | "handled_throw" | "error";
export type DagOperationCompletion = DagStreamCompletion | "success";
export type DagCertificationResult = "certified" | "fallback";
export type DagTerminationReason = "frontier-exhausted" | "include-resolved";
export type DagCertifiedClosureResult = "closed-boundary" | "exhausted";

export interface DagOperationObservationHooks {
  recordStepProcessed(count?: number): void;
  recordStepStale(count?: number): void;
  recordSuccessorExpansion(role: DagTraversalRole, count?: number): void;
  recordNodeYielded(count?: number): void;
  recordNodeExcluded(count?: number): void;
  markFallback(reason: DagFallbackReason): void;
  recordFallbackNodeRemoved(count?: number): void;
  setCertificationResult(result: DagCertificationResult): void;
  setTerminationReason(reason: DagTerminationReason): void;
  recordStartCount(count: number): void;
  setCertifiedClosureResult(result: DagCertifiedClosureResult): void;
}

/**
 * Operation-local, SDK-independent evidence collected by a public DAG facade.
 * The owner reports the evidence and terminal state exactly once.
 */
export interface DagOperationObservation extends DagOperationObservationHooks {
  complete(completion: DagOperationCompletion): void;
}
