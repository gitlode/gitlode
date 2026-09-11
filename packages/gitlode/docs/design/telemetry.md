# Telemetry Design

## Status

This document defines the accepted target design for gitlode telemetry. The OpenTelemetry migration
is not yet implemented, so source code and [`../profiling.md`](../profiling.md) still describe the
current custom instrumentation in places. Implementation work must converge on this document rather
than preserve those transitional contracts.

The migration status, branch-sized work plan, and remaining design gates are tracked in
[`../handoff/instrumentation-opentelemetry-redesign-plan.md`](../handoff/instrumentation-opentelemetry-redesign-plan.md).
The verification contract for the migration is defined in
[`telemetry-verification.md`](telemetry-verification.md).
Performance acceptance is defined in [`telemetry-performance.md`](telemetry-performance.md).

## Purpose and scope

gitlode uses telemetry to diagnose extraction performance and algorithm behavior without changing
the facts it extracts. OpenTelemetry API contracts are the primary contracts for tracing, metrics,
attributes, context, status, and no-op behavior.

gitlode owns only application-specific telemetry behavior:

- helpers for bounded synchronous, asynchronous, and async-iterable operations;
- span, metric, attribute, and instrumentation-scope conventions;
- domain-oriented metric recorders and recording ownership;
- local `--profile` collection and its serializable report;
- worker-side SDK composition, finalization, and failure isolation; and
- bounded collection and presentation policies.

This migration does not implement external export. A future external destination may replace local
collection, but local collection and external export are intentionally not designed for concurrent
use.

## Behavioral invariants

Telemetry is observational. Its configuration, absence, internal lifecycle failure, or collection
limit must not change:

- extracted facts, records, JSON schema, or JSONL serialization;
- traversal, filtering, range, deduplication, or checkpoint semantics;
- plugin-produced extension values;
- output ordering guarantees;
- application result classification or exit behavior; or
- disposal of application-owned resources.

Enabling profiling must not select a different extraction path. Representative JSONL output must
be compared with profiling disabled and enabled throughout the migration.

The profile display itself is not a stable machine-readable format. Its durable requirement is to
retain useful diagnostic evidence for phase cost, Git access, traversal efficiency, diff and blob
work, projection, plugins, output, fallback decisions, and errors. Detailed compatibility with the
current table is not a goal.

## API boundary

Instrumented code uses types from `@opentelemetry/api` directly:

- `Tracer` and `Span` for tracing;
- `SpanOptions`, `Context`, attributes, events, and status;
- `Meter`, `Counter`, and `Histogram` for metrics; and
- OpenTelemetry no-op behavior when profiling is disabled.

gitlode must not retain reduced copies of these contracts or a custom no-op tracing abstraction.
OpenTelemetry SDK types, providers, processors, readers, exporters, and context-manager
implementations must not appear in product, adapter, DAG, or plugin contracts.

Domain-specific metric recorders are permitted. They express application observations and own
pre-created instruments; they are not replacements for the OpenTelemetry metrics API.

## Instrumentation scopes

Core scopes are stable, low-cardinality identifiers:

- `gitlode.execution`
- `gitlode.extraction`
- `gitlode.dag`
- `gitlode.git`
- `gitlode.line_diff`
- `gitlode.plugin_runtime`

A plugin receives a tracer and meter scoped to its package name and version when available. If a
stable package name cannot be resolved, the host uses a bounded fallback of
`gitlode.plugin.<namespace>`. Registering the same package under multiple namespaces intentionally
uses the same package scope. Namespace must not be added as a metric attribute solely to
distinguish those registrations.

## Tracing helpers

The generic `otel-support` domain supplies OpenTelemetry lifecycle mechanisms rather than a gitlode
tracing interface:

```ts
withSpan(tracer, name, callback, options?, parentContext?)
withAsyncSpan(tracer, name, callback, options?, parentContext?)
recordSpanError(span, error)
createAsyncIterableInstrumenter(onCompletion)
```

`withSpan` accepts only synchronous callbacks at the type level. `withAsyncSpan` preserves the
resolved value or the original rejection. Both use active context, end the span exactly once, and
preserve the identity of a value returned or thrown by application code.

`recordSpanError` records error semantics but does not end the span. Successful operations normally
leave status unset rather than setting `OK` automatically.

