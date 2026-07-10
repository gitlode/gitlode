# DAG Traversal Abstraction Refactoring Plan

## 1. Purpose

Refactor the generic DAG traversal abstraction so that the traversal core depends on graph topology rather than domain node objects.

The current traversal logic is conceptually solving two related DAG operations:

- `reachable(start)`
- `reachable(start) - reachable(exclude)`

The traversal algorithm only needs stable node identity and successor topology. Domain node objects are caller-side payloads and should not be part of the traversal core.

This refactoring also introduces the foundation for future priority-based frontier scheduling, without implementing a concrete PriorityQueue policy in the traversal core.

Primary goals:

- Make DAG correctness explicitly `NodeId`-based.
- Remove `Node` from the traversal core type parameters.
- Return `NodeId` from traversal APIs.
- Represent scheduling metadata through `DagFrontierItem`.
- Allow caller/domain-derived priority hints through `DomainHint`.
- Keep frontier/queue responsibility limited to scheduling.
- Keep caching outside the DAG traversal core, while providing an opt-in helper.

---

## 1.1 Stage 1 Planning Workflow

This document is the primary Stage 1 artifact. Stage 1 should revise this handoff plan until the
Stage 2 implementation can proceed mostly mechanically. Source code must not be changed during
Stage 1.

Stage 1 uses the following decision workflow:

1. Review and decide one design point at a time.
2. Prefer asking for an explicit maintainer decision when a point affects public behavior, module
   boundaries, migration order, or long-term design contracts.
3. Record accepted decisions in this document before moving to dependent design points.
4. Keep durable design documents as descriptions of the current implementation during Stage 1.
5. Record required durable documentation updates in this plan, then apply those documentation
   updates during Stage 2 alongside the corresponding implementation changes.

Stage 1 is divided into these sub-stages:

- **Stage 1-A: Scope and artifacts.** Confirm the refactoring scope and the documents that Stage 2
  must update.
- **Stage 1-B: External contracts and module boundaries.** Confirm the invariant output contract,
  adapter-facing contracts, and where `NodeId -> Node` resolution belongs.
- **Stage 1-C: Shared DAG abstraction.** Finalize `DagTopologyPort`, frontier items, scheduling
  context, domain hints, and cache helper responsibilities.
- **Stage 1-D: `dag-traversal-strategy.ts` migration.** Detail the eager-exclude and certified-lazy
  NodeId-based migration.
- **Stage 1-E: `explore-dag-strategy.ts` migration.** Bring the prototype traversal file into the
  same topology-based abstraction plan.
- **Stage 1-F: Telemetry/profiling migration.** Treat telemetry as a developer diagnostic, not as a
  stable output contract, while preserving useful performance observability.
- **Stage 1-G: Tests, docs, and implementation staging.** Convert decisions into a Stage 2 checklist
  covering implementation order, tests, and durable documentation updates.

### Accepted Stage 1-A documentation policy

Stage 1 updates this handoff plan directly. Durable design documents should not be rewritten to
describe future-state behavior before implementation. Instead, this plan must carry a concrete
checklist of durable documentation updates for Stage 2.

Rationale:

- It keeps durable design documents aligned with the currently implemented behavior until the code
  changes land.
- It avoids repeated durable documentation churn while Stage 1 decisions are still being made.
- It still prevents documentation-update omissions by making Stage 2 documentation work explicit.

---

## 2. Current Problems

The current abstraction uses both `NodeId` and `Node`:

```ts
export interface DagNodePort<NodeId extends PropertyKey, Node> {
  readNode(nodeId: NodeId): Promise<Node>;
  getSuccessors(node: Node): readonly NodeId[];
}
```

This makes `Node` serve multiple roles:

1. Backend/domain object read by ID.
2. Input needed to obtain successors.
3. Value yielded by traversal APIs.

However, DAG traversal correctness does not require domain `Node` objects. It requires only stable identity and topology:

```text
NodeId -> successors: NodeId[]
```

Additional current issues:

- `walkDag...` APIs yield `Node`, even though the result set is logically a set of `NodeId`.
- `certifiedLazy` mixes traversal state, domain node cache, and successor cache.
- Queue/frontier currently stores bare `NodeId`, leaving no place for priority hints or traversal scheduling context.
- Telemetry is oriented around `read_node.include` / `read_node.exclude`, which assumes the DAG core reads domain nodes.

---

## 3. Design Principles

1. **Correctness is `NodeId`-based.**
   - `visited`, `excluded`, `states`, `resultCandidates`, and other correctness state must be keyed by `NodeId`.

