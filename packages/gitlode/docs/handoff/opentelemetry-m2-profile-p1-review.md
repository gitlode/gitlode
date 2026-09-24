# P1 independent review packet

Current assignment: [correction round 1 focused re-review](#correction-round-1-focused-re-review).
The original review packet and outcome below retain the prior findings; their old fixed target is
not the target of this re-review.

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

## Correction round 1 focused re-review

### Fixed inputs and authority

Review independently in a new human-started conversation on `feature/otel-redesign_M2_profile`.

- Pre-correction entry: `ea8fd8d54e21bbd4d4dfd6c20e82810883f10d68`.
- Correction implementation checkpoint: `5f2d03b91471b7c7fb47f62c2fb9e93fb9ddc996`.
- **Full fixed re-review target: `dc6cfbd69e99cbf13ba6ef4191a123ef182627b5`.**
- Original reviewed implementation: `a9a48137cdcd222ba63cd0cf0459f867fa386718`.

The full target is not documentation-only relative to 5f2d03b: it also strengthens the oversized-array
probe from at most three indexed reads to exactly zero. Include that test change. Trunk verified
clean local/actual remote equality at dc6cfbd and checked the correction diff, but has not independently
rerun the reported 112 tests or accepted P1. Subsequent routing-only commits do not move this target.
Verify ancestry, entry/exit OIDs, worktree and actual remote state; investigate any post-target source
changes before reviewing a different state.

Read the four original findings above and the correction matrix in
[the implementation outcome](opentelemetry-m2-profile-implementation.md#p1-correction-round-1-outcome).
Review only those corrections, their affected invariants and concrete regressions. Do not reopen the
accepted normal presentation design or require P2 runtime evidence while active runtime remains v1.
No production/test fixes, P2, PR, merge, freeze or publish are assigned.

### Review and finite verification

1. P1-R1: whole-result evidence must preserve meaning in details, summary and fallback compaction.
   Check effect/coverage association, lifecycle-only and report-delivery distinctions, valid whole
   loss, and mixed summary entries. A retained-versus-compacted change alone must not create loss or
   hide known loss. Confirm the new detail identity/field is documented for P2 consumers.
2. P1-R2: contradictory unavailable status plus retained measurements must not silently become
   partial. Review the explicit rejection contract and test coverage at diagnostic-capacity limits.
   Confirm the P2 inventory requires catching it as report validation, retaining valid measurements
   and siblings, and adding bounded explanation. Do not confuse this recoverable validation path with
   catastrophic whole-builder failure that uses the fixed empty fallback. Runtime proof belongs to P2.
3. P1-R3: distinguish exact representable maximum from overflow in counts, summary and quantities;
   retain prior saturation. Verify independent boundary expectations and unchanged quantity-composition
   rules, not only the shared helper implementation.
4. P1-R4: supplied invalid count/mask evidence must not be normalized to false exact facts. Check
   valid omitted defaults and supplied values, malformed containers/members, conservative invalid
   aggregation, and safe bounded processing. Report a concrete accepted-contract failure if one remains.
5. Preprocessing: verify the length guards precede indexed reads for set-like arrays, their finite
   universe limits, and that rejecting oversized duplicates is reflected in staged normalization
   guidance. Distinguish this from caller allocation and other input-processing paths; the zero-read
   test is not proof that all untrusted processing is universally constant-time. This was a hardening
   gap, not a separate blocker. Check that no normal producer contract is inadvertently excluded.

Run `npm run build:dev` and the seven-file affected Vitest command from the implementation outcome.
The reported result is 112 passed; record your actual counts. Inspect the five pre-correction
counterexamples and their reported fail-before/pass-after evidence. Add bounded independent probes
only for a concrete uncovered concern; no broad fuzz/performance campaign or full release matrix.
Preserve fixed fallback/trusted-snapshot and active-v1 regression coverage. Run fixed-diff whitespace
checks; format write/check when recording the documentation outcome. Test execution does not establish
standalone test-source typechecking. Separate reproduced evidence from implementer-only reports.

### Return and preservation

Return accepted / corrections required for each of P1-R1 through P1-R4, preprocessing assessment,
P1 overall decision, exact fixed target, actual checks, remaining concrete failure paths and explicit
P2 obligations. If a finding remains, batch concrete counterexamples and bounded corrections; do not
start another implementation round during review. Trunk applies the bounded correction/diagnosis policy.

Append the outcome here, preserve a documentation-only checkpoint, push normally to the same child
branch and verify actual remote OID. No force push or parent branch update. Review acceptance does not
authorize P2 automatically; the human returns the outcome and trunk assigns its next bounded packet.

### Correction round 1 re-review outcome

P1 is accepted at the fixed target. This accepts only the staged P1 contracts and primitives; it is
not P2 authorization, runtime profile acceptance, a PR/merge decision, a candidate freeze, or M2
acceptance.

#### Reviewed state

- Fixed target: `dc6cfbd69e99cbf13ba6ef4191a123ef182627b5`; correction checkpoint
  `5f2d03b91471b7c7fb47f62c2fb9e93fb9ddc996` and pre-correction entry
  `ea8fd8d54e21bbd4d4dfd6c20e82810883f10d68` are ancestors in the assigned history.
- Entry local and actual remote child-branch tip:
  `721268157fd434371071f33eb84c52c1f550ebb8`. The worktree was clean. The target-to-entry delta
  changes only four routing/handoff documents; there is no post-target source or test change.
- The fixed target includes the zero-indexed-read strengthening after 5f2d03b. Active schema,
  collectors, worker transport/session, presentation and performance consumers remain on v1.

#### Finding decisions

1. **P1-R1 accepted.** Confirmed whole-result evidence is part of detailed identity, is copied into
   the per-kind summary association, and is accepted only with `missing_observations` or
   `unknown_collection_coverage`. Lifecycle-only and report-delivery-only inputs with that flag
   become conservative invalid-aggregation evidence rather than signal loss. Detailed, compacted,
   mixed-summary and fallback-recompaction paths preserve valid whole loss without allowing retention
   position to create or erase it. The staged contract/catalog documents the new detail field and P2
   producer/consumer responsibility.
2. **P1-R2 accepted.** An unavailable signal with retained values now throws an explicit report
   validation rejection before any silent relabeling. Tests cover empty diagnostics, an unaffected
   empty unavailable signal and a contradictory signal with a full 15+1 diagnostic snapshot. The
   value arrays are not an input to this pure status function and are not mutated or discarded.
   Canonical guidance and the P2 inventory require builder isolation to catch this recoverable
   rejection, retain valid measurements and siblings, and add bounded explanation; it remains
   distinct from catastrophic whole-builder failure and the fixed empty fallback.
3. **P1-R3 accepted.** Saturation uses a strict overflow comparison. Exact
   `0 + Number.MAX_SAFE_INTEGER` and `Number.MAX_SAFE_INTEGER - 1 + 1` remain unsaturated, actual
   overflow clamps, and prior saturation survives later count, summary and known-disjoint quantity
   merges. Unknown/overlapping quantity composition remains unknown rather than becoming a false
   sum.
4. **P1-R4 accepted.** Omitted count still defaults to one and omitted mask members default to
   false. Explicit zero, negative, fractional and non-finite counts, malformed mask containers, and
   non-boolean supplied members are routed to one bounded conservative invalid-aggregation identity;
   they are no longer retained as false exact facts. The validation performs a fixed number of mask
   member reads and exception isolation remains intact.

Preprocessing hardening is also accepted for P1. Kinds, effects, affected-kind entries and per-kind
field arrays check length against their finite semantic universes before indexed iteration. The
100,000-duplicate-kind regression requires zero indexed reads and the staged normalization guidance
records the rejection. This bounds accumulator work after an array is supplied; it does not claim to
bound caller allocation/population or every other input path. Canonical producers use the finite
sets, so the guard excludes no valid normal producer value.

No remaining concrete failure path was found within this focused correction scope.

#### Independent and reported evidence

- `git diff --check ea8fd8d..dc6cfbd`: passed.
- `npm run build:dev`: passed; this is production TypeScript compilation.
- The assigned seven-file Vitest command: 7 files and 112 tests passed. Test execution is not
  standalone test-source typechecking.
- A read-only built-module probe combined an existing mixed summary, lifecycle-only Counter evidence,
  confirmed whole-Counter loss and fallback recompaction. It produced Span `partial`, Counter
  `unavailable`, retained the per-kind whole-loss flag, and kept the 16-entry fallback bound.
- The implementer's pre-correction run of the newly added file reported exactly 5 failures and 15
  pre-existing passes for the four findings plus oversized-array hardening. That fail-before run was
  inspected but not independently reproduced against a temporary old tree; the pass-after state was
  independently reproduced by the 112-test run above.
- Implementer-reported lint and architecture checks were inspected but not rerun. Fixed fallback,
  trusted-snapshot and active-v1 regressions were included in the independently executed affected
  suites.

#### Required P2 handoff

P2 remains unassigned until trunk issues its next packet. It must atomically migrate the catalog,
contracts, collectors/report builder, worker/application transport, presentation bridge and
tooling/performance consumers listed in the implementation handoff. In particular it must catch the
status/value validation rejection inside normal builder isolation, preserve valid values and sibling
signals, emit bounded validation evidence, and never route that recoverable case through the fixed
whole-report fallback. P2 must separately prove real builder-body failure delivery, structured
producer evidence and masks, worker transport, presentation/tool interpretation, simultaneous
shutdown handling, exactly-once finalization, and unchanged application-result/quiet/failed-run
behavior. P3 and later runtime, terminal, performance and publish acceptance remain outside this
review.
