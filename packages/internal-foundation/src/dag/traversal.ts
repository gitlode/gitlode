import { collectAsyncIterableToSet, firstOrThrow, OrderedQueue } from "../support/index.js";
import type { DagFallbackReason } from "./observations.js";
import type {
  BasicDagSchedulingContext,
  DagFrontier,
  DagFrontierItem,
  DagSuccessor,
  DagTraversalRole,
  WalkDagContext,
  WalkDagCoreContext,
  WalkDagStrategyOptions,
} from "./types.js";

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
  options: WalkDagStrategyOptions<NodeId, BasicDagSchedulingContext, DomainHint> = {},
): AsyncIterable<NodeId> {
  let completed = false;
  const complete = (completion: "exhausted" | "cancelled" | "handled_throw" | "error") => {
    if (!completed) {
      completed = true;
      context.observation?.complete(completion);
    }
  };
  try {
    context.observation?.recordStartCount(1);
    yield* walkDagNodeIdsEagerExcludeCore(
      {
        ...context,
        role: "main",
        telemetry: { observation: context.observation, countYieldedNodes: true },
      },
      nodeId,
      excludeNodeId,
      options,
    );
    complete("exhausted");
  } catch (error) {
    complete("error");
    throw error;
  } finally {
    complete("cancelled");
  }
}

