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
- Generic OTel lifecycle mechanisms are exported from
  `@gitlode/internal-foundation/otel-support`; gitlode-specific policy is exported separately from
  `@gitlode/internal-contracts/telemetry`. No new workspace is introduced, and `otel-support` does
  not own `gitlode.*` names.
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

There are no remaining design gates. The verification contracts are accepted in
[`../design/telemetry-verification.md`](../design/telemetry-verification.md) and its YAML catalog,
the performance contracts are accepted in
[`../design/telemetry-performance.md`](../design/telemetry-performance.md) and its YAML catalog, and
the branch-sized implementation sequence is defined below.

New design questions discovered during implementation review must be recorded here and resolved in
the trunk session. A branch session must not make a local design decision that changes the accepted
contracts.

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

1. Add the generic `otel-support` domain and export to `@gitlode/internal-foundation`, and keep the
   gitlode-specific `telemetry` domain and export in `@gitlode/internal-contracts`.
2. Add sync, async, error, and generic async-iterable mechanisms to `otel-support`; compose the
   gitlode async-iterable helper as a thin completion-policy binding in `telemetry`.
3. Add focused tests for return/error identity, active context, parent override, all iterator
   terminal paths, serialization of iterator methods, and exactly-once ending.
4. Keep call sites on the old instrumentation until helper behavior is complete.

Acceptance:

- helper signatures expose OTel API types;
- `gitlode.*` conventions occur only in the gitlode-specific `telemetry` domain;
- generic helper state machines occur only in `otel-support`;
- all specified lifecycle paths are tested;
- no exporter or SDK package is introduced below execution;
- extraction behavior is unchanged; and
- repository architecture checks pass without adding OpenTelemetry dependencies to workspaces that
  do not import it in source.

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

## Trunk and branch execution protocol

The trunk session owns this plan, design interpretation, starting prompts, review, and completion
tracking. A branch session owns only the bounded implementation unit named in its prompt. A human
starts each branch session by copying the prompt prepared by the trunk session; the branch session
returns a summary and does not choose the next unit.

For every unit, use this gate:

1. The trunk session confirms that all prerequisite units are complete and prepares a starting
   prompt containing scope, exclusions, required reading, acceptance evidence, and summary format.
2. The branch session implements only that unit, runs its required checks, and reports changed
   files, design-contract mapping, tests, and residual concerns.
3. The trunk session reviews the actual worktree diff and the summary against the durable contracts.
   The summary is evidence to inspect, not a substitute for inspecting code and tests.
4. If review finds a problem, the trunk session prepares a correction prompt for the same branch
   session and repeats review after correction.
5. The trunk session marks a unit complete only when the diff, tests, documentation, and unit exit
   gate all pass. Only then may a dependent unit start.

All implementation branches are sequential and cumulative. Do not implement two units concurrently,
because later units deliberately depend on types and migration state established by earlier ones.
The trunk session must preserve unrelated worktree changes and distinguish them from the reviewed
unit.

### Intermediate migration policy

The target API foundation, recorders, and local SDK composition are introduced before all production
owners can use them. The following temporary state is deliberate:

- migrated owners accept and use their final OTel API values and domain recorders;
- owners not yet migrated continue to use the legacy custom instrumentation directly;
- composition supplies OTel no-op API values to migrated owners until the target runtime switch;
- the legacy local recorder remains the only active profile collector until the integration unit;
  observations already migrated away from it may therefore be absent from the transitional profile;
  and
- the integration unit activates `WorkerTelemetrySession`, switches transport and presentation to
  `ProfileReport`, and removes the legacy collector and remaining custom contracts.

This temporary loss of profile coverage is allowed only on the non-release migration trunk. Every
unit must still preserve application results and JSONL behavior. Do not introduce an old-to-new or
new-to-old compatibility adapter, duplicate an observation in both systems, merge old and new
profile outputs, or keep a migration abstraction in the final design.

## Branch-sized implementation units

The identifiers below are stable references for starting prompts and review notes. A unit may contain
several commits, but it is reviewed and completed as one branch-session result. Splitting a unit
further requires a trunk-session plan update that preserves its stated exit gate.

