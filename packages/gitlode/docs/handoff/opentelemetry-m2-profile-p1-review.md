# P1 independent review packet

## Fixed scope and authority

Review P1 primitives independently in a separate human-started conversation. Do not implement P2,
repair production code, create a PR or merge. Design choices accepted by the human are the contract,
not invitations to redesign presentation or future Span aggregation.

- Base: `12b43f911ff9d9e1c9ecab09faa0148b3db2dbe6`.
- Full review target: `a9a48137cdcd222ba63cd0cf0459f867fa386718`.
- First implementation checkpoint: `15968dcc2f8f1c4aa6cf03be965ebd6c127d3960`.
- Accepted design: `d87bfd6fb8d4e874bb78424111f21f78fd6c9a6d`.
- Work branch: `feature/otel-redesign_M2_profile`; remote target matched at trunk intake.

The final target is NOT documentation-only relative to 15968dc: it also changes normalization,
accumulation and tests. Review the whole base-to-a9a4813 diff (12 files), including both implementation
commits. Later planning-only commits do not move the review target. Record actual entry/exit HEAD,
worktree and remote OID; compare post-target changes and stop if unaccounted implementation appears.

Read AGENTS.md, [accepted design](opentelemetry-m2-profile-design.md),
[P1 assignment and outcome](opentelemetry-m2-profile-implementation.md), canonical telemetry,
verification and architecture/domain contracts, plus the changed staged report catalog.
P1 intentionally keeps active v1 runtime behavior; real worker fallback and new CLI acceptance are P2/P3.

## Review questions

1. Contract and normalization: per-kind fields, typed targets, exact/discarded/not-applicable keys,
   typed point attributes, finite/safe numeric invariants, invalid payload handling, detached plain
   values, masks and duration coverage. Does normalization preserve distinctions without accepting
   invalid data or presenting unavailable defaults as observed zero?
2. Bounded diagnostics: independent literal expectations for A/B conflicts, all identity dimensions,
   coverage/effect associations, quantity descriptors, unknown/overlapping losses and saturation.
   Verify 15+1 capacity and 4096 serialized UTF-16 budget, including escaping and fallback broadening.
   Check before-budget copying/identity construction, not merely final retained object length.
3. Summary/status integrity: overflow or target broadening must not restore false completeness,
   attribute-only issues must not invalidate duration numbers, and lifecycle-only issues must not
   invent data loss. Preserve maximum severity, known whole-result unavailability and exact versus
   discarded distinctions. Retained values cannot silently be erased by a broad status claim.
4. Trust and fallback: snapshot origin checks, detachment/freeze and mutation resistance; minimum
   fallback without any safe snapshot; mandatory build-failure record plus 14 prior details/summary;
   no dependency on ordinary builder/snapshot success or unsafe getters. No partial measurement
   buffers may be salvaged. Absence of optional measurement reuse is permitted and intentional.
5. Boundaries: no active version bump, collector/session/view/performance path change or new public
   compatibility promise. Staged exports and catalog/docs must describe actual activation accurately.
   P2 inventory must include all affected consumers; P1 helper tests do not prove runtime delivery.
6. Evidence quality: tests should expose wrong target merging, lost masks/status/severity, over-budget
   intermediates and fallback failures, not simply restate the implementation's constants.

For every mandatory finding, give a concrete failure path or counterexample, an accepted-contract
reference, impact and bounded correction. Batch findings. Distinguish blockers from optional cleanup
and deliberately unimplemented P2 evidence. Do not demand future Span redesign or full formal measurement.

## Bounded independent checks

Inspect actual test/build configuration. Build production with `npm run build:dev`, then run the seven
focused/affected files listed in the P1 outcome (107 passed is the implementer's report, not your own
result until reproduced). Inspect active-v1 regression coverage and candidate contracts separately.
Run `git diff --check` over the fixed diff. Use targeted additional probes only for concrete concerns;
if a temporary mutation is useful, restore it and verify content before ending. Do not commit probes.
No full release matrix, installed-package rebuild, formal calibration or publisher-capable command.

The outcome says focused suites use checked TypeScript, but its listed commands show build:dev and
Vitest. The gitlode tooling project still has noCheck; production projects exclude test sources.
Verify any actual standalone test typecheck evidence before repeating that claim. Separate production
checked compilation from execution of tests; correcting an unsupported evidence statement does not
require fixing unrelated repository-wide test typing. Do not invent successful commands or counts.

Warn before lengthy external build/setup, report progress and retain the first concrete failure.
Format write/check is needed if saving review documentation; inspect any incidental formatter changes
and do not mix unrelated modifications into the review checkpoint.

## Return and preservation

Report accepted / corrections required for P1, findings, exact reviewed OID, independently executed
commands/results, reported-only evidence and residual P2 work. Append a concise outcome here. Correct
misleading checkpoint/typecheck wording in the implementation handoff only when established by evidence;
identify those documentation edits explicitly. No production/test corrections during review.

Save a documentation-only checkpoint on the same child branch and push normally to
`origin/feature/otel-redesign_M2_profile`, verifying actual remote equality. Work-branch backup is
already authorized. Do not force push, delete branches, update M2/integration/main or start P2.
If remote backup is blocked, report the unbacked OIDs and cause. Trunk assigns any correction or the
next P2 packet after the human returns this outcome. Review acceptance alone is not merge permission,
profile completion, a measurement freeze or M2 acceptance.

## Outcome

Pending independent review.
