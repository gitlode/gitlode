# OpenTelemetry Redesign Recovery Plan

## Authority and objective

The human accepted this recovery direction on 2026-09-09. It sequences unfinished work from
[`instrumentation-opentelemetry-redesign-plan.md`](instrumentation-opentelemetry-redesign-plan.md)
without replacing the durable [telemetry](../design/telemetry.md),
[verification](../design/telemetry-verification.md), or
[performance](../design/telemetry-performance.md) contracts.

The objective is to restore feature development on `integration/v0.13.0` while completing telemetry
quality and performance acceptance before v0.13.0 is released. Integration acceptance is distinct
from release acceptance. Neither an integration merge nor a test-scale measurement completes T13B,
waives a performance requirement, or constitutes a performance exception.

The work also supports practical experience maintaining OTel instrumentation in a product. Code and
documentation must let a new contributor recognize telemetry concerns and find the relevant guidance
without reading the entire telemetry design to understand extraction.

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
- Do not reset the migration, restore legacy instrumentation, remove observations, relax thresholds,
  or automatically retry for a favorable result. The current calibration recipe remains authoritative.
  Whether to replace minimum-integer calibration with a selection having more timing headroom is an
  unresolved design question, not an approved change.

## Milestones

| Milestone                                  | Status                        | Exit evidence                                                                                                                                |
| ------------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| M0: Executable and diagnosable measurement | complete: one target accepted | Usable reference environment, bounded observable execution, and one complete repository measurement path                                     |
| M1: Integration-ready                      | in preparation                | Functional safety, limited organization, immutable candidate, enforceable release obligations, and reviewed merge into `integration/v0.13.0` |
| M2: v0.13.0 release-ready                  | pending M1                    | Full T13B acceptance, readable profiles, staged system-test organization, documentation, final candidate validation, and T13C closure        |
| M3: Future capabilities                    | deferred beyond v0.13.0       | Separately scoped future plans; not blockers for M1 or M2                                                                                    |

### M0: Establish the measurement path

Use separate bounded assignments for environment preparation, harness repair, and execution.

1. Prepare the existing WSL2 distribution. Record Linux Node/npm/Git versions, filesystem and
   execution paths, available resources, and the preserved legacy release identity. Keep dependency
   installation separate from timed work. Check the entire legacy bundle/dependency closure, not just
   `index.js`. Use Linux tools for both baseline and candidate.
2. Demonstrate external RSS sampling for a child on that environment. Verify the sampling cadence
   required by the performance catalog and distinguish missing samples from a zero measurement.
3. Make the harness diagnosable: expose preparation, pilot quantity, warmup/measured iteration,
   child PID, elapsed time, and completion/failure stage. Keep supervision outside product telemetry
   and avoid high-frequency logging during timed work. Preserve bounded child diagnostics for failure.
4. Establish generous, separately defined preparation and execution deadlines with owned-child cleanup.
   A deadline is a supervision limit, not a performance threshold. Preserve available evidence and
   return inconclusive on expiry; do not leave descendants running or report a timeout as a measured
   performance failure. Review durable supervision contracts before implementing them.
5. Freeze the harness and complete one repository target: calibration, legacy capture,
   `disabled_overhead`, and `profile_overhead`, including the required sidecar evidence. Save each
   attempt and comparison in distinct directories to prevent artifact replacement.

M0 requires valid pass/fail comparison evidence; unresolved inconclusive evidence means the path is
not ready. A valid performance failure can close the measurement-path task, but becomes an explicit
investigation item for M1/M2. It never authorizes ignoring a material regression. A short smoke run
can establish mechanics but cannot substitute for formal wall-clock evidence.

Do not start full-matrix runs while environment support or indefinite waiting is unresolved. Do not
expand this slice into workspace moves, profile UI work, or production telemetry optimization.

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
- review the cumulative result on the integration target, then merge into `integration/v0.13.0`.

Mechanical moves belong before integration to reduce later conflicts. General helper extraction,
recorder API redesign, and large documentation rewrites are not prerequisites for those moves.
Partial performance coverage must remain labeled partial.

After the merge, branch all further work from `integration/v0.13.0`. Other feature work can proceed.
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

## Session packets and current next assignment