`otel-support` exports an `AsyncIterableCompletion` union and
`createAsyncIterableInstrumenter(onCompletion)`. The returned generic instrumenter owns iterator
lifecycle, serialization, active context, error recording, and exactly-once ending. It reports a
protocol-neutral completion to the injected callback and contains no attribute name or other
gitlode policy.

```ts
type AsyncIterableCompletion = "exhausted" | "cancelled" | "handled_throw" | "error";

interface InstrumentAsyncIterable {
  <T>(
    tracer: Tracer,
    name: string,
    factory: (span: Span) => AsyncIterable<T>,
    options?: SpanOptions,
    parentContext?: Context,
  ): AsyncIterable<T>;
}

createAsyncIterableInstrumenter(
  onCompletion: (span: Span, completion: AsyncIterableCompletion) => void,
): InstrumentAsyncIterable;
```

The gitlode-specific `telemetry` domain constructs and exports `instrumentAsyncIterable` by passing
a completion callback that records `STREAM_COMPLETION_ATTRIBUTE`. This thin binding preserves the
public helper signature below while keeping its state machine in `otel-support`. Its source imports
the typed factory and `InstrumentAsyncIterable` from the foundation export, not
`@opentelemetry/api` directly.

### Error and status policy

- An unexpected runtime exception is recorded with `recordException` and `ERROR` status.
- A typed application/user failure is represented by `ERROR` status without pretending that a
  runtime exception occurred.
- Expected fallback and cancellation leave status unset and use bounded attributes or events.
- Raw exception messages are not copied into status descriptions.
- Unknown thrown values are normalized safely for exception recording, while the original value is
  rethrown.
- Nested spans that independently fail may each record the exception; parent aggregation must not
  assume only the leaf records it.

Helpers do not attempt to catch every possible defect in an arbitrary OpenTelemetry API
implementation. The gitlode-owned SDK lifecycle and collectors provide the failure boundary defined
below.

## Async-iterable span semantics

`instrumentAsyncIterable` measures consumption, not iterator factory creation.

Its target signature is:

```ts
instrumentAsyncIterable<T>(
  tracer: Tracer,
  name: string,
  factory: (span: Span) => AsyncIterable<T>,
  options?: SpanOptions,
  parentContext?: Context,
): AsyncIterable<T>
```

- Each iterator instance owns an independent span.
- No span is started until the first `next()` call.
- An explicit `parentContext` is used for that iterator. When it is omitted, the helper reads the
  active context at the first `next()` invocation, not when the wrapper or iterator is constructed.
- The first `next()` starts the span before obtaining the source iterator and invokes both iterator
  acquisition and the source `next()` under that span's active context.
- If the first `next()` returns `done: true`, one bounded span is emitted with `exhausted`
  completion. OpenTelemetry API spans are not retroactively discarded after the result is known.
- If obtaining the iterator or the first `next()` throws, the error is recorded on that span, the
  span ends with `error` completion, and the original thrown value is propagated.
- `return(value)` before the first `next()` does not obtain the source iterator or emit a span and
  resolves to `{ value, done: true }`. `throw(value)` before the first `next()` likewise emits no
  span, does not obtain the source iterator, and rejects with the original value.
- Source `next()`, `return()`, and `throw()` calls execute under the span context.
- Downstream consumer work does not inherit that span as its active parent.
- The span remains open across waits between iterator calls. Its duration is logical wall-clock
  lifetime, not exclusive source compute time.
- Iterator method calls are serialized in their call order.
- Iterator results are validated as objects and the span ends exactly once.

Terminal completion is recorded with one of:

- `exhausted`
- `cancelled`
- `handled_throw`
- `error`

A `return()` that yields `done: false` keeps the span open but records cancellation intent; its
eventual terminal state is `cancelled`. A handled `throw()` may continue when it returns
`done: false`. If the source has no `throw()`, the wrapper first attempts `return()` cleanup and then
throws the required `TypeError`.

## Signal selection

### Spans

Use spans for bounded logical operations whose causal structure, duration, status, and child work
are useful. Normal traces include run and phase boundaries, logical streams, significant Git
commands or sessions, DAG traversals, and plugin initialization.

