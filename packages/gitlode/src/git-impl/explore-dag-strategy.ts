import {
  instrumentAsyncIterable,
  noopInstrumentation,
  type InstrumentationSpan,
} from "../instrumentation/index.js";
import { collectAsyncIterableToSet, OrderedQueue } from "../support/index.js";
import { KeyedSet } from "../support/keyed-set.js";
import type { Brand } from "../type-utils/index.js";
import {
  type DagFrontier,
  type DagSuccessor,
  type DagTopologyPort,
  type WalkDagContext,
  walkDagReachableNodeIds,
} from "./dag-traversal-strategy.js";

export type { DagSuccessor, DagTopologyPort, WalkDagContext } from "./dag-traversal-strategy.js";

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
 *   include nodes, expanded flags, and the observed successor/predecessor links used for local
 *   classification.
 * - Certified exclude bookkeeping should live in an exclude-side state object. It should own the
 *   certified exclude set, absorb closure phase results, report include-side hits, and decide
 *   whether another exclude phase should start from a closed boundary.
 * - Certified hit classification should live in a focused helper. It should classify include-side
 *   nodes into yieldable and excluded regions without mutating the traversal frontier.
 * - Closure phase traversal should keep its main loop visible in
 *   `resolveDagCertifiedClosurePhase()`. The loop should drive frontier items; `CertifiedClosurePhase`
 *   should own split, branch, trigger, and close-boundary transitions while `ClosureGraphState`
 *   owns closure correctness state and graph links observed during branch traversal.
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

export type IncludeExpansionResult<NodeId extends PropertyKey, DomainHint = undefined> =
  | {
      readonly kind: "expanded";
      readonly enqueue: readonly DagSuccessor<NodeId, DomainHint>[];
    }
  | {
      readonly kind: "skipped";
      readonly reason: "stale" | "certified-hit" | "already-expanded";
    };

export type DifferenceFrontierItem<NodeId extends PropertyKey, DomainHint = undefined> =
  | {
      readonly role: "main";
      readonly nodeId: NodeId;
      readonly domainHint?: DomainHint;
    }
  | {
      readonly role: "exclude";
      readonly nodeId: NodeId;
      readonly domainHint?: DomainHint;
    };

interface IncludePathClassification<NodeId extends PropertyKey> {
  readonly yieldable: ReadonlySet<NodeId>;
  readonly excluded: ReadonlySet<NodeId>;
  readonly newerSideSize: number;
  readonly olderSideSize: number;
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

export interface ClosureFrontierItem<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly nodeId: NodeId;
  readonly branchId: BranchId;
  readonly domainHint?: DomainHint;
}

export interface PhaseCertifiedStrategyOptions<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly createDifferenceFrontier?: () => DagFrontier<DifferenceFrontierItem<NodeId, DomainHint>>;
  readonly createClosureFrontier?: () => DagFrontier<ClosureFrontierItem<NodeId, DomainHint>>;
}

interface DagPhaseCertifiedTelemetry {
  readonly span: InstrumentationSpan;
}

interface TriggerHit<NodeId, DomainHint = undefined> {
  readonly splitId: SplitId;
  readonly triggerId: NodeId;
  readonly branchId: BranchId;
  readonly joinedBranchId: BranchId;
  readonly domainHint?: DomainHint;
}

/**
 * Resolves one closure phase until it can prove a closed boundary, or until there is no frontier
 * left. The function is deliberately small-scope: it models only certified closure and does not
 * attempt include-side yielding.
 */
export async function resolveDagCertifiedClosurePhase<
  NodeId extends PropertyKey,
  DomainHint = undefined,
>(
  context: WalkDagContext<NodeId, DomainHint>,
  nodeId: NodeId,
  options: PhaseCertifiedStrategyOptions<NodeId, DomainHint> = {},
): Promise<CertifiedClosurePhaseResult<NodeId>> {
  return await context.instrumentation.runAsync("dag.certified_closure", async (span) => {
    const resolution = await resolveDagCertifiedClosurePhaseCore(context, nodeId, options, {
      span,
    });
    const { result } = resolution;
    span.setAttribute("result", result.kind);
    span.incrementCounter("certified_nodes", result.certifiedNodes.size);
    if (result.kind === "exhausted") {
      span.incrementCounter("terminal_nodes", result.terminalNodes.length);
    }
    return result;
  });
}

