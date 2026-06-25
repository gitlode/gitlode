# gitlode Instrumentation / OpenTelemetry Migration Direction

## Status

This document records the agreed direction for replacing gitlode's current custom `profile` implementation with a span-oriented instrumentation design aligned with OpenTelemetry concepts.

This is an instruction document for future implementation sessions.

No code change is made by this document itself.

---

## Background

gitlode currently has a custom profiling implementation under `packages/gitlode/src/profile`.

The current implementation is based on the following concepts:

- `StageProfiler`
- `DefaultStageProfiler`
- `ProfilingEntry`
- `wallMs`
- `workMs`
- hierarchical scoped profilers via `createScopedProfiler()`
- helper functions such as `withProfiler()` and `withProfilerAsync()`

The current runtime creates a root profiler named `elapsed`, then creates scoped profilers for stages such as:

- `git`
- `planning`
- `traversal`
- `projection`
- `write`

The git adapter also creates more detailed scoped profilers such as:

- `resolve-ref`
- `repository-object-format`
- `get-remote-url`
- `walk-commits`
- `walk-commits/read-commit`
- `exclude-collect`
- `exclude-collect/read-commit`
- `merge-base`
- `file-changes`
- `blob-read`
- `diff`

The current `--profile` output is rendered from `ProfilingEntry[]` as a local text summary with both `wall` and `work` values.

---

## Important Product Context

gitlode is currently in a prerelease stage.

This matters significantly.

If gitlode were already a stable production product with third-party plugin users, the safer migration path would be to preserve compatibility, introduce adapters, deprecate old APIs slowly, and avoid breaking plugin interfaces.

However, that is not the situation.

At this point:

- gitlode is prerelease.
- Existing plugins are official plugins.
- There are no known third-party plugins that need compatibility guarantees.
- The project should prioritize the ideal post-1.0 architecture over preserving temporary prerelease APIs.
- The current profile API should not be treated as a stable public contract.

Therefore, future sessions should not over-optimize for backward compatibility of the current profile/plugin interface.

The goal is to make the architecture cleaner before the formal stable release.

---

## Decision Summary

Adopt the following direction:

> Remove `StageProfiler` / `ProfilingEntry` / `wallMs` / `workMs` from the intended stable API surface, and replace the current profile design with a span-first `Instrumentation` abstraction aligned with OpenTelemetry concepts.

More specifically:

1. Do not preserve the existing `StageProfiler` API as a stable API.
2. Remove `StageProfiler` from plugin-facing API before stable release.
3. Replace the current profile domain with an instrumentation/telemetry domain.
4. Prefer span-oriented measurement over the current wall/work timing model.
5. Keep a local developer-facing `--profile` summary, but generate it from span-style records rather than from `ProfilingEntry.wallMs/workMs`.
6. Treat OpenTelemetry export as opt-in and potentially separate from the local `--profile` summary.
7. Do not carry `workMs` forward unless a future design proves a clear, reliable use case.
8. Be especially careful with async and iteration-heavy flows so spans measure the intended logical operation.
9. Preserve gitlode's operational diagnostic needs. Span-first must not erase counters, decisions, or low-cardinality execution-path details such as read counts, cache behavior, selected strategy, fallback reason, or yielded counts.
10. Design the internal abstraction so it can map cleanly to OpenTelemetry spans, span attributes, span events, and metrics. Avoid a local-only abstraction that would need to be redesigned before OpenTelemetry export can be added.

---

## Recommended Architecture

### Preferred Conceptual Shape

```text
runtime / core / git-impl / plugins
        ↓
Instrumentation abstraction
        ↓
 ┌─────────────────────────────┐
 │ NoopInstrumentation          │ default
 │ LocalSpanRecorder            │ --profile developer summary
 │ OpenTelemetryInstrumentation │ optional OTel export
 │ CompositeInstrumentation     │ local summary + OTel export
 └─────────────────────────────┘
```

The main codebase should depend on an internal instrumentation abstraction rather than directly depending on the current `StageProfiler`.

The abstraction should be span-first.

Example shape:

```ts
export interface Instrumentation {
  run<T>(
    name: string,
    fn: () => T,
    options?: InstrumentationOptions,
  ): T;

  runAsync<T>(
    name: string,
    fn: () => Promise<T>,
    options?: InstrumentationOptions,
  ): Promise<T>;
}

export interface InstrumentationOptions {
  readonly attributes?: Record<string, string | number | boolean>;
}
```

This exact API is not final. Future sessions may refine naming and types.

However, the important decision is:

> Use span-like operation boundaries, not reusable accumulating `StageProfiler` instances, as the primary model.

The abstraction should also leave explicit room for OpenTelemetry-compatible operational details.
Future implementation may choose one API shape, but it must support the following concepts early in
the migration:

- span attributes for low-cardinality decisions and execution path labels;
- span events for notable in-operation events that are not worth their own span;
- counters or counter-like local measurements for repeated operational quantities;
- a deterministic local snapshot for `--profile`, independent of external OTel export.

Example extended shape:

```ts
export type InstrumentAttributeValue = string | number | boolean;

export interface InstrumentationSpan {
  setAttribute(name: string, value: InstrumentAttributeValue): void;
  addEvent(name: string, attributes?: Record<string, InstrumentAttributeValue>): void;
  incrementCounter(name: string, delta?: number): void;
}

export interface Instrumentation {
  run<T>(
    name: string,
    fn: (span: InstrumentationSpan) => T,
    options?: InstrumentationOptions,
  ): T;

  runAsync<T>(
    name: string,
    fn: (span: InstrumentationSpan) => Promise<T>,
    options?: InstrumentationOptions,
  ): Promise<T>;
}
```

This is still illustrative rather than final. The requirement is that future design does not reduce
Feature A back to timing-only spans.

---

## Why Span-First

OpenTelemetry is built around traces and spans.

A span represents a bounded operation with a start and end time, optional attributes, events, status, and parent-child context.

This maps better to developer diagnostics than the current profiler tree because gitlode developers usually want to answer questions such as:

- Which logical stage is slow?
- How often is a stage called?
- Which repeated operation dominates runtime?
- Did a traversal algorithm change reduce time in `walk_commits`, `read_commit`, `file_changes`, or `diff`?
- Are plugins adding significant projection cost?
- Does a specific implementation path cause excessive blob reads or diffs?

A span-based model can support:

- total duration
- call count
- average duration
- max duration
- nested traces
- low-cardinality decision attributes
- span events for meaningful execution milestones
- associated counters or metric-like measurements
- optional OpenTelemetry export
- future backend-based analysis

The current `wallMs` / `workMs` model is less aligned with these needs.

---

## Decision on `workMs`

`workMs` is conceptually interesting, but it should not be carried forward as part of the new design.

Reasons:

1. In practice, observed `wall` and `work` values have shown little or no difference.
2. The current helper structure often wraps the same operation with both `resume()/stop()` and `measureWork()`, so `wallMs` and `workMs` frequently measure nearly the same thing.
3. It is unclear whether current gitlode execution flows actually contain meaningful cases where the current additive work-time model produces distinct, useful information.
4. Keeping `workMs` in the stable API would preserve a concept that is not currently proven useful.
5. OpenTelemetry spans provide a more standard foundation for duration measurement.
6. If additive work accounting is needed later, it can be reintroduced deliberately as a metric, span attribute, or specialized diagnostic collector.

Therefore:

> Remove `workMs` from the intended future profile/instrumentation output.

The new local profile summary should initially focus on span duration and possibly call-count-style aggregation.

Recommended initial summary fields:

- span name
- total duration
- call count
- average duration
- max duration

Optional future fields:

- min duration
- p95 duration
- error count
- selected domain counters

---

## Important Caution: Async and Iteration Semantics

Although `workMs` should be removed, the replacement design must still be careful.

gitlode contains async and iteration-heavy flows. Incorrect span placement can easily produce misleading measurements.

Future implementation sessions must pay close attention to:

1. Whether a span measures the entire logical operation or only creation of an iterator/generator.
2. Whether async iteration work happens inside or outside the span.
3. Whether repeated per-commit or per-file operations should be one aggregate span, many child spans, or aggregated local measurements.
4. Whether nested spans are too noisy for large repositories.
5. Whether span parent-child relationships remain correct across async boundaries.
6. Whether local summary aggregation should aggregate repeated spans by name.
7. Whether OpenTelemetry export should sample or suppress high-volume spans.

In particular:

- Avoid wrapping only a function that returns an async iterable if the actual work happens later during iteration.
- Prefer instrumentation around the actual consumption loop when that is where the work occurs.
- Be explicit about whether a span represents:
  - an entire phase,
  - one commit,
  - one file change,
  - one plugin projection,
  - one blob read,
  - one diff computation.

This point is important enough that future implementation should include tests or manual verification for async iterator measurement behavior.

---

## `--profile` Direction

Keep `--profile`, but redefine it as a developer-oriented diagnostics feature.

The current user-facing meaning is roughly:

> Print per-stage timing information after successful extraction.

The future meaning should be closer to:

> Print developer-oriented instrumentation timing summary for gitlode maintainers and plugin authors.

The feature is not primarily intended for end users to tune runtime behavior.

The profile output may still be useful to end users in limited ways, such as seeing total runtime. However, the primary audience is developers changing gitlode source code.

Recommended future `--profile` output shape:

```text
Profile
  span                                      total      calls      avg       max   details
  gitlode.run                            1280.4ms        1   1280.4ms  1280.4ms  granularity=file
  git.resolve_ref                           3.1ms        1      3.1ms     3.1ms
  git.walk_commits                        512.6ms        1    512.6ms   512.6ms  strategy=certifiedLazy fallback=true
  git.walk_commits.read_commit            420.2ms      240      1.8ms    12.4ms  reads=240 cache_hits=18
  git.file_changes                        601.2ms      240      2.5ms    45.0ms
  git.blob_read                           140.7ms      396      0.4ms     5.2ms  reads=396
  git.diff                                412.8ms      198      2.1ms    31.2ms  skipped=2
  projection                               84.7ms      240      0.4ms     4.0ms
  write                                    31.0ms      240      0.1ms     1.2ms  records=240 bytes=102400
```

The exact format remains open, but the important direction is:

- no `workMs`
- no `wall/work` pair
- aggregate repeated spans by span name for local summary
- preserve selected low-cardinality attributes and counters in the summary
- make the output useful for source-code-level performance work

---

## OpenTelemetry Direction

OpenTelemetry should influence the internal model.

However, the implementation should distinguish between:

1. OpenTelemetry-compatible instrumentation concepts.
2. Actually exporting telemetry through OpenTelemetry SDK/exporters.

These are related but not the same.

Recommended order:

1. Introduce span-first internal `Instrumentation`.
2. Implement `NoopInstrumentation`.
3. Implement local span recorder for `--profile`, including attributes and counter-like details.
4. Introduce an OpenTelemetry-backed implementation once local behavior is stable enough to validate mappings.
5. Keep OTel export opt-in, but treat it as a first-class target of the design rather than an afterthought.

The core package should avoid becoming unnecessarily heavy too early.

Likely dependency strategy:

- `@opentelemetry/api` may be reasonable in core instrumentation.
- `@opentelemetry/sdk-node` and exporters should be evaluated carefully.
- SDK/exporter setup can be CLI-only, optional, experimental, or moved to a separate package if needed.
- If the internal abstraction starts without `@opentelemetry/api`, document an explicit mapping from each internal concept to OTel concepts before implementation proceeds too far.

OpenTelemetry export should not be required for `--profile`.

`--profile` should work locally without a collector or external backend.

Suggested mapping:

| gitlode instrumentation concept | OpenTelemetry concept |
| --- | --- |
| `run` / `runAsync` operation | span |
| `InstrumentationOptions.attributes` | initial span attributes |
| `span.setAttribute()` | span attributes |
| `span.addEvent()` | span events |
| `span.incrementCounter()` | local summary counter and, later, OTel counter/metric or span event depending on cardinality and exporter strategy |
| thrown error from instrumented operation | span status/error recording |

This mapping may evolve, but future sessions should avoid inventing concepts that cannot be expressed
reasonably through OpenTelemetry.

