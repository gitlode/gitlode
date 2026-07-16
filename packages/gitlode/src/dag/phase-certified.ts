import { instrumentAsyncIterable } from "../instrumentation/index.js";
import { OrderedQueue } from "../support/index.js";
import { CertifiedClosurePhase } from "./certified-closure.js";
import { PhaseCertifiedDifferenceState } from "./phase-certified-difference-state.js";
import type {
  CertifiedClosurePhaseResult,
  CertifiedClosurePhaseResolution,
  ClosureFrontierItem,
  DagPhaseCertifiedTelemetry,
  DifferenceFrontierItem,
  PhaseCertifiedStrategyOptions,
} from "./phase-certified-types.js";
import type { DagFrontier, WalkDagContext } from "./types.js";

interface PhaseCertifiedDifferenceCoreContext<
  NodeId extends PropertyKey,
  DomainHint = undefined,
> extends WalkDagContext<NodeId, DomainHint> {
  readonly telemetry: DagPhaseCertifiedTelemetry;
}

/**
 * Prototype DAG traversal strategy using certified closure phases.
 *
 * This facade remains a prototype; production traversal reaches it only through Git-domain internal experiment selection. It owns the public
 * instrumentation boundaries, the difference and closure frontier loops, default FIFO/preserve
 * frontier creation, and orchestration between the certified closure state machine and the
 * include/certified integration state.
 *
 * The prototype output contract remains the same as `walkDagNodeIdsEagerExclude()`:
 * `reachable(start) - reachable(exclude)` when an exclude start exists, and `reachable(start)`
 * otherwise. Yield order is not part of that contract.
 */

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

  telemetry?.span.incrementCounter("traversal_steps");
  const initialFrontierItems = await phase.begin(rootDomainHint);
  if (initialFrontierItems.length === 0 || phase.hasClosedBoundary()) {
    return phase.buildResolution();
  }

  const frontier =
    options.createClosureFrontier?.() ??
    createDefaultPhaseCertifiedFrontier<ClosureFrontierItem<NodeId, DomainHint>>();
  frontier.enqueueMany(initialFrontierItems);

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
  const state = new PhaseCertifiedDifferenceState<NodeId, DomainHint>(graph, telemetry);
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

  while (!frontier.isEmpty() && !state.isIncludeResolved()) {
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
    // Once the include graph is empty, remaining scheduled main/exclude work is stale with
    // respect to the result set. Do not create a follow-up exclude phase after finality.
    if (state.isIncludeResolved()) break;

    if (closure.kind === "closed-boundary") {
      frontier.enqueue({
        role: "exclude",
        nodeId: closure.closedBoundary,
        ...(closedBoundaryDomainHint === undefined ? {} : { domainHint: closedBoundaryDomainHint }),
      });
    }
  }

  const terminationReason = frontier.isEmpty() ? "frontier-exhausted" : "include-resolved";
  telemetry.span.setAttribute("termination_reason", terminationReason);

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
