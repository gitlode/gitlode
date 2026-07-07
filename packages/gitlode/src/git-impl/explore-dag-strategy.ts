import type { Brand } from "../type-utils/index.js";
import {
  collectReachableNodes,
  type DagNodePort,
  type WalkDagContext,
} from "./dag-traversal-strategy.js";

export type { DagNodePort, WalkDagContext } from "./dag-traversal-strategy.js";

/**
 * Prototype DAG traversal strategy using certified closure phases.
 *
 * This file is intentionally not wired into production traversal yet. It keeps the
 * split/branch/trigger/close-boundary rules executable while they mature toward a production
 * strategy.
 *
 * Refactoring target:
 *
 * - `walkDagPhaseCertifiedDifference()` should act as the coordinator. It owns the interleaving of
 *   include expansion and exclude certification phases, and it should make frontier additions and
 *   yield points visible from the main loop.
 * - Include graph bookkeeping should live in an include-side state object. It should own visited
 *   include nodes, cached node objects, expanded flags, and the derived parent/child links used for
 *   local classification.
 * - Certified exclude bookkeeping should live in an exclude-side state object. It should own the
 *   certified exclude set, absorb closure phase results, report include-side hits, and decide
 *   whether another exclude phase should start from a closed boundary.
 * - Certified hit classification should live in a resolver. It should classify include-side nodes
 *   into yieldable and excluded regions without mutating the traversal frontier.
 * - Closure phase traversal should be separated from closure phase state. The runner should read
 *   DAG nodes and drive frontier items; `CertifiedClosurePhase` should model split, branch, trigger,
 *   and close-boundary state transitions.
 *
 * The prototype output contract remains the same as `walkDagEagerExclude()`:
 * `reachable(start) - reachable(exclude)`. Yield order is not part of that contract.
 */

export type SplitId = Brand<number, "SplitId">;
export type BranchId = Brand<number, "BranchId">;
export type BranchGroupId = Brand<number, "BranchGroupId">;

export interface CertifiedClosureNodeState<NodeId extends PropertyKey, Node> {
  readonly nodeId: NodeId;
  readonly children: Set<NodeId>;
  readonly traversedBranches: Set<BranchId>;
  successors?: readonly NodeId[];
  node?: Node;
  reached: boolean;
  expanded: boolean;
  closedCover: boolean;
}

export interface SplitState<NodeId extends PropertyKey> {
  readonly id: SplitId;
  readonly openedAt: NodeId;
  readonly openedFromBranchId: BranchId;
  readonly branchIds: readonly BranchId[];
  readonly triggers: Set<NodeId>;
  resolved: boolean;
  closeBoundary?: NodeId;
}

export interface BranchState<NodeId extends PropertyKey> {
  readonly id: BranchId;
  readonly splitId: SplitId;
  readonly startedAt: NodeId;
  tip: NodeId;
  groupId: BranchGroupId;
}

export type CertifiedClosurePhaseResult<NodeId extends PropertyKey> =
  | {
      readonly kind: "closed-boundary";
      readonly certifiedNodes: ReadonlySet<NodeId>;
      readonly closedBoundary: NodeId;
    }
  | {
      readonly kind: "complete-exclude";
      readonly certifiedNodes: ReadonlySet<NodeId>;
      readonly rootTerminals: readonly NodeId[];
    };

export interface IncludeNodeState<NodeId extends PropertyKey, Node> {
  readonly nodeId: NodeId;
  readonly children: Set<NodeId>;
  readonly parents: Set<NodeId>;
  node?: Node;
  expanded: boolean;
}

export interface IncludeFrontierItem<NodeId extends PropertyKey> {
  readonly nodeId: NodeId;
}

export type IntegratedFrontierItem<NodeId extends PropertyKey> =
  | {
      readonly side: "include";
      readonly nodeId: NodeId;
    }
  | {
      readonly side: "exclude";
      readonly nodeId: NodeId;
    };

interface IncludePathClassification<NodeId extends PropertyKey> {
  readonly yieldable: Set<NodeId>;
  readonly excluded: Set<NodeId>;
}

