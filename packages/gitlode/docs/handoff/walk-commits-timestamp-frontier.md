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

`walkCommits` currently has two internal strategies in `src/git-impl/dag-traversal-strategy.ts`:

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

Status: discussion is still active. A temporary TypeScript sketch now exists at
`src/git-impl/explore-dag-strategy.ts`, but it is intentionally not wired into production
traversal. Use it as executable design notation, not as the accepted implementation.

Several correctness and state-management questions remain open, especially around include-side
pending/yield propagation and how much of the exclude-side sketch should survive into production.

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

## Exclude Phase Result

`exploreCertifiedClosurePhase` currently models two successful proof outcomes. The include side can
use both outcomes through the shared `certifiedNodes` field, but the exclude phase still returns
the reason it stopped.

Candidate result shape:

```ts
type CertifiedClosurePhaseResult<NodeId> =
  | {
      kind: "closed-boundary";
      certifiedNodes: ReadonlySet<NodeId>;
      closedBoundary: NodeId;
    }
  | {
      kind: "complete-exclude";
      certifiedNodes: ReadonlySet<NodeId>;
      rootTerminals: readonly NodeId[];
    };
```

Meanings:

- `closed-boundary`: the phase found a closed exclude boundary before reading all exclude
  ancestors. `certifiedNodes` are the closed-cover nodes up to that boundary.
- `complete-exclude`: the phase did not find a close boundary, but every frontier reached root and
  no further exclude-side traversal remains. `certifiedNodes` are the exclude-reachable nodes read
  by the phase, and `rootTerminals` records the terminal roots.

From include traversal's perspective, both variants provide exclude nodes that are safe to use for
stopping and confirmation. The `kind` is still useful for profiling, diagnostics, and future
strategy selection.

## Closed Cover Model

This document uses "closed cover" for an exclude-side proof stronger than simple exclude
reachability, but weaker than a full exclude-reachable collection.

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

The current sketch recognizes branch joins within a split using branch groups:

- each split creates branch states;
- branches that meet at the same node are joined into the same branch group;
- when all branches in a split belong to one branch group, the split can search its trigger nodes
  for a single close boundary;
- the close boundary is the trigger not dominated by another trigger when walking children back
  toward the split's `openedAt` node.

Nested split handling is modeled by recording which branch opened each split. A frontier item only
needs to know its immediate branch. If a child split closes first, its `closeBoundary` is handed back
to the branch that opened it. If the parent split closes first, child splits beyond that boundary
are treated as overshoot rather than parent obligations.

This avoids deciding at split-open time whether a later split is truly nested or merely an
overshoot artifact. That distinction is made after a boundary is known.

## Integrated Traversal Loop

The latest sketch moves away from "run one exclude phase, then run include traversal" as the
whole algorithm. A `closed-boundary` result is not the end of exclude traversal; it is a reusable
certification result plus an exclude continuation point.

The expected outer shape is now an integrated loop with side-tagged frontier items:

```ts
type IntegratedFrontierItem<NodeId> =
  { side: "include"; nodeId: NodeId } | { side: "exclude"; nodeId: NodeId };
```

Include-side expansion still reads one node and enqueues its parents. Exclude-side expansion runs
one `exploreCertifiedClosurePhase(start)`:

- add `result.certifiedNodes` to a global certified-exclude set;
- resolve any include visited nodes that are now certified hits;
- if `result.kind === "closed-boundary"`, enqueue `result.closedBoundary` as the next exclude
  frontier item;
- if `result.kind === "complete-exclude"`, that exclude path has no continuation.

This keeps `exploreCertifiedClosurePhase` independent from include state. It does not receive
include visited nodes and does not emit "exclude reached include" events during the phase.
Instead, the outer loop discovers that fact only after a phase completes by computing:

```text
certifiedNodes ∩ includeVisited
```

This removes the need for long-lived or phase-local pending state for "open exclude reached
include". Include traversal consumes only certified exclude nodes.

## Include-Side State

Include traversal still moves from child to parent, but phase close and result confirmation often
need propagation in the opposite direction. The prototype likely needs include-side reverse edges
for already-discovered include nodes.

The current working model treats include state as only the unresolved visited graph. A node that is
confirmed as a result is yielded immediately and removed from include visited state. A node that is
confirmed as excluded is also removed. Therefore `yielded` and `excluded` do not need to be durable
include-side state fields.

Candidate include-side state:

```ts
interface IncludeVisitedState<NodeId extends PropertyKey, Node> {
  nodeId: NodeId;
  node?: Node;
  expanded: boolean;
  parents: Set<NodeId>;
  children: Set<NodeId>;
}
```

`children` lets the traversal move from an older include node back toward newer include descendants
when a completed exclude phase certifies an include hit and the strategy needs to resolve the
already-discovered include segment above it.

Deletion is part of the state transition:

- yield-confirmed node: yield the node, then delete it from `includeVisited`;
- exclude-confirmed node: delete it from `includeVisited`;
- stale include frontier items are skipped when their node is no longer present.

