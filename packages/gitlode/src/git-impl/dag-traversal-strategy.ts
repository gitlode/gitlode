import {
  instrumentAsyncIterable,
  type Instrumentation,
  type InstrumentationSpan,
} from "../instrumentation/index.js";
import { firstOrThrow, OrderedQueue, type WorkQueue } from "../support/index.js";

const DAG_TRAVERSAL_SPAN = "dag.traversal";
const DAG_TRAVERSAL_STEP_SPAN = "dag.traversal.step";
const DAG_COLLECT_REACHABLE_SPAN = "dag.traversal.collect_reachable";
const DAG_INCLUDE_READ_SPAN = "dag.traversal.read_node.include";
const DAG_EXCLUDE_READ_SPAN = "dag.traversal.read_node.exclude";

export interface DagNodePort<NodeId extends PropertyKey, Node> {
  /**
   * Reads a node by ID in the adapter-domain shape used by traversal.
   * Implementations should translate backend-specific node objects and read errors before they
   * cross into DAG traversal strategy code.
   */
  readNode(nodeId: NodeId): Promise<Node>;

  /**
   * Returns the node's successors along the traversal direction.
   */
  getSuccessors(node: Node): readonly NodeId[];
}

/**
 * Collects every node ID reachable from the supplied start IDs by following the traversal
 * direction exposed by `nodes.getSuccessors()`.
 */
export async function collectReachableNodes<NodeId extends PropertyKey, Node>(
  startIds: Iterable<NodeId>,
  nodes: DagNodePort<NodeId, Node>,
  options: WalkDagStrategyOptions<NodeId> = {},
): Promise<Set<NodeId>> {
  const reachable = new Set<NodeId>();
  const frontier = options.createFrontier?.() ?? createDefaultDagQueue<NodeId>();
  for (const startId of startIds) frontier.enqueue(startId);

  while (!frontier.isEmpty()) {
    const nodeId = frontier.dequeueOrThrow();
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);

    const node = await nodes.readNode(nodeId);
    for (const successor of nodes.getSuccessors(node)) {
      if (!reachable.has(successor)) frontier.enqueue(successor);
    }
  }

  return reachable;
}

export interface WalkDagContext<NodeId extends PropertyKey, Node> {
  readonly nodes: DagNodePort<NodeId, Node>;
  readonly instrumentation: Instrumentation;
}

interface InternalWalkDagContext<NodeId extends PropertyKey, Node> extends WalkDagContext<
  NodeId,
  Node
> {
  readonly span: InstrumentationSpan;
}

type WalkDagStrategy = "eagerExclude" | "certifiedLazy";

export interface WalkDagStrategyOptions<NodeId extends PropertyKey> {
  readonly createFrontier?: () => WorkQueue<NodeId>;
}

export interface WalkDagConfiguredStrategyOptions<NodeId extends PropertyKey> {
  readonly strategy?: WalkDagStrategy;
  readonly eagerExclude?: WalkDagStrategyOptions<NodeId>;
  readonly certifiedLazy?: WalkDagStrategyOptions<NodeId>;
}

const defaultStrategy: WalkDagStrategy = "certifiedLazy";

export function walkDagWithConfiguredStrategy<NodeId extends PropertyKey, Node>(
  context: WalkDagContext<NodeId, Node>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
  options: WalkDagConfiguredStrategyOptions<NodeId> = {},
): AsyncIterable<Node> {
  switch (options.strategy ?? defaultStrategy) {
    case "eagerExclude":
      return walkDagEagerExclude(context, nodeId, excludeNodeId, options.eagerExclude);
    case "certifiedLazy":
      return walkDagCertifiedLazy(context, nodeId, excludeNodeId, options.certifiedLazy);
  }
}

/**
 * Traverses DAG nodes by eagerly collecting every node reachable from `excludeNodeId` before
 * walking from the include-side starting node. This mirrors the original subtraction
 * implementation: build the complete excluded set first, then perform an include-side walk that
 * skips excluded and visited nodes.
 */
export async function* walkDagEagerExclude<NodeId extends PropertyKey, Node>(
  context: WalkDagContext<NodeId, Node>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
  options: WalkDagStrategyOptions<NodeId> = {},
): AsyncIterable<Node> {
  yield* instrumentDagTraversal(context, (internalContext) =>
    walkDagEagerExcludeCore(internalContext, nodeId, excludeNodeId, options),
  );
}

async function* walkDagEagerExcludeCore<NodeId extends PropertyKey, Node>(
  context: InternalWalkDagContext<NodeId, Node>,
  nodeId: NodeId,
  excludeNodeId: NodeId | undefined,
  options: WalkDagStrategyOptions<NodeId>,
): AsyncIterable<Node> {
  const { instrumentation, span } = context;
  span.setAttribute("strategy", "eagerExclude");
  const excluded =
    excludeNodeId !== undefined
      ? await collectReachable(context, excludeNodeId)
      : new Set<NodeId>();

  const frontier = options.createFrontier?.() ?? createDefaultDagQueue<NodeId>();
  frontier.enqueue(nodeId);
  const visited = new Set<NodeId>();

  while (!frontier.isEmpty()) {
    const next = await instrumentation.runAsync(DAG_TRAVERSAL_STEP_SPAN, async () => {
      const nodeId = frontier.dequeueOrThrow();
      if (visited.has(nodeId) || excluded.has(nodeId)) return null;
      visited.add(nodeId);

      span.incrementCounter("include_reads");
      return await instrumentation.runAsync(DAG_INCLUDE_READ_SPAN, async () =>
        context.nodes.readNode(nodeId),
      );
    });

    if (next === null) continue;

    span.incrementCounter("yielded");
    yield next;

    for (const successor of context.nodes.getSuccessors(next)) {
      if (!visited.has(successor) && !excluded.has(successor)) frontier.enqueue(successor);
    }
  }
}

