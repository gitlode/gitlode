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
`CommitTopologyAdapter` that implements `DagTopologyPort<CommitOid, CommitPathSchedulingHint>`, reads
commit objects as needed to project parents into successors, and exposes `readCommit(oid)` so the
adapter can convert DAG-core-yielded OIDs back into `RawCommit` objects. The rest of gitlode still
receives commit objects from the Git adapter.

This keeps strategy code focused on graph traversal. Isomorphic-git commit objects, timezone
normalization, commit-object caching, and backend error mapping stay inside the adapter boundary.

## Git commit path scheduling hints

`CommitTopologyAdapter` projects Git-specific scheduling metadata while it performs the normal
topology read for an expanded child commit. After `readCommit(oid, "topology")` returns the child
`RawCommit`, the adapter creates a `CommitPathSchedulingHint` whose `sourceCommitterTimestamp` is
the child commit's committer timestamp in Unix seconds. It then attaches that same child-derived
hint value to every parent successor path produced from the child.

The hint is path-local scheduling metadata. It is not metadata about the pending parent node, is not
correctness state, and must not be used for visited keys, exclusion state, certificates, or yield
eligibility. The adapter does not pre-read parent commits, does not perform a hint-specific commit
read, and does not rely on timestamp monotonicity. Start items, including include starts, exclude
starts, and standalone reachable starts, remain hintless until their first topology expansion
produces successor paths.

The current production Git frontier is still the injected LIFO/preserve frontier used by
`walkDagNodeIdsCertifiedLazy()`. It transports `CommitPathSchedulingHint` values type-safely but
does not inspect them for priority, so timestamps do not affect result membership and do not make
yield order contractual.

The Git-specific timestamp-priority frontier policy is an explicit domain policy for prototype
experiments. Its comparator only reads `domainHint?.sourceCommitterTimestamp` from queued frontier
items:

- hintless items sort before hinted items, so include/exclude starts and standalone closure roots can
  bootstrap without pre-reading parent commits;
- when both items are hinted, newer child-derived committer timestamps sort before older timestamps;
- hintless ties and equal-timestamp ties return `0`, leaving stable enqueue-order tie-breaking to
  `PriorityQueue`;
- the comparator must not inspect node IDs, traversal role, branch IDs, topology, commit objects,
  visited/certified state, or external mutable state.

The policy is scheduling-only. It is a heuristic over the expanded child commit's timestamp, not a
claim about the pending parent node's timestamp. It must not change reachable-difference membership,
certificate decisions, adapter commit-read/cache responsibility, or telemetry counter definitions.

## Available strategies

The production DAG traversal module exports two difference strategies:

- `walkDagNodeIdsEagerExclude`
- `walkDagNodeIdsCertifiedLazy`

The phase-certified prototype is exported separately as
`walkDagNodeIdsPhaseCertifiedDifference()`. There is currently no shared strategy dispatcher or
runtime strategy-selection option. `IsomorphicGitAdapter` calls `walkDagNodeIdsCertifiedLazy()`
directly, so certified-lazy remains the production behavior until a separate adoption task adds an
explicit selection seam.

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

Traversal instrumentation is designed to compare the efficiency of strategies that solve the same
result-set problem, not to define a stable user-facing contract. The main diagnostic question is how
much graph and commit-object work was needed to produce the final yielded commit set.

The instrumentation boundary follows the implementation boundary:

- the DAG traversal core records topology and strategy work;
- the Git adapter records commit-object reads, commit cache hits, and yielded commit objects.

This means the DAG core uses graph vocabulary such as successor expansion instead of Git-specific
vocabulary such as commit read. For Git repositories, a successor expansion usually causes the
adapter to read or reuse a commit object to project parent OIDs, but that object-level cost belongs
to adapter telemetry.