### T00A: Catalog verification and behavioral baselines

Prerequisites: accepted design documents only.

Scope:

- implement catalog-contract validation for the accepted span, metric, attribute, report, view, and
  verification YAML without loading YAML in production;
- add the deterministic repository recipe and reusable profile-disabled/enabled comparison helpers;
- capture legacy behavioral baselines for the cataloged commit, file, incremental, adapter, output,
  and plugin scenarios; and
- prove that the comparison detects intentional result, JSONL, and checkpoint differences.

Do not change production instrumentation or freeze the legacy profile table.

Exit gate:

- deterministic fixture regeneration produces identical semantic inputs;
- baseline comparisons detect an intentional JSONL or checkpoint difference;
- catalog validation detects missing, duplicate, invalidly referenced, and misplaced observations;
  and
- normal build, relevant tests, lint, architecture, and format checks pass.

### T00B: Performance harness and legacy baseline

Prerequisites: T00A.

Scope:

- add the performance harness, fixture generators, fixture manifest, environment fingerprint,
  child-process RSS sampling, raw-artifact format, comparison logic, and fixture calibration workflow
  required by the performance contract;
- reuse T00A behavioral comparison rules before accepting any measured run;
- calibrate and freeze reference fixture quantities when the reference environment is available; and
- capture the `legacy_off` raw artifacts and baseline Git revision needed by T13.

Do not change production instrumentation. Keep generated repositories, outputs, and large raw run
artifacts out of normal tests and package contents. If wall-clock fixture calibration cannot be
completed in the branch environment, the branch must still deliver and test the harness and an
explicitly incomplete manifest; T13 then remains blocked until calibration and baseline capture on a
suitable reference environment.

Exit gate:

- the harness records every field required by `performance.yaml`;
- test-scale fixtures verify pairing, statistics, incompatibility, inconclusive-run, output
  equivalence, RSS, report-size, and artifact serialization logic;
- a documented command reproduces calibration and measurement without changing the manifest; and
- normal build, relevant tests, lint, architecture, and format checks pass.

### T01: OpenTelemetry support and telemetry binding

Prerequisites: T00B.

Scope:

- create the generic `otel-support` source domain and
  `@gitlode/internal-foundation/otel-support` export inside the existing `internal-foundation`
  workspace; do not add another workspace/package;
- keep the gitlode-specific `telemetry` domain and
  `@gitlode/internal-contracts/telemetry` export in `internal-contracts`;
- add `@opentelemetry/api` directly to `internal-foundation`, which imports it for `otel-support`,
  and keep `internal-contracts` free of a direct API import in this unit;
- implement `withSpan`, `withAsyncSpan`, `recordSpanError`, `AsyncIterableCompletion`, and
  `createAsyncIterableInstrumenter` in `otel-support` with the accepted OTel API and lifecycle
  semantics;
- implement `instrumentAsyncIterable` in `internal-contracts/telemetry` only as a typed binding that
  supplies the `gitlode.stream.completion` callback to the generic factory;
- keep shared gitlode scope and observation identifiers in the telemetry contract domain without
  adding SDK code or gitlode-specific names to `otel-support`; and
- test callback and error identity, active and explicit parent context, status policy, iterator
  serialization, every terminal path, and exactly-once ending using fake API values, including
  active context after an awaited continuation.

For `instrumentAsyncIterable`, starting the first `next()` starts one span before source iterator
acquisition. Empty first-pull exhaustion therefore emits one `exhausted` span, while acquisition and
first-pull failures emit one error span and preserve the original thrown value. `return()` or
`throw(value)` before any `next()` does not acquire the source or emit a span. This replaces the
unimplementable requirement to run the first pull in a span and later discard that span when it is
empty.

Keep the legacy custom instrumentation export and existing production call sites unchanged. The
new `otel-support` export must remain separate from its barrel, so declaration traversal from the
legacy plugin API does not make `@opentelemetry/api` appear to be a plugin dependency. Do not rename
legacy helpers, add SDK dependencies or exporters, or add compatibility overloads to the target
helpers. Regenerate a complete lockfile entry from a usable registry and verify
`architecture:check` from a worktree without stale generated outputs from earlier placements.

