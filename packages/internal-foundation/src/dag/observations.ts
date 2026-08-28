import type { DagTraversalRole } from "./types.js";

export type DagFallbackReason =
  | "open_include_path"
  | "exclude_path_split"
  | "no_stop_points"
  | "uncertified_stop_point";

export interface DagOperationObservationHooks {
  recordStepProcessed(count?: number): void;
  recordStepStale(count?: number): void;
  recordSuccessorExpansion(role: DagTraversalRole, count?: number): void;
  recordNodeYielded(count?: number): void;
  recordNodeExcluded(count?: number): void;
  markFallback(reason: DagFallbackReason): void;
  recordFallbackNodeRemoved(count?: number): void;
}
