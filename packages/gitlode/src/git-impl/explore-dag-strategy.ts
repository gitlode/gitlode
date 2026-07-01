import type { Brand } from "../type-utils/index.js";
import type { DagNodePort, ReadSide } from "./walk-commits-strategy.js";

/**
 * Temporary design sketch for exclude-closure traversal.
 *
 * This file is intentionally not wired into production traversal. It translates the current
 * discussion into TypeScript shapes so the split/branch/trigger/close-boundary rules can be
 * reviewed with compiler help.
 */

export type SplitId = Brand<number, "SplitId">;
export type BranchId = Brand<number, "BranchId">;
export type BranchGroupId = Brand<number, "BranchGroupId">;

export interface ExcludeClosureNodeState<NodeId extends PropertyKey, Node> {
  readonly nodeId: NodeId;
  readonly children: Set<NodeId>;
  readonly traversedBranches: Set<BranchId>;
  parents?: readonly NodeId[];
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

export type ExcludeClosurePhaseResult<NodeId extends PropertyKey> =
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
 * Explores one exclude-side phase until the current sketch can prove a closed boundary, or until
 * there is no frontier left. The function is deliberately small-scope: it models only exclude
 * closure and does not attempt include-side yielding.
 */
export async function exploreExcludeClosurePhase<NodeId extends PropertyKey, Node>(
  startId: NodeId,
  nodes: DagNodePort<NodeId, Node>,
  side: ReadSide = "exclude",
): Promise<ExcludeClosurePhaseResult<NodeId>> {
  const phase = new ExcludeClosurePhase<NodeId, Node>(startId);
  const frontier: FrontierItem<NodeId>[] = [{ nodeId: startId, branchId: phase.rootBranchId }];

  while (frontier.length > 0 && !phase.hasClosedBoundary()) {
    const item = frontier.shift();
    if (item === undefined) break;

    const state = phase.stateFor(item.nodeId);
    if (state.traversedBranches.has(item.branchId)) continue;

    if (state.expanded) {
      frontier.push(...phase.resolveBranchByKnownNode(item.branchId, item.nodeId));
    }

    const parents = state.expanded
      ? state.parents
      : nodes.getParents(await nodes.readNode(item.nodeId, side));
    if (parents === undefined) throw new Error("Expected parents for expanded node.");
    if (!state.expanded) phase.markExpanded(item.nodeId, parents);
    phase.markTraversed(item.nodeId, item.branchId);

    if (parents.length === 0) {
      phase.markRootEscape(item.nodeId);
      continue;
    }

    if (parents.length === 1) {
      const parent = parents[0];
      if (parent === undefined) throw new Error("Expected single parent.");
      phase.recordEdge(item.nodeId, parent);
      const hit = phase.reachParentFromBranch(item.branchId, parent);
      if (hit !== undefined) frontier.push(...phase.resolveBranchByTrigger(hit));
      if (!phase.stateFor(parent).expanded) {
        frontier.push({ nodeId: parent, branchId: item.branchId });
      }
      continue;
    }

    const childSplit = phase.openSplit(item.nodeId, item.branchId, parents);
    for (const branchId of childSplit.branchIds) {
      const branch = phase.getBranchStateOrThrow(branchId);
      phase.recordEdge(item.nodeId, branch.startedAt);
      const hit = phase.reachParentFromBranch(branch.id, branch.startedAt);
      if (hit !== undefined) frontier.push(...phase.resolveBranchByTrigger(hit));
      if (!phase.stateFor(branch.startedAt).expanded) {
        frontier.push({ nodeId: branch.startedAt, branchId: branch.id });
      }
    }
  }

  return phase.toResult();
}

export class ExcludeClosurePhase<NodeId extends PropertyKey, Node = unknown> {
  readonly rootBranchId: BranchId;

  private nextSplitId: SplitId = 1 as SplitId;
  private nextBranchId: BranchId = 1 as BranchId;
  private nextBranchGroupId: BranchGroupId = 1 as BranchGroupId;
  private closedBoundary?: NodeId;
  private readonly states = new Map<NodeId, ExcludeClosureNodeState<NodeId, Node>>();
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

  stateFor(nodeId: NodeId): ExcludeClosureNodeState<NodeId, Node> {
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

  markExpanded(nodeId: NodeId, parents: readonly NodeId[]): void {
    const state = this.stateFor(nodeId);
    state.parents = parents;
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
    parents: readonly NodeId[],
  ): SplitState<NodeId> {
    const splitId = this.nextSplitId++ as SplitId;
    const branchIds = parents.map((parent) => {
      const branchId = this.nextBranchId++ as BranchId;
      this.branches.set(branchId, {
        id: branchId,
        splitId,
        startedAt: parent,
        tip: parent,
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

  reachParentFromBranch(branchId: BranchId, parentId: NodeId): TriggerHit<NodeId> | undefined {
    const branch = this.getBranchStateOrThrow(branchId);
    branch.tip = parentId;
    const joinedBranchId = this.reachNode(parentId, branchId, branch.splitId);
    if (joinedBranchId === undefined) return undefined;
    return {
      splitId: branch.splitId,
      trigger: parentId,
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

  toResult(): ExcludeClosurePhaseResult<NodeId> {
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
