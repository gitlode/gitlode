# Telemetry Redesign Verification

This document defines how the accepted telemetry target is verified during migration. Exact
repetitive cases and required evidence live in
[`telemetry-catalog/verification.yaml`](telemetry-catalog/verification.yaml). Observation semantics
remain canonical in [`telemetry.md`](telemetry.md) and its observation catalogs.

## Verification goals

The migration must prove independently that application behavior is unchanged, telemetry matches
the accepted catalog, and telemetry failures do not escape into application control flow. Tests fix
identity, ownership, hierarchy, counts, attributes, outcomes, report invariants, and deterministic
ordering. They do not fix measured wall-clock durations or incidental terminal layout.

Duration assertions use finite nonnegative values and aggregation invariants. Exact duration values
are permitted only in focused recorder tests with an injected clock.

## Test layers

Catalog contract tests compare implementation metadata against the YAML design contracts without
loading YAML in production. They reject missing or duplicate observations, invalid attribute
references, metadata drift, view omissions, and reintroduction of observations explicitly removed
by the target design.

Low-level OTel helper tests live with `internal-foundation/otel-support` and use fake API objects so
the foundation package does not gain SDK dependencies. Their test context manager must preserve
active context across at least one awaited continuation; checking only the synchronous prefix of an
async callback is insufficient. Contract-package tests separately prove that the thin gitlode
async-iterable binding records the accepted completion attribute and values. Application-package
integration tests exercise real provider and async-context behavior. Async-iterable mechanism tests
cover every terminal path and exactly-once ending.

Each domain recorder is tested through a fake `Meter` and injected clock. Metadata coverage alone is
insufficient: every accepted metric needs an owner test for its recording point, values, attributes,
outcome mapping, zero policy, and partial-work semantics. Instrument creation tests verify the exact
cataloged name, description, unit, and histogram bucket advice.

Compound-recorder tests distinguish first completion from duration availability. They prove that a
clock failure omits only the duration sample, preserves valid non-duration sibling observations,
and does not permit a repeated completion to record any signal again. An enabled start whose clock
read fails must still acquire terminal ownership exactly once. File-change expansion tests require a
size, including zero, for success and no size for failure. Invalid numeric inputs are tested per
signal so that an invalid value cannot enter an instrument or suppress valid sibling observations.

Every no-op recorder family is exercised directly. These tests prove that disabled telemetry creates
no instruments, reads no clock, and needs no per-operation timing-token allocation. Direct recorder
tests do not prove correct production composition: actual disabled and initialization-degraded worker
paths must also verify the selected recorder/DAG objects and connected timing behavior. The evidence
must detect an active selection even for non-timing output/DAG bindings and both built-in projector
construction paths. Preserve enabled recording, application results, JSONL, checkpoints, plugin
behavior and initialization warnings while testing these paths.

Collector and report tests cover bounded span aggregation, metric conversion, reducer behavior,
canonical sorting, signal status, structured cloning, and invalid aggregation. Completed span
objects and raw histogram samples must not be retained.

The active schema-v2 contract and runtime use literal cases for typed target
canonicalization, independently validated identity components, exact/discarded/not-applicable
attribute selectors, per-kind fields/effects/coverage, quantity merge uncertainty, safe saturation,
15+1 issue retention, escaped 4096-code-unit detail broadening, numeric availability, and the fixed
fallback. Runtime tests inject a real normal builder-body failure after partial work, prove a single
builder invocation, exercise broken diagnostic snapshots and simultaneous shutdown failures, and
verify cached finalization, application-result identity, normal worker/application transport and the
ordinary presentation path. Presentation and repository evaluators separately distinguish observed
zero from unavailable numeric fields, partial/unavailable status, reserved summaries and fixed
fallback provenance.

Mixed valid/invalid Span duration tests run both input orders through the real processor, report
builder and presentation/tooling bridges. They preserve retained total/maximum, suppress the average,
disclose omitted contributions after diagnostic compaction, reject all-invalid defaults as observed
zero and retain a genuine zero-duration contribution. Report-builder isolation separately covers
throwing first/middle values and iterator failure, including honest exact versus unknown loss.

Repository-consumer fixtures include complete normal, partial and fixed-fallback reports plus
compacted producer output, missing required fields, invalid field masks and malformed reserved
summaries. Relationship cases reject unavailable signals with values, unexplained partial or
unavailable status, delivery effect/provenance mismatches, target/coverage/affected-field kind
contradictions and summary-association bypasses. Legal empty signals, broad or multi-kind targets,
detail loss, lifecycle-only notices and mixed-duration retained totals remain accepted. Acceptance
is based on complete shared-contract normalization before measurement extraction. An actual
worker-thread entry/client test injects an invoked builder-body failure through an internal-only seam
and verifies fallback serialization, ordinary result routing, application-result equivalence and
finite cleanup.

