import { PriorityQueue } from "../support/index.js";
import type { DagFrontier } from "./dag-traversal-strategy.js";
import type {
  ClosureFrontierItem,
  DifferenceFrontierItem,
  PhaseCertifiedStrategyOptions,
} from "./explore-dag-strategy.js";
import type { CommitPathSchedulingHint } from "./isomorphic-git-adapter.js";

export function compareCommitTimestampHintedItems<
  T extends { readonly domainHint?: CommitPathSchedulingHint },
>(left: T, right: T): number {
  const leftTimestamp = left.domainHint?.sourceCommitterTimestamp;
  const rightTimestamp = right.domainHint?.sourceCommitterTimestamp;

  if (leftTimestamp === undefined && rightTimestamp === undefined) return 0;
  if (leftTimestamp === undefined) return -1;
  if (rightTimestamp === undefined) return 1;
  if (leftTimestamp === rightTimestamp) return 0;

  return leftTimestamp > rightTimestamp ? -1 : 1;
}

export function createCommitTimestampPriorityFrontier<
  T extends { readonly domainHint?: CommitPathSchedulingHint },
>(): DagFrontier<T> {
  return new PriorityQueue(compareCommitTimestampHintedItems);
}

export function createCommitTimestampPhaseCertifiedStrategyOptions<
  NodeId extends PropertyKey,
>(): PhaseCertifiedStrategyOptions<NodeId, CommitPathSchedulingHint> {
  return {
    createDifferenceFrontier: () =>
      createCommitTimestampPriorityFrontier<
        DifferenceFrontierItem<NodeId, CommitPathSchedulingHint>
      >(),
    createClosureFrontier: () =>
      createCommitTimestampPriorityFrontier<
        ClosureFrontierItem<NodeId, CommitPathSchedulingHint>
      >(),
  };
}