---

## Plugin API Direction

Do not preserve `StageProfiler` in the plugin API.

Current plugin compatibility is not a constraint because existing plugins are official.

Before stable release, the plugin API should expose the new instrumentation abstraction instead.

Recommended future shape:

```ts
export interface PluginRuntimeContext {
  readonly instrumentation: Instrumentation;
}
```

Plugin instrumentation should use stable span names and attributes.

Example:

```ts
await context.instrumentation.runAsync(
  "plugin.identity_profile.resolve",
  async () => {
    // plugin work
  },
  {
    attributes: {
      "gitlode.plugin.namespace": "identity-profile",
    },
  },
);
```

Open question:

- Whether plugin spans should always be enabled under `--profile`.
- Whether plugin spans should be aggregated under `plugin.<namespace>.*`.
- Whether plugin authors should be encouraged to instrument internals or only top-level projection operations.

---

## Naming Direction

Recommended span names should be stable and dot-separated.

Possible names:

```text
gitlode.run

git.resolve_ref
git.repository_object_format
git.get_remote_url
git.walk_commits
git.walk_commits.read_commit
git.exclude_collect
git.exclude_collect.read_commit
git.merge_base
git.file_changes
git.blob_read
git.diff

planning
traversal
projection
write

plugin.<namespace>.init
plugin.<namespace>.project
```

This is not final, but future sessions should avoid ad-hoc names that make profile output hard to compare between runs.

Open question:

- Use dot-separated names such as `git.walk_commits`.
- Or use slash-separated names such as `git/walk-commits`.
- Prefer OpenTelemetry-style span names if an OTel convention becomes clear.

Current code uses slash-separated profiler paths. The new design does not need to preserve that.

---

## Attribute Direction

Use attributes sparingly.

Prefer low-cardinality attributes:

```ts
{
  "gitlode.granularity": "commit" | "file",
  "gitlode.object_format": "sha1",
  "gitlode.range.kind": "...",
  "gitlode.plugin.namespace": "...",
}
```

Avoid or carefully gate high-cardinality or sensitive attributes:

```ts
{
  "git.commit.oid": "...",
  "git.file.path": "...",
  "git.author.email": "..."
}
```

For local developer diagnostics, high-cardinality detail may sometimes be useful, but it should not automatically be exported to OpenTelemetry backends.

Open question:

- Whether local `--profile` and OTel export should use different attribute policies.
- Whether detailed file/commit attributes should require an additional debug flag.

---

## Local Summary Aggregation

The local `--profile` output should likely aggregate spans by name.

For each span name, collect:

- count
- total duration
- average duration
- max duration
- selected attributes
- selected counters

Potentially collect later:

- min duration
- percentile estimates
- error count
- skipped count
- bytes
- records
- domain-specific counters

Open question:

- Whether nested parent spans should be included in the same table as child spans.
- Whether to show inclusive duration only.
- Whether to derive exclusive duration.
- Whether exclusive duration is worth the complexity.
- Whether aggregation should group by span name only or by span name plus selected attributes.

Initial recommendation:

> Start with inclusive duration aggregation only. Aggregate primarily by span name, but preserve a
> deterministic summary of selected low-cardinality attributes and counters so important decisions
> are not hidden by aggregation.

Do not attempt exclusive time calculation initially unless a clear need emerges.

Attribute handling should be deterministic:

- low-cardinality attributes may be displayed as `key=value` details;
- if a span name has multiple values for the same display attribute, render a compact deterministic
  set or split the aggregation by that attribute;
- high-cardinality attributes should not be displayed or exported by default.

---

## Metrics and Counters

Some gitlode diagnostics may be better represented as counters than spans.

Examples:

- commits traversed
- file changes expanded
- blobs read
- diffs computed
- diffs skipped
- records written
- bytes written
- plugin projections executed

Open question:

- Whether to include counters in the initial instrumentation abstraction.
- Or keep counters separate from tracing until after the span migration.

Initial recommendation:

