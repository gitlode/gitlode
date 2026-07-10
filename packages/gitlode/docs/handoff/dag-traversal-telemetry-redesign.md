# DAG Traversal Telemetry Redesign Handoff

This note captures the telemetry work intentionally deferred from the NodeId/topology DAG traversal
refactor.

## Current baseline

The refactor reduced DAG traversal telemetry rather than redesigning it in the same change. The old
node-read-oriented model no longer matched the responsibility split between the generic DAG core and
Git adapter commit reads.

Old spans and counters such as the following were removed from the DAG traversal core:

```text
dag.traversal.read_node.include
dag.traversal.read_node.exclude
include_reads
exclude_reads
cache_hits
fallback_reads
```

The stable behavior for the refactor is the set of emitted commit objects. Traversal order and
telemetry details are not stable user-facing contracts.

## Why this needs a separate redesign

The traversal architecture now has clearer boundaries:

- the generic DAG core observes topology traversal and strategy decisions;
- the Git adapter owns commit-object reads, commit-object caching, and backend error translation;
- profiling output should describe useful developer diagnostics without coupling to obsolete
  node-read internals.

Redesigning diagnostics at the same time as the abstraction migration would have made the refactor
larger and harder to review, so the detailed telemetry model was deferred.

## Follow-up design questions

A telemetry-focused session should decide which diagnostics are useful after the refactor, including:

- generic DAG traversal events and counters, such as frontier dequeues, skipped duplicate/stale
  items, successor expansions, yielded node count, fallback outcomes, and certification outcomes;
- Git adapter commit-read/cache diagnostics, such as read count, cache hit/miss count, and backend
  error categories;
- how adapter diagnostics should relate to the existing outer `git.walk_commits` operation span;
- which profiling output fields and summaries should be retained, renamed, added, or removed;
- which tests should intentionally cover the redesigned diagnostics.

## Guardrails for the redesign

- Do not treat telemetry as a stable end-user contract.
- Do not let telemetry concerns shape traversal correctness or the DAG abstraction boundary.
- Avoid high-cardinality per-OID span attributes or metric labels.
- Keep generic DAG traversal telemetry separate from Git-specific commit-read/cache telemetry.
- Prefer diagnostics that help compare performance before and after strategy or frontier changes.