interface CertifiedClosureCoreResolution<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly result: CertifiedClosurePhaseResult<NodeId>;
  readonly closedBoundaryDomainHint?: DomainHint;
}

async function resolveDagCertifiedClosurePhaseCore<
  NodeId extends PropertyKey,
  DomainHint = undefined,
>(
  context: WalkDagContext<NodeId, DomainHint>,
  nodeId: NodeId,
  options: PhaseCertifiedStrategyOptions<NodeId, DomainHint>,
  telemetry?: DagPhaseCertifiedTelemetry,
  rootDomainHint?: DomainHint,
): Promise<CertifiedClosureCoreResolution<NodeId, DomainHint>> {
  const { graph } = context;
  const phase = new CertifiedClosurePhase<NodeId, DomainHint>(graph, nodeId, telemetry);
  const frontier =
    options.createClosureFrontier?.() ??
    createDefaultPhaseCertifiedFrontier<ClosureFrontierItem<NodeId, DomainHint>>();
  frontier.enqueue({
    nodeId: nodeId,
    branchId: phase.rootBranchId,
    ...(rootDomainHint === undefined ? {} : { domainHint: rootDomainHint }),
  });

  while (!frontier.isEmpty() && !phase.hasClosedBoundary()) {
    const item = frontier.dequeueOrThrow();

    telemetry?.span.incrementCounter("traversal_steps");
    frontier.enqueueMany(await phase.advance(item));
  }

  return phase.toCoreResolution();
}

/**
 * Walks the DAG difference by alternating include expansion with exclude certification phases.
 * This is still a prototype strategy and is not wired into production traversal yet.
 */
export async function* walkDagNodeIdsPhaseCertifiedDifference<
  NodeId extends PropertyKey,
  DomainHint = undefined,
>(
  context: WalkDagContext<NodeId, DomainHint>,
  nodeId: NodeId,
  excludeNodeId: NodeId,
  options: PhaseCertifiedStrategyOptions<NodeId, DomainHint> = {},
): AsyncIterable<NodeId> {
  yield* instrumentAsyncIterable(
    context.instrumentation,
    "dag.traversal",
    (span) =>
      walkDagNodeIdsPhaseCertifiedDifferenceCore(context, nodeId, excludeNodeId, options, { span }),
    { attributes: { strategy: "phaseCertified" } },
  );
}

async function* walkDagNodeIdsPhaseCertifiedDifferenceCore<
  NodeId extends PropertyKey,
  DomainHint = undefined,
>(
  context: WalkDagContext<NodeId, DomainHint>,
  nodeId: NodeId,
  excludeNodeId: NodeId,
  options: PhaseCertifiedStrategyOptions<NodeId, DomainHint>,
  telemetry: DagPhaseCertifiedTelemetry,
): AsyncIterable<NodeId> {
  const { graph } = context;
  const state = new IntegratedDifferenceState<NodeId, DomainHint>(graph, telemetry);
  state.initializeInclude(nodeId);

  const frontier =
    options.createDifferenceFrontier?.() ??
    createDefaultPhaseCertifiedFrontier<DifferenceFrontierItem<NodeId, DomainHint>>();
  frontier.enqueueMany([
    { role: "main", nodeId: nodeId },
    { role: "exclude", nodeId: excludeNodeId },
  ]);

  while (!frontier.isEmpty()) {
    const item = frontier.dequeueOrThrow();

    if (item.role === "main") {
      telemetry.span.incrementCounter("traversal_steps");
      const expansion = await state.expandInclude(item.nodeId);
      if (
        expansion.kind === "skipped" &&
        (expansion.reason === "stale" || expansion.reason === "already-expanded")
      ) {
        telemetry.span.incrementCounter("stale_steps");
      }
      if (expansion.kind === "skipped" && expansion.reason === "certified-hit") {
        for await (const yielded of state.applyCertifiedHits(new Set([item.nodeId]))) {
          telemetry.span.incrementCounter("certification_yielded_nodes");
          telemetry.span.incrementCounter("yielded_nodes");
          yield yielded;
        }
        continue;
      }
      if (expansion.kind === "expanded") {
        frontier.enqueueMany(
          expansion.enqueue.map((successor) => ({
            role: "main" as const,
            nodeId: successor.nodeId,
            ...(successor.domainHint === undefined ? {} : { domainHint: successor.domainHint }),
          })),
        );
      }
      continue;
    }

    telemetry.span.incrementCounter("closure_phases");
    const closureResolution = await resolveDagCertifiedClosurePhaseCore(
      context,
      item.nodeId,
      options,
      telemetry,
      item.domainHint,
    );
    const { result: closure, closedBoundaryDomainHint } = closureResolution;
    telemetry.span.incrementCounter(
      closure.kind === "closed-boundary" ? "closed_boundary_phases" : "exhausted_phases",
    );
    if (closure.kind === "exhausted") {
      telemetry.span.incrementCounter("terminal_nodes", closure.terminalNodes.length);
    }
    for await (const yielded of state.applyCertification(closure)) {
      telemetry.span.incrementCounter("certification_yielded_nodes");
      telemetry.span.incrementCounter("yielded_nodes");
      yield yielded;
    }
    const nextExcludeStart = state.nextExcludePhaseStart(closure);
    if (nextExcludeStart !== undefined) {
      frontier.enqueue({
        role: "exclude",
        nodeId: nextExcludeStart,
        ...(closedBoundaryDomainHint === undefined ? {} : { domainHint: closedBoundaryDomainHint }),
      });
    }
  }

  for (const yielded of state.drainRemainingInclude()) {
    telemetry.span.incrementCounter("drain_yielded_nodes");
    telemetry.span.incrementCounter("yielded_nodes");
    yield yielded;
  }
}

