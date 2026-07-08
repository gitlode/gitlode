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
 *   include nodes, cached node objects, expanded flags, and the derived successor/predecessor links
 *   used for local classification.
 * - Certified exclude bookkeeping should live in an exclude-side state object. It should own the
 *   certified exclude set, absorb closure phase results, report include-side hits, and decide
 *   whether another exclude phase should start from a closed boundary.
 * - Certified hit classification should live in a focused helper. It should classify include-side
 *   nodes into yieldable and excluded regions without mutating the traversal frontier.
 * - Closure phase traversal should keep its main loop visible in
 *   `resolveDagCertifiedClosurePhase()`. The loop should drive frontier items; `CertifiedClosurePhase`
 *   should own split, branch, trigger, and close-boundary transitions while `ClosureGraphState`
 *   owns closure-side node reads, expansion cache, and graph links.
 *
 * The prototype output contract remains the same as `walkDagEagerExclude()`:
 * `reachable(start) - reachable(exclude)`. Yield order is not part of that contract.
 */

export type SplitId = Brand<number, "SplitId">;
export type BranchId = Brand<number, "BranchId">;
export type BranchGroupId = Brand<number, "BranchGroupId">;

interface CertifiedClosureNodeStateBase<NodeId extends PropertyKey> {
  readonly nodeId: NodeId;
  readonly predecessors: Set<NodeId>;
  readonly traversedBranches: Set<BranchId>;
  reached: boolean;
  closedCover: boolean;
}

export type CertifiedClosureNodeState<NodeId extends PropertyKey, Node> =
  | (CertifiedClosureNodeStateBase<NodeId> & {
      readonly expanded: false;
    })
  | (CertifiedClosureNodeStateBase<NodeId> & {
      readonly expanded: true;
      readonly node: Node;
      readonly successors: readonly NodeId[];
    });

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
      readonly kind: "exhausted";
      readonly certifiedNodes: ReadonlySet<NodeId>;
      readonly terminalNodes: readonly NodeId[];
    };

interface IncludeNodeStateBase<NodeId extends PropertyKey> {
  readonly nodeId: NodeId;
  readonly predecessors: Set<NodeId>;
  readonly successors: Set<NodeId>;
}

export type IncludeNodeState<NodeId extends PropertyKey, Node> =
  | (IncludeNodeStateBase<NodeId> & {
      readonly expanded: false;
    })
  | (IncludeNodeStateBase<NodeId> & {
      readonly expanded: true;
      readonly node: Node;
    });

export type IncludeExpansionResult<NodeId extends PropertyKey> =
  | {
      readonly kind: "expanded";
      readonly enqueue: readonly NodeId[];
    }
  | {
      readonly kind: "skipped";
      readonly reason: "stale" | "certified-hit" | "already-expanded";
    };

export type DifferenceFrontierItem<NodeId extends PropertyKey> =
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

interface ClosureFrontierItem<NodeId> {
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
  const phase = new CertifiedClosurePhase<NodeId, Node>(nodes, startId);
  const frontier: ClosureFrontierItem<NodeId>[] = [
    { nodeId: startId, branchId: phase.rootBranchId },
  ];

  while (frontier.length > 0 && !phase.hasClosedBoundary()) {
    const item = frontier.shift();
    if (item === undefined) break;

    frontier.push(...(await phase.advance(item)));
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

  const frontier: DifferenceFrontierItem<NodeId>[] = [
    { side: "include", nodeId: startId },
    { side: "exclude", nodeId: excludeStartId },
  ];

  while (frontier.length > 0) {
    const item = frontier.shift();
    if (item === undefined) break;

    if (item.side === "include") {
      const expansion = await state.expandInclude(item.nodeId);
      if (expansion.kind === "skipped" && expansion.reason === "certified-hit") {
        yield* state.applyCertifiedHits(new Set([item.nodeId]));
        continue;
      }
      if (expansion.kind === "expanded") {
        for (const nodeId of expansion.enqueue) {
          frontier.push({ side: "include", nodeId });
        }
      }
      continue;
    }

    const closure = await resolveDagCertifiedClosurePhase(context, item.nodeId);
    yield* state.applyCertification(closure);
    const nextExcludeStart = state.nextExcludePhaseStart(closure);
    if (nextExcludeStart !== undefined) {
      frontier.push({ side: "exclude", nodeId: nextExcludeStart });
    }
  }

  yield* state.drainRemainingInclude();
}

export class CertifiedClosurePhase<NodeId extends PropertyKey, Node = unknown> {
  readonly rootBranchId: BranchId;