2. **`Node` resolution belongs outside the DAG core.**
   - The caller or topology adapter may resolve `NodeId -> Node`.
   - The traversal core must not know the domain `Node` type.

3. **Hints affect scheduling only, never correctness.**
   - `DomainHint` and `DagSchedulingContext` may affect traversal order and performance.
   - They must not change the result set.

4. **The frontier is scheduling-only.**
   - It stores and orders `DagFrontierItem` values.
   - It does not deduplicate by `nodeId`.
   - It does not decide whether an item should be processed.

5. **The traversal loop validates dequeued items.**
   - The loop must assume stale or duplicate items can be dequeued.
   - It must check traversal state after dequeue.

6. **The DAG core does not cache domain nodes or successors.**
   - It does not know whether `getSuccessors` is expensive.
   - Caching is an opt-in caller-side adapter concern.

7. **Telemetry observes traversal events.**
   - Telemetry should describe DAG traversal behavior.
   - Domain read/cache telemetry belongs to caller-side adapters.

---

## 4. Final Design Decisions

- Use `NodeId extends PropertyKey`.
- Remove the `Node` type parameter from the traversal core.
- Replace `DagNodePort<NodeId, Node>` with `DagTopologyPort<NodeId, DomainHint>`.
- Use `DomainHint = undefined` as the default type parameter.
- Make `domainHint` an optional property.
- Use the same `DomainHint` type on both `DagSuccessor` and `DagFrontierItem`.
- Use `role`, not `side`, in `DagSchedulingContext`.
- Initial traversal roles are `"include" | "exclude"`.
- Do not include explicit block/index metadata in `DagSchedulingContext`.
- Preserve successor block semantics operationally through `enqueueMany`.
- Keep `collectReachableNodeIds` as a public API.
- Do not preserve Node-yielding API compatibility.
- Use one `createFrontier` factory per strategy options object.
- Do not introduce phase-specific frontier factories yet.
- Do not cache successors inside the DAG core.
- Do not provide a generic successor-cache helper in Stage 2; use adapter-specific caches when a concrete caller needs them.

---

## 5. New Type Model

```ts
export type DagTraversalRole = "include" | "exclude";

export interface DagSchedulingContext {
  readonly role: DagTraversalRole;
  readonly depth: number;
  readonly discoveredOrder: number;
}

export interface DagSuccessor<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly nodeId: NodeId;
  readonly domainHint?: DomainHint;
}

export interface DagFrontierItem<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly nodeId: NodeId;
  readonly scheduling: DagSchedulingContext;
  readonly domainHint?: DomainHint;
}

export interface DagTopologyPort<NodeId extends PropertyKey, DomainHint = undefined> {
  getSuccessors(nodeId: NodeId): Promise<readonly DagSuccessor<NodeId, DomainHint>[]>;
}

export interface DagFrontier<T> {
  isEmpty(): boolean;
  enqueue(...items: T[]): void;
  enqueueMany(items: Iterable<T>): void;
  dequeueOrThrow(): T;
}
```

### Notes

- `NodeId` is constrained to `PropertyKey` because traversal correctness depends on stable primitive identity keys.
- Object identity is intentionally not supported as a `NodeId` abstraction.
- If a domain uses compound identity, normalize it into a stable primitive key, such as a string, number, symbol, or branded string.
- `DomainHint` defaults to `undefined`, which makes hint usage explicit and opt-in.
- `domainHint` is optional because start items and many successor items may not have domain-derived priority data.

---

## 6. Public API Shape

The primary public APIs should return `NodeId`, not `Node`.

```ts
export interface WalkDagContext<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly graph: DagTopologyPort<NodeId, DomainHint>;
  readonly instrumentation: Instrumentation;
}

export type WalkDagStrategy = "eagerExclude" | "certifiedLazy";

export interface WalkDagStrategyOptions<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly createFrontier?: () => DagFrontier<DagFrontierItem<NodeId, DomainHint>>;
}

export interface WalkDagConfiguredStrategyOptions<
  NodeId extends PropertyKey,
  DomainHint = undefined,
> {
  readonly strategy?: WalkDagStrategy;
  readonly eagerExclude?: WalkDagStrategyOptions<NodeId, DomainHint>;
  readonly certifiedLazy?: WalkDagStrategyOptions<NodeId, DomainHint>;
}
```

