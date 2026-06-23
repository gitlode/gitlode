import { type StageProfiler, withProfilerAsync } from "../profile/index.js";
import { firstOrThrow, shiftOrThrow } from "../support/index.js";

export type ReadSide = "include" | "exclude";

export interface DagNodePort<NodeId extends PropertyKey, Node> {
  /**
   * Reads a node by ID in the adapter-domain shape used by traversal.
   * Implementations should translate backend-specific node objects and read errors before they
   * cross into DAG traversal strategy code.
   */
  readNode(nodeId: NodeId, side: ReadSide): Promise<Node>;

  /**
   * Returns the node's parent IDs in deterministic traversal order.
   */
  getParents(node: Node): readonly NodeId[];
}

export interface WalkDagContext<NodeId extends PropertyKey, Node> {
  readonly nodes: DagNodePort<NodeId, Node>;
  readonly walkProfiler?: StageProfiler;
  readonly excludeCollectProfiler?: StageProfiler;
}

type WalkDagStrategy = "eagerExclude" | "certifiedLazy";

// Production default. Change this module-private selector back to "eagerExclude" to restore the
// previous traversal behavior while keeping both implementations available.
const configuredStrategy: WalkDagStrategy = "certifiedLazy";

export function walkDagWithConfiguredStrategy<NodeId extends PropertyKey, Node>(
  context: WalkDagContext<NodeId, Node>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
): AsyncIterable<Node> {
  switch (configuredStrategy) {
    case "eagerExclude":
      return walkDagEagerExclude(context, nodeId, excludeNodeId);
    case "certifiedLazy":
      return walkDagCertifiedLazy(context, nodeId, excludeNodeId);
  }
}

/**
 * Traverses DAG nodes by eagerly collecting every node reachable from `excludeNodeId` before
 * walking from the include-side starting node. This mirrors the original subtraction
 * implementation: build the complete excluded set first, then perform a FIFO include-side walk
 * that skips excluded and visited nodes.
 */
