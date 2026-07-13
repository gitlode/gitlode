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
into the next exclude phase. The next Git-specific task is to project a commit's committer timestamp
from the normal commit read/expand operation onto the parent successor path. Do not pre-read parent
commit timestamps, do not read pending frontier nodes only to assign priority, and do not make the
Git adapter's result membership depend on timestamp monotonicity.