```ts
export function collectReachableNodeIds<NodeId extends PropertyKey, DomainHint = undefined>(
  startNodeIds: Iterable<NodeId>,
  graph: DagTopologyPort<NodeId, DomainHint>,
  options?: WalkDagStrategyOptions<NodeId, DomainHint>,
): Promise<Set<NodeId>>;

export function walkDagNodeIdsWithConfiguredStrategy<
  NodeId extends PropertyKey,
  DomainHint = undefined,
>(
  context: WalkDagContext<NodeId, DomainHint>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
  options?: WalkDagConfiguredStrategyOptions<NodeId, DomainHint>,
): AsyncIterable<NodeId>;

export function walkDagNodeIdsEagerExclude<NodeId extends PropertyKey, DomainHint = undefined>(
  context: WalkDagContext<NodeId, DomainHint>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
  options?: WalkDagStrategyOptions<NodeId, DomainHint>,
): AsyncIterable<NodeId>;

export function walkDagNodeIdsCertifiedLazy<NodeId extends PropertyKey, DomainHint = undefined>(
  context: WalkDagContext<NodeId, DomainHint>,
  nodeId: NodeId,
  excludeNodeId?: NodeId,
  options?: WalkDagStrategyOptions<NodeId, DomainHint>,
): AsyncIterable<NodeId>;
```

### Compatibility

No Node-yielding compatibility wrapper is required inside the generic DAG traversal module. The DAG
core APIs should be NodeId-yielding only.

Call sites must resolve `NodeId` to domain `Node` outside the DAG core if they need domain objects:

```ts
for await (const nodeId of walkDagNodeIdsWithConfiguredStrategy(
  { graph, instrumentation },
  startNodeId,
  excludeNodeId,
  options,
)) {
  const node = await nodeReader.readNode(nodeId);
  // caller-specific processing
}
```

### Accepted Stage 1-B Git Adapter Contract

The Git adapter must continue to yield commit objects to the rest of gitlode. Code outside the Git
adapter cannot resolve commit OIDs into commit objects, so exposing `NodeId` values beyond the
adapter boundary would move Git-object responsibility to the wrong layer.

The adapter integration should therefore use this shape:

1. The Git adapter builds a topology adapter for the DAG core.
2. That topology adapter reads commit objects by OID as needed to answer `getSuccessors(nodeId)`.
3. The DAG core yields commit OIDs (`NodeId`).
4. The Git adapter resolves each yielded OID back to the corresponding commit object and yields that
   commit object through the existing adapter-facing traversal contract.

The topology adapter should own an invocation-scoped commit-object cache. The cache lets
`getSuccessors(nodeId)` reuse a commit object when resolving parent OIDs, and lets the adapter reuse
the same commit object when the DAG core later yields that OID. This cache is outside the DAG core
and therefore does not weaken the rule that traversal correctness and traversal state are
NodeId-based.

### Accepted Stage 1-B Git Adapter Internal Shape

Use an explicit Git-adapter-internal helper object or class for topology expansion and commit-object
resolution. The helper should be private to the adapter implementation unless later reuse makes an
exported test seam necessary.

The helper should have this responsibility shape:

```ts
class CommitTopologyAdapter implements DagTopologyPort<CommitOid> {
  async getSuccessors(oid: CommitOid): Promise<readonly DagSuccessor<CommitOid>[]>;
  async readCommit(oid: CommitOid): Promise<RawCommit>;
}
```

Implementation rules:

- `getSuccessors(oid)` reads the commit through `readCommit(oid)` and projects parent OIDs into
  `DagSuccessor` items.
- `readCommit(oid)` owns the invocation-scoped `CommitOid -> RawCommit` cache.
- The Git adapter passes the helper itself to the DAG core as `DagTopologyPort<CommitOid>`.
- The Git adapter also uses the same helper's `readCommit(oid)` when turning DAG-core-yielded OIDs
  into commit objects for the existing adapter-facing traversal contract.
- Backend-specific read errors should still be translated inside the Git adapter boundary before
  crossing into the DAG traversal core or the rest of gitlode.
- The helper should not make commit-object cache contents part of DAG correctness; the cache is only
  a performance optimization and read-sharing mechanism.

### Accepted Stage 1-B Error Handling Policy

`CommitTopologyAdapter.readCommit(oid)` should translate backend-specific commit read errors into
`GitAdapterError` before throwing. `getSuccessors(oid)` and final commit-object yielding should both
call this same `readCommit(oid)` method, so missing-commit and unexpected-read errors have consistent
behavior regardless of whether the read happens during topology expansion or during final
`NodeId -> RawCommit` resolution.

Stage 2 should preserve the current error mapping shape:

- isomorphic-git `NotFoundError` becomes `GitAdapterError` with code `"COMMIT_NOT_FOUND"`.
- Other unexpected commit-read failures become `GitAdapterError` with code `"UNKNOWN"`.

This keeps backend-specific error details inside the Git adapter boundary and prevents raw backend
errors from crossing through the generic DAG traversal core.

Rationale:

- A local closure-based cache would work, but it makes the shared cache contract less visible.
- A separate reader/topology interface split is clean, but it would broaden Stage 2 into a larger
  Git adapter architecture refactor.
- A small explicit helper object keeps the Stage 2 implementation focused while making cache sharing,
  error mapping, and future tests easier to reason about.

---

## 7. Queue / Frontier Policy

The frontier is a scheduling component, not a correctness component.

### Responsibilities

The frontier is responsible for:

- Holding `DagFrontierItem` values.
- Applying its own scheduling or ordering policy.
- Returning the next candidate item.

The frontier is not responsible for:

- Deduplicating by `nodeId`.
- Deciding whether an item should be processed.
- Tracking visited/excluded state.
- Dynamically reprioritizing already-enqueued items.
- Proving traversal correctness.

The traversal loop must validate every dequeued item against DAG state.

### Default Frontier

```ts
export function createDefaultDagFrontier<
  NodeId extends PropertyKey,
  DomainHint = undefined,
>(): DagFrontier<DagFrontierItem<NodeId, DomainHint>> {
  return new OrderedQueue<DagFrontierItem<NodeId, DomainHint>>({
    dequeueOrder: "fifo",
    blockOrder: "preserve",
  });
}
```

The default frontier:

- Uses FIFO dequeue order.
- Preserves block order.
- Treats `DagFrontierItem` as opaque.
- Does not inspect `scheduling` or `domainHint`.

### Successor Blocks

Successors discovered from the same expanded node must be enqueued as one block:

```ts
frontier.enqueueMany(successorItems);
```

Do not add explicit `indexInBlock` or `discoveryBlockOrder` to `DagSchedulingContext` at this stage.

Sibling order and block grouping are represented operationally through `enqueueMany` and the `DagFrontier` implementation.

---

## 8. Frontier Item Factory

Centralize `DagFrontierItem` creation in a private helper to avoid inconsistent scheduling metadata generation.

```ts
function createDagFrontierItemFactory() {
  let discoveredOrder = 0;

  const createStartItem = <NodeId extends PropertyKey, DomainHint = undefined>(
    nodeId: NodeId,
    role: DagTraversalRole,
  ): DagFrontierItem<NodeId, DomainHint> => {
    return createFrontierItem(nodeId, {
      role,
      depth: 0,
      discoveredOrder: discoveredOrder++,
    });
  };

  const createStartItems = <NodeId extends PropertyKey, DomainHint = undefined>(
    nodeIds: Iterable<NodeId>,
    role: DagTraversalRole,
  ): DagFrontierItem<NodeId, DomainHint>[] => {
    return Array.from(nodeIds, (nodeId) => createStartItem<NodeId, DomainHint>(nodeId, role));
  };

  const createSuccessorItems = <NodeId extends PropertyKey, DomainHint = undefined>(
    parent: DagFrontierItem<NodeId, DomainHint>,
    successors: readonly DagSuccessor<NodeId, DomainHint>[],
  ): DagFrontierItem<NodeId, DomainHint>[] => {
    const items: DagFrontierItem<NodeId, DomainHint>[] = [];

    for (const successor of successors) {
      items.push(
        createFrontierItem(
          successor.nodeId,
          {
            role: parent.scheduling.role,
            depth: parent.scheduling.depth + 1,
            discoveredOrder: discoveredOrder++,
          },
          successor.domainHint,
        ),
      );
    }

    return items;
  };

  return {
    createStartItem,
    createStartItems,
    createSuccessorItems,
  };
}

function createFrontierItem<NodeId extends PropertyKey, DomainHint = undefined>(
  nodeId: NodeId,
  scheduling: DagSchedulingContext,
  domainHint?: DomainHint,
): DagFrontierItem<NodeId, DomainHint> {
  return {
    nodeId,
    scheduling,
    ...(domainHint === undefined ? {} : { domainHint }),
  };
}
```

### Rules

- Start items use `depth = 0`.
- Successor items use `parent.depth + 1`.
- Successor items inherit `parent.scheduling.role`.
- `discoveredOrder` is monotonic within a single frontier/traversal phase.
- Independent traversal phases may have independent `discoveredOrder` sequences.
- `DomainHint` is copied from `DagSuccessor` to `DagFrontierItem` as-is.
- `undefined` `domainHint` should preferably be omitted as an object field.

