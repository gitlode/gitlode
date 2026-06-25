# Profiling and walkCommits Optimization Handoff

## Purpose

This handoff prepares three follow-up features for future sessions:

- **A. Generic profiling improvements**
- **B. walkCommits instrumentation using the improved profiling API**
- **C. Bidirectional walkCommits traversal prototype, guided by profiling**

The immediate motivation is to understand and improve `walkCommits` strategy performance. However,
profiling is a cross-cutting runtime capability, so Feature A should be designed as a generic
extension rather than a Git-specific feature.

This document is not a finalized design. It is a working handoff for human developers and LLM
sessions that will pick up the next sequence of work.

## Background

The current `walkCommits` implementation has two internal strategies:

- `eagerExclude`: builds the full `reachable(exclude)` set before include-side traversal.
- `certifiedLazy`: starts with a lazy include/exclude view, attempts a conservative certificate, and
  falls back to cached full exclusion when the certificate does not hold.

See `docs/design/walk-commits-strategies.md` for the persistent strategy design.

A real repository profiling run showed that the two strategies take very different paths even when
total runtime is similar:

```text
eagerExclude:
  walk-commits/read-commit      ~  937s
  exclude-collect/read-commit   ~ 3458s

certifiedLazy:
  walk-commits/read-commit      ~ 4517s
  exclude-collect/read-commit   ~    6s
```

Interpretation:

- `eagerExclude` spends most time pre-reading old exclude-side history.
- `certifiedLazy` shifts most reads into include-side traversal.
- Similar total runtime suggests this repository/range was not a successful certificate case, or
  that fallback/cache behavior still caused comparable total work.
- The current profile output does not reveal enough operational detail to diagnose why.

The next step is therefore instrumentation first, optimization second.

## Overall sequencing

Work should proceed in this order:

1. **Feature A: improve generic profiling**
2. **Feature B: instrument walkCommits using Feature A**
3. **Feature C: prototype bidirectional traversal using Feature B data**

Feature A and B have been implemented through the newer span-first instrumentation migration. Do
not start Feature C merely because counters exist in code. First verify that real `--profile`
output is sufficient to compare traversal strategies without reading source or raw test fixtures.
At minimum, profile output should clearly expose:

- selected strategy;
- certified/fallback result and fallback reason;
- include-side reads;
- exclude-side reads;
- cache hits when present;
- fallback additional reads when present;
- fallback removed candidates when present;
- yielded commits.

## Feature A: generic profiling improvements

### Updated direction

Feature A has been superseded by the span-first migration direction recorded in
`docs/handoff/instrumentation-opentelemetry-migration.md`.

The original API sketch below proposed adding metrics directly to `StageProfiler`. That remains
useful historical context, but the agreed implementation direction is now:

- introduce a new internal `src/instrumentation` domain;
- align the model with OpenTelemetry spans, attributes, events, and future metrics;
- keep local `--profile` output deterministic and independent of external OTel export;
- include counter-like operational measurements early so gitlode's profiling needs are not reduced
  to timing-only spans;
- do not carry `workMs` into the new stable instrumentation output;
- keep the old `src/profile` implementation during the transition, then remove it after call sites
  and plugin APIs have moved to instrumentation.

Decorator-like metaprogramming remains a future option for method-level instrumentation, but the
current implementation should use explicit helpers. If decorators are adopted later, gitlode should
use only the standard TC39/TypeScript decorators model, not legacy TypeScript
`experimentalDecorators`.

### Goal

Extend the profiling system so code can record structured counters and decisions in addition to
wall/work timing.

The feature must remain domain-neutral. It should not know about Git, commits, OIDs, traversal
strategies, or walkCommits.

### Current profiling shape

Relevant files:

- `src/profile/type.ts`
- `src/profile/profiler.ts`
- `src/profile/utils.ts`
- `src/presentation/reporting/formatters.ts`
- `src/presentation/success-report.ts`
- `src/runtime/execution.ts`

Current profile output primarily reports:

- profiler path name
- wall time
- work time

This is useful for timing, but insufficient for operational questions such as:

- how many items were read?
- how many cache hits happened?
- which branch/decision path was taken?
- how many candidates were later discarded?

### Suggested design direction

Add generic metric support to `StageProfiler`.

Possible API shape:

```ts
interface StageProfiler {
  incrementMetric(name: string, delta?: number): void;
  setMetric(name: string, value: number | string | boolean): void;
}
```

The exact API is open, but should support at least:

- monotonically incremented counters;
- final scalar values;
- structured output that remains stable for tests.