interface FrontierItem<NodeId> {
  readonly nodeId: NodeId;
  readonly branchId: BranchId;
}

interface TriggerHit<NodeId> {
  readonly splitId: SplitId;
  readonly trigger: NodeId;
  readonly branchId: BranchId;
  readonly joinedBranchId: BranchId;
}

/**
 * Resolves one closure phase until it can prove a closed boundary, or until there is no frontier
 * left. The function is deliberately small-scope: it models only certified closure and does not
 * attempt include-side yielding.
 */
export async function resolveDagCertifiedClosurePhase<NodeId extends PropertyKey, Node>(
  context: WalkDagContext<NodeId, Node>,
  startId: NodeId,
): Promise<CertifiedClosurePhaseResult<NodeId>> {
  const { nodes } = context;
  const phase = new CertifiedClosurePhase<NodeId, Node>(startId);
  const frontier: FrontierItem<NodeId>[] = [{ nodeId: startId, branchId: phase.rootBranchId }];

  while (frontier.length > 0 && !phase.hasClosedBoundary()) {
    const item = frontier.shift();
    if (item === undefined) break;

    const state = phase.stateFor(item.nodeId);
    if (state.traversedBranches.has(item.branchId)) continue;

    if (state.expanded) {
      frontier.push(...phase.resolveBranchByKnownNode(item.branchId, item.nodeId));
    }

    const successors = state.expanded
      ? state.successors
      : nodes.getSuccessors(await nodes.readNode(item.nodeId));
    if (successors === undefined) throw new Error("Expected successors for expanded node.");
    if (!state.expanded) phase.markExpanded(item.nodeId, successors);
    phase.markTraversed(item.nodeId, item.branchId);

    if (successors.length === 0) {
      phase.markRootEscape(item.nodeId);
      continue;
    }

    if (successors.length === 1) {
      const successor = successors[0];
      if (successor === undefined) throw new Error("Expected single successor.");
      phase.recordEdge(item.nodeId, successor);
      const hit = phase.reachSuccessorFromBranch(item.branchId, successor);
      if (hit !== undefined) frontier.push(...phase.resolveBranchByTrigger(hit));
      if (!phase.stateFor(successor).expanded) {
        frontier.push({ nodeId: successor, branchId: item.branchId });
      }
      continue;
    }

    const childSplit = phase.openSplit(item.nodeId, item.branchId, successors);
    for (const branchId of childSplit.branchIds) {
      const branch = phase.getBranchStateOrThrow(branchId);
      phase.recordEdge(item.nodeId, branch.startedAt);
      const hit = phase.reachSuccessorFromBranch(branch.id, branch.startedAt);
      if (hit !== undefined) frontier.push(...phase.resolveBranchByTrigger(hit));
      if (!phase.stateFor(branch.startedAt).expanded) {
        frontier.push({ nodeId: branch.startedAt, branchId: branch.id });
      }
    }
  }

  return phase.toResult();
}

/**
 * Walks the DAG difference by alternating include expansion with exclude certification phases.
 * This is still a prototype strategy and is not wired into production traversal yet.
 */
export async function* walkDagPhaseCertifiedDifference<NodeId extends PropertyKey, Node>(
  context: WalkDagContext<NodeId, Node>,
  startId: NodeId,
  excludeStartId: NodeId,
): AsyncIterable<Node> {
  const { nodes } = context;
  const state = new IntegratedDifferenceState<NodeId, Node>(nodes);
  state.initializeInclude(startId);

  const frontier: IntegratedFrontierItem<NodeId>[] = [
    { side: "include", nodeId: startId },
    { side: "exclude", nodeId: excludeStartId },
  ];

  while (frontier.length > 0) {
    const item = frontier.shift();
    if (item === undefined) break;

    if (item.side === "include") {
      yield* state.expandInclude(item, frontier);
      continue;
    }

    const closure = await resolveDagCertifiedClosurePhase(context, item.nodeId);
    yield* state.applyCertification(closure);
    if (closure.kind === "closed-boundary") {
      frontier.push({ side: "exclude", nodeId: closure.closedBoundary });
    }
  }

  yield* state.drainRemainingInclude();
}

