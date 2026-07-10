import { collectAsyncIterableToSet } from "../support/index.js";
import { KeyedSet } from "../support/keyed-set.js";
import type { Brand } from "../type-utils/index.js";
import {
  type DagTopologyPort,
  type WalkDagContext,
  walkDagReachable,
} from "./dag-traversal-strategy.js";

export type { DagTopologyPort, WalkDagContext } from "./dag-traversal-strategy.js";

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
 * The prototype output contract remains the same as `walkDagNodeIdsEagerExclude()`:
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

interface UnexpandedCertifiedClosureNodeState<
  NodeId extends PropertyKey,
> extends CertifiedClosureNodeStateBase<NodeId> {
  readonly expanded: false;
}

interface ExpandedCertifiedClosureNodeStateBase<
  NodeId extends PropertyKey,
> extends CertifiedClosureNodeStateBase<NodeId> {
  readonly expanded: true;
  readonly successors: readonly NodeId[];
}

export type CertifiedClosureNodeState<NodeId extends PropertyKey> =
  | UnexpandedCertifiedClosureNodeState<NodeId>
  | ExpandedCertifiedClosureNodeStateBase<NodeId>;

interface ReadonlyCertifiedClosureNodeState<NodeId extends PropertyKey> {
  readonly nodeId: NodeId;
  readonly predecessors: ReadonlySet<NodeId>;
  readonly traversedBranches: ReadonlySet<BranchId>;
  readonly reached: boolean;
  readonly closedCover: boolean;
  readonly expanded: boolean;
}

interface SplitState<NodeId extends PropertyKey> {
  readonly id: SplitId;
  readonly openedAt: NodeId;
  readonly openedFromBranchId: BranchId;
  readonly branchIds: readonly BranchId[];
  readonly triggers: Set<NodeId>;
  resolved: boolean;
  closeBoundary?: NodeId;
}

interface BranchState<NodeId extends PropertyKey> {
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

interface IncludeNodeState<NodeId extends PropertyKey> {
  readonly nodeId: NodeId;
  readonly predecessors: Set<NodeId>;
  readonly successors: Set<NodeId>;
  readonly expanded: boolean;
}

type ReadonlyIncludeNodeState<NodeId extends PropertyKey> = {
  readonly nodeId: NodeId;
  readonly predecessors: ReadonlySet<NodeId>;
  readonly successors: ReadonlySet<NodeId>;
  readonly expanded: boolean;
};

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
  readonly yieldable: ReadonlySet<NodeId>;
  readonly excluded: ReadonlySet<NodeId>;
}

interface ReadonlyIncludeGraphState<NodeId extends PropertyKey> {
  has(nodeId: NodeId): boolean;
  get(nodeId: NodeId): ReadonlyIncludeNodeState<NodeId> | undefined;
  predecessorsPort(): DagTopologyPort<NodeId>;
  successorsPort(): DagTopologyPort<NodeId>;
  nodeIds(): NodeId[];
}

interface MutableIncludeGraphState<
  NodeId extends PropertyKey,
> extends ReadonlyIncludeGraphState<NodeId> {
  delete(nodeId: NodeId): void;
}

interface ReadonlyCertifiedExcludeState<NodeId extends PropertyKey> {
  has(nodeId: NodeId): boolean;
}

interface ClosureFrontierItem<NodeId> {
  readonly nodeId: NodeId;
  readonly branchId: BranchId;
}

interface TriggerHit<NodeId> {
  readonly splitId: SplitId;
  readonly triggerId: NodeId;
  readonly branchId: BranchId;
  readonly joinedBranchId: BranchId;
}

/**
 * Resolves one closure phase until it can prove a closed boundary, or until there is no frontier
 * left. The function is deliberately small-scope: it models only certified closure and does not
 * attempt include-side yielding.
 */