Normal instrumentation must not create application-level leaf spans merely because one commit,
file, record, blob, diff, or plugin projection was processed. In particular, per-record projection,
per-output-write, per-blob, per-diff, and per-commit file-change spans are removed rather than
retained only for local profiling. A cataloged external command may still have one span per actual
command invocation when command causality and failure information justify that volume; these cases
must be explicit and covered by volume measurements.

### Counters

Use counters for non-negative additive work whose total or rate is meaningful. Every counter has
one recording owner. Zero is normally not recorded; a catalog entry may explicitly require zero
when distinguishing "applicable with no work" from "not applicable" is diagnostically important.

### Histograms

Use histograms for high-frequency duration, size, and per-operation count distributions. Raw
samples are not retained by the local profiler. Explicit bucket boundaries are part of the metric
catalog.

### Span attributes and events

Use attributes for bounded inputs, decisions, strategies, and terminal results that explain one
operation. Use events for uncommon bounded decisions such as fallback. Sensitive or unbounded
values must not be recorded by default.

The same value may appear as a final span attribute and a metric only when the two signals answer
distinct questions: one operation's explanation and aggregation across operations or runs.

## Observation catalog rules

Structured observation definitions live beside this document:

- [`telemetry-catalog/attributes.yaml`](telemetry-catalog/attributes.yaml) owns attribute keys,
  types, permitted values, and local-profile reducers;
- [`telemetry-catalog/spans.yaml`](telemetry-catalog/spans.yaml) owns span names, scopes, owners,
  parent policy, lifetime, attributes, status, and cardinality;
- [`telemetry-catalog/metrics.yaml`](telemetry-catalog/metrics.yaml) owns instruments, recording
  points, units, attributes, outcomes, zero policy, and histogram buckets;
- [`telemetry-catalog/profile-report.yaml`](telemetry-catalog/profile-report.yaml) owns the
  structured-clone report fields, signal status, aggregate invariants, diagnostics, limits, and
  canonical collection order; and
- [`telemetry-catalog/profile-view.yaml`](telemetry-catalog/profile-view.yaml) owns profile grouping,
  labels, preferred reading order, and unknown-observation fallback.

Markdown remains canonical for rationale, cross-cutting behavior, and policies that are better read
as prose. YAML is canonical for repetitive structured definitions. The same field must not be
maintained independently in both forms; prose refers to catalog IDs when an exact structured entry
exists.

The YAML files are design contracts, not runtime configuration. Production code does not parse them
at startup. Implementation metadata is checked against the catalogs during tests; code generation
is not introduced unless a later concrete need justifies it.

The complete observation catalog remains a design gate tracked by the handoff. Each metric entry
must define:

- name, instrument kind, description, and unit;
- instrumentation scope and operation owner;
- exact recording point and aggregation interval;
- permitted attributes and values;
- terminal outcomes and zero-recording policy;
- local-profile presentation intent; and
- histogram bucket boundaries where applicable.

Metric names use lowercase dot-separated names of the form
`gitlode.<domain>.<operation>.<measurement>`. They do not use `_total`, encode units in the name, or
create dynamic names for adapters, strategies, purposes, or outcomes.

Units use UCUM-compatible values, including:

- `s` for duration;
- `By` for bytes; and
- annotations such as `{commit}`, `{record}`, `{object}`, `{change}`, `{node}`, `{step}`, or
  `{expansion}` for counts.

Counters are non-negative and additive. Histograms represent distributions. Gauge and
UpDownCounter instruments are not introduced by this migration.

Attributes use namespaced keys and bounded enumerations. OIDs, file paths, repository paths, URLs,
refs, people, email addresses, raw errors, and arbitrary configuration values are forbidden. The
maximum theoretical attribute combination count for one metric must not exceed 128.

Shared identifiers and collection policy live in the observation and attribute catalogs. The
collector does not contain operation-specific knowledge. Domain recorders own when and how values
are recorded, while the profile-view catalog owns grouping, labels, and preferred display order.

## Accepted observation inventory

The following inventory fixes signal selection and ownership. Exact metric identifiers,
descriptions, attribute sets, and buckets remain to be normalized in the complete catalog.

### Execution and extraction

- `gitlode.run` is the execution-owned root span. It includes application resource disposal and
  records bounded run inputs and the terminal result.
- `gitlode.extract` is owned by the extraction pipeline and covers planning through output close and
  extraction result construction, but not checkpoint persistence.
