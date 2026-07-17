import { KeyedSet } from "../support/index.js";
import type { Brand } from "../type-utils/index.js";
import type {
  BranchId,
  CertifiedClosurePhaseResolution,
  ClosureFrontierItem,
  DagPhaseCertifiedTelemetry,
} from "./phase-certified-types.js";
import type { DagSuccessor, DagTopologyPort } from "./types.js";

/** Certified closure state machine for split, branch, join, and closed-boundary detection. */
type SplitId = Brand<number, "SplitId">;
type BranchGroupId = Brand<number, "BranchGroupId">;

interface CertifiedClosureNodeState<NodeId extends PropertyKey> {
  readonly nodeId: NodeId;
  readonly predecessors: Set<NodeId>;
  readonly traversedBranches: Set<BranchId>;
  reached: boolean;
  closedCover: boolean;
  expanded: boolean;
}

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
  status: "open" | "closed";
}

interface BranchState<NodeId extends PropertyKey> {
  readonly id: BranchId;
  readonly splitId: SplitId;
  readonly startedAt: NodeId;
  groupId: BranchGroupId;
}

interface BranchJoinTrigger<NodeId, DomainHint = undefined> {
  readonly splitId: SplitId;
  readonly triggerId: NodeId;
  readonly branchId: BranchId;
  readonly joinedBranchId: BranchId;
  readonly domainHint?: DomainHint;
}

type BranchGroupJoinDetection =
  | { readonly kind: "no-join" }
  | {
      readonly kind: "join-detected";
      readonly joinedBranchId: BranchId;
    };

