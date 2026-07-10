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

Future work on this file should focus on understanding and improving the certified-closure algorithm
itself. In particular:

- review `ClosureGraphState` and `IncludeGraphState` as algorithmic state, not generic cache helpers;
- evaluate closure-phase metadata such as `branchId` on its own terms;
- decide whether any phase-local frontier metadata should map to shared `DagFrontierItem` scheduling
  context, or remain prototype-specific;
- avoid forcing `branchId` or closure-specific metadata into `DomainHint` unless it is genuinely
  scheduling-only information for a concrete frontier policy;
- avoid rewriting the algorithm just to mirror production traversal internals.

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
