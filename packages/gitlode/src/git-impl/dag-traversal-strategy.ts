import { type Instrumentation } from "../instrumentation/index.js";
import { firstOrThrow, OrderedQueue, type WorkQueue } from "../support/index.js";

export type DagTraversalRole = "include" | "exclude";

export interface DagSchedulingContext {
  readonly role: DagTraversalRole;
  readonly depth: number;
  readonly discoveredOrder: number;
}

export interface DagSuccessor<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly nodeId: NodeId;
  readonly domainHint?: DomainHint;
}

export interface DagFrontierItem<NodeId extends PropertyKey, DomainHint = undefined> {
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

type WalkDagStrategy = "eagerExclude" | "certifiedLazy";

export interface WalkDagStrategyOptions<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly createFrontier?: () => DagFrontier<DagFrontierItem<NodeId, DomainHint>>;
}

export interface WalkDagConfiguredStrategyOptions<
  NodeId extends PropertyKey,
  DomainHint = undefined,
> {
  readonly strategy?: WalkDagStrategy;
  readonly eagerExclude?: WalkDagStrategyOptions<NodeId, DomainHint>;
  readonly certifiedLazy?: WalkDagStrategyOptions<NodeId, DomainHint>;
}

const defaultStrategy: WalkDagStrategy = "certifiedLazy";

export async function collectReachableNodeIds<NodeId extends PropertyKey, DomainHint = undefined>(
  startNodeIds: Iterable<NodeId>,
  graph: DagTopologyPort<NodeId, DomainHint>,
  options: WalkDagStrategyOptions<NodeId, DomainHint> = {},
): Promise<Set<NodeId>> {
  return await collectReachableNodeIdsWithRole(startNodeIds, graph, "include", options);
}

export function walkDagNodeIdsWithConfiguredStrategy<
  NodeId extends PropertyKey,
  DomainHint = undefined,
>(
  context: WalkDagContext<NodeId, DomainHint>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
  options: WalkDagConfiguredStrategyOptions<NodeId, DomainHint> = {},
): AsyncIterable<NodeId> {
  switch (options.strategy ?? defaultStrategy) {
    case "eagerExclude":
      return walkDagNodeIdsEagerExclude(context, nodeId, excludeNodeId, options.eagerExclude);
    case "certifiedLazy":
      return walkDagNodeIdsCertifiedLazy(context, nodeId, excludeNodeId, options.certifiedLazy);
  }
}

/**
 * Traverses DAG node IDs by eagerly collecting every ID reachable from `excludeNodeId` before
 * walking from the include-side starting ID. The yielded set is
 * `reachable(nodeId) - reachable(excludeNodeId)`.
 */
export async function* walkDagNodeIdsEagerExclude<
  NodeId extends PropertyKey,
  DomainHint = undefined,
>(
  context: WalkDagContext<NodeId, DomainHint>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
  options: WalkDagStrategyOptions<NodeId, DomainHint> = {},
): AsyncIterable<NodeId> {
  const excluded =
    excludeNodeId !== undefined
      ? await collectReachableNodeIdsWithRole([excludeNodeId], context.graph, "exclude", options)
      : new Set<NodeId>();

  const reachable = new Set<NodeId>();
  const factory = createDagFrontierItemFactory();
  const frontier = options.createFrontier?.() ?? createDefaultDagFrontier<NodeId, DomainHint>();
  frontier.enqueue(factory.createStartItem<NodeId, DomainHint>(nodeId, "include"));

  while (!frontier.isEmpty()) {
    const item = frontier.dequeueOrThrow();
    if (reachable.has(item.nodeId) || excluded.has(item.nodeId)) continue;
    reachable.add(item.nodeId);

    yield item.nodeId;

    const successors = await context.graph.getSuccessors(item.nodeId);
    const successorItems = factory
      .createSuccessorItems(item, successors)
      .filter((successor) => !reachable.has(successor.nodeId) && !excluded.has(successor.nodeId));
    frontier.enqueueMany(successorItems);
  }
}