Avoid making metric values too permissive unless there is a clear output format. A small set of
types is easier to render and test.

Also evaluate whether gitlode should continue extending its in-house profiler or adopt a generic
observability library such as OpenTelemetry.

Points to investigate:

- whether OpenTelemetry can reduce long-term maintenance cost for profiling/metrics code;
- whether its ecosystem can help analyze profiling data beyond the current CLI text report;
- whether the dependency and configuration cost is acceptable for gitlode's CLI use case;
- whether the existing `--profile` output should remain as a lightweight built-in path even if an
  OpenTelemetry integration is added.

As part of that investigation, also consider whether profiling instrumentation should use
metaprogramming techniques instead of hand-written profiling calls everywhere. This could include
decorator-like wrappers, generated wrappers, or higher-order instrumentation helpers. Evaluate this
together with any OpenTelemetry option, because the right instrumentation shape may differ if spans
or metrics are emitted through an external observability API.

### Output considerations

Profile rendering should remain readable in CLI output. Candidate formats:

```text
elapsed/git/walk-commits : wall=... work=... include_reads=123 cache_hits=45 result=fallback
```

or a separate indented metric block:

```text
elapsed/git/walk-commits : wall=... work=...
  metrics: include_reads=123, result=fallback
```

Prefer deterministic ordering:

- timing entries in current preorder;
- metrics in insertion order or sorted key order, but choose one and test it.

### Tests to add/update

Add tests around:

- metric accumulation;
- scalar metric replacement;
- child profiler metric isolation;
- formatted profile output with metrics;
- unchanged output when no metrics are recorded.

Existing timing-only tests should continue to pass.

### Non-goals

- Do not add Git-specific metric names in Feature A.
- Do not change CLI flags.
- Do not emit JSON profiling output unless explicitly chosen as part of the generic profiling
  design.

### Completion criteria

- Generic profiler can record and report metrics.
- Existing profiling behavior remains backward-compatible.
- Presentation tests cover the new metric rendering.
- Full package tests pass.

### Suggested starting prompt

```text
We are continuing gitlode profiling work. Implement Feature A from
packages/gitlode/docs/handoff/profiling-and-walk-commits-next.md.

Goal: extend the generic profile system so StageProfiler can record domain-neutral metrics
alongside wall/work timing. Do not add Git- or walkCommits-specific instrumentation yet.

Please inspect src/profile, presentation reporting, and existing profiler tests. Propose a small
API, implement it, update formatting/tests, and verify build/test/format.
```

## Feature B: walkCommits instrumentation

### Goal

Use Feature A's generic profiling metrics to make `walkCommits` strategy behavior observable.

This should answer:

- which strategy ran?
- did certified-lazy use a certificate or fallback?
- why did fallback happen?
- how many nodes were read from include/exclude side?
- how many reads were served from cache?
- how much fallback work was additional versus already cached?
- how many buffered result candidates were removed during fallback?
- how many nodes were yielded?

### Suggested metrics

Candidate metrics for `walk-commits` or child scopes:

- `strategy`: `"eagerExclude"` or `"certifiedLazy"`
- `include_reads`
- `exclude_reads`
- `cache_hits`
- `yielded`

Candidate certified-lazy metrics:

- `result`: `"certified"` or `"fallback"`
- `fallback_reason`: `"open_include_path"`, `"exclude_merge"`, `"no_stop_points"`, or
  `"uncertified_stop_point"`
- `fallback_reads`
- `fallback_removed`

These names are intentionally summary-oriented rather than local-variable-oriented. Avoid adding
internal booleans or derived counts unless they materially improve strategy comparison.

### Implementation notes

Relevant files:

- `src/git-impl/walk-commits-strategy.ts`
- `src/git-impl/isomorphic-git-adapter.ts`
- `test/git-impl/walk-commits-contract.test.ts`
- `test/git-impl/isomorphic-git-adapter.test.ts`

The strategy module is now generic over DAG nodes through `DagNodePort<NodeId, Node>`. Keep
instrumentation generic where possible. Git-specific naming belongs in adapter/test assertions, not
inside the DAG strategy unless unavoidable.

Be careful with cached reads:

- `readIncludeNode()` and `readExcludeNode()` may return cached nodes.
- Metrics should distinguish actual `readNode()` calls from cache hits.
- Fallback should record how many additional reads it caused after reusing cache.

### Tests to add/update

Add contract tests that assert metrics for known DAG cases:

- certified single-anchor success;
- multiple-anchor fallback;
- disconnected fallback;
- fallback with cached reads;
- eager-exclude full exclude pre-collection.