> Include a minimal counter-like API in the initial instrumentation abstraction, or at least in the
> first local recorder implementation, because Feature A and the following walkCommits
> instrumentation depend on counters and decisions. Do not require a full OpenTelemetry metrics SDK
> integration before the span migration can proceed.

Rationale:

- gitlode's immediate diagnostic need is not only "how long did this operation take?" but also
  "what path did it take and how much work did it do?";
- OpenTelemetry metrics are useful, but adding the full metrics SDK/export path should not block the
  local `--profile` summary;
- a small internal counter API can map later to OTel metrics, span events, or span attributes based
  on exporter needs.

Counter naming should follow the same stability expectations as span naming. Prefer concise,
domain-neutral names in generic layers and domain-specific names only at domain instrumentation
sites.

---

## Migration Strategy

Because gitlode is prerelease, prefer a clean migration over compatibility layering.

Recommended phased sequence:

### Phase 1: New instrumentation foundation

1. Introduce `src/instrumentation` or `src/telemetry`.
2. Define the new span-first abstraction with attributes, events, and minimal counter-like support.
3. Implement `NoopInstrumentation`.
4. Implement local span recorder for deterministic `--profile` output.
5. Add tests for:
   - sync span recording
   - async span recording
   - error handling
   - nested spans
   - repeated span aggregation
   - attributes and counters
   - async iteration behavior

### Phase 2: Replace old profiler usage

6. Replace runtime root `DefaultStageProfiler` usage.
7. Replace `withProfiler` / `withProfilerAsync` usage with instrumentation helpers.
8. Replace profiler injection in core classes.
9. Replace profiler injection in git adapter.
10. Replace `ProfilingEntry[]` runtime result with local profile summary data.
11. Update presentation formatting.
12. Preserve or improve the useful existing profile scopes as span names.

### Phase 3: Plugin API and cleanup

13. Remove `StageProfiler` from plugin API.
14. Update official plugins if needed.
15. Remove or archive old `src/profile`.
16. Remove old `ProfilingEntry`, `wallMs`, and `workMs` concepts from intended stable surfaces.

### Phase 4: OpenTelemetry export

17. Add an OpenTelemetry-backed implementation after local behavior is stable.
18. Decide dependency boundary for `@opentelemetry/api`, SDK, and exporters.
19. Add opt-in CLI/env configuration for OTel export.
20. Verify local `--profile` and OTel export can run independently or together.

These phases are meant to reduce migration risk, not to preserve the old API as a long-term
compatibility layer. A single PR/session may complete multiple phases if the diff remains small and
well-tested.

---

## What Should Not Be Done

Do not preserve the old design solely for prerelease compatibility.

Avoid:

- Keeping `StageProfiler` as public stable API.
- Keeping `workMs` in the main profile table.
- Making `--profile` depend on an external OpenTelemetry collector.
- Introducing OTel SDK/exporter before the internal instrumentation model is clear.
- Designing a local instrumentation model that cannot map cleanly to OpenTelemetry.
- Dropping counters, decisions, or operational detail merely because spans are the primary model.
- Adding many high-cardinality attributes by default.
- Measuring async iterables incorrectly by wrapping only their factory functions.
- Creating excessive per-file/per-commit spans without aggregation/sampling considerations.

---

## Open Decisions for Future Sessions

The following decisions are intentionally left open and should be resolved during implementation design.

### 1. Directory and naming

Choose one:

- `src/instrumentation`
- `src/telemetry`
- another name

Current preference:

> `src/instrumentation`, because the feature is primarily internal/developer instrumentation and not necessarily external telemetry.

### 2. Exact abstraction API

Open:

- Should methods be named `run` / `runAsync`?
- Or `span` / `spanAsync`?
- Should sync and async be separate?
- Should the function argument order be `(name, fn, options)` or `(name, options, fn)`?
- Should span interaction be passed as a callback argument, accessed from context, or both?
- What is the minimal API for attributes, events, and counters?

Current preference:

```ts
run(name, fn, options?)
runAsync(name, fn, options?)
```

This is simple and close to current helper usage. However, the final API should provide a way for
the instrumented operation to record selected attributes, events, and counter-like values while it
runs.

### 3. Local summary data model

Open:

- What type replaces `ProfilingEntry`?
- Should raw span records be returned?
- Should aggregated summary entries be returned?
- Should presentation aggregate raw records, or should instrumentation aggregate?

Current preference:

> Local recorder stores raw span records internally and exposes aggregated summary entries for
> presentation. Summary entries should include duration aggregation plus selected attributes and
> counters.

### 4. Span naming convention

Open:

- dot-separated: `git.walk_commits.read_commit`
- slash-separated: `git/walk-commits/read-commit`
- OTel-style human-readable names: `git walk commits read commit`

Current preference:

> Dot-separated names are easier to aggregate and align with attribute-like naming.

### 5. OpenTelemetry dependency boundary

Open:

- Add `@opentelemetry/api` to `gitlode` core dependency?
- Keep OTel integration in a separate package?
- Add SDK/exporter to CLI package only?
- Use dynamic import for optional SDK?

Current preference:

> Start with internal abstraction and local recorder. Add `@opentelemetry/api` when it materially
> improves correctness of the abstraction or when implementing the OTel adapter. In either case,
> keep an explicit mapping table from internal concepts to OTel concepts.

### 6. Async iterator instrumentation

Open:

- Where exactly should spans be placed for traversal and extraction flows?
- Should each yielded commit/file get a span?
- Or should loops aggregate manually to avoid huge trace volume?

Current preference:

> Be conservative. Use phase-level spans first, then add repeated operation aggregation where useful. Avoid high-volume exported spans by default.

### 7. Exclusive duration

Open:

- Should local profile summary show inclusive or exclusive time?

Current preference:

> Inclusive only at first. Exclusive time is useful but easy to get wrong and can be added later.

### 8. Plugin instrumentation granularity

Open:

- Top-level plugin init/project spans only?
- Allow plugin internals to create spans?
- How to prevent noisy plugin output?

Current preference:

> Provide instrumentation to plugins, but official plugins should initially instrument only meaningful top-level operations.

### 9. CLI flags and environment variables

Open:

- Keep only `--profile` initially?
- Add `--trace`?
- Use env vars for OTel export?

Current preference:

> Keep `--profile` for local developer summary. Use env vars or experimental flags for OTel export later.

### 10. Metrics/counters

Open:

- Should counters be included in initial instrumentation?
- Or should this wait?

Current preference:

> Include minimal local counter support early. Do not block on full OTel metrics SDK/exporter
> integration.

---

## Implementation Guidance for Future LLM Sessions

When implementing this direction, future agents should:

1. Read current `packages/gitlode/src/profile` implementation.
2. Read all current usages of `StageProfiler`, `ProfilingEntry`, `withProfiler`, and `withProfilerAsync`.
3. Do not preserve the old API unless a concrete reason is found.
4. Prefer replacing old concepts with span-first instrumentation.
5. Remove `workMs` from the new main output.
6. Preserve counters, decisions, and low-cardinality operational details needed for profiling work.
7. Add tests specifically for async, nested, attribute, counter, and aggregation behavior.
8. Verify that `--profile` still works as a local developer feature.
9. Avoid adding OpenTelemetry SDK/exporter until local instrumentation is stable, unless the current
   implementation task explicitly includes OTel export.
10. Keep OpenTelemetry compatibility in mind when designing names, attributes, events, counters, and
    context handling.
11. Update official plugins if plugin context changes.
12. Ensure final design is suitable for stable release, not just minimal migration.

---

## Rationale Recap

The main reason for this migration is not simply to use OpenTelemetry.

The deeper reasons are:

- gitlode should not maintain a custom profiling framework unless it provides unique value.
- The current profile system has leaked into core, git implementation, runtime, presentation, and plugin API.
- The current `workMs` concept is not proven useful in gitlode's actual measurement points.
- Profile is developer-oriented, not a primary end-user feature.
- A span-first design better supports source-code-level performance investigation.
- OpenTelemetry alignment improves future reuse across other applications.
- Prerelease is the right time to remove questionable APIs before they become stable commitments.

The final target is:

> A clean, span-first developer instrumentation system with local `--profile` summary and optional future OpenTelemetry export.
