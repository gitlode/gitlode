# M1 cumulative integration review and merge rehearsal

## Current bounded amendment

The original cumulative review is complete. The planning owner subsequently verified the authoritative
remote base differs from the local reviewed base by one handoff-link commit. Resume the existing
review conversation for the [recorded reconciliation](opentelemetry-m1-integration-review-result.md#authoritative-ref-reconciliation-after-review)
only: base `1664798a9f586b1ac4e632d02d3a37cb0c6ebf0d`, source
`134e475b2de9559007e11fb724298395f832c6cf`, staged merge tree
`619c389da8a12e36fa8465a611a0c8f28eaad0ea`. Confirm the one added link is preserved and there is no
implementation/packaging delta from validated inputs. Return an amended merge recommendation with
these exact parents/tree, not the superseded old-base fast-forward instruction.

This is a short Git/document check with no full tests or formal measurement planned. Do not create
another broad review packet or implementation cycle. Record the amendment in the existing result
document and a documentation checkpoint; do not merge/push live branches. The executor must recheck
the remote base again before acting. The original instructions below describe completed work.

## Assignment and fixed inputs

Use a new independent review conversation. Review cumulative integration readiness and rehearse
the merge in an isolated clone; do not update any branch in the shared repository. Candidate
validation/preservation is accepted; M1 is not complete until reviewed integration actually occurs.

- Proposed integration source: `134e475b2de9559007e11fb724298395f832c6cf`.
- Validated/frozen M1 source and harness: `681a1a5b53bd0aa957dae72d9fd9684da7ff467a`.
- Locally observed integration target: `integration/v0.13.0` at
  `745d3d553e7ddbea430993602ddaa36fe816dfc4`.
- Locally observed parent redesign branch: `feature/otel-redesign` at
  `5a6a810b8621759fb9723d0617aabdf1fbbac631`.

Record actual HEAD/worktree state and refs before and after review. The proposed source is a fixed
checkpoint containing the validated implementation plus seven handoff-document changes. Later
planning commits, including this packet, do not silently change that target. Do not merge only
T13B's small tail while omitting the cumulative redesign: inspect integration-to-source ancestry.
Report remote-ref freshness if available without credentials disclosure or modifying shared refs;
do not claim a locally inspected ref is a confirmed remote head. The executor rechecks refs before
actual integration.

This review covers a substantial cumulative change; source/evidence inspection may take time.
No formal performance run or default full test rerun is planned. Announce any newly necessary long
build/validation before starting and keep progress visible.

## Review boundary

Read `AGENTS.md`, the recovery plan's M1 integration conditions, original redesign unit statuses,
canonical architecture/domain/telemetry/verification and build/test/release guidance, M0 result,
accepted placement/gate reviews, and the M1 validation result. Reuse accepted slice evidence rather
than reopening every solved design question. Review cumulative interactions and contract coverage;
do not substitute either a raw line-count review or prior passing tests alone for that assessment.

Return an M1-condition-to-evidence table covering functional equivalence/failure isolation/operation
ownership, Windows/Linux full and installed-package checks, domain placement/navigation, frozen
candidate identity and complete dependencies, known performance findings, enforceable blocked
publishing, and the actual integration result. M0's one target passes but remains partial evidence
for its older candidate. Do not infer performance acceptance for the M1 candidate or turn remaining
T13B/M2 work into an implicit exception. Verify M2 blockers remain explicit through the merge.

Inspect cumulative changes relative to the actual integration base, with particular attention to
cross-domain imports/exports, CLI/worker packaging and lifecycle, extraction/output equivalence,
failure isolation and the shared publish callback. Distinguish concrete integration defects from
optional refactoring and already deferred profile presentation/system-test work. Accepted gate
attestation policy is not re-opened absent a new material interaction defect.

## Rehearsal and validation reuse

Use a fresh isolated clone with sufficient commit history, not a linked worktree that can update
shared refs. If integration remains an ancestor of the proposed source, rehearse `merge --ff-only`
inside that clone and record base/source/result OIDs and tree hashes. Confirm that differences from
validated `681a1a5...` are exactly the known handoff files, not code, manifests, workflow, tests,
lockfiles or durable contracts. Review those document changes and run applicable format/diff/link
checks. In this exact case, prior two-platform functional/package evidence applies to the unchanged
implementation; explain the reuse rather than rerun an identical full suite.

If ancestry, source identity or content differs, stop the assumed fast-forward path. Report the
specific divergence/conflict and proposed reconciliation; do not invent source resolutions in a
review session. A material merge result requires targeted and applicable cumulative validation on
that actual result before acceptance, with its own recorded identity. Never overwrite or relabel
the preserved M1 candidate. Do not modify production code or the blocked acceptance record.

Review archive identity and selected critical logs/manifests from
`D:\gitlode_test\m1-20260911T052245Z-681a1a5`. The planning owner has verified all 40 indexed hashes;
indicate what you independently check. Windows expected skips were executed on Linux. Preserve the
Windows first-failure/rerun distinction and separate platform package hashes. No publisher-capable
command, Version PR, release, formal calibration, or actual shared-branch merge is permitted here.

## Exit and next owner

Write `packages/gitlode/docs/handoff/opentelemetry-m1-integration-review-result.md` in the planning
checkout and preserve it in a documentation checkpoint. Return exact reviewed base/source/result,
rehearsal method, tree/diff evidence, acceptance or concrete blockers, evidence reused or executed,
and a precise safe merge recommendation. This documentation commit is permitted; updates to live
integration/redesign refs or external posting are not.

If accepted, the planning owner performs the final ref check and assigns/executes the reviewed
integration action. Only then mark M1 complete and start subsequent feature/M2 work from
`integration/v0.13.0`. Do not mark M1 complete in the review result itself.