Correction coverage also compares lifecycle-only and confirmed whole-signal-loss evidence before and
after detailed-record compaction, rejects status/value contradictions without discarding retained
values, distinguishes exact safe-integer boundaries from actual saturation, and routes explicitly
malformed counts and detail-loss masks to invalid-aggregation evidence. A 100,000-entry duplicate-kind
probe counts indexed reads before diagnostic identity construction; the normalizer must reject it by
the fixed kind-universe cardinality without input-proportional traversal. This bounds accumulator
preprocessing after the caller supplies the array, not the caller's cost to allocate or populate that
untrusted input.

Repository performance workflow tests use the same development-only sidecar orchestration as the
formal workflow. They require a `target_on` report, classify missing or malformed reports as
inconclusive, propagate report-size, prohibited-span, diagnostic, and signal-status outcomes to the
top-level evaluation, and keep timed CLI output/checkpoints separate from sidecar artifacts.

## Bounded collection

Every collection limit is tested immediately below, at, and above its boundary. Bounded streaming
collectors retain the first values they accept and summarize later excess. Canonical sorting applies
to retained output; implementations are not required to replace retained entries to select the
lexicographically smallest set after concurrent completion.

Overflow must remain non-throwing, bounded, visible through the accepted report fields and
diagnostics, and irrelevant to the application result. It must not create synthetic span or metric
identities.

## Failure injection

`WorkerTelemetrySession` exposes internal test seams for initialization, flush, collection, report
build, and shutdown failures. These seams are not public telemetry backends or future exporter
abstractions.

Tests prove idempotent non-rejecting finalization, exactly-once shutdown, later-stage attempts after
an earlier failure, no-op degradation after initialization failure, preservation of available
signals and already-built reports, and bounded deduplicated lifecycle diagnostics. Application
result classification and output remain unchanged in every case. Real SDK asynchronous observable
callbacks cover normal completion, rejection, and non-settlement (including an unlisted plugin
metric); the non-settlement case uses a finite outer test deadline and proves bounded collection,
partial metric signals, continued cleanup, idempotence, and safe late settlement.

## Operation-owner integration

Migration slices test observations through their actual owners rather than through generic recorder
calls alone. This verifies root and child hierarchy, exact logical-stream lifetime, recording points,
partial work, removal of high-frequency leaf spans, adapter-specific command/session structure,
DAG facade reporting, concrete line-diff ownership, output partial effects, and plugin scope and
failure-policy mapping.

Existing exact DAG topology and graph-work tests remain correctness and algorithm-efficiency
evidence even where prototype-specific counters are removed from the OTel catalog.

## Deterministic repository fixture

Behavioral integration tests generate a small repository from a fixed recipe rather than checking a
binary `.git` directory into the repository. Identity, time, topology, messages, refs, file content,
and session time are fixed. The recipe covers linear and merged history, overlapping refs, tags,
incremental boundaries, text and binary file changes, UTF-8 bytes, and size-guard boundaries.

Portable telemetry fixtures omit symlinks, submodules, and platform-dependent file modes. Existing
adapter-specific correctness tests continue to own those behaviors.

## Profile-disabled and profile-enabled equivalence

Every applicable runtime scenario runs with profiling disabled and enabled against identical inputs.
Within one adapter, JSONL file sequence and bytes must match exactly. Application result fields and
checkpoint data must also match, excluding elapsed time, profile data, temporary paths, and telemetry
diagnostics.

Cross-adapter comparison remains semantic and order-independent because line ordering is not a
cross-adapter contract.

Pre-migration baselines protect extraction results, checkpoint behavior, and JSONL output. They do
not freeze the current custom profile table, because the accepted redesign intentionally changes its
shape.

## Presentation verification

Presentation tests assert the generic Scope/two-level namespace tree, code-unit/kind/typed-attribute
ordering, short/group-node collisions, plugin and unknown identities, escaping, attribute bases,
fixed per-kind fields, masks, zero semantics, unit thresholds and omission of percentiles. Diagnostic
tests cover report/Scope/observation/point placement, missing-only targets, valid siblings, fixed
fallback, lifecycle-only notices and reserved detail summaries. Semantic-role spies and ANSI removal
prove styled/plain text parity without treating padding, wrapping or column widths as contracts.

The successful-run-only profile UX and `--quiet` suppression remain covered until a separate product
decision changes them.

## Execution tiers

Catalog, unit, fault-injection, owner-integration, deterministic repository, worker transport,
presentation, and normal repository checks run in CI. Representative large-repository timing,
memory, trace-volume, and profile on/off comparisons run explicitly during the final consolidation
phase using the method and thresholds in
[`telemetry-performance.md`](telemetry-performance.md).