export class CertifiedClosurePhase<NodeId extends PropertyKey, Node = unknown> {
  readonly rootBranchId: BranchId;

  private nextSplitId: SplitId = 1 as SplitId;
  private nextBranchId: BranchId = 1 as BranchId;
  private nextBranchGroupId: BranchGroupId = 1 as BranchGroupId;
  private closedBoundary?: NodeId;
  private readonly states = new Map<NodeId, CertifiedClosureNodeState<NodeId, Node>>();
  private readonly branches = new Map<BranchId, BranchState<NodeId>>();
  private readonly splits = new Map<SplitId, SplitState<NodeId>>();
  private readonly reachedByBranch = new Map<NodeId, Set<BranchId>>();
  private readonly rootEscapes = new Set<NodeId>();

  constructor(startId: NodeId) {
    this.rootBranchId = 0 as BranchId;
    this.stateFor(startId).closedCover = true;
    this.branches.set(this.rootBranchId, {
      id: this.rootBranchId,
      splitId: 0 as SplitId,
      startedAt: startId,
      tip: startId,
      groupId: 0 as BranchGroupId,
    });
    this.reachNode(startId, this.rootBranchId);
  }

  hasClosedBoundary(): boolean {
    return this.closedBoundary !== undefined;
  }

  stateFor(nodeId: NodeId): CertifiedClosureNodeState<NodeId, Node> {
    let state = this.states.get(nodeId);
    if (state === undefined) {
      state = {
        nodeId,
        children: new Set<NodeId>(),
        traversedBranches: new Set<BranchId>(),
        reached: false,
        expanded: false,
        closedCover: false,
      };
      this.states.set(nodeId, state);
    }
    return state;
  }

  getBranchStateOrThrow(branchId: BranchId): BranchState<NodeId> {
    const branch = this.branches.get(branchId);
    if (branch === undefined) throw new Error(`Unknown branch: ${branchId}`);
    return branch;
  }

  markExpanded(nodeId: NodeId, successors: readonly NodeId[]): void {
    const state = this.stateFor(nodeId);
    state.successors = successors;
    state.reached = true;
    state.expanded = true;
  }

  markTraversed(nodeId: NodeId, branchId: BranchId): void {
    this.stateFor(nodeId).traversedBranches.add(branchId);
  }

  markRootEscape(nodeId: NodeId): void {
    this.rootEscapes.add(nodeId);
  }

  recordEdge(childId: NodeId, parentId: NodeId): void {
    this.stateFor(parentId).children.add(childId);
  }

  openSplit(
    openedAt: NodeId,
    openedFromBranchId: BranchId,
    successors: readonly NodeId[],
  ): SplitState<NodeId> {
    const splitId = this.nextSplitId++ as SplitId;
    const branchIds = successors.map((successor) => {
      const branchId = this.nextBranchId++ as BranchId;
      this.branches.set(branchId, {
        id: branchId,
        splitId,
        startedAt: successor,
        tip: successor,
        groupId: this.nextBranchGroupId++ as BranchGroupId,
      });
      return branchId;
    });

    const split: SplitState<NodeId> = {
      id: splitId,
      openedAt,
      openedFromBranchId,
      branchIds,
      triggers: new Set<NodeId>(),
      resolved: false,
    };
    this.splits.set(splitId, split);
    return split;
  }

  reachSuccessorFromBranch(
    branchId: BranchId,
    successorId: NodeId,
  ): TriggerHit<NodeId> | undefined {
    const branch = this.getBranchStateOrThrow(branchId);
    branch.tip = successorId;
    const joinedBranchId = this.reachNode(successorId, branchId, branch.splitId);
    if (joinedBranchId === undefined) return undefined;
    return {
      splitId: branch.splitId,
      trigger: successorId,
      branchId,
      joinedBranchId,
    };
  }

  resolveBranchByKnownNode(branchId: BranchId, knownNodeId: NodeId): FrontierItem<NodeId>[] {
    const branch = this.getBranchStateOrThrow(branchId);
    const joinedBranchId = this.findJoinedBranchAtNode(branch.splitId, branchId, knownNodeId);
    if (joinedBranchId === undefined) return [];
    return this.resolveBranchByTrigger({
      splitId: branch.splitId,
      trigger: knownNodeId,
      branchId,
      joinedBranchId,
    });
  }

