# OpenTelemetry Redesign Recovery Plan

## Authority and current status

The human accepted staged convergence on 2026-09-09 and branch-history recovery on 2026-09-11.
The objective remains safe integration before full v0.13.0 release acceptance. The
[redesign plan](instrumentation-opentelemetry-redesign-plan.md) tracks unfinished T13B/T13C work;
canonical telemetry, verification, performance, and publish contracts remain authoritative.

M0 is complete. M1 implementation and prior functional validation remain accepted evidence, but
M1 integration is reopened after the human reset. M2 is paused until the intended integration chain
is complete. Resetting branch history does not undo the implementation or waive release obligations.

| Milestone                 | Status                    | Remaining exit                                                                                      |
| ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| M0: Measurement path      | complete, one target only | Preserve the original evidence and attribution                                                      |
| M1: Integration-ready     | reintegration pending     | Prepare the T13B tip, then human-approved PRs and human-operated merges through the parent branches |
| M2: v0.13.0 release-ready | paused pending M1         | Full T13B, readable profiles, staged system-test organization, final candidate and T13C             |
| M3: Future capabilities   | deferred beyond v0.13.0   | Separate future plans                                                                               |

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

Step 4 recovery preparation is owned by the current planning conversation on T13B, starting at
`50159a615843d8c0294b8cf3d7f95754478e8540`. The test environment isolation from
`a6a7073f09231df94e1275b237e3bb276b591c03` is reapplied at `7dc4ca7`; completed handoffs are
consolidated and the [M1 evidence note](opentelemetry-m1-validation-result.md#recovery-step-4-validation)
records the verified delta and current checks separately from historical validation. The next action
after the documentation checkpoint is human inspection and explicit permission for the T13B-to-T13
PR. Do not restore the old M1-complete/M2-next routing or resume M2 before reintegration.

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
  Windows/Linux verification and immutable package/runtime identities. The CI fix changes only tests;
  compare production/package inputs explicitly before reusing that verification for a new tip.
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
- Improve profile readability before release, using representative output for human review.
- Adopt a private `tests/system` workspace in a separate post-M1 slice, moving release-CLI system
  workflows incrementally. Do not move every telemetry test or add public APIs to expose internals.
- Separate implementation, measurement execution, diagnosis, and review sessions using the
  [collaboration guidance](../agents/collaborative-work.md#bounded-implementation-and-measurement-sessions).
- Do not discard the implementation, restore legacy instrumentation, remove observations, relax thresholds,
  or automatically retry for a favorable result. The current calibration recipe remains authoritative.
  Whether to replace minimum-integer calibration with a selection having more timing headroom is an
  unresolved design question, not an approved change.

### M1: Integrate without claiming release readiness

Before merging:

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

Freeze the migration candidate for attribution, and separately verify the final release candidate
for shipment. Later feature costs must not be silently attributed to telemetry or accepted by
reusing older passing results. Diagnose changed behavior against the frozen candidate; apply the
existing explicit exception process where necessary. Do not silently recalibrate a frozen fixture.

### M3: Future work

External export, collector/backend integration, analysis platforms, broader reusable instrumentation
abstractions, and migration of unrelated system tests belong in separately scoped future work.
Local SDK integration already exists; future work is not described as the first SDK adoption.
These ideas must not automatically become v0.13.0 blockers.

## Session boundaries

The current conversation prepares recovery step 4 and reports a reviewable checkpoint. It does not
start M2 or create a PR without explicit approval. Generic continuation instructions preserve these
boundaries. After reintegration, use a separate M2 planning conversation to order presentation,
system-test organization, candidate freezing, formal measurements, and T13C by their dependencies.

Use separate bounded implementation, measurement, diagnosis, and review assignments as described
in the [collaboration guidance](../agents/collaborative-work.md#bounded-implementation-and-measurement-sessions).
Measurement operators execute fixed inputs and return evidence; they do not repair code or retry for
a favorable result. Warn before long external execution. Never reuse a mutable development
`dist` as the preserved measurement bundle or modify Docker Desktop's managed distribution.