interface CertifiedLazyNodeState {
  fromInclude: boolean;
  fromExclude: boolean;
}

/**
 * Traverses node IDs with a lazy two-sided view of the DAG. It buffers include-side candidates,
 * marks exclude-side stop points as they are encountered, and yields only when a conservative path
 * certificate proves that older exclude successors cannot affect the result set. If that
 * certificate is not available, it falls back to a full exclude-reachable collection.
 */
export async function* walkDagNodeIdsCertifiedLazy<
  NodeId extends PropertyKey,
  DomainHint = undefined,
>(
  context: WalkDagContext<NodeId, DomainHint>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
  options: WalkDagStrategyOptions<NodeId, DomainHint> = {},
): AsyncIterable<NodeId> {
  if (excludeNodeId === undefined) {
    yield* walkDagNodeIdsEagerExclude(context, nodeId, undefined, options);
    return;
  }

  const states = new Map<NodeId, CertifiedLazyNodeState>();
  const resultCandidates = new Set<NodeId>();
  const stopPoints = new Set<NodeId>();
  const includeExpanded = new Set<NodeId>();
  let includePathReachedTerminal = false;
  let singleExcludeSuccessor: NodeId | null = null;
  let excludePathSplit = false;

  const stateFor = (nodeId: NodeId): CertifiedLazyNodeState => {
    let state = states.get(nodeId);
    if (state === undefined) {
      state = { fromInclude: false, fromExclude: false };
      states.set(nodeId, state);
    }
    return state;
  };

  const markExcludeReached = (excludeReachedNodeId: NodeId): void => {
    stateFor(excludeReachedNodeId).fromExclude = true;
  };

  markExcludeReached(excludeNodeId);
  const excludeStartSuccessors = await context.graph.getSuccessors(excludeNodeId);
  for (const successor of excludeStartSuccessors) markExcludeReached(successor.nodeId);
  if (hasPathSplit(excludeStartSuccessors)) excludePathSplit = true;
  singleExcludeSuccessor =
    excludeStartSuccessors.length === 1 ? firstOrThrow(excludeStartSuccessors).nodeId : null;

  const factory = createDagFrontierItemFactory();
  const includeFrontier =
    options.createFrontier?.() ?? createDefaultDagFrontier<NodeId, DomainHint>();
  includeFrontier.enqueue(factory.createStartItem<NodeId, DomainHint>(nodeId, "include"));

  while (!includeFrontier.isEmpty()) {
    const item = includeFrontier.dequeueOrThrow();
    const state = stateFor(item.nodeId);
    if (includeExpanded.has(item.nodeId)) continue;
    if (state.fromExclude) {
      stopPoints.add(item.nodeId);
      await markExcludeSuccessors(item.nodeId);
      continue;
    }

    state.fromInclude = true;
    includeExpanded.add(item.nodeId);
    resultCandidates.add(item.nodeId);
    const successors = await context.graph.getSuccessors(item.nodeId);
    if (successors.length === 0) {
      includePathReachedTerminal = true;
      continue;
    }

    for (const successor of successors) {
      const successorState = stateFor(successor.nodeId);
      if (successorState.fromExclude) stopPoints.add(successor.nodeId);
    }
    includeFrontier.enqueueMany(factory.createSuccessorItems(item, successors));
  }

  const certificateFailureReason = getCertificateFailureReason();

  if (certificateFailureReason !== undefined) {
    const excluded = await collectReachableNodeIdsWithRole(
      [excludeNodeId],
      context.graph,
      "exclude",
      options,
    );
    for (const excludedNodeId of excluded) resultCandidates.delete(excludedNodeId);
  }

  yield* resultCandidates;

  function getCertificateFailureReason(): string | undefined {
    if (includePathReachedTerminal || excludePathSplit || stopPoints.size === 0) {
      if (includePathReachedTerminal) return "open_include_path";
      if (excludePathSplit) return "exclude_path_split";
      return "no_stop_points";
    }

    for (const stopPoint of stopPoints) {
      if (stopPoint !== excludeNodeId && stopPoint !== singleExcludeSuccessor) {
        return "uncertified_stop_point";
      }
    }
    return undefined;
  }

  async function markExcludeSuccessors(excludeReachedNodeId: NodeId): Promise<void> {
    const successors = await context.graph.getSuccessors(excludeReachedNodeId);
    for (const successor of successors) markExcludeReached(successor.nodeId);
    if (hasPathSplit(successors)) excludePathSplit = true;
  }
}