  resolveBranchByTrigger(hit: TriggerHit<NodeId>): FrontierItem<NodeId>[] {
    const split = this.getSplitStateOrThrow(hit.splitId);
    if (split.resolved) return [];
    split.triggers.add(hit.trigger);
    this.joinBranchGroups(hit.branchId, hit.joinedBranchId);

    const boundary = this.findCloseBoundary(split);
    if (boundary === undefined) return [];

    return this.closeSplit(split, boundary);
  }

  private closeSplit(split: SplitState<NodeId>, boundary: NodeId): FrontierItem<NodeId>[] {
    split.resolved = true;
    split.closeBoundary = boundary;
    this.markClosedRegion(split.openedAt, boundary);

    const parentBranch = this.getBranchStateOrThrow(split.openedFromBranchId);
    parentBranch.tip = boundary;
    if (parentBranch.splitId === (0 as SplitId)) {
      this.closedBoundary = boundary;
      return [];
    }

    const joinedBranchId = this.reachNode(boundary, parentBranch.id, parentBranch.splitId);
    if (joinedBranchId !== undefined) {
      const parentFrontier = this.resolveBranchByTrigger({
        splitId: parentBranch.splitId,
        trigger: boundary,
        branchId: parentBranch.id,
        joinedBranchId,
      });
      if (parentFrontier.length > 0 || this.hasClosedBoundary()) return parentFrontier;
    }

    return [{ nodeId: boundary, branchId: parentBranch.id }];
  }

  toResult(): CertifiedClosurePhaseResult<NodeId> {
    if (this.closedBoundary !== undefined) {
      return {
        kind: "closed-boundary",
        certifiedNodes: new Set(
          [...this.states.values()]
            .filter((state) => state.closedCover)
            .map((state) => state.nodeId),
        ),
        closedBoundary: this.closedBoundary,
      };
    }

    return {
      kind: "complete-exclude",
      certifiedNodes: new Set(
        [...this.states.values()].filter((state) => state.reached).map((state) => state.nodeId),
      ),
      rootTerminals: [...this.rootEscapes],
    };
  }

  private reachNode(nodeId: NodeId, branchId: BranchId, splitId?: SplitId): BranchId | undefined {
    const state = this.stateFor(nodeId);
    state.reached = true;

    let reached = this.reachedByBranch.get(nodeId);
    if (reached === undefined) {
      reached = new Set<BranchId>();
      this.reachedByBranch.set(nodeId, reached);
    }

    const joinedBranchId =
      splitId === undefined
        ? undefined
        : [...reached].find((candidate) => {
            const branch = this.getBranchStateOrThrow(candidate);
            const currentBranch = this.getBranchStateOrThrow(branchId);
            return (
              branch.splitId === splitId &&
              candidate !== branchId &&
              branch.groupId !== currentBranch.groupId
            );
          });

    reached.add(branchId);
    return joinedBranchId;
  }

  private findJoinedBranchAtNode(
    splitId: SplitId,
    branchId: BranchId,
    nodeId: NodeId,
  ): BranchId | undefined {
    const reached = this.reachedByBranch.get(nodeId);
    if (reached === undefined) return undefined;
    return [...reached].find((candidate) => {
      const branch = this.getBranchStateOrThrow(candidate);
      const currentBranch = this.getBranchStateOrThrow(branchId);
      return (
        branch.splitId === splitId &&
        candidate !== branchId &&
        branch.groupId !== currentBranch.groupId
      );
    });
  }

  private joinBranchGroups(leftBranchId: BranchId, rightBranchId: BranchId): void {
    const left = this.getBranchStateOrThrow(leftBranchId);
    const right = this.getBranchStateOrThrow(rightBranchId);
    if (left.groupId === right.groupId) return;

    const from = right.groupId;
    const to = left.groupId;
    for (const branch of this.branches.values()) {
      if (branch.splitId === left.splitId && branch.groupId === from) {
        branch.groupId = to;
      }
    }
  }