export async function* walkDagEagerExclude<NodeId extends PropertyKey, Node>(
  context: WalkDagContext<NodeId, Node>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
): AsyncIterable<Node> {
  const excluded =
    excludeNodeId !== undefined
      ? await collectReachable(context, excludeNodeId)
      : new Set<NodeId>();

  const queue: NodeId[] = [nodeId];
  const visited = new Set<NodeId>();

  while (queue.length > 0) {
    const next = await withProfilerAsync(context.walkProfiler, async () => {
      const nodeId = shiftOrThrow(queue);
      if (visited.has(nodeId) || excluded.has(nodeId)) return null;
      visited.add(nodeId);

      return context.nodes.readNode(nodeId, "include");
    });

    if (next === null) continue;

    yield next;

    for (const parent of context.nodes.getParents(next)) {
      if (!visited.has(parent) && !excluded.has(parent)) queue.push(parent);
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
  parents: readonly NodeId[];
  node: Node;
}

type CertifiedLazyNodeState<NodeId extends PropertyKey, Node> =
  | CertifiedLazyUnreadNodeState
  | CertifiedLazyReadNodeState<NodeId, Node>;

/**
 * Traverses nodes with a lazy two-sided view of the DAG. It buffers include-side candidates,
 * marks exclude-side stop points as they are encountered, and yields early only when a conservative
 * single-anchor certificate proves that older exclude ancestors cannot affect the result set.
 * If that certificate is not available, it falls back to a cached full exclude-reachable
 * collection before yielding.
 */
export async function* walkDagCertifiedLazy<NodeId extends PropertyKey, Node>(
  context: WalkDagContext<NodeId, Node>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
): AsyncIterable<Node> {
  if (excludeNodeId === undefined) {
    yield* walkDagEagerExclude(context, nodeId);
    return;
  }

  const states = new Map<NodeId, CertifiedLazyNodeState<NodeId, Node>>();
  const resultCandidates = new Map<NodeId, Node>();
  const stopPoints = new Set<NodeId>();
  let openIncludePathToRoot = false;
  let singleExcludeAnchor: NodeId | null = null;
  let excludeEncounteredMerge = false;

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
      parents: context.nodes.getParents(node),
      node,
    };
    states.set(nodeId, next);
    return next;
  };

  const readIncludeNode = async (nodeId: NodeId): Promise<Node> => {
    const state = stateFor(nodeId);
    if (state.read) return state.node;
    const node = await context.nodes.readNode(nodeId, "include");
    markRead(nodeId, node);
    return node;
  };

  const readExcludeNode = async (nodeId: NodeId): Promise<Node> => {
    const state = stateFor(nodeId);
    if (state.read) return state.node;
    const node = await context.nodes.readNode(nodeId, "exclude");
    markRead(nodeId, node);
    return node;
  };

  await withProfilerAsync(context.excludeCollectProfiler, async () => {
    markExcludeReached(excludeNodeId);
    const excludeStartNode = await readExcludeNode(excludeNodeId);
    const excludeStartParents = context.nodes.getParents(excludeStartNode);
    for (const parent of excludeStartParents) markExcludeReached(parent);
    if (excludeStartParents.length > 1) excludeEncounteredMerge = true;
    singleExcludeAnchor =
      excludeStartParents.length === 1 ? firstOrThrow(excludeStartParents) : null;
  });

  const includeFrontier: NodeId[] = [nodeId];
  const includeExpanded = new Set<NodeId>();
  while (includeFrontier.length > 0) {
    await withProfilerAsync(context.walkProfiler, async () => {
      const nodeId = shiftOrThrow(includeFrontier);
      const state = stateFor(nodeId);
      if (includeExpanded.has(nodeId)) return;
      if (state.fromExclude) {
        stopPoints.add(nodeId);
        await markExcludeParents(nodeId);
        return;
      }

      state.fromInclude = true;
      includeExpanded.add(nodeId);
      const node = await readIncludeNode(nodeId);
      resultCandidates.set(nodeId, node);
      const parents = context.nodes.getParents(node);
      if (parents.length === 0) {
        openIncludePathToRoot = true;
        return;
      }

      // Parent order is meaningful to the port (Git: parent[0] is first-parent/mainline).
      // We push onto the front, so iterate in reverse to preserve the supplied parent priority.
      parents
        .slice()
        .reverse()
        .forEach((parent) => {
          const parentState = stateFor(parent);
          if (parentState.fromExclude) stopPoints.add(parent);
          if (!includeExpanded.has(parent)) includeFrontier.unshift(parent);
        });
    });
  }

  if (!hasSingleAnchorCertificate()) {
    const excluded = await collectReachableFromCache(excludeNodeId);
    for (const nodeId of excluded) resultCandidates.delete(nodeId);
  }

  for (const node of resultCandidates.values()) {
    yield node;
  }

  function hasSingleAnchorCertificate(): boolean {
    if (openIncludePathToRoot || excludeEncounteredMerge || stopPoints.size === 0) {
      return false;
    }

    for (const stopPoint of stopPoints) {
      if (stopPoint !== excludeNodeId && stopPoint !== singleExcludeAnchor) return false;
    }
    return true;
  }

  async function markExcludeParents(nodeId: NodeId): Promise<void> {
    await withProfilerAsync(context.excludeCollectProfiler, async () => {
      const node = await readExcludeNode(nodeId);
      const parents = context.nodes.getParents(node);
      for (const parent of parents) markExcludeReached(parent);
      if (parents.length > 1) excludeEncounteredMerge = true;
    });
  }

  async function collectReachableFromCache(startNodeId: NodeId): Promise<Set<NodeId>> {
    return withProfilerAsync(context.excludeCollectProfiler, async () => {
      const reachable = new Set<NodeId>();
      const queue = [startNodeId];
      while (queue.length > 0) {
        const nodeId = shiftOrThrow(queue);
        if (reachable.has(nodeId)) continue;
        reachable.add(nodeId);
        const state = stateFor(nodeId);
        const parents = state.read
          ? state.parents
          : context.nodes.getParents(await readExcludeNode(nodeId));
        for (const parent of parents) {
          markExcludeReached(parent);
          queue.push(parent);
        }
      }
      return reachable;
    });
  }
}

async function collectReachable<NodeId extends PropertyKey, Node>(
  context: WalkDagContext<NodeId, Node>,
  startNodeId: NodeId,
): Promise<Set<NodeId>> {
  return withProfilerAsync(context.excludeCollectProfiler, async () => {
    const reachable = new Set<NodeId>();
    const queue: NodeId[] = [startNodeId];
    while (queue.length > 0) {
      const nodeId = shiftOrThrow(queue);
      if (reachable.has(nodeId)) continue;
      reachable.add(nodeId);
      const node = await context.nodes.readNode(nodeId, "exclude");
      for (const parent of context.nodes.getParents(node)) queue.push(parent);
    }
    return reachable;
  });
}
