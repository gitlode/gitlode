# Explore DAG Strategy Follow-up Handoff

This note preserves follow-up context for `packages/gitlode/src/git-impl/explore-dag-strategy.ts`
after the NodeId/topology DAG traversal refactor.

## Current baseline

`explore-dag-strategy.ts` is a prototype traversal strategy. It is not wired into production commit
walking today, but it is not deprecated. It may still provide important future value if the
certified-closure approach is developed further.

The refactor migrated the file away from the old `DagNodePort` / domain-node-yielding abstraction and
onto the same `NodeId` / `DagTopologyPort` model used by the production DAG traversal core. That work
was intentionally limited to the abstraction migration.

## Contract to preserve while iterating

The prototype should continue to model the same difference-set contract as production traversal:

```text
reachable(start) - reachable(exclude)
```

Yield order is not the contract. Local graph links used by the prototype for certified-hit
classification are algorithmic state and should not be removed merely because they look like caches.

## Deferred algorithm work

The frontier injection seam is complete for the phase-certified prototype: difference coordination
and each closure phase can now receive independent scheduling queues while preserving the durable
result-set contract documented in `packages/gitlode/docs/design/commit-traversal-internals.md`.

The next scheduling-related task is to design priority metadata, if a concrete priority policy needs
it. Do not add timestamp, priority, or generic scheduling context fields until that design is made.

## Suggested validation scenarios

When developing the prototype further, compare its output set against eager-exclude traversal on
small fixtures that cover:

- simple linear history;
- merge commits and split/rejoin shapes;
- exclude ancestors that fully certify a result;
- exclude ancestors that force fallback or continued exploration;
- disconnected exclude nodes;
- stale or duplicate frontier items;
- cases where certified-hit classification depends on both predecessor and successor links.

## Telemetry status

The prototype now has operation-level telemetry for the FIFO phase-certified baseline. Durable
counter semantics live in `packages/gitlode/docs/design/commit-traversal-internals.md`; keep this
handoff limited to future continuation notes rather than duplicating those definitions.

## Path scheduling hint status

The phase-certified prototype now carries generic `DomainHint` values on difference and closure
frontier items. These hints are path-local scheduling metadata: successor descriptors may project
metadata from the node that was just expanded onto the path toward each successor, and injected
frontiers may use that metadata for priority. Start items remain hintless.

Synthetic tests cover child-timestamp-style projection, including closed-boundary hint inheritance
into the next exclude phase. The Git adapter now projects child committer timestamps from normal
topology reads onto parent successor paths. A stable Git timestamp-priority frontier policy now exists
for explicit phase-certified prototype injection; durable semantics live in
`packages/gitlode/docs/design/commit-traversal-internals.md`.

Next work should focus on the production adoption gate: design whether and how the Git adapter should
connect production commit walking to the phase-certified strategy, expand A/B/C correctness,
efficiency, and resource validation, and keep parent timestamp pre-reads out of any production plan.

## Successor cache responsibility follow-up

A review follow-up aligned the phase-certified prototype with the durable DAG-core contract that
successor and domain-object caching belong to adapters, not traversal strategy state. Closure state
now keeps only correctness data such as reached/expanded flags, traversed branches, closed-cover
marks, and predecessor links used for branch-resolution walks. Include state keeps observed local
successor/predecessor links for certified-hit classification and deletion, but `expand()` is not a
successor-cache API. Re-accessing topology through the DAG core should therefore increment DAG
successor-expansion counters and call `DagTopologyPort.getSuccessors()` again, letting the Git
adapter's `CommitTopologyAdapter` own commit-object reuse and cache-hit telemetry.

## Closure re-expansion and frontier compliance follow-up

A later review removed the artificial known-node fixture that mutated frontier blocks. Frontier
factories are scheduling-only: they may preserve, reverse, prioritize, or otherwise reorder the
items produced by traversal, but they must not add, delete, or rewrite `nodeId`, `branchId`, or
`domainHint` values. Re-expansion coverage now uses a normal partial-rejoin topology where FIFO
ordering causes two legitimate `JOIN` items to be queued before either is expanded.

The review also confirmed the branch-join invariant used by the closure prototype: production
successor frontier items pass through `reachSuccessorFromBranch()` or parent-continuation
`reachNode()` before enqueue, so joins between different branch groups are discovered at reach time.
Branch groups only merge afterward. Dequeue-time re-expansion can therefore re-access topology and
propagate freshly returned successor hints, but it is not a meaningful separate branch-join trigger.

## B-validation follow-up status

A dedicated phase-certified efficiency validation suite now compares FIFO/preserve with the Git child-derived timestamp priority policy on synthetic favorable, equal-timestamp, and non-monotonic fixtures. The suite is intentionally limited to deterministic graph-work telemetry and topology access traces; it does not benchmark wall-clock time, real repositories, memory behavior, or production adoption. Future work should strengthen these fixtures if new telemetry reveals a clearer graph-work reduction opportunity, and production connection remains out of scope until a separate adoption gate.
