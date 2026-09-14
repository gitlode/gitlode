# M1 pre-merge R1/R2 implementation assignment

## Owner, inputs and authority

Use a separate human-started branch conversation for implementation. The existing trunk conversation
owns milestone decisions and acceptance; the human returns this session's outcome to trunk.
This is a conversation boundary, not a request to create another nested Git branch or parallel agent.
Work on `feature/otel-redesign`, preserving T13B, T13 and the archive refs.

Accepted planning base: `6fb92fb8a217bbd260acea117a01f6e41593bf04`. Start from the checkpoint that
adds this packet; its delta from that base must be documentation only. Record actual HEAD, branch,
tracked/untracked state and relevant diff before editing. Preserve unrelated changes. If production
has changed since the accepted base, return the concrete delta to trunk before assuming this packet
still applies. Do not reset, merge, replay old T13 commits, or modify preserved measurement archives.

The human has accepted implementation of both pre-merge findings. Their cause, correction boundary,
evidence limits and exit criteria are canonical for this assignment in the recovery plan's
[accepted disposition](instrumentation-opentelemetry-recovery-plan.md#accepted-pre-merge-review-disposition-2026-09-14).
R1 here is disabled/degraded no-op selection, not the old completed M0 supervisor write-failure fix.

## Required reading and allowed scope

Read `AGENTS.md`, the accepted R1/R2 disposition, and:

- [telemetry design](../design/telemetry.md), especially local profile mode and failure isolation;
- [verification](../design/telemetry-verification.md) and the relevant catalog cases;
- [build/test/release guidance](../contributing/build-test-release.md);
- [collaboration rules](../agents/collaborative-work.md).

R1 primary files are `src/execution/execute-run.ts`, `src/execution/plugin-bootstrap.ts`, and
`src/execution/telemetry/worker-telemetry-session.ts` in gitlode. Inspect existing domain recorder
families and Git-owned DAG bindings; reuse their no-op implementations. Small internal composition
types or import/barrel adjustments directly needed to select them are in scope. Do not redesign
recorder APIs, instrument metadata, domain ownership, or product operation call sites.

R2 primary files are `src/execution/telemetry/local-metric-reader.ts` and the worker telemetry session.
Inspect the installed SDK timeout behavior rather than assuming that collection filtering prevents
callback execution. Use a finite SDK-supported collection timeout and document its default/rationale.
Choosing a bounded internal default is within this assignment; the 100 ms reproduction observation
is not that default. No CLI configuration, dependency upgrade, plugin sandbox or generic supervision
framework is authorized. A timeout must not be described as canceling arbitrary plugin code.

Add or adjust real-path tests in the owning execution/telemetry suites and directly affected durable
documentation. Relevant starting points include `execute-run.test.ts`, `plugin-bootstrap.test.ts`,
`worker-telemetry-session.test.ts`, `local-collection.test.ts`, `domain-metric-recorders.test.ts`,
the plugin owner suites and `behavioral-baseline.test.ts`. Keep test mechanisms narrow; do not turn
this into removal of all production test hooks or a repository-wide test typechecking project.

Exclude optional C1-C6 refactors, profile presentation, `tests/system` migration, calibration,
formal measurements, threshold/fixture changes, acceptance-record edits and publish-gate changes.

## Execution and checkpoints

1. Implement R1 and its actual worker-composition regression coverage. Select no-op behavior from
   the session's effective state, including initialization degradation, and cover enabled behavior
   as well as disabled/degraded paths. Verify both Git adapters and representative file/plugin
   paths using the existing deterministic fixtures. Distinguish telemetry clock reads from normal
   application clocks. Save a focused R1 checkpoint after its required tests pass.
2. Implement R2 separately. Exercise a real asynchronous observable callback for normal completion,
   rejection and non-settlement, including an unlisted plugin metric. Assert bounded finalization,
   diagnostics/signal state, continued cleanup, original success/failure results, idempotence and
   late callback settlement. Give each test a finite outer deadline and reliable cleanup. Save a
   separate R2 checkpoint after verification; do not squash the two repair checkpoints here.
3. Review the combined diff for unintended changes and run affected regression checks. Report
   results and limitations in this packet's outcome section, then save a documentation checkpoint.

Small test injection points may be necessary for effective-state or initialization-failure coverage,
but tests must traverse actual production composition and SDK callbacks. Testing no-op objects or
injected failure flags alone does not satisfy the accepted defects' exit criteria.

## Verification boundary

Build development output before focused tests; build success alone may not establish strict typing
where the repository uses `noCheck`. Verify modified code with the repository's applicable checked
configuration, or report a narrowly scoped strict check and any pre-existing limitation explicitly.
Do not silently weaken typing to make a new test pass.

Suggested affected-suite invocation from the repository root (include any additional new tests):

```text
npm run build:dev
npx vitest run packages/gitlode/test/execution/execute-run.test.ts packages/gitlode/test/execution/plugin-bootstrap.test.ts packages/gitlode/test/execution/plugin-telemetry-owner.test.ts packages/gitlode/test/plugin-runtime/plugin-projection-telemetry-owner.test.ts packages/gitlode/test/telemetry/worker-telemetry-session.test.ts packages/gitlode/test/telemetry/local-collection.test.ts packages/gitlode/test/telemetry/domain-metric-recorders.test.ts packages/gitlode/test/telemetry/behavioral-baseline.test.ts packages/git-adapters/test/git-impl/dag-telemetry-binding.test.ts
npm run architecture:check
npm run lint
npm run format:write
npm run format:check
git diff --check
```

Run the focused subset after each repair, then the affected combined set once; rerun more only when
new changes or concrete failures justify it. Do not replace functional output/checkpoint assertions
with snapshots of incidental terminal spacing. Keep deadlines deterministic and do not interpret
these tests as formal overhead acceptance.

Independent review and cumulative Windows/Linux functional plus installed-package validation are
subsequent assignments owned by trunk. Do not repeat the complete cross-platform validation or
formal measurement here. If a narrowly affected platform check becomes necessary, explain why and
record its actual scope. Build and regression commands can take time independently of model reasoning;
announce long external execution, retain command outcomes and keep progress visible.

## Exit and next owner

Return R1 and R2 commit OIDs, actual final HEAD/worktree state, changed-file scope, selected timeout
and rationale, exact commands with pass/fail/skip counts, newly demonstrated production-path evidence,
remaining limitations and any unresolved concrete failure. Separate prior evidence from newly run
checks. Do not mark R1/R2 accepted, M1 complete, or freeze a new measurement candidate yourself.

Do not create a PR, push, merge, publish, run a Version PR workflow, or modify integration refs.
After the human returns the outcome, trunk assigns a separate independent review of the fixed diff,
then cumulative validation. If the correction needs a contract change outside these boundaries,
preserve the partial checkpoint and return the specific decision; do not expand the repair loop.

## Implementation outcome

Pending. This packet is an assignment, not evidence of implementation or acceptance.