Exit gate: Phase 1 acceptance is satisfied and existing extraction behavior is unchanged.

### T02: Shared metric and report contracts

Prerequisites: T01.

Scope:

- implement machine-checkable production metadata corresponding to the accepted observation
  catalogs, including names, scopes, instruments, units, attributes, reducers, buckets, owners, and
  explicit removals;
- implement the SDK-independent `ProfileReport` protocol, canonical value normalization utilities,
  collection limits, and diagnostic identifiers;
- add the shared monotonic timing-token and no-op-recorder primitives used by domain recorder
  factories; and
- extend catalog contract tests to compare production metadata to every accepted YAML entry.

Production code must not parse YAML. Report types must contain no OTel SDK type and must be
structured-clone-safe by construction.

These shared contracts and utilities extend `@gitlode/internal-contracts/telemetry`; they do not
create a new workspace or move gitlode-specific metadata into `internal-foundation`.

Exit gate: shared metadata and report contracts match the catalogs, and no-op timing primitives read
no clock and allocate no per-operation timing token.

### T03: Extraction-side domain metric recorders

Prerequisites: T02.

Scope:

- add final recorder factories and no-op implementations for extraction, file expansion, built-in
  projection, output, concrete line diff, and plugin runtime metrics;
- place each factory with the operation-owning domain and declare `@opentelemetry/api` directly in
  every importing workspace;
- keep pure typed metadata lookup and catalog-derived attribute types in
  `@gitlode/internal-contracts/telemetry`; do not add an application-level shared telemetry-support
  domain or create dependencies between operation-owner implementations;
- pre-create instruments and implement the cataloged outcome, zero, partial-work, attribute, and
  timing semantics;
- refine the shared timing completion contract, if necessary, so first completion is represented
  independently from nullable duration availability; enabled tokens retain exactly-once terminal
  ownership even when the clock fails;
- record valid non-duration observations on first completion even when duration is unavailable, and
  isolate invalid numeric input to only the affected signal;
- make successful file-change expansion require its size, including zero, while failure carries no
  size; and
- add fake-`Meter` owner tests for every metric and every no-op recorder family in these domains,
  including exact histogram advice and the completion boundary cases above.

Do not yet replace production observation call sites and do not introduce a generic counter API.

Exit gate: all extraction-side accepted metrics have exactly one tested recorder owner; compound
recorders preserve valid sibling signals when timing or another numeric signal is invalid; repeated
completion records nothing; and disabled recorders create no instruments, perform no clock reads,
and require no per-operation timing-token allocation.

### T04: Git and DAG domain metric recorders

Prerequisites: T03.

Scope:

- add final recorder factories and no-op implementations for common Git, adapter-specific Git, and
  DAG metrics in the Git implementation domain;
- define an adapter from algorithm-neutral DAG observation hooks to the cataloged `gitlode.dag`
  recorder without connecting it to production DAG owners yet;
- preserve the separation between public-operation completion and reusable DAG core measurements;
- encode adapter, object-purpose, cache-result, fallback, completion, and partial-work semantics from
  the catalogs; and
- add fake-`Meter` owner tests for every metric in these families while retaining exact existing DAG
  correctness and efficiency tests.

Do not instrument production owners yet and do not retain removed prototype-specific DAG counters.
Do not import `@gitlode/internal-contracts/telemetry`, `@opentelemetry/api`, or `gitlode.*`
identifiers from the generic `dag` domain.

Exit gate: Phase 2 acceptance is satisfied for the complete metric catalog.

### T05: Bounded local collection and report building

Prerequisites: T04.

Scope:

- add OTel SDK dependencies only to the public `gitlode` package;
- implement the bounded local span processor, manual metric reader and views, diagnostic accumulator,
  and `ProfileReport` builder under the execution module group;
- implement all reducers, normalization, signal-status, overflow, invalid-aggregation, and canonical
  sorting rules; and
- test every limit below, at, and above its boundary, signal availability states, shuffled input,
  structured cloning, and non-retention of completed span objects and raw histogram samples.