Deleting a node should also detach its parent/child references, or perform equivalent lazy cleanup,
so future child-direction resolution does not depend on confirmed nodes.

Current cleanup decision:

- `includeVisited` is the unresolved include node set; yielded or excluded nodes must be removed
  eagerly.
- include graph edges in `parents` / `children` are eagerly detached by `deleteIncludeVisited()`;
  leaving stale edge references would make visited-subgraph reachability ambiguous.
- include frontier or scheduler entries are lazily pruned; a popped include item whose node no
  longer exists in `includeVisited` is skipped.
- read caches may retain yielded or excluded nodes because caches do not define unresolved
  membership.

## Certified Include Hit Resolution

When an exclude phase completes, the outer loop finds:

```text
H = certifiedNodes ∩ includeVisited
```

`H` is the certified include hit set for that phase.

Rules currently accepted:

- every node in `H` is excluded;
- include parent-direction frontier from nodes in `H` can be pruned;
- child-direction propagation starts from the children of nodes in `H`;
- propagation must consider only the current phase's hit set as a simultaneous boundary set;
- previously resolved nodes should already have been removed from `includeVisited`.

For a single hit `A`, already-discovered include children of `A` can be yielded, because the
certified cover proves that the unexplored exclude continuation beyond the close boundary cannot
later merge into `A` or its include-side descendants.

For multiple hits, child-direction propagation cannot immediately yield every visited descendant of
each hit. If a path from hit `A` reaches another hit `B`, then the nodes on that path are excluded:
`B` is exclude-reachable, and its ancestors along the include path are also exclude-reachable.

The current sample now uses a generic `reachable(start, port)` helper instead of enumerating each
candidate path. The helper is independent from Git or include/exclude semantics:

```ts
interface DagNodePort<NodeId extends PropertyKey, Node> {
  readNode(nodeId: NodeId): Promise<Node>;
  getSuccessors(node: Node): readonly NodeId[];
}
```

The traversal direction is supplied by the port:

- Git parent-direction traversal passes commit parents as successors;
- include child-direction traversal passes `IncludeVisitedState.children` as successors;
- include parent-direction traversal passes `IncludeVisitedState.parents` as successors.

Certified hit resolution is then expressed as set operations over the visited include subgraph:

```text
newerSide = reachable(H, includeChildrenPort)
olderSide = reachable(H, includeParentsPort)
excluded = olderSide
yieldable = newerSide - excluded - H
```

`excluded` contains the simultaneous hit set and all visited include nodes on the parent side of a
hit. This matches the rule that include frontier older than a certified hit can be pruned.
`yieldable` contains the visited include nodes that are on the newer side of a certified hit but
are not on the parent side of any hit in the same phase. Only after these sets are computed should
the strategy delete excluded nodes and yield/delete yieldable nodes.

This avoids speculative `yielded = true` state and rollback.

Current sample tests live in `test/git-impl/explore-dag-strategy.test.ts`. They focus on the
certified hit resolution step, independent from Git object reads and independent from
`CertifiedClosurePhase`:

- a single certified hit yields the already-visited newer side;
- two certified hits on one include path exclude the path segment between them;
- sibling certified-hit regions can independently yield their newer-side visited nodes.
- parent-side visited nodes of a certified hit are pruned before final draining;
- include merge sides that are ancestors of another certified hit are excluded;
- descendants of an excluded path can still yield when they are not ancestors of a hit.
- a stale include frontier item produced by ordinary DAG traversal and pointing at a deleted
  include node is lazily skipped without reading or yielding.

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

Keep `dag-traversal-strategy.ts` free of Git-specific concepts by exposing a generic priority hook
on the DAG node port:

```ts
export interface DagNodePort<NodeId extends PropertyKey, Node> {
  readNode(nodeId: NodeId): Promise<Node>;
  getSuccessors(node: Node): readonly NodeId[];
}
```

The hook is optional so existing deterministic FIFO-like traversal can remain possible for generic
DAG tests or non-Git callers. `getSuccessors` deliberately avoids Git-specific direction names:
when walking Git history toward older commits, the adapter supplies commit parents as successors.
When walking an in-memory visited subgraph in another direction, the port supplies that direction's
edges as successors.

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

Strategy code would read a node, get its next IDs from `context.nodes.getSuccessors(node)`, then
pass each successor and the read node to `pushDiscovered()`. The scheduler implementation decides
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
- Is the current `newerSide / olderSide` set formulation sufficient for every certified hit shape,
  or are there DAG shapes where it needs a narrower visited-subgraph boundary?
- What is the exact stale-frontier pruning rule after deleting yield-confirmed or exclude-confirmed
  include nodes?
- Which include visited graph edges can be discarded eagerly without losing later certified-hit
  resolution ability?
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
closed cover, phase-close conditions, and certified include hit resolution before productionizing
the prototype.
```