### Accepted Stage 1-C DomainHint Policy

Stage 2 should introduce the `DomainHint` seam, but the initial Git adapter integration should not
supply Git-specific hints. `CommitTopologyAdapter.getSuccessors(oid)` should return successors
without a `domainHint` field, so Git traversal uses `DomainHint = undefined` at first.

Rationale:

- Stage 2 should prioritize moving DAG correctness from domain `Node` objects to `NodeId` topology.
- No concrete priority frontier policy is being implemented in this refactor.
- Supplying production hints before a consumer exists could imply ordering semantics that are not part
  of gitlode's stable behavior contract.
- Keeping hints absent initially makes the Git adapter integration smaller while preserving the future
  scheduling seam.

Future scheduling work may add a Git-specific hint type when a concrete frontier policy needs it. A
likely first candidate is parent-order metadata such as:

```ts
interface GitCommitDomainHint {
  readonly parentIndex: number;
}
```

`parentIndex` would be scheduling-only metadata. It must not change the reachable commit set, and it
must not turn commit traversal order into a user-visible contract.

---

## 9. Strategy Behavior

### `collectReachableNodeIds`

`collectReachableNodeIds` is a public API.

It computes:

```text
reachable(start)
```

It should use the same `DagTopologyPort`, `DagFrontierItem`, and frontier abstraction as subtraction traversal.

Public `collectReachableNodeIds` should use role `"include"`.

Use a private role-aware helper internally:

```ts
async function collectReachableNodeIdsWithRole<NodeId extends PropertyKey, DomainHint = undefined>(
  startNodeIds: Iterable<NodeId>,
  graph: DagTopologyPort<NodeId, DomainHint>,
  role: DagTraversalRole,
  options: WalkDagStrategyOptions<NodeId, DomainHint>,
): Promise<Set<NodeId>>;
```

Strategy internals may call this helper with role `"exclude"`.

### `walkDagNodeIdsEagerExclude`

`eagerExclude` computes:

```text
reachable(start) - reachable(exclude)
```

Behavior:

1. If `excludeNodeId` is provided, collect reachable exclude IDs using role `"exclude"`.
2. Traverse from the include start node using role `"include"`.
3. Skip items whose `nodeId` is already visited or excluded.
4. Yield `NodeId` values.
5. Use `enqueueMany` for successor expansion.

### `walkDagNodeIdsCertifiedLazy`

`certifiedLazy` remains a NodeId-based optimization strategy.

State should be NodeId-only:

```ts
interface CertifiedLazyNodeState {
  fromInclude: boolean;
  fromExclude: boolean;
}
```

Use:

```ts
const states = new Map<NodeId, CertifiedLazyNodeState>();
const resultCandidates = new Set<NodeId>();
const stopPoints = new Set<NodeId>();
const includeExpanded = new Set<NodeId>();
```

Remove from the strategy state:

- `node: Node`
- `read: true | false`
- cached successors

Fallback behavior:

- If certificate validation fails, call `collectReachableNodeIdsWithRole(..., "exclude", ...)`.
- Remove excluded IDs from `resultCandidates`.
- Yield remaining `NodeId` values.

If repeated successor projection becomes expensive, address it in the concrete caller adapter first. Stage 2 should not add a generic successor-cache helper before there is a measured need or a second domain use case.

---

## 10. Caching Policy

The DAG traversal core must not cache domain nodes or successors.

Rationale:

- The core cannot know whether `getSuccessors` is expensive.
- The graph may already be memory-resident.
- A cache may only add memory overhead.
- Performance policy belongs to the caller-side topology adapter.

### Accepted Stage 1-C Cache Helper Policy

Do not implement `withSuccessorCache` or a `dag-topology-cache.ts` helper in Stage 2. The generic
successor-cache helper idea is withdrawn for the initial refactor.

Rationale:

- The only concrete production caller in scope is currently the isomorphic-git adapter.
- That adapter needs to reuse commit objects both while projecting successors and while converting
  DAG-core-yielded OIDs back into commit objects.
- A generic `NodeId -> DagSuccessor[]` cache only covers the traversal-expansion side and does not
  address the adapter's `NodeId -> Node` resolution requirement.
- Keeping an unused generic cache helper would add implementation and testing work without a concrete
  Stage 2 consumer.

Git adapter integration should rely on the `CommitTopologyAdapter` invocation-scoped
`CommitOid -> RawCommit` cache. That cache is adapter-specific, outside the DAG core, and should
serve both topology expansion and final commit-object yielding.