`dag.traversal` records the strategy-level operation for `reachable(start) - reachable(exclude)`.
It includes the selected strategy and common counters such as `yielded_nodes`,
`traversal_steps`, `successor_expansions`, `main_expansions`, `exclude_expansions`, and
`stale_steps`. Strategy-specific diagnostics include `result=certified|fallback`,
`fallback_reason`, `excluded_nodes`, and `fallback_removed` where applicable.

`dag.reachable` records top-level `reachable(...)` operations. Its `yielded_nodes` counter means
the number of nodes in that reachable result. When reachable traversal is used internally as an
exclude-collection phase for `dag.traversal`, it is implemented through the reusable core rather than
the public facade. In that context, internal reachable yields are not counted as parent
`yielded_nodes`; the caller records the collection size as `excluded_nodes` instead.

DAG traversal functions exported as public operations should keep operation-level telemetry
semantics. Reusable traversal implementations may accept a context-specific telemetry observer so
callers can report the same graph work in the vocabulary of the enclosing operation. Whether a
helper is technically exported for another in-repository strategy module is less important than
whether it represents a public traversal-domain operation.

The adapter-level `git.walk_commits` span records `commits_yielded`, total backend
`commit_reads`, and read/cache counters split by purpose. `topology_commit_reads` and
`topology_commit_cache_hits` describe commit-object access while projecting DAG successors.
`materialize_commit_reads` and `materialize_commit_cache_hits` describe commit-object access while
turning yielded OIDs into `RawCommit` objects. The cache is intentionally shared by both purposes,
but the counters stay separate so materialization cache hits do not hide whether caching helped the
DAG topology walk. Comparing total `commit_reads` with `commits_yielded` shows commit-read overshoot
for the walk. DAG counters explain which traversal path caused the extra topology work.

The contract suite verifies:

- eager-exclude and certified-lazy return the same OID set;
- output membership does not depend on commit timestamps;
- missing start and exclusion commits map to `COMMIT_NOT_FOUND`;
- certified-lazy avoids expanding older excluded ancestors in certified cases;
- certified-lazy falls back for disconnected DAGs, path splits, and uncovered stop points.
- traversal diagnostics cover representative reachable, eager-exclude, certified, fallback, and
  adapter read/cache/yield cases without making every counter value a long-term contract.

Adapter tests cover user-visible integration and include a certified single-successor walk that
succeeds through the certified-lazy default while eager-exclude traversal would expand a deleted
older exclude ancestor.

## Known limitations and future work

- The certificate does not advance beyond the exclusion start node's direct successor. A branch
  forked several generations before release currently falls back.
- Path split cases have no partial certificate; they use conservative fallback.
- Git timestamp-priority frontier ordering is implemented as an explicit phase-certified prototype
  injection policy. Production certified-lazy ordering still does not inspect timestamps, and Git DAG
  correctness must not depend on timestamp monotonicity.
- Phase-certified prototype telemetry is now defined in this document for the experimental
  certified-closure strategy. Future telemetry work should preserve the generic DAG / Git adapter
  boundary.

## Phase-certified prototype frontier injection

`explore-dag-strategy.ts` keeps separate injectable frontier factories for the experimental
phase-certified prototype:

- the difference coordinator frontier schedules include-side work items and exclude closure-phase
  triggers;
- the closure frontier schedules node/branch work inside one certified-closure phase.

When no factory is supplied, both frontiers use `OrderedQueue` with `dequeueOrder: "fifo"` and
`blockOrder: "preserve"`, matching the previous array `shift()` / `push()` behavior. A difference
operation creates one difference frontier. Each closure phase creates a fresh closure frontier; a
difference operation that starts multiple closure phases therefore receives multiple independent
closure queues, and standalone `resolveDagCertifiedClosurePhase()` creates one closure queue per
operation.

These frontiers are scheduling-only seams. They hold pending items and select the next item to
process, but they do not own visited state, stale detection, deduplication, certified/excluded state,
or the decision to start another closure phase. Closure frontier items still carry `branchId` because
that value is closure-algorithm correctness state for split/rejoin resolution, not a scheduling hint
or `DomainHint`.

