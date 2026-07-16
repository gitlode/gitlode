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

The follow-up unit-test audit is complete. Single-successor and result-finality behavior now have
absolute topology-access regressions, complex correctness fixtures use an independent
reachable-difference oracle, and the Git-like favorable, equal-timestamp, and non-monotonic
efficiency fixtures check both policy comparisons and topology/telemetry accounting. Completed
contracts and fixture-design principles are recorded in
`packages/gitlode/docs/design/commit-traversal-internals.md` rather than repeated here.

## Next work

There is no active implementation task committed by this handoff. The next decision is whether to
resume controlled real-repository evaluation now that the known unit-level blockers and the fixture
audit are complete.

If operational evaluation resumes, define the comparison protocol before building a harness:

1. Keep the repository snapshot, include/exclude OIDs, adapter, and extraction request identical.
2. Compare `certified-lazy`, `phase-certified-fifo`, and `phase-certified-timestamp` through the
   existing internal selector; do not expose a new user-facing option for the experiment.
3. Verify result membership independently of yield order before interpreting efficiency.
4. Record `git.walk_commits.strategy`, nested `dag.traversal` counters and `termination_reason`, and
   adapter commit read/cache counters. Use elapsed time as supporting evidence rather than the sole
   efficiency measure.
5. Include repositories and boundaries with merge-heavy, equal/near-equal timestamp, and timestamp
   non-monotonic histories. Do not treat the synthetic favorable fixture as proof of real-world
   benefit.
6. Keep production-default adoption as a separate decision after results are reviewed.

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

## Deferred decisions

- Memory-efficiency validation remains lower priority unless profiling or operational runs show a
  concrete concern.
- Do not change the production default until correctness and operational evidence have been reviewed.
- Do not expose phase-certified modes through CLI, normal configuration, worker input, or package
  public API as part of the experiment.
- Further directory or abstraction work should be driven by a concrete maintenance need rather than
  resumed solely because it appeared in an older roadmap.