  private readonly graph: ClosureGraphState<NodeId, Node>;
  private nextSplitId: SplitId = 1 as SplitId;
  private nextBranchId: BranchId = 1 as BranchId;
  private nextBranchGroupId: BranchGroupId = 1 as BranchGroupId;
  private closedBoundary?: NodeId;
  private readonly branches = new Map<BranchId, BranchState<NodeId>>();
  private readonly splits = new Map<SplitId, SplitState<NodeId>>();
  private readonly reachedByBranch = new Map<NodeId, Set<BranchId>>();
  private readonly terminalNodes = new Set<NodeId>();

  constructor(nodes: DagNodePort<NodeId, Node>, startId: NodeId) {
    this.graph = new ClosureGraphState(nodes);
    this.rootBranchId = 0 as BranchId;
    this.graph.stateFor(startId).closedCover = true;
    this.branches.set(this.rootBranchId, {
      id: this.rootBranchId,
      splitId: 0 as SplitId,
      startedAt: startId,
      tip: startId,
      groupId: 0 as BranchGroupId,
    });
    this.reachNode(startId, this.rootBranchId);
  }

  async advance(item: ClosureFrontierItem<NodeId>): Promise<ClosureFrontierItem<NodeId>[]> {
    const state = this.graph.stateFor(item.nodeId);
    if (state.traversedBranches.has(item.branchId)) return [];

    const frontier = state.expanded
      ? this.resolveBranchByKnownNode(item.branchId, item.nodeId)
      : [];

    const successors = await this.graph.expand(item.nodeId);
    this.markTraversed(item.nodeId, item.branchId);

    if (successors.length === 0) {
      this.markTerminal(item.nodeId);
      return frontier;
    }

    if (successors.length === 1) {
      const successor = successors[0];
      if (successor === undefined) throw new Error("Expected single successor.");
      frontier.push(...this.advanceSingleSuccessor(item, successor));
      return frontier;
    }

    frontier.push(...this.advanceSplitSuccessors(item, successors));
    return frontier;
  }

  hasClosedBoundary(): boolean {
    return this.closedBoundary !== undefined;
  }

  private advanceSingleSuccessor(
    item: ClosureFrontierItem<NodeId>,
    successor: NodeId,
  ): ClosureFrontierItem<NodeId>[] {
    this.recordTraversedEdge(item.nodeId, successor);
    const hit = this.reachSuccessorFromBranch(item.branchId, successor);
    const frontier = hit === undefined ? [] : this.resolveBranchByTrigger(hit);
    if (!this.graph.stateFor(successor).expanded) {
      frontier.push({ nodeId: successor, branchId: item.branchId });
    }
    return frontier;
  }

  private advanceSplitSuccessors(
    item: ClosureFrontierItem<NodeId>,
    successors: readonly NodeId[],
  ): ClosureFrontierItem<NodeId>[] {
    const frontier: ClosureFrontierItem<NodeId>[] = [];
    const childSplit = this.openSplit(item.nodeId, item.branchId, successors);
    for (const branchId of childSplit.branchIds) {
      const branch = this.getBranchStateOrThrow(branchId);
      this.recordTraversedEdge(item.nodeId, branch.startedAt);
      const hit = this.reachSuccessorFromBranch(branch.id, branch.startedAt);
      if (hit !== undefined) frontier.push(...this.resolveBranchByTrigger(hit));
      if (!this.graph.stateFor(branch.startedAt).expanded) {
        frontier.push({ nodeId: branch.startedAt, branchId: branch.id });
      }
    }
    return frontier;
  }

