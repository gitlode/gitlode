# OpenTelemetry Instrumentation Redesign Handoff

## Status and authority

This handoff tracks unfinished design and implementation work for the OpenTelemetry instrumentation
redesign. The accepted target contract is
[`../design/telemetry.md`](../design/telemetry.md). Do not reconstruct design decisions from chat
history or treat this handoff as a competing telemetry specification.

The redesign has not yet been implemented. Current source and
[`../profiling.md`](../profiling.md) still describe the custom instrumentation behavior. Other durable
documents may contain explicitly marked target sections so implementation can proceed design-first.

Delete this handoff after all design gates, implementation phases, documentation updates, and
verification are complete.

## Objective

Replace gitlode's custom OpenTelemetry-like instrumentation contracts with actual OpenTelemetry API
types and semantics while preserving extraction behavior and useful local profiling.

The current effort is intentionally limited to:

- OpenTelemetry API-based instrumentation;
- deliberate span and metric semantics;
- local `--profile` SDK collection;
- worker lifecycle and failure isolation; and
- a new SDK-independent profile report and presentation.

External export is not implemented. If added later, it will replace local collection for a run;
combined local and external operation is a non-requirement. Do not add a destination abstraction,
combined sampling policy, or exporter configuration during this migration.

## Current implementation to remove

The current `packages/internal-foundation/src/instrumentation` domain contains:

- `Instrumentation`, `InstrumentationSpan`, and `ActiveInstrumentationSpan` contracts;
- gitlode-owned no-op objects;
- direct local span recording that retains ended records;
- generic counters attached to local spans;
- an async-iterable helper based on the custom contract; and
- the flat `ProfileSummaryEntry` presentation model.

Worker execution conditionally injects `LocalInstrumentationRecorder` or `noopInstrumentation`.
The plugin API exposes an optional `StageProfiler`-style contract. Profile rows are ordered by first
span occurrence and combine span attributes, counters, and errors into one details field.

All of these are migration inputs, not compatibility requirements. JSONL output and extraction
semantics are compatibility requirements; the profile table is not.

## Accepted design summary

The normative details are in [`../design/telemetry.md`](../design/telemetry.md). The following list is
only a routing summary for implementation sessions.

- Instrumented code uses `Tracer`, `Span`, `Meter`, `SpanOptions`, and `Context` from
  `@opentelemetry/api`.
- gitlode owns tracing helpers, semantic catalogs, domain metric recorders, local collection, and
  worker composition, not substitute tracing contracts.
- One `WorkerTelemetrySession` owns one worker run and finalizes after application resource
  disposal without changing its result.
- Normal traces contain bounded operations and logical streams, not per-commit/file/record/blob/diff
  spans.
- High-frequency counts, durations, and sizes use pre-created counters and histograms with one
  recording owner.
- `--profile` enables local collection of one observation catalog; it does not select a detailed
  instrumentation path.
- Local processors aggregate eagerly with bounded memory and do not retain span objects or raw
  histogram samples.
- `ProfileReport` keeps spans, counters, histograms, and diagnostics separate and contains no SDK
  types.
- Collector order is canonical. Presentation alone owns known-observation grouping, labels, and
  preferred reading order.
- Plugin runtime supplies plugin-scoped `Tracer` and `Meter` values; the host uses metrics rather
  than a span for every plugin projection.
- Telemetry initialization and finalization failures degrade to no-op or partial profile data and
  never alter application output or result classification.

## Design gate status

### Complete

