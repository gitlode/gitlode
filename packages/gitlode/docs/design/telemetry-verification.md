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

Low-level OTel helper tests use fake API objects so the private contract package does not gain SDK
dependencies. Application-package integration tests separately exercise real provider and async
context behavior. Async-iterable tests cover every terminal path and exactly-once ending.

Each domain recorder is tested through a fake `Meter` and injected clock. Metadata coverage alone is
insufficient: every accepted metric needs an owner test for its recording point, values, attributes,
outcome mapping, zero policy, and partial-work semantics. No-op recorder tests prove that disabled
telemetry does not read the clock or require hot-path allocation.

Collector and report tests cover bounded span aggregation, metric conversion, reducer behavior,
canonical sorting, signal status, structured cloning, and invalid aggregation. Completed span
objects and raw histogram samples must not be retained.

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
result classification and output remain unchanged in every case.

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

Presentation tests primarily assert a structured view model: grouping, labels, preferred order,
plugin scopes, fallback, signal state, diagnostics, zero semantics, units, and omission of
percentiles. Formatter smoke tests assert meaningful content without treating padding, borders, or
column widths as compatibility contracts.

The successful-run-only profile UX and `--quiet` suppression remain covered until a separate product
decision changes them.

## Execution tiers

Catalog, unit, fault-injection, owner-integration, deterministic repository, worker transport,
presentation, and normal repository checks run in CI. Representative large-repository timing,
memory, trace-volume, and profile on/off comparisons run explicitly during the final consolidation
phase using the method and thresholds in
[`telemetry-performance.md`](telemetry-performance.md).
