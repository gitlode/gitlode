# OpenTelemetry Redesign Recovery Plan

## Authority and current status

The human accepted staged convergence on 2026-09-09, branch-history recovery on 2026-09-11,
and the pre-merge review disposition below on 2026-09-14.
The objective remains safe integration before full v0.13.0 release acceptance. The
[redesign plan](instrumentation-opentelemetry-redesign-plan.md) tracks unfinished T13B/T13C work;
canonical telemetry, verification, performance, and publish contracts remain authoritative.

M0 is complete. Prior M1 reviews and functional validation retain their historical scope, but two
confirmed defects now block M1 integration: R1 disabled-recorder selection and R2 unbounded metric
collection. The human has merged the T13B-to-T13 and T13-to-redesign PRs. The final redesign-to-
integration PR waits for these corrections, independent review, and updated cumulative validation.
M2 remains paused. Neither branch-history recovery nor old passing tests waive these new blockers.

| Milestone                 | Status                    | Remaining exit                                                                                                                  |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| M0: Measurement path      | complete, one target only | Preserve the original evidence and attribution                                                                                  |
| M1: Integration-ready     | R1/R2 corrections pending | Correct and independently review R1/R2, update cumulative validation, then obtain human permission for the final integration PR |
| M2: v0.13.0 release-ready | paused pending M1         | Full T13B, readable profiles, staged system-test organization, final candidate and T13C                                         |
| M3: Future capabilities   | deferred beyond v0.13.0   | Separate future plans                                                                                                           |

## Branch recovery and next assignment

The local and actual remote integration refs were checked after the human reset and both equal
`1664798a9f586b1ac4e632d02d3a37cb0c6ebf0d`. The reset integration tip is preserved locally and
remotely at `archive/otel-m1-before-reset-20260911`, OID
`b4468342c982d09be09e9c46290bb1ed2d842a36`. That branch is an archive, not an active merge source.
The separate `D:\gitlode_test` evidence archives remain immutable.

The approved integration route is:

1. `feature/otel-redesign_T13B` into `feature/otel-redesign_T13`.
2. `feature/otel-redesign_T13` into `feature/otel-redesign`.
3. `feature/otel-redesign` into `integration/v0.13.0`.