function createDefaultPhaseCertifiedFrontier<T>(): DagFrontier<T> {
  return new OrderedQueue<T>({
    dequeueOrder: "fifo",
    blockOrder: "preserve",
  });
}

class CertifiedClosurePhase<NodeId extends PropertyKey, DomainHint = undefined> {
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

  async advance(
    item: ClosureFrontierItem<NodeId, DomainHint>,
  ): Promise<ClosureFrontierItem<NodeId, DomainHint>[]> {
    const state = this.graph.stateFor(item.nodeId);
    if (state.traversedBranches.has(item.branchId)) {
      this.graph.recordStaleStep();
      return [];
    }

    // A re-expanded node may be reached by another branch, but new branch joins are detected when
    // the successor frontier item is produced. Dequeue-time re-expansion is topology re-access only.
    const frontier: ClosureFrontierItem<NodeId, DomainHint>[] = [];

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
    item: ClosureFrontierItem<NodeId, DomainHint>,
    successor: DagSuccessor<NodeId, DomainHint>,
  ): ClosureFrontierItem<NodeId, DomainHint>[] {
    this.recordTraversedEdge(item.nodeId, successor.nodeId);
    const hit = this.reachSuccessorFromBranch(
      item.branchId,
      successor.nodeId,
      successor.domainHint,
    );
    const frontier = hit === undefined ? [] : this.resolveBranchByTrigger(hit);
    if (!this.graph.stateFor(successor.nodeId).expanded) {
      frontier.push({
        nodeId: successor.nodeId,
        branchId: item.branchId,
        ...(successor.domainHint === undefined ? {} : { domainHint: successor.domainHint }),
      });
    }
    return frontier;
  }

