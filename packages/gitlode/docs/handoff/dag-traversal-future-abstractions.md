# DAG Traversal Future Abstractions Handoff

This note preserves future DAG traversal ideas that were intentionally not implemented during the
NodeId/topology refactor. The completed refactor moved durable current-state contracts into the
design documents; this handoff is only continuation context for possible later sessions.

## Current baseline

The internal generic DAG subsystem at `packages/gitlode/src/dag/` is now topology-based: traversal correctness depends on stable `NodeId`
identity and `NodeId -> successors` relationships. Domain object reads, domain-object caching, and
final `NodeId -> Node` resolution belong to caller-side adapters.

The Git adapter currently resolves yielded commit OIDs back to commit objects through its adapter-local `CommitTopologyAdapter`, which owns an invocation-scoped `CommitOid -> RawCommit` cache plus adapter read/cache telemetry and Git object error translation. Git-specific timestamp hints and policies are owned by `packages/gitlode/src/git-impl/commit-traversal/`, not by the generic DAG subsystem.

## DomainHint and remaining scheduling ideas

`DomainHint` exists as a scheduling-only seam. It must not affect the reachable node set, and it
must not turn traversal order into a user-visible contract.

The Git adapter now projects the expanded child commit's committer timestamp onto each parent path,
and the phase-certified prototype has an explicit stable timestamp-priority policy. Those current
contracts are documented in `packages/gitlode/docs/design/commit-traversal-internals.md`.

A separate future policy could still consider parent-order metadata:

```ts
interface GitCommitDomainHint {
  readonly parentIndex: number;
}
```

`parentIndex` would allow future policies to prefer first-parent or mainline-like scheduling without
changing correctness. Do not add it without a concrete policy and validation need. Result sets must
remain independent of every scheduling hint.

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

For phase-certified traversal, timestamp-like `DomainHint` values are path scheduling metadata rather
than node metadata. The Git adapter now takes the committer timestamp from the child commit already
read during successor expansion and attaches it to each parent successor descriptor. Parent commit
timestamp prefetch remains out of scope. Production strategy selection and phase-certified adoption
remain separate work.
