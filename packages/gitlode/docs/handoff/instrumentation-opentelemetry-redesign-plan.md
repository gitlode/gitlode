# OpenTelemetry-Based Instrumentation Redesign Plan

## Status and Purpose

This document is the continuation plan for redesigning gitlode instrumentation around
OpenTelemetry. It replaces the deleted `instrumentation-opentelemetry-migration.md`.

The deleted plan and this plan are not successive phases of the same design. The deleted plan aimed
to preserve and adapt gitlode's custom `Instrumentation` contract. This plan instead makes
OpenTelemetry API contracts the primary contracts used by gitlode and limits gitlode-owned
instrumentation code to application-specific helpers, conventions, local profiling, and runtime
composition.

This is a handoff document for unfinished design and implementation work. As decisions are
implemented and become durable, move them into the relevant documents under `docs/design/` and
`docs/profiling.md`, then remove completed material from this handoff.

## Direction

The target direction is:

> Use OpenTelemetry API types and semantics as gitlode's instrumentation foundation. Do not maintain
> a parallel gitlode-specific tracing contract when OpenTelemetry already defines the relevant
> concept.

The important API contracts should come from `@opentelemetry/api`, including:

- `Tracer` and `Span` for tracing;
- `SpanOptions`, attributes, events, status, and context;
- `Meter` and its instruments for metrics;
- the OpenTelemetry no-op behavior used when no SDK is registered.

gitlode should own only behavior that is specific to its application and developer workflow, such
as:

- helpers that execute synchronous, asynchronous, and async-iterable work in spans;
- consistent exception recording, status, and span-ending behavior;
- stable gitlode span, metric, and attribute conventions;
- pre-created instruments and domain-oriented recording helpers;
- local `--profile` collection and summary generation;
- OpenTelemetry SDK composition, flushing, and shutdown at the CLI/worker boundary;
- policies for cardinality, detail level, sampling, and sensitive data.

This direction is motivated by more than future telemetry export. It avoids creating a new
application-specific telemetry contract for each product and allows tracing, metrics, context,
error semantics, and operational knowledge to transfer between products.

## Behavioral Guardrails

### Primary product output must not change

The instrumentation redesign must not change gitlode's primary product behavior: extracting Git
repository facts and writing JSONL output.

Instrumentation work must not intentionally or accidentally change:

- which commits or file changes are extracted;
- record counts, record values, or JSON schema;
- plugin-produced extension values;
- traversal, filtering, deduplication, range, or checkpoint semantics;
- JSONL serialization;
- error handling in a way that produces different partial or successful extraction output;
- output ordering beyond the ordering guarantees already documented by gitlode.

Telemetry is observational. Its configuration, absence, internal failure, sampling decision, or
export failure must not alter extraction results. Enabling or disabling local profiling or future
external export must not select a different extraction path.

Every implementation phase must include regression verification that JSONL output and extraction
results remain unchanged for representative commit-level, file-level, incremental, adapter, and
plugin scenarios.

### `--profile` is intentionally outside the stable output guardrail

`--profile` and its stderr output are not part of the primary product-output compatibility
requirement.

Profiling is a developer diagnostic facility rather than a primary end-user feature. The
instrumentation redesign may therefore change:

- which operations are measured;
- whether a value comes from a span, metric, or derived local aggregation;
- profile row names and grouping;
- displayed columns and details;
- the textual output format.

Such changes must still be purposeful consequences of the instrumentation design. This exception
does not authorize arbitrary profile churn.

The redesigned profile must continue to help developers investigate more than total runtime. It
must provide useful evidence for:

- locating performance bottlenecks;
- comparing the cost of extraction phases and repeated operations;
- separating Git access, traversal, diff, projection, plugin, and output costs where practical;
- evaluating traversal and other algorithm efficiency;
- comparing operational work such as reads, cache hits, expansions, skipped work, and yielded
  results;
- explaining meaningful low-cardinality execution decisions and fallback paths.