- Planning remains a bounded span owned by the traversal planner.
- Commit traversal and projection are logical-stream spans. Explicit parent context makes them
  siblings under extraction rather than accidental children of whichever iterator pull triggered
  them.
- Unique deduplicated commits are counted by the extraction pipeline.
- Successful output records are counted by the pipeline after `OutputSink.write()` resolves.
- Per-write duration is a histogram; output bytes and files are counted by the concrete writer.
- Output close remains a bounded span.

### Git adapters

- Common port operations use common span names for ref resolution/classification, repository object
  format, remote URL resolution, and merge-base computation. Adapter is a bounded attribute.
- Commit walk is a logical-stream span with adapter, strategy, exclusion, and completion details.
- Raw commits yielded by an adapter are counted separately from extraction's unique deduplicated
  commit count.
- Git CLI `rev-list` and commit-batch work are child spans beneath commit walk. Isomorphic Git DAG
  traversal is likewise a child rather than a competing walk span.
- Materialized object responses, cache lookups, and cache hits are counters with bounded type and
  purpose attributes.
- File changes yielded are counted with a bounded change-type attribute.
- Git CLI `diff-tree` remains a bounded command span.
- Blob-read duration and size are histograms; completed object and byte quantities are counters.
- A repository-scoped persistent Git CLI blob-batch session remains a run child because it crosses
  multiple file streams.
- Per-commit file-blob-change streams and individual blob reads are not normal spans.

### DAG traversal

- Algorithm internals do not depend on `Span` or other OpenTelemetry API types. An operation-local,
  SDK-independent DAG measurement accumulates common work and is reported once by the facade,
  including completed partial work on cancellation or failure.
- The facade owns the logical traversal span and reports the operation-local measurement once at
  termination. Common metrics cover completion, processed and stale steps, successor expansions by
  role, yielded and fully collected excluded nodes, fallback selection, and candidates removed by
  fallback. Completed partial work is retained on cancellation and failure; zero work counters are
  omitted while every started operation records one completion.
- Difference traversal uses `gitlode.dag.traversal`; its active parent in normal isomorphic Git
  extraction is `gitlode.git.commit.walk`. The generic DAG API does not encode that Git-specific
  relationship or require an explicit parent `Context` argument.
- Expected fallback leaves span status unset and uses a bounded certification result, fallback
  reason, one fallback event, and a counter.
- Phase-certified state-machine counters such as closure phases, certification classifications, and
  yield-source splits are removed without an initial OpenTelemetry replacement. They are protected
  by exact synthetic topology and measurement tests rather than being retained as span attributes or
  unstructured profile details. Add them later only through an explicitly reviewed experimental
  catalog slice if operational profiling requires them.
- Standalone certified-closure and reachable facades own `gitlode.dag.certified_closure` and
  `gitlode.dag.reachable`. The corresponding core work nested inside a larger traversal contributes
  to the outer measurement instead of emitting a duplicate span and metric set.
- Closure phases, successor expansions, frontier operations, and per-node work do not emit spans.
  Node IDs, domain hints, frontier contents, timestamps, and topology are not attributes.

### File expansion, diff, projection, and output

- The expander records one end-to-end duration for each commit's file-change expansion. The
  duration begins before the adapter change iterator is requested and ends after all changes are
  built or the expansion fails. It includes adapter change discovery, blob access, guards, and
  line-diff work, but excludes downstream projection and output.
- Successfully built file-change facts are counted by bounded change type, including facts whose
  diff was skipped. A changes-per-commit histogram is recorded only after successful iterator
  exhaustion and includes zero-change commits; failed partial batches do not enter that
  distribution.
- Diff skip reason is bounded to size or binary, with the size guard taking precedence when both
  could apply.
- Concrete line-diff implementations record outcome count, duration, and the combined byte size of
  the before and after inputs once per computation attempt. They do not emit a span per diff or
  require telemetry through the `LineDiffCalculator` port.
- A concrete line-diff implementation returning normally is a successful implementation attempt.
  If the expander's subsequent defensive contract validation rejects that result, the containing
  expansion records an error; it does not retroactively rewrite the implementation-owned metric.
- Built-in projection records pure fact-to-record mapping duration by bounded fact type and
  outcome. It excludes upstream iterator wait, plugin enrichment, downstream consumer wait, and
  output serialization. The duration histogram's count is the built-in operation count, so there is
  no duplicate projection-operation counter or per-record span.
