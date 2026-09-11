# M1 publish gate: independent review packet

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