  private openSplit(
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

  private reachSuccessorFromBranch(
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

  private resolveBranchByKnownNode(
    branchId: BranchId,
    knownNodeId: NodeId,
  ): ClosureFrontierItem<NodeId>[] {
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

  private resolveBranchByTrigger(hit: TriggerHit<NodeId>): ClosureFrontierItem<NodeId>[] {
    const split = this.getSplitStateOrThrow(hit.splitId);
    if (split.resolved) return [];
    split.triggers.add(hit.trigger);
    this.joinBranchGroups(hit.branchId, hit.joinedBranchId);

    const boundary = this.findCloseBoundary(split);
    if (boundary === undefined) return [];

    return this.closeSplit(split, boundary);
  }

  private getBranchStateOrThrow(branchId: BranchId): BranchState<NodeId> {
    const branch = this.branches.get(branchId);
    if (branch === undefined) throw new Error(`Unknown branch: ${branchId}`);
    return branch;
  }

  private markTraversed(nodeId: NodeId, branchId: BranchId): void {
    this.graph.stateFor(nodeId).traversedBranches.add(branchId);
  }

  private markTerminal(nodeId: NodeId): void {
    this.terminalNodes.add(nodeId);
  }

  private recordTraversedEdge(nodeId: NodeId, successorId: NodeId): void {
    this.graph.recordTraversedEdge(nodeId, successorId);
  }

  private closeSplit(split: SplitState<NodeId>, boundary: NodeId): ClosureFrontierItem<NodeId>[] {
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
          [...this.graph.states()]
            .filter((state) => state.closedCover)
            .map((state) => state.nodeId),
        ),
        closedBoundary: this.closedBoundary,
      };
    }

    return {
      kind: "exhausted",
      certifiedNodes: new Set(
        [...this.graph.states()].filter((state) => state.reached).map((state) => state.nodeId),
      ),
      terminalNodes: [...this.terminalNodes],
    };
  }

  private reachNode(nodeId: NodeId, branchId: BranchId, splitId?: SplitId): BranchId | undefined {
    const state = this.graph.stateFor(nodeId);
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
      for (const seen of this.walkPredecessorsUntil(trigger, split.openedAt)) {
        if (seen !== trigger && split.triggers.has(seen)) dominated.add(seen);
      }
    }

    const candidates = [...split.triggers].filter((trigger) => !dominated.has(trigger));
    return candidates.length === 1 ? candidates[0] : undefined;
  }

  private *walkPredecessorsUntil(from: NodeId, stop: NodeId): Iterable<NodeId> {
    yield* this.graph.walkPredecessorsUntil(from, stop);
  }

  private markClosedRegion(openedAt: NodeId, boundary: NodeId): void {
    for (const nodeId of this.walkPredecessorsUntil(boundary, openedAt)) {
      this.graph.stateFor(nodeId).closedCover = true;
    }
  }

  private getSplitStateOrThrow(splitId: SplitId): SplitState<NodeId> {
    const split = this.splits.get(splitId);
    if (split === undefined) throw new Error(`Unknown split: ${splitId}`);
    return split;
  }
}

/**
 * Stores the closure phase's explored DAG view.
 *
 * Unlike `IncludeGraphState`, this graph does not record every edge immediately when a node is
 * expanded. The closure phase decides when an edge has become part of a branch traversal, then calls
 * `recordTraversedEdge()`. The graph only needs predecessor links for walking back through the
 * certified closed region.
 */
class ClosureGraphState<NodeId extends PropertyKey, Node = unknown> {
  private readonly nodes: DagNodePort<NodeId, Node>;
  private readonly visited = new Map<NodeId, CertifiedClosureNodeState<NodeId, Node>>();

  constructor(nodes: DagNodePort<NodeId, Node>) {
    this.nodes = nodes;
  }

  stateFor(nodeId: NodeId): CertifiedClosureNodeState<NodeId, Node> {
    let state = this.visited.get(nodeId);
    if (state === undefined) {
      state = {
        nodeId,
        predecessors: new Set<NodeId>(),
        traversedBranches: new Set<BranchId>(),
        reached: false,
        expanded: false,
        closedCover: false,
      };
      this.visited.set(nodeId, state);
    }
    return state;
  }

  async expand(nodeId: NodeId): Promise<readonly NodeId[]> {
    const state = this.stateFor(nodeId);
    if (state.expanded) {
      return state.successors;
    }

    const node = await this.nodes.readNode(nodeId);
    const successors = this.nodes.getSuccessors(node);
    this.markExpanded(nodeId, node, successors);
    return successors;
  }

  private markExpanded(nodeId: NodeId, node: Node, successors: readonly NodeId[]): void {
    const state = this.stateFor(nodeId);
    this.visited.set(nodeId, {
      ...state,
      expanded: true,
      node,
      reached: true,
      successors,
    });
  }

  recordTraversedEdge(nodeId: NodeId, successorId: NodeId): void {
    this.stateFor(successorId).predecessors.add(nodeId);
  }

  states(): Iterable<CertifiedClosureNodeState<NodeId, Node>> {
    return this.visited.values();
  }