async function* walkDagNodeIdsEagerExcludeCore<NodeId extends PropertyKey, DomainHint = undefined>(
  context: WalkDagCoreContext<NodeId, DomainHint>,
  nodeId: NodeId,
  excludeNodeId: NodeId | undefined,
  options: WalkDagStrategyOptions<NodeId, BasicDagSchedulingContext, DomainHint>,
): AsyncIterable<NodeId> {
  const excluded =
    excludeNodeId !== undefined
      ? await collectAsyncIterableToSet(
          walkDagReachableNodeIdsCore(
            {
              ...context,
              role: "exclude",
              telemetry: { ...context.telemetry, countYieldedNodes: false },
            },
            [excludeNodeId],
            options,
          ),
        )
      : new Set<NodeId>();
  if (excludeNodeId !== undefined) {
    context.telemetry.observation?.recordNodeExcluded(excluded.size);
  }

  const reachable = new Set<NodeId>();
  const factory = createDagFrontierItemFactory<NodeId, BasicDagSchedulingContext, DomainHint>(
    createBasicDagSchedulingContext,
  );
  const frontier =
    options.createFrontier?.() ??
    createDefaultTraversalFrontier<NodeId, BasicDagSchedulingContext, DomainHint>();
  frontier.enqueue(factory.createStartItem(nodeId, "main"));

  while (!frontier.isEmpty()) {
    const item = frontier.dequeueOrThrow();
    context.telemetry.observation?.recordStepProcessed();
    if (reachable.has(item.nodeId) || excluded.has(item.nodeId)) {
      context.telemetry.observation?.recordStepStale();
      continue;
    }
    reachable.add(item.nodeId);

    recordYieldedNode(context);
    yield item.nodeId;

    const successors = await expandDagSuccessors(context, item.nodeId);
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
  options: WalkDagStrategyOptions<NodeId, BasicDagSchedulingContext, DomainHint> = {},
): AsyncIterable<NodeId> {
  let completed = false;
  const complete = (completion: "exhausted" | "cancelled" | "handled_throw" | "error") => {
    if (!completed) {
      completed = true;
      context.observation?.complete(completion);
    }
  };
  try {
    yield* walkDagNodeIdsCertifiedLazyCore(
      {
        ...context,
        role: "main",
        telemetry: { observation: context.observation, countYieldedNodes: true },
      },
      nodeId,
      excludeNodeId,
      options,
    );
    complete("exhausted");
  } catch (error) {
    complete("error");
    throw error;
  } finally {
    complete("cancelled");
  }
}

async function* walkDagNodeIdsCertifiedLazyCore<NodeId extends PropertyKey, DomainHint = undefined>(
  context: WalkDagCoreContext<NodeId, DomainHint>,
  nodeId: NodeId,
  excludeNodeId: NodeId | undefined,
  options: WalkDagStrategyOptions<NodeId, BasicDagSchedulingContext, DomainHint>,
): AsyncIterable<NodeId> {
  if (excludeNodeId === undefined) {
    yield* walkDagNodeIdsEagerExcludeCore(context, nodeId, undefined, options);
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
  const excludeStartSuccessors = await expandDagSuccessors(
    { ...context, role: "exclude" },
    excludeNodeId,
  );
  for (const successor of excludeStartSuccessors) markExcludeReached(successor.nodeId);
  if (hasPathSplit(excludeStartSuccessors)) excludePathSplit = true;
  singleExcludeSuccessor =
    excludeStartSuccessors.length === 1 ? firstOrThrow(excludeStartSuccessors).nodeId : null;

  const factory = createDagFrontierItemFactory<NodeId, BasicDagSchedulingContext, DomainHint>(
    createBasicDagSchedulingContext,
  );
  const includeFrontier =
    options.createFrontier?.() ??
    createDefaultTraversalFrontier<NodeId, BasicDagSchedulingContext, DomainHint>();
  includeFrontier.enqueue(factory.createStartItem(nodeId, "main"));

  while (!includeFrontier.isEmpty()) {
    const item = includeFrontier.dequeueOrThrow();
    context.telemetry.observation?.recordStepProcessed();
    const state = stateFor(item.nodeId);
    if (includeExpanded.has(item.nodeId)) {
      context.telemetry.observation?.recordStepStale();
      continue;
    }
    if (state.fromExclude) {
      stopPoints.add(item.nodeId);
      await markExcludeSuccessors(item.nodeId);
      continue;
    }

    state.fromInclude = true;
    includeExpanded.add(item.nodeId);
    resultCandidates.add(item.nodeId);
    const successors = await expandDagSuccessors(context, item.nodeId);
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
    context.telemetry.observation?.markFallback(certificateFailureReason);
    const excluded = await collectAsyncIterableToSet(
      walkDagReachableNodeIdsCore(
        {
          ...context,
          role: "exclude",
          telemetry: { ...context.telemetry, countYieldedNodes: false },
        },
        [excludeNodeId],
        options,
      ),
    );
    context.telemetry.observation?.recordNodeExcluded(excluded.size);
    let removed = 0;
    for (const excludedNodeId of excluded) {
      if (resultCandidates.delete(excludedNodeId)) removed++;
    }
    context.telemetry.observation?.recordFallbackNodeRemoved(removed);
  } else {
    context.telemetry.observation?.setCertificationResult("certified");
  }

  for (const resultCandidate of resultCandidates) {
    recordYieldedNode(context);
    yield resultCandidate;
  }
  context.telemetry.observation?.setTerminationReason("frontier-exhausted");

  function getCertificateFailureReason(): DagFallbackReason | undefined {
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
    const successors = await expandDagSuccessors(
      { ...context, role: "exclude" },
      excludeReachedNodeId,
    );
    for (const successor of successors) markExcludeReached(successor.nodeId);
    if (hasPathSplit(successors)) excludePathSplit = true;
  }
}

export async function* walkDagReachableNodeIds<NodeId extends PropertyKey, DomainHint = undefined>(
  context: WalkDagContext<NodeId, DomainHint>,
  nodeIds: Iterable<NodeId>,
  options: WalkDagStrategyOptions<NodeId, BasicDagSchedulingContext, DomainHint> = {},
): AsyncIterable<NodeId> {
  const starts = Array.from(nodeIds);
  let completed = false;
  const complete = (completion: "exhausted" | "cancelled" | "handled_throw" | "error") => {
    if (!completed) {
      completed = true;
      context.observation?.complete(completion);
    }
  };
  try {
    context.observation?.recordStartCount(starts.length);
    yield* walkDagReachableNodeIdsCore(
      {
        ...context,
        role: "main",
        telemetry: { observation: context.observation, countYieldedNodes: true },
      },
      starts,
      options,
    );
    complete("exhausted");
  } catch (error) {
    complete("error");
    throw error;
  } finally {
    complete("cancelled");
  }
}

async function* walkDagReachableNodeIdsCore<NodeId extends PropertyKey, DomainHint = undefined>(
  context: WalkDagCoreContext<NodeId, DomainHint>,
  nodeIds: Iterable<NodeId>,
  options: WalkDagStrategyOptions<NodeId, BasicDagSchedulingContext, DomainHint> = {},
): AsyncIterable<NodeId> {
  const role = context.role;
  const visited = new Set<NodeId>();
  const factory = createDagFrontierItemFactory<NodeId, BasicDagSchedulingContext, DomainHint>(
    createBasicDagSchedulingContext,
  );
  const frontier =
    options.createFrontier?.() ??
    createDefaultTraversalFrontier<NodeId, BasicDagSchedulingContext, DomainHint>();
  frontier.enqueueMany(factory.createStartItems(nodeIds, role));

  while (!frontier.isEmpty()) {
    const item = frontier.dequeueOrThrow();
    context.telemetry.observation?.recordStepProcessed();
    if (visited.has(item.nodeId)) {
      context.telemetry.observation?.recordStepStale();
      continue;
    }
    visited.add(item.nodeId);

    recordYieldedNode(context);
    yield item.nodeId;

    const successors = await expandDagSuccessors(context, item.nodeId);
    const successorItems = factory
      .createSuccessorItems(item, successors)
      .filter((successor) => !visited.has(successor.nodeId));
    frontier.enqueueMany(successorItems);
  }
}

async function expandDagSuccessors<NodeId extends PropertyKey, DomainHint = undefined>(
  context: WalkDagCoreContext<NodeId, DomainHint>,
  nodeId: NodeId,
): Promise<readonly DagSuccessor<NodeId, DomainHint>[]> {
  const role = context.role;
  context.telemetry.observation?.recordSuccessorExpansion(role);
  return await context.graph.getSuccessors(nodeId);
}

function recordYieldedNode<NodeId extends PropertyKey, DomainHint = undefined>(
  context: WalkDagCoreContext<NodeId, DomainHint>,
): void {
  if (context.telemetry.countYieldedNodes) {
    context.telemetry.observation?.recordNodeYielded();
  }
}

/**
 * Selects the context-neutral frontier used when a traversal does not provide one.
 *
 * FIFO with preserved block order is the default because it imposes no
 * domain-specific prioritization.
 */
function createDefaultTraversalFrontier<
  NodeId extends PropertyKey,
  DagSchedulingContext extends BasicDagSchedulingContext,
  DomainHint = undefined,
>(): DagFrontier<DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>> {
  return createFifoDagFrontier<NodeId, DagSchedulingContext, DomainHint>();
}

function createFifoDagFrontier<
  NodeId extends PropertyKey,
  DagSchedulingContext extends BasicDagSchedulingContext,
  DomainHint = undefined,
>(): DagFrontier<DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>> {
  return new OrderedQueue<DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>>({
    dequeueOrder: "fifo",
    blockOrder: "preserve",
  });
}

function createDagFrontierItemFactory<
  NodeId extends PropertyKey,
  DagSchedulingContext extends BasicDagSchedulingContext,
  DomainHint = undefined,
>(
  createDagSchedulingContext: (
    role: DagTraversalRole,
    depth: number,
    discoveredOrder: number,
  ) => DagSchedulingContext,
): {
  createStartItem: (
    nodeId: NodeId,
    role: DagTraversalRole,
  ) => DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>;
  createStartItems: (
    nodeIds: Iterable<NodeId>,
    role: DagTraversalRole,
  ) => DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>[];
  createSuccessorItems: (
    parent: DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>,
    successors: readonly DagSuccessor<NodeId, DomainHint>[],
  ) => DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>[];
} {
  let discoveredOrder = 0;

  const createStartItem = (
    nodeId: NodeId,
    role: DagTraversalRole,
  ): DagFrontierItem<NodeId, DagSchedulingContext, DomainHint> => {
    return createFrontierItem(nodeId, createDagSchedulingContext(role, 0, discoveredOrder++));
  };

  const createStartItems = (
    nodeIds: Iterable<NodeId>,
    role: DagTraversalRole,
  ): DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>[] => {
    return Array.from(nodeIds, (nodeId) => createStartItem(nodeId, role));
  };

  const createSuccessorItems = (
    parent: DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>,
    successors: readonly DagSuccessor<NodeId, DomainHint>[],
  ): DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>[] => {
    const items: DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>[] = [];

    for (const successor of successors) {
      items.push(
        createFrontierItem(
          successor.nodeId,
          createDagSchedulingContext(
            parent.scheduling.role,
            parent.scheduling.depth + 1,
            discoveredOrder++,
          ),
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

function createFrontierItem<
  NodeId extends PropertyKey,
  DagSchedulingContext extends BasicDagSchedulingContext,
  DomainHint = undefined,
>(
  nodeId: NodeId,
  scheduling: DagSchedulingContext,
  domainHint?: DomainHint,
): DagFrontierItem<NodeId, DagSchedulingContext, DomainHint> {
  return {
    nodeId,
    scheduling,
    ...(domainHint === undefined ? {} : { domainHint }),
  };
}

function createBasicDagSchedulingContext(
  role: DagTraversalRole,
  depth: number,
  discoveredOrder: number,
): BasicDagSchedulingContext {
  return {
    role,
    depth,
    discoveredOrder,
  };
}

function hasPathSplit<NodeId extends PropertyKey, DomainHint>(
  successors: readonly DagSuccessor<NodeId, DomainHint>[],
): boolean {
  return successors.length > 1;
}
