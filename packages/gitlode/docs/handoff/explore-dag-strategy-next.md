# Phase-Certified DAG Follow-up Handoff

This note contains only the context needed to resume unfinished work on the experimental
phase-certified DAG traversal. Durable contracts and completed design decisions live in
`packages/gitlode/docs/design/commit-traversal-internals.md`; module boundaries live in
`packages/gitlode/docs/design/architecture.md`; telemetry interpretation lives in
`packages/gitlode/docs/profiling.md`.

## Current blocker

The phase-certified implementation remains experimental and is not the production default. During
local repository trials, its telemetry exposed multiple serious problems that should have been
detectable by unit-level fixtures. The concrete failures still need to be recorded before this note
can describe their topology, symptoms, and invariants precisely.

Do not proceed with the previously considered real-repository comparison harness or a production
adoption decision until these problems have deterministic unit reproductions and fixes. The internal
strategy selector remains useful for controlled diagnosis, but its existence is not evidence that
the prototype is ready for broader use.

## Next work

Handle each reported problem independently:

1. Record the smallest topology and scheduling conditions that reproduce it.
2. Add a deterministic unit fixture at the narrowest responsible layer. Use an independent
   reachable-difference oracle for result membership where applicable, and assert the relevant
   state or telemetry invariant rather than only wall-clock behavior.
3. Identify whether the gap is in the closure state machine, difference integration state,
   scheduling interaction, or instrumentation.
4. Fix the implementation without weakening existing correctness or synthetic graph-work efficiency
   assertions.
5. Re-run the focused DAG, commit-traversal policy, strategy seam, and adapter integration suites.

After all known failures are fixed, reassess the validation inventory before returning to
real-repository experiments. Correctness validation remains the first priority. Synthetic graph-work
efficiency validation is useful only after the operation is correct. Memory-efficiency validation
remains lower priority unless a reported failure makes it relevant.

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
