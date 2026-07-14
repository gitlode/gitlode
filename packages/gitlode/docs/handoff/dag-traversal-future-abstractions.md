# DAG Traversal Future Abstractions Handoff

This note preserves future DAG traversal ideas that were intentionally not implemented during the
NodeId/topology refactor. The completed refactor moved durable current-state contracts into the
design documents; this handoff is only continuation context for possible later sessions.

## Current baseline

The DAG traversal core is now topology-based: traversal correctness depends on stable `NodeId`
identity and `NodeId -> successors` relationships. Domain object reads, domain-object caching, and
final `NodeId -> Node` resolution belong to caller-side adapters.

The Git adapter currently resolves yielded commit OIDs back to commit objects through its
adapter-local `CommitTopologyAdapter`, which owns an invocation-scoped `CommitOid -> RawCommit`
cache.

## DomainHint and future priority scheduling

`DomainHint` exists as a scheduling-only seam. It must not affect the reachable node set, and it
must not turn traversal order into a user-visible contract.

The initial Git adapter integration intentionally supplies no Git-specific hints. If a future
frontier policy needs Git-specific scheduling data, a likely first candidate is parent-order
metadata:

```ts
interface GitCommitDomainHint {
  readonly parentIndex: number;
}
```

`parentIndex` would allow future policies to prefer first-parent or mainline-like scheduling without
changing correctness. Any timestamp-based or priority-based scheduling work should also keep result
sets independent of hints. For the current durable frontier contracts, see
`packages/gitlode/docs/design/commit-traversal-internals.md`; for phase-certified prototype
continuation notes, see `packages/gitlode/docs/handoff/explore-dag-strategy-next.md`.

## Generic cached topology adapter

Do not add a generic successor-cache helper merely to preserve the old plan. The previous
`withSuccessorCache` idea was withdrawn because the concrete Git caller needs a cache that reuses
commit objects for both successor projection and final commit-object yielding.

If repeated successor projection later becomes a measured performance problem, first add caching to
the concrete adapter that needs it. If multiple domains independently need the same shape, consider a
generic cached topology adapter that combines:

- `NodeId -> Node` reading;
- invocation-scoped node caching;
- topology projection from cached nodes;
- caller-side final node resolution through the same cache.

Do not add that abstraction until there is either a measured need in gitlode or another non-Git use
case that demonstrates the generic shape.

## Guardrails for future sessions

- Keep the DAG core free of domain-node caches and successor caches.
- Keep hints scheduling-only and outside correctness decisions.
- Do not add Node-yielding compatibility wrappers unless a separate compatibility requirement is
  explicitly accepted.
- Do not make traversal order a stable user-facing contract.
- Prefer adapter-specific caching until a generic abstraction has more than one concrete consumer.

## Timestamp path-hint continuation note

For phase-certified traversal, timestamp-like `DomainHint` values are now proven as path scheduling
metadata rather than node metadata. Future Git work should connect this by taking the committer
timestamp from the child commit already read during successor expansion and attaching it to each
parent successor descriptor. Parent commit timestamp prefetch remains out of scope.
