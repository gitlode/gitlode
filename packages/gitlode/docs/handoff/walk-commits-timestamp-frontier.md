# walkCommits Timestamp Frontier Handoff

## Purpose

This handoff records the current design direction for a future `walkCommits` traversal prototype
that uses commit timestamps only as traversal-priority hints.

The stable public contract remains:

```text
reachable(start) - reachable(exclude)
```

This document is intentionally LLM-oriented continuation context. It is not yet a durable design
contract. If the prototype is implemented and accepted, migrate the stable decisions into
`../design/walk-commits-strategies.md`.

## Background

`walkCommits` currently has two internal strategies in `src/git-impl/walk-commits-strategy.ts`:

- `eagerExclude`: eagerly builds the full `reachable(exclude)` set, then walks include-side
  commits.
- `certifiedLazy`: walks include-side candidates first, then yields only after a conservative
  certificate or after cached fallback to full exclusion.

The motivating user scenario is release-range extraction, for example commits reachable from
`v10` except commits reachable from `v9`, equivalent to `git log v9..v10` at the set level.

`eagerExclude` is simple and correct but can waste many reads when `v9` has a very large prior
history and `v10` reaches `v9` early. `certifiedLazy` can avoid that work in a narrow
single-anchor case, but it commonly falls back when:

- the exclusion boundary, such as `v9`, is a merge commit;
- an include-side path does not reach the exclusion boundary, such as a feature branch forked
  during `v9` development and merged during `v10` development.

Generation numbers would be the more Git-native acceleration mechanism, but they are not available
through the current `isomorphic-git` adapter API. For now, avoid adding a native Git adapter,
shelling out to `git log`, or building a generation-number cache inside gitlode.

## Current Direction

Status: discussion is still active. Do not start implementing the prototype from this document yet.
Several correctness and state-management questions remain open, especially around exclude-cover
closure and phase-local pending propagation.

Prototype a bidirectional traversal strategy that:

- advances include and exclude frontiers together;
- uses a priority hint derived from commit timestamps to choose expansion order;
- treats timestamps strictly as heuristics, never as proof;
- preserves cached fallback to full subtraction when early proof is not available;
- compares read counts and profile details against `eagerExclude` and `certifiedLazy` before any
  production default change.

Correctness must never depend on timestamp monotonicity. Git commit timestamps can run backward
relative to parent links and can be equal across many commits.

## Exclude-Closure Phase Traversal

The current candidate simplification is a phase-based bidirectional traversal, tentatively called
`exclude-closure phase traversal`.

The core idea is to avoid allowing include-side traversal to interact with an open exclude cover.
When exclude-side traversal is in an open state, include-side traversal pauses. Exclude-side
traversal then continues until the exclude cover becomes closed again, or until the strategy
falls back to full subtraction.

This gives the include side a simpler rule:

- if include traversal hits an exclude node, that exclude node must be closed;
- hitting a closed exclude node both stops include expansion and certifies the include segment up
  to that stop point;
- there is no long-lived include-side "waiting for this open exclude stop to close" state.

Confirmed result nodes do not need a confirmed-result collection. Because `walkCommits` returns an
`AsyncIterable<Node>`, confirmed nodes can be yielded immediately. The strategy only needs enough
state to avoid duplicate yield and to retain unconfirmed include nodes while they may still be
excluded.

The expected result-node lifecycle is:

```text
unconfirmed include node -> yielded result node
unconfirmed include node -> excluded node
```

Once a node is yielded, the traversal must never later discover that it is exclude-reachable.
Therefore immediate yield is allowed only when the current proof makes result membership final.

## Closed Cover Model

This document uses "closed cover" for an exclude-side proof stronger than simple exclude
reachability.

Working meanings:

- `exclude.reached(n)`: `n` is known to be reachable from the exclusion start. This is enough to
  exclude `n` itself from the result.
- `exclude.expanded(n)`: `n` has been read on the exclude side and its parents have been reflected
  into exclude traversal state.
- `exclude.closedCover(n)`: the exclude paths from the exclusion start down to `n` are closed
  enough that, if include traversal first intersects the exclude side at `n`, the include segment
  before `n` can be yielded as final result.