- A built-in mapping that returns normally remains successful if later plugin enrichment or output
  fails. Dispatch of a contract-invalid unknown fact is represented by the outer projection span
  error and does not invent an uncataloged fact-type metric series.
- The extraction pipeline records end-to-end `OutputSink.write()` duration and successful call
  count without a span per write. Duration includes concrete sink serialization, file open and
  write, and any rotation close performed before the call settles.
- The concrete writer counts files after successful output-segment open and bytes after each
  successful underlying write. These completed I/O effects remain recorded if a later rotation
  close or run operation fails, while the pipeline's successful-record counter requires the whole
  sink call to resolve.
- Output paths, filenames, sequence numbers, and record contents are not metric attributes. The
  initial catalog does not add a constant output-format attribute while JSONL is the only concrete
  format.
- Final `OutputSink.close()` remains a bounded span. Separate close-duration, rotation-count,
  file-I/O-duration, and flush-count metrics are not included initially.

### Plugins

- The host keeps one bounded bootstrap span and one `gitlode.plugin.init` span for each resolved
  plugin registration. It does not create an aggregate initialize child span.
- Per-plugin initialization spans use the same plugin instrumentation scope supplied through the
  runtime context and the explicit bootstrap context as parent. Concurrent Promise scheduling does
  not determine their parent.
- Plugin init `ready` leaves status unset; a returned fatal result sets `ERROR` without an exception;
  a thrown value records the original exception and `ERROR` before the initializer normalizes it.
  Runtime diagnostics do not independently determine span status.
- Package telemetry metadata is resolved once during bootstrap and reused for the init span,
  `Tracer`, and `Meter`. The init span contains only the awaited `init(runtime)` callback, not
  runtime-context preparation or unawaited plugin work.
- The host does not create a span for each fact/plugin projection.
- Around each `plugin.project(context)` callback, the host records a projection-operation counter
  and duration histogram under that plugin's resolved instrumentation scope. The measurement
  includes awaited callback work but excludes context preparation, host result application,
  diagnostics, policy handling, and subsequent plugins.
- Host projection metrics use bounded fact type and outcomes: `success`, `skip`,
  `failure_continued`, and `failure_aborted`. Returned fatal results and thrown values map according
  to whether the configured failure policy continues or aborts extraction; their source remains in
  diagnostics rather than another metric attribute.
- A continued failure emits a warning while its containing projection span remains unset. An aborted
  failure marks the containing projection span as `ERROR`.
- Plugins may create their own bounded spans and metrics. Host-reserved metric names use the
  `gitlode.plugin.*` namespace.
- Local profile includes plugin spans with calls, duration, and errors but excludes their arbitrary
  attributes. Plugin-created metrics are excluded from local profile initially; future external
  export may still carry them subject to its own policy.
- Instrumentation scope identifies the plugin package that provides instrumentation, not an
  arbitrary workload injected through that package. If a future general-purpose IPC or custom-script
  plugin needs workload-level comparison, introduce and review a separate bounded semantic
  dimension then; do not preemptively encode namespace, script identity, or configuration now.
- The initial design adds no duplicate plugin-init or bootstrap metrics: their bounded spans already
  retain callback duration, results, aggregate counts, and compatibility-warning counts.
- A plugin return value outside `PluginProjectionResult` is not forced into a cataloged metric
  outcome. Telemetry does not change plugin-runtime contract-validation behavior or create an
  unbounded fallback attribute.

## Duration measurement

Duration metrics use unit `s` and a monotonic clock. Production timing uses `performance.now()` and
converts elapsed milliseconds to seconds when recording. `Date.now()` is not used.

The metric catalog defines the exact start, end, and excluded work for every duration observation.
Once an attempt starts, its terminal duration is recorded once for success or failure using that
metric's bounded outcome set. Validation that prevents an operation from starting does not create a
duration observation unless the catalog explicitly defines the skip as an attempted operation.

Domain recorders own opaque timing tokens. Their shared completion result distinguishes terminal
ownership from duration availability:

```ts
type TimingCompletion =
  | { readonly firstCompletion: false }
  | {
      readonly firstCompletion: true;
      readonly durationSeconds: number | null;
    };
```

