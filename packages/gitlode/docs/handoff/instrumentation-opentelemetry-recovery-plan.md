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

| Milestone | Status                         | Remaining scope                                                            |
| --------- | ------------------------------ | -------------------------------------------------------------------------- |
| M0        | complete, one target only      | Preserve historical evidence and environment                               |
| M1        | complete                       | Preserve corrected validation and squash attribution                       |
| M2        | P1 accepted; P2 review pending | Full T13B, readability, system-test organization, final candidate and T13C |
| M3        | future, not v0.13.0 gates      | Separately justified capabilities and general refactoring                  |

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

## Accepted profile design and next assignment

The human-approved [profile design](opentelemetry-m2-profile-design.md), including diagnostic identity
and whole-report fallback corrections, was accepted by trunk at
`d87bfd6fb8d4e874bb78424111f21f78fd6c9a6d`. Local and actual remote M2 both contained this checkpoint
when this plan was prepared. The design conversation is complete. Its examples do not replace
implemented-output review, functional/package checks or performance acceptance.

This is a profile **and report-quality** change: schema v2, bounded structured diagnostics,
measurement availability masks, collector/report propagation, worker fallback, generic presentation
and shared styling are in scope. Observation admission, recorder ownership and Span aggregation
identity remain unchanged. The collector changes cannot be attributed to presentation alone.

P1 is accepted at `dc6cfbd69e99cbf13ba6ef4191a123ef182627b5`, with independent re-review
recorded at `8ea9cfca2fb0cb7ab6455d9805cc1479ff19e932`. All four corrections and preprocessing
hardening were accepted; the reviewer independently ran build and 7 files / 112 tests. This is
primitive acceptance, not runtime or M2 acceptance. P2 returned at
`57ba7537068b00002b2618b2f4a364f9468365c7`; the delta after last implementation checkpoint
`85c48e0ddc82211a899bb11e4aec70bba04eb96d` is outcome documentation only. The next human-started
conversation is [independent P2-R review](opentelemetry-m2-profile-p2-review.md), covering all three
implementation stages and the runtime/consumer boundary. P2 is not accepted; P3 remains unassigned.
The reported 17-file affected tests and gitlode-wide tests are implementer evidence until independently
verified; platform skips must remain explicit. No formal measurement or cumulative package validation
is assigned to this review.

## Session sequence and dependencies

These are scheduling labels, not replacements for T13B/T13C. Each implementation outcome returns to
trunk before the next session. Reviews target exact checkpoint OIDs and affected dependencies;
accepting a preparatory slice does not accept the entire profile feature or publish gate.

| Stage                 | Session responsibility                                                                                                               | Depends on / exit                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| P1                    | V2 types, safe validation, diagnostic identity/retention, status derivation and fixed fallback primitives with focused tests         | Accepted design; current runtime remains v1 until P2; return explicit wiring/migration inventory                                   |
| P1-R                  | Independent contract/primitive review                                                                                                | P1 fixed OID; resolve concrete issues before lifecycle wiring                                                                      |
| P2                    | Collector/report-builder propagation, worker lifecycle/fallback, atomic runtime v2 switch and all report consumers                   | P1 accepted; no mixed-version producer/consumer path; masks never rendered or counted as observed zero                             |
| P2-R                  | Independent data-integrity/failure-isolation review                                                                                  | Existing detection matrix, actual builder failure, diagnostic failure, overflow and shutdown combinations                          |
| P3                    | Generic Scope/name display, precision/escaping, shared style and removal of old per-name view policy                                 | P2 accepted; migrate canonical display/catalog contracts together; no transitional v1 support remains                              |
| P3-R/V                | Independent cumulative review, real commit/file/plugin output and human terminal review, Windows/Linux functional/package validation | Complete profile child branch; runtime output approval and evidence before its integration into M2                                 |
| S-D/I/R               | Separate private tests/system boundary design, bounded migration and review                                                          | Profile schema/tooling stable; preserve commands and checked TypeScript for moved tooling; do not combine file moves with P2       |
| F                     | Trunk history review, candidate/package/harness preservation and measurement-readiness checks                                        | Profile/system slices accepted; no pending source changes affecting timed inputs; exact remotely preserved OIDs and archive hashes |
| T13B execution/review | Bounded Linux operator sessions, then independent evidence review                                                                    | F; calibration/reuse decision, legacy capture, comparisons and aggregation/volume matrix from canonical contracts                  |
| Final/T13C            | Combined release-candidate delta, final Windows/Linux/package evidence, durable documentation and acceptance record                  | Full obligations; account for unrelated integration changes and version/lockfile changes before final acceptance                   |

P1-P3 share `feature/otel-redesign_M2_profile`, created from the remote-backed M2 checkpoint containing
this plan. Use sequential conversations on that branch, not a fresh branch per correction. This keeps
coupled schema/collector/view work off M2 until coherent. P1 may temporarily stage v2-only primitives
beside the active v1 contract; that is not permission for a shipped dual-version protocol. P2 completes
the producer/consumer switch; P3 removes transitional code. Never merge a preparatory checkpoint by
itself into M2 or integration. Meaningful intermediate commits remain allowed and remotely preserved.