  private advanceSplitSuccessors(
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
      this.recordTraversedEdge(item.nodeId, branch.startedAt);
      const successor = successors.find((candidate) => candidate.nodeId === branch.startedAt);
      const hit = this.reachSuccessorFromBranch(branch.id, branch.startedAt, successor?.domainHint);
      if (hit !== undefined) frontier.push(...this.resolveBranchByTrigger(hit));
      if (!this.graph.stateFor(branch.startedAt).expanded) {
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
    domainHint?: DomainHint,
  ): TriggerHit<NodeId, DomainHint> | undefined {
    const branch = this.getBranchStateOrThrow(branchId);
    branch.tip = successorId;
    const joinedBranchId = this.reachNode(successorId, branchId, branch.splitId);
    if (joinedBranchId === undefined) return undefined;
    return {
      splitId: branch.splitId,
      triggerId: successorId,
      branchId,
      joinedBranchId,
      domainHint,
    };
  }

  private resolveBranchByTrigger(
    hit: TriggerHit<NodeId, DomainHint>,
  ): ClosureFrontierItem<NodeId, DomainHint>[] {
    const split = this.getSplitStateOrThrow(hit.splitId);
    if (split.resolved) return [];
    split.triggers.add(hit.triggerId);
    this.joinBranchGroups(hit.branchId, hit.joinedBranchId);

    const boundary = this.findCloseBoundary(split);
    if (boundary === undefined) return [];

    return this.closeSplit(split, boundary, hit.domainHint);
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

  private closeSplit(
    split: SplitState<NodeId>,
    boundary: NodeId,
    domainHint?: DomainHint,
  ): ClosureFrontierItem<NodeId, DomainHint>[] {
    split.resolved = true;
    split.closeBoundary = boundary;
    this.markClosedRegion(split.openedAt, boundary);

    const parentBranch = this.getBranchStateOrThrow(split.openedFromBranchId);
    parentBranch.tip = boundary;
    if (parentBranch.splitId === (0 as SplitId)) {
      this.closedBoundary = boundary;
      this.closedBoundaryDomainHint = domainHint;
      return [];
    }

    const joinedBranchId = this.reachNode(boundary, parentBranch.id, parentBranch.splitId);
    if (joinedBranchId !== undefined) {
      const parentFrontier = this.resolveBranchByTrigger({
        splitId: parentBranch.splitId,
        triggerId: boundary,
        branchId: parentBranch.id,
        joinedBranchId,
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

  toCoreResolution(): CertifiedClosureCoreResolution<NodeId, DomainHint> {
    if (this.closedBoundary !== undefined) {
      return {
        result: {
          kind: "closed-boundary",
          certifiedNodes: new Set(
            [...this.graph.states()]
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
          [...this.graph.states()].filter((state) => state.reached).map((state) => state.nodeId),
        ),
        terminalNodes: [...this.terminalNodes],
      },
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
class ClosureGraphState<NodeId extends PropertyKey, DomainHint = undefined> {
  private readonly graph: DagTopologyPort<NodeId, DomainHint>;
  private readonly telemetry?: DagPhaseCertifiedTelemetry;
  private readonly visited = new Map<NodeId, CertifiedClosureNodeState<NodeId>>();

  constructor(graph: DagTopologyPort<NodeId, DomainHint>, telemetry?: DagPhaseCertifiedTelemetry) {
    this.graph = graph;
    this.telemetry = telemetry;
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

  async expand(nodeId: NodeId): Promise<readonly DagSuccessor<NodeId, DomainHint>[]> {
    this.telemetry?.span.incrementCounter("successor_expansions");
    this.telemetry?.span.incrementCounter("exclude_expansions");
    const successors = await this.graph.getSuccessors(nodeId);
    this.markExpanded(nodeId);
    return successors;
  }

  private markExpanded(nodeId: NodeId): void {
    const state = this.mutableStateFor(nodeId);
    this.visited.set(nodeId, {
      ...state,
      expanded: true,
      reached: true,
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

  recordStaleStep(): void {
    this.telemetry?.span.incrementCounter("stale_steps");
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

export class IntegratedDifferenceState<NodeId extends PropertyKey, DomainHint = undefined> {
  private readonly includeGraph: IncludeGraphState<NodeId, DomainHint>;
  private readonly certifiedExclude = new CertifiedExcludeState<NodeId>();
  private readonly telemetry?: DagPhaseCertifiedTelemetry;

  constructor(graph: DagTopologyPort<NodeId, DomainHint>, telemetry?: DagPhaseCertifiedTelemetry) {
    this.telemetry = telemetry;
    this.includeGraph = new IncludeGraphState(graph, telemetry);
  }

  initializeInclude(startId: NodeId): void {
    this.includeGraph.initialize(startId);
  }

  // Difference-state policy plus include-side graph expansion. The returned result tells the
  // coordinator whether to enqueue more include work or resolve a certified hit.
  async expandInclude(nodeId: NodeId): Promise<IncludeExpansionResult<NodeId, DomainHint>> {
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
    const { hits, newlyCertified } = this.certifiedExclude.absorbClosure(
      closure,
      this.includeGraph,
    );
    this.telemetry?.span.incrementCounter("certified_nodes", newlyCertified);
    yield* this.applyCertifiedHits(hits);
  }

  async *applyCertifiedHits(hits: ReadonlySet<NodeId>): AsyncIterable<NodeId> {
    yield* resolveCertifiedHits(this.includeGraph, this.certifiedExclude, hits, this.telemetry);
  }

  nextExcludePhaseStart(closure: CertifiedClosurePhaseResult<NodeId>): NodeId | undefined {
    return this.certifiedExclude.nextPhaseStart(closure);
  }

  // Coordinator + IncludeGraphState responsibility. The final drain is a coordinator decision; the
  // observed local graph deletion belongs to include-side state.
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
  ): { readonly hits: Set<NodeId>; readonly newlyCertified: number } {
    const hits = new Set<NodeId>();
    let newlyCertified = 0;
    for (const nodeId of closure.certifiedNodes) {
      if (!this.certified.has(nodeId)) newlyCertified++;
      this.certified.add(nodeId);
      if (includeGraph.has(nodeId)) hits.add(nodeId);
    }

    return { hits, newlyCertified };
  }

  nextPhaseStart(closure: CertifiedClosurePhaseResult<NodeId>): NodeId | undefined {
    return closure.kind === "closed-boundary" ? closure.closedBoundary : undefined;
  }
}

async function* resolveCertifiedHits<NodeId extends PropertyKey>(
  includeGraph: MutableIncludeGraphState<NodeId>,
  certifiedExclude: ReadonlyCertifiedExcludeState<NodeId>,
  hits: ReadonlySet<NodeId>,
  telemetry?: DagPhaseCertifiedTelemetry,
): AsyncIterable<NodeId> {
  if (hits.size === 0) return;
  telemetry?.span.incrementCounter("certified_hits", hits.size);

  const classification = await classifyCertifiedHits(includeGraph, hits);
  telemetry?.span.incrementCounter("classification_runs");
  telemetry?.span.incrementCounter("classification_newer_nodes", classification.newerSideSize);
  telemetry?.span.incrementCounter("classification_older_nodes", classification.olderSideSize);

  let excludedNodes = 0;
  for (const nodeId of classification.excluded) {
    if (includeGraph.get(nodeId) !== undefined) excludedNodes++;
    includeGraph.delete(nodeId);
  }
  telemetry?.span.incrementCounter("classification_excluded_nodes", excludedNodes);

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
    walkDagReachableNodeIds(
      {
        graph: includeGraph.predecessorsPort(),
        instrumentation: noopInstrumentation,
      },
      hits,
    ),
  );
  const olderSide = await collectAsyncIterableToSet(
    walkDagReachableNodeIds(
      {
        graph: includeGraph.successorsPort(),
        instrumentation: noopInstrumentation,
      },
      hits,
    ),
  );
  const excluded = new Set(olderSide);
  const yieldable = difference(newerSide, excluded);

  for (const hit of hits) {
    yieldable.delete(hit);
    excluded.add(hit);
  }

  return { yieldable, excluded, newerSideSize: newerSide.size, olderSideSize: olderSide.size };
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
 * at the same time. Those observed links are local DAG state for certified-hit classification, not a
 * topology cache; certified-hit deletion detaches nodes from their neighbors.
 */
class IncludeGraphState<
  NodeId extends PropertyKey,
  DomainHint = undefined,
> implements MutableIncludeGraphState<NodeId> {
  private readonly graph: DagTopologyPort<NodeId, DomainHint>;
  private readonly telemetry?: DagPhaseCertifiedTelemetry;
  private readonly visited = new Map<NodeId, IncludeNodeState<NodeId>>();

  constructor(graph: DagTopologyPort<NodeId, DomainHint>, telemetry?: DagPhaseCertifiedTelemetry) {
    this.graph = graph;
    this.telemetry = telemetry;
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

  async expand(nodeId: NodeId): Promise<readonly DagSuccessor<NodeId, DomainHint>[]> {
    this.mutableStateFor(nodeId);

    this.telemetry?.span.incrementCounter("successor_expansions");
    this.telemetry?.span.incrementCounter("main_expansions");
    const successors = await this.graph.getSuccessors(nodeId);
    const successorIds = successors.map((successor) => successor.nodeId);
    this.markNodeExpanded(nodeId);
    for (const successor of successorIds) {
      this.recordExpandedEdge(nodeId, successor);
    }
    return successors;
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