  *walkPredecessorsUntil(from: NodeId, stop: NodeId): Iterable<NodeId> {
    const stack = [from];
    const seen = new Set<NodeId>();

    while (stack.length > 0) {
      const nodeId = stack.pop();
      if (nodeId === undefined || seen.has(nodeId)) continue;
      seen.add(nodeId);
      yield nodeId;
      if (nodeId === stop) continue;
      for (const predecessor of this.stateFor(nodeId).predecessors) stack.push(predecessor);
    }
  }
}

export class IntegratedDifferenceState<NodeId extends PropertyKey, Node = unknown> {
  private readonly includeGraph: IncludeGraphState<NodeId, Node>;
  private readonly certifiedExclude = new CertifiedExcludeState<NodeId>();

  constructor(nodes: DagNodePort<NodeId, Node>) {
    this.includeGraph = new IncludeGraphState(nodes);
  }

  initializeInclude(startId: NodeId): void {
    this.includeGraph.initialize(startId);
  }

  stateFor(nodeId: NodeId): IncludeNodeState<NodeId, Node> {
    return this.includeGraph.stateFor(nodeId);
  }

  // Difference-state policy plus include-side graph expansion. The returned result tells the
  // coordinator whether to enqueue more include work or resolve a certified hit.
  async expandInclude(nodeId: NodeId): Promise<IncludeExpansionResult<NodeId>> {
    const state = this.includeGraph.get(nodeId);
    if (state === undefined) return { kind: "skipped", reason: "stale" };

    if (this.certifiedExclude.has(nodeId)) {
      return { kind: "skipped", reason: "certified-hit" };
    }

    if (state.expanded) return { kind: "skipped", reason: "already-expanded" };

    const successors = await this.includeGraph.expand(nodeId);

    return { kind: "expanded", enqueue: successors };
  }

  // Coordinator + certified-hit application responsibility. Exclude state absorbs the closure;
  // this method applies the resulting include-side hits to the include graph.
  async *applyCertification(closure: CertifiedClosurePhaseResult<NodeId>): AsyncIterable<Node> {
    const hits = this.certifiedExclude.absorbClosure(closure, this.includeGraph);
    yield* this.applyCertifiedHits(hits);
  }

  async *applyCertifiedHits(hits: ReadonlySet<NodeId>): AsyncIterable<Node> {
    yield* resolveCertifiedHits(this.includeGraph, this.certifiedExclude, hits);
  }

  nextExcludePhaseStart(closure: CertifiedClosurePhaseResult<NodeId>): NodeId | undefined {
    return this.certifiedExclude.nextPhaseStart(closure);
  }

  // Coordinator + IncludeGraphState responsibility. The final drain is a coordinator decision; the
  // graph deletion and node cache access belong to include-side state.
  *drainRemainingInclude(): Iterable<Node> {
    yield* drainUncertifiedInclude(this.includeGraph, this.certifiedExclude);
  }
}

class CertifiedExcludeState<NodeId extends PropertyKey> {
  private readonly certified = new Set<NodeId>();

  has(nodeId: NodeId): boolean {
    return this.certified.has(nodeId);
  }

  absorbClosure<Node>(
    closure: CertifiedClosurePhaseResult<NodeId>,
    includeGraph: IncludeGraphState<NodeId, Node>,
  ): Set<NodeId> {
    const hits = new Set<NodeId>();
    for (const nodeId of closure.certifiedNodes) {
      this.certified.add(nodeId);
      if (includeGraph.has(nodeId)) hits.add(nodeId);
    }

    return hits;
  }

  nextPhaseStart(closure: CertifiedClosurePhaseResult<NodeId>): NodeId | undefined {
    return closure.kind === "closed-boundary" ? closure.closedBoundary : undefined;
  }
}

async function* resolveCertifiedHits<NodeId extends PropertyKey, Node>(
  includeGraph: IncludeGraphState<NodeId, Node>,
  certifiedExclude: CertifiedExcludeState<NodeId>,
  hits: ReadonlySet<NodeId>,
): AsyncIterable<Node> {
  if (hits.size === 0) return;

  const classification = await classifyCertifiedHits(includeGraph, hits);
  for (const nodeId of hits) classification.excluded.add(nodeId);

  for (const nodeId of classification.excluded) {
    includeGraph.delete(nodeId);
  }

  for (const nodeId of classification.yieldable) {
    if (classification.excluded.has(nodeId)) continue;
    const state = includeGraph.get(nodeId);
    if (state === undefined || !state.expanded || certifiedExclude.has(nodeId)) continue;
    includeGraph.delete(nodeId);
    yield state.node;
  }
}