If repeated successor projection later becomes a measured performance problem, first consider adding
that cache inside the concrete adapter that needs it. If multiple domains need the same pattern,
future work may introduce a generic cached topology adapter that combines `NodeId -> Node` reading,
invocation-scoped node caching, topology projection, and caller-side final node resolution. Do not
add that abstraction until there is a concrete measured need or another non-Git use case.

### Topology Stability Contract

`DagTopologyPort.getSuccessors(nodeId)` must be semantically stable for the same `NodeId` during one traversal invocation.

It may be expensive, but it should not return different topology for the same `NodeId` within a traversal invocation.

---

## 11. Telemetry Policy

Do not preserve the old node-read-oriented telemetry model in Stage 2. Also do not redesign DAG
traversal telemetry as part of this refactor.

The traversal logic has moved from Git-commit-specific behavior toward a generic `NodeId` / topology
model. The existing telemetry was introduced for an earlier design and no longer reflects the new
responsibility split cleanly. Redesigning telemetry at the same time as the DAG abstraction migration
would make Stage 2 too large, so Stage 2 should temporarily shrink traversal telemetry and leave a
full telemetry redesign for a separate session.

Remove node-read-specific spans and counters such as:

```text
dag.traversal.read_node.include
dag.traversal.read_node.exclude
include_reads
exclude_reads
cache_hits
fallback_reads
```

Stage 2 should keep only minimal outer operation telemetry, centered on the adapter-level
`git.walk_commits` span and any existing top-level elapsed-time/reporting behavior needed by the
profiling output. Do not add new DAG traversal child spans, frontier counters, commit-read/cache
metrics, or per-node attributes in Stage 2.

The follow-up telemetry redesign should decide the post-refactor diagnostic model from scratch, with
the new boundaries in mind:

- generic DAG traversal events;
- Git adapter commit-read/cache diagnostics;
- certified/fallback strategy diagnostics;
- profiling output fields and summaries;
- tests that intentionally cover the redesigned diagnostics.

Until that redesign happens, telemetry must not be treated as a stable contract. The stable behavior
for this refactor remains the emitted commit object set, not traversal order or telemetry details.

---

## 12. Migration Plan

This migration is gitlode-scoped, not limited to `dag-traversal-strategy.ts`. It must cover:

- `packages/gitlode/src/git-impl/dag-traversal-strategy.ts` as the production DAG traversal core.
- `packages/gitlode/src/git-impl/explore-dag-strategy.ts` as a prototype traversal implementation
  with the same difference-set contract.
- Git adapter call sites that currently consume Node-yielding traversal APIs and must keep
  yielding commit objects to the rest of gitlode.
- Tests that assert traversal correctness, queue behavior, read behavior, or telemetry behavior.
- Durable documentation that describes traversal internals, user-visible traversal behavior, and
  adapter boundaries.

### Accepted Stage 1-E Explore Strategy Migration Policy

`packages/gitlode/src/git-impl/explore-dag-strategy.ts` is not wired into production traversal today,
but it is not deprecated code. It is a prototype strategy that may provide important future value to
gitlode, so Stage 2 should apply the DAG abstraction improvements to it instead of leaving a legacy
`DagNodePort` island behind.

Stage 2 should migrate `explore-dag-strategy.ts` to the same `NodeId` / `DagTopologyPort` model as
the production DAG traversal core:

- Remove dependencies on `DagNodePort` and Node-yielding DAG traversal APIs.
- Make `walkDagPhaseCertifiedDifference()` yield `NodeId` values.
- Replace `collectReachableNodes()` usage with `collectReachableNodeIds()`.
- Convert include-graph `predecessorsPort()` / `successorsPort()` adapters to `DagTopologyPort`.
- Remove domain `Node` caches from traversal state.
- Keep local graph links used for certified-hit classification as algorithmic state.

Stage 2 should not over-optimize or fully redesign the prototype algorithm. Leave these concerns for
follow-up work focused on `explore-dag-strategy.ts` itself:

- Do not force closure-phase `branchId` and related phase-local metadata into shared
  `DagFrontierItem` or `DomainHint`.
- Do not require every prototype frontier item to use the production frontier abstraction.
- Do not rewrite the certified-closure algorithm beyond what is needed to remove the old
  `Node`-based traversal abstraction.

High-level implementation sequence:

