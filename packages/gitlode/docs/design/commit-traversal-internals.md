# Commit Traversal Internals

## Purpose

This document describes the internal traversal strategies used to implement
`GitAdapter.walkCommits()`.

It focuses on implementation structure, correctness constraints, performance trade-offs, and
diagnostics. It intentionally does not replace `git-traversal.md`, which is the canonical document
for traversal behavior that affects gitlode's final output.

The output contract remains owned by `git-traversal.md`:

- without an exclusion boundary: `reachable(start)`
- with an exclusion boundary: `reachable(start) - reachable(exclude)`

The result set must match that contract. Yield order is not contractual. `AsyncIterable<Node>` is
used so strategies can emit nodes once they are safe to emit; consumers must not treat traversal
order as a semantic guarantee.

## Scope and non-goals

This design covers:

- the internal DAG traversal seam used by `IsomorphicGitAdapter.walkCommits()`;
- the eager-exclude reference strategy;
- the certified-lazy strategy used by the current default;
- queue policy injection;
- certificate and fallback conditions;
- tests and instrumentation used to protect the behavior.

This design does not cover:

- ref resolution;
- extraction planning across multiple refs;
- state-file semantics;
- output schema;
- date-based filtering after traversal.

Those topics belong in other design documents, especially `git-traversal.md`.

## Strategy boundary

`dag-traversal-strategy.ts` is written as a DAG traversal module rather than a Git-object-specific
walker.

The adapter supplies a `DagNodePort<NodeId, Node>`:

- `readNode(nodeId)` reads a node and translates backend-specific errors before they cross into
  strategy code.
- `getSuccessors(node)` returns successor IDs along the traversal direction.

For Git commits, `IsomorphicGitAdapter` maps:

- `NodeId` to `CommitOid`;
- `Node` to `RawCommit`;
- `getSuccessors(node)` to `node.parents`.

This keeps strategy code focused on graph traversal. Isomorphic-git commit objects, timezone
normalization, and backend error mapping stay inside the adapter boundary.

## Configured strategies

Two strategies are kept in the module:

- `walkDagEagerExclude`
- `walkDagCertifiedLazy`

`walkDagWithConfiguredStrategy()` accepts a strategy option and defaults to `"certifiedLazy"`.
Keeping the option makes tests and pre-release validation easy while both implementations remain in
the tree.

The strategy names describe traversal logic:

- `eagerExclude` eagerly builds the full excluded reachable set before include-side traversal.
- `certifiedLazy` delays full exclude-side traversal and yields only after proving that delayed
  reads cannot affect the result set, or after falling back to full subtraction.

## Queue Policy

Strategies use `WorkQueue<NodeId>` for their frontiers. The DAG default is:

```ts
new OrderedQueue<NodeId>({
  dequeueOrder: "fifo",
  blockOrder: "preserve",
});
```

Any other queue policy represents domain or strategy knowledge and must be injected explicitly.
`IsomorphicGitAdapter` injects a LIFO/preserve include queue for certified-lazy traversal so Git
commit parent order continues to prioritize the mainline path.

## Eager-exclude strategy

`walkDagEagerExclude()` is the reference implementation.

When `excludeNodeId` exists, it first computes all nodes reachable from that exclusion boundary.
Then it performs include-side traversal from the start node:

1. skip nodes already visited;
2. skip nodes in the excluded set;
3. read and yield the remaining node;
4. enqueue successors that are neither visited nor excluded.

This is simple and robust, but expensive for large repositories because `reachable(exclude)` may
walk deep historical ancestors that will never affect the final output.

## Certified-lazy strategy

`walkDagCertifiedLazy()` is the production default.

When no exclusion boundary is provided, it delegates to `walkDagEagerExclude()` because there is no
exclude-side reasoning to optimize.

When an exclusion boundary exists, it uses a lazy two-sided view of the DAG:

- include-side traversal buffers candidate result nodes instead of yielding immediately;
- exclude-side reads are limited to the exclusion start node and stop points encountered by the
  include-side traversal;
