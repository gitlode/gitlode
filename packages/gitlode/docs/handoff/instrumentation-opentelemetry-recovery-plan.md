# OpenTelemetry M2 continuation plan

## Authority and current status

The human accepted staged convergence, Linux/WSL2 reference measurement, private `tests/system`
organization, and explicit human PR/merge authority. M0 and M1 are complete. This conversation remains
the trunk planning owner; the human starts branch sessions and returns their outcomes.
Work now continues on `feature/otel-redesign_M2`, created from `integration/v0.13.0`.
Unrelated v0.13.0 development is outside this session's implementation scope.

[PR #111](https://github.com/gitlode/gitlode/pull/111) was human squash-merged at
`7e0055a3f66e38d2f2a8f3554d30c41c2fefb1c0`, parent
`1664798a9f586b1ac4e632d02d3a37cb0c6ebf0d`. Trunk confirmed the local integration branch,
actual remote and initial M2 branch match. Its tree
`d12d76daca57baa9e4d7fd21192e50ef1d96932d` exactly matches the accepted rehearsal, including
the base's domain-design link. [Post-merge CI](https://github.com/gitlode/gitlode/actions/runs/34816748419)
succeeded. Compared with validated `6fd46d3`, only handoff documents differ; existing functional/package
evidence is reused on that explicit content basis, not relabeled under the squash OID.

| Milestone | Status                               | Remaining scope                                                            |
| --------- | ------------------------------------ | -------------------------------------------------------------------------- |
| M0        | complete, one target only            | Preserve historical evidence and environment                               |
| M1        | complete                             | Preserve corrected validation and squash attribution                       |
| M2        | preparation and interactive planning | Full T13B, readability, system-test organization, final candidate and T13C |
| M3        | future, not v0.13.0 gates            | Separately justified capabilities and general refactoring                  |

The live publish acceptance record remains `blocked`. Integration is not formal performance or
release acceptance. The [redesign plan](instrumentation-opentelemetry-redesign-plan.md) retains the
T13B/T13C exit criteria. Canonical design, verification, performance and publish contracts own policy.

## Evidence and branch retention

- [M0 result](opentelemetry-m0-result.md) retains the Linux toolchain, baseline release, calibrated
  target and immutable archive paths. Its one-target measurements are not new-candidate evidence.
- [M1 evidence](opentelemetry-m1-validation-result.md) retains accepted R1/R2, corrected Windows/Linux
  verification, package/runtime identities and the old-versus-new revision boundary.
- The human completed old work-branch deletion and preserved final PR source `acad3ed` as
  `archive/otel-redesign`. The local archive and remote-tracking ref both resolve to
  `acad3ed56e134b1a066332cd3d42eb9c01d931b7`; the separate pre-reset archive remains at
  `b4468342c982d09be09e9c46290bb1ed2d842a36`. Preserve both archive refs.
- The corrected validation archive's `inputs/candidate.bundle` retains T13 `ec0b086`, T13B
  `08661ce` and redesign history through `e2ec15e`, including accepted `6fd46d3`. The archives
  preserve evidence history without restoring completed implementation branches.
- Preserve immutable evidence under `D:\gitlode_test`; do not overwrite archives or use them as
  mutable build directories. Old packets remain in recorded commits and bundles, not active instructions.

## Decisions before M2 implementation

The following order is a planning proposal for human discussion, not an implementation assignment:

1. Apply the history policy below, then specify exact product/harness inputs before formal measurement.
   Keep `7e0055a` as the post-M1 source attribution anchor; no formal candidate or runtime is frozen here.
2. Design readable profile output from representative commit/file/plugin and partial/unavailable
   reports. Agree the reading order and information density before editing the formatter. Preserve
   report semantics and current success-only / quiet behavior unless separately approved.
3. Define the first private `tests/system` slice and implement it separately from presentation.
   Identify lasting system checks versus migration-only tools; retain unit tests with their owners,
   explicit checked TypeScript and the current required command coverage. Do not move all tests at once.
4. After relevant product/harness changes stabilize, preserve a reviewed candidate and harness,
   then execute bounded formal T13B tasks on Linux. Decide baseline calibration reuse explicitly;
   do not silently recalibrate the accepted M0 target or relabel its candidate comparisons.
5. Assess the eventual integrated release candidate, complete required validation and delta review,
   then close T13C and obtain release-authority acceptance through the existing publish gate.

Full formal measurement can take substantial external execution time. Order implementation before
expensive measurements where this avoids invalidating evidence. Pure presentation work must still
be assessed for package/finalization effects rather than assumed irrelevant to performance.

### History and parallel development boundary

The current legacy baseline `76b124e23fcc069be1278629cf01b62ae1456c7a` is an ancestor of `7e0055a`.
Old pre-squash migration candidates are not automatically ancestors of the M2 branch. The existing
publish gate requires legacy <= frozen product <= evidence source <= final candidate <= publish HEAD
for redesigned evidence, with explicit reviewed reuse bindings. Harness revisions need existence,
not product ancestry. The publish tree may differ from the final candidate only at the acceptance record.

### Working history and accepted measurement history

The human clarified that `integration/v0.13.0` enters `main` through a normal, non-squash merge
under the project's GitHub rules. Commits admitted to integration will therefore remain in main.
M2 and its child branches may use any appropriate strategy, subject to human PR/merge approval.

The planning owner's default is:

1. Keep `feature/otel-redesign_M2` as the coordination and cumulative implementation branch.
   Use child branches for bounded slices such as presentation, system-test organization and repairs.
   Checkpoint unfinished work freely on those branches; avoid mixing independent slices.
2. After each slice passes its scoped implementation/review checks, prepare a self-contained commit
   (or a small coherent series) for M2, normally using a human-operated squash merge. Keep temporary
   retries and review corrections on the child history. A completed planning/documentation change
   may also be a coherent commit; commits need not correspond one-for-one with plan units.
3. Before freezing redesigned-product evidence for formal acceptance, inspect the complete history
   that would become reachable from integration. Consolidate any remaining provisional M2 checkpoints,
   remove completed handoff instructions, verify the resulting source and preserve product/runtime
   and harness identities. This is the boundary after which accepted candidate ancestry is retained.
4. Merge the reviewed M2 branch into `integration/v0.13.0` using a normal merge by default, preserving
   the measured source OIDs. This does not mean integration must wait for every release attestation:
   complete implementation slices can be integrated with the gate blocked, while final acceptance
   still covers the eventual combined release candidate. Every such PR requires human permission.
5. Preserve that ancestry through the normal integration-to-main merge. Changesets version/lockfile
   changes, T13C cleanup and any other source changes must be included in the final candidate or
   explicitly assessed before its acceptance record is finalized.

No branch is created, rewritten, pushed or merged by this planning decision. If squash is preferred
for the final M2 PR, choose that before formal candidate binding: integrate the complete reviewed
implementation with publishing still blocked, then bind measurement inputs on the resulting history.
Do not squash away evidence-source commits and later claim tree equality satisfies ancestry.

A failed measurement does not force acceptance of a defective candidate. Preserve the attempt,
implement/review a bounded repair, and create a new descendant candidate. Repeat only affected checks
when the contract and reviewed delta justify reuse; neither favorable automatic retries nor silent
reuse is permitted. Complete repair commits may remain in final history when their reason and
behavior are clear. Harness-only revisions remain separately attributable.

This session does not implement unrelated features. At planned integration/release boundaries, it must
still inspect their actual combined delta and validate the resulting candidate. A passing isolated M2
branch does not by itself establish release readiness for a later combined tree.

## Accepted scope and exclusions

R1 no-op composition and R2 finite asynchronous metric collection are complete and independently
accepted. R2's 1,000 ms SDK timeout does not cancel callbacks or preempt synchronous event-loop blocking.
These corrections are not open M2 implementation tasks. Domain ownership, OTel API contracts and
observation semantics remain unchanged unless a separate concrete issue warrants a design decision.

Do not discard the migration, restore legacy instrumentation, weaken thresholds, remove observations,
or retry automatically for a favorable measurement. The accepted calibration recipe remains in force;
replacing minimum-integer selection with greater timing headroom is not an approved change.

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

Trunk owns interactive design decisions, acceptance, dependency ordering and the next bounded packet.
The human launches implementation, review and measurement conversations. Each packet fixes its source,
scope, exclusions, finite checks and exit evidence. Implementation and formal measurement are separate;
operators return evidence or a diagnosis request rather than repairing code during a measurement run.
Use the [collaboration rules](../agents/collaborative-work.md#bounded-implementation-and-measurement-sessions).

Before every PR, present the exact source/base and obtain human permission. Only the human approves,
chooses squash/merge strategy and performs the merge or branch deletion. No PR or implementation
assignment is authorized merely by this preparation note.