The planning session owns this milestone table, decisions, and a concise blocker ledger. Each task
packet names its base revision, allowed files, required reading, commands, exit evidence, and the
conditions requiring a design decision. Return artifact paths and revisions, not a transcript dump.
Measurement operators do not repair code or alter fixtures during a formal run. A separate diagnosis
session handles a concrete failed/inconclusive result. Reviewers inspect the fixed diff and return
contract-linked required corrections separately from optional improvements.

M0 environment preparation is complete. The
[environment handoff](opentelemetry-m0-environment.md) records toolchain activation, immutable release
snapshots, successful child RSS and behavioral smoke probes, archive provenance, and limitations.

M0 is complete: environment preparation, harness supervision and R1 review/freeze, and the
one-target calibration/capture/comparison path are accepted. The
[M0 result](opentelemetry-m0-result.md) records the exact revisions, passing target results,
independently verified archive, and observed execution duration. Full T13B/M2 acceptance remains
open; this evidence covers one target and the preserved candidate only.

M1 placement/navigation is independently accepted at `97235c37a518c829170568f9c32d5ffe2318803b`.
The publish gate, including G1 and G2, is independently accepted at
`681a1a5b53bd0aa957dae72d9fd9684da7ff467a`; see the
[final review outcome](opentelemetry-m1-publish-gate-review.md#final-slice-acceptance). The live record
remains blocked. The human-approved policy stops all supported Changesets publishing, including
plugin-only releases, until M2 is accepted while leaving ordinary CI and Version PR creation usable.

Cumulative Windows/Linux validation and immutable candidate preservation are accepted for source/harness
`681a1a5b53bd0aa957dae72d9fd9684da7ff467a`; the
[result](opentelemetry-m1-validation-result.md) records test coverage, reruns and verified archives.
The immediate next assignment is [cumulative integration review and rehearsal](opentelemetry-m1-integration-review.md)
in a new conversation, with proposed source `134e475b2de9559007e11fb724298395f832c6cf`. This reviews
the cumulative redesign and rehearses the result in an isolated clone without changing live refs.
Reuse passed validation if implementation trees match; do not start formal measurements. M1 remains
open until the reviewed integration actually occurs. Cumulative review accepted the original source,
but final authoritative-ref verification found remote integration at `1664798a9f586b1ac4e632d02d3a37cb0c6ebf0d`,
one handoff-link commit beyond the reviewed local base. Planning rehearsed a conflict-free merge with
result tree `619c389da8a12e36fa8465a611a0c8f28eaad0ea`; implementation inputs are unchanged.
The immediate next action is the [bounded review amendment](opentelemetry-m1-integration-review.md#current-bounded-amendment)
in the existing integration review conversation. No live refs have been changed. The current
conversation owns planning and acceptance. Generic continuation instructions preserve this assignment.

Do not reuse a mutable development `dist` as the measurement bundle. Development and release builds
share that directory. Do not install into or reconfigure Docker Desktop's managed distribution.

## Initial inspection evidence (2026-09-09)

- Source inspected at `3a84de9` on `feature/otel-redesign_T13B`; no source implementation changes
  are part of this planning update.
- `Ubuntu` and `docker-desktop` were running as WSL version 2. Ubuntu reports 26.04 LTS,
  kernel `6.18.33.1-microsoft-standard-WSL2`, and Git `2.53.0`.
- The inspected Ubuntu login shell could not resolve `node` or `npm`. This is not proof that no
  alternative installation exists; the next session must establish an explicit Linux toolchain.
- Ubuntu root is ext4 with roughly 999 million KiB available. `/mnt/d` is a Windows-mounted 9p
  filesystem. `/proc/self/status` is readable; sampling the actual target child is still unverified.
- WSL enumeration required elevated tool execution because the sandbox returned access denied.
  The approved retry was read-only. No WSL settings or installed packages were changed.
- The D-drive archive contains Windows pilot evidence from 2026-09-03 with unsupported RSS and a
  checkpoint-comparison failure. It contains no newly accepted Linux calibration evidence.

The initial toolchain and child RSS blockers were resolved by the subsequent
[environment preparation](opentelemetry-m0-environment.md). M0 is now complete with the accepted
[one-target result](opentelemetry-m0-result.md); full-matrix and release acceptance remain open.
