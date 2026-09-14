# M1 pre-merge R1/R2 implementation assignment

## Current assignment: R1 evidence correction, round 1

Resume the implementation conversation for this bounded correction; if unavailable, start a new
implementation conversation using this section. The human starts the conversation and returns its
outcome to trunk. The original implementation assignment and outcome below are historical context.
R2 is independently accepted at `0354bab6bcf8e2f78bb6dcb0d23843576504e869`; do not reopen it.

Start from the documentation checkpoint adding this assignment on `feature/otel-redesign`.
Review outcome base: `d25d65ddec78b7d6dad38bc2a23628f9967b96f7`; production must still match
`0354bab...`. Record HEAD and worktree; preserve unrelated changes and return unexpected production
delta to trunk. Read the [independent review outcome](opentelemetry-m1-r1-r2-review.md#review-outcome)
and the recovery plan's R1 criterion. This corrects test evidence, not a newly demonstrated defect
in the current no-op selection implementation.

The injected clock is presently disconnected when recording is inactive: `metricTiming` becomes
undefined, so an accidentally active recorder falls back to its own clock and the test still sees
zero reads. Output recording and DAG accumulation also cannot be detected by that clock assertion.
Retain the real default worker composition, disabled/degraded/enabled paths, plugin execution and
application-result/JSONL/checkpoint/warning assertions while closing these blind spots.

Allowed scope is the execution composition regression tests and their minimal observation seams
in `execute-run.ts` or `plugin-bootstrap.ts`, plus directly needed test support and this outcome.
Keep production no-op choices and recorder semantics unchanged. If retaining the clock assertion,
ensure an accidentally active timing recorder actually uses the observed clock; alternatively
replace it with demonstrably stronger actual-composition evidence and explain the replacement.
Explicitly observe output-recorder and DAG-binding selection. Do not substitute manually assembled
telemetry for the default composition under test or add a shadow selector that can disagree with it.
Prefer test-side observation; any production seam must stay internal and avoid new per-operation
work when profiling is disabled. No new public API or generic test framework is required.

Use a finite sensitivity checklist covering Git recorder, extraction pipeline, file expansion,
built-in projection, line diff, JSONL output, plugin projection and DAG binding in disabled and
initialization-degraded composition. Include both built-in projector construction sites when the
existing fixture only exercises one. For each selection, demonstrate that replacing that no-op
choice with its active counterpart causes the corresponding regression to fail. This may use small
temporary local mutations or an equivalent direct proof; no mutation-testing framework is required.
Record selection, scenario and failing assertion, then restore each temporary change. Verify the
final diff contains no deliberate faults. A single global enabled/disabled toggle is not sufficient
to establish sensitivity to an individual recorder-selection regression.

Run the R1 focused execution/plugin/recorder/DAG tests from the original packet, then its combined
affected suite once after final changes. Keep R2 tests as regression coverage without reopening its
accepted design. Run build, applicable checked production typing, architecture, lint, format write/
check and diff checks for the final correction. Preserve pass/fail/skip accounting. Do not repeat
full cross-platform release validation, formal performance runs or archived evidence checks here.

Save the correction and its outcome in checkpoints. Return exact OIDs, changed scope, sensitivity
checklist/results, actual commands and remaining limits. Do not mark R1 accepted or M1 complete.
No push, PR, merge, publish or acceptance-record changes. After the outcome returns, trunk assigns
focused independent re-review of this evidence correction, with R2 acceptance maintained. If the
same evidence issue survives a second correction round, use bounded diagnosis before another loop.

### R1 correction outcome

Pending implementation. R1 remains unaccepted; R2 remains accepted.

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

Implemented from checkpoint `3ed3cf47a9efcddffbbf4a45144325c7cfa807ad` on
`feature/otel-redesign`:

- R1 checkpoint: `f755cc775f7ecb8e299a0eb3f36cea0f40bd7eda`
  (`fix(telemetry): select no-op recorders when inactive`). The worker session now exposes its
  effective recording state. Default composition selects the existing no-op Git, extraction,
  line-diff, output and plugin projection recorders when disabled or initialization-degraded, and
  selects a Git-owned no-op DAG binding that runs the underlying algorithms without span wrapping
  or observation accumulation. Enabled composition retains the active recorders.
- R2 checkpoint: `0354bab6bcf8e2f78bb6dcb0d23843576504e869`
  (`fix(telemetry): bound asynchronous metric collection`). `LocalMetricReader` passes the SDK a
  finite 1,000 ms collection timeout. The default leaves practical headroom for ordinary
  asynchronous observations while bounding finalization delay; it is internal rather than a CLI
  setting. The timeout bounds waiting but does not cancel callbacks or preempt synchronous code.

R1 production-path coverage runs disabled isomorphic-git, initialization-degraded Git CLI and
enabled isomorphic-git composition over real one-commit repositories, file projection, line diff,
JSONL output and an actual plugin. The injected telemetry-only clock records zero reads in disabled
and degraded composition and records reads when enabled. All paths preserve successful records and
checkpoints; disabled and degraded paths omit the report, degraded initialization retains its one
warning, and enabled composition produces a report. The Git-owned no-op binding also exercises
difference, reachable and certified-closure operations without telemetry resources.

R2 production-path coverage registers a real SDK asynchronous observable gauge under an unlisted
plugin metric. It covers normal completion, callback rejection and non-settlement. The latter uses
a 25 ms test-only collection timeout plus a 2,000 ms outer deadline, returns the original
application result with partial counter/histogram status and bounded lifecycle diagnostics,
continues provider/context cleanup, memoizes finalization, and remains stable after the callback is
released and settles late. The rejection case preserves a typed application-failure object by
identity; callback failure content is not exposed.

Final verification from the repository root:

- `npm run build:dev`: passed. Production composite projects were checked. The existing
  `tsconfig.tooling.json` `noCheck` boundary for tests remains unchanged.
- R1 focused Vitest invocation from this packet, excluding the two R2/local-collection files:
  7 files and 126 tests passed.
- R2 focused invocation of `worker-telemetry-session.test.ts` and `local-collection.test.ts`:
  2 files and 73 tests passed.
- Combined affected-suite invocation exactly as listed in this packet: 9 files and 179 tests passed.
- `npm run architecture:check`: passed for all workspaces. Rev-dep reported zero config errors and
  one unrelated compactness warning for an existing detector declaration.
- `npm run lint`: passed.
- `npm run format:write` followed by `npm run format:check`: passed.
- `git diff --check`: passed.

During development, new tests first exposed two fixture-expectation mistakes (the existing plugin
compatibility warning and the DAG successor object shape); after correcting the tests, R1 passed.
The first R2 build rejected a parameter property under the existing `erasableSyntaxOnly` policy;
the implementation was changed to a private field and the build and focused tests then passed.
No failing production behavior remains from those iterations.

The implementation changes 13 unique source, test and durable-design files across gitlode and the
Git adapter, plus this outcome update. It does not change recorder APIs, instrument catalogs, CLI
configuration, dependencies, thresholds, fixtures, presentation, acceptance records or archive
refs. No PR, push, merge, publish, release/package validation, cross-platform cumulative validation
or formal performance measurement was performed. These commits are implementation evidence only;
independent review and milestone acceptance remain with trunk.
