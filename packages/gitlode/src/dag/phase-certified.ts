import {
  instrumentAsyncIterable,
  noopInstrumentation,
  type InstrumentationSpan,
} from "../instrumentation/index.js";
import { collectAsyncIterableToSet, KeyedSet, OrderedQueue } from "../support/index.js";
import type { Brand } from "../type-utils/index.js";
import { walkDagReachableNodeIds } from "./traversal.js";
import type { DagFrontier, DagSuccessor, DagTopologyPort, WalkDagContext } from "./types.js";

/**
 * Prototype DAG traversal strategy using certified closure phases.
 *
 * This file is intentionally not wired into production traversal yet. It keeps the
 * split/branch/trigger/close-boundary rules executable while they mature toward a production
 * strategy.
 *
 * Responsibility model:
 *
 * - `walkDagNodeIdsPhaseCertifiedDifference()` acts as the coordinator. It owns the interleaving of
 *   include expansion and exclude certification phases, and it makes frontier additions and
 *   yield points visible from the main loop.
 * - Include graph bookkeeping lives in an include-side state object. It owns visited
 *   include nodes, expanded flags, and the observed successor/predecessor links used for local
 *   classification.
 * - Certified exclude bookkeeping lives in an exclude-side state object. It owns the
 *   certified exclude set, absorbs closure phase results, reports include-side hits, and decides
 *   whether another exclude phase should start from a closed boundary.
 * - Certified hit classification lives in a focused helper. It classifies include-side
 *   nodes into yieldable and excluded regions without mutating the traversal frontier.
 * - `resolveDagCertifiedClosurePhase()` provides the standalone instrumentation boundary, while
 *   `resolveDagCertifiedClosurePhaseCore()` keeps the shared closure frontier loop visible.
 *   `CertifiedClosurePhase` owns split, branch, join, and close-boundary transitions, while
 *   `ClosureGraphState` owns closure node correctness state and observed predecessor links.
 *
 * The prototype output contract remains the same as `walkDagNodeIdsEagerExclude()`:
 * `reachable(start) - reachable(exclude)` when an exclude start exists, and `reachable(start)`
 * otherwise. Yield order is not part of that contract.
 */

export type SplitId = Brand<number, "SplitId">;
export type BranchId = Brand<number, "BranchId">;
export type BranchGroupId = Brand<number, "BranchGroupId">;

