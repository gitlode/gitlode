# Commit Traversal Internals

## Purpose

This document describes the internal traversal strategies used to implement
`GitAdapter.walkCommits()`.

It focuses on implementation structure, correctness constraints, performance trade-offs, and test
coverage. It intentionally does not replace `git-traversal.md`, which is the canonical document for
traversal behavior that affects gitlode's final output.

The output contract remains owned by `git-traversal.md`:

- without an exclusion boundary: `reachable(start)`
- with an exclusion boundary: `reachable(start) - reachable(exclude)`

The result set must match that contract. Yield order is not contractual.

## Scope and non-goals

This design covers:

- the internal DAG traversal seam used by `IsomorphicGitAdapter.walkCommits()`;
- the eager-exclude reference strategy;
- the certified-lazy strategy used by the current default;
- frontier policy injection;
- certificate and fallback conditions;
- tests used to protect the behavior.

This design does not cover ref resolution, extraction planning across multiple refs, state-file
semantics, output schema, or date-based filtering after traversal. Those topics belong in other
design documents, especially `git-traversal.md`.

## Strategy boundary

`dag-traversal-strategy.ts` is written as a DAG traversal module rather than a Git-object-specific
walker.

The DAG core depends on topology only:

```ts
export interface DagTopologyPort<NodeId extends PropertyKey, DomainHint = undefined> {
  getSuccessors(nodeId: NodeId): Promise<readonly DagSuccessor<NodeId, DomainHint>[]>;
}
```

Correctness state is keyed by `NodeId`; the DAG core does not know the domain node type and yields
`NodeId` values.

For Git commits, `IsomorphicGitAdapter` maps `NodeId` to `CommitOid`. It uses an adapter-internal
`CommitTopologyAdapter` that implements `DagTopologyPort<CommitOid>`, reads commit objects as needed
to project parents into successors, and exposes `readCommit(oid)` so the adapter can convert
DAG-core-yielded OIDs back into `RawCommit` objects. The rest of gitlode still receives commit
objects from the Git adapter.

This keeps strategy code focused on graph traversal. Isomorphic-git commit objects, timezone
normalization, commit-object caching, and backend error mapping stay inside the adapter boundary.

## Configured strategies

Two strategies are kept in the module:

- `walkDagNodeIdsEagerExclude`
- `walkDagNodeIdsCertifiedLazy`

`walkDagNodeIdsWithConfiguredStrategy()` accepts a strategy option and defaults to
`"certifiedLazy"`. Keeping the option makes tests and pre-release validation easy while both
implementations remain in the tree.

The strategy names describe traversal logic:

- `eagerExclude` eagerly builds the full excluded reachable set before include-side traversal.
- `certifiedLazy` delays full exclude-side traversal and yields only after proving that delayed
  topology expansion cannot affect the result set, or after falling back to full subtraction.

## Frontier policy

Strategies use `DagFrontier<DagFrontierItem<NodeId, DomainHint>>` for their frontiers. The DAG
default is FIFO with preserved successor-block order.

The frontier is scheduling-only. It does not deduplicate by `nodeId`, track visited/excluded state,
or prove correctness. Traversal loops validate dequeued items against their own state because stale
or duplicate frontier items are allowed.

Any non-default policy represents domain or strategy knowledge and must be injected explicitly.
`IsomorphicGitAdapter` injects a LIFO/preserve frontier for certified-lazy traversal so Git commit
parent order continues to prioritize the mainline path without making yield order contractual.

## Eager-exclude strategy

`walkDagNodeIdsEagerExclude()` is the reference implementation.

When `excludeNodeId` exists, it first computes all node IDs reachable from that exclusion boundary.
Then it performs include-side traversal from the start node:

1. skip node IDs already visited;
2. skip node IDs in the excluded set;
3. yield the remaining node ID;
4. enqueue successors that are neither visited nor excluded.

This is simple and robust, but expensive for large repositories because `reachable(exclude)` may
walk deep historical ancestors that will never affect the final output.

## Certified-lazy strategy

`walkDagNodeIdsCertifiedLazy()` is the production default.