- every read node is cached so fallback can reuse it;
- results are yielded only after traversal either obtains a certificate or completes fallback.

Buffering is intentional: if a certificate fails, the strategy must still be able to remove all
excluded nodes before producing output. A failed certificate must not leak partial results.

## Certificate

Certified-lazy traversal uses a conservative path certificate. It avoids full
`reachable(exclude)` collection only when the observed exclude boundary behaves like an unsplit path
near the include/exclude meeting point, and every include-side stop point is covered by that
boundary.

The current implementation may certify only when all of these are true:

- include-side traversal reaches at least one exclude-marked stop point;
- no include-side path reaches a terminal node outside the exclude-marked frontier;
- the exclude-side start node has either no successors or exactly one direct successor;
- no exclude-side node read during start-node inspection or stop-point successor marking creates a
  path split;
- every stop point is either the exclude-side start node or the single certified exclude successor.

When the certificate holds, older exclude successors are known not to affect the result set for the
current conservative model. The walker can yield buffered include-side candidates without reading
those older successors merely to prove they are excluded.

This deliberately accepts a narrower certificate than might be theoretically possible. The goal is a
safe, predictable optimization, not an exhaustive proof engine.

## Fallback

If the certificate does not hold, certified-lazy traversal falls back to a cached
`reachable(exclude)` collection.

Fallback reuses nodes already read through the strategy's internal DAG node seam. It then deletes
the full excluded set from buffered include-side candidates before yielding.

Current fallback boundaries include:

- an include-side path reaching a terminal node;
- an exclude-side path split;
- no include-side stop points;
- any stop point not equal to the exclude-side start node or the single certified exclude
  successor.

Fallback preserves the same result-set contract as eager-exclude. It may do a similar amount of
work, but cached reads avoid re-reading nodes already inspected by certified-lazy traversal.

## Error handling

Strategy code does not translate backend-specific errors.

The adapter-provided `DagNodePort.readNode()` is responsible for converting backend failures into
adapter-domain errors before they cross into traversal strategy code. For isomorphic-git commit
reads, missing start and exclusion commits are mapped to `GitAdapterError` with
`COMMIT_NOT_FOUND`.

Certified-lazy traversal may intentionally avoid reading older exclude successors when its
certificate succeeds. Therefore a missing object beyond a valid certificate is not guaranteed to be
reported. Eager-exclude remains the characterization path for missing older exclude ancestors.

## Instrumentation and tests

DAG strategy internals use `dag.*` profiling spans such as:

- `dag.traversal`
- `dag.traversal.step`
- `dag.traversal.collect_reachable`
- `dag.traversal.read_node.include`
- `dag.traversal.read_node.exclude`

The outer Git adapter operation remains `git.walk_commits`. Strategy attributes and counters such
as `strategy`, `result`, `fallback_reason`, `include_reads`, and `yielded` belong to
`dag.traversal`, not the adapter-level Git span.

The DAG node read seam is internal, not public API. Contract tests inject it directly so they can
assert read sets without patching the imported `isomorphic-git` ESM module.

The contract suite verifies:

- eager-exclude and certified-lazy return the same OID set;
- output membership does not depend on commit timestamps;
- missing start and exclusion commits map to `COMMIT_NOT_FOUND`;
- certified-lazy avoids reading older excluded ancestors in certified cases;
- certified-lazy falls back for disconnected DAGs, path splits, and uncovered stop points;
- cached fallback does not re-read the same OID through the read seam.

Adapter tests cover user-visible integration and include a certified single-successor walk that
succeeds through the certified-lazy default while eager-exclude traversal would read a deleted older
exclude ancestor.

## Known limitations and future work

- The certificate does not advance beyond the exclusion start node's direct successor. A branch
  forked several generations before release currently falls back.
- Path split cases have no partial certificate; they use conservative fallback.
- Timestamp-priority traversal was considered but intentionally left out. Git DAG correctness must
  not depend on timestamp monotonicity.
- The strategy module is generic over DAG nodes, but current production use is still Git commit
  traversal.