The exact measurements and presentation may evolve, but this diagnostic purpose must be preserved.

### Telemetry must not become a runtime prerequisite

- gitlode must continue to run when no OpenTelemetry SDK is installed or registered.
- Local `--profile` must not require an external collector.
- Future external export must be opt-in.
- Export failures must not fail extraction.
- The redesign must not require network access for normal execution or local profiling.

## Current Implementation

The current `packages/gitlode/src/instrumentation` domain contains both contracts and
implementations:

- `type.ts` defines `Instrumentation`, `InstrumentationSpan`,
  `ActiveInstrumentationSpan`, attributes, local records, and profile summaries;
- `noop.ts` supplies gitlode-specific no-op objects;
- `local-recorder.ts` records all ended local spans and aggregates them by name;
- `utils.ts` instruments async-iterable consumption;
- `index.ts` exports both contracts and implementations through one barrel.

Worker execution selects `LocalInstrumentationRecorder` only when profiling is enabled and otherwise
uses `noopInstrumentation`. The resulting object is passed through execution, extraction, DAG,
Git implementations, and plugin runtime. On successful execution, a profile summary crosses the
worker boundary and presentation renders it to stderr.

The plugin API also exposes `Instrumentation` and `InstrumentationSpan`, so the current custom
contract is already part of the prerelease plugin-facing surface.

### Current measurement patterns

Current call sites contain three different kinds of observations:

1. Logical operation lifetimes:
   - `gitlode.run`;
   - planning, extraction, traversal, and projection;
   - Git walks and Git CLI process/session lifetimes;
   - DAG traversals.
2. High-frequency leaf-operation timings:
   - per-commit processing;
   - per-record projection and output writes;
   - blob reads and diff calculations.
3. Work and decision details attached to a span:
   - records, commits, changes, bytes, reads, and cache hits;
   - DAG steps, expansions, certification, stale work, and yielded nodes;
   - selected strategies, results, termination reasons, and fallback reasons.

The current local recorder presents all three through a span-shaped model, even where a metric or a
final span attribute would be more appropriate.

### Current model is not an OpenTelemetry trace

Although the current API resembles tracing, it does not record:

- trace or span identifiers;
- parent-child relationships;
- active context;
- span kind, links, or sampling state;
- OpenTelemetry status or exception events;
- instrumentation scope.

The local result is a flat collection aggregated primarily by span name. Nested execution in source
code does not create a trace tree.

## Assessment of the Current Contracts

### `Instrumentation` versus `Tracer`

`Instrumentation.run()` and `runAsync()` automatically end a local span and record a thrown error.
OpenTelemetry `Tracer.startActiveSpan()` activates context but deliberately leaves ending the span
to the callback.

gitlode still needs convenience helpers, but those helpers should accept and return OpenTelemetry
types instead of defining a second tracing interface. Likely helpers include:

```ts
withSpan(tracer, name, callback, options?)
withAsyncSpan(tracer, name, callback, options?)
instrumentAsyncIterable(tracer, name, factory, options?)
recordSpanError(span, error)
```

Exact signatures remain an implementation decision. The helpers must preserve callback return
types and rethrow application errors after recording them.

### `ActiveInstrumentationSpan` versus `Span`

The current `ActiveInstrumentationSpan.end(error?: unknown)` is incompatible with OpenTelemetry.
OpenTelemetry `Span.end()` accepts an optional end timestamp, not an error.

A mechanical type replacement could accidentally pass an `Error` as a timestamp. Migration must
replace every error-ending path with:

1. normalize the thrown value into a form accepted by OpenTelemetry;
2. call `span.recordException(...)`;
3. set `SpanStatusCode.ERROR` with a predictable description policy;
4. call `span.end()`;
5. rethrow the original application error.

Successful instrumentation normally should leave status unset rather than setting `OK`
automatically. User-input termination, expected fallback, and runtime failure need an explicit
status policy.