Prepare the S-D/I/R packet only after the profile work returns; intended branch is
`feature/otel-redesign_M2_system` from the then-accepted M2 tip. Do not pre-authorize a broad test move.
F and later operator packets must name concrete OIDs, commands, limits, archive roots and failure
return rules before execution. Independent measurement sessions do not repair the candidate.

Canonical updates accompany their actual implementation: P2 owns telemetry/report/collection and
verification contracts (including profile-report.yaml); P3 owns profiling and generic view policy
(including profile-view.yaml and coverage tests). Performance sidecar/aggregation readers and tests
switch with P2; a ProfileReport version bump does not automatically bump unrelated artifact schemas.
Preserve the existing formal requirements for valid reports, complete signals and empty diagnostics.

Do not rerun successful full suites at every checkpoint. P1/P2/P3 use meaningful affected tests;
cumulative Windows/Linux and installed-package validation apply to the complete candidate and relevant
later deltas. Warn before long builds, environment preparation or measurements. Formal T13B can take
substantial external execution time; no automatic retries or threshold relaxation.

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

### Branch, checkpoint and remote preservation rules

| Ref / boundary                            | Purpose and preservation                                                     | Merge method                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `feature/otel-redesign_M2`                | Trunk planning plus accepted cumulative changes; push meaningful checkpoints | Into integration: normal merge after history review and candidate freeze |
| `feature/otel-redesign_M2_profile`        | P1-P3 and review corrections; commit/push even explicitly unfinished stages  | Into M2: human squash after cumulative acceptance                        |
| `feature/otel-redesign_M2_system`         | First system workspace slice and corrections; commit/push independently      | Into M2: human squash after its acceptance                               |
| `archive/otel-m2-profile-design-20260918` | Immutable accepted design at `d87bfd6fb8d4e874bb78424111f21f78fd6c9a6d`      | Never merge as a work branch                                             |
| `archive/otel-m2-product-<oid12>`         | F records exact product OID and immutable runtime/package identities         | Never move; product OID must remain an ancestor of final/publish source  |
| `archive/otel-m2-harness-<oid12>`         | Exact harness OID; may equal product OID                                     | Never move; keep its Git object available to verification                |
| `integration/v0.13.0` -> `main`           | Approved release history                                                     | Normal non-squash merge, as the human specified                          |

Commit at meaningful boundaries and before handing off a session, including unfinished states with
clear residual work and failing/unrun checks. Push those checkpoints to the same named work branch
without force, then verify actual remote OID equality. The human explicitly requested remote
preservation; ordinary work-branch checkpoint pushes are authorized within assigned scope, not just
local commits. Avoid per-edit commits/pushes. If network/permission prevents backup, preserve locally,
report the unbacked OIDs and blocker, and do not describe the checkpoint as remotely protected.
Do not push secrets, raw operator logs or large runtime archives into Git as a substitute for artifact
preservation. Record archive paths/hashes in the outcome; external artifact backup remains distinct.

PR creation always needs explicit human approval naming source/base. Only the human approves/merges
and deletes branches. Work-branch pushes do not authorize integration/main updates. No force push,
shared-history rewrite or branch deletion is implicit in this plan. Preserve source checkpoints and
review attribution until the human confirms safe deletion after squash.

Before F, inspect commits that will become reachable from integration/main. Finished implementation,
reviewed repairs and concise planning/documentation commits may remain; avoid retaining every trial
and correction checkpoint where squash gives a clearer history. This is a SHOULD, not a reason to
lose evidence or redo valid work. Child squashes provide the normal cleanup boundary. If M2 itself
still needs rewriting, propose the exact operation after remote archival and obtain specific approval;
finish it before freezing any redesigned-product evidence. No rewrite is performed by this plan.

At F, create and push the product/harness archive refs before measurement and verify both remote OIDs.
Also preserve immutable runtime, dependencies, fixture identities and manifests. A Git archive ref
alone is neither the tested binary nor performance acceptance. Retain these refs and external archives
through final acceptance; branch deletion must not leave a referenced revision dependent on reflogs.
Measurement sessions use detached fixed inputs. Repairs create descendants, not replacement commits.

After F, default to normal M2-to-integration merge, then normal integration-to-main merge, keeping
measured ancestors. If a final M2 squash is preferred, settle it before F: integrate the coherent
implementation with publishing blocked, then freeze on that resulting history. Equal source trees
do not replace the gate's ancestry requirement. Version/lockfile changes and T13C cleanup must precede
final candidate acceptance; thereafter only the acceptance-record path may differ at publish time.

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
| Profile readability             | Accepted generic display and schema v2 quality reporting implemented; real commit/file/plugin, partial/unavailable and styled/plain output reviewed by the human                                                     |
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

### Early follow-up outside v0.13.0

The accepted profile design identifies Span aggregation/information retention as a concrete early
priority, not merely optional cosmetic cleanup. Preserve its rationale and investigation questions
from design section 9 in a future-work home before closing T13C. No target release is assigned and
it is not a v0.13.0 gate. Expanding currently undetected loss and domain-specific attribute pivots
remain deferred. Do not silently fold these into P1-P3.

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
chooses squash/merge strategy and performs the merge or branch deletion. Only the named P2-R review
is assigned now; later sessions need their own fixed inputs and trunk handoff. No PR is authorized.
