# Independent review of M1 pre-merge R1/R2 corrections

## Current assignment: focused R1 re-review

Resume the independent review conversation; if unavailable, start a new reviewer conversation with
this section. The original review below remains historical. The human returns the result to trunk.

- Correction base: `9efddecf80a48bdd66270dd9b2b41cb53c33494a`.
- Fixed correction target: `c3e74a292cd459c1fe455803bbe66f6553a192ad`.
- Outcome checkpoint: `219207f6c7fdaad15c5591cbd91a19f2fda084dd`.
- R2 acceptance remains at `0354bab6bcf8e2f78bb6dcb0d23843576504e869`, reviewed in `d25d65d`.

Review the three changed implementation/test files (`execute-run.ts`, `plugin-bootstrap.ts`,
`execute-run.test.ts`) and the [correction outcome](opentelemetry-m1-r1-r2-implementation.md#r1-correction-outcome).
Verify actual HEAD/worktree, ancestry, inventory and post-target documentation-only changes.
Trunk confirmed the returned OIDs/scope and diff whitespace, but did not rerun tests or mutations.

The sole prior blocker was that passing tests could miss active recorders in inactive composition.
Check that inactive timing now reaches the observed clock if an active timing recorder is selected,
and that component identity observations refer to the exact objects passed into real owners, not
a shadow selection. Inspect the observer's optional production path and plugin forwarding: no
wrapping/replacement, changed control flow, public API or per-operation instrumentation is intended.
Distinguish bounded composition-time allocation from recurring operation work.

Validate coverage of all nine selections in the implementation's sensitivity table, including both
built-in projector sites, non-timing JSONL output and DAG binding, disabled/degraded paths and
enabled behavior. Inspect assertion structure: one failed test must not be overreported as proof
that every scenario/assertion was reached. Preserve result/JSONL/checkpoint/plugin/warning checks.
Verify temporary active-selection mutations were restored in the fixed target.

Run the actual composition regression and relevant affected tests against the fixed content. Inspect
the reported nine mutation results; independently demonstrate sensitivity for representative timing
and non-timing selections if needed to resolve doubt. Any temporary deliberate fault must be isolated
and restored, never checkpointed. Do not require a new mutation framework, exhaustive repeat of all
reported runs, or new combinatorial cases absent a specific evidence gap. The implementation reports
R1 7 files / 106 passes and combined 9 files / 179 passes; attribute reported and new runs separately.

R2 tests may run as regression coverage; do not reopen accepted R2 design without a concrete new
defect or an affecting implementation change. Do not broaden into C1-C6 cleanup, full Windows/Linux
release validation, installed-package validation, archive revalidation or formal measurements.
Check applicable production typing and diff whitespace; preserve the existing test noCheck distinction.

Append a concise result below with fixed OID, R1 judgment, R2 acceptance maintained (or a concrete
reason to reopen), exact new checks, any residual failure path and final HEAD/worktree. Save only
the review documentation after format write/check. No implementation changes, push, PR, merge or
publish. If accepted, return to trunk for cumulative validation assignment. If another correction is
required, return the concrete failing selection/observation; avoid broadening the original criterion.

### Focused re-review outcome

Pending. R1 correction is implemented but not yet accepted; R2 remains accepted.

## Assignment and fixed inputs

Use a new human-started review conversation, independent of implementation. Review only the accepted
pre-merge R1/R2 corrections and their affected dependencies. The trunk conversation owns acceptance
and the subsequent cumulative validation assignment. Do not implement corrections in this review.

- Base: `3ed3cf47a9efcddffbbf4a45144325c7cfa807ad`.
- R1: `f755cc775f7ecb8e299a0eb3f36cea0f40bd7eda`.
- R2 / final implementation target: `0354bab6bcf8e2f78bb6dcb0d23843576504e869`.
- Implementation outcome checkpoint: `93f881784c6c9c47e51fdaaf9b42a852c8afa068`.
- Working branch: `feature/otel-redesign`; subsequent changes adding this review packet must be
  documentation only. Verify commit existence, ancestry, diff inventory and worktree before and
  after review. Do not silently review a changed implementation target.

The implementation diff has 13 source/test/durable-document files; the outcome adds one handoff
file. Trunk checked the reported OIDs, clean worktree, diff scope and whitespace, and inspected the
main composition/session/reader changes. This was routing verification, not independent acceptance.

Read `AGENTS.md`, the [accepted recovery disposition](instrumentation-opentelemetry-recovery-plan.md#accepted-pre-merge-review-disposition-2026-09-14),
the [implementation outcome](opentelemetry-m1-r1-r2-implementation.md#implementation-outcome),
[telemetry design](../design/telemetry.md), [verification](../design/telemetry-verification.md), and
the relevant build/test and collaboration guidance. R1/R2 here are the September 14 findings, not
the old M0 supervisor correction. Existing M0/M1 evidence does not accept these production changes.

## Review criteria

Assess every accepted R1/R2 exit criterion; the points below focus review without replacing that
contract or adding optional refactoring to M1.

For R1, follow effective session state through normal default worker composition and plugin
bootstrap. Confirm disabled and initialization-degraded paths select no-op Git, extraction,
projection, line-diff, output and plugin recorders and the Git-owned no-op DAG binding. Inspect
the new DAG binding's difference, reachable and certified-closure semantics, including options,
partial iteration and errors; eliminating observations must not change underlying algorithm work.
Enabled behavior, owner recording points and result/JSONL/checkpoint semantics must remain intact.

Inspect the test session/clock injection and optional composition fields. Verify that clock-read
assertions actually exercise production selection rather than merely configuring a clock that an
accidentally active recorder does not use. Review the reported three real-repository cases (disabled
isomorphic-git, degraded Git CLI, enabled isomorphic-git), plugin execution and existing regression
coverage together. Do not demand a combinatorial matrix without a concrete missing failure path,
but identify any omitted path that invalidates the accepted criterion. No-op object tests alone
are insufficient; no formal wall-clock performance claim follows from zero timing reads.

For R2, inspect the installed SDK collection behavior and finite positive timeout validation. The
production default is 1,000 ms; tests override it to 25 ms with a 2,000 ms outer deadline. Verify
the ordinary production constructor uses the finite default and the test override does not bypass
the mechanism. Assess normal, rejected and non-settling real observable callbacks, including an
unlisted plugin metric, metric partial/unavailable status, sanitized diagnostics, result identity,
subsequent shutdown/context cleanup, memoized finalization and late settlement. Distinguish the
SDK's callback errors returned in a collection result from rejection of collection itself.

The bound is on asynchronous collection waiting, not arbitrary plugin cancellation or synchronous
event-loop preemption. Do not broaden this review into a plugin sandbox, generic supervisor,
all-hooks removal, C1-C6 cleanup, metadata redesign or a new publish-gate review. Check that the
durable documentation states the actual guarantee and that no unrelated contracts were relaxed.

## Verification and evidence accounting

Implementation reported build, R1 focused 7 files / 126 tests, R2 focused 2 files / 73 tests, and
combined 9 files / 179 tests passing with no skips; architecture, lint, format and diff checks passed.
One existing Rev-dep compactness warning was reported, with zero errors. Treat these as reported
results unless independently rerun. The exact affected-suite command is in the implementation packet.

Run the affected combined suite once after the required development build, or a justified bounded
subset that independently exercises both corrections. Verify production typechecking through the
checked composite configuration; distinguish it from test/tooling `noCheck`. Trunk inspected the
configuration and confirmed that distinction. Do not expand into repository-wide tooling typing.
Use finite deadlines for callback tests and preserve failure/skip details. Run whitespace checks
on the fixed diff and verify that any post-target changes are documentation only.

Do not rerun full Windows/Linux release/installed-package validation, formal calibration or formal
measurements. Those are separate assignments. If new concrete concerns require broader checks,
explain their relevance and external runtime before starting. Preserve prior archives unchanged.

## Output and stop condition

Write the review result below, then save a documentation-only checkpoint after format write/check
and diff checks. Do not change implementation, acceptance records, frozen candidates or milestone
status. Do not push, create a PR, merge or publish. Keep the child/archive branches intact.

Return the fixed reviewed OID, actual final HEAD/worktree, separate R1/R2 judgments and combined
judgment, exact checks newly run versus reported evidence, and concrete remaining failure paths.
Group required corrections once with source location, violated accepted contract, trigger and effect.
Keep optional improvements separate. If accepted, return to trunk for cumulative Windows/Linux
functional and installed-package validation; this review alone does not complete M1 or permit a PR.

## Review outcome

Reviewed fixed implementation target:
`0354bab6bcf8e2f78bb6dcb0d23843576504e869` (base
`3ed3cf47a9efcddffbbf4a45144325c7cfa807ad`, R1
`f755cc775f7ecb8e299a0eb3f36cea0f40bd7eda`). The review started from documentation-only HEAD
`75588089bfe1d63c3a6c8120743b5323665db05d`; the worktree was clean. All four named commits exist,
the base/R1/R2/outcome ancestry chain is intact, the fixed diff contains the reported 13 unique
source/test/durable-document files, and changes after the target were limited to the three handoff
documents, including this packet. Both the fixed diff and the pre-review post-target diff passed
`git diff --check`.

### Judgments

- **R1: changes required.** Static inspection found the intended production selections in normal
  default composition: inactive sessions choose the no-op Git, extraction, built-in projection,
  line-diff, output and plugin recorders and the Git-owned no-op DAG binding; active sessions retain
  the active factories. The DAG no-op binding delegates difference directly to the supplied walk,
  and forwards graph, input and options unchanged to the reachable and certified-closure algorithms,
  so it adds no lifecycle wrapper or mutable observation state and preserves partial iteration and
  thrown values. The real-repository test also covers disabled isomorphic-git, degraded Git CLI and
  enabled isomorphic-git results, JSONL, checkpoint, plugin and warning/report outcomes.

  The mandatory actual-path selection evidence nevertheless has a false-negative path. In
  `createDefaultWorkerExecutionTelemetry()`, `metricTiming` is set to `undefined` whenever
  `recordingEnabled` is false. If any disabled/degraded composition branch accidentally selects an
  active timing recorder, that recorder constructs its own default `performance.now` timing and the
  injected `telemetryClock` still reports zero reads. The active output recorder and active DAG
  binding likewise have no injected-clock observation. Consequently the passing zero-read assertion,
  together with the direct no-op DAG object test, does not prove that production composition selected
  every required no-op object; this is the exact evidence weakness the review contract excludes.

  Required correction: make the disabled and initialization-degraded production-path regression
  fail if any required recorder family or DAG binding is composed as active, while retaining the
  existing result/JSONL/checkpoint/plugin/warning assertions. The clock assertion must remain wired
  so an accidentally active timing recorder uses the observed test clock. Cover the non-timing output
  recorder and DAG binding through an actual composition-visible observation rather than only direct
  no-op object tests. This correction is required evidence for the accepted no-op composition and
  failure-isolation contract; no production result defect was observed in the fixed implementation.

- **R2: accepted.** `LocalMetricReader` validates a positive safe-integer timeout and passes it to
  SDK collection. The ordinary `WorkerTelemetrySession.create()` path reaches the constructor with
  no override and therefore uses the 1,000 ms production default; test overrides construct the same
  reader and exercise the same `collect({ timeoutMillis })` mechanism. Inspection of installed
  `@opentelemetry/sdk-metrics` 2.10.0 confirmed that callback rejection and timeout are aggregated in
  `CollectionResult.errors` while collection resolves, whereas collection-level rejection follows
  the reader's unavailable-signal catch path. The session tests use real unlisted plugin observable
  gauges and cover normal settlement, rejection and non-settlement. They prove partial counter and
  histogram status for callback errors, bounded diagnostics without callback error text, original
  success/failure result identity, subsequent provider/context cleanup, memoized finalization and
  stable late settlement. The durable design correctly limits the guarantee to asynchronous
  collection waiting and disclaims callback cancellation and synchronous event-loop preemption.

- **Combined: changes required because R1 is not accepted.** R2 can remain accepted while the single
  grouped R1 evidence correction is made and independently re-reviewed. No optional improvement was
  identified, and this review does not broaden into C1-C6, release validation or performance work.

### Checks and evidence accounting

Newly run from repository root against HEAD whose implementation/test tree matched the fixed target:

- `npm run build:dev`: passed (`tsc -b`); the referenced production composite projects typecheck,
  while the documented tooling/test `noCheck` boundary remains distinct.
- The packet's exact combined Vitest command: 9 files, 179 tests passed, 0 failed, 0 skipped.
- `npm run format:write` and `npm run format:check`: passed; formatting changed only this review
  outcome.
- `git diff --check 3ed3cf47..0354bab`: passed.
- `git diff --check 0354bab..7558808`: passed before recording this outcome.

The implementation packet's separate R1 7-file/126-test and R2 2-file/73-test runs, architecture
check, lint and original diff checks remain reported evidence; they were not independently rerun
before recording this outcome. Full Windows/Linux release and installed-package validation, formal
calibration and formal performance measurements were intentionally not run.

Concrete residual paths are the R1 regression false negatives described above and the documented R2
limit that a synchronous callback can still block the event loop. The latter is an accepted boundary,
not a correction request. M1 remains incomplete, and this review does not permit a PR or integration.