export interface CertifiedClosureNodeState<NodeId extends PropertyKey> {
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

export type IncludeNodeAdvanceResult<NodeId extends PropertyKey, DomainHint = undefined> =
  | {
      readonly kind: "expanded";
      readonly successors: readonly DagSuccessor<NodeId, DomainHint>[];
    }
  | {
      readonly kind: "certified-hit";
    }
  | {
      readonly kind: "ignored";
      readonly reason: "stale" | "already-expanded";
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
  createPredecessorTopology(): DagTopologyPort<NodeId>;
  createSuccessorTopology(): DagTopologyPort<NodeId>;
  nodeIds(): NodeId[];
}

interface MutableIncludeGraphState<
  NodeId extends PropertyKey,
> extends ReadonlyIncludeGraphState<NodeId> {
  detachAndRemoveNode(nodeId: NodeId): void;
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

interface PhaseCertifiedDifferenceCoreContext<
  NodeId extends PropertyKey,
  DomainHint = undefined,
> extends WalkDagContext<NodeId, DomainHint> {
  readonly telemetry: DagPhaseCertifiedTelemetry;
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

interface CertifiedClosurePhaseResolution<NodeId extends PropertyKey, DomainHint = undefined> {
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
): Promise<CertifiedClosurePhaseResolution<NodeId, DomainHint>> {
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
    frontier.enqueueMany(await phase.processFrontierItem(item));
  }

  return phase.buildResolution();
}

/**
 * Walks the DAG difference by alternating include expansion with exclude certification phases. If
 * no exclude start is supplied, it walks every node reachable from the include start using the
 * configured difference frontier. This is still a prototype strategy and is not wired into
 * production traversal yet.
 */
export async function* walkDagNodeIdsPhaseCertifiedDifference<
  NodeId extends PropertyKey,
  DomainHint = undefined,
>(
  context: WalkDagContext<NodeId, DomainHint>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
  options: PhaseCertifiedStrategyOptions<NodeId, DomainHint> = {},
): AsyncIterable<NodeId> {
  yield* instrumentAsyncIterable(
    context.instrumentation,
    "dag.traversal",
    (span) =>
      walkDagNodeIdsPhaseCertifiedDifferenceCore(
        { ...context, telemetry: { span } },
        nodeId,
        excludeNodeId,
        options,
      ),
    { attributes: { strategy: "phaseCertified" } },
  );
}

async function* walkDagNodeIdsPhaseCertifiedDifferenceCore<
  NodeId extends PropertyKey,
  DomainHint = undefined,
>(
  context: PhaseCertifiedDifferenceCoreContext<NodeId, DomainHint>,
  nodeId: NodeId,
  excludeNodeId: NodeId | undefined,
  options: PhaseCertifiedStrategyOptions<NodeId, DomainHint>,
): AsyncIterable<NodeId> {
  const { graph, telemetry } = context;
  const state = new IntegratedDifferenceState<NodeId, DomainHint>(graph, telemetry);
  state.initializeInclude(nodeId);

  const frontier =
    options.createDifferenceFrontier?.() ??
    createDefaultPhaseCertifiedFrontier<DifferenceFrontierItem<NodeId, DomainHint>>();
  frontier.enqueueMany(
    excludeNodeId === undefined
      ? [{ role: "main", nodeId: nodeId }]
      : [
          { role: "main", nodeId: nodeId },
          { role: "exclude", nodeId: excludeNodeId },
        ],
  );

  while (!frontier.isEmpty()) {
    const item = frontier.dequeueOrThrow();

    if (item.role === "main") {
      telemetry.span.incrementCounter("traversal_steps");
      const advance = await state.advanceIncludeNode(item.nodeId);
      if (advance.kind === "ignored") {
        telemetry.span.incrementCounter("stale_steps");
      }
      if (advance.kind === "certified-hit") {
        for await (const yielded of state.resolveIncludeHits(new Set([item.nodeId]))) {
          telemetry.span.incrementCounter("certification_yielded_nodes");
          telemetry.span.incrementCounter("yielded_nodes");
          yield yielded;
        }
        continue;
      }
      if (advance.kind === "expanded") {
        frontier.enqueueMany(
          advance.successors.map((successor) => ({
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
    for await (const yielded of state.applyClosureAndResolveIncludeHits(closure)) {
      telemetry.span.incrementCounter("certification_yielded_nodes");
      telemetry.span.incrementCounter("yielded_nodes");
      yield yielded;
    }
    const nextExcludeStart = state.nextClosurePhaseStart(closure);
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
    this.graph.markCoveredByClosedRegion(startId);
    this.branches.add({
      id: this.rootBranchId,
      splitId: 0 as SplitId,
      startedAt: startId,
      groupId: 0 as BranchGroupId,
    });
    this.recordBranchReachAndDetectJoin(startId, this.rootBranchId);
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
  async advanceIncludeNode(nodeId: NodeId): Promise<IncludeNodeAdvanceResult<NodeId, DomainHint>> {
    const state = this.includeGraph.get(nodeId);
    if (state === undefined) return { kind: "ignored", reason: "stale" };

    if (this.certifiedExclude.has(nodeId)) {
      return { kind: "certified-hit" };
    }

    if (state.expanded) return { kind: "ignored", reason: "already-expanded" };

    const successors = await this.includeGraph.expand(nodeId);

    return { kind: "expanded", successors };
  }

  // Coordinator + certified-hit application responsibility. Exclude state absorbs the closure;
  // this method applies the resulting include-side hits to the include graph.
  async *applyClosureAndResolveIncludeHits(
    closure: CertifiedClosurePhaseResult<NodeId>,
  ): AsyncIterable<NodeId> {
    const { includeHits, newlyCertifiedCount } = this.certifiedExclude.absorbClosureCertification(
      closure,
      this.includeGraph,
    );
    this.telemetry?.span.incrementCounter("certified_nodes", newlyCertifiedCount);
    yield* this.resolveIncludeHits(includeHits);
  }

  async *resolveIncludeHits(hits: ReadonlySet<NodeId>): AsyncIterable<NodeId> {
    yield* resolveCertifiedHits(this.includeGraph, this.certifiedExclude, hits, this.telemetry);
  }

  nextClosurePhaseStart(closure: CertifiedClosurePhaseResult<NodeId>): NodeId | undefined {
    return this.certifiedExclude.nextClosurePhaseStart(closure);
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

  absorbClosureCertification(
    closure: CertifiedClosurePhaseResult<NodeId>,
    includeGraph: ReadonlyIncludeGraphState<NodeId>,
  ): { readonly includeHits: Set<NodeId>; readonly newlyCertifiedCount: number } {
    const includeHits = new Set<NodeId>();
    let newlyCertifiedCount = 0;
    for (const nodeId of closure.certifiedNodes) {
      if (!this.certified.has(nodeId)) newlyCertifiedCount++;
      this.certified.add(nodeId);
      if (includeGraph.has(nodeId)) includeHits.add(nodeId);
    }

    return { includeHits, newlyCertifiedCount };
  }

  nextClosurePhaseStart(closure: CertifiedClosurePhaseResult<NodeId>): NodeId | undefined {
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
    includeGraph.detachAndRemoveNode(nodeId);
  }
  telemetry?.span.incrementCounter("classification_excluded_nodes", excludedNodes);

  for (const nodeId of classification.yieldable) {
    if (classification.excluded.has(nodeId)) continue;
    const state = includeGraph.get(nodeId);
    if (state === undefined || !state.expanded || certifiedExclude.has(nodeId)) continue;
    includeGraph.detachAndRemoveNode(nodeId);
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
        graph: includeGraph.createPredecessorTopology(),
        instrumentation: noopInstrumentation,
      },
      hits,
    ),
  );
  const olderSide = await collectAsyncIterableToSet(
    walkDagReachableNodeIds(
      {
        graph: includeGraph.createSuccessorTopology(),
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
    includeGraph.detachAndRemoveNode(nodeId);
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
    this.ensureNodeState(startId);
  }

  has(nodeId: NodeId): boolean {
    return this.visited.has(nodeId);
  }

  get(nodeId: NodeId): ReadonlyIncludeNodeState<NodeId> | undefined {
    return this.visited.get(nodeId);
  }

  private ensureNodeState(nodeId: NodeId): IncludeNodeState<NodeId> {
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
    const state = this.ensureNodeState(nodeId);
    const expandedState: IncludeNodeState<NodeId> = {
      ...state,
      expanded: true,
    };
    this.visited.set(nodeId, expandedState);
  }

  async expand(nodeId: NodeId): Promise<readonly DagSuccessor<NodeId, DomainHint>[]> {
    this.ensureNodeState(nodeId);

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
    const node = this.ensureNodeState(nodeId);
    const successor = this.ensureNodeState(successorId);
    successor.predecessors.add(nodeId);
    node.successors.add(successorId);
  }

  detachAndRemoveNode(nodeId: NodeId): void {
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

  createPredecessorTopology(): DagTopologyPort<NodeId> {
    return {
      getSuccessors: async (nodeId) =>
        [...this.getNodeOrThrow(nodeId).predecessors].map((predecessor) => ({
          nodeId: predecessor,
        })),
    };
  }

  createSuccessorTopology(): DagTopologyPort<NodeId> {
    return {
      getSuccessors: async (nodeId) =>
        [...this.getNodeOrThrow(nodeId).successors].map((successor) => ({ nodeId: successor })),
    };
  }

  private getNodeOrThrow(nodeId: NodeId): IncludeNodeState<NodeId> {
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