Do not connect the collector to production execution, add an exporter, or create a destination
abstraction.

Exit gate: the collector-and-report layer in the verification catalog passes and remains bounded.

### T06: Worker telemetry session

Prerequisites: T05.

Scope:

- implement `WorkerTelemetrySession` with explicit providers, compatible async context management,
  root-span ownership, idempotent non-rejecting finalization, best-effort stage progression, and
  exactly-once shutdown;
- expose only internal fault-injection seams required by the verification catalog;
- test initialization, active context propagation, flush, collection, report-build, and shutdown
  failures, including partial reports and bounded diagnostics; and
- verify that finalization cannot change or replace an application result.

Keep this session unconnected from `executeRun`; the production switch occurs in T12 after owner
migration. Do not generalize test seams into a backend interface.

Exit gate: Phase 3 component acceptance and the worker-session fault-injection matrix pass.

### T07: Execution, extraction, projection, and output owner migration

Prerequisites: T06.

Scope:

- migrate execution setup operations, `ExtractionPipeline`, traversal planning, commit extraction,
  built-in projection, file expansion, and output owners to final OTel tracers and domain recorders;
- establish final explicit parent-context flow for logical async streams;
- remove replaced per-item spans and generic counters in this slice; and
- add owner-integration evidence for root/setup semantics in isolation, extraction hierarchy,
  deduplication, partial counts, guards, projection, output close, rotation, and write effects.

The root span remains owned by the unconnected session component until T12. Tests may instantiate
the session or fake API values directly, while normal production composition supplies OTel no-op
values to migrated owners under the intermediate migration policy.

Exit gate: this slice contains no custom instrumentation types and its behavior and JSONL baselines
pass with profile input disabled and enabled.

### T08: DAG owner migration

Prerequisites: T07.

Scope:

- replace the generic DAG domain's legacy telemetry dependency with algorithm-neutral observation
  hooks and connect those hooks to the Git implementation-owned OTel binding;
- apply logical-stream tracing around the Git implementation's use of public DAG facades rather
  than importing OTel or gitlode telemetry conventions into the generic DAG domain;
- implement logical-stream spans, operation completion, partial work, cancellation, handled-throw,
  fallback event and counter, and exactly-once measurement semantics; and
- replace legacy instrumentation assertions while preserving exact topology and graph-work tests.

Exit gate: the DAG verification slice passes, with no duplicate metric set and no legacy or removed
DAG observation remaining.

### T09: Git adapter owner migration

Prerequisites: T08.

Scope:

- migrate common Git port operations and both adapters to final tracer and recorder inputs;
- implement common operation spans and metrics, isomorphic-git DAG hierarchy, and Git CLI version,
  rev-list, commit batch, diff-tree, and persistent blob-batch lifecycles;
- remove per-blob and other prohibited high-frequency spans; and
- test typed failures, runtime exceptions, command errors, cancellation, disposal, cache and object
  semantics, and absence of telemetry-induced Git commands.

Exit gate: both adapters satisfy the Git owner-integration matrix and behavioral baselines without
custom instrumentation types.

### T10: Concrete line-diff owner migration

Prerequisites: T09.

Scope:

- replace the ad hoc line-diff instrumentation shape with the final domain recorder;
- record operation, duration, input-size, and concrete outcome semantics at the implementation owner;
  and
- test success, binary, too-large, and error distinctions together with file-expander guard ordering.

Exit gate: the line-diff adapter exposes no legacy telemetry shape and its accepted owner evidence
passes.

### T11: Plugin API, runtime, and official plugin migration

Prerequisites: T10.

Scope:

- replace the plugin `StageProfiler`-style surface with plugin-scoped `Tracer` and `Meter` values;
- implement resolved package and bounded fallback scopes, explicit bootstrap/init parentage, and
  package-version handling;
- migrate plugin runtime host spans and projection recorders, including all four projection outcomes
  and fatal/thrown-value policy; and
- update official plugins and public declaration tests while preserving extension JSON and order.

Update architecture enforcement so a plugin that imports only `gitlode/plugin-api` is not required
to declare `@opentelemetry/api` merely because that package appears in transitive declarations.

