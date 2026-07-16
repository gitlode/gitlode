# Phase-Certified DAG Follow-up Handoff

This note contains only the context needed to resume unfinished work on the experimental
phase-certified DAG traversal. Durable contracts and completed design decisions live in
`packages/gitlode/docs/design/commit-traversal-internals.md`; module boundaries live in
`packages/gitlode/docs/design/architecture.md`; telemetry interpretation lives in
`packages/gitlode/docs/profiling.md`.

## Current status

The phase-certified implementation remains experimental and is not the production default. The
closure-phase root-cardinality issue and the outer difference-loop result-finality blocker have been
fixed and documented in the durable traversal design. The difference coordinator now stops when the
include graph is fully resolved, records `termination_reason`, and avoids scheduling follow-up
exclude work after result finality.

Keep real-repository comparison harness work and production adoption decisions deferred until the
remaining validation work below has been completed.

## Next work

Continue validation without changing the production default:

1. Add or run a real-repository comparison harness for phase-certified FIFO and timestamp modes
   against the production certified-lazy strategy.
2. Review memory behavior on large histories if the validation harness shows promising graph-work
   savings.
3. Decide separately whether any phase-certified mode should become production-facing.

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