- an enabled start creates a distinct token even when the initial monotonic-clock read fails;
- its first completion returns `firstCompletion: true`; `durationSeconds` is `null` when either
  clock reading is unavailable, non-finite, or would produce a negative duration;
- every later completion of the same token returns `firstCompletion: false`;
- the shared no-op token completes as `firstCompletion: false`, avoids clock reads, and requires no
  per-operation allocation;
- call sites do not calculate with or inspect tokens and application callbacks and exception
  control flow remain outside the recorder.

For a compound operation, first completion governs all terminal observations while duration
availability governs only the duration histogram. A clock failure therefore suppresses only the
duration sample: valid counters, sizes, outcomes, and other sibling observations are still recorded
once. Likewise, an invalid numeric value suppresses only the observation that would consume it and
must not suppress valid sibling observations. Count and size observations accept finite,
non-negative values; operation-specific integer requirements remain defined by the observation
catalog.

Completion APIs make required terminal evidence explicit. In particular, successful file-change
expansion carries its expanded size, including zero, while failed expansion carries no size. A
successful completion without that value is not representable by the recorder interface.

## Worker telemetry session

One `WorkerTelemetrySession` owns telemetry for one worker run. It owns providers, context-manager
registration when needed, local processors/readers, profile snapshot, flush, and shutdown.

gitlode-owned providers are used explicitly through `provider.getTracer()` and
`provider.getMeter()` rather than being registered globally. Context management is initialized
early enough for worker async propagation. An existing compatible global context manager is not
replaced, and gitlode shuts down only the manager it owns.

The `gitlode.run` root span remains active through application work and application resource
disposal. Finalization order is:

1. complete application work;
2. dispose application resources;
3. end the root span;
4. flush tracing;
5. collect metrics;
6. build the profile snapshot;
7. shut down telemetry resources; and
8. return the worker result for presentation.

`finalize()` is idempotent, shuts resources down exactly once, never changes the already-determined
application result, and does not reject because of telemetry lifecycle failures.

## Local profile mode

The implemented target has only two effective states:

- profiling disabled, using no-op OpenTelemetry behavior and no-op domain recorders; and
- `--profile` enabled, using gitlode-owned local providers, processor, and reader.

`--profile` selects collection, not a different observation catalog or a detailed span mode. It
does not resurrect high-frequency spans.

The worker finalizes telemetry on success, typed application failure, and unexpected runtime
failure. During this migration, presentation retains the current success-only profile UX: a failed
application run does not render a profile even though telemetry resources are still finalized.

Local profiling and a future external destination are mutually exclusive. External export,
configuration, sampling, exporters, and a destination abstraction are outside this migration. No
extension interface is added merely to reserve that future.

Local tracing uses complete recording suitable for profiling. A future export-only destination may
apply its own sampler without needing a combined local/export sampling policy.

## Local collection

The local span processor aggregates on `onEnd()` and never retains span objects. Its key is
instrumentation scope plus span name. It records calls, total duration, maximum duration, `ERROR`
status count, and only allowlisted attribute summaries. It performs no I/O, returns no promises,
and does not throw from processor callbacks.

Attribute reducers are selected by collection policy:

- one stable value;
- a bounded set of distinct values; or
- numeric minimum and maximum.

Metrics use a local manual reader and are collected once during finalization. Counter and histogram
datapoints retain their bounded attribute sets. Histograms retain count, sum, optional minimum and
maximum, and explicit bucket counts, not raw samples. Approximate percentile display is not part of
the initial profile.

Collection limits per run are:

- 128 dynamic span groups;
- 16 distinct values for one retained span attribute;
- 128 metric datapoints per instrument; and
- 16 collection diagnostics.

Excess values are summarized into bounded overflow data. Overflow is a normal collection result,
not an application warning or failure.

## Profile report and presentation

The worker emits the structured-clone-safe, SDK-independent `ProfileReport` defined by
[`profile-report.yaml`](telemetry-catalog/profile-report.yaml). Its top-level shape is:

```ts
interface ProfileReport {
  readonly schemaVersion: 1;
  readonly signalStatus: ProfileSignalStatusSet;
  readonly spans: readonly ProfileSpanAggregate[];
  readonly counters: readonly ProfileCounterPoint[];
  readonly histograms: readonly ProfileHistogramPoint[];
  readonly diagnostics: readonly ProfileDiagnostic[];
}
```

