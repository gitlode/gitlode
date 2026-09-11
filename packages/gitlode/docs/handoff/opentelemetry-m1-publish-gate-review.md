# M1 publish gate: independent review packet

## Final slice acceptance

Independent re-review accepted G1 at `681a1a5b53bd0aa957dae72d9fd9684da7ff467a`, retained G2
acceptance, and accepted the gate slice with no remaining concrete failure path. The reviewer
confirmed the five-file scope, complete per-target report identity/subcheck matrix, fail-closed
negative cases, independent literal test oracle, preserved exception paths, and unchanged G2/wiring.
The live record remained blocked. Independent checks: focused gate suite 50/50 with no skips,
strict validator typecheck, and target diff check. Format results were not rerun in this review.

The planning owner confirmed HEAD `f00c22c418ad2999cfcc404b479ebb39fce1d28a`, a clean worktree and
the blocked record on receipt, and accepts this outcome. Next is
[cumulative M1 validation and candidate preservation](opentelemetry-m1-cumulative-validation.md)
in a new conversation. This acceptance does not complete M1 or permit publishing. The review
instructions and rejected intermediate outcomes below are history, not outstanding correction tasks.

## Focused re-review after correction round 2

Resume the existing gate review conversation. Target `681a1a5b53bd0aa957dae72d9fd9684da7ff467a`
against parent `77d49f3711368b4bc1ac9d5047c5bd6d90123298`. G2 remains accepted; only G1 and directly
affected paths need review. The planning owner confirmed matching HEAD, clean worktree, the blocked
live record, the five-file scope, and `git show --check` on receipt. This is intake, not acceptance.