Avoid over-specifying ordering unless the metric intentionally captures ordering.

### Completion criteria

- Profile output explains the execution path of both strategies.
- Existing result-set contract tests still pass.
- Metrics are stable enough for regression tests.
- Full package tests pass.

Implementation status: complete in code. The current implementation records these diagnostics on
the `git.walk_commits` span and renders attributes/counters as separate profile detail lines.
Before Feature C, validate the output on at least one realistic repository/range and improve the
profile if the strategy comparison is still unclear.

### Suggested starting prompt

```text
We are continuing gitlode walkCommits profiling work. Feature A has added generic profiler metrics.
Implement Feature B from packages/gitlode/docs/handoff/profiling-and-walk-commits-next.md.

Goal: instrument walkDagEagerExclude and walkDagCertifiedLazy so profile output reveals strategy,
read counts, cache behavior, certified/fallback result, fallback reason, candidate removal, and
yield counts. Keep the DAG strategy generic and avoid Git-specific assumptions where possible.

Update contract/adapter tests and verify build/test/format.
```

## Feature C: bidirectional traversal prototype

### Goal

Prototype a more active bidirectional traversal for `walkCommits`, using profiling metrics from
Features A and B to compare it against `eagerExclude` and `certifiedLazy`.

If the prototype shows clear benefit without weakening correctness, it may become the production
strategy. Otherwise, keep it as an experimental/internal strategy or discard it.

### Hypothesis

The current certified-lazy strategy can shift most work from exclude-side traversal to include-side
traversal. In fallback-heavy cases, total work may remain similar to eager-exclude.

A bidirectional strategy may reduce wasted reads by advancing include and exclude frontiers in a
more balanced way, especially when:

- the include side reaches old history that is probably not connected to the exclusion boundary;
- exclude-side traversal can cheaply establish coverage near likely stop points;
- timestamp or generation-like hints can improve frontier selection without becoming correctness
  assumptions.

### Correctness constraints

The final result set must remain:

```text
reachable(start) - reachable(exclude)
```

Ordering is not contractual.

Timestamp ordering must not be used as a correctness proof. It may only guide read order.

Fallback must remain available whenever the prototype cannot prove safe early termination.

### Possible design directions

Candidate ideas:

- maintain include and exclude frontiers simultaneously;
- prioritize newer commits first as a heuristic, not a proof;
- detect when include frontier ages far beyond exclude frontier and choose whether to expand
  exclude side;
- preserve a conservative fallback to full subtraction;
- reuse the same `DagNodePort` and profiling metric system.

Do not replace the production default until tests and real profiling show a clear win.

### Required evidence

Use Feature B metrics to compare:

- total actual reads;
- include reads;
- exclude reads;
- cache hits;
- fallback additional reads;
- candidates removed during fallback;
- final yielded count;
- certificate/fallback reasons;
- wall/work time.

Run against:

- contract DAG fixtures;
- at least one large real repository/range where eagerExclude and certifiedLazy were similar;
- at least one range expected to be a certified-lazy win.

### Tests to add/update

Add the prototype to the existing table-driven walker registration point as an internal strategy.

Tests should assert:

- same OID set as eager-exclude;
- no duplicate output;
- missing-tip errors match existing behavior;
- fallback preserves correctness;
- metrics identify prototype execution path.

### Completion criteria

- Prototype returns the same result sets as existing strategies.
- Profiling clearly explains when it wins, ties, or loses.
- Production default is changed only if evidence supports it.
- Full package tests pass.

### Suggested starting prompt

```text
We are continuing gitlode walkCommits optimization work. Features A and B are complete, so profile
metrics now expose read counts, cache behavior, and fallback/certificate decisions.

Implement Feature C from packages/gitlode/docs/handoff/profiling-and-walk-commits-next.md.

Goal: prototype a bidirectional walkCommits strategy using the existing DagNodePort boundary and
generic profiling metrics. Preserve reachable(start)-reachable(exclude) correctness. Use timestamp
or similar hints only as traversal-order heuristics, never as proof. Add it to contract tests as an
internal strategy and compare metrics with eagerExclude/certifiedLazy before proposing any production
default change.
```

## Notes for future sessions

- Keep `git-traversal.md` focused on externally visible traversal/output behavior.
- Keep `walk-commits-strategies.md` focused on the durable internal strategy design.
- Use this file as a planning handoff; once a feature is completed, migrate stable decisions into
  durable design docs and remove obsolete planning details.
- The most valuable next diagnostic is not another timing scope; it is structured metrics that show
  why time was spent.