The report keeps spans, counters, and histograms as separate signals. Metrics are not attached back
to a span-shaped `details` field. Individual trace IDs, span IDs, parent relationships, exceptions,
messages, and stacks are not retained.

Span aggregates use scope and span name as identity. Metric datapoints use scope, instrument name,
and the sorted attribute set. An unobserved metric is absent; presentation does not synthesize a
zero. An explicitly recorded zero remains distinguishable.

Signal status is `complete`, `partial`, or `unavailable` independently for spans, counters, and
histograms. A complete empty array means collection succeeded with no observations; an unavailable
signal has an empty array and a diagnostic; a partial signal may retain any usable observations.
Overflow makes the affected signal partial but remains a normal profile result.

Report data uses only plain structured-clone values. Scope identity is name plus a nullable version;
metric attributes are sorted scalar string, finite-number, or boolean values. Span duration fields
and duration histogram values use seconds. Counter and histogram units remain the canonical catalog
units. Histogram aggregates retain count, sum, nullable minimum and maximum, explicit boundaries,
and bucket counts, but no raw samples or calculated percentiles.

Span attribute summaries retain observation counts. Distinct reducers additionally retain bounded
per-value counts and an overflow count; single reducers retain a conflict count so a violated stable
value assumption is explicit rather than silently overwritten. Missing conditional attributes do
not create summaries.

Diagnostics are bounded structured records with cataloged code, severity, stage, signal, occurrence
count, and an optional safely normalized message. Lifecycle messages are limited to 512 UTF-16 code
units and exclude raw exceptions, stacks, paths, records, and attribute values. Equal diagnostics
are deduplicated by code, stage, signal, and message. One of the 16 diagnostic slots is reserved for
a diagnostic-overflow summary.

Collector output has the exact canonical deterministic order defined by the report catalog: scope
name, nullable scope version, observation name, and metric attributes, with subordinate span
attributes and diagnostics similarly sorted. Comparison is locale-independent. The collector has
no knowledge of pipeline display order or particular span names.

Presentation owns the declarative
[`profile-view.yaml`](telemetry-catalog/profile-view.yaml) catalog with group, preferred order, and
label for known observations. Span names do not contain numeric display prefixes. Unknown
observations remain visible using canonical fallback order. Preferred display order is a diagnostic
reading order, not an assertion about chronology.

The profile is presented in separate span, counter, histogram, and diagnostic sections. Formatting
may convert canonical units into readable units. Percentiles are omitted initially rather than
presenting bucket approximations as exact measurements.

Known spans and metrics appear in the catalog's diagnostic reading order; groups without
observations are omitted. Plugin observations are subgrouped by resolved scope name and optional
version. Core scope is normally omitted from known row labels, while plugin and fallback identity
remains visible. A known observation name under an unexpected scope is treated as unknown rather
than receiving a misleading known label.

Span rows show total, calls, average, maximum, errors, and bounded attribute summaries. Counter rows
show one value per attribute set. Histogram rows show count, sum, average, nullable minimum and
maximum, unit, and attributes. Explicit bucket counts remain in `ProfileReport` but are not expanded
by the initial CLI view, and zero rows are never synthesized for absent metrics.

Duration and byte values may be humanized by presentation while the report retains `s` and `By`.
Rounding must not display a nonzero value as an unqualified zero. Exact padding, borders, column
widths, decimal places, and punctuation are not compatibility contracts.

When any signal is partial or unavailable, a compact status summary precedes the signal sections and
the affected section repeats its state. Diagnostics render their severity, signal, stage, cataloged
label, repeated or dropped count, and bounded message when present. Collection overflow stays inside
the profile as informational diagnostic data and does not become an application warning.

## Failure isolation

If local SDK initialization fails, execution injects no-op telemetry, emits one structured warning,
continues extraction, and produces no profile report. An absent report is distinct from a valid
empty report.

Finalization stages are best-effort and independently guarded. Failure of one stage does not prevent
later collection or shutdown attempts. A report may contain only the successfully collected signal
sections and a bounded diagnostic describing missing data. Shutdown failure does not invalidate an
already-built report.

Lifecycle diagnostics identify the failed stage and contain a safely normalized message, not raw
telemetry data or an unbounded stack. Repeated failures are deduplicated.