- OpenTelemetry API direction and non-goals.
- Migration phase ordering.
- tracing helper and error/status semantics.
- async-iterable activation, cancellation, and terminal semantics.
- instrumentation scopes and plugin injection shape.
- worker provider/context ownership and finalization order.
- local versus future external destination policy.
- normal trace volume and removal of high-frequency spans.
- signal-selection rules and operation recording ownership.
- metric naming, unit, cardinality, and sensitive-data policies.
- core, Git adapter, DAG, file expansion, diff, output, projection, and plugin observation intent.
- local aggregation limits and attribute reducers.
- profile signal separation, deterministic collection order, and presentation ownership.
- source-domain, package, and SDK dependency boundaries.
- monotonic duration timing and no-op timing-token behavior.
- local profiler failure isolation and partial-report policy.
- complete accepted span, metric, and attribute observation catalogs, including explicit removals.
- structured profile-report and presentation-view catalogs, including partial and overflow rendering.

### Remaining

Only the following design gates remain. New items discovered during documentation or implementation
review must be added here explicitly rather than introduced as an untracked sequence of discussions.

1. **Verification and implementation handoff**
   - Define behavioral fixtures, hierarchy/metric contract tests, bounded-memory tests, and
     representative performance measurements.
   - Set acceptance criteria for instrumentation overhead.
   - Split implementation into branch-sized units with explicit prerequisites and completion gates.

Implementation must not begin beyond a phase's prerequisite boundary while that phase depends on
an unresolved design gate.

## Implementation phases

### Phase 0: Durable contracts and baselines

1. Complete the remaining observation and report catalogs.
2. Finish target updates to architecture, domain, plugin, and telemetry documentation.
3. Inventory every current observation and record its target or removal rationale.
4. Capture representative extraction and JSONL baselines for commit, file, incremental, adapter,
   and plugin scenarios.
5. Define performance fixtures and the measurement method before changing instrumentation.

Acceptance:

- no observation requires a branch-session design decision;
- durable docs and dependency rules describe the target consistently;
- every current observation has a disposition; and
- behavioral and performance baselines are reproducible.

### Phase 1: OpenTelemetry API helpers

1. Add `@opentelemetry/api` to each workspace that imports it directly.
2. Replace custom helper contracts with sync, async, error, and async-iterable helpers using OTel API
   types.
3. Add focused tests for return/error identity, active context, parent override, all iterator
   terminal paths, serialization of iterator methods, and exactly-once ending.
4. Keep call sites on the old instrumentation until helper behavior is complete.

Acceptance:

- helper signatures expose OTel API types;
- all specified lifecycle paths are tested;
- no exporter or SDK package is introduced below execution; and
- extraction behavior is unchanged.

### Phase 2: Observation catalog and domain recorders

1. Add shared identifiers and machine-checkable metric metadata.
2. Add domain-owned recorder factories with pre-created instruments and no-op implementations.
3. Implement monotonic timing tokens without reading the clock in no-op mode.
4. Add metadata contract tests for names, units, attributes, theoretical cardinality, owners, and
   buckets.
5. Do not add a transient generic counter compatibility API.

Acceptance:

- every instrument is created outside hot paths;
- no observation has multiple owners;
- disabled recorders avoid high-frequency timing work; and
- recorder tests match the canonical catalog.

### Phase 3: Local SDK collection and worker session

1. Add SDK dependencies only to the public application package.
2. Implement the local span processor, manual metric reader, bounded aggregators, and report builder.
3. Implement explicit provider use, compatible context management, session initialization,
   idempotent finalization, partial reports, and lifecycle diagnostics.
4. Test limits, overflow, missing signals, initialization failure, each finalize-stage failure, and
   exactly-once shutdown.
5. Do not add external exporters or a telemetry-destination abstraction.

Acceptance:

- no completed span object or raw histogram sample is retained;
- local profile needs no network or external collector;
- processor callbacks and recorder hot paths do not throw into application work;
- lifecycle failures preserve the application result; and
- report data is structured-clone-safe and deterministic.

### Phase 4: Operation-owner migration

Migrate owners in coherent slices rather than mechanically replacing calls:

1. execution root and setup;
2. extraction planning, traversal, projection, output, and file expansion;
3. Git common operations and each adapter's implementation details;
4. DAG facades and operation-local measurements;
5. line-diff implementation;
6. plugin runtime, plugin API, and official plugins.