Alternative policies may change processing order, but must not change the reachable-difference
result set. Successor groups are enqueued as blocks so block-aware policies can preserve or reverse
within-block order consistently without moving correctness state into the queue.

For Git timestamp-priority experiments, the same commit timestamp priority contract is injected into
both `createDifferenceFrontier` and `createClosureFrontier`. The difference operation receives one
fresh priority queue for its coordinator frontier. Every closure phase receives its own fresh priority
queue, including closed-boundary follow-up phases and standalone closure operations. Queue instances
must not be shared across difference operations or closure phases.

The generic phase-certified default remains FIFO/preserve. Git timestamp priority is only active when
callers explicitly inject the Git-specific policy. The phase-certified strategy is still not wired
into production commit walking, and production certified-lazy traversal keeps its LIFO/preserve
frontier until a separate production adoption gate changes that decision.

## Phase-certified prototype telemetry

`explore-dag-strategy.ts` keeps a prototype strategy for the same difference contract,
`reachable(includeStart) - reachable(excludeStart)`. It is not wired into production commit
walking, but its instrumentation follows the same operation-level boundary as production DAG
traversal so FIFO prototype runs can be compared with later frontier-policy experiments.

`walkDagNodeIdsPhaseCertifiedDifference()` records one `dag.traversal` span with
`strategy=phaseCertified`. Internal closure phases do not create child `dag.certified_closure` spans;
their work is aggregated into the enclosing traversal span. The common counters have the same graph
meaning as the production strategies:

- `yielded_nodes`: nodes finally yielded by the difference operation only.
- `traversal_steps`: include frontier items plus closure frontier items that are dequeued for work;
  exclude coordinator items are phase triggers and are not counted separately from the closure start
  item.
- `stale_steps`: dequeued work items discarded as stale or duplicate, such as deleted include
  states, already-expanded include nodes, or closure nodes already traversed by the same branch.
  Certified hits are meaningful state transitions and are not stale.
- `successor_expansions`, `main_expansions`, and `exclude_expansions`: calls to the underlying
  `DagTopologyPort.getSuccessors()`. Include-side local predecessor/successor walks used for
  certified-hit classification are local graph operations and are intentionally not counted as
  topology expansions.

The prototype also records strategy-specific counters on the same `dag.traversal` span:

- closure outcomes: `closure_phases`, `closed_boundary_phases`, `exhausted_phases`,
  `certified_nodes`, and `terminal_nodes`;
- certified-hit classification: `certified_hits`, `classification_runs`,
  `classification_newer_nodes`, `classification_older_nodes`, and
  `classification_excluded_nodes`;
- yield source split: `certification_yielded_nodes` and `drain_yielded_nodes`.

For completed phase-certified difference operations, `yielded_nodes` is the sum of
`certification_yielded_nodes` and `drain_yielded_nodes`, subject to the recorder's normal behavior
of omitting counters that were never incremented.

`resolveDagCertifiedClosurePhase()` is also a standalone operation. When called directly, it records
one `dag.certified_closure` span with `result=closed-boundary` or `result=exhausted` after the phase
finishes. Standalone closure spans record closure frontier steps, exclude-side successor expansions,
`certified_nodes`, and exhausted-phase `terminal_nodes`. Difference traversal calls the shared
closure core directly to avoid double-spanning internal phases.

### Phase-certified path scheduling hints

The phase-certified prototype also permits frontier items to carry a generic `DomainHint`. A hint is
path scheduling metadata, not node metadata and not correctness state. It must not participate in
reachable-set membership, visited keys, stale checks, certified sets, split or rejoin decisions,
branch grouping, include-side classification, or yield eligibility. Changing or omitting hints must
not change the result set.