### `InstrumentationOptions` versus `SpanOptions`

The current options carry only initial attributes. OpenTelemetry already defines initial
attributes, span kind, links, start time, and root-span behavior through its API types.

gitlode helpers should use `SpanOptions` rather than a reduced copy. Application conventions may
restrict which options normal call sites use, but the type contract should remain OpenTelemetry's.

### No-op behavior

`@opentelemetry/api` already behaves as a no-op when no compatible SDK is registered. A separate
`NoopInstrumentation` should not remain unless a concrete test-only or composition requirement
cannot be met through the OpenTelemetry API.

### Local recorder

The current recorder implements gitlode's reduced span interface directly and stores every span
until the run completes. Reimplementing the full OpenTelemetry `Span` interface would still risk
diverging from SDK semantics.

The preferred direction is to create real OpenTelemetry spans and collect completed SDK span data
through a local processor/exporter designed for `--profile`. Local metrics may similarly require a
reader or a deliberately scoped local aggregation path.

The local profile remains independent of an external collector. Local collection and external
export should be composed through OpenTelemetry SDK mechanisms rather than a custom
`CompositeInstrumentation` contract.

## Trace Context and Async Execution

Context propagation is a semantic change, not merely a type change.

The root `gitlode.run` span should be active while run work executes so phase, Git, DAG, and plugin
spans can become descendants. Node SDK/context-manager initialization must occur early enough for
worker-side instrumentation.

Direct `Tracer.startSpan()` does not activate the returned span. Use it only where manual lifetime
management is required, and pass or activate the correct context explicitly.

### Async iterables

Async iterables are a critical design area because creating an iterator usually does not execute
its body.

The current helper measures consumption rather than factory creation, which is necessary, but its
replacement must also handle:

- normal exhaustion;
- an exception from the source or consumer-facing iterator operation;
- early consumer `break` or `return`;
- explicit iterator `throw`;
- activating the intended span context while `next()`, `return()`, and `throw()` execute;
- ending the span exactly once on every completion path.

The current helper does not use `finally` around span lifetime, so early consumer cancellation can
leave a span unended. This must be fixed as part of the redesign and covered by tests.

Long-lived pipeline spans include time suspended while downstream consumers perform work. That can
be useful as logical wall-clock lifetime, but it is not exclusive compute time. The design must
label and document this distinction rather than treating nested durations as additive.

## Traces and Metrics

The current `incrementCounter(name, delta)` has no direct `Span` equivalent. Do not mechanically
translate every call to an OpenTelemetry Counter.

Each observation must be classified according to its meaning.

### Keep primarily as spans

Use spans for bounded logical operations where causal structure, duration, status, and child work
are useful:

- the overall extraction run;
- planning and extraction phases;
- traversal operations;
- significant Git commands and long-lived Git sessions;
- plugin initialization and other meaningful top-level plugin operations;
- uncommon fallback or recovery operations when their duration and context matter.

Phase duration may also be emitted as a metric later when cross-run aggregation is useful, but the
span remains the primary causal representation.

### Prefer counters

Use monotonic counters for quantities whose sum or rate is meaningful across operations or runs:

- commits traversed and records written;
- file changes expanded;
- blobs or Git objects read;
- blob and output bytes;
- diffs computed and skipped;
- cache hits;
- plugin projections;
- DAG successor expansions, traversal steps, stale steps, yielded nodes, and fallback occurrences.

Counter names and dimensions must be pre-defined. Dynamic local names such as purpose-specific read
names or file status names should generally become one instrument with low-cardinality attributes.

Current counters sometimes record the same logical value on both `gitlode.extract` and
`gitlode.run`. A direct mapping to one metric would double-count it. Every metric must have one
defined recording owner.

### Prefer histograms

Use histograms for distributions where producing a span for every observation would be noisy:

- blob-read duration and blob size;
- diff duration;
- output-write duration and record size;
- projection duration;
- per-commit processing duration;
- commit or file counts per run when that distribution is useful.