  private findCloseBoundary(split: SplitState<NodeId>): NodeId | undefined {
    const groupIds = new Set(
      split.branchIds.map((branchId) => this.getBranchStateOrThrow(branchId).groupId),
    );
    if (groupIds.size !== 1) return undefined;

    const dominated = new Set<NodeId>();
    for (const trigger of split.triggers) {
      for (const seen of this.walkChildrenUntil(trigger, split.openedAt)) {
        if (seen !== trigger && split.triggers.has(seen)) dominated.add(seen);
      }
    }

    const candidates = [...split.triggers].filter((trigger) => !dominated.has(trigger));
    return candidates.length === 1 ? candidates[0] : undefined;
  }

  private *walkChildrenUntil(from: NodeId, stop: NodeId): Iterable<NodeId> {
    const stack = [from];
    const seen = new Set<NodeId>();

    while (stack.length > 0) {
      const nodeId = stack.pop();
      if (nodeId === undefined || seen.has(nodeId)) continue;
      seen.add(nodeId);
      yield nodeId;
      if (nodeId === stop) continue;
      for (const child of this.stateFor(nodeId).children) stack.push(child);
    }
  }

  private markClosedRegion(openedAt: NodeId, boundary: NodeId): void {
    for (const nodeId of this.walkChildrenUntil(boundary, openedAt)) {
      this.stateFor(nodeId).closedCover = true;
    }
  }

  private getSplitStateOrThrow(splitId: SplitId): SplitState<NodeId> {
    const split = this.splits.get(splitId);
    if (split === undefined) throw new Error(`Unknown split: ${splitId}`);
    return split;
  }
}

export class IntegratedDifferenceState<NodeId extends PropertyKey, Node = unknown> {
  // CertifiedExcludeState responsibility: track nodes proven to be on the exclude side.
  private readonly nodes: DagNodePort<NodeId, Node>;
  private readonly certifiedExclude = new Set<NodeId>();

  // IncludeGraphState responsibility: cache include-side nodes and maintain the local graph used
  // to classify certified hits.
  private readonly includeVisited = new Map<NodeId, IncludeNodeState<NodeId, Node>>();

  constructor(nodes: DagNodePort<NodeId, Node>) {
    this.nodes = nodes;
  }

  initializeInclude(startId: NodeId): void {
    this.stateFor(startId);
  }

  // IncludeGraphState responsibility.
  stateFor(nodeId: NodeId): IncludeNodeState<NodeId, Node> {
    let state = this.includeVisited.get(nodeId);
    if (state === undefined) {
      state = {
        nodeId,
        children: new Set<NodeId>(),
        parents: new Set<NodeId>(),
        expanded: false,
      };
      this.includeVisited.set(nodeId, state);
    }
    return state;
  }

  // Coordinator + IncludeGraphState responsibility. This currently reads include nodes, mutates
  // the shared frontier, and can yield nodes indirectly through certified-hit resolution.
  async *expandInclude(
    item: IncludeFrontierItem<NodeId>,
    frontier: IntegratedFrontierItem<NodeId>[],
  ): AsyncIterable<Node> {
    const state = this.includeVisited.get(item.nodeId);
    if (state === undefined) return;

    if (this.certifiedExclude.has(item.nodeId)) {
      yield* this.resolveCertifiedHits(new Set([item.nodeId]));
      return;
    }

    if (state.expanded) return;
    if (state.children.size === 0 && state.node !== undefined) return;

    const node = await this.nodes.readNode(item.nodeId);
    const parents = this.nodes.getSuccessors(node);
    this.markExpanded(item.nodeId, node, parents);
    for (const parent of parents) {
      const parentState = this.stateFor(parent);
      parentState.children.add(item.nodeId);
      state.parents.add(parent);
      frontier.push({ side: "include", nodeId: parent });
    }
  }

  // IncludeGraphState responsibility.
  private markExpanded(nodeId: NodeId, node: Node, parents: readonly NodeId[]): void {
    const state = this.stateFor(nodeId);
    state.node = node;
    state.expanded = true;
    for (const parent of parents) {
      state.parents.add(parent);
    }
  }