For each slice:

- migrate tracing directly to OTel types and helpers;
- inject the final domain recorder rather than a provider or SDK object;
- delete replaced high-frequency spans and duplicate counters;
- verify trace parentage and metric recording points; and
- compare extraction results and JSONL with profile off and on.

Acceptance:

- all call sites have their final signal shape;
- plugin extension output is unchanged;
- traversal and adapter diagnostics retain their intended meaning; and
- no custom instrumentation contract remains in migrated slices.

### Phase 5: Profile presentation and legacy removal

1. Replace `ProfileSummaryEntry` with the accepted `ProfileReport` protocol.
2. Implement signal-separated profile rendering and the declarative view catalog.
3. Keep unknown observations visible in canonical fallback order.
4. Remove custom instrumentation types, local recorder, noop implementation, and stale tests.
5. Update [`../profiling.md`](../profiling.md) and user-facing examples to the implemented output.

Acceptance:

- profile output preserves the diagnostic purpose rather than the old table shape;
- presentation has no OTel SDK dependency;
- collectors contain no display-order knowledge; and
- no production or plugin declaration exposes the removed contracts.

### Phase 6: Volume, performance, and consolidation

1. Run the predefined representative and synthetic repository measurements.
2. Verify removed application-level leaf spans do not return and measure the volume of explicitly
   cataloged command spans that scale with real command invocations.
3. Investigate observations that exceed the accepted overhead criteria; change the catalog only
   through an explicit design update.
4. Run the complete functional, architecture, type, test, build, and format checks.
5. Remove migration-status notes, move any remaining stable facts into durable docs, and delete this
   handoff.

Acceptance:

- performance criteria pass or an explicitly reviewed exception is documented;
- profile off/on JSONL comparisons pass for the full verification matrix;
- current documentation describes the implemented behavior; and
- no unfinished migration item remains.

## Required verification matrix

Every runtime phase must select applicable cases from this matrix and run them with profiling off
and on unless the test specifically exercises local collection.

| Scenario                               | Required evidence                                                        |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Commit extraction                      | Result and JSONL equivalence; root/phase hierarchy                       |
| File extraction                        | Blob, diff, skip, projection, and output observations; JSONL equivalence |
| Incremental extraction                 | Range and checkpoint behavior unchanged                                  |
| Isomorphic Git adapter                 | Common Git semantics and DAG measurements                                |
| Git CLI adapter                        | Command/session hierarchy and process disposal                           |
| Built-in projection                    | Outcome and duration metric ownership                                    |
| Official plugin projection             | Extension equivalence, scopes, continued/fatal outcomes                  |
| User error                             | Typed error status without synthetic exception                           |
| Runtime exception                      | Exception/status recording and original error preservation               |
| Iterator exhaustion/cancellation/throw | Context, terminal state, and exactly-once end                            |
| Collector limit overflow               | Bounded report and deterministic overflow summary                        |
| Telemetry lifecycle failure            | Unchanged application result and best-effort shutdown                    |
| Representative large repository        | Bounded memory, trace volume, and accepted overhead                      |

Profile assertions should test semantic contents and deterministic ordering. Do not freeze terminal
spacing or incidental formatting unless it becomes an intentional presentation contract.

## Branch-session rules

- Read [`../design/telemetry.md`](../design/telemetry.md) before changing telemetry code.
- Treat the observation catalog and operation owner as authoritative; do not invent names or move
  recording points inside an implementation branch.
- Do not preserve a removed custom API through a compatibility wrapper unless this handoff is first
  updated with an explicit migration need.
- Do not add external export, combined modes, detailed high-frequency spans, or sensitive
  attributes.
- Keep unrelated user changes in the worktree intact.
- Update the relevant durable documentation in the same branch that changes implemented behavior.
- Run `npm run format:write` before finishing implementation and verify `npm run format:check`, in
  addition to the phase-specific checks.