High-frequency leaf spans may remain available under a deliberate detailed trace/profile policy,
but should not automatically create unbounded exported trace volume.

### Prefer span attributes

Use span attributes for low-cardinality inputs, decisions, and final operation results:

- adapter and traversal strategy;
- granularity and range kind;
- object format;
- result and termination reason;
- fallback reason;
- configured or resolved input size when it explains a particular operation.

Counts such as refs, plans, or configured plugins describe the input to one operation. They are not
automatically monotonic counters. They may be span attributes or histograms depending on the
question being answered.

### Record in both signals only for distinct questions

Some work counts are useful in both places:

- a final span attribute explains one specific traversal;
- a metric counter supports aggregation across traversals or runs.

Dual recording is acceptable only when both questions are explicit. Domain-oriented helpers should
perform the dual recording so call sites do not drift or double-count.

### Cardinality and sensitive data

Default spans and metrics must avoid unbounded or sensitive dimensions such as:

- commit OIDs;
- file paths;
- author names or email addresses;
- repository-local identifiers with uncontrolled cardinality.

If detailed local diagnosis later requires these values, it needs a separate, explicit policy that
does not silently export them.

## Trace Volume and Performance

Current profiling creates repeated spans for commit processing, projection, output writes, blob
reads, and diffs. On a large repository this creates memory and export volume proportional to the
number of records and files.

The redesign must decide which repeated observations are:

- always-on metrics;
- normal trace spans;
- detailed local-profile spans;
- sampled/exported spans;
- events or final attributes on a containing span.

Instrumentation overhead must remain bounded and must not invalidate the performance behavior being
measured. Verification should include large or synthetic repositories, not only unit fixtures.

## Runtime and Package Boundaries

### API dependency

`@opentelemetry/api` should be the dependency visible to instrumented core and plugin contracts. It
must be declared in a way that keeps generated plugin declarations usable by consumers.

SDK and exporter packages are implementation dependencies and should not leak into lower-level
contracts. Exact package placement must be decided together with the ongoing package/domain design.

### Domain boundary

The current domain design keeps contracts, helpers, local recording, and profile summary in one
`instrumentation` domain until a concrete boundary appears. The redesign creates that boundary:

- plugin and core consumers require stable OpenTelemetry API contracts and lightweight helpers;
- local profiling requires SDK data, aggregation, and run lifecycle;
- external export adds optional configuration, resources, processors/readers, and shutdown;
- presentation consumes a local diagnostic result but should not depend on SDK internals.

Before moving source files, update the canonical domain charter and dependency allowlist. A likely
shape separates API-based instrumentation helpers and conventions from local profile collection,
but final names and exact top-level domains remain open until their dependency envelopes are
written.

### Plugin instrumentation scope

Replacing the plugin-facing custom contract is allowed during prerelease development, but plugin
JSONL projection output must remain unchanged.

The redesign must decide whether plugin runtime receives:

- a plugin-specific `Tracer` and `Meter`;
- providers or factories from which scoped instances are obtained;
- a small gitlode context object whose tracing and metrics members use OpenTelemetry types.

Plugins should have distinct instrumentation scope names and versions where possible. Official
plugins should initially instrument meaningful top-level work and avoid per-fact trace volume by
default.

### Worker and shutdown lifecycle

The SDK must be initialized in the process that creates spans and metrics. gitlode currently
performs extraction in a worker, so configuration and ownership must reflect that boundary.

Short-lived CLI execution cannot rely only on periodic export. Successful, user-error, runtime-error,
and disposal paths must define:

- when Git resources are closed;
- when the root span ends;
- when the local profile snapshot is taken;
- when trace and metric providers are flushed;
- when SDK resources are shut down;
- how export failures are isolated from extraction results.

## Profile Requirements During Migration

The current profile format is not a compatibility constraint, but migration should not temporarily
reduce it to total elapsed time.

At each useful implementation milestone, local profiling should retain enough information to
compare:

- overall and phase durations;
- Git traversal and object-access cost;
- file-level blob-read and diff cost;
- projection and output cost;
- repeated-operation counts or distributions;
- DAG and traversal algorithm work;
- selected strategies and fallback/termination decisions;
- error counts where relevant.

Some details may move between table columns, span attributes, metric summaries, or separate
sections. The format should remain deterministic enough for developer comparison, but it need not
be a stable machine-readable contract.

## Migration Plan

### Phase 0: Establish durable contracts and baselines

1. Update `docs/design/architecture.md` to remove stale `StageProfiler`, `wallMs`, and `workMs`
   descriptions and define the accepted OpenTelemetry-based direction.
2. Update `docs/design/domain-design.md` with the accepted contract/implementation boundary before
   moving source.
3. Record a complete inventory of current spans, attributes, and counters with their semantic
   owners.
4. Classify every current counter as:
   - span attribute;
   - OpenTelemetry Counter;
   - Histogram;
   - event;
   - local-profile-only derived detail;
   - removal because it does not answer a useful question.
5. Establish functional regression fixtures for commit, file, incremental, Git adapter, and plugin
   JSONL output.

Acceptance:

- durable docs no longer describe the removed profiler design;
- every existing observation has a proposed destination or explicit removal rationale;
- representative JSONL output is captured before instrumentation changes.

### Phase 1: Introduce OpenTelemetry API and lifecycle helpers

1. Add `@opentelemetry/api` at the correct package boundary.
2. Implement sync, async, error, and async-iterable helpers using `Tracer`, `Span`, and
   `SpanOptions`.
3. Define span error/status policy.
4. Add tests for:
   - sync success and failure;
   - async success and failure;
   - nested active context;
   - manual span lifetime where required;
   - async-iterable normal completion;
   - source failure;
   - early cancellation;
   - `return()` and `throw()`;
   - exactly-once span ending.
5. Do not add external exporters in this phase.

Acceptance:

- helpers expose OpenTelemetry types rather than copied interfaces;
- no unended spans in tested completion paths;
- no JSONL or extraction-result changes.

### Phase 2: Build local profile collection on OpenTelemetry semantics

1. Replace direct custom span implementation with local SDK collection.
2. Aggregate completed spans for developer profile output.
3. Add the minimum metric collection or transitional derived details needed to preserve useful
   diagnostics.
4. Keep local collection deterministic and collector-free.
5. Bound memory where possible; do not retain more per-span data than the final profile needs.
6. Update `docs/profiling.md` for intentional measurement or output changes.

Acceptance:

- `--profile` still supports bottleneck and algorithm-efficiency investigation;
- local profiling does not require network access or an external collector;
- profile enablement does not change JSONL output;
- disabled profiling uses OpenTelemetry no-op behavior without a gitlode tracing contract.

### Phase 3: Migrate core and plugin call sites

1. Replace `Instrumentation` and `InstrumentationSpan` dependencies with OpenTelemetry types and
   gitlode helpers.
2. Make the run span active across worker execution.
3. Verify parent-child structure through execution, extraction, Git, DAG, and plugin paths.
4. Replace `end(error)` call sites with the defined exception/status helper.
5. Update the prerelease plugin API and official plugins.
6. Preserve plugin projection behavior and JSONL extension output.
7. Remove custom no-op and contract types when no consumers remain.

Acceptance:

- source call sites no longer rely on the custom tracing contract;
- trace hierarchy and error semantics are verified;
- official plugin output remains unchanged;
- complete JSONL regression suites pass with profile off and on.

### Phase 4: Introduce metrics deliberately

1. Define stable metric names, descriptions, units, owners, and allowed attributes.
2. Pre-create instruments rather than creating them dynamically in hot paths.
3. Replace current generic counter calls according to the inventory.
4. Move high-frequency duration observations to histograms where appropriate.
5. Retain detailed spans only where their causal value justifies their volume.
6. Teach local profile aggregation to present the resulting useful measurements.