export async function resolveDagCertifiedClosurePhase<NodeId extends PropertyKey>(
  context: WalkDagContext<NodeId>,
  startId: NodeId,
): Promise<CertifiedClosurePhaseResult<NodeId>> {
  const { graph } = context;
  const phase = new CertifiedClosurePhase<NodeId>(graph, startId);
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
export async function* walkDagPhaseCertifiedDifference<NodeId extends PropertyKey>(
  context: WalkDagContext<NodeId>,
  startId: NodeId,
  excludeStartId: NodeId,
): AsyncIterable<NodeId> {
  const { graph } = context;
  const state = new IntegratedDifferenceState<NodeId>(graph);
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

class CertifiedClosurePhase<NodeId extends PropertyKey> {
  readonly rootBranchId: BranchId;

  private readonly graph: ClosureGraphState<NodeId>;
  private nextSplitId: SplitId = 1 as SplitId;
  private nextBranchId: BranchId = 1 as BranchId;
  private nextBranchGroupId: BranchGroupId = 1 as BranchGroupId;
  private closedBoundary?: NodeId;
  private readonly branches = new KeyedSet<BranchId, BranchState<NodeId>>((value) => value.id);
  private readonly splits = new KeyedSet<SplitId, SplitState<NodeId>>((value) => value.id);
  private readonly reachedByBranch = new Map<NodeId, Set<BranchId>>();
  private readonly terminalNodes = new Set<NodeId>();

  constructor(graph: DagTopologyPort<NodeId>, startId: NodeId) {
    this.graph = new ClosureGraphState(graph);
    this.rootBranchId = 0 as BranchId;
    this.graph.markClosedCover(startId);
    this.branches.add({
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
      this.branches.add({
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
    this.splits.add(split);
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
      triggerId: successorId,
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
      triggerId: knownNodeId,
      branchId,
      joinedBranchId,
    });
  }

  private resolveBranchByTrigger(hit: TriggerHit<NodeId>): ClosureFrontierItem<NodeId>[] {
    const split = this.getSplitStateOrThrow(hit.splitId);
    if (split.resolved) return [];
    split.triggers.add(hit.triggerId);
    this.joinBranchGroups(hit.branchId, hit.joinedBranchId);

    const boundary = this.findCloseBoundary(split);
    if (boundary === undefined) return [];

    return this.closeSplit(split, boundary);
  }

  private getBranchStateOrThrow(branchId: BranchId): BranchState<NodeId> {
    const branch = this.branches.getByKey(branchId);
    if (branch === undefined) throw new Error(`Unknown branch: ${branchId}`);
    return branch;
  }

  private markTraversed(nodeId: NodeId, branchId: BranchId): void {
    this.graph.markTraversed(nodeId, branchId);
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
        triggerId: boundary,
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
    this.graph.markReached(nodeId);

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
      this.graph.markClosedCover(nodeId);
    }
  }

  private getSplitStateOrThrow(splitId: SplitId): SplitState<NodeId> {
    const split = this.splits.getByKey(splitId);
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
class ClosureGraphState<NodeId extends PropertyKey> {
  private readonly graph: DagTopologyPort<NodeId>;
  private readonly visited = new Map<NodeId, CertifiedClosureNodeState<NodeId>>();

  constructor(graph: DagTopologyPort<NodeId>) {
    this.graph = graph;
  }

  stateFor(nodeId: NodeId): ReadonlyCertifiedClosureNodeState<NodeId> {
    return this.mutableStateFor(nodeId);
  }

  private mutableStateFor(nodeId: NodeId): CertifiedClosureNodeState<NodeId> {
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
    const state = this.mutableStateFor(nodeId);
    if (state.expanded) {
      return state.successors;
    }

    const successors = await this.graph.getSuccessors(nodeId);
    const successorIds = successors.map((successor) => successor.nodeId);
    this.markExpanded(nodeId, successorIds);
    return successorIds;
  }

  private markExpanded(nodeId: NodeId, successors: readonly NodeId[]): void {
    const state = this.mutableStateFor(nodeId);
    this.visited.set(nodeId, {
      ...state,
      expanded: true,
      reached: true,
      successors,
    });
  }

  markReached(nodeId: NodeId): void {
    this.mutableStateFor(nodeId).reached = true;
  }

  markClosedCover(nodeId: NodeId): void {
    this.mutableStateFor(nodeId).closedCover = true;
  }

  markTraversed(nodeId: NodeId, branchId: BranchId): void {
    this.mutableStateFor(nodeId).traversedBranches.add(branchId);
  }

  recordTraversedEdge(nodeId: NodeId, successorId: NodeId): void {
    this.mutableStateFor(successorId).predecessors.add(nodeId);
  }

  states(): Iterable<ReadonlyCertifiedClosureNodeState<NodeId>> {
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

export class IntegratedDifferenceState<NodeId extends PropertyKey> {
  private readonly includeGraph: IncludeGraphState<NodeId>;
  private readonly certifiedExclude = new CertifiedExcludeState<NodeId>();

  constructor(graph: DagTopologyPort<NodeId>) {
    this.includeGraph = new IncludeGraphState(graph);
  }

  initializeInclude(startId: NodeId): void {
    this.includeGraph.initialize(startId);
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
  async *applyCertification(closure: CertifiedClosurePhaseResult<NodeId>): AsyncIterable<NodeId> {
    const hits = this.certifiedExclude.absorbClosure(closure, this.includeGraph);
    yield* this.applyCertifiedHits(hits);
  }

  async *applyCertifiedHits(hits: ReadonlySet<NodeId>): AsyncIterable<NodeId> {
    yield* resolveCertifiedHits(this.includeGraph, this.certifiedExclude, hits);
  }

  nextExcludePhaseStart(closure: CertifiedClosurePhaseResult<NodeId>): NodeId | undefined {
    return this.certifiedExclude.nextPhaseStart(closure);
  }

  // Coordinator + IncludeGraphState responsibility. The final drain is a coordinator decision; the
  // graph deletion and node cache access belong to include-side state.
  *drainRemainingInclude(): Iterable<NodeId> {
    yield* drainUncertifiedInclude(this.includeGraph, this.certifiedExclude);
  }
}

class CertifiedExcludeState<
  NodeId extends PropertyKey,
> implements ReadonlyCertifiedExcludeState<NodeId> {
  private readonly certified = new Set<NodeId>();

  has(nodeId: NodeId): boolean {
    return this.certified.has(nodeId);
  }

  absorbClosure(
    closure: CertifiedClosurePhaseResult<NodeId>,
    includeGraph: ReadonlyIncludeGraphState<NodeId>,
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

async function* resolveCertifiedHits<NodeId extends PropertyKey>(
  includeGraph: MutableIncludeGraphState<NodeId>,
  certifiedExclude: ReadonlyCertifiedExcludeState<NodeId>,
  hits: ReadonlySet<NodeId>,
): AsyncIterable<NodeId> {
  if (hits.size === 0) return;

  const classification = await classifyCertifiedHits(includeGraph, hits);

  for (const nodeId of classification.excluded) {
    includeGraph.delete(nodeId);
  }

  for (const nodeId of classification.yieldable) {
    if (classification.excluded.has(nodeId)) continue;
    const state = includeGraph.get(nodeId);
    if (state === undefined || !state.expanded || certifiedExclude.has(nodeId)) continue;
    includeGraph.delete(nodeId);
    yield nodeId;
  }
}

async function classifyCertifiedHits<NodeId extends PropertyKey>(
  includeGraph: ReadonlyIncludeGraphState<NodeId>,
  hits: ReadonlySet<NodeId>,
): Promise<IncludePathClassification<NodeId>> {
  const newerSide = await collectAsyncIterableToSet(
    walkDagReachable(hits, includeGraph.predecessorsPort()),
  );
  const olderSide = await collectAsyncIterableToSet(
    walkDagReachable(hits, includeGraph.successorsPort()),
  );
  const excluded = new Set(olderSide);
  const yieldable = difference(newerSide, excluded);

  for (const hit of hits) {
    yieldable.delete(hit);
    excluded.add(hit);
  }

  return { yieldable, excluded };
}

function* drainUncertifiedInclude<NodeId extends PropertyKey>(
  includeGraph: MutableIncludeGraphState<NodeId>,
  certifiedExclude: ReadonlyCertifiedExcludeState<NodeId>,
): Iterable<NodeId> {
  const nodeIds = includeGraph.nodeIds();
  for (const nodeId of nodeIds) {
    const state = includeGraph.get(nodeId);
    if (state === undefined || !state.expanded || certifiedExclude.has(nodeId)) continue;
    includeGraph.delete(nodeId);
    yield nodeId;
  }
}

/**
 * Stores the include-side local DAG used for certified-hit classification and deletion.
 *
 * Include expansion owns edge discovery, so `expand()` records both successor and predecessor links
 * at the same time. Expanded nodes are cached, but their links remain mutable because certified-hit
 * deletion detaches nodes from their neighbors.
 */
class IncludeGraphState<NodeId extends PropertyKey> implements MutableIncludeGraphState<NodeId> {
  private readonly graph: DagTopologyPort<NodeId>;
  private readonly visited = new Map<NodeId, IncludeNodeState<NodeId>>();

  constructor(graph: DagTopologyPort<NodeId>) {
    this.graph = graph;
  }

  initialize(startId: NodeId): void {
    this.mutableStateFor(startId);
  }

  has(nodeId: NodeId): boolean {
    return this.visited.has(nodeId);
  }

  get(nodeId: NodeId): IncludeNodeState<NodeId> | undefined {
    return this.visited.get(nodeId);
  }

  stateFor(nodeId: NodeId): ReadonlyIncludeNodeState<NodeId> {
    return this.mutableStateFor(nodeId);
  }

  private mutableStateFor(nodeId: NodeId): IncludeNodeState<NodeId> {
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

  private markNodeExpanded(nodeId: NodeId): void {
    const state = this.mutableStateFor(nodeId);
    const expandedState: IncludeNodeState<NodeId> = {
      ...state,
      expanded: true,
    };
    this.visited.set(nodeId, expandedState);
  }

  async expand(nodeId: NodeId): Promise<readonly NodeId[]> {
    const state = this.mutableStateFor(nodeId);
    if (state.expanded) {
      return [...state.successors];
    }

    const successors = await this.graph.getSuccessors(nodeId);
    const successorIds = successors.map((successor) => successor.nodeId);
    this.markNodeExpanded(nodeId);
    for (const successor of successorIds) {
      this.recordExpandedEdge(nodeId, successor);
    }
    return successorIds;
  }

  private recordExpandedEdge(nodeId: NodeId, successorId: NodeId): void {
    const node = this.mutableStateFor(nodeId);
    const successor = this.mutableStateFor(successorId);
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

  predecessorsPort(): DagTopologyPort<NodeId> {
    return {
      getSuccessors: async (nodeId) =>
        [...this.readNode(nodeId).predecessors].map((predecessor) => ({ nodeId: predecessor })),
    };
  }

  successorsPort(): DagTopologyPort<NodeId> {
    return {
      getSuccessors: async (nodeId) =>
        [...this.readNode(nodeId).successors].map((successor) => ({ nodeId: successor })),
    };
  }

  private readNode(nodeId: NodeId): IncludeNodeState<NodeId> {
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