Recovery step 4 completed at `08661cebbdd5538fe0e3a1e8836890127bbd2bf5`, including the test
environment correction at `7dc4ca7` and completed-handoff cleanup. The human squash-merged
[PR #109](https://github.com/gitlode/gitlode/pull/109) into T13 at
`ec0b0863c59129bed770228f2038b2cba2d07113`, then merged
[PR #110](https://github.com/gitlode/gitlode/pull/110) into redesign, whose reviewed implementation
is `8c0b200f7e0ac8f175199b76201297364dccd1a1`. Preserve the child branches until recovery is complete.

The next assignment is the [bounded R1/R2 implementation](opentelemetry-m1-r1-r2-implementation.md)
in a separate human-started branch conversation, based on the checkpoint adding that packet to
`feature/otel-redesign`. The current conversation remains trunk; the human returns the implementation
outcome here for independent-review assignment. Do not continue implementation on the already-squashed T13B
branch or replay its commits. This planning update authorizes no PR or merge. Do not restore the
old M1-complete/M2-next routing or resume M2 before reintegration.

Before each PR, present its exact source tip, base branch, cumulative diff, evidence, and remaining
obligations for human inspection. Obtain explicit permission stating which branch will merge into
which branch. The human creates the approval and performs the merge, including any squash choice;
the agent must not merge or directly push integration. See the
[durable collaboration rule](../agents/collaborative-work.md#pull-requests-and-branch-integration).
No PR is authorized merely by completion of this preparation step.

After each human merge, fetch and inspect the actual result before preparing the next PR. Compare
content rather than assuming ancestry survived squash. Preserve the domain-design link already in
the integration base's `git-cli-adapter-plan.md`. The earlier direct-integration rehearsal is
historical evidence only, not authorization or a matching-tree claim for these new merge results.

## Evidence and squash boundaries

- [M0 environment and one-target result](opentelemetry-m0-result.md) retain operational paths,
  exact product/harness/recipe identities and archive hashes. They are not full T13B evidence.
- [M1 validation evidence](opentelemetry-m1-validation-result.md) retains the frozen candidate,
  Windows/Linux verification and immutable package/runtime identities. The earlier CI fix changed
  only tests, but R1/R2 will change production. Its old test/document-only delta justification cannot
  validate the corrected candidate; update cumulative evidence after the corrections.
- Squash changes commit identities and can remove ancestor relationships required by the
  [publish gate](../contributing/build-test-release.md). Keeping an archive ref preserves objects,
  but does not make an old frozen candidate an ancestor of the new final candidate.
- After the full branch chain is integrated, freeze a new M2 product candidate on the resulting
  integration history and run formal M2 acceptance there. Keep old evidence attributed to its actual
  OIDs; never relabel old measurements as new-candidate results or relax provenance checks here.
  M2 planning must also settle final release-to-main squash timing before binding the final candidate.

Completed implementation/review/diagnosis packets were removed from the working tree. Their history
remains in the preserved T13B commits and archive branch. This plan and the two evidence notes carry
only context needed for reintegration and M2; the original plan carries the remaining unit scope.

## Accepted decisions and limits

- Use Linux/WSL2 for reference measurements. Prepare a Linux-native toolchain and filesystem for
  execution; retain `D:\gitlode_test` as the Windows-accessible artifact archive. Do not use Windows
  baseline timings as Linux comparison evidence. Windows functional validation remains required.
- Integrate at M1; complete all pre-release obligations at M2. Future capabilities belong to M3.
- Before M1, limit production reorganization to recognizable domain-local `telemetry/` placement,
  naming, import adjustments, and documentation entrypoints. Keep operation ownership and semantics.
  These subdirectories are not new code domains. Do not combine this with recorder API redesign.
- The 2026-09-14 amendment additionally requires the narrowly scoped R1/R2 safety corrections before
  M1. It does not authorize general recorder, metadata, lifecycle-helper, or collector refactoring.
- Improve profile readability before release, using representative output for human review.
- Adopt a private `tests/system` workspace in a separate post-M1 slice, moving release-CLI system
  workflows incrementally. Do not move every telemetry test or add public APIs to expose internals.
- Separate implementation, measurement execution, diagnosis, and review sessions using the
  [collaboration guidance](../agents/collaborative-work.md#bounded-implementation-and-measurement-sessions).
- Do not discard the implementation, restore legacy instrumentation, remove observations, relax thresholds,
  or automatically retry for a favorable result. The current calibration recipe remains authoritative.
  Whether to replace minimum-integer calibration with a selection having more timing headroom is an
  unresolved design question, not an approved change.

## Accepted pre-merge review disposition (2026-09-14)

### Provenance and interpretation

The independent LLM review compared integration `1664798a9f586b1ac4e632d02d3a37cb0c6ebf0d`
with redesign `8c0b200f7e0ac8f175199b76201297364dccd1a1`. The unmodified report and its README
route were preserved at checkpoint `6b99b4d8e8b5c846371bcb7174e3337152684491` before disposition;
the report is removed from the active tree. This section is the accepted continuation authority,
not the original report's recommendations. In particular, the human accepted moving R2 from the
report's proposed M2 timing to a required pre-M1 correction.
R1/R2 in this section identify the 2026-09-14 pre-merge findings, not the previously completed
M0 supervision R1 final-evidence-write correction.

Planning independently inspected the R1 composition path and R2 collection/installed-SDK code at
the reviewed head, and reproduced R2 using the actual source `WorkerTelemetrySession`. R1's reported
108 timing-clock reads were not independently recounted. The original review reported a successful
development build and 14 focused test files / 231 passing tests; planning did not rerun those suites.
Neither review performed full release validation, formal measurement, or external archive verification.

The report counted 209 changed files with 33,893 net added lines, about 80% in tests, documentation
and validation tooling; these are report-derived ownership counts, not complexity or performance
measurements. The migration includes observation redesign, local report collection, verification
catalogs and evidence/release tooling beyond OTel API adoption alone. Domain-local recorder placement
is not itself a demonstrated defect. Preserve semantic operation ownership and recorder APIs:
partial work, plugin callback versus result application, output success versus written bytes, and
DAG work have distinct owners. Do not use line counts to justify wholesale deletion or new release gates.

### R1: Select no-op recorders in disabled and degraded composition

Status: confirmed; mandatory before M1; not implemented by this planning update.

`createDefaultWorkerExecutionTelemetry()` in
[`execute-run.ts`](../../src/execution/execute-run.ts) and
[`plugin-bootstrap.ts`](../../src/execution/plugin-bootstrap.ts) construct active recorders even
when profiling is disabled or initialization has degraded. A no-op OTel recording destination does
not suppress clock reads, timing tokens, attributes or DAG accumulation performed beforehand.
The [local profile contract](../design/telemetry.md#local-profile-mode) requires no-op domain
recorders; [failure isolation](../design/telemetry.md#failure-isolation) also covers initialization
degradation. Existing no-op recorder families are already available.

The original review exercised the actual worker composition with the deterministic repository,
isomorphic-git, file granularity and `profile: false`: success, 12 records, no profile report, and
108 telemetry timing reads. This supports unnecessary disabled-path work, not a measured violation
of a formal overhead threshold. Planning confirmed the cause by following active recorder creation
to `timing.start(true)` in the projection recorder and shared timing implementation.

Correction boundary: expose/use the session's effective recording state and select existing no-op
recorder families and DAG bindings at composition. Cover Git, extraction, built-in projection,
line diff, output and plugin projection. Do not infer success from the requested profile flag alone,
spread profile conditionals through product operations, or change recorder semantics/public APIs.

Exit evidence: actual disabled and initialization-degraded worker composition selects no-op behavior
without telemetry timing/accumulation work; normal enabled composition still records correctly.
Exercise both Git adapters and representative file/plugin paths, preserve application results,
JSONL/checkpoints and initialization warnings, and retain owner/recorder regressions. Count telemetry
clock activity rather than forbidding unrelated application clock reads. Direct no-op object tests
alone are insufficient. No formal timing threshold or zero overall overhead is inferred from this fix.

### R2: Bound asynchronous metric collection during finalization

Status: confirmed; mandatory before M1; not implemented by this planning update.

[`LocalMetricReader.collectSnapshot()`](../../src/execution/telemetry/local-metric-reader.ts)
calls `collect()` without a timeout. Plugins receive standard Meter objects and can register async
observable callbacks. Report filtering occurs after SDK collection, so an unlisted metric callback
can still delay finalization. The installed SDK awaits callback settlement when no timeout is given.

Both review and planning used an enabled real `WorkerTelemetrySession`, a plugin-scoped observable
gauge, and a manually unresolved Promise. The callback ran and finalization was pending after a
100 ms observation; resolving the Promise allowed completion with the original application result.
This is a functional liveness reproduction, not a benchmark or a proposed timeout value.
Deferring it because collection changes are unlikely to conflict would leave a known violation of
M1 failure isolation: completed product work cannot return its result while telemetry waits.

Correction boundary: use the SDK's supported finite metric-collection timeout; preserve diagnostics,
partial/unavailable signal status, later shutdown and the original application result. Specify the
finite default and its rationale with the implementation; do not reuse the observation's 100 ms
as a requirement or add a new CLI option without a separate design decision. Keep the change within
collection/session infrastructure and its canonical failure-isolation documentation.

Exit evidence: real asynchronous observable callbacks, including an unlisted plugin metric, exercise
normal completion, rejection and non-settlement. Non-settlement must yield a bounded finalization
result with diagnostic evidence and continued resource cleanup; application success and failure
classification are preserved. Verify finalization idempotence and behavior after a delayed callback
settles, without an injected failure flag being the sole evidence. Tests need their own finite
cleanup/deadline and must not leave the runner waiting indefinitely.

A timeout bounds waiting; it does not cancel arbitrary plugin activity or preempt synchronous code
blocking the event loop. Do not expand this correction into a plugin sandbox or process supervisor,
or promise forced termination of such code. Update durable documentation to describe the actual bound.

### C1-C6: Required portions and optional follow-up

These proposals are not blanket M2 acceptance conditions. Preserve operation-owner call sites;
take optional refactoring only through a separately justified, bounded decision.

| ID  | Observation and accepted disposition                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | YAML catalogs, runtime metadata and profile-view metadata require coordinated edits. M3 candidate: generate only needed runtime metadata from canonical YAML at development/build time, with no production YAML parser. Reduce independently maintained definitions, not just visible line counts; do not change catalog policy at M1/M2 by implication.                                                          |
| C2  | Instrument descriptions, units and histogram buckets repeat across factories. M3 candidate: small shared construction helpers, preserving semantic recorder methods. A local improvement required by existing M2 work is possible; an across-the-board rewrite is not scheduled.                                                                                                                                  |
| C3  | Span start/context/catch/end logic repeats, partly because GitAdapterError has different policy. M3 candidate: separate lifecycle mechanism from error policy while preserving context, error classification and exactly-once ending. Not a prerequisite for M1.                                                                                                                                                  |
| C4  | SDK histogram/attribute validation and report validation overlap but guard different boundaries. M2 related work may clarify ownership and document responsibility; broad consolidation is an M3 candidate. Do not remove defensive validation merely because checks resemble one another.                                                                                                                        |
| C5  | Direct no-op tests missed production selection; injected lifecycle failures missed a real async callback stall. Actual-path regression tests for R1/R2 are mandatory at M1. Wholesale removal/replacement of production test hooks is an M3 candidate, not a new release condition.                                                                                                                               |
| C6  | Migration acceptance/provenance tooling differs from lasting performance regression tooling. Incorporate ownership and retirement criteria into existing M2 system-test organization and T13C work. Preserve evidence and required checks; do not remove the gate before M2 acceptance. Record the separately reviewed gate-retirement timing after the initial release, as required by current publish guidance. |

### Implementation, review and validation sequence

The current conversation only updates documents and saves checkpoints. Next use a separate bounded
implementation conversation on the current redesign planning checkpoint, with R1 and R2 saved as
separate commits. Read this section, canonical telemetry/verification and contributor build/test
guidance, then inspect the exact named composition, recorder, collection and session paths. Allowed
changes are the R1/R2 implementation, their real-path regression tests and directly affected durable
docs. Exclude C1-C6 general refactors, presentation, workspace moves, dependency upgrades, thresholds,
formal measurements and publish-gate changes. Return exact commits, commands/results and residual risks.

Follow with a separate independent review of the fixed correction diff and its affected dependencies.
Then update cumulative Windows/Linux functional and installed-package validation for the corrected
candidate using the canonical commands. Preserve fresh source/bundle identities and explicitly assess
the production delta; previous 681a1a5 or 08661ce evidence is historical, not a pass for modified code.
These builds and validation commands may take substantial external execution time; warn before starting.
Formal performance measurement stays in M2, with a new post-integration candidate as described above.

Stop correction scope growth at the R1/R2 exit criteria. New concrete failures return to planning;
do not fold optional cleanup into a repair loop. After acceptance, update M1 evidence/current status,
confirm the actual integration base and proposed merge result, and request explicit human permission
to create `feature/otel-redesign` into `integration/v0.13.0`. The human chooses and performs the merge.

### M1: Integrate without claiming release readiness

Before merging:

- close the accepted R1/R2 blockers above with actual-path tests, independent review and updated
  cumulative functional/package evidence for the corrected candidate;
- verify result/JSONL/checkpoint equivalence, operation ownership, and telemetry failure isolation
  against the canonical verification matrix;
- pass the applicable complete repository and installed-package checks from
  [build/test/release guidance](../contributing/build-test-release.md);
- review M0 results and explicitly triage every known performance failure; do not integrate an
  unaddressed material regression as though it were merely missing evidence;
- complete the limited domain-local placement and contributor reading routes, preserving recording
  points, attributes, no-op behavior, and extraction control flow;
- preserve an immutable migration candidate with revision, complete release bundle and dependencies,
  content hashes, harness revision, environment, and fixture identity;
- define and verify how the M2 release blockers prevent accidental publishing. The existing
  `validate:release` command is not evidence of formal telemetry performance acceptance. Keep
  integration CI usable while making release readiness explicit; and
- review the cumulative result and each proposed merge result, then follow the human-approved branch chain above.

Mechanical moves belong before integration to reduce later conflicts. General helper extraction,
recorder API redesign, and large documentation rewrites are not prerequisites for those moves.
Partial performance coverage must remain labeled partial.

After the final human-operated integration merge, branch all further work from `integration/v0.13.0`. Other feature work can proceed.
Do not continue accumulating changes on a parallel long-lived redesign branch. Keep T13B and T13C
open and retain these handoffs until their release obligations are complete.

### M2: Close the v0.13.0 release obligations

| Obligation                      | Required evidence                                                                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original performance acceptance | All repository calibration targets, legacy captures, both comparison matrices, aggregation scale, and other cataloged volume/memory/behavior checks; any exception has the required evidence and explicit acceptance |
| Profile readability             | Representative commit, file, and plugin output plus partial/unavailable cases reviewed by the human; formatter tests alone do not establish usability                                                                |
| System-test organization        | A private `tests/system` workspace with the first release-CLI workflow migration, explicit commands, dependency boundaries, and checked TypeScript for its owned tooling                                             |
| Contributor navigation          | Clear product-versus-telemetry reading routes, instrumentation placement guidance, and separate guidance for recorder changes and collection infrastructure                                                          |
| Final candidate                 | Functional/package checks and applicable formal performance acceptance on the actual release candidate; changes since the frozen migration candidate are assessed explicitly                                         |
| Closure                         | T13B accepted, T13C completed, release blockers closed, stable facts moved to durable docs, and temporary handoffs removed                                                                                           |

Stage system-test migration after the measurement path works. Pure planner/statistics tests remain
unit tests of the harness; collector tests that need internal implementation access stay with their
owning package. Do not make every existing test type error or every test-directory move a release
prerequisite. Keep the existing required checks running while their owners/commands are migrated.
Include C6's migration-only versus lasting-check ownership and gate-retirement criteria in these
existing M2/T13C tasks. C4 responsibility clarification belongs only where related work touches it;
C1-C5 general simplifications are not additional M2 release gates.

Freeze the migration candidate for attribution, and separately verify the final release candidate
for shipment. Later feature costs must not be silently attributed to telemetry or accepted by
reusing older passing results. Diagnose changed behavior against the frozen candidate; apply the
existing explicit exception process where necessary. Do not silently recalibrate a frozen fixture.

### M3: Future work

External export, collector/backend integration, analysis platforms, broader reusable instrumentation
abstractions, and migration of unrelated system tests belong in separately scoped future work.
Local SDK integration already exists; future work is not described as the first SDK adoption.
These ideas must not automatically become v0.13.0 blockers.
The C1-C5 follow-up candidates above also belong here except for the explicitly required R1/R2
tests and limited M2 responsibility clarification. None is an automatic implementation commitment.

## Session boundaries

The current conversation preserves the original review, incorporates the human-approved disposition,
removes the review report, and checkpoints documentation only. The next implementation/review/
validation conversations follow the R1/R2 sequence above. Generic continuation instructions preserve
these boundaries. After reintegration, use a separate M2 planning conversation to order presentation,
system-test organization, candidate freezing, formal measurements, and T13C by their dependencies.

Use separate bounded implementation, measurement, diagnosis, and review assignments as described
in the [collaboration guidance](../agents/collaborative-work.md#bounded-implementation-and-measurement-sessions).
Measurement operators execute fixed inputs and return evidence; they do not repair code or retry for
a favorable result. Warn before long external execution. Never reuse a mutable development
`dist` as the preserved measurement bundle or modify Docker Desktop's managed distribution.