Hints are transported from an expanded node to the frontier items for its successor paths. The start
items for a difference walk are enqueued as one hintless bootstrap block in `main start`, then
`exclude start` order; standalone closure roots also start without a hint. The Git timestamp-priority
policy treats hintless start items as bootstrap work that runs before hinted items, but that ordering
belongs to the injected frontier comparator rather than the algorithm.

A single node ID may appear in multiple queued items with different hints when multiple paths reach
that node. The phase-certified prototype therefore keeps hints on frontier items and does not merge
them into a single `NodeId -> DomainHint` value. Closed-boundary closure phases carry the trigger
path hint that established the boundary into both the next difference-side exclude item and the next
closure root item, while the public `CertifiedClosurePhaseResult` remains hint-free.

Synthetic timestamp tests model the intended future Git projection by attaching the expanded child
node's timestamp to each successor path. The successor's own timestamp is not read before priority is
decided. Timestamp assignment changes, equal timestamps, and non-monotonic child/parent timestamps
may alter processing order but must not alter `reachable(start) - reachable(exclude)` membership.
The Git adapter now projects child committer timestamps during normal topology reads, while production commit walking still does not use the phase-certified prototype or the timestamp-priority policy.

Closure re-expansion and branch-join detection are separate concerns. A compliant frontier may only
hold and reorder the pending items produced by traversal; it must not synthesize, drop, or rewrite
frontier items. When a closure branch reaches a successor, the phase records that reach immediately
and detects joins against other branch groups before enqueueing the successor item. Because branch
groups only merge and do not later split, dequeue-time re-expansion of an already-expanded closure
node re-accesses topology for scheduling/telemetry but is not a separate opportunity to discover a
new branch join.

## Phase-certified B-validation status

Synthetic B-validation tests compare the experimental phase-certified difference operation with the
FIFO/preserve default frontier and the explicit Git child-derived timestamp priority frontier. These
fixtures are controlled Git-history patterns: they use commit-to-parent edges, ordinary zero-, one-,
and two-parent commits, branch heads, merge commits, and shared older history. They are not arbitrary
DAG stress tests, wall-clock benchmarks, or real repository performance claims.

For this validation suite, two-parent fixture commits are constrained to merge parents that are not
reachable from one another. This is a fixture-design guardrail so the observed B-validation signal is
not coupled to ancestor-parent merge shapes; it is not a general production contract for all Git
merges.

The tests use the same `reachable(includeStart) - reachable(excludeStart)` operation for both
policies and check membership against an independent reachable-difference oracle with duplicate-yield
checks. Telemetry counters such as `traversal_steps`, `successor_expansions`, `main_expansions`,
`exclude_expansions`, `stale_steps`, closure-phase counts, classification counts, and yield-source
counts make graph work comparable without relying on elapsed time. `yielded_nodes` is treated as an
output-size counter rather than a standalone efficiency proof.

The favorable fixture models a normal Git-like history with an include head, an exclude boundary, a
mainline path, a topic-side path, an ordinary two-parent merge whose parents are independent, shared
older history, and monotonically non-increasing parent timestamps. Child-derived timestamp priority
reaches the useful shared-join path before FIFO's stale root-side path and strictly reduces
`traversal_steps`, `successor_expansions`, and `exclude_expansions`. The equal-timestamp control uses
the same topology with all timestamps equal; because the comparator returns `0` for equal hinted
items and for hintless ties, the priority queue preserves enqueue sequence in both the difference and
closure frontiers and matches FIFO telemetry and topology access order exactly. The non-monotonic
fixture is also Git-like and uses independent merge parents, but marks one topic-tip-to-topic-base
edge with an intentional timestamp anomaly. That anomaly makes priority follow an unhelpful root-side
path first and strictly increases the same graph-work counters, demonstrating that timestamp priority
remains a heuristic rather than a correctness or performance guarantee.

These tests do not prove that timestamp priority is beneficial on real repositories, do not compare
processing time, and do not connect the phase-certified prototype to production commit walking.
Production adoption remains a separate design and validation gate.