The exclusion start itself has a closed cover. A non-merge child with a closed cover can propagate
closed cover to its single parent. A merge opens the cover because multiple exclude branches may
later intersect include-side nodes before they reconverge.

The open question is how much reconvergence to recognize. A conservative first model may only
recognize simple reconvergence where every branch opened by a split reaches the same node and all
branches are accounted for. More complex criss-cross or nested reconvergence can initially fall
back rather than attempting an incomplete proof.

## Include-Side State

Include traversal still moves from child to parent, but phase close and result confirmation often
need propagation in the opposite direction. The prototype likely needs include-side reverse edges
for already-discovered include nodes.

Candidate include-side state:

```ts
interface IncludeState<NodeId extends PropertyKey> {
  reached: boolean;
  expanded: boolean;
  yielded: boolean;
  excluded: boolean;
  parents: Set<NodeId>;
  children: Set<NodeId>;
}
```

`children` lets the traversal move from an older include node back toward newer include descendants
when an exclude phase discovers an include node and the strategy needs to confirm or invalidate the
include segment above it.

The phrase "all descendants are confirmed" is too broad. If exclude reaches an include node `n`,
only the relevant not-yet-excluded include segment above `n` can be confirmed, and only when the
cover at `n` is closed. Propagation must stop at already excluded nodes and must not confirm nodes
that another exclude path has reached.

## Phase-Local Pending State

During an open exclude phase, include traversal is paused, but exclude traversal may encounter
include nodes that have already been discovered. Those include nodes cannot necessarily be yielded
or discarded immediately if the exclude cover is still open.

The current candidate rule is phase-local pending state:

- when an open exclude phase reaches an include node `A`, mark `A` and its include-side descendants
  with `pendingBy` for the current phase/source;
- if that phase later closes without another exclude path reaching those pending nodes, drain the
  still-unexcluded pending segment as yielded results;
- if another exclude path directly reaches a pending node `B`, `B` becomes a newer pending source
  and pending propagation below `B` is overwritten for that phase;
- the include path segment between the older pending source and the newer direct encounter is then
  no longer confirmed by the older pending source;
- pending state should not survive past the exclude phase that created it.

This is intentionally not yet a complete algorithm. The overwrite and propagation rules need more
formal treatment before implementation.

## Efficiency Interpretation

Exclude-side traversal being deep or long is not inherently inefficient. It is inefficient only
when the explored exclude area does not contribute to final result work, such as:

- confirming include nodes for yield;
- excluding include nodes that would otherwise remain candidates;
- creating closed-cover stop points that prevent older include reads;
- reducing fallback work through cached reads.

Therefore profiling should eventually measure not only read counts, but also whether an exclude
phase contributed to confirmation, exclusion, stopping, or fallback reuse.

## Priority Hint Decision

Do not read a commit only to discover the priority of that commit.

The frontier currently stores node IDs, and reading a Git commit is the expensive operation being
optimized. If the priority of an unread parent required reading that parent before enqueueing it,
the priority queue would add speculative reads and weaken the optimization.

Instead, use lazy propagated priority:

- when a read node discovers a parent ID, enqueue that parent ID with a priority derived from the
  already-read child node;
- when that parent is later read, use the parent node's own priority hint for the next generation
  of discovered parents;
- if the same node ID is discovered through multiple children, keep the highest propagated
  priority;
- use cached node metadata to refine priority only when the node has already been read for another
  reason.

For Git, the adapter can provide `committer.timestamp` as the priority hint. The generic DAG
strategy should not name this as a timestamp.

This means the priority of an unread frontier item represents "newness of the path that discovered
this node", not necessarily "newness of the node itself." That is acceptable because the value is
only an expansion-order hint.

## Suggested Interface Shape

Keep `walk-commits-strategy.ts` free of Git-specific concepts by exposing a generic priority hook
on the DAG node port:

```ts
export interface DagNodePort<NodeId extends PropertyKey, Node> {
  readNode(nodeId: NodeId, side: ReadSide): Promise<Node>;
  getParents(node: Node): readonly NodeId[];
  getPriorityHint?(node: Node): number;
}
```

The hook is optional so existing deterministic FIFO-like traversal can remain possible for generic
DAG tests or non-Git callers.

