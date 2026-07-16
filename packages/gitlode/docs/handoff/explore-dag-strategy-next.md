# Phase-Certified DAG Follow-up Handoff

This note contains only the context needed to resume unfinished work on the experimental
phase-certified DAG traversal. Durable contracts and completed design decisions live in
`packages/gitlode/docs/design/commit-traversal-internals.md`; module boundaries live in
`packages/gitlode/docs/design/architecture.md`; telemetry interpretation lives in
`packages/gitlode/docs/profiling.md`.

## Current status

The phase-certified implementation remains experimental and is not the production default. The
closure-phase root-cardinality issue and the outer difference-loop result-finality blocker have been
fixed and documented in the durable traversal design. Phase-certified traversal now records
`termination_reason` on `dag.traversal` spans.

Before real-repository validation, the unit-level phase-certified efficiency test design needs a
focused audit because the two recently fixed topology-access bugs were not caught by the previous
fixture set.

## Next work

Audit and tighten the unit-level phase-certified efficiency test design before adding broader
real-repository validation. This is not primarily a test-count increase; it should clarify what each
fixture proves, the minimum assertions needed for that proof, and whether any assertion freezes
unwanted graph work as acceptable behavior.

Review at least these questions:

1. For simple topologies, do fixtures encode absolute invariants that prohibit topology access after
   result-finality or beyond a single-successor closure boundary?
2. Do FIFO-vs-timestamp relative comparisons miss unnecessary exploration that both policies perform
   in common?
3. Are any fixtures treating current telemetry values as expected snapshots in a way that legitimizes
   inappropriate graph work?
4. Do any correctness-only membership fixtures need topology-access assertions to catch avoidable
   reads?
5. Are the favorable, equal-timestamp, and non-monotonic synthetic fixtures distinct in purpose, or
   are any redundant?
6. Which assertions should stay strict, and which exact snapshots are brittle against legitimate
   algorithm improvements?
7. For each fixture, are topology access traces, `successor_expansions`, `main_expansions`,
   `exclude_expansions`, and `termination_reason` checked only where they support that fixture's
   purpose?

## Resume points

- Phase-certified facade and orchestration:
  `packages/gitlode/src/dag/phase-certified.ts`
- Certified-closure state machine:
  `packages/gitlode/src/dag/certified-closure.ts`
- Include/certified integration state:
  `packages/gitlode/src/dag/phase-certified-difference-state.ts`
- Correctness and unit-level result-finality fixtures:
  `packages/gitlode/test/dag/phase-certified.test.ts`
- Timestamp scheduling and synthetic graph-work efficiency fixtures:
  `packages/gitlode/test/git-impl/commit-traversal/timestamp-frontier-policy.test.ts` and
  `packages/gitlode/test/git-impl/commit-traversal/timestamp-frontier-policy-efficiency.test.ts`
- Internal strategy selection and adapter integration fixtures:
  `packages/gitlode/test/git-impl/commit-traversal/strategy.test.ts` and
  `packages/gitlode/test/git-impl/isomorphic-git-adapter.test.ts`

The production default is still `certified-lazy`. The phase-certified FIFO and timestamp modes are
selected only through the internal `GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL` seam. Unset that variable
to return to the default.

## Deferred work

Defer the following until the unit-level efficiency test design audit is complete:

- Real-repository comparison harness.
- Real-repository operational evaluation.
- Memory-efficiency validation.
- Any decision to change the production default.
- Any decision to expose phase-certified modes to users.
- Production adoption decision.
- Further directory or abstraction work that is not required to diagnose a concrete failure.