async function collectReachableNodeIdsWithRole<NodeId extends PropertyKey, DomainHint = undefined>(
  startNodeIds: Iterable<NodeId>,
  graph: DagTopologyPort<NodeId, DomainHint>,
  role: DagTraversalRole,
  options: WalkDagStrategyOptions<NodeId, DomainHint> = {},
): Promise<Set<NodeId>> {
  const reachable = new Set<NodeId>();
  const factory = createDagFrontierItemFactory();
  const frontier = options.createFrontier?.() ?? createDefaultDagFrontier<NodeId, DomainHint>();
  frontier.enqueueMany(factory.createStartItems<NodeId, DomainHint>(startNodeIds, role));

  while (!frontier.isEmpty()) {
    const item = frontier.dequeueOrThrow();
    if (reachable.has(item.nodeId)) continue;
    reachable.add(item.nodeId);

    const successors = await graph.getSuccessors(item.nodeId);
    const successorItems = factory
      .createSuccessorItems(item, successors)
      .filter((successor) => !reachable.has(successor.nodeId));
    frontier.enqueueMany(successorItems);
  }

  return reachable;
}

export function createDefaultDagFrontier<
  NodeId extends PropertyKey,
  DomainHint = undefined,
>(): DagFrontier<DagFrontierItem<NodeId, DomainHint>> {
  return new OrderedQueue<DagFrontierItem<NodeId, DomainHint>>({
    dequeueOrder: "fifo",
    blockOrder: "preserve",
  });
}

function createDagFrontierItemFactory() {
  let discoveredOrder = 0;

  const createStartItem = <NodeId extends PropertyKey, DomainHint = undefined>(
    nodeId: NodeId,
    role: DagTraversalRole,
  ): DagFrontierItem<NodeId, DomainHint> => {
    return createFrontierItem(nodeId, {
      role,
      depth: 0,
      discoveredOrder: discoveredOrder++,
    });
  };

  const createStartItems = <NodeId extends PropertyKey, DomainHint = undefined>(
    nodeIds: Iterable<NodeId>,
    role: DagTraversalRole,
  ): DagFrontierItem<NodeId, DomainHint>[] => {
    return Array.from(nodeIds, (nodeId) => createStartItem<NodeId, DomainHint>(nodeId, role));
  };

  const createSuccessorItems = <NodeId extends PropertyKey, DomainHint = undefined>(
    parent: DagFrontierItem<NodeId, DomainHint>,
    successors: readonly DagSuccessor<NodeId, DomainHint>[],
  ): DagFrontierItem<NodeId, DomainHint>[] => {
    const items: DagFrontierItem<NodeId, DomainHint>[] = [];

    for (const successor of successors) {
      items.push(
        createFrontierItem(
          successor.nodeId,
          {
            role: parent.scheduling.role,
            depth: parent.scheduling.depth + 1,
            discoveredOrder: discoveredOrder++,
          },
          successor.domainHint,
        ),
      );
    }

    return items;
  };

  return {
    createStartItem,
    createStartItems,
    createSuccessorItems,
  };
}

function createFrontierItem<NodeId extends PropertyKey, DomainHint = undefined>(
  nodeId: NodeId,
  scheduling: DagSchedulingContext,
  domainHint?: DomainHint,
): DagFrontierItem<NodeId, DomainHint> {
  return {
    nodeId,
    scheduling,
    ...(domainHint === undefined ? {} : { domainHint }),
  };
}

function hasPathSplit<NodeId extends PropertyKey, DomainHint>(
  successors: readonly DagSuccessor<NodeId, DomainHint>[],
): boolean {
  return successors.length > 1;
}