Do not use namespace, configuration, paths, or arbitrary injected-work identity as metric attributes.
The possible future need to distinguish arbitrary-work plugins remains deferred until such a plugin
has concrete requirements. Do not add `@opentelemetry/api` to official plugin manifests unless that
plugin's own source imports it directly.

Exit gate: plugin output is equivalent, scope and parentage tests pass, and no public plugin
declaration exposes a removed telemetry contract.

### T12: Runtime integration, presentation, and legacy removal

Prerequisites: T11.

Scope:

- connect `WorkerTelemetrySession` to worker execution and finalize it after application resource
  disposal without changing the application result;
- transport the structured-clone-safe `ProfileReport` through worker and presentation boundaries;
- implement the declarative signal-separated profile view, known diagnostic reading order, plugin
  grouping, unknown fallback, partial/unavailable states, unit formatting, and quiet/success-only UX;
- remove the legacy local recorder, no-op implementation, custom instrumentation and span contracts,
  `ProfileSummaryEntry`, the `@gitlode/internal-foundation/instrumentation` export, old profile
  formatting, and stale tests; and
- update `profiling.md`, usage material, architecture/domain/plugin target markers, dependencies, and
  public package declarations to implemented state.

Exit gate: Phase 4 and Phase 5 acceptance are complete, repository-wide search finds no removed
contract, profile reports cross the worker boundary, and all CI-tier checks pass.

### T13: Performance, full verification, and handoff closure

Prerequisites: T12 and completed T00B fixture calibration and `legacy_off` artifacts.

Scope:

- run the complete cataloged functional, owner, fault, equivalence, volume, bounded-growth,
  wall-clock, RSS, report-size, architecture, type, lint, test, build, package, and format checks;
- compare target disabled performance with the frozen legacy baseline and target enabled with target
  disabled using the accepted paired protocol;
- investigate failures without silently relaxing thresholds or observations;
- record any explicitly reviewed exception with every required field; and
- migrate all remaining stable facts to durable documentation, remove transitional status text, and
  delete this handoff when no unfinished item remains.

Exit gate: Phase 6 acceptance passes or a trunk-reviewed exception is documented, no migration-only
code or note remains, and the trunk session confirms the redesign complete.

## Unit status

| Unit | Status   | Trunk review evidence                                                                                                                                                     |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T00A | complete | Frozen catalog validation and behavioral baselines reviewed; focused 21 tests pass                                                                                        |
| T00B | complete | Performance harness and test-scale workflows reviewed; focused 41 tests pass; reference calibration and legacy artifacts remain T13 prerequisites                         |
| T01  | complete | Generic OTel lifecycle and gitlode policy split reviewed; focused 128 tests pass; clean-environment architecture check passes                                             |
| T02  | complete | Shared metadata, profile contracts, normalization, and timing primitives reviewed; focused 31 and full 753 tests pass                                                     |
| T03  | complete | Extraction-side recorders, timing failure isolation, owner boundaries, and all 15 metric/no-op contracts reviewed; full 807 tests pass                                    |
| T04  | complete | Git and neutral DAG recorders, all 16 metric/no-op contracts, type boundaries, and owner tests reviewed; focused 216 and full 849 tests pass                              |
| T05  | complete | Bounded span and metric collection, diagnostics, catalog filtering, canonical report building, and all limit contracts reviewed; 886 tests pass                           |
| T06  | complete | Explicit providers, async root context, idempotent best-effort finalization, no-op degradation, and lifecycle fault isolation reviewed; 918 tests pass                    |
| T07  | complete | Execution setup and extraction owners migrated with explicit OTel context flow, bounded domain metrics, partial-effect semantics, and owner evidence; full 941 tests pass |
| T08  | pending  | —                                                                                                                                                                         |
| T09  | pending  | —                                                                                                                                                                         |
| T10  | pending  | —                                                                                                                                                                         |
| T11  | pending  | —                                                                                                                                                                         |
| T12  | pending  | —                                                                                                                                                                         |
| T13  | pending  | —                                                                                                                                                                         |

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