interface CertifiedLazyBaseNodeState {
  fromInclude: boolean;
  fromExclude: boolean;
}

interface CertifiedLazyUnreadNodeState extends CertifiedLazyBaseNodeState {
  read: false;
}

interface CertifiedLazyReadNodeState<
  NodeId extends PropertyKey,
  Node,
> extends CertifiedLazyBaseNodeState {
  read: true;
  successors: readonly NodeId[];
  node: Node;
}

type CertifiedLazyNodeState<NodeId extends PropertyKey, Node> =
  | CertifiedLazyUnreadNodeState
  | CertifiedLazyReadNodeState<NodeId, Node>;

/**
 * Traverses nodes with a lazy two-sided view of the DAG. It buffers include-side candidates,
 * marks exclude-side stop points as they are encountered, and yields only when a conservative path
 * certificate proves that older exclude successors cannot affect the result set. If that
 * certificate is not available, it falls back to a cached full exclude-reachable collection.
 */
export async function* walkDagCertifiedLazy<NodeId extends PropertyKey, Node>(
  context: WalkDagContext<NodeId, Node>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
  options: WalkDagStrategyOptions<NodeId> = {},
): AsyncIterable<Node> {
  yield* instrumentDagTraversal(context, (internalContext) =>
    walkDagCertifiedLazyCore(internalContext, nodeId, excludeNodeId, options),
  );
}