export class CertifiedClosurePhase<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly rootBranchId: BranchId;

  private readonly graph: ClosureGraphState<NodeId, DomainHint>;
  private nextSplitId: SplitId = 1 as SplitId;
  private nextBranchId: BranchId = 1 as BranchId;
  private nextBranchGroupId: BranchGroupId = 1 as BranchGroupId;
  private closedBoundary?: NodeId;
  private closedBoundaryDomainHint?: DomainHint;
  private readonly branches = new KeyedSet<BranchId, BranchState<NodeId>>((value) => value.id);
  private readonly splits = new KeyedSet<SplitId, SplitState<NodeId>>((value) => value.id);
  private readonly reachedByBranch = new Map<NodeId, Set<BranchId>>();
  private readonly terminalNodes = new Set<NodeId>();

  constructor(
    graph: DagTopologyPort<NodeId, DomainHint>,
    startId: NodeId,
    telemetry?: DagPhaseCertifiedTelemetry,
  ) {
    this.graph = new ClosureGraphState(graph, telemetry);
    this.rootBranchId = 0 as BranchId;
    this.graph.markCoveredByClosedRegion(startId);
    this.branches.add({
      id: this.rootBranchId,
      splitId: 0 as SplitId,
      startedAt: startId,
      groupId: 0 as BranchGroupId,
    });
    this.recordBranchReachAndDetectJoin(startId, this.rootBranchId);
  }

  async begin(rootDomainHint?: DomainHint): Promise<ClosureFrontierItem<NodeId, DomainHint>[]> {
    const rootItem: ClosureFrontierItem<NodeId, DomainHint> = {
      nodeId: this.getBranchStateOrThrow(this.rootBranchId).startedAt,
      branchId: this.rootBranchId,
      ...(rootDomainHint === undefined ? {} : { domainHint: rootDomainHint }),
    };
    const successors = await this.graph.expand(rootItem.nodeId);
    this.graph.recordBranchTraversal(rootItem.nodeId, rootItem.branchId);

    if (successors.length === 0) {
      this.markTerminal(rootItem.nodeId);
      return [];
    }

    if (successors.length === 1) {
      const successor = successors[0];
      if (successor === undefined) throw new Error("Expected single successor.");
      this.graph.recordTraversedEdge(rootItem.nodeId, successor.nodeId);
      this.recordBranchReachAndDetectJoin(successor.nodeId, rootItem.branchId);
      this.graph.markCoveredByClosedRegion(successor.nodeId);
      this.closedBoundary = successor.nodeId;
      this.closedBoundaryDomainHint = successor.domainHint;
      return [];
    }

    return this.processSplitSuccessors(rootItem, successors);
  }

  async processFrontierItem(
    item: ClosureFrontierItem<NodeId, DomainHint>,
  ): Promise<ClosureFrontierItem<NodeId, DomainHint>[]> {
    const state = this.graph.getNodeStateOrThrow(item.nodeId);
    if (state.traversedBranches.has(item.branchId)) {
      this.graph.recordStaleStep();
      return [];
    }

    // A re-expanded node may be reached by another branch, but new branch joins are detected when
    // the successor frontier item is produced. Dequeue-time re-expansion is topology re-access only.
    const frontier: ClosureFrontierItem<NodeId, DomainHint>[] = [];

    const successors = await this.graph.expand(item.nodeId);
    this.graph.recordBranchTraversal(item.nodeId, item.branchId);

    if (successors.length === 0) {
      this.markTerminal(item.nodeId);
      return frontier;
    }

    if (successors.length === 1) {
      const successor = successors[0];
      if (successor === undefined) throw new Error("Expected single successor.");
      frontier.push(...this.processSingleSuccessor(item, successor));
      return frontier;
    }

    frontier.push(...this.processSplitSuccessors(item, successors));
    return frontier;
  }

  hasClosedBoundary(): boolean {
    return this.closedBoundary !== undefined;
  }

  private processSingleSuccessor(
    item: ClosureFrontierItem<NodeId, DomainHint>,
    successor: DagSuccessor<NodeId, DomainHint>,
  ): ClosureFrontierItem<NodeId, DomainHint>[] {
    this.graph.recordTraversedEdge(item.nodeId, successor.nodeId);
    const hit = this.advanceBranchToSuccessorAndDetectJoin(
      item.branchId,
      successor.nodeId,
      successor.domainHint,
    );
    const frontier = hit === undefined ? [] : this.applyBranchJoinTrigger(hit);
    if (!this.graph.getNodeStateOrThrow(successor.nodeId).expanded) {
      frontier.push({
        nodeId: successor.nodeId,
        branchId: item.branchId,
        ...(successor.domainHint === undefined ? {} : { domainHint: successor.domainHint }),
      });
    }
    return frontier;
  }

  private processSplitSuccessors(
    item: ClosureFrontierItem<NodeId, DomainHint>,
    successors: readonly DagSuccessor<NodeId, DomainHint>[],
  ): ClosureFrontierItem<NodeId, DomainHint>[] {
    const frontier: ClosureFrontierItem<NodeId, DomainHint>[] = [];
    const childSplit = this.openSplit(
      item.nodeId,
      item.branchId,
      successors.map((successor) => successor.nodeId),
    );
    for (const branchId of childSplit.branchIds) {
      const branch = this.getBranchStateOrThrow(branchId);
      this.graph.recordTraversedEdge(item.nodeId, branch.startedAt);
      const successor = successors.find((candidate) => candidate.nodeId === branch.startedAt);
      const hit = this.advanceBranchToSuccessorAndDetectJoin(
        branch.id,
        branch.startedAt,
        successor?.domainHint,
      );
      if (hit !== undefined) frontier.push(...this.applyBranchJoinTrigger(hit));
      if (!this.graph.getNodeStateOrThrow(branch.startedAt).expanded) {
        frontier.push({
          nodeId: branch.startedAt,
          branchId: branch.id,
          ...(successor?.domainHint === undefined ? {} : { domainHint: successor.domainHint }),
        });
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
      status: "open",
    };
    this.splits.add(split);
    return split;
  }

  private advanceBranchToSuccessorAndDetectJoin(
    branchId: BranchId,
    successorId: NodeId,
    domainHint?: DomainHint,
  ): BranchJoinTrigger<NodeId, DomainHint> | undefined {
    const branch = this.getBranchStateOrThrow(branchId);
    const join = this.recordBranchReachAndDetectJoin(successorId, branchId);
    if (join.kind === "no-join") return undefined;
    return {
      splitId: branch.splitId,
      triggerId: successorId,
      branchId,
      joinedBranchId: join.joinedBranchId,
      domainHint,
    };
  }

  private applyBranchJoinTrigger(
    hit: BranchJoinTrigger<NodeId, DomainHint>,
  ): ClosureFrontierItem<NodeId, DomainHint>[] {
    const split = this.getSplitStateOrThrow(hit.splitId);
    if (split.status === "closed") return [];
    split.triggers.add(hit.triggerId);
    this.mergeBranchGroups(hit.branchId, hit.joinedBranchId);

    const boundary = this.findCloseBoundary(split);
    if (boundary === undefined) return [];

    return this.closeSplitAndPropagate(split, boundary, hit.domainHint);
  }

  private getBranchStateOrThrow(branchId: BranchId): BranchState<NodeId> {
    const branch = this.branches.getByKey(branchId);
    if (branch === undefined) throw new Error(`Unknown branch: ${branchId}`);
    return branch;
  }

  private markTerminal(nodeId: NodeId): void {
    this.terminalNodes.add(nodeId);
  }

  private closeSplitAndPropagate(
    split: SplitState<NodeId>,
    boundary: NodeId,
    domainHint?: DomainHint,
  ): ClosureFrontierItem<NodeId, DomainHint>[] {
    split.status = "closed";
    this.markClosedRegion(split.openedAt, boundary);

    const parentBranch = this.getBranchStateOrThrow(split.openedFromBranchId);
    if (parentBranch.splitId === (0 as SplitId)) {
      this.closedBoundary = boundary;
      this.closedBoundaryDomainHint = domainHint;
      return [];
    }

    const join = this.recordBranchReachAndDetectJoin(boundary, parentBranch.id);
    if (join.kind === "join-detected") {
      const parentFrontier = this.applyBranchJoinTrigger({
        splitId: parentBranch.splitId,
        triggerId: boundary,
        branchId: parentBranch.id,
        joinedBranchId: join.joinedBranchId,
        domainHint,
      });
      if (parentFrontier.length > 0 || this.hasClosedBoundary()) return parentFrontier;
    }

    return [
      {
        nodeId: boundary,
        branchId: parentBranch.id,
        ...(domainHint === undefined ? {} : { domainHint }),
      },
    ];
  }

  buildResolution(): CertifiedClosurePhaseResolution<NodeId, DomainHint> {
    if (this.closedBoundary !== undefined) {
      return {
        result: {
          kind: "closed-boundary",
          certifiedNodes: new Set(
            [...this.graph.nodeStates()]
              .filter((state) => state.closedCover)
              .map((state) => state.nodeId),
          ),
          closedBoundary: this.closedBoundary,
        },
        closedBoundaryDomainHint: this.closedBoundaryDomainHint,
      };
    }

    return {
      result: {
        kind: "exhausted",
        certifiedNodes: new Set(
          [...this.graph.nodeStates()]
            .filter((state) => state.reached)
            .map((state) => state.nodeId),
        ),
        terminalNodes: [...this.terminalNodes],
      },
    };
  }

  private recordBranchReachAndDetectJoin(
    nodeId: NodeId,
    branchId: BranchId,
  ): BranchGroupJoinDetection {
    this.graph.markReached(nodeId);

    let reached = this.reachedByBranch.get(nodeId);
    if (reached === undefined) {
      reached = new Set<BranchId>();
      this.reachedByBranch.set(nodeId, reached);
    }
    reached.add(branchId);

    const currentBranch = this.getBranchStateOrThrow(branchId);
    const splitId = currentBranch.splitId;
    const joinedBranchId = [...reached].find((candidate) => {
      const branch = this.getBranchStateOrThrow(candidate);
      return (
        branch.splitId === splitId &&
        candidate !== branchId &&
        branch.groupId !== currentBranch.groupId
      );
    });

    // Reach registration and join detection complete together before successor work is enqueued.
    return joinedBranchId === undefined
      ? { kind: "no-join" }
      : { kind: "join-detected", joinedBranchId };
  }

  private mergeBranchGroups(leftBranchId: BranchId, rightBranchId: BranchId): void {
    const left = this.getBranchStateOrThrow(leftBranchId);
    const right = this.getBranchStateOrThrow(rightBranchId);
    if (left.groupId === right.groupId) return;

    const from = right.groupId;
    const to = left.groupId;
    // Branch groups only merge. Reassigning the whole matching group preserves earlier joins and
    // prevents later traversal order from splitting a resolved relationship apart.
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
      this.graph.markCoveredByClosedRegion(nodeId);
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
class ClosureGraphState<NodeId extends PropertyKey, DomainHint = undefined> {
  private readonly graph: DagTopologyPort<NodeId, DomainHint>;
  private readonly telemetry?: DagPhaseCertifiedTelemetry;
  private readonly visited = new Map<NodeId, CertifiedClosureNodeState<NodeId>>();

  constructor(graph: DagTopologyPort<NodeId, DomainHint>, telemetry?: DagPhaseCertifiedTelemetry) {
    this.graph = graph;
    this.telemetry = telemetry;
  }

  getNodeStateOrThrow(nodeId: NodeId): ReadonlyCertifiedClosureNodeState<NodeId> {
    const state = this.visited.get(nodeId);
    if (state === undefined) throw new Error("Expected reached closure node.");
    return state;
  }

  private ensureMutableNodeState(nodeId: NodeId): CertifiedClosureNodeState<NodeId> {
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

  async expand(nodeId: NodeId): Promise<readonly DagSuccessor<NodeId, DomainHint>[]> {
    this.telemetry?.span.incrementCounter("successor_expansions");
    this.telemetry?.span.incrementCounter("exclude_expansions");
    const successors = await this.graph.getSuccessors(nodeId);
    this.markExpandedAndReached(nodeId);
    return successors;
  }

  private markExpandedAndReached(nodeId: NodeId): void {
    const state = this.ensureMutableNodeState(nodeId);
    this.visited.set(nodeId, {
      ...state,
      expanded: true,
      reached: true,
    });
  }

  markReached(nodeId: NodeId): void {
    this.ensureMutableNodeState(nodeId).reached = true;
  }

  markCoveredByClosedRegion(nodeId: NodeId): void {
    this.ensureMutableNodeState(nodeId).closedCover = true;
  }

  recordBranchTraversal(nodeId: NodeId, branchId: BranchId): void {
    this.ensureMutableNodeState(nodeId).traversedBranches.add(branchId);
  }

  recordTraversedEdge(nodeId: NodeId, successorId: NodeId): void {
    this.ensureMutableNodeState(successorId).predecessors.add(nodeId);
  }

  recordStaleStep(): void {
    this.telemetry?.span.incrementCounter("stale_steps");
  }

  nodeStates(): Iterable<ReadonlyCertifiedClosureNodeState<NodeId>> {
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
      // These links reconstruct the certified closed region; they are correctness state, not a
      // successor cache. Every walked node must already have been reached by a closure branch.
      for (const predecessor of this.getNodeStateOrThrow(nodeId).predecessors) {
        stack.push(predecessor);
      }
    }
  }
}