Hot-path call sites are not individually wrapped in defensive `try/catch`. OpenTelemetry API calls
and gitlode-owned recorders follow their non-throwing recording contract. Gitlode-owned processor
callbacks, metric aggregation, overflow handling, timing-token completion, and diagnostic
accumulation must not throw into application work. Initialization, flush, collect, snapshot, and
shutdown are isolated by `WorkerTelemetrySession`.

## Source and dependency boundaries

The generic `otel-support` domain, exported from `@gitlode/internal-foundation/otel-support`, owns
the sync, async, error, and async-iterator lifecycle mechanisms. It depends on
`@opentelemetry/api`, not SDK packages, and contains no `gitlode.*` observation name, catalog,
profile contract, or operation policy.

The gitlode-specific `telemetry` domain, exported from
`@gitlode/internal-contracts/telemetry`, owns conventions, catalog metadata, collection policies,
the SDK-independent report model, and thin configured bindings over `otel-support`. Keeping both
domains in the existing workspaces avoids a one-domain workspace while preserving their different
charters. The contracts package depends on the foundation package and composes the async-iterable
binding through its exported typed factory; it does not directly import `@opentelemetry/api` for
that binding.

Pure typed metadata lookup, immutable instrument-option values, and attribute-value types derived
from the catalogs also belong to `@gitlode/internal-contracts/telemetry`. Catalog metadata remains
immutable; an owner that passes histogram boundaries to an OpenTelemetry API accepting a mutable
array supplies a detached copy rather than weakening the metadata type.

The legacy `@gitlode/internal-foundation/instrumentation` export is transitional custom
instrumentation and is removed when the migration completes. It remains separate from
`@gitlode/internal-foundation/otel-support`; new helpers must not be re-exported from the legacy
barrel.

Operation-specific recorder factories live with their owning domains, for example extraction, Git
implementation, line-diff implementation, output, and plugin runtime. They pre-create instruments
from an injected `Meter` and contain domain recording semantics. There is no application-level
`telemetry` support domain for shared recorder construction under `packages/gitlode/src`; the
cross-cutting split is the generic foundation mechanism and the gitlode-specific contracts domain.
One operation owner must not import another owner's recorder implementation merely to reuse an
attribute or completion type; shared vocabulary is derived from the contracts telemetry catalog.
The Git implementation's DAG binding is the explicit exception to placing a recorder in the
operation's algorithm domain.

The generic `dag` domain does not depend on the gitlode-specific `telemetry` domain. It exposes only
algorithm-neutral observation hooks for graph-work evidence. The Git implementation owns the OTel
binding that supplies those hooks and records the cataloged `gitlode.dag` observations. This keeps
the package graph acyclic and prevents gitlode names from entering the generic foundation package.

Worker SDK composition remains an internal module group under `execution`, including the telemetry
session, local span processor, local metric reader, context management, and report builder. This is
not a separate top-level domain or workspace package during this migration.

Presentation consumes only `ProfileReport` and the shared observation identifiers it needs. It does
not depend on OpenTelemetry SDK types or collection implementations.

Every workspace whose source directly imports `@opentelemetry/api` declares it directly. The
public `gitlode` package declares it because plugin API declarations expose OpenTelemetry API types.
An official plugin that imports only `gitlode/plugin-api` and receives an injected `Tracer` or
`Meter` does not declare `@opentelemetry/api` merely because that type occurs in a transitive public
declaration. If a plugin later imports `@opentelemetry/api` itself, its manifest must declare the API
according to that direct use. Architecture enforcement must model this source-import rule rather
than spreading dependencies to non-importing plugins. SDK packages remain implementation
dependencies of the public application package and do not leak into private-package or plugin
declarations.

## Deliberate non-goals

- Preserving the custom `Instrumentation`, `InstrumentationSpan`, or `StageProfiler` contracts.
- Preserving the current profile table or `details` column.
- Keeping individual spans or raw histogram samples for local profile rendering.
- Creating a detailed per-item trace mode in this migration.
- Combining local profiling and external export.
- Implementing external export, its configuration, or shutdown timeout policy.
- Adding a general telemetry backend or destination extension point in anticipation of export.
- Recording sensitive or unbounded values for local diagnosis by default.
