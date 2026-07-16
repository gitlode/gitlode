# Phase-Certified DAG Follow-up Handoff

This note contains only the context needed to resume unfinished work on the experimental
phase-certified DAG traversal. Durable contracts and completed design decisions live in
`packages/gitlode/docs/design/commit-traversal-internals.md`; module boundaries live in
`packages/gitlode/docs/design/architecture.md`; telemetry interpretation lives in
`packages/gitlode/docs/profiling.md`.

## Current blocker

The phase-certified implementation remains experimental and is not the production default. The
closure-phase root-cardinality issue has been fixed and documented in the durable traversal design.
The next known blocker is outer difference-loop termination: a single closure phase no longer reads
through single-successor roots, but the difference coordinator may still schedule subsequent exclude
phases until it reaches a terminal boundary.

Do not change difference termination as follow-up cleanup without first agreeing on the correctness
invariant with a human reviewer. Keep real-repository comparison harness work and production adoption
decisions deferred until the remaining termination semantics have deterministic unit coverage.

## Next work

Handle the outer difference termination problem independently:

1. Define the include/exclude result-finality invariant with a human reviewer.
2. Add deterministic fixtures that distinguish one closure phase's no-read-ahead contract from the
   coordinator's decision to schedule later exclude phases.
3. Fix only the coordinator behavior needed for that invariant, preserving independent
   reachable-difference membership tests and existing graph-work efficiency assertions.
4. Re-run the focused DAG, commit-traversal policy, strategy seam, and adapter integration suites.

## Resume points

- Phase-certified facade and orchestration:
  `packages/gitlode/src/dag/phase-certified.ts`
- Certified-closure state machine:
  `packages/gitlode/src/dag/certified-closure.ts`
- Include/certified integration state:
  `packages/gitlode/src/dag/phase-certified-difference-state.ts`
- Correctness fixtures:
  `packages/gitlode/test/dag/phase-certified.test.ts`
- Timestamp scheduling and synthetic graph-work efficiency fixtures:
  `packages/gitlode/test/git-impl/commit-traversal/timestamp-frontier-policy.test.ts` and
  `timestamp-frontier-policy-efficiency.test.ts`
- Internal strategy selection and adapter integration fixtures:
  `packages/gitlode/test/git-impl/commit-traversal/strategy.test.ts` and
  `packages/gitlode/test/git-impl/isomorphic-git-adapter.test.ts`

The production default is still `certified-lazy`. The phase-certified FIFO and timestamp modes are
selected only through the internal `GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL` seam. Unset that variable
to return to the default.

## Deferred work

- A real-repository comparison harness and operational evaluation.
- Any decision to change the production default or expose strategy selection to users.
- Memory-efficiency validation unless evidence raises its priority.
- Further directory or abstraction work that is not required to diagnose a concrete failure.