1. Introduce the new topology/frontier types.
2. Replace `DagNodePort<NodeId, Node>` with `DagTopologyPort<NodeId, DomainHint>`.
3. Rename traversal APIs to make `NodeId` output explicit.
4. Refactor `collectReachableNodeIds` to use `DagTopologyPort` and `DagFrontierItem`.
5. Refactor `eagerExclude` to yield `NodeId`.
6. Refactor `certifiedLazy` to use NodeId-only state and no cache state.
7. Shrink traversal telemetry by removing old node-read-oriented spans/counters without adding a new DAG telemetry model.
8. Add a Git-adapter-internal commit topology helper object/class that implements
   `DagTopologyPort<CommitOid>`, owns the invocation-scoped commit-object cache, and exposes
   `readCommit(oid)` for final commit-object yielding.
9. Update Git adapter call sites so they consume DAG-core `NodeId` output internally, resolve
   commit objects through the topology helper, and continue yielding commit objects to the rest of
   gitlode.
10. Update tests from Node-based assertions to NodeId-based assertions.
11. Refactor `explore-dag-strategy.ts` onto the same topology-based abstraction, preserving its
    prototype status, difference-set contract, and phase-local algorithm state.
12. Update Git adapter integration so the DAG core yields `NodeId`, the adapter resolves those OIDs
    through the topology helper's invocation-scoped commit-object cache, and gitlode still emits the
    same commit object set.
13. Update tests from Node-based assertions to NodeId-based assertions where they target the DAG
    core, and keep adapter-level tests focused on commit object output sets.
14. Update durable documentation according to the checklist below.
15. Remove obsolete types, read-node helpers, generic cache-helper tasks, and old telemetry names.

### Stage 2 Durable Documentation Checklist

Update these durable documents during Stage 2 alongside the implementation changes:

- `packages/gitlode/docs/design/commit-traversal-internals.md`
  - Replace the `DagNodePort<NodeId, Node>` seam with the new topology-based seam.
  - Explain that the DAG core yields `NodeId`, while the Git adapter continues to yield commit
    objects to the rest of gitlode by resolving OIDs through an adapter-internal topology helper.
  - Update queue/frontier policy from `WorkQueue<NodeId>` to `DagFrontier<DagFrontierItem<...>>`.
  - Update certified-lazy cache and fallback descriptions to match the topology-based design and adapter-owned cache policy.
  - Update telemetry descriptions to state that old node-read metrics are removed in Stage 2 and detailed telemetry will be redesigned separately.

- `packages/gitlode/docs/design/git-traversal.md`
  - Preserve the user-visible contract that gitlode emits the same commit object set for full and
    differential traversal.
  - Avoid presenting traversal order as a stable contract. Representative examples may remain, but
    they must not imply that frontier scheduling order is user-visible API.

- `packages/gitlode/docs/design/architecture.md`
  - Update adapter-boundary text if the implementation introduces an explicit topology adapter or
    node-reader separation inside the Git adapter layer.

- `packages/gitlode/docs/profiling.md`
  - Remove references to old DAG node-read spans and read/cache counters.
  - Document that detailed traversal telemetry is temporarily reduced in Stage 2 and is expected to be
    redesigned in a later telemetry-focused session.

---

## 13. Testing Plan

### Correctness Tests

- `collectReachableNodeIds` returns `reachable(start)` as `Set<NodeId>`.
- Multiple starts are supported.
- Diamond graphs are deduplicated correctly.
- `walkDagNodeIdsEagerExclude` returns `reachable(start) - reachable(exclude)`.
- `walkDagNodeIdsEagerExclude(start, undefined)` equals `collectReachableNodeIds([start])`.
- `walkDagNodeIdsCertifiedLazy` returns the same result set as `eagerExclude` for relevant fixtures.
- `walkDagPhaseCertifiedDifference` continues to return the same `NodeId` result set as
  `eagerExclude` for prototype fixtures, while yield order remains non-contractual.

Recommended graph fixtures:

- Linear chain.
- Diamond DAG.
- Merge-like DAG.
- Shared tail.
- Exclude path split.
- Include path reaches terminal.
- No stop points.
- Uncertified stop point.
- `excludeNodeId === undefined`.

### Frontier / Queue Tests

- Duplicate frontier items do not affect result correctness.
- Queue/frontier is not responsible for deduplication.
- The traversal loop skips already processed node IDs after dequeue.
- Successors from one expansion are enqueued via `enqueueMany` as one block.
- Default frontier preserves FIFO and block order.
- A custom frontier can change traversal order without changing the result set.

### Scheduling Metadata Tests

Use a recording frontier to inspect enqueued items.

Verify:

