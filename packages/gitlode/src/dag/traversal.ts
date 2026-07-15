import { instrumentAsyncIterable } from "../instrumentation/index.js";
import { collectAsyncIterableToSet, firstOrThrow, OrderedQueue } from "../support/index.js";
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
  yield* instrumentAsyncIterable(
    context.instrumentation,
    "dag.traversal",
    (span) =>
      walkDagNodeIdsEagerExcludeCore(
        {
          ...context,
          role: "main",
          telemetry: { span, countYieldedNodes: true },
        },
        nodeId,
        excludeNodeId,
        options,
      ),
    { attributes: { strategy: "eagerExclude" } },
  );
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
    context.telemetry.span.incrementCounter("excluded_nodes", excluded.size);
  }

  const reachable = new Set<NodeId>();
  const factory = createDagFrontierItemFactory<NodeId, BasicDagSchedulingContext, DomainHint>(
    createBasicDagSchedulingContext,
  );
  const frontier =
    options.createFrontier?.() ??
    createDefaultDagFrontier<NodeId, BasicDagSchedulingContext, DomainHint>();
  frontier.enqueue(factory.createStartItem(nodeId, "main"));

  while (!frontier.isEmpty()) {
    const item = frontier.dequeueOrThrow();
    context.telemetry.span.incrementCounter("traversal_steps");
    if (reachable.has(item.nodeId) || excluded.has(item.nodeId)) {
      context.telemetry.span.incrementCounter("stale_steps");
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
  yield* instrumentAsyncIterable(
    context.instrumentation,
    "dag.traversal",
    (span) =>
      walkDagNodeIdsCertifiedLazyCore(
        {
          ...context,
          role: "main",
          telemetry: { span, countYieldedNodes: true },
        },
        nodeId,
        excludeNodeId,
        options,
      ),
    { attributes: { strategy: "certifiedLazy" } },
  );
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
    createDefaultDagFrontier<NodeId, BasicDagSchedulingContext, DomainHint>();
  includeFrontier.enqueue(factory.createStartItem(nodeId, "main"));

  while (!includeFrontier.isEmpty()) {
    const item = includeFrontier.dequeueOrThrow();
    context.telemetry.span.incrementCounter("traversal_steps");
    const state = stateFor(item.nodeId);
    if (includeExpanded.has(item.nodeId)) {
      context.telemetry.span.incrementCounter("stale_steps");
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
    context.telemetry.span.setAttribute("result", "fallback");
    context.telemetry.span.setAttribute("fallback_reason", certificateFailureReason);
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
    context.telemetry.span.incrementCounter("excluded_nodes", excluded.size);
    let removed = 0;
    for (const excludedNodeId of excluded) {
      if (resultCandidates.delete(excludedNodeId)) removed++;
    }
    context.telemetry.span.incrementCounter("fallback_removed", removed);
  } else {
    context.telemetry.span.setAttribute("result", "certified");
  }

  for (const resultCandidate of resultCandidates) {
    recordYieldedNode(context);
    yield resultCandidate;
  }

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
  yield* instrumentAsyncIterable(context.instrumentation, "dag.reachable", (span) =>
    walkDagReachableNodeIdsCore(
      {
        ...context,
        role: "main",
        telemetry: { span, countYieldedNodes: true },
      },
      nodeIds,
      options,
    ),
  );
}

export async function* walkDagReachableNodeIdsCore<
  NodeId extends PropertyKey,
  DomainHint = undefined,
>(
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
    createDefaultDagFrontier<NodeId, BasicDagSchedulingContext, DomainHint>();
  frontier.enqueueMany(factory.createStartItems(nodeIds, role));

  while (!frontier.isEmpty()) {
    const item = frontier.dequeueOrThrow();
    context.telemetry.span.incrementCounter("traversal_steps");
    if (visited.has(item.nodeId)) {
      context.telemetry.span.incrementCounter("stale_steps");
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
  context.telemetry.span.incrementCounter("successor_expansions");
  context.telemetry.span.incrementCounter(
    role === "exclude" ? "exclude_expansions" : "main_expansions",
  );
  return await context.graph.getSuccessors(nodeId);
}

function recordYieldedNode<NodeId extends PropertyKey, DomainHint = undefined>(
  context: WalkDagCoreContext<NodeId, DomainHint>,
): void {
  if (context.telemetry.countYieldedNodes) {
    context.telemetry.span.incrementCounter("yielded_nodes");
  }
}

export function createDefaultDagFrontier<
  NodeId extends PropertyKey,
  DagSchedulingContext extends BasicDagSchedulingContext,
  DomainHint = undefined,
>(): DagFrontier<DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>> {
  return new OrderedQueue<DagFrontierItem<NodeId, DagSchedulingContext, DomainHint>>({
    dequeueOrder: "fifo",
    blockOrder: "preserve",
  });
}

export function createDagFrontierItemFactory<
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

export function createFrontierItem<
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

export function createBasicDagSchedulingContext(
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