  // CertifiedExcludeState + CertifiedHitResolver responsibility. This currently absorbs closure
  // results, finds include-side hits, classifies the affected include graph, deletes excluded
  // nodes, and yields newly safe nodes.
  async *applyCertification(closure: CertifiedClosurePhaseResult<NodeId>): AsyncIterable<Node> {
    const hits = new Set<NodeId>();
    for (const nodeId of closure.certifiedNodes) {
      this.certifiedExclude.add(nodeId);
      if (this.includeVisited.has(nodeId)) hits.add(nodeId);
    }
    yield* this.resolveCertifiedHits(hits);
  }

  // CertifiedHitResolver responsibility.
  private async *resolveCertifiedHits(hits: ReadonlySet<NodeId>): AsyncIterable<Node> {
    if (hits.size === 0) return;

    const classification = await this.classifyFromHits(hits);
    for (const nodeId of hits) classification.excluded.add(nodeId);

    for (const nodeId of classification.excluded) {
      this.deleteIncludeVisited(nodeId);
    }

    for (const nodeId of classification.yieldable) {
      if (classification.excluded.has(nodeId)) continue;
      const state = this.includeVisited.get(nodeId);
      if (state?.node === undefined || this.certifiedExclude.has(nodeId)) continue;
      this.deleteIncludeVisited(nodeId);
      yield state.node;
    }
  }

  // CertifiedHitResolver responsibility.
  private async classifyFromHits(
    hits: ReadonlySet<NodeId>,
  ): Promise<IncludePathClassification<NodeId>> {
    const newerSide = await collectReachableNodes(hits, this.includeChildrenPort());
    const olderSide = await collectReachableNodes(hits, this.includeParentsPort());
    const excluded = new Set(olderSide);
    const yieldable = difference(newerSide, excluded);

    for (const hit of hits) {
      yieldable.delete(hit);
      excluded.add(hit);
    }

    return { yieldable, excluded };
  }

  // Coordinator + IncludeGraphState responsibility. The final drain is a coordinator decision; the
  // graph deletion and node cache access belong to include-side state.
  *drainRemainingInclude(): Iterable<Node> {
    const nodeIds = [...this.includeVisited.keys()];
    for (const nodeId of nodeIds) {
      const state = this.includeVisited.get(nodeId);
      if (state?.node === undefined || this.certifiedExclude.has(nodeId)) continue;
      this.deleteIncludeVisited(nodeId);
      yield state.node;
    }
  }

  // IncludeGraphState responsibility.
  private deleteIncludeVisited(nodeId: NodeId): void {
    const state = this.includeVisited.get(nodeId);
    if (state === undefined) return;

    for (const parent of state.parents) {
      this.includeVisited.get(parent)?.children.delete(nodeId);
    }
    for (const child of state.children) {
      this.includeVisited.get(child)?.parents.delete(nodeId);
    }
    this.includeVisited.delete(nodeId);
  }

  // IncludeGraphState responsibility.
  private includeChildrenPort(): DagNodePort<NodeId, IncludeNodeState<NodeId, Node>> {
    return {
      readNode: async (nodeId) => this.readIncludeVisitedNode(nodeId),
      getSuccessors: (node) => [...node.children],
    };
  }

  // IncludeGraphState responsibility.
  private includeParentsPort(): DagNodePort<NodeId, IncludeNodeState<NodeId, Node>> {
    return {
      readNode: async (nodeId) => this.readIncludeVisitedNode(nodeId),
      getSuccessors: (node) => [...node.parents],
    };
  }

  // IncludeGraphState responsibility.
  private readIncludeVisitedNode(nodeId: NodeId): IncludeNodeState<NodeId, Node> {
    const state = this.includeVisited.get(nodeId);
    if (state === undefined) throw new Error("Expected include visited node.");
    return state;
  }
}

function difference<NodeId extends PropertyKey>(
  left: ReadonlySet<NodeId>,
  right: ReadonlySet<NodeId>,
): Set<NodeId> {
  const result = new Set<NodeId>();
  for (const item of left) {
    if (!right.has(item)) result.add(item);
  }
  return result;
}
