# Stage B round-2 independent review and remaining audit (2026-10-19)

## Assignment

Trunk receives outcome `2709805d8ae55d83ccd25cc65a4a70e3481e2adc` as incomplete only with
respect to its reported runtime handle-audit prerequisite, not as self-accepted implementation.
Review fixed correction `a5dae83e4f55b3631061959bcf1bcd98154130e6` against assignment base
`168c0d33dfaf6e966c05c2cad63cf540a09a35d8`, preserving awareness of the whole standalone launcher.
Read [round-2 outcome](opentelemetry-m2-stage-b-correction-round2.md) and
[the five findings](opentelemetry-m2-stage-b-independent-review.md).

Stay on `feature/otel-redesign_M2_fixture` from this packet checkpoint. Parent M2 `4f09265`, F2
`4ea24d5`, product/no-owner/helper paths remain fixed. P2 remains accepted; Stage B/P1/PR readiness
remain open. Separately review the implemented correction and disposition the outstanding audit;
tool availability is not a reason to defer review of completed fixes.

## A. Independent correction review

Inspect all five failure paths and cross-path effects, including read-error handling, native work
versus cleanup cutoffs, active stop/close on stalled disposal, initial/final filesystem accounting,
and primary/secondary cleanup error and handle ownership preservation. Review actual state transitions
and unknown-settlement paths; successful short cases do not prove delayed paths. Confirm no added
budgets, unsafe close retry, helper integration or unreported post-checkpoint implementation change.

Independently run strict typing and the focused finite Node/native fault checks. Check that native
boundary substitutions exercise real production bodies without erasing the conditions under review.
Inspect saved nine-case and normal-contributor evidence with account/token and fixed-source bindings;
reverify the 127-member seal/hash lengths. Keep independently executed and saved evidence distinct.
Reusing the successful runtime campaign is appropriate absent a concrete new concern. Do not rerun
the full campaign/OS/package suites; use bounded probes only for a specific uncovered failure path.
Stop and preserve evidence if cleanup becomes unknown. Never delete historical roots.

Return accepted/corrections-required for each original finding and the correction slice. This alone
does not accept standalone Stage B, P1 or PR readiness while the separate audit gate remains open.

## B. Specify the smallest runtime handle audit

The implementation session found no existing Sysinternals enumerator. That proves tool absence,
not a handle leak and not that runtime verification is impossible. No dependency/tool installation
is authorized by this packet. Do not build a general handle inspector.

Define the precise oracle: allowed workload stdio/pipe inheritance, exclusion of the launcher job
and control handles, and observed workload absence/output settlement. Map these to concrete handles
and ownership in the actual launch path. Evaluate a narrow diagnostic using existing PowerShell/.NET
and documented Windows APIs versus a scoped external enumerator. Verify API claims with primary
documentation if needed. A numeric handle match alone is not object identity; missing output or a
failed query is not absence. State privilege/architecture prerequisites and coverage limits.

Return one executable audit plan with exact source seam, process setup, observation, positive/negative
sensitivity, identity evidence, safe cleanup and finite bounds. Prefer an invocation-local diagnostic
with no product dependency. Explain what it would prove beyond static HANDLE_LIST and the already
successful transport tests. If an external utility is essential, identify its official source,
version/integrity verification, invocation/permissions/EULA and storage scope for a subsequent decision;
do not download, accept terms, install or run it in this review.

No runtime audit is required in this assignment. If a sufficient existing supported method is already
available, a single bounded read-only audit may be used only without implementation mutation or new
prerequisites; otherwise return the plan and keep the gate pending. Do not waive runtime evidence or
extend the requirement to universal enumeration of all system handles. Any proposed replacement of
the audit oracle must be clearly identified for trunk disposition, never silently accepted.

## Delivery

Record two separate verdicts: correction slice and handle audit (executed/verified or pending with
the concrete plan). If further implementation findings exist, list exact failure paths, not speculative
framework improvements. Append the review here, update routing, format write/check and diff check,
documentation-only commit and normal push, remote/clean/unchanged parent/F2 verification. Remain on
child. Preserve temporary probe/evidence identities and original seals; restore any temporary files.
Warn before process probes about execution time. No implementation repair, helper integration,
Unix P1 repair, PR, merge, freeze, formal measurement or release acceptance update.
