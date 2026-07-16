import type { Instrumentation, InstrumentationSpan } from "../instrumentation/index.js";
import type { WorkQueue } from "../support/index.js";

export type DagTraversalRole = "main" | "exclude";

export interface BasicDagSchedulingContext {
  readonly role: DagTraversalRole;
  readonly depth: number;
  readonly discoveredOrder: number;
}

export interface DagSuccessor<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly nodeId: NodeId;
  readonly domainHint?: DomainHint;
}

export interface DagFrontierItem<
  NodeId extends PropertyKey,
  DagSchedulingContext extends BasicDagSchedulingContext,
  DomainHint = undefined,
> {
  readonly nodeId: NodeId;
  readonly scheduling: DagSchedulingContext;
  readonly domainHint?: DomainHint;
}

export interface DagTopologyPort<NodeId extends PropertyKey, DomainHint = undefined> {
  getSuccessors(nodeId: NodeId): Promise<readonly DagSuccessor<NodeId, DomainHint>[]>;
}

export type DagFrontier<T> = WorkQueue<T>;

export interface WalkDagContext<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly graph: DagTopologyPort<NodeId, DomainHint>;
  readonly instrumentation: Instrumentation;
}

/**
 * Common callable shape for a configured DAG difference strategy. Strategy-specific frontier
 * options are bound before exposing a walker through this contract.
 */
export type DagDifferenceWalker<NodeId extends PropertyKey, DomainHint = undefined> = (
  context: WalkDagContext<NodeId, DomainHint>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
) => AsyncIterable<NodeId>;

export interface WalkDagStrategyOptions<
  NodeId extends PropertyKey,
  DagSchedulingContext extends BasicDagSchedulingContext,
  DomainHint = undefined,
> {
  readonly createFrontier?: () => DagFrontier<
    DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>
  >;
}

export interface DagTraversalTelemetry {
  readonly span: InstrumentationSpan;
  readonly countYieldedNodes: boolean;
}

export interface WalkDagCoreContext<
  NodeId extends PropertyKey,
  DomainHint = undefined,
> extends WalkDagContext<NodeId, DomainHint> {
  readonly role: DagTraversalRole;
  readonly telemetry: DagTraversalTelemetry;
}