When no exclusion boundary is provided, it delegates to `walkDagNodeIdsEagerExclude()` because there
is no exclude-side reasoning to optimize.

When an exclusion boundary exists, it uses a lazy two-sided view of the DAG:

- include-side traversal buffers candidate result node IDs instead of yielding immediately;
- exclude-side topology expansion is limited to the exclusion start node and stop points encountered
  by include-side traversal;
- results are yielded only after traversal either obtains a certificate or completes fallback.

Buffering is intentional: if a certificate fails, the strategy must still be able to remove all
excluded node IDs before producing output. A failed certificate must not leak partial results.

The DAG core does not cache domain nodes or successors. Git commit-object reuse belongs to the
adapter's `CommitTopologyAdapter` cache.

## Certificate

Certified-lazy traversal uses a conservative path certificate. It avoids full
`reachable(exclude)` collection only when the observed exclude boundary behaves like an unsplit path
near the include/exclude meeting point, and every include-side stop point is covered by that
boundary.

The current implementation may certify only when all of these are true:

- include-side traversal reaches at least one exclude-marked stop point;
- no include-side path reaches a terminal node outside the exclude-marked frontier;
- the exclude-side start node has either no successors or exactly one direct successor;
- no exclude-side node expanded during start-node inspection or stop-point successor marking creates
  a path split;
- every stop point is either the exclude-side start node or the single certified exclude successor.

When the certificate holds, older exclude successors are known not to affect the result set for the
current conservative model. The walker can yield buffered include-side candidate IDs without
expanding those older successors merely to prove they are excluded.

This deliberately accepts a narrower certificate than might be theoretically possible. The goal is a
safe, predictable optimization, not an exhaustive proof engine.

## Fallback

If the certificate does not hold, certified-lazy traversal falls back to a full
`reachable(exclude)` collection and deletes the full excluded set from buffered include-side
candidates before yielding.

Current fallback boundaries include:

- an include-side path reaching a terminal node;
- an exclude-side path split;
- no include-side stop points;
- any stop point not equal to the exclude-side start node or the single certified exclude
  successor.

Fallback preserves the same result-set contract as eager-exclude. It may do a similar amount of work
because DAG traversal no longer owns a successor cache.

## Error handling

Strategy code does not translate backend-specific errors.

`CommitTopologyAdapter.readCommit(oid)` is responsible for converting isomorphic-git commit-read
failures into adapter-domain errors before they cross into traversal strategy code or the rest of
gitlode. Missing start and exclusion commits are mapped to `GitAdapterError` with
`COMMIT_NOT_FOUND`; unexpected commit-read failures are mapped to `UNKNOWN`.

Certified-lazy traversal may intentionally avoid expanding older exclude successors when its
certificate succeeds. Therefore a missing object beyond a valid certificate is not guaranteed to be
reported. Eager-exclude remains the characterization path for missing older exclude ancestors.

## Instrumentation and tests

Stage 2 intentionally reduces traversal telemetry. Old DAG node-read spans and read/cache counters
are removed, and detailed DAG traversal telemetry is expected to be redesigned in a separate
telemetry-focused effort. The outer Git adapter operation remains `git.walk_commits`.

The contract suite verifies:

- eager-exclude and certified-lazy return the same OID set;
- output membership does not depend on commit timestamps;
- missing start and exclusion commits map to `COMMIT_NOT_FOUND`;
- certified-lazy avoids expanding older excluded ancestors in certified cases;
- certified-lazy falls back for disconnected DAGs, path splits, and uncovered stop points.

Adapter tests cover user-visible integration and include a certified single-successor walk that
succeeds through the certified-lazy default while eager-exclude traversal would expand a deleted
older exclude ancestor.

## Known limitations and future work

- The certificate does not advance beyond the exclusion start node's direct successor. A branch
  forked several generations before release currently falls back.
- Path split cases have no partial certificate; they use conservative fallback.
- Timestamp-priority traversal was considered but intentionally left out. Git DAG correctness must
  not depend on timestamp monotonicity.
- Detailed DAG traversal telemetry should be redesigned around the new generic DAG / Git adapter
  boundary.