Use the accepted [diagnosis and finite checklist](opentelemetry-m1-g1-coverage-resolution.md) as the
review boundary, with the [round-2 outcome](opentelemetry-m1-publish-gate-correction.md#correction-round-2-outcome).
Verify all five target_on report-validity identities, the eight exact pass-only subchecks, forbidden
exceptions/unknown keys, and exact comparison-evidence linkage. Check that the independent literal
test oracle closes the earlier shared-incomplete-inventory gap. Preserve complete reviewed exceptions
for report_size/prohibited_host_spans and confirm G2/wiring stayed unchanged. Do not reopen unrelated
accepted obligations or add a new evaluator/measurement requirement.

Reported Windows validation is one focused file / 50 passing tests, strict validator typecheck,
format write/check, and pre/post-commit Git checks. Inspect or rerun only focused evidence needed
to judge the correction, identifying actual checks versus implementation reports. No full suite,
release pipeline, installed-package validation, formal measurement, or long empirical workload is
planned. Do not invoke publisher-capable commands, change files, commit, merge, or freeze a candidate.

Return reviewed OID, G1 accepted or the remaining concrete failure path, gate-slice acceptance with
G2 retained, and evidence checked. If accepted, the planning owner assigns cumulative M1 validation.
If the same coverage issue remains after this second correction round, invoke bounded diagnosis
on that exact discrepancy rather than another automatic local patch or broader checklist expansion.

The routing and review assignments below are historical; they do not supersede this round-2 request.

Current assignment: diagnosis is complete and its
[minimal resolution](opentelemetry-m1-g1-coverage-resolution.md#planning-acceptance-and-next-assignment)
is accepted for correction round 2. Await that fixed implementation checkpoint before focused
re-review of G1. G2 remains accepted; the gate remains blocked. Earlier diagnosis-routing statements
below record the preceding phase and do not instruct a repeated diagnosis session.

## Correction round 1 re-review outcome

At `f7d8a01bd75231b15136707ab40e2b21adf16b1b`, G2 is accepted with no required corrections. G1 is
not accepted: target_on repository-sidecar report existence/schema validity, complete signal status
for spans/counters/histograms, and empty diagnostics are not explicit required outcomes in the gate.
Size and prohibited-span checks alone allow an incomplete positive record. The planning owner
confirmed this discrepancy between `requiredTelemetryRepositoryChecks`, the performance contract,
and `evaluateRepositoryProfileReport`; gate acceptance remains blocked.

The reviewer reported actual HEAD `69f0521f0f104dbb0ff2a77646f3887ccaaa5fae`, handoff-only later
changes, clean worktree, blocked record, passing diff/show checks and strict typecheck, and 39/39
focused gate tests. The reported 87/17 broader run was not repeated. Planning intake confirmed
matching HEAD/clean state and inspected the contract/evaluator, without rerunning tests.

Next is [bounded G1 coverage diagnosis](opentelemetry-m1-g1-coverage-diagnosis.md) in a fresh
conversation before correction round 2. G2 remains accepted. The assignments/outcomes below are
history; do not repeat the original review or start another correction without this diagnosis.

## Focused re-review after correction round 1

Resume the existing gate review conversation. Review correction checkpoint
`f7d8a01bd75231b15136707ab40e2b21adf16b1b` and its correction diff, using the initially reviewed
`21a6c4d8f602eececcf189e756c4c4e5e093359f` for context. Record actual HEAD and separate later
planning-only edits. The planning owner confirmed the correction HEAD, clean worktree and live
blocked record on receipt. G1/G2 implementation is reported complete; acceptance remains pending.

Read the [correction outcome/mapping](opentelemetry-m1-publish-gate-correction.md) and the original
G1/G2 findings below. Focus on the corrected paths and affected dependencies:

- G1: exact applicable calibration/capture/comparison and report/aggregation/parity/behavior/RSS
  obligations; omission, duplicate, unknown, wrong-scope and non-accepting-state rejection. Check
  positive fixtures against the canonical obligations, not just the validator's own constants.
- G2: actual Git commits and appropriate ancestry; legacy baseline and reused candidate evidence
  remain distinct; evidence ID/source product/harness/destination match individual approvals.
  Reject dangling/mismatched reuse without requiring harness ancestry against product history.
- Confirm no blanket exception now waives missing calibration or behavior, no unnecessary evidence
  matrix was added, and that gate code still validates attestations rather than recomputing results.
  Assess maintainability where it affects correctness, without turning optional refactoring into
  another mandatory redesign.
- Preserve the previously checked command wiring, blocked live record, main context, final-candidate
  record-only diff and ordinary CI independence. Inspect any affected shared-target definitions.

Reported Windows checks: four suites (`release-acceptance`, `performance-harness`,
`performance-workflow`, `performance-supervisor`) with 87 passing tests and 17 Linux-only skips;
14 supervision cases and 3 supervised-workflow cases account for the skips. Strict validator
typecheck, gitlode lint, formatting and Git checks passed. Identify evidence actually inspected
or rerun; do not treat these counts as Linux execution. Reproduce a concrete concern with bounded
tests if needed, not the full release pipeline. Cumulative Windows/Linux installed-package and
Linux-only execution remain the later M1 validation assignment.

Return exact OID, separate G1/G2 acceptance decisions, any remaining concrete failure path and
contract reference, checked evidence, and whether this gate slice is accepted. No code changes,
commit, publish-capable command, Version PR, merge, formal measurement, or candidate freeze.
There is no planned long empirical workload. The planning owner assigns cumulative validation only
after acceptance. If the same issue remains, report it for the bounded correction/diagnosis process.

## Review outcome

Not accepted at `21a6c4d8f602eececcf189e756c4c4e5e093359f`. The independent reviewer returned two
required corrections: G1, missing explicit coverage of M2 performance obligations; G2, frozen
candidate/harness provenance checked only as hexadecimal strings. The planning owner inspected
the corresponding schema and candidate checks and accepted both findings. The live record stays
blocked. Next: [correction round 1](opentelemetry-m1-publish-gate-correction.md), followed by focused
re-review in this review conversation. The original review assignment below is history.

Reviewer-reported evidence: target/parent existence and ancestry, handoff-only later changes, clean
worktree, diff check, strict typecheck, gate suite 19 passed, workflow suite 13 passed / 3 skipped,
and gate plus harness suites 46 passed. The three workflow skips are Linux-only supervision integration
on Windows; gate tests have no skips. The reviewer also reported the real root publish command in
an Actions-main-like context exited at the blocked guard without reaching Changesets. This is evidence
already obtained, not an instruction to repeat a real publisher-capable command in correction.

The full suite, release build, lint/format, publint/installed-package and Linux results were not rerun
in review. Earlier totals remain implementation reports, not cumulative cross-platform acceptance.
The Windows `safe.directory` path issue failed closed and is an optional diagnostic improvement,
not a security bypass or a third mandatory correction.

## Assignment and identity

Use a new independent review conversation. Target `21a6c4d8f602eececcf189e756c4c4e5e093359f` against
parent `651f0a53001405b752beef52b31ac21b50c311ac`. Record actual HEAD and worktree state; later handoff
commits are not part of the implementation diff. The live record must stay blocked throughout review.
Placement is already accepted; M1 remains open. No formal measurement, long repeated workload, or
actual publish is planned. Warn before any unexpectedly substantial test/setup operation.

Read `AGENTS.md`, the [gate implementation packet](opentelemetry-m1-publish-gate.md), the recovery
plan's M1/M2 conditions, canonical performance/verification and exception contracts, and implemented
build/test/release guidance. Apply the refined packet, not superseded tentative proposal details.

## Review focus

1. Schema and acceptance completeness: check required M2 obligations, exact target/comparison
   coverage, duplicates, unknown fields, strict identities/dates, exception details and explicit
   authority, final-candidate attestations or reviewed reuse justification. No missing, failed,
   pending, inconclusive, or malformed evidence may become accepted. Check internal consistency of
   provenance and delta relationships, not just that strings have the right length. External archive
   authenticity is a documented reviewer duty; do not invent a CI artifact-download requirement.
2. Candidate binding: verify commit existence, ancestry and record-only tree differences, including
   relevant dirty/untracked files, with actual temporary repositories where necessary. Final
   validation follows Changesets versioning; scripts, package/lockfile changes and source changes
   after it are not allowable metadata exceptions. Normal ignored build output must remain usable.
3. Publish wiring and context: both supported root commands and the Actions callback must converge
   on the guard before publishing. Verify Actions main/local attached-main behavior, missing history
   failures, full checkout history, and normal CI/Version PR creation independence. Consider failure
   propagation through the actual npm command chain. A mocked continuation not being called is
   narrower evidence than execution of the real guarded shell command; evaluate combined wiring,
   code and test evidence without claiming an unexecuted publish E2E test. If needed use an isolated
   stub publisher with no credentials, never the real repository publish command.
4. Boundaries and lifetime: no automatic gate bypass based on version, absent record, or command
   error; the gate retires by a separately reviewed post-v0.13.0 removal. Credential-holder direct
   invocation or editing policy files remains outside repo enforcement. Distinguish that documented
   boundary from an ordinary supported-command bypass.
5. Shared tooling: inspect `telemetry-performance-targets.ts`, its exact correspondence to canonical
   identities, and the harness import replacement. It must not change measurement behavior, load
   measurement side effects into the validator, or invalidate existing public harness types.
6. Documentation: functional/package checks and reviewed empirical attestation must be distinct;
   describe the actual blocked behavior, evidence availability, candidate-record ordering, and
   retirement accurately without overclaiming authenticity or deployment protection.

## Evidence and output

Inspect available logs/commands and explicitly identify which focused suites contributed to the
reported 32 pass / 3 skipped and which skips are platform-specific. Do not equate the reported full
suite totals with cross-platform release validation. Locate branch-session evidence where available;
state any results known only from its report. Missing counts alone are not a demonstrated defect.
Use targeted tests/typechecks or a bounded reproduction for a concrete concern. The initial sandbox
publint EPERM and reported successful unsandboxed rerun are separate outcomes; no need to repeat
the full suite or installed-package test solely to reproduce prior counts.

Return reviewed OID, accepted or required corrections, concrete failure paths and contract-linked
file references, evidence actually checked, and optional improvements separately. Do not edit files,
commit, merge, publish, create a Version PR, alter the blocked record, freeze a candidate, or run
formal performance tests. If accepted, the planning owner assigns cumulative M1 functional and
installed-package validation on Windows/Linux plus immutable candidate preservation. Gate slice
acceptance alone does not complete M1 or any release obligation.