Use the term "frontier" rather than "queue" for the traversal data structure. A queue implies FIFO
semantics, while this abstraction is responsible for scheduling the next expansion candidate.

For a bidirectional strategy, prefer a scheduler interface that can carry include/exclude side:

```ts
interface FrontierItem<NodeId> {
  readonly nodeId: NodeId;
  readonly side: ReadSide;
}

interface DagFrontierScheduler<NodeId extends PropertyKey, Node> {
  pushInitial(nodeId: NodeId, side: ReadSide): void;

  pushDiscovered(parentId: NodeId, discoveredFrom: Node, side: ReadSide): void;

  pop(): FrontierItem<NodeId> | undefined;

  get size(): number;
}
```

Strategy code would read a node, get its parents from `context.nodes.getParents(node)`, then pass
each parent and the read child node to `pushDiscovered()`. The scheduler implementation decides
whether to behave as FIFO, timestamp-prioritized, first-parent-biased, or some future policy.

If the strategy only needs a single-side frontier, use `DagFrontier` as the shorter name. If the
frontier chooses both the node and whether the next expansion is include-side or exclude-side,
prefer `DagFrontierScheduler` or `FrontierScheduler`.

## Open Design Questions

- This section is intentionally open. The traversal is not ready for implementation until these
  questions are narrowed.
- What is the minimal correct definition of `exclude.closedCover`?
- Which reconvergence cases should the first prototype recognize, and which should immediately
  fall back?
- How should nested splits, criss-cross shapes, and multiple simultaneous open split groups be
  represented?
- What exact phase-close condition turns open exclude traversal back into closed traversal?
- During an open exclude phase, what is the precise overwrite rule when a pending include node is
  reached directly by another exclude path?
- When exclude reaches include state while closed, what exact reverse-include segment may be yielded
  immediately?
- What include reverse-edge state can be discarded after yield/exclusion without losing later proof
  ability?
- What fallback threshold or fallback trigger should exist if an open exclude phase does not close
  soon enough or expands into a large area with no include-side contribution?
- Should include and exclude use one shared scheduler or two schedulers with a separate side-choice
  policy?
- Should first-parent position be included in the priority score as a generic ordering hint, or kept
  as a Git-adapter concern?
- Should the prototype expose metrics for priority decisions, such as include/exclude pops or
  stale priority updates, or keep instrumentation limited to existing read/yield/fallback counters?
- How should the prototype be selected during experiments without changing the production default?

## Implementation Notes

- Add the prototype as an internal strategy first; do not replace the production default until
  profiles show a clear win on realistic repositories.
- Preserve the existing `DagNodePort` read cache behavior. Actual `readNode()` calls, not cache
  hits, are the expensive unit to compare.
- Keep result membership tests table-driven against `eagerExclude`.
- Add DAG fixtures that cover:
  - `exclude` is a merge commit;
  - include-side path opens to a root outside the exclude frontier;
  - parent and child timestamps run backward;
  - multiple children discover the same parent with different propagated priorities;
  - fallback removes buffered candidates correctly.
- Use existing profile details as the baseline evidence:
  - `strategy`;
  - `result`;
  - `fallback_reason`;
  - `include_reads`;
  - `exclude_reads`;
  - `cache_hits`;
  - `fallback_reads`;
  - `fallback_removed`;
  - `yielded`.
- Consider additional prototype-only metrics once the phase model is formalized:
  - `exclude_phases`;
  - `open_exclude_phases`;
  - `closed_cover_hits`;
  - `pending_confirmed`;
  - `pending_excluded`;
  - `phase_reads`;
  - `phase_reads_contributed`.

## Suggested Starting Prompt

```text
We are continuing gitlode walkCommits optimization design work. Read
packages/gitlode/docs/handoff/walk-commits-timestamp-frontier.md and continue the design discussion
without implementing the prototype yet.

Use commit timestamps only through a generic priority hint. Do not read commits only to calculate
priority; propagate the already-read child node's priority hint to unread parent IDs. Preserve
reachable(start)-reachable(exclude) correctness and keep fallback available. Focus on formalizing
exclude.closedCover, phase-close conditions, and phase-local pending propagation before coding.
```