Acceptance:

- no metric has multiple recording owners or known double counting;
- metric attributes follow the cardinality policy;
- traversal and adapter efficiency diagnostics remain available;
- instrumentation overhead is measured on representative workloads;
- JSONL output remains unchanged.

### Phase 5: Add optional external export

1. Decide supported configuration, initially preferring standard OpenTelemetry environment
   conventions where they fit the CLI.
2. Add SDK/exporter composition at the application boundary.
3. Support local-only, export-only, combined, and neither modes.
4. Implement flush and shutdown for the worker and short-lived CLI.
5. Isolate SDK/exporter failures from extraction.
6. Document privacy, cardinality, and operational expectations.

Acceptance:

- external export is opt-in;
- local `--profile` remains collector-free;
- all four composition modes are tested;
- export failures do not change exit result or JSONL output;
- successful CLI termination flushes configured signals within a documented policy.

### Phase 6: Consolidate documentation and remove the handoff

1. Move final architecture, domain, plugin, profiling, and configuration contracts into their
   canonical documents.
2. Remove transitional adapters and unused compatibility code.
3. Delete this handoff when no unfinished design or implementation work remains.

## Verification Matrix

Every phase that changes runtime code should cover at least:

| Scenario                                       | Telemetry mode           |
| ---------------------------------------------- | ------------------------ |
| Commit extraction                              | off and local profile    |
| File extraction, including skipped diff paths  | off and local profile    |
| Incremental extraction and checkpoint handling | off and local profile    |
| Isomorphic-git adapter                         | off and local profile    |
| Git CLI adapter and process disposal           | off and local profile    |
| Built-in projection                            | off and local profile    |
| Official plugin projection                     | off and local profile    |
| User error and runtime exception               | off and local profile    |
| Early async-iterator cancellation              | local collection test    |
| Future exporter failure                        | export-only and combined |

For functional cases, compare extraction results and JSONL output independently of profile stderr.
Profile assertions should verify diagnostic intent rather than freeze incidental formatting unless a
specific format is deliberately documented.

## Open Design Questions

The following details require further discussion before or during their corresponding phase:

1. Exact source-domain and future package split for API helpers, local profile collection, SDK
   composition, and presentation data.
2. Whether plugin runtime receives scoped `Tracer`/`Meter` instances or an API-typed gitlode
   telemetry context.
3. The exact async-iterable context strategy across iterator methods.
4. Which high-frequency operations remain spans in normal mode.
5. Whether local profile uses a metric reader immediately or temporarily derives selected work
   details from ended spans during migration.
6. The stable naming scheme and units for custom gitlode metrics.
7. Whether detailed local profiling and exported tracing use separate detail policies.
8. User-error status policy and which failures should set span status to `ERROR`.
9. How much span or metric data may be retained in memory for very large repositories.
10. External export configuration and shutdown timeout policy.

These questions may refine the implementation, but they must not reverse the accepted direction:
OpenTelemetry owns the primary telemetry contracts, gitlode owns application-specific support, and
instrumentation must not change JSONL extraction output.

## Do Not

- Do not preserve the current `Instrumentation` contract merely as an adapter-shaped public API.
- Do not treat matching method names as semantic compatibility with OpenTelemetry.
- Do not pass errors to OpenTelemetry `Span.end()`.
- Do not create spans without a context and lifetime policy.
- Do not instrument only async-iterator factory creation when work occurs during consumption.
- Do not leave spans open on consumer cancellation.
- Do not map every current local counter mechanically to an OpenTelemetry Counter.
- Do not export unbounded or sensitive attributes by default.
- Do not create a span per commit or file by default without measuring volume and overhead.
- Do not make local profile depend on an external collector.
- Do not allow telemetry or exporter failure to affect JSONL output.
- Do not change extraction logic as part of instrumentation cleanup.
- Do not preserve profile formatting at the expense of a correct telemetry design.
