import {
  type BasicDagSchedulingContext,
  type DagDifferenceWalker,
  type DagFrontierItem,
  walkDagNodeIdsCertifiedLazy,
  walkDagNodeIdsPhaseCertifiedDifference,
} from "../../dag/index.js";
import type { CommitOid } from "../../model/index.js";
import { OrderedQueue } from "../../support/index.js";
import { createCommitTimestampPhaseCertifiedStrategyOptions } from "./timestamp-frontier-policy.js";
import type { CommitPathSchedulingHint } from "./types.js";

export type CommitTraversalStrategyName =
  | "certified-lazy"
  | "phase-certified-fifo"
  | "phase-certified-timestamp";

export const DEFAULT_COMMIT_TRAVERSAL_STRATEGY: CommitTraversalStrategyName = "certified-lazy";

export const EXPERIMENTAL_COMMIT_TRAVERSAL_ENV = "GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL";

const COMMIT_TRAVERSAL_STRATEGY_NAMES = [
  "certified-lazy",
  "phase-certified-fifo",
  "phase-certified-timestamp",
] as const satisfies readonly CommitTraversalStrategyName[];

export interface CommitTraversalStrategy {
  readonly name: CommitTraversalStrategyName;
  readonly walk: DagDifferenceWalker<CommitOid, CommitPathSchedulingHint>;
}

export function resolveCommitTraversalStrategyName(
  value: string | undefined,
): CommitTraversalStrategyName {
  if (value === undefined) return DEFAULT_COMMIT_TRAVERSAL_STRATEGY;

  if (isCommitTraversalStrategyName(value)) return value;

  throw new Error(
    `Invalid ${EXPERIMENTAL_COMMIT_TRAVERSAL_ENV} value ${JSON.stringify(value)}. Expected one of: ${COMMIT_TRAVERSAL_STRATEGY_NAMES.join(", ")}.`,
  );
}

export function createCommitTraversalStrategy(
  name: CommitTraversalStrategyName,
): CommitTraversalStrategy {
  switch (name) {
    case "certified-lazy":
      return {
        name,
        walk: (context, nodeId, excludeNodeId) =>
          walkDagNodeIdsCertifiedLazy<CommitOid, CommitPathSchedulingHint>(
            context,
            nodeId,
            excludeNodeId,
            {
              createFrontier: () =>
                new OrderedQueue<
                  DagFrontierItem<CommitOid, BasicDagSchedulingContext, CommitPathSchedulingHint>
                >({
                  dequeueOrder: "lifo",
                  blockOrder: "preserve",
                }),
            },
          ),
      };
    case "phase-certified-fifo":
      return {
        name,
        walk: (context, nodeId, excludeNodeId) =>
          walkDagNodeIdsPhaseCertifiedDifference<CommitOid, CommitPathSchedulingHint>(
            context,
            nodeId,
            excludeNodeId,
          ),
      };
    case "phase-certified-timestamp":
      return {
        name,
        walk: (context, nodeId, excludeNodeId) =>
          walkDagNodeIdsPhaseCertifiedDifference<CommitOid, CommitPathSchedulingHint>(
            context,
            nodeId,
            excludeNodeId,
            createCommitTimestampPhaseCertifiedStrategyOptions<CommitOid>(),
          ),
      };
  }
}

function isCommitTraversalStrategyName(value: string): value is CommitTraversalStrategyName {
  return (COMMIT_TRAVERSAL_STRATEGY_NAMES as readonly string[]).includes(value);
}