async function classifyCertifiedHits<NodeId extends PropertyKey, Node>(
  includeGraph: IncludeGraphState<NodeId, Node>,
  hits: ReadonlySet<NodeId>,
): Promise<IncludePathClassification<NodeId>> {
  const newerSide = await collectReachableNodes(hits, includeGraph.predecessorsPort());
  const olderSide = await collectReachableNodes(hits, includeGraph.successorsPort());
  const excluded = new Set(olderSide);
  const yieldable = difference(newerSide, excluded);

  for (const hit of hits) {
    yieldable.delete(hit);
    excluded.add(hit);
  }

  return { yieldable, excluded };
}

function* drainUncertifiedInclude<NodeId extends PropertyKey, Node>(
  includeGraph: IncludeGraphState<NodeId, Node>,
  certifiedExclude: CertifiedExcludeState<NodeId>,
): Iterable<Node> {
  const nodeIds = includeGraph.nodeIds();
  for (const nodeId of nodeIds) {
    const state = includeGraph.get(nodeId);
    if (state === undefined || !state.expanded || certifiedExclude.has(nodeId)) continue;
    includeGraph.delete(nodeId);
    yield state.node;
  }
}

/**
 * Stores the include-side local DAG used for certified-hit classification and deletion.
 *
 * Include expansion owns edge discovery, so `expand()` records both successor and predecessor links
 * at the same time. The bidirectional links let classification walk both sides of a certified hit
 * and let deletion detach a node from its neighbors.
 */
class IncludeGraphState<NodeId extends PropertyKey, Node = unknown> {
  private readonly nodes: DagNodePort<NodeId, Node>;
  private readonly visited = new Map<NodeId, IncludeNodeState<NodeId, Node>>();

  constructor(nodes: DagNodePort<NodeId, Node>) {
    this.nodes = nodes;
  }

  initialize(startId: NodeId): void {
    this.stateFor(startId);
  }

  has(nodeId: NodeId): boolean {
    return this.visited.has(nodeId);
  }

  get(nodeId: NodeId): IncludeNodeState<NodeId, Node> | undefined {
    return this.visited.get(nodeId);
  }

  stateFor(nodeId: NodeId): IncludeNodeState<NodeId, Node> {
    let state = this.visited.get(nodeId);
    if (state === undefined) {
      state = {
        nodeId,
        predecessors: new Set<NodeId>(),
        successors: new Set<NodeId>(),
        expanded: false,
      };
      this.visited.set(nodeId, state);
    }
    return state;
  }

  private markNodeExpanded(nodeId: NodeId, node: Node): void {
    const state = this.stateFor(nodeId);
    const expandedState: IncludeNodeState<NodeId, Node> = {
      ...state,
      expanded: true,
      node,
    };
    this.visited.set(nodeId, expandedState);
  }

  async expand(nodeId: NodeId): Promise<readonly NodeId[]> {
    const node = await this.nodes.readNode(nodeId);
    const successors = this.nodes.getSuccessors(node);
    this.markNodeExpanded(nodeId, node);
    for (const successor of successors) {
      this.recordExpandedEdge(nodeId, successor);
    }
    return successors;
  }

  private recordExpandedEdge(nodeId: NodeId, successorId: NodeId): void {
    const node = this.stateFor(nodeId);
    const successor = this.stateFor(successorId);
    successor.predecessors.add(nodeId);
    node.successors.add(successorId);
  }

  delete(nodeId: NodeId): void {
    const state = this.visited.get(nodeId);
    if (state === undefined) return;

    for (const successor of state.successors) {
      this.visited.get(successor)?.predecessors.delete(nodeId);
    }
    for (const predecessor of state.predecessors) {
      this.visited.get(predecessor)?.successors.delete(nodeId);
    }
    this.visited.delete(nodeId);
  }

  nodeIds(): NodeId[] {
    return [...this.visited.keys()];
  }

  predecessorsPort(): DagNodePort<NodeId, IncludeNodeState<NodeId, Node>> {
    return {
      readNode: async (nodeId) => this.readNode(nodeId),
      getSuccessors: (node) => [...node.predecessors],
    };
  }

  successorsPort(): DagNodePort<NodeId, IncludeNodeState<NodeId, Node>> {
    return {
      readNode: async (nodeId) => this.readNode(nodeId),
      getSuccessors: (node) => [...node.successors],
    };
  }

  private readNode(nodeId: NodeId): IncludeNodeState<NodeId, Node> {
    const state = this.visited.get(nodeId);
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
