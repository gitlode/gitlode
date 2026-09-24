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

Corrections required for P1. This is not P2 authorization or a runtime/M2 acceptance decision.

### Reviewed state

- Fixed base: `12b43f911ff9d9e1c9ecab09faa0148b3db2dbe6`.
- Fixed implementation target: `a9a48137cdcd222ba63cd0cf0459f867fa386718`.
- Entry local/remote child-branch tip: `ae9ce5fcbe3fc2d4eb43cc9d960d3c32a456d85f`;
  the target-to-entry delta contained only the assigned review/handoff documentation.
- Entry worktree was clean. The active schema, collectors, worker session, presentation and
  performance path remain v1 as required.

### Mandatory findings

1. **Lifecycle-only compaction can invent whole-signal data loss.**
   `mergeIntoSummary()` copies the caller's `wholeResultUnavailable` flag for every covered kind
   without checking the issue effects. `deriveProfileSignalStatusV2()` then applies that flag
   without checking effects. A `lifecycle_notice` for Counter with the flag set leaves Counter
   `complete` while retained as a detailed record, but the same record becomes Counter
   `unavailable` when it is the sixteenth identity and is compacted. This violates the accepted
   requirements that lifecycle-only issues not invent data loss and that compaction preserve
   semantics. Validate the association between confirmed whole-result evidence and collection/data
   effects, and make the evidence independent of whether the diagnostic is retained or summarized.

2. **Conflicting status/value evidence is silently rewritten without the required validation
   issue.** `deriveProfileSignalStatusV2()` changes an `unavailable` signal with a nonzero retained
   value count to `partial`, but it neither requires validated evidence nor returns/records the
   report-validation issue required by the accepted contract. An accumulator-issued empty snapshot,
   `{ spans: "unavailable" }`, and `spans: 1` therefore produce `partial` with no diagnostic or
   summary. Keep the retained value, but reject the contradictory evidence or produce a bounded
   validation diagnostic so every non-complete result remains explained.

3. **Safe-integer saturation is reported at the exact boundary.** `saturatingAdd()` uses
   `left >= MAXIMUM_COUNT - right`; merging an omitted diagnostic whose count is exactly
   `Number.MAX_SAFE_INTEGER` into a zero-count summary returns the exact value but sets
   `countSaturated: true`. The flag must indicate actual clamping, not an exact representable sum.
   Use a strict overflow comparison and retain prior saturation state.

4. **Malformed semantic fields are converted into false exact evidence.**
   `normalizeDetailLoss()` treats every supplied non-`true` value as `false`, so, for example,
   `{ attributeKey: "invalid" }` is retained as an exact claim that no attribute-key detail was
   lost. Separately, an explicitly invalid diagnostic count such as `0` is normalized to occurrence
   count `1`, indistinguishable from the intentional omitted-count default. This conflicts with the
   P1 invalid-payload and fixed-mask/count invariants. Validate supplied mask members and supplied
   counts; route malformed input to bounded invalid-aggregation evidence (or conservatively disclose
   loss) instead of manufacturing exact values.

The focused tests do not cover these counterexamples. They also do not directly establish bounded
pre-identity work: a probe with 100,000 duplicate kind entries caused 100,000 indexed reads before
canonicalization. The retained set is fixed-size, so this is an evidence/hardening gap rather than a
separate finding, but correction tests should cover work before final serialized-length assertions.

### Independent evidence

- `git diff --check 12b43f9..a9a4813`: passed.
- `npm run build:dev`: passed; this strictly compiles production `src` projects.
- The assigned seven-file Vitest command: 7 files and 107 tests passed.
- The focused test sources were not independently typechecked. The gitlode tooling project has
  `noCheck: true`, and the internal-contracts production project excludes tests. The implementation
  handoff was corrected to remove the unsupported checked-suite claim.
- Read-only built-module probes reproduced all four failure paths above. The focused fallback test
  confirmed that an untrusted getter payload is not read. Implementer-reported lint and architecture
  checks were inspected but not independently rerun in this review.

Residual real-builder failure, worker transport, presentation, simultaneous shutdown,
finalization-idempotence and active-v1 behavior evidence remains deliberately assigned to P2; none
of it changes the P1 corrections-required decision.
