import { noopInstrumentation } from "../instrumentation/index.js";
import { collectAsyncIterableToSet } from "../support/index.js";
import type {
  CertifiedClosurePhaseResult,
  DagPhaseCertifiedTelemetry,
} from "./phase-certified-types.js";
import { walkDagReachableNodeIds } from "./traversal.js";
import type { DagSuccessor, DagTopologyPort } from "./types.js";

/** Include-side graph and certified-exclude integration state for phase-certified difference. */
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

type IncludeNodeAdvanceResult<NodeId extends PropertyKey, DomainHint = undefined> =
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
  isEmpty(): boolean;
}

interface MutableIncludeGraphState<
  NodeId extends PropertyKey,
> extends ReadonlyIncludeGraphState<NodeId> {
  detachAndRemoveNode(nodeId: NodeId): void;
}

interface ReadonlyCertifiedExcludeState<NodeId extends PropertyKey> {
  has(nodeId: NodeId): boolean;
}

/**
 * Integrates certified-exclude membership with the observed include-side graph.
 *
 * Frontier sequencing and the decision to start another closure phase belong to the facade.
 */
export class PhaseCertifiedDifferenceState<NodeId extends PropertyKey, DomainHint = undefined> {
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

  /**
   * True when every include node observed so far has been finally yielded or excluded.
   *
   * Include graph entries represent unresolved include-side nodes: the start node is registered
   * before traversal, successors are registered before their main frontier items are scheduled,
   * certified-hit exclusions delete nodes, and yielded expanded nodes are deleted only after their
   * successors have already been registered. Pending main items for deleted nodes are therefore
   * stale and cannot change the result set.
   */
  isIncludeResolved(): boolean {
    return this.includeGraph.isEmpty();
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

  // Exclude state absorbs the closure; this method applies the resulting certified hits to the
  // include graph.
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

  // The facade decides when to drain; observed local graph deletion belongs to include-side state.
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

  isEmpty(): boolean {
    return this.visited.size === 0;
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