- Public `collectReachableNodeIds` uses role `"include"`.
- Eager exclude collection uses role `"exclude"` internally.
- Start items have `depth = 0`.
- Successor items inherit parent role.
- Successor items use `depth = parent.depth + 1`.
- `discoveredOrder` is monotonic within a phase.
- `DomainHint` is copied from `DagSuccessor` to `DagFrontierItem`.

### Adapter Cache Tests

For the Git adapter's `CommitTopologyAdapter` integration:

- Topology expansion and final commit-object yielding reuse the same invocation-scoped
  `CommitOid -> RawCommit` cache.
- Backend-specific commit read errors are translated inside the Git adapter boundary.
- Missing commits are reported as `GitAdapterError` with code `"COMMIT_NOT_FOUND"`.
- Unexpected commit-read failures are reported as `GitAdapterError` with code `"UNKNOWN"`.
- Adapter-level tests should focus on emitted commit object sets rather than generic successor-cache
  behavior.

Do not assert global `getSuccessors` minimization in traversal core tests. The DAG core intentionally does not own caching, and Stage 2 does not add a generic successor-cache helper.

### Telemetry Tests

Keep telemetry tests minimal in Stage 2.

Verify:

- Existing outer operation profiling/reporting still works, especially `git.walk_commits` where it
  remains applicable.
- Tests do not require `dag.traversal`, `dag.traversal.step`, `dag.traversal.collect_reachable`, or
  `dag.traversal.read_node.*` spans.
- Tests do not require old read/cache counters such as `include_reads`, `exclude_reads`, `cache_hits`,
  or `fallback_reads`.

Detailed DAG traversal telemetry tests should be added with the later telemetry redesign, not during
Stage 2 of this abstraction refactor.

---

## 14. Non-goals

- Do not implement a concrete PriorityQueue policy unless one already exists elsewhere.
- Do not make hints part of correctness.
- Do not preserve Node-yielding API compatibility.
- Do not add explicit block/index metadata to `DagSchedulingContext`.
- Do not add phase-specific frontier factories yet.
- Do not cache successors inside the traversal core.
- Do not keep telemetry only to preserve old metric names.
- Do not add a generic successor-cache helper in Stage 2.
- Do not redesign or over-optimize the `explore-dag-strategy.ts` certified-closure algorithm beyond
  the abstraction migration.
- Do not redesign DAG traversal telemetry in Stage 2; defer that work to a telemetry-focused follow-up.
- Do not let telemetry concerns shape traversal abstraction.

---

## 15. Implementation Order for a Coding Agent

Follow this order to reduce risk:

1. Add the new type model:
   - `DagTraversalRole`
   - `DagSchedulingContext`
   - `DagSuccessor`
   - `DagFrontierItem`
   - `DagTopologyPort`
   - `DagFrontier`

2. Add `createDefaultDagFrontier` using `OrderedQueue` with:
   - `dequeueOrder: "fifo"`
   - `blockOrder: "preserve"`

3. Add the private `DagFrontierItemFactory` helper.

4. Refactor `collectReachableNodeIds`:
   - Use `DagTopologyPort`.
   - Use `DagFrontierItem`.
   - Use `enqueueMany`.
   - Keep public role as `"include"`.
   - Add private `collectReachableNodeIdsWithRole`.

5. Refactor `walkDagNodeIdsEagerExclude`:
   - Use `collectReachableNodeIdsWithRole(..., "exclude", ...)`.
   - Traverse include side with role `"include"`.
   - Yield `NodeId`.

6. Refactor `walkDagNodeIdsCertifiedLazy`:
   - Remove `Node` and read/cache state.
   - Use `CertifiedLazyNodeState { fromInclude, fromExclude }`.
   - Use `Set<NodeId>` for result candidates.
   - Use fallback collection through `collectReachableNodeIdsWithRole`.

7. Update configured strategy API:
   - `walkDagNodeIdsWithConfiguredStrategy`
   - `walkDagNodeIdsEagerExclude`
   - `walkDagNodeIdsCertifiedLazy`

8. Shrink telemetry:
   - Remove node-read spans and read/cache counters.
   - Keep only minimal outer operation profiling/reporting needed for Stage 2.
   - Do not add a replacement DAG traversal telemetry model until a later telemetry redesign.

9. Update call sites.

10. Update tests according to the testing plan.

11. Remove obsolete code:

- `DagNodePort` if no longer needed.
- Node-yielding traversal functions.
- Node read telemetry constants.
- Generic successor-cache helper tasks.
- CertifiedLazy read/cache state types.