async function* walkDagCertifiedLazyCore<NodeId extends PropertyKey, Node>(
  context: InternalWalkDagContext<NodeId, Node>,
  nodeId: NodeId,
  excludeNodeId: NodeId | undefined,
  options: WalkDagStrategyOptions<NodeId>,
): AsyncIterable<Node> {
  const { instrumentation, span } = context;
  span.setAttribute("strategy", "certifiedLazy");
  if (excludeNodeId === undefined) {
    yield* walkDagEagerExcludeCore(context, nodeId, undefined, options);
    return;
  }

  const states = new Map<NodeId, CertifiedLazyNodeState<NodeId, Node>>();
  const resultCandidates = new Map<NodeId, Node>();
  const stopPoints = new Set<NodeId>();
  let includePathReachedTerminal = false;
  let singleExcludeSuccessor: NodeId | null = null;
  let excludePathSplit = false;
  let includeReads = 0;
  let excludeReads = 0;

  const stateFor = (nodeId: NodeId): CertifiedLazyNodeState<NodeId, Node> => {
    let state = states.get(nodeId);
    if (state === undefined) {
      state = { fromInclude: false, fromExclude: false, read: false };
      states.set(nodeId, state);
    }
    return state;
  };

  const markExcludeReached = (nodeId: NodeId): void => {
    stateFor(nodeId).fromExclude = true;
  };

  const markRead = (nodeId: NodeId, node: Node): CertifiedLazyReadNodeState<NodeId, Node> => {
    const current = stateFor(nodeId);
    const next: CertifiedLazyReadNodeState<NodeId, Node> = {
      fromInclude: current.fromInclude,
      fromExclude: current.fromExclude,
      read: true,
      successors: context.nodes.getSuccessors(node),
      node,
    };
    states.set(nodeId, next);
    return next;
  };

  const readIncludeNode = async (nodeId: NodeId): Promise<Node> => {
    const state = stateFor(nodeId);
    if (state.read) {
      span.incrementCounter("cache_hits");
      return state.node;
    }
    includeReads++;
    span.incrementCounter("include_reads");
    const node = await instrumentation.runAsync(DAG_INCLUDE_READ_SPAN, async () =>
      context.nodes.readNode(nodeId),
    );
    markRead(nodeId, node);
    return node;
  };

  const readExcludeNode = async (nodeId: NodeId): Promise<Node> => {
    const state = stateFor(nodeId);
    if (state.read) {
      span.incrementCounter("cache_hits");
      return state.node;
    }
    excludeReads++;
    span.incrementCounter("exclude_reads");
    const node = await instrumentation.runAsync(DAG_EXCLUDE_READ_SPAN, async () =>
      context.nodes.readNode(nodeId),
    );
    markRead(nodeId, node);
    return node;
  };

  await instrumentation.runAsync(DAG_COLLECT_REACHABLE_SPAN, async () => {
    markExcludeReached(excludeNodeId);
    const excludeStartNode = await readExcludeNode(excludeNodeId);
    const excludeStartSuccessors = context.nodes.getSuccessors(excludeStartNode);
    for (const successor of excludeStartSuccessors) markExcludeReached(successor);
    if (hasPathSplit(excludeStartSuccessors)) excludePathSplit = true;
    singleExcludeSuccessor =
      excludeStartSuccessors.length === 1 ? firstOrThrow(excludeStartSuccessors) : null;
  });

  const includeFrontier = options.createFrontier?.() ?? createDefaultDagQueue<NodeId>();
  includeFrontier.enqueue(nodeId);
  const includeExpanded = new Set<NodeId>();
  while (!includeFrontier.isEmpty()) {
    await instrumentation.runAsync(DAG_TRAVERSAL_STEP_SPAN, async () => {
      const nodeId = includeFrontier.dequeueOrThrow();
      const state = stateFor(nodeId);
      if (includeExpanded.has(nodeId)) return;
      if (state.fromExclude) {
        stopPoints.add(nodeId);
        await markExcludeSuccessors(nodeId);
        return;
      }

      state.fromInclude = true;
      includeExpanded.add(nodeId);
      const node = await readIncludeNode(nodeId);
      resultCandidates.set(nodeId, node);
      const successors = context.nodes.getSuccessors(node);
      if (successors.length === 0) {
        includePathReachedTerminal = true;
        return;
      }

      for (const successor of successors) {
        const successorState = stateFor(successor);
        if (successorState.fromExclude) stopPoints.add(successor);
        if (!includeExpanded.has(successor)) includeFrontier.enqueue(successor);
      }
    });
  }

  const certificateFailureReason = getCertificateFailureReason();

  if (certificateFailureReason !== undefined) {
    span.setAttribute("result", "fallback");
    span.setAttribute("fallback_reason", certificateFailureReason);
    const excludeReadsBeforeFallback = excludeReads;
    const candidatesBeforeFallback = resultCandidates.size;
    const excluded = await collectReachableUsingCachedReads(excludeNodeId);
    let removedCandidates = 0;
    for (const nodeId of excluded) {
      if (resultCandidates.delete(nodeId)) removedCandidates++;
    }
    const fallbackReads = excludeReads - excludeReadsBeforeFallback;
    if (fallbackReads > 0) span.incrementCounter("fallback_reads", fallbackReads);
    const boundedRemovedCandidates = Math.min(removedCandidates, candidatesBeforeFallback);
    if (boundedRemovedCandidates > 0) {
      span.incrementCounter("fallback_removed", boundedRemovedCandidates);
    }
  } else {
    span.setAttribute("result", "certified");
  }

  for (const node of resultCandidates.values()) {
    span.incrementCounter("yielded");
    yield node;
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

  async function markExcludeSuccessors(nodeId: NodeId): Promise<void> {
    await instrumentation.runAsync(DAG_COLLECT_REACHABLE_SPAN, async () => {
      const node = await readExcludeNode(nodeId);
      const successors = context.nodes.getSuccessors(node);
      for (const successor of successors) markExcludeReached(successor);
      if (hasPathSplit(successors)) excludePathSplit = true;
    });
  }

  async function collectReachableUsingCachedReads(startNodeId: NodeId): Promise<Set<NodeId>> {
    return await instrumentation.runAsync(DAG_COLLECT_REACHABLE_SPAN, async () => {
      return await collectReachableNodes([startNodeId], {
        async readNode(nodeId) {
          const state = stateFor(nodeId);
          return state.read ? state.node : await readExcludeNode(nodeId);
        },
        getSuccessors(node) {
          const successors = context.nodes.getSuccessors(node);
          for (const successor of successors) markExcludeReached(successor);
          return successors;
        },
      });
    });
  }
}

async function collectReachable<NodeId extends PropertyKey, Node>(
  context: InternalWalkDagContext<NodeId, Node>,
  startNodeId: NodeId,
): Promise<Set<NodeId>> {
  const { instrumentation, span } = context;
  return await instrumentation.runAsync(DAG_COLLECT_REACHABLE_SPAN, async () => {
    return await collectReachableNodes([startNodeId], {
      async readNode(nodeId) {
        span.incrementCounter("exclude_reads");
        return await instrumentation.runAsync(DAG_EXCLUDE_READ_SPAN, async () =>
          context.nodes.readNode(nodeId),
        );
      },
      getSuccessors: (node) => context.nodes.getSuccessors(node),
    });
  });
}

function instrumentDagTraversal<NodeId extends PropertyKey, Node>(
  context: WalkDagContext<NodeId, Node>,
  factory: (context: InternalWalkDagContext<NodeId, Node>) => AsyncIterable<Node>,
): AsyncIterable<Node> {
  return instrumentAsyncIterable(context.instrumentation, DAG_TRAVERSAL_SPAN, (span) =>
    factory({ ...context, span }),
  );
}

function createDefaultDagQueue<NodeId extends PropertyKey>(): WorkQueue<NodeId> {
  return new OrderedQueue<NodeId>({
    dequeueOrder: "fifo",
    blockOrder: "preserve",
  });
}

function hasPathSplit<NodeId>(successors: readonly NodeId[]): boolean {
  return successors.length > 1;
}
