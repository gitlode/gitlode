# M2 profile implementation: P1 handoff

Current assignment: [P3 round 2 focused re-review](opentelemetry-m2-profile-p3-review.md#p3-round-2-focused-re-review).
R2/R3 corrections returned at `c694b69cc964226ccbf07325ee45ab32b6ff2e74`. R1/R4 and P1/P2 remain
accepted; P3 remains unaccepted. Earlier packets are historical context.

## Assignment, source and branch

This packet assigns only P1: schema v2 contracts and bounded issue/fallback primitives with focused
verification. It is not authorization to implement the complete profile redesign in one conversation.
The human starts this separate implementation conversation and returns its outcome to trunk.

Accepted design: `d87bfd6fb8d4e874bb78424111f21f78fd6c9a6d`, including trunk-accepted diagnostic
identity and whole-report fallback corrections. Read [the design](opentelemetry-m2-profile-design.md)
and its [integrated examples](opentelemetry-m2-profile-integrated-review.md); do not reopen adopted
normal layout or release tradeoffs. Current production source is unchanged from that checkpoint.

At entry, verify clean status, actual local/remote M2 tips and design ancestry. The branch base is the
remote-backed `feature/otel-redesign_M2` documentation checkpoint containing this packet. Record its
full OID and confirm any delta from d87bfd6 is planning documentation only. If unrelated source work
has intervened, return that delta to trunk instead of silently changing this assignment's base.
Create/switch to `feature/otel-redesign_M2_profile` from that exact base; never reset an existing
same-name branch. If it exists, verify its provenance before resuming. P2/P3 and correction sessions
will continue this same child branch sequentially after trunk review.

This branch is not merged into M2 until P1-P3 cumulative acceptance. The intended eventual route is
`feature/otel-redesign_M2_profile` -> `feature/otel-redesign_M2`, human squash merge, after explicit
PR-creation approval. No PR or merge is authorized by this packet. No formal candidate is frozen.

## Reading and ownership

Read AGENTS.md, canonical telemetry and verification docs, architecture/domain contracts,
`profile-report.yaml`, current profile-report/normalization types in internal-contracts, and the
execution-owned diagnostic accumulator, report builder and worker session. Inspect current
performance report consumers to return a complete P2 migration inventory.

SDK-independent data contracts/normalization belong to internal-contracts/telemetry. Collection,
diagnostic accumulation and fallback construction belong to execution/telemetry. Presentation owns
human wording, hierarchy, ordering and styling. Do not put presentation dependencies or SDK objects
in the report model or add a new top-level telemetry domain/public plugin API.

## P1 implementation boundary

Implement the accepted v2 representation and bounded mechanisms so they can be reviewed independently
before lifecycle wiring:

- typed targets, effects, coverage, attribute selector, field masks, detail-loss masks, loss quantity
  descriptors, report-delivery provenance and fixed reserved-summary evidence;
- safe validation/canonicalization with per-kind allowed fields, finite numeric requirements and
  independently validated identity components;
- complete diagnostic deduplication identity, quantity merge semantics, bounded copying/broadening,
  15+1 capacity, safe saturation, per-kind effect and maximum-severity preservation;
- numeric availability/status derivation from trusted evidence, independent of retained detail;
- a pure fixed fallback construction boundary that does not call the normal report builder or rely
  on a working diagnostic snapshot. The minimum path has no reusable measurements; do not add a
  recovery buffer or extra collector traversal just to exercise optional snapshot reuse.

For any optional reusable snapshot input, require an explicit trusted completion boundary; an
arbitrary caller cast/raw collector result is not a validity proof. Prefer the design's minimal
empty-array fallback unless an already justified safe snapshot contract is available. Normal and
fallback reports share the intended v2 semantic contract; no alternate renderer is introduced.

Keep the existing runtime and active schema v1 producer/consumer path functioning in this preparatory
stage. Add clearly isolated v2 candidate types/primitives if needed; do not flip the active version
constant while producers still emit v1. Temporary coexistence is internal implementation staging,
not a public dual-version compatibility commitment. List every staged module/name and its P2/P3
replacement/removal owner. Avoid speculative adapters, version negotiation or a long-lived parallel
model. If this boundary cannot be implemented coherently, stop with a concrete coupling explanation
for trunk rather than expanding silently into all collectors and presentation.

Do not wire collector events, modify recorder observation semantics, change Span aggregation keys,
implement the namespace renderer/styling, migrate tests/system, change publish gates or run formal
performance work. P2 owns the atomic runtime switch and all report consumers; P3 owns final UI and
removal of per-observation view policy. Unavailable values must never be passed as real zeroes when
that switch occurs. P1 must not claim runtime fallback or user-visible behavior is implemented.

## Focused evidence

Use independent literal cases for semantic expectations, not only production constants in the test
oracle. Verify:

- attribute A/B conflicts remain separate; exact/discarded/not-applicable selectors differ;
- coverage/effect/field distinctions, canonical ordering and typed point identity;
- known-disjoint versus overlapping/unknown loss amounts, descriptor differences and saturation;
- retention below/at/above 15 detailed records, the reserved summary and 4096 serialized UTF-16
  budget including escaping; no unbounded temporary serialization or lost-target lists;
- broadening cannot claim the enclosing target is wholly affected, and known distinctions survive;
- detail overflow preserves field masks, per-kind effects and original severity without inventing
  measurement loss for lifecycle-only problems;
- partial/no duration contributions, genuine zero, optional extrema and average availability;
- fixed fallback's mandatory record, 14 remaining detailed slots plus summary, unknown prior details,
  no unsafe payload/getter reads and no reliance on the normal accumulator snapshot;
- clone-safe plain report values. If safe snapshot reuse is implemented, reject intermediate/invalid
  inputs and distinguish a valid empty snapshot from absence.

Real builder-body failure, worker transport, cleanup/idempotence and simultaneous shutdown failures
are mandatory P2 evidence, not satisfied by P1 helper tests. Carry them explicitly into the outcome.

Run `npm run build:dev`, focused new tests plus affected existing contract/collection/catalog tests,
`npm run architecture:check` when exports/imports change, applicable lint, root `format:write`,
`format:check`, and `git diff --check`. Record exact commands/files/counts and typing scope; do not
claim strict checking of pre-existing noCheck tests. Production changes must use checked TypeScript.
Full Windows/Linux release/package validation belongs to the cumulative profile stage unless a new
specific concern justifies it earlier. No benchmark matrix or `npm run release`/publish command.
Warn if dependency setup/builds will be lengthy independently of model reasoning.

Keep canonical docs truthful about deployed behavior. Document the implemented v2 primitives and
explicitly staged activation where necessary; do not change the active report catalog version to
pretend P2 is done. Return the exact atomic catalog/consumer updates P2 must perform.

## Checkpoints, remote backup and return

Commit meaningful progress, including unfinished but explained states, before context handoff and
at the end of this session. Push checkpoints normally to `origin/feature/otel-redesign_M2_profile`
and verify actual remote OID equality. This work-branch backup is authorized; do not force push or
update integration/main. Never stage unrelated files, secrets or raw operator archives. If backup
fails, report the unbacked OIDs and cause rather than claiming remote preservation succeeded.

Return base/review-target/final OIDs, actual remote tip, changed files, commands/results, residual
risks, staged-v2 migration inventory, ownership and exact dependencies for P2. Append a concise P1
outcome here; do not create a separate packet per correction. Save/push the documentation checkpoint
after checks. Stop for trunk's independent P1 review assignment; do not start P2 or self-certify
cumulative profile/M2 acceptance. Only the human starts the next conversation or authorizes a PR.

## Outcome

P1 implemented on `feature/otel-redesign_M2_profile`; P2 and PR creation were not started.

### Provenance and checkpoints

- Exact base/review target: `12b43f911ff9d9e1c9ecab09faa0148b3db2dbe6`
  (`feature/otel-redesign_M2` and `origin/feature/otel-redesign_M2` agreed at entry).
- Accepted design ancestor: `d87bfd6fb8d4e874bb78424111f21f78fd6c9a6d`; the delta to the base contained
  planning/handoff documentation only.
- First implementation checkpoint: `15968dc` (`feat: stage profile report v2 primitives`), pushed
  to `origin/feature/otel-redesign_M2_profile` before documentation completion.
- The final documentation/test checkpoint is the tip of that same child branch. No integration,
  main, or M2 branch was updated and no PR was created.

### Implemented P1 boundary

- `internal-contracts/telemetry` now exposes explicitly suffixed schema-v2 candidate contracts and
  normalizers. They cover typed report/Scope/observation/point targets, typed scalar point identity,
  per-kind fields, signal coverage, effects, extent, three-state attribute selectors, detail-loss
  masks, loss quantities, report-delivery provenance, unavailable-field masks, and fixed overflow
  evidence. Finite-number, safe-integer, duplicate-key, histogram, reducer, and field-mask rules are
  validated while producing detached canonical plain values.
- Execution owns a candidate bounded diagnostic accumulator. Complete canonical identity includes
  all accepted distinctions; message and numeric amount are not identity. Known disjoint quantities
  sum with safe saturation, while unknown/overlapping quantities become unknown. It retains the
  first 15 detailed records and one fixed summary, preserving maximum severity, per-kind effects,
  whole-result-unavailable evidence, and fixed detail-loss flags without lost-target/key lists.
- Bounded copying accounts for JSON escaping and broadens point -> observation -> Scope -> report.
  Broadening changes whole-target extent to an unidentified subset and preserves any remaining
  selector, field, effect, kind, and severity evidence. A record whose fixed distinctions still do
  not fit 4096 UTF-16 code units is represented only in the reserved summary.
- Pure numeric-availability and signal-status derivation uses field masks, duration-contribution
  evidence, optional extrema, trusted collection evidence, and retained/summary issue effects.
  Genuine zero remains available; no-duration and mismatched-duration coverage do not become zero.
- The fixed fallback factory never calls the v1/normal builder and does not inspect untrusted input.
  With no accumulator-issued snapshot it emits empty arrays, three unavailable statuses, the
  mandatory report-delivery diagnostic, and unknown prior-detail provenance. A trusted diagnostic
  snapshot is detached and recursively frozen; fallback retention leaves 14 prior detailed slots
  plus the mandatory record and reserved summary. No reusable measurement snapshot or recovery
  traversal was added.
- Active `PROFILE_REPORT_SCHEMA_VERSION`, worker/session, collectors, builder, presentation, and
  performance tooling remain on v1. P1 therefore does not claim runtime fallback or visible profile
  redesign behavior.

### Staged names and owner for removal/replacement

- P2: replace/rename `profile-report-v2.ts` and `normalization-v2.ts` into the active
  `profile-report.ts`/`normalization.ts` contract, remove `V2` suffixes, and change the active schema
  constant/catalog only in the same atomic consumer migration.
- P2: replace `diagnostic-accumulator.ts` with the staged
  `profile-diagnostic-v2-accumulator.ts`; map every existing detection site to structured target,
  coverage, effect, extent, selector, field and quantity evidence.
- P2: integrate the status/fallback portions of `profile-report-v2-primitives.ts` into the active
  report builder/session ownership. Keep the minimal no-measurement fallback unless an independently
  completed measurement snapshot contract is separately justified. Wire real builder-body failure,
  post-build shutdown details and exactly-once finalization.
- P2/P3: retain numeric-availability helpers until the v2 consumer/renderer owns the same rules;
  remove staging-only exports and candidate tests after their assertions move to active contract,
  collection, worker and presentation suites.
- P2: remove the catalog/docs `staged_v2_candidate` wording when activation is real. P3 owns the
  final namespace renderer, styling, and removal of per-observation view policy.

### P2 atomic catalog and consumer inventory

- Contract/catalog: `packages/internal-contracts/src/telemetry/profile-report.ts`,
  `normalization.ts`, and `index.ts`; `docs/design/telemetry-catalog/profile-report.yaml` and
  catalog validation in `test/support/telemetry-catalog.ts` / `test/telemetry/catalog-contract.test.ts`.
- Producers/finalization: `diagnostic-accumulator.ts`, `local-span-processor.ts`,
  `local-metric-reader.ts`, `profile-report-builder.ts`, `worker-telemetry-session.ts`, and their
  telemetry barrel. Existing producers must supply structured evidence and measurement field masks;
  unavailable slots must not be consumed as zeros.
- Worker/application transport: `src/execution/types.ts`, `execute-run.ts`, `worker-client.ts`, and
  `src/index.ts`, plus execution/worker/aggregation child tests. Transport remains one ordinary v2
  report path; fallback does not get a second message type.
- Presentation bridge for the P2 switch: `src/presentation/types.ts`, `presenter.ts`,
  `success-report.ts`, and `reporting/formatters.ts` plus their tests. P3 subsequently replaces the
  temporary consumer behavior with the accepted namespace renderer and styling in
  `profile-view.ts` and reporting modules.
- Tooling/performance consumers: `test/support/performance-harness.ts`,
  `scripts/telemetry-performance.ts`, `scripts/telemetry-aggregation.ts`,
  `scripts/telemetry-aggregation-child.ts`, release-acceptance tooling/tests, and repository profile
  evaluation tests. They must interpret field masks, summary diagnostics, fallback provenance and
  schema 2 rather than treating unavailable values as real zeroes.
- Durable behavior/verification docs: `docs/design/telemetry.md`,
  `docs/design/telemetry-verification.md`, `docs/profiling.md`, and user-visible usage examples when
  the runtime output changes.

### Verification and residual runtime evidence

The P1 production modules are compiled by the strict production TypeScript projects. The focused
test sources are executed by Vitest but do not have standalone checked-TypeScript evidence:
`packages/gitlode/tsconfig.tooling.json` sets `noCheck: true`, and the internal-contracts production
project excludes its test sources. The focused/affected run covered 7 files and 107 tests: active
profile contract/normalization, candidate v2 contract, candidate primitives, local collection,
worker session, and catalog contract.

Final commands:

- `npm run format:write` and `npm run format:check`: passed across all workspaces.
- `npm run lint`: passed across all workspaces.
- `npm run build:dev`: passed.
- `npx vitest run packages/internal-contracts/test/telemetry/profile-contract.test.ts packages/internal-contracts/test/telemetry/normalization.test.ts packages/internal-contracts/test/telemetry/profile-v2-candidate.test.ts packages/gitlode/test/telemetry/profile-v2-primitives.test.ts packages/gitlode/test/telemetry/local-collection.test.ts packages/gitlode/test/telemetry/worker-telemetry-session.test.ts packages/gitlode/test/telemetry/catalog-contract.test.ts`:
  7 files and 107 tests passed.
- `npm run architecture:check`: passed all module/dependency checks; rev-dep configuration lint
  reported one warning and zero errors.
- `git diff --check`: passed.

Changed files are the two staged internal-contract modules and telemetry barrel, their focused test;
the two execution primitive modules and telemetry barrel, their focused test; the profile-report
catalog; canonical telemetry and verification docs; and this handoff. No collector, worker session,
presentation, performance harness, schema-v1 contract, package manifest, or dependency file changed.

P2 must still prove a real throw from the invoked builder body (including after partial validation),
normal-builder call count one, sibling retention for ordinary validation rejection, fallback worker
transport and ordinary presentation, broken normal diagnostic snapshot isolation, simultaneous
shutdown failure, concurrent/repeated finalize identity, and unchanged application-result,
failed-run suppression, quiet, disabled and initialization-degraded behavior. These are deliberately
not claimed by P1 helper tests.

## P1 correction round 1

### Entry and scope

Trunk accepts the four concrete findings in the [independent review outcome](opentelemetry-m2-profile-p1-review.md#outcome)
as correction requirements. P1 remains unaccepted; P2 is unassigned. This is the first implementation
correction round, not a request to reopen the human-approved profile design.

Continue on `feature/otel-redesign_M2_profile`. The reviewed implementation is
`a9a48137cdcd222ba63cd0cf0459f867fa386718`; the review checkpoint is
`2b276e9558fc79b60b8676881dc701375bd05c2c`. Verify a clean worktree, local/actual remote equality,
and that any subsequent entry delta is only this planning documentation. Record the exact entry OID.
Do not reset, create another correction branch, or modify the parent M2 branch.

Limit changes to staged v2 contracts/normalization, execution-owned accumulator/report primitives,
their focused tests, and directly affected staged canonical guidance. Keep active v1 runtime paths,
collectors, worker transport, presentation, performance tooling and publish acceptance unchanged.
Preserve the fixed fallback and trusted-snapshot boundary. If a correction requires an unresolved
product/design choice or expansion into P2, return the concrete dependency to trunk.

### Required corrections and regression evidence

1. **P1-R1: compaction must preserve signal meaning.** Validate the association between
   `wholeResultUnavailable`, confirmed whole-result loss, effects and signal coverage. Preserve
   legitimate evidence across detailed retention and reserved-summary compaction; lifecycle-only
   notices must never invent collection loss. Test the same lifecycle-only input before/after the
   retention boundary and with other summary entries, plus legitimate whole-loss inputs in both
   representations. Keep report-delivery failure distinct from collection failure.
2. **P1-R2: explain contradictory status/value evidence.** Retain valid measurements when an
   `unavailable` status contradicts retained values. Produce bounded validation evidence, or reject
   the contradictory input under an explicit primitive contract; never silently relabel it as
   `partial`. If choosing rejection, document the required P2 failure-isolation handling so it cannot
   become an unhandled application failure. Test empty trusted diagnostics, affected/unaffected
   kinds, and diagnostic-capacity boundaries. Do not discard values to hide the contradiction.
3. **P1-R3: distinguish exact maximum from saturation.** Set saturation only for actual clamping,
   and preserve already-saturated state. Cover `0 + MAX_SAFE_INTEGER`, `MAX_SAFE_INTEGER - 1 + 1`,
   actual overflow and prior saturation. Check occurrence counts, omitted-summary counts, loss
   quantities and malformed-input aggregation wherever they share or propagate this arithmetic.
4. **P1-R4: reject malformed supplied semantic fields.** Distinguish omitted defaults from explicitly
   invalid counts and detail-loss masks. Omitted count may default to one; explicit zero, negative,
   fractional or non-finite count must not become the original issue with exact count one. Supplied
   mask members must be valid booleans; omitted optional members may retain documented defaults.
   Route invalid payloads to bounded invalid-aggregation evidence or explicitly disclosed uncertainty,
   without falsely claiming no detail loss. Test malformed mask containers/members as well as valid
   omitted and explicit values; preserve safe handling of untrusted input.

Use independent literal expectations for these counterexamples. Establish that each regression test
fails against the pre-correction implementation and passes after correction; record how this was
verified. Avoid tests that merely reproduce the helper's own inventory or arithmetic.

The 100,000-duplicate-kind scan is an additional evidence/hardening gap, not a fifth independent
blocker. Add a bounded probe or focused test of processing before identity construction/budget
application (for example indexed reads and attempted copies), and distinguish retained memory,
serialized budget and input-proportional CPU work. Apply a small local hardening change if justified;
otherwise explicitly document the measured limitation and return it to trunk. Do not claim bounded
preprocessing solely from a bounded final JSON length, or introduce a broad new performance gate.

### Finite verification and exit

Run `npm run build:dev`, the existing seven-file affected Vitest command in this packet, lint,
`npm run format:write`, `npm run format:check`, and `git diff --check`. Run architecture checks if
exports or boundaries change. Production compilation and Vitest execution are different evidence:
do not claim the test sources were independently typechecked without a separate successful check.
No formal performance runs, Windows/Linux package campaign or full release validation is assigned.

Preserve progress in checkpoint commits and normal pushes to this child branch; verify actual remote
OID with `ls-remote`. Do not force-push. Return the implementation OID, documentation/final OID,
local/remote state, a four-finding correction/test matrix, preprocessing evidence/limitations and
exact verification results in this same handoff. Do not self-certify P1 acceptance. Trunk will assign
a separate focused re-review after the outcome. No P2, PR creation, merge, candidate freeze or publish
is authorized. Repeated failure of the same issue follows the bounded correction/diagnosis policy.

### P1 correction round 1 outcome

Correction round 1 is implemented on `feature/otel-redesign_M2_profile`. P1 is not self-accepted;
P2, PR creation, merge, candidate freeze and publish work were not started. The branch is returned
for trunk-assigned independent re-review.

#### Provenance and checkpoints

- Exact entry OID: `ea8fd8d54e21bbd4d4dfd6c20e82810883f10d68`. The worktree was clean,
  local and actual remote child-branch tips agreed, and the delta after review checkpoint
  `2b276e9558fc79b60b8676881dc701375bd05c2c` was only the correction assignment in this packet.
- Reviewed implementation remains `a9a48137cdcd222ba63cd0cf0459f867fa386718`.
- Correction implementation checkpoint: `5f2d03b91471b7c7fb47f62c2fb9e93fb9ddc996`
  (`fix: correct profile v2 P1 primitives`), normally pushed and verified equal to the actual remote
  child-branch tip before this outcome update.
- The documentation/final checkpoint is the commit containing this outcome on the same child branch;
  its full local and actual remote OID equality is verified in the return message. No parent M2,
  integration or main branch was updated.

#### Pre-correction regression evidence

The counterexample tests were added first and run against the entry implementation before production
changes. This command failed exactly the five new correction/hardening tests while the 15 pre-existing
tests in the file passed:

`npx vitest run packages/gitlode/test/telemetry/profile-v2-primitives.test.ts`

- 1 file: 5 failed, 15 passed.
- P1-R1 observed lifecycle-only Counter status change from `complete` while detailed to `unavailable`
  after compaction; detailed confirmed whole loss also failed to become unavailable.
- P1-R2 observed no throw for an unavailable Span with one retained value; it was silently rewritten.
- P1-R3 observed `countSaturated: true` for the exact `MAX_SAFE_INTEGER - 1 + 1` boundary.
- P1-R4 retained malformed counts/masks as original exact diagnostics instead of aggregating them as
  invalid input.
- The 100,000 duplicate-kind probe observed 100,000 indexed element reads before identity construction.

#### Correction matrix

| Finding | Bounded correction                                                                                                                                                                                                                                                                                                            | Focused evidence after correction                                                                                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-R1   | `wholeResultUnavailable` is retained in detailed identity and summary evidence. It is accepted only with `missing_observations` or `unknown_collection_coverage`; lifecycle-only and report-delivery-only combinations become bounded invalid-aggregation evidence. Status derivation checks both retained forms defensively. | The same lifecycle-only input remains `complete` below, at and beyond the 15-detail boundary, including with an existing summary. Report delivery remains distinct. Confirmed whole Counter loss is `unavailable` both detailed and summarized. |
| P1-R2   | The pure status primitive rejects `unavailable` plus retained values instead of changing it to `partial`. It does not mutate or discard the values. P2 must catch this normal report-validation rejection inside builder isolation, retain valid values/siblings and add bounded validation evidence.                         | Empty trusted diagnostics, an unaffected empty unavailable kind, and a full 15+1 diagnostic snapshot are covered. Contradictory affected kinds throw in both empty and capacity-boundary cases.                                                 |
| P1-R3   | Saturating addition uses strict overflow, and count/quantity/summary merges preserve an already-set saturation flag.                                                                                                                                                                                                          | Covers exact `0 + MAX_SAFE_INTEGER` summary accumulation, exact `MAX_SAFE_INTEGER - 1 + 1`, actual overflow, a later merge after saturation, occurrence counts, omitted-summary counts and known-disjoint loss quantity.                        |
| P1-R4   | Omitted count still defaults to one; explicit zero, negative, fractional and non-finite counts are rejected. Supplied detail-loss containers and members are validated as booleans; omitted members retain false defaults. Invalid payloads merge into the fixed conservative invalid-aggregation diagnostic.                 | Covers valid omitted/explicit count and false/true mask values, plus null/string/array mask containers and non-boolean members. Nine malformed inputs become one bounded conservative record with occurrence count nine.                        |

#### Preprocessing evidence and limitation

Set-like kinds, effects, affected-kind entries and per-kind fields now reject arrays longer than their
finite contract universe before element iteration. The focused 100,000 duplicate-kind proxy records
zero indexed reads and produces one bounded invalid-aggregation diagnostic. Retained diagnostics
remain 15+1 and serialized structured detail remains bounded independently. This hardening bounds
accumulator preprocessing once the array is supplied; it does not and cannot bound the caller's work
or memory used to allocate/populate that untrusted array. Other independently bounded target/string
copying behavior was unchanged; no broad performance gate was introduced.

#### Verification and changed scope

Final commands on the correction implementation plus outcome documentation:

- `npm run format:write`: passed across all workspaces.
- `npm run format:check`: passed across all workspaces.
- `npm run lint`: passed across all workspaces.
- `npm run build:dev`: passed; production TypeScript projects were strictly compiled.
- `npx vitest run packages/internal-contracts/test/telemetry/profile-contract.test.ts packages/internal-contracts/test/telemetry/normalization.test.ts packages/internal-contracts/test/telemetry/profile-v2-candidate.test.ts packages/gitlode/test/telemetry/profile-v2-primitives.test.ts packages/gitlode/test/telemetry/local-collection.test.ts packages/gitlode/test/telemetry/worker-telemetry-session.test.ts packages/gitlode/test/telemetry/catalog-contract.test.ts`:
  7 files and 112 tests passed.
- `npm run architecture:check`: all module/dependency checks passed; configuration lint reported the
  existing one warning and zero errors.
- `git diff --check`: passed.

Vitest executed the focused sources, but they were not independently TypeScript-checked: gitlode's
tooling project still has `noCheck: true`, and the internal-contracts production project excludes its
tests. No stronger test-source typing claim is made.

Changed scope is limited to staged v2 `profile-report-v2.ts`/`normalization-v2.ts`, the execution-owned
v2 accumulator/status/fallback primitives, their focused test, the staged profile-report catalog and
directly affected telemetry/verification guidance, plus this handoff. Active schema v1, collectors,
worker transport/session, presentation, performance tooling and release/publish acceptance remain
unchanged. The existing P2 inventory and residual real-builder/transport/presentation/finalization
evidence above remain assigned to P2 only after independent P1 re-review.

#### Trunk intake for re-review

Full correction target: `dc6cfbd69e99cbf13ba6ef4191a123ef182627b5`, confirmed equal to actual remote
with a clean worktree. This checkpoint includes both the outcome and a stricter zero-indexed-read
assertion in `profile-v2-primitives.test.ts`; it is not documentation-only relative to 5f2d03b.
Trunk inspected the correction diff without repeating the reported build/test campaign. P1 remains
unaccepted pending the [focused re-review](opentelemetry-m2-profile-p1-review.md#correction-round-1-focused-re-review).

## P2 runtime and consumer migration

### Entry, ownership and session boundary

Continue `feature/otel-redesign_M2_profile` after the independent P1 acceptance recorded in
`8ea9cfca2fb0cb7ab6455d9805cc1479ff19e932`. The accepted implementation is
`dc6cfbd69e99cbf13ba6ef4191a123ef182627b5`; subsequent changes through the review checkpoint are
handoff-only. Verify clean status, ancestry, actual remote equality and the exact entry OID including
this planning packet. Do not recreate/reset the child or update M2/integration/main.

Read the accepted design, its integrated examples, the P1 correction re-review outcome, the P2 atomic
inventory above, and canonical telemetry/verification/catalog contracts. P1 acceptance is established;
reopen a primitive only for a concrete integration defect, recording why and its affected tests.

P2 owns the complete producer/consumer schema switch. P3 owns the new generic namespace renderer,
style and removal of old per-observation view policy. Do not implement P3's layout in this session.
A minimal truthful presentation bridge is part of P2: it must honor availability and explain report
construction failure through the ordinary report path, without pretending final display acceptance.
No new observation, recorder, Span aggregation policy, external exporter or tests/system relocation.

Atomic means a coherent final runtime protocol, not one commit or one uninterrupted conversation.
Use these sequential internal checkpoints on the same child:

1. Activate contracts, migrate existing detection sites/collectors and normal builder with tests.
2. Wire lifecycle/fallback and worker/application transport with failure-isolation tests.
3. Complete presentation/tooling consumers, canonical docs and combined verification.

These are not independently mergeable or accepted slices. Checkpoint and normally push meaningful
progress even if explicitly incomplete. If context or a concrete dependency prevents completing P2,
return a clean committed continuation with exact completed/remaining inventory and failing checks;
do not rush, silently narrow scope or call an intermediate schema state complete. Trunk will assign
the next conversation. Warn before lengthy build/setup operations; formal measurement is not assigned.

### Required implementation contracts

- Replace staging-only v2 names/exports with the active report contract and schema 2. Update every
  consumer in the inventory above and search for additional version/shape assumptions. No active
  v1/v2 dual protocol. Preserve unrelated JSONL/application and performance-artifact schemas.
- Map every existing detection site to target, kind coverage, effects, extent, attribute-key selector,
  field/detail-loss masks, whole-result evidence and meaningful quantity descriptors. Return a finite
  detection-site-to-producer/test inventory, including lifecycle/collection/aggregation/validation
  cases; do not expand detection coverage beyond the accepted design.
- Preserve diagnostic identity distinctions, bounded accumulation, per-kind effect associations and
  count/quantity saturation established by P1. Retained measurement availability survives diagnostic
  compaction. Unavailable numeric slots are never observations of zero; duration average requires
  compatible contribution coverage. Preserve legitimate zero values and valid siblings.
- Catch the status/value validation rejection inside the normal builder's validation isolation.
  Preserve valid measurements and sibling signals and emit bounded explanatory validation evidence.
  Derive an explained partial outcome where appropriate; do not globally catch and drop the report,
  or route this recoverable inconsistency into the catastrophic builder fallback. Verify this path
  with populated measurements and a full diagnostic budget, not only the throwing primitive.
- Catch a real exception from the normal builder body and invoke the independent fixed fallback
  exactly once. Use the accepted no-safe-measurement-snapshot option: empty arrays and unavailable
  results with report-delivery provenance. Do not add a recovery traversal/buffer or salvage partial
  builder data. A builder-entry hook is not evidence of body-failure handling.
- The minimum fallback must survive failure of the normal diagnostic snapshot and avoid inspecting
  thrown payloads. Retain the mandatory build-failure diagnostic within the 15+1 bound, and safely
  incorporate shutdown evidence after cleanup, preserving unknown prior-detail provenance when needed.
  Preserve one cached finalization promise, application result identity, cleanup order and ownership.
- Keep disabled/degraded sessions without profile, no-op selection, success-only/quiet visibility and
  async metric timeout behavior. Use the normal serializable worker report and normal presenter; do
  not add an alternate warning/stderr/transport path for fallback.
- Migrate performance/aggregation/report evaluators and release-acceptance consumers with the runtime
  switch. Preserve complete-signal/empty-diagnostics/schema-validity obligations. Count reserved
  diagnostic summaries and unavailable fields correctly; fallback cannot pass as a healthy empty
  report. Do not relax thresholds, reset live blocked acceptance or relabel historical v1 evidence as
  new schema-2 evidence. Historical artifacts remain bound to their original harness/product OIDs.

### Documentation and finite verification

Update active report/catalog, telemetry and verification contracts with activation; remove staged
claims that are no longer true. Update profiling/usage interpretation only for actual bridge behavior;
leave final namespace/view-policy migration to P3. Record all consumer migrations and residual P3
work in this handoff, avoiding a second normative specification.

Use meaningful focused tests for contracts/normalization, collectors, builder, diagnostic bounds,
worker finalization, worker transport/application integration, presentation bridge, catalog and
performance/aggregation/release consumers. Explicitly cover:

- valid normal data, invalid point with valid siblings, availability masks versus observed zero,
  duration-contribution mismatch and summary compaction;
- recoverable contradictory status/value evidence versus actual builder-body exception;
- builder failure after partial work, broken diagnostic snapshot, simultaneous shutdown failure,
  mandatory fallback retention and no unsafe payload traversal;
- concurrent/repeated finalize, cleanup once, fallback delivered by real worker serialization and
  normal successful presentation, quiet/failed-run suppression, disabled/degraded behavior;
- repository sidecar and aggregation classification of partial/unavailable/fallback reports and
  reserved summaries, without executing formal performance measurement.

Select tests from the actual affected inventory rather than fixing an obsolete test count. Keep the
P1 regression assertions when moving/renaming candidate tests. Run `npm run build:dev`, affected
Vitest suites, `npm run architecture:check`, `npm run lint`, `npm run format:write`,
`npm run format:check`, and `git diff --check`. Typecheck changed tooling using its checked project
or an explicit strict standalone command when its normal project uses noCheck; distinguish this from
Vitest execution and production compilation. Record exact commands/results and any platform skips.
Full Windows/Linux package validation remains the cumulative P3-R/V responsibility; no formal T13B,
release/publish command, acceptance-record update, PR or merge is authorized.

Return implementation and final checkpoint OIDs, local/actual remote equality, clean status,
producer/consumer coverage, regression evidence and explicit residual work. Push normally to this
child, never force-push. P2 is not self-accepted: trunk next assigns P2-R data-integrity/failure-isolation
review at the full final target, including any post-implementation test changes. Do not begin P3.

### P2 implementation outcome

P2 runtime and consumer migration is implemented. P3, PR creation, merge, formal performance
measurement, release/package validation and acceptance-record changes were not started. The result is
ready for the assigned independent P2-R data-integrity/failure-isolation review; it is not
self-accepted.

#### Provenance and checkpoints

- Entry and exact requested base: `8af0b6af5f4630699dc0b95c00a5d6f478acaba8`; the worktree was clean,
  the local child and actual remote child agreed, and accepted P1 target
  `dc6cfbd69e99cbf13ba6ef4191a123ef182627b5` was an ancestor.
- Contract/collector/builder checkpoint: `8f0f8cc8b4135817544131173d9c3fe167b51c13`
  (`feat: activate profile report schema v2`).
- Lifecycle/fallback checkpoint: `ca62c355edd4d8c8ee4d9cdc533a9cf967f01a10`
  (`feat: isolate profile report fallback lifecycle`).
- Presentation/tooling/catalog implementation target:
  `85c48e0ddc82211a899bb11e4aec70bba04eb96d`
  (`feat: migrate profile report consumers to schema v2`).
- Every checkpoint was normally pushed to `origin/feature/otel-redesign_M2_profile`; no force push or
  integration/main/M2 update was performed.

#### Active contract and producer coverage

- Schema 2 is the only active `ProfileReport` protocol. Staging-only v2 contract/normalization names,
  files and exports were removed; measurement normalization, typed target/effect/field/detail-loss
  contracts, 15+1 diagnostics and numeric availability are active SDK-independent contracts.
- Span aggregation maps group overflow to missing-observation evidence, invalid/missing duration to
  incomplete total/average/maximum evidence with a disjoint duration-contribution quantity, invalid
  attributes and reducer conflicts/overflow to exact-key missing-detail evidence, and an unexpected
  processor exception to bounded unknown-coverage evidence. It records duration contribution counts
  and fixed availability masks without changing the aggregation key.
- Metric conversion maps malformed type/attribute/value/histogram and unexpected traversal failures
  to bounded unknown-coverage evidence, point retention overflow to missing-point evidence, SDK
  collection errors to partial coverage, and collection failure/timeout to confirmed whole-result
  unavailability for Counter and Histogram. Retained points carry fixed availability masks.
- Normal report validation canonicalizes each value independently, retains valid siblings, records
  bounded missing-result evidence for invalid values and catches contradictory unavailable status plus
  retained values inside the builder. The contradiction becomes explained partial evidence and never
  invokes the catastrophic fallback.
- Trace/root flush, metric collection, report-hook and shutdown detection sites now emit structured
  lifecycle evidence. Lifecycle-only shutdown notices do not mark measurement signals partial or
  unavailable.

#### Lifecycle and consumer migration

- A real exception from inside the invoked builder body produces the independent fixed fallback once;
  no measurement salvage/retraversal is attempted and thrown payloads are not inspected. The fallback
  uses a trusted diagnostic snapshot when available and otherwise retains unknown-prior-detail
  provenance. Cleanup remains ordered and once-only, concurrent/repeated finalization shares one
  promise, and simultaneous shutdown evidence is retained even when the normal diagnostic snapshot is
  broken.
- The fallback follows the ordinary `ProfileReport` worker/application result path. Disabled and
  initialization-degraded sessions still produce no report; application-result identity, failed-run
  suppression, success-only display and quiet suppression remain unchanged.
- The existing P2 presentation bridge remains intentionally pre-P3: it still uses the old
  per-observation groups/order, but renders unavailable numeric slots as em dashes, preserves genuine
  zero, suppresses unavailable arrays and explains fixed-fallback delivery and reserved summaries in
  the ordinary Profile block.
- Repository sidecar/performance evaluation now requires report schema 2, validates fixed availability
  masks, refuses to invent an ended-span total when calls are unavailable, counts the reserved summary,
  and classifies partial/unavailable status, diagnostics and fixed fallback separately. Historical
  artifact and release-acceptance record schema versions remain unchanged, the live blocked record was
  not edited, and no thresholds were relaxed.
- The active catalog and canonical telemetry, verification, profiling and usage documents describe
  deployed schema-2 behavior. The staged-candidate catalog section was removed.

#### Verification

- Focused contract/collection checkpoint: 3 files, 63 tests passed.
- Lifecycle/fallback/application checkpoint: 4 files, 85 tests passed.
- Combined affected command: 17 files, 261 tests passed and 3 skipped (264 total), covering active
  contracts, collection, diagnostics/fallback, worker lifecycle, execute-run/worker client,
  presentation, catalog, repository sidecar, aggregation, performance harness/workflow and release
  consumer tests.
- `npm test -w gitlode`: 52 files, 702 tests passed and 17 skipped (719 total). Its pretest production
  development build passed.
- Explicit changed-tooling check passed with `npx tsc --ignoreConfig --noEmit --strict --target ES2022
--module NodeNext --moduleResolution NodeNext --types node --skipLibCheck` over `js-yaml.d.ts`,
  `performance-harness.ts` and `telemetry-catalog.ts`. The normal tooling project still has the
  documented pre-existing `noCheck` boundary; an initial wider standalone probe also surfaced
  unrelated pre-existing calibration-workflow typing failures and was not claimed as passing.
- Final `npm run format:write`, `npm run format:check`, `npm run lint`, `npm run build:dev`,
  `npm run architecture:check` and `git diff --check` passed. Architecture config lint reported its
  existing one warning and zero errors.

#### Residual assigned work

- P2-R must independently review the full final target, especially status/value validation isolation,
  diagnostic identity/effect association after compaction, fallback retention with snapshot failure,
  simultaneous shutdown and ordinary transport/presentation/tool classification.
- P3 still owns the accepted generic Scope/namespace renderer, final style mapping and removal of
  `profile-view.ts` per-observation grouping/order policy, followed by its cumulative validation. No
  P3 implementation is present in this outcome.

## P2 correction round 1

### Entry and trunk disposition

Continue `feature/otel-redesign_M2_profile` after review checkpoint
`b9a50f2dae9cddc824ac36ab9976aca11df7cdf3`. Fixed reviewed implementation:
`57ba7537068b00002b2618b2f4a364f9468365c7`. Verify clean status, ancestry, local/actual remote equality
and that later entry changes contain only this planning packet. Record the full entry OID. Do not
reset or update parent branches. This is P2's first correction round; accepted P1 is preserved.

Read the [review outcome](opentelemetry-m2-profile-p2-review.md#outcome), but apply this disposition:

- P2-R2, R3 and R4 are accepted correction requirements.
- **P2-R1's proposed blanket total/max unavailability is not adopted.** The human-approved design's
  sections 5 and 10 explicitly retain mixed-validity total/max with an incompleteness notice; its
  two-call example displays the retained 10 ms total/max and unavailable average. The review conflates
  an available retained number with an exact whole-run total. Do not silently change that agreement.
  Verify/fix the actual producer-to-consumer quality explanation and all-invalid behavior instead.
  Any contradictory canonical wording must be reconciled to that accepted design, not the inverse.
- Actual fixed-fallback worker-thread transport remains a required missing P2 proof, separate from
  the implementation findings. A structuredClone or direct session test alone is insufficient.

### Bounded correction and evidence

1. **P2-R1 qualification: duration quality.** For mixed valid/invalid contributions preserve retained
   total/max, make average unavailable when coverage differs, preserve calls/errors and disclose
   omitted durations. All-invalid duration defaults must not appear as observed zero: affected
   duration fields are unavailable, while a genuine zero-duration contribution stays valid. Verify
   both input orders and diagnostic retention/overflow using real Span processor output through
   builder and bridge/tool interpretation. Confirm notices/effect summaries cannot silently imply
   completeness when details compact. Correct masks or notification propagation only where the
   accepted rule is violated. Record if a reviewed counterexample already behaves as designed;
   do not manufacture a failing regression by adopting the rejected blanket rule.
2. **P2-R2: per-value isolation and honest loss.** Isolate each normalization call so a throwing
   point/getter cannot skip later safely processable array siblings. Handle iterator failure separately:
   preserve safely obtained values, do not retry an untrusted failing iterator or claim an exact count
   of unknown remaining loss. Tests cover throwing-first/middle points, valid siblings, iterator
   failure and correct target/extent/quantity evidence, without catastrophic report fallback.
3. **P2-R3: retain safely known metric identity.** After validated Scope/instrument/attributes,
   point invalidity and retention overflow must carry the narrowest safe target. Invalid attributes
   can justify observation-level broadening, not erasure of independently valid Scope/name. Preserve
   key distinctions when safely known and use the existing budget broadening rules. Test Counter and
   Histogram invalid values, attribute failure and overflow, asserting targets, effects, extent and
   quantities. Do not expand catalog admission or invent identities from unvalidated payloads.
4. **P2-R4: full report validation before acceptance.** Validate the complete active bounded schema
   before repository/performance extraction or healthy acceptance. Cover required record fields,
   permitted masks, finite values, statuses, diagnostic variants and reserved-summary structure/bounds.
   A malformed report must be fail-closed/inconclusive, not repaired into an accepted report by lossy
   normalization. Reuse pure contracts where suitable; avoid divergent duplicated schema definitions.
   Add independent adversarial fixtures for the reported minimal Counter, malformed masks, missing
   fields and malformed summaries, plus valid normal/partial/fallback reports to prevent over-rejection.
   Preserve thresholds, historical artifact schemas and the blocked acceptance record.
5. **Transport proof.** Add a bounded actual worker-entry/client test that induces real invoked
   builder-body failure and receives schema 2 fallback with mandatory delivery provenance. Verify
   unchanged application result content/classification (reference identity cannot cross serialization),
   normal message routing and cleanup. Use an internal test seam/fixture, no public failure flag or
   alternate production message path. Keep timeout finite and ensure the worker is stopped on failure.

For actual defects, demonstrate new tests fail before the correction and pass after it; distinguish
these from already-passing contract clarification cases. Preserve P1 bounds/identity, status/value
validation recovery, lifecycle/fallback and no-op contracts. Limit changes to the affected producer,
builder, consumer validation, transport test seam/tests and directly affected canonical documentation.
No P3 layout/style work, test relocation or broad refactoring. If a new product choice is necessary,
return the concrete issue rather than changing the agreed display or loss semantics.

### Verification and exit

Run build:dev, the P2-R packet's 16 affected suites plus presenter.test.ts, new regression/transport
suites, changed-tooling strict TypeScript check, lint, architecture, format write/check and diff check.
Record exact commands, actual counts, platform skips and source/test typechecking scope separately.
Existing Linux-only supervision skips do not require a new campaign unless a correction changes that
path. No full OS/package matrix, formal performance run or release/publish command is assigned.

Save meaningful checkpoint commits and normally push to this child, verifying actual remote OID.
If continuation is needed, return committed progress and finite remaining work; do not mark P2 accepted.
Append an outcome here with correction/finding/test matrix, explicit R1 disposition and transport
proof, implementation/final OIDs and clean/remote status. Trunk assigns independent focused re-review.
Do not start P3, PR, merge, freeze or acceptance updates. Repeated correction failure follows the
existing bounded correction/diagnosis policy.

### P2 correction round 1 outcome

Correction round 1 is implemented on `feature/otel-redesign_M2_profile`. P2 is not self-accepted;
P3, PR creation, merge, formal performance measurement, candidate freeze and acceptance-record work
were not started. The branch is returned for trunk-assigned independent focused re-review.

#### Provenance and checkpoints

- Entry was clean at `9e6ed7d28f0c5854d7ed6b62cd790f346ad6e4bf`; local and actual remote
  `feature/otel-redesign_M2_profile` agreed. Both review checkpoint
  `b9a50f2dae9cddc824ac36ab9976aca11df7cdf3` and fixed reviewed implementation
  `57ba7537068b00002b2618b2f4a364f9468365c7` are ancestors. The entry delta from the review
  checkpoint contained only the four trunk routing/handoff documents recorded by the review.
- Main correction checkpoint: `bb5740e683e2463636ac4481b562308156703102`
  (`fix: correct profile report integrity handling`). Iterator-result and throwing-middle boundary
  follow-up: `3c0e11480897e6a14cf3d9e0028ec17152f812ea`
  (`test: cover profile iterator isolation boundaries`). Both were normally pushed before this
  outcome; no force push or parent-branch update occurred.
- The final correction target is `3c0e11480897e6a14cf3d9e0028ec17152f812ea`; the documentation
  checkpoint containing this outcome follows it on the same child branch. The final return records
  and verifies that documentation checkpoint and the actual remote OID after all checks.

#### Correction and evidence matrix

| Item      | Disposition and implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Regression evidence                                                                                                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-R1     | Trunk's qualification is applied; the review's blanket total/max unavailability is rejected. Mixed-validity Spans retain valid total/max, contribution mismatch makes average unavailable, calls/errors remain valid, and the structured duration-omission diagnostic makes the signal partial. With no valid duration contribution, total/avg/max derive unavailable from the zero contribution count; a genuine zero contribution remains observed. No producer mask was added because the accepted retained total/max rule would be contradicted by marking those fields unavailable.               | Both valid/invalid input orders run through the real Span processor, builder, presentation formatter and formal tooling consumer. All-invalid defaults, genuine zero and 15-detail-plus-summary compaction are covered; the summary retains `incomplete_measurement_fields`, the section stays partial and the retained zero total/max are not confused with an available average. |
| P2-R2     | Normalization is isolated per obtained value. Throwing values do not discard later siblings. Iterator creation/advance/result-state failure is isolated separately, retains already obtained values, is not retried and records unknown remaining `observation_results` loss; a single rejected value retains exact disjoint quantity one.                                                                                                                                                                                                                                                             | Throwing-first and throwing-middle point getters preserve following siblings. A custom iterator preserves its first safe value, then produces bounded unknown loss without catastrophic fallback. Ordinary invalid siblings remain covered.                                                                                                                                        |
| P2-R3     | Metric conversion carries the narrowest independently validated target. Valid Scope/instrument with invalid attributes broadens only to observation; validated attributes permit exact Counter/Histogram point targets for invalid values, thrown getters and retention overflow. Exact rejected/overflowed points carry missing-observation evidence, entire-point extent and disjoint quantity one.                                                                                                                                                                                                  | Counter NaN, Histogram invalid aggregate, invalid attributes and a bounded overflow fixture assert target, effects, extent and quantity. Overflow testing temporarily narrows the existing limit inside `try/finally`; the production limit/catalog admission are unchanged.                                                                                                       |
| P2-R4     | `normalizeProfileReport()` now validates and detaches the complete active bounded schema: version/status, all required measurement fields, finite values, permitted masks, collection bounds, every detailed diagnostic field and variant, target budget preservation, fixed delivery provenance and the one final reserved-summary shape. It accepts only input structurally equal to the canonical normalized result, so lossy repair, unknown fields and malformed masks cannot become healthy. Formal performance/repository extraction calls this shared contract before measuring or evaluating. | Independent fixtures cover the reported minimal Counter, missing required value, invalid mask, unexpected fields, malformed/misordered summaries, and valid normal, partial and fixed-fallback reports. Existing report-size, prohibited-span, diagnostic and status policies remain unchanged.                                                                                    |
| Transport | An internal-only worker construction seam passes a test-only builder-body failure through `workerData`; it does not add a request field, public failure flag or alternate result message. The real built `worker-entry.js` invokes the normal builder, returns schema-2 fixed fallback through `dispatchWorkerRunRequest`, uses ordinary progress routing and terminates through the client path.                                                                                                                                                                                                      | A finite 15-second worker test compares normal and fallback runs over the same deterministic repository. Classification and all application/checkpoint content other than documented timestamps/elapsed/profile fields agree; fallback has empty measurements, unavailable statuses and mandatory fixed-delivery provenance.                                                       |

The independent review already demonstrated the R2-R4 counterexamples against fixed target
`57ba7537`. The durable regression cases were added with the corrections and pass at the returned
target; this session did not create a detached pre-fix worktree solely to rerun the already recorded
review probes.

#### Changed ownership and scope

- Internal contracts: active normalization/barrel and focused active-report tests now own total
  report validation.
- Execution: report builder value/iterator isolation, metric diagnostic targeting and the internal
  worker test seam/client construction path were corrected; the new actual transport test exercises
  the built entry.
- Formal tooling: `test/support/performance-harness.ts` validates the whole shared contract first;
  its evaluator tests now use complete schema-2 fixtures and adversarial malformed reports.
- Canonical telemetry and verification guidance records mixed-duration quality, per-value isolation,
  narrow metric identity, fail-closed consumer validation and actual worker transport evidence.
- Active collection limits, P1 accumulator/fallback bounds, catalog admission, presentation layout,
  thresholds, historical artifact schemas, publish gates and dependencies were not changed.

#### Verification

- `npm run build:dev`: passed; all changed production TypeScript is inside the strict production
  projects.
- The review packet's 16 suites plus `packages/gitlode/test/presentation/presenter.test.ts` and new
  `packages/gitlode/test/execution/worker-profile-fallback-transport.test.ts`: 18 files, 271 passed
  and 3 skipped (274 total). The three skips are the pre-existing Windows skips for Linux-only
  supervised-workflow entrypoint setup and the `stall=false`/`stall=true` later-child cases; none is
  a new correction path.
- Focused final builder/collection run after the iterator follow-up: 1 file, 45 tests passed.
- Changed-tooling strict check passed with
  `npx tsc --ignoreConfig --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck packages/gitlode/test/support/js-yaml.d.ts packages/gitlode/test/support/performance-harness.ts packages/gitlode/test/support/telemetry-catalog.ts`.
  This is separate tooling-source evidence; Vitest is not claimed to typecheck test sources and the
  documented tooling-project `noCheck` boundary remains.
- `npm run format:write`, `npm run format:check`, `npm run lint`, `npm run architecture:check` and
  `git diff --check`: passed. Architecture config lint retained its existing one warning and zero
  errors.
- No full OS/package/release matrix, `npm test -w gitlode`, formal performance run or publish/release
  command was run; none is assigned to this correction.

#### Focused re-review return

Re-review the final correction target plus this outcome, especially the shared total validator's
diagnostic/summary acceptance, iterator unknown-loss evidence, point-to-observation broadening,
mixed-duration effect-summary behavior and the internal worker seam remaining unreachable from the
public request contract. P2 remains unaccepted until that independent review. P3 remains unassigned.

## P2 R4 correction round 2

### Fixed entry and disposition

Continue `feature/otel-redesign_M2_profile` after review checkpoint
`5ba4de18d485c0092db1ef09ff5e54acbee96433`. Reviewed implementation:
`5bc2cf3c0910a5dc591ae53db05ca846f610cd05`. Verify clean status, ancestry and actual remote equality;
record the exact entry including this documentation packet. No reset or parent branch updates.

Trunk accepts P2-R4-C1 as a required correction. R1 under trunk's duration qualification, R2, R3 and
actual worker transport remain accepted. Do not reopen their implementations without a concrete
regression. The four newly probed contradictions do not currently become healthy evaluator passes:
they are independently rejected by status/diagnostic policy. The remaining defect is that the shared
complete-schema validator accepts contradictory inputs and extraction can consume them. Preserve
this distinction in reporting; do not exaggerate current publish exposure.

### Reconcile contracts before coding

Create a concise invariant-to-check-to-test matrix in this handoff before implementing. Derive it
from the accepted profile design, active report catalog, diagnostic types and real producers. Cover
report status/arrays/explanation, diagnostic target/coverage/affected fields, effects/whole-result
flags, fixed delivery provenance, and per-kind/overall summary associations. Include legal boundary
cases, not just the four negative examples. This is a bounded inventory of existing relationships,
not authorization to invent new telemetry obligations or redesign producers.

If actual accepted contracts conflict, return the precise alternatives to trunk before changing them.
Unknown/lost detail must remain different from absent or not-applicable detail. Broad report/Scope
and multi-kind diagnostics are legal where evidenced. Do not demand exact target/coverage equality
when the contract permits broadening or subsets. A compacted summary's per-kind evidence and unknown
prior-detail provenance cannot be treated as an ordinary detailed diagnostic or fabricated explanation.

#### Pre-implementation invariant/check/test matrix

Entry is clean at `0595eeae51edfd3e4ce7bb1daad89f861761e240`; local and actual remote
`feature/otel-redesign_M2_profile` agree. Review checkpoint `5ba4de18d485c0092db1ef09ff5e54acbee96433`
and reviewed implementation `5bc2cf3c0910a5dc591ae53db05ca846f610cd05` are ancestors. The entry delta
is the assigned routing/handoff documentation only.

| Existing invariant                                                                                                                                                                                                                                                                                                                                                                                                     | Shared-validator relationship check                                                                                                                                                                                                                                                                                                                                                     | Independent regression boundary                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unavailable` means that the corresponding result array is empty; complete-empty and partial-empty remain distinct legal results.                                                                                                                                                                                                                                                                                      | Reject retained values for an unavailable kind; do not infer a status merely from an empty array.                                                                                                                                                                                                                                                                                       | Reject unavailable Counter plus a retained point; accept complete-empty producer output and justified partial-empty producer output.                                                                                                                |
| Every partial or unavailable kind is explained by evidence for that same kind. Data-impact effects are `missing_observations`, `incomplete_measurement_fields`, `missing_attribute_detail` and `unknown_collection_coverage`; unavailable additionally requires confirmed whole-result evidence, except that fixed fallback with no supplied measurement results explains all three kinds through delivery provenance. | Index detailed and reserved-summary evidence by kind/effect. Require partial data-impact evidence and unavailable whole-result evidence, or the exact fixed-delivery exception. A lifecycle-only/report-only notice and unknown prior-detail provenance do not fabricate a kind explanation. Complete signals must not coexist with data-impact or whole-result evidence for that kind. | Reject unexplained partial/unavailable and unrelated lifecycle explanations; accept actual partial, compacted, mixed-duration and fixed-fallback output, including retained total/max with unavailable average. Keep shutdown-only output complete. |
| Observation/point identity and affected measurement fields are narrower evidence than signal coverage; report/Scope targets may legitimately be broad and coverage may contain multiple kinds.                                                                                                                                                                                                                         | For an observation/point target, require its kind to occur in coverage. Require every affected-field kind to occur in coverage. Use subset membership, not exact equality, so broad/multi-kind diagnostics remain legal.                                                                                                                                                                | Reject Histogram target + Counter coverage and Span fields + Counter coverage; accept report/Scope targets, multi-kind coverage, exact point diagnostics and broadened targets with retained detail-loss evidence.                                  |
| `wholeResultUnavailable` is confirmed whole-result evidence, not a generic lifecycle flag.                                                                                                                                                                                                                                                                                                                             | In detailed and per-kind summary evidence, permit the flag only with `missing_observations` or `unknown_collection_coverage`; only flagged evidence can explain unavailable.                                                                                                                                                                                                            | Reject lifecycle-only whole-result claims and unflagged unavailable explanations; accept real collection failure and its compacted summary form.                                                                                                    |
| `report_delivery_failure` and `reportDelivery` are two inseparable parts of the mandatory fixed fallback record. The no-snapshot path supplies no measurement arrays and marks all signals unavailable.                                                                                                                                                                                                                | Require the effect iff provenance is present; require the fixed record's report target, report-build lifecycle identity, whole-target extent, all-kind coverage and non-collection-loss flag. For `measurementResults: none`, require empty arrays and all-unavailable status. Do not accept a summary as a substitute for provenance.                                                  | Reject effect-without-provenance and provenance-without-effect; accept actual fixed fallback and preserve the future structurally valid `trusted_snapshot` provenance boundary.                                                                     |
| Reserved overflow keeps per-kind effects separate from report-wide effects; its coverage is the union of the kinds represented in `effectsByKind`. Unknown prior detail remains disclosure, not invented evidence.                                                                                                                                                                                                     | Require one-to-one kind association between `signalCoverage` and unique `effectsByKind`; validate whole-result/effect association per entry. `reportEffects` does not explain a signal status, and report-delivery failure cannot be represented only by the summary.                                                                                                                   | Reject mismatched/bypass summaries; accept 15+1 compaction, legal per-kind unions, report-only lifecycle effects and the empty unknown-prior-detail summary used by fixed fallback.                                                                 |

### Implementation and regression scope

Correct only the shared active report validator and directly affected contract/consumer tests and
documentation. Add pure relationship checks after structural normalization and before accepting the
report. Remain total/fail-closed for untrusted input; reject contradictions rather than repairing or
silently dropping them. Preserve canonical detachment/equality, bounds and valid producer acceptance.

Required negative cases, each independently demonstrated against the pre-correction implementation:

- unavailable signal with retained measurements;
- unavailable signal without explanatory evidence (also cover partial with missing explanation);
- report-delivery failure effect without required delivery provenance, and the reverse association;
- contradictory point/observation kind, signal coverage and affected-field kind.

Validate evidence by affected kind and effect, not merely the presence of any diagnostic. Unrelated
lifecycle notices must not explain arbitrary collection loss. Apply the catalog's overflow exception
through legitimate reserved-summary semantics, preserving legal compacted evidence and fallback's
report-delivery explanation. Check summary associations in the same finite matrix so the fix does
not leave an equivalent bypass through a different representation.

Positive tests must include actual normal, partial, compacted and fixed-fallback producer output,
complete empty reports, partial empty reports where justified, multi-kind/broadened targets, detail
loss, and retained mixed-duration totals with unavailable averages. Keep shutdown-only notices from
inventing data loss. Use independent expected relationships, not a test oracle derived solely from
validator constants. Formal consumers must reject malformed reports before extraction; verify the
four original cases and valid producer reports at the validator and consumer boundaries.

No weakening thresholds, historical artifact changes, blocked-record update, P3 layout, new public
API or dependency restructuring. If a valid existing producer contradicts a proposed rule, determine
whether the rule is too strong before changing that accepted producer; return any necessary scope
expansion with concrete evidence.

### Finite checks and return

Run build:dev; focused active-report contract, local collection, primitives, worker lifecycle,
performance-harness and repository-sidecar tests; the exact strict tooling check from round 1;
lint, format write/check and diff check. Include additional affected suites only for actual changed
paths. Architecture check is needed if exports/dependencies change. No full OS/package matrix,
formal measurement or repetition of the accepted transport test solely for a matching test count.
Report exact commands, skips and fail-before/pass-after evidence separately from prior results.

Normally commit/push progress on this child and verify actual remote OID. Append the invariant matrix,
implementation/final OIDs, test results and unresolved issues to this handoff. Return for independent
focused R4 re-review; do not self-accept P2 or start P3/PR/merge. If this second correction round still
leaves the same validator issue unresolved, the next step is a fresh bounded diagnosis session under
the collaboration policy, not an automatic third local correction round.

### P2 R4 correction round 2 outcome

R4 correction round 2 is implemented on `feature/otel-redesign_M2_profile` and is returned for
independent focused re-review. P2 is not self-accepted. P3, PR creation, merge, formal performance
measurement, candidate freeze and acceptance-record work were not started.

#### Provenance and checkpoints

- Entry was clean at `0595eeae51edfd3e4ce7bb1daad89f861761e240`; local and actual remote
  `feature/otel-redesign_M2_profile` agreed. Review checkpoint
  `5ba4de18d485c0092db1ef09ff5e54acbee96433` and reviewed implementation
  `5bc2cf3c0910a5dc591ae53db05ca846f610cd05` are ancestors; the later entry delta was the assigned
  routing/handoff documentation only.
- Implementation checkpoint: `477fde1e7407ed9c63835541a32cde4bb8a987ae`
  (`fix: validate profile report relationships`). The documentation checkpoint containing this
  outcome is the returned branch tip and is normally pushed to the same child; no parent branch or
  integration ref is updated.

#### R4 correction and preservation

- The invariant/check/test matrix above was completed before source changes. No accepted contract
  conflict was found.
- `normalizeProfileReport()` still performs bounded structural normalization, canonical detachment
  and exact plain-value equality first. A pure relationship pass then rejects status/array/evidence
  contradictions, kind mismatches among exact targets, coverage and affected fields, invalid
  whole-result associations, delivery effect/provenance mismatches and reserved-summary association
  bypasses. It does not repair or discard untrusted input.
- Partial/unavailable explanation is indexed by affected kind and data-impact effect. Unavailable
  additionally requires confirmed whole-result evidence, except for the exact fixed fallback with
  no supplied measurement results. Lifecycle-only and report-only evidence cannot explain data loss.
- Broad report/Scope targets, multi-kind coverage, complete-empty and justified partial-empty
  reports, detail loss, 15+1 compaction, fixed fallback, shutdown-only notices and retained
  mixed-duration total/maximum with unavailable average remain accepted. Unknown prior-detail
  provenance is disclosure, not fabricated signal evidence.
- Formal extraction/evaluation continues to call the shared validator before consuming values. The
  four review counterexamples, the reverse delivery association and partial-without-explanation now
  fail closed at both the contract and formal-consumer boundaries.
- No producer, builder, accumulator, worker/session, transport, presentation, threshold, historical
  artifact, blocked acceptance record, package manifest, dependency or public API changed. Accepted
  R1 under trunk's duration qualification, R2, R3 and actual worker transport are preserved and were
  not reopened.

#### Fail-before and pass-after evidence

- Against detached start checkpoint `0595eea`, an inline probe independently returned accepted for
  all six contradictions: unavailable Counter with a retained point, unexplained unavailable,
  unexplained partial, delivery effect without provenance, provenance without the delivery effect,
  and Histogram point/Counter coverage/Span affected-field mismatch. The temporary worktree and
  probe were removed after the run.
- The first durable-test run before the source correction failed 3 of 8 grouped active-contract
  tests at the expected relationship assertions. After implementation, the active-contract suite
  passed 8 of 8 and the independent fixtures remain in the committed test.
- `npm run build:dev`: passed. Changed production TypeScript is in the strict internal-contracts
  production project.
- Focused required command over active-report contract, local collection, report primitives, worker
  lifecycle, performance harness and repository sidecar: 6 files and 140 tests passed, no skips.
- Additional directly affected catalog contract: 1 file and 11 tests passed, no skips.
- Exact round-1 tooling check passed:
  `npx tsc --ignoreConfig --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck packages/gitlode/test/support/js-yaml.d.ts packages/gitlode/test/support/performance-harness.ts packages/gitlode/test/support/telemetry-catalog.ts`.
  This is tooling-source evidence; Vitest is not claimed to typecheck test sources.
- `npm run lint`, `npm run format:write`, `npm run format:check` and `git diff --check`: passed.
  Architecture check was not run because no export, import boundary or dependency changed.
- No accepted transport-test repetition, full OS/package/release matrix, formal performance run or
  publish/release command was run. There were no platform skips in the assigned focused suites.

#### Independent re-review return

Re-review the returned tip for P2-R4-C1 only: shared-validator relationship totality, kind/effect
association, fixed-delivery exception, legal broad/multi-kind and compacted evidence, and formal
consumer fail-closed behavior. No unresolved implementation issue is known, but P2 remains
unaccepted until that independent review. P3 remains unassigned.

## Bounded R4 diagnosis

### Purpose, fixed inputs and authority

A fresh human-started diagnosis conversation must reconcile target-versus-signal semantics before
another implementation assignment, following the two-correction convergence rule in
[collaborative work](../agents/collaborative-work.md#bounded-implementation-and-measurement-sessions).
This is a documentation/diagnosis task, not correction round 3 and not a new general code review.

- Branch: `feature/otel-redesign_M2_profile` (continue; do not reset/create another branch).
- Fixed implementation: `280824cab82b85ca87a63eeb73b3e248df8df230`.
- Latest independent review: `8dea610737ab0a835e0b3419ac18c1cf3866393c`.
- Prior round-2 implementation: `477fde1e7407ed9c63835541a32cde4bb8a987ae`.

Verify ancestry, clean status and actual remote equality; record entry OID including this routing
packet. Later documentation does not change the diagnostic implementation target. Read the latest
[R4-C2 review](opentelemetry-m2-profile-p2-review.md#r4-round-2-focused-re-review-outcome), accepted
profile design (especially target loss versus retained siblings), the round-2 matrix above, canonical
report catalog and actual accumulator/status-builder/validator/consumer code. Distinguish original
human-approved semantics from later implementation-authored matrix, docs and test expectations.

Trunk accepts that the demonstrated producer/validator incompatibility blocks P2. Do not treat the
reviewer's proposed line removal as an already approved complete implementation solution. R1 under
trunk's duration qualification, R2, R3 and actual worker transport remain accepted. Six contradictory
report families are correctly rejected; preserve that evidence and the fixed-delivery exception.

### Finite diagnostic questions

1. Define what `wholeResultUnavailable` proves at a point/observation/Scope/report target, what
   `signalStatus` summarizes, and what the per-kind summary preserves after exact target information
   is lost. Identify direction of each permitted implication; distinguish unavailable -> empty plus
   evidence from target loss -> whole-signal loss. Do not invent stronger coverage from summary OR.
2. Trace the reported detailed and 15+1 compacted lost-Counter-target plus retained sibling through
   accumulator, `deriveProfileSignalStatus`, normal builder, shared validator and formal consumer.
   Establish exactly where semantics diverge and whether the affected input is a current detection
   site's output or a legal constructed input through real primitives. Neither evidence category
   should be mislabeled. A valid partial report should be extractable but must not pass healthy
   performance acceptance merely because validation succeeds.
3. Produce a small relationship table for complete/partial/unavailable, zero/nonzero retained values,
   absent/data-impact/whole-target/fixed-delivery evidence, and detailed/summary forms. Mark valid,
   invalid or genuinely unresolved combinations with existing-contract reasons. Include the six
   already-correct rejections and whole-target loss with no retained sibling; do not turn this into
   an exhaustive unrelated telemetry redesign.
4. Explain why the round-2 invariant matrix and its positive/negative fixtures encoded the reverse
   implication. Identify the minimal ownership/document/test changes that prevent that expectation
   from being repeated. Assess the proposed removal of the reverse rule against the table; list any
   necessary companion changes and a finite regression plan with independent expected outcomes.
5. Identify whether a human design decision is actually needed. If existing accepted contracts settle
   the issue, say so and recommend the minimal correction; otherwise describe the exact ambiguity,
   alternatives and compatibility impact. Do not silently amend the accepted design or canonical
   contract during diagnosis.

### Evidence, stop and output

Reuse saved passing suites and review probes; no full build/test matrix just to repeat counts.
Read-only inspection is primary. If needed, run only bounded probes for the two reported producer
cases and a specific disputed boundary (build prerequisites only when necessary). Do not mutate
production/tests or leave probe files; record actual versus reported evidence accurately. No
performance run, package/release validation, P3, acceptance update, PR, merge or parent ref update.

Append a concise diagnosis here: confirmed root cause, contract/implication table, evidence trace,
minimal proposed file/change list, finite positive/negative regression cases, unresolved decisions
(or none), and explicit return to trunk. Historical review outcomes and matrices stay attributable;
label superseded interpretation rather than rewriting old evidence as if it were always correct.
The diagnosis ends once those outputs are concrete; do not start implementing the recommendation.

Run format write/check and diff check for the documentation outcome. Commit and normally push on
this child, verify actual remote equality and clean status. Return exact OIDs. Trunk then decides a
new bounded implementation packet; diagnosis itself does not accept R4/P2 or authorize P3.

### Bounded R4 diagnosis outcome

This diagnosis is complete at instruction checkpoint
`2cc6b2332827f0131e47d6aeb92a7b43838b7ae7` against fixed implementation
`280824cab82b85ca87a63eeb73b3e248df8df230`. Entry was clean on
`feature/otel-redesign_M2_profile`; local HEAD, the local tracking ref and the actual remote ref all
equaled the instruction checkpoint. The fixed implementation, round-2 implementation
`477fde1e7407ed9c63835541a32cde4bb8a987ae` and latest review
`8dea610737ab0a835e0b3419ac18c1cf3866393c` are ancestors. The fixed-target-to-entry delta is the
four expected routing/handoff documents and contains no source or test change.

#### Meaning and permitted inference direction

- A diagnostic `target` names the object for which evidence is held: one point, one observation,
  one Scope, or the report. `extent: entire_target` says the identified target is wholly affected;
  it does not widen that target. Point, observation and Scope targets can therefore have unaffected
  siblings in the same signal kind. A report target is signal-wide only for the kinds in its
  `signalCoverage`, and only when it remains exact with `entire_target`; broadening to report changes
  extent to `unidentified_subset`.
- `wholeResultUnavailable` confirms that the diagnostic's target result could not be obtained or
  safely supplied. It is legal only with `missing_observations` or
  `unknown_collection_coverage`. It does not by itself say that the entire covered signal kind is
  unavailable. The implementation-authored comment in `profile-report.ts` saying "entire covered
  signal result" is too broad and helped create the faulty interpretation.
- `signalStatus` summarizes the supplied result for a whole kind. `complete` has no known
  data-impact loss; `partial` has or may have usable results plus data-impact loss; `unavailable`
  has no supplied results and requires confirmed whole-result evidence for that kind, except for
  the fixed no-measurement delivery path.
- A reserved summary preserves only a per-kind union of effects and whether at least one omitted
  diagnostic had whole-target-unavailable evidence. Its OR no longer identifies which target was
  lost and cannot prove that every target in the kind was lost.

The permitted implications are therefore one-way. `unavailable` implies an empty signal array plus
same-kind whole-result evidence (or the fixed-delivery exception). Data-impact evidence implies that
the status cannot be `complete`. A detailed exact report/`entire_target` loss implies signal-wide
loss for each covered kind. In the other direction, whole-target loss at point, observation or Scope
does **not** imply whole-signal loss; nor does a summary OR. With retained siblings those forms imply
`partial`, not `unavailable`. Zero retained values is array cardinality, not a proof that an
instrumented run observed nothing or that one target covered the entire signal.

| Status and retained values    | Evidence form                                                                                                  | Decision and reason                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `complete`, zero or nonzero   | absent                                                                                                         | Valid; an empty complete signal means successful collection with no observations.         |
| `complete`, zero or nonzero   | any same-kind data-impact or whole-target evidence, detailed or summary                                        | Invalid; known impact forbids complete.                                                   |
| `partial`, zero or nonzero    | same-kind data-impact, without whole-target evidence                                                           | Valid; partial arrays may be empty and retained values remain usable.                     |
| `partial`, nonzero            | detailed whole point/observation/Scope target plus data-impact                                                 | Valid; the target was lost but a sibling was retained.                                    |
| `partial`, nonzero            | summary whole-target OR plus data-impact                                                                       | Valid; compaction lost the target and cannot strengthen the evidence to signal-wide loss. |
| `partial`, zero or nonzero    | exact detailed report target, `entire_target`, whole-result evidence for the kind                              | Invalid; this narrower detailed form really does cover the whole signal domain.           |
| `partial`, zero or nonzero    | absent, lifecycle-only, report-only, or unrelated-kind evidence                                                | Invalid; partial is unexplained.                                                          |
| `unavailable`, nonzero        | any evidence                                                                                                   | Invalid; unavailable must not discard or relabel retained values.                         |
| `unavailable`, zero           | same-kind whole-result evidence, detailed or summary                                                           | Valid; this is the forward unavailable-to-evidence rule.                                  |
| `unavailable`, zero           | data-impact without whole-result evidence, absent evidence, or unrelated lifecycle evidence                    | Invalid; whole-signal unavailability is unexplained.                                      |
| all kinds `unavailable`, zero | exact fixed-delivery/no-measurement provenance                                                                 | Valid fixed exception; it proves report delivery failure, not collection failure.         |
| any other status/values       | delivery effect without provenance, provenance without delivery effect, or target/coverage/field-kind mismatch | Invalid; these are the already-correct relationship rejections.                           |

#### Evidence trace and root cause

The reviewed lost-Counter case is a legal constructed input through production primitives, not an
output currently emitted by a detection site. Current `wholeResultUnavailable: true` sites are the
metric collection failure paths; they use report targets and return empty Counter/Histogram arrays.
The accepted contract nevertheless deliberately supports a wholly lost identified point or
observation alongside retained siblings.

For the detailed case, `BoundedDiagnosticAccumulator` retains the Counter point target, the
collection-loss effect, `entire_target` and `wholeResultUnavailable: true`. With one valid sibling,
`deriveProfileSignalStatus()` first sees data impact and derives `partial`; its whole-result branch
changes the kind to `unavailable` only when the retained count is zero. `ProfileReportBuilder`
therefore emits one Counter and `partial`. `validateProfileReportRelationships()` then computes
`hasWholeResultEvidence` without considering target breadth and rejects every status except empty
`unavailable`. Formal extraction calls this validator, throws, and repository evaluation becomes
inconclusive; the usable sibling never reaches measurement extraction.

At 15+1 capacity, `mergeIntoSummary()` ORs `wholeResultUnavailable` per kind while unioning effects
and deliberately discards exact target identity. Status derivation again produces `partial` because
the sibling count is nonzero. The validator repeats the same rejection from the summary flag, even
though compaction has strictly less evidence. The summary path is thus an especially clear invalid
strengthening: an existential fact (some omitted target was wholly lost) became a universal fact
(the whole kind was lost).

The root cause was introduced in the round-2 invariant matrix and fixtures, not in the original
human-approved design. The matrix correctly stated the forward rule that unavailable needs
whole-result evidence, but its check text said that only flagged evidence can explain unavailable
and implementation turned that necessary condition into a biconditional. The positive fixture then
set `wholeResultUnavailable: true` on broad Scope evidence and expected rejection, deriving its
oracle from the new validator rather than the accepted sibling-retention examples. Ambiguous later
phrasing and the signal-wide TypeScript comment reinforced the reversal. Those historical claims
remain evidence of round 2 but this diagnosis supersedes their reverse implication.

The latest review's two bounded probes are reused as reported evidence: real accumulator/builder
detailed and compacted cases both produced a retained Counter with `partial`, then failed only at
normalization. No probe or full suite was rerun in this diagnosis; source inspection confirms the
reported path and the fixed implementation has not changed since those probes.

#### Minimal correction and finite regression plan

A subsequent explicitly assigned correction should remain within these files and responsibilities:

1. In `internal-contracts/src/telemetry/normalization.ts`, remove the unconditional reverse rule
   from any per-kind whole-target evidence to empty `unavailable`. Preserve unavailable -> empty,
   unavailable -> same-kind whole evidence/fixed delivery, complete -> no data impact, partial ->
   data impact, all six contradiction checks and summary association checks. Retain a target-aware
   reverse check only for an exact detailed report target with `extent: entire_target`; never derive
   it from the reserved summary.
2. In `internal-contracts/src/telemetry/profile-report.ts`, describe
   `wholeResultUnavailable` as applying to the diagnostic target, not automatically to the covered
   signal. Clarify the same one-way rule in `docs/design/telemetry.md` and
   `docs/design/telemetry-catalog/profile-report.yaml`; no schema field or public shape changes.
3. In `internal-contracts/test/telemetry/profile-report-active.test.ts`, replace the
   implementation-derived broad-Scope rejection with independent detailed and summary sibling
   cases. Add the exact report-target boundary rather than accepting every whole-evidence/partial
   combination.
4. In the existing builder/primitives and formal-consumer suites, cover both real-primitives paths:
   detailed lost Counter point plus retained sibling, and the same evidence after 15+1 compaction.
   Both reports must normalize and extract; repository evaluation must remain non-healthy
   (`fail`, because partial/diagnostics are present), not become `pass`. Do not change thresholds.

Finite positive cases are: detailed and summarized lost target plus retained sibling -> partial and
extractable; whole target with no sibling -> empty unavailable and accepted in both retained forms;
complete-empty; justified partial-empty; and the fixed no-measurement fallback. Finite negative
cases are the six preserved families: unavailable with retained data, unexplained unavailable,
unexplained partial, delivery effect without provenance, provenance without delivery effect, and
target/coverage/affected-field kind contradiction. Also retain complete-with-impact rejection and
add exact detailed report/entire-target whole loss plus retained data as invalid. Expectations must
be literal contract outcomes rather than copied validator predicates.

No new human product or compatibility decision is needed for this bounded issue: the accepted
target/extent model, sibling-retention rule, status definition and compaction contract settle the
direction. Human action is still required to authorize the next correction packet and later accept
R4/P2. This diagnosis makes no implementation, test, acceptance, P3, PR, merge, performance or
release change and returns explicitly to trunk.

## Post-diagnosis R4 correction

### Assignment and authority

Trunk adopts the bounded diagnosis at `cd65c002ceed7e18d10e308c31cef807a430811f` and assigns the
minimal correction below. This is a new bounded assignment after diagnosis, not continuation of an
automatic correction loop. The human already delegated routine session/packet and technical acceptance
management to trunk. The diagnosis's last paragraph does not create a new human approval gate for
this packet. Human approval before PR creation and human-controlled merge remain unchanged.

Continue `feature/otel-redesign_M2_profile`. Verify clean status, local/actual remote equality and
ancestry of diagnosis cd65c002 and fixed implementation `280824cab82b85ca87a63eeb73b3e248df8df230`.
Record exact entry OID including this packet. Later changes should be routing documentation only.
Do not reset/update main, integration or M2. **Trunk means this planning conversation's role, not a
Git ref. Remain on the assigned child when returning the outcome; do not switch to main.**

Read the diagnosis's meaning/implication table, evidence trace and finite regression plan. They
supersede the unsupported reverse implication in the historical round-2 matrix/test, not the original
accepted design. No new product decision is required. R1-R3 and actual worker transport stay accepted.

### Bounded change

Implement the diagnosis's minimal file/responsibility list:

- Remove the unconditional reverse implication from per-kind whole-target evidence to signal-wide
  unavailable/empty. Detailed point/observation/Scope loss and summary OR may coexist with retained
  siblings and partial status.
- Retain a target-aware reverse check only for exact detailed report target, entire-target extent,
  whole-result evidence and the covered kind. Require the exactness evidence defined by existing
  normalization/broadening rules; a broadened report target is not whole-signal proof. Never apply
  this reverse check to a reserved summary that discarded target identity.
- Preserve all forward unavailable/empty/evidence rules, complete-with-impact rejection, explained
  partial, the six contradiction families, diagnostic/summary associations and fixed-delivery exception.
- Clarify the TypeScript field comment and canonical telemetry/report catalog wording as target-scoped
  evidence. No schema field, public shape, producer policy, threshold or historical artifact change.
- Replace the broad-Scope rejection expectation with independent contract cases. Add the detailed
  and compacted real accumulator/builder sibling cases at validator and formal-consumer boundaries.
  Valid partial reports must normalize/extract and remain non-healthy (`fail`) for formal acceptance.

Use the finite positive/negative list in the diagnosis, including no-sibling unavailable, complete-empty,
justified partial-empty, fixed fallback and exact report-wide loss with retained values. Confirm that
summary compaction cannot strengthen evidence. Check the exact-report rule against normal builder
recovery and describe any contradictory synthetic input accurately; do not expand scope by changing
accepted producer behavior merely to satisfy a newly stricter validator.

For the two legitimate sibling cases establish fail-before/pass-after; preserve independent negative
expectations for the six original contradictions and exact report-wide boundary. If a contract conflict
or necessary scope expansion emerges, stop that dependent change and return evidence to trunk. Do not
silently redesign representation or add a fresh blanket rule.

### Verification and return

Run build:dev; active-report, local-collection, report-primitives, worker-session, performance-harness,
repository-sidecar and catalog-contract suites; the existing explicit strict tooling command; lint;
format write/check and diff check. Architecture only if boundaries/exports change. Reuse unrelated
accepted transport and OS/package evidence; no full release matrix or formal measurement. Report exact
commands/counts/skips and before/after evidence without claiming Vitest typechecks test sources.

Checkpoint and normally push progress to the child, verifying actual remote equality. Append the
outcome here with implementation/final OIDs, precise changed rules, positive/negative results and
remaining issues. Remain on the child with clean status. Return for a separate independent focused
review; do not self-accept R4/P2, start P3, create PR, merge, freeze or update acceptance. If another
concrete failure remains, return it to trunk rather than iterating beyond this packet.

## Post-diagnosis R4 correction outcome

The bounded correction is implemented on `feature/otel-redesign_M2_profile`. R4/P2 are not
self-accepted; P3, PR creation, merge, formal measurement and release work were not started. This
child remains the review branch.

### Provenance and checkpoints

- Entry/local tracking/actual remote OID: `4fd2ac81bc70f5324247bdce9d4b1ff196f6f5f2`.
  The worktree was clean, and both diagnosis `cd65c002ceed7e18d10e308c31cef807a430811f`
  and fixed implementation `280824cab82b85ca87a63eeb73b3e248df8df230` were ancestors.
- Implementation and final code OID: `d2c4a7d2460d6089874c7a7367c324570a9b43e5` (`fix: scope
whole-result profile evidence to targets`), normally pushed before this outcome was written. The final documentation checkpoint is
  the child-branch commit containing this section; its full local and actual remote OID is returned
  with the session outcome.
- Changed implementation scope is limited to active profile relationship normalization and the
  `wholeResultUnavailable` field comment. Directly affected contract/builder/formal-consumer tests
  and canonical telemetry/catalog wording changed with it. No schema field, export, producer,
  threshold, dependency, worker transport, presentation or performance policy changed.

### Corrected rule and boundary evidence

- The validator still uses any same-kind detailed or summary whole-result evidence in the forward
  `unavailable` requirement, but no longer reverses that evidence into signal-wide unavailability.
  Point, observation and Scope losses, and the summary existential OR after target identity loss,
  may coexist with retained siblings and `partial` status.
- The only reverse rule now requires a detailed `target.type: report`, `extent: entire_target`,
  `wholeResultUnavailable: true`, a whole-result effect and coverage of the evaluated kind. A
  broadened report has `unidentified_subset` extent and remains target-scoped; the reserved summary
  is never used for this reverse rule.
- The exact-report/entire-target diagnostic with a retained same-kind value is rejected. This is an
  intentionally contradictory synthetic boundary: normal builder validation recovery creates a
  report target with `unidentified_subset` and no whole-result flag, while current collection sites
  that emit exact report-wide whole-result evidence supply empty arrays. Accepted producer behavior
  was therefore unchanged.
- Before the production correction, the new formal-consumer cases built real detailed and 15+1
  compacted reports with one retained Counter and `partial` status; both failed extraction because
  normalization rejected them. The literal contract case likewise rejected the detailed sibling at
  its first assertion. An initial builder-suite probe also had a missing test import, which was
  corrected and is not counted as semantic fail-before evidence.
- After correction, detailed and compacted real accumulator/builder reports normalize and extract
  one retained Counter. Repository formal evaluation returns `fail`, not `pass` or `inconclusive`,
  because the partial signal and diagnostics remain non-healthy. Compaction does not strengthen the
  discarded target identity.
- The finite positives pass: detailed and summarized lost target plus sibling; detailed and summary
  whole-target evidence with no sibling and empty `unavailable`; complete-empty; justified
  partial-empty; fixed no-measurement fallback; and a broadened report target with retained sibling.
  The six existing contradiction families remain rejected: unavailable with retained data,
  unexplained unavailable, unexplained partial, delivery effect without provenance, provenance
  without delivery effect, and target/coverage/affected-field kind contradiction. Complete with
  same-kind impact and exact detailed report-wide loss with retained data also remain rejected.

### Verification and review state

- `npm run build:dev`: passed; changed production TypeScript was compiled by the strict production
  projects.
- `npx vitest run packages/internal-contracts/test/telemetry/profile-report-active.test.ts packages/gitlode/test/telemetry/local-collection.test.ts packages/gitlode/test/telemetry/profile-report-primitives.test.ts packages/gitlode/test/telemetry/worker-telemetry-session.test.ts packages/gitlode/test/telemetry/performance-harness.test.ts packages/gitlode/test/telemetry/repository-sidecar.test.ts packages/gitlode/test/telemetry/catalog-contract.test.ts`:
  7 files and 157 tests passed; no platform tests were skipped. Vitest execution is not claimed to
  typecheck test sources.
- Explicit tooling-source strict check passed:
  `npx tsc --ignoreConfig --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck packages/gitlode/test/support/js-yaml.d.ts packages/gitlode/test/support/performance-harness.ts packages/gitlode/test/support/telemetry-catalog.ts`.
- `npm run lint`, `npm run format:write`, `npm run format:check` and `git diff --check`: passed.
  Architecture verification was not run because no boundary, import envelope or export changed.
- The implementation changes seven files: active normalization and report contract, their active
  contract test, builder and formal-consumer tests, and canonical telemetry/catalog documentation.
  This handoff is the only additional final-checkpoint file.

No further concrete correction failure is known from this packet. The remaining action is a separate
independent focused review of `d2c4a7d2460d6089874c7a7367c324570a9b43e5` plus this outcome
checkpoint. That review, not this session,
decides R4/P2 acceptance. The branch must remain here until trunk assigns subsequent work.

## P3 generic profile presentation

### Entry and scope

Continue on `feature/otel-redesign_M2_profile` after P2 acceptance checkpoint
`4ba32fad97897f00adafe9275e7fb9bd589f6b8f`. Accepted P2 implementation:
`755e7d34f3d0ea56c7346ce009ec7d7624bab32c`. Verify clean status, ancestry and actual remote equality;
record exact entry including this planning packet. Later entry changes should be handoff-only.
Trunk is a conversation role, not a branch: stay on this child when returning the outcome.

Implement the already human-approved [profile design](opentelemetry-m2-profile-design.md), including
its [integrated examples](opentelemetry-m2-profile-integrated-review.md). Read the complete design,
canonical profiling/telemetry/verification/view catalog, presentation architecture and current bridge.
Do not reopen approved layout tradeoffs. Examples transformed from old output and hypothetical cases
are design evidence, not current runtime captures; retain that distinction in new evidence.

P3 replaces the temporary view with generic rendering, shared styling and matching canonical guidance.
Keep accepted schema 2, collection admission, diagnostic semantics, numeric masks, duration coverage,
P1/P2 isolation/transport and application result behavior. No Span retention redesign, new measurement,
external export, tests/system move, release gate change or formal performance run. Return a concrete
producer/contract blocker to trunk rather than expanding P3 into another collector redesign.

### Implementation responsibilities

- Organize by Scope name/version, then first two dot-separated name segments as namespace levels.
  No kind sections/badges, Plugins bucket, human-label overrides or per-observation group/order table.
  Preserve all reported observations and typed identities, including short/group-node names, name
  collisions across kinds, repeated metric points and unknown admitted scopes/names.
- Apply the accepted deterministic code-unit/kind/typed-attribute ordering. Keep own attributes before
  children; use relative attribute keys only against the namespace at a segment boundary, otherwise
  absolute slash notation. Follow quoted-token/control escaping and malformed-dot rules exactly.
  No domain pivots, inherited attributes, synthetic totals, adaptive grouping or formatter wrapping.
- Keep fixed field layout per kind regardless of frequency, exact counts, genuine zero, optional
  extrema, unavailable markers and duration-contribution rules. Mixed-duration total/max remain
  retained with incomplete explanation and unavailable average; all-invalid defaults never become
  observed zero. Apply four-significant-digit duration/size formatting, unit promotion and tiny/large
  value rules without changing underlying report values or rounding identity attributes.
- Render typed Span attribute summaries/frequencies/ranges and metric scalar attributes faithfully.
  Route diagnostics to the narrowest safely evidenced target and provide the agreed overall summary.
  Explain missing observations even without a surviving measurement. Keep omitted detail, occurrence
  count and known/unknown loss amount distinct; do not reconstruct discarded target identity.
  Cover summary severity, report-delivery fallback and unknown prior-detail provenance. No duplicate
  inline conflict explanation plus notification; no invented collection failure or hidden valid sibling.
- Add shared `sectionHeading` and `separator` roles to styling.ts; use the accepted semantic role map.
  Profile heading no longer uses application success styling. Do not color by domain values or call
  chalk directly from profile formatters. Preserve TTY/color policy, plain text parity and existing
  application/progress styling; escape before decoration and keep indentation outside styled tokens.
- Remove per-observation view policy in profile-view.ts (delete or replace with genuinely generic
  helpers) and migrate profile-view.yaml plus drift/coverage tests. Preserve observation catalogs and
  admission checks; replacing view enumeration is not permission to weaken measurement coverage.
  Keep formatter decomposition inside the existing presentation/reporting ownership boundaries.
- Update profiling.md, relevant usage examples, telemetry/view/verification canonical guidance and
  catalog/test helpers together. Remove obsolete v1/P2 bridge presentation claims. Do not describe
  P3, terminal approval, cumulative validation or M2 as complete before their separate acceptance.

### Checkpoints, checks and output evidence

Use coherent checkpoints on the same child: (1) generic tree/tokens/numeric formatting,
(2) diagnostic placement and shared styling, (3) catalog/docs removal of old policy and combined checks.
These are not independent mergeable units. Normally commit/push meaningful progress; if context is
insufficient, return committed incomplete scope with exact remaining work instead of rushing or
claiming completion. No fresh branch per checkpoint or force push.

Tests must cover representative ordinary rows and the design's boundary examples: short/group-node
collisions, names/versions/typed attributes and escaping, numeric unit/rounding edges, masks and zeros,
attribute summaries, detail/summary diagnostic placement, missing-only targets, partial siblings,
fixed fallback and lifecycle-only notices. Use independent expected text/ordering and semantic-role
spies; strip ANSI to verify styled/plain text equality. Preserve quiet, failed-run and complete-empty
suppression and ordinary presenter/worker report routing. Avoid tests that derive expected output
from the renderer's own ordering or policy tables.

Run build:dev, affected presentation/presenter/styling/catalog/contract tests and relevant P2 mask/
fallback regressions, architecture, lint, format write/check and diff check. Record exact commands,
counts and any skips. Typecheck changed tooling explicitly if its project uses noCheck. No full
Windows/Linux installed-package campaign in this implementation conversation; trunk assigns cumulative
P3-R/V after independent review.

Capture small real commit/file/plugin outputs using existing deterministic fixtures where possible.
Record commands, source OID, report provenance and stdout/stderr destination; distinguish real captures
from synthetic fault/edge fixtures and old transformed design examples. Keep samples bounded and
reviewable (no bulk measurement archive in Git). A shell invocation is not human light/dark terminal
approval: return representative samples and steps for that later check, leaving it pending. Warn
before any lengthy external build/setup; do not run formal calibration/measurements for UI evidence.

Return implementation/final OIDs, clean/actual remote state, affected-file responsibility summary,
removed view policy/remaining compatibility inventory, exact tests and reproducible sample locations.
Append outcome here. Return for independent P3 review, then human terminal/readability confirmation
and cumulative Windows/Linux functional/package validation. Do not self-accept P3/M2, create PR,
merge, freeze a performance candidate, update acceptance or start tests/system migration.

### P3 implementation outcome

P3 implementation is complete on `feature/otel-redesign_M2_profile` and is returned for independent
review. This outcome does not accept P3 or cumulative M2, and no PR, merge, formal measurement,
release-acceptance update or `tests/system` migration was performed.

#### Provenance and checkpoints

- Exact entry and planning checkpoint: `66acbfdffd8b4eae879c98709357763f85cac862`;
  local and actual `origin/feature/otel-redesign_M2_profile` agreed and the worktree was clean.
- Accepted P2 checkpoint `4ba32fad97897f00adafe9275e7fb9bd589f6b8f` and implementation
  `755e7d34f3d0ea56c7346ce009ec7d7624bab32c` were confirmed ancestors.
- Generic tree/tokens/numeric checkpoint: `665d3298ac56bce781c5cc37fecad44ce8af7821`.
- Structured diagnostic placement/shared styling checkpoint:
  `245caafe50c7b59ea5ebbf8893cf7cfec2e57345`.
- Generic catalog/canonical guidance checkpoint: `9e096070c93a80b9d96050742982e5879ff4ade4`.
- CLI help correction: `f90edebf14324a9db82ce800d7ed37d6a99eca9a`.
- Real-output empty-version correction: `737f36338e45e08fbfed2095dcd2a81c5f09098d`.
- Final implementation/evidence checkpoint before this outcome:
  `bbf2792fb2f752d20466cd253812e3beabc64603`; it was pushed normally and matched the actual remote.

#### Implemented presentation boundary

- The active formatter now builds one deterministic Scope name/version tree over Span, counter and
  histogram records. The first two dot-separated name segments are namespace nodes; remaining
  segments are relative rows. Short observations, nodes that are both observations and namespaces,
  cross-kind name collisions, repeated metric points, plugin Scopes and unknown admitted identities
  all use the same path.
- Ordering uses code units, Span/Counter/Histogram kind ties and typed canonical attributes. Own
  values/attributes precede namespace children. Attribute keys shorten only at a namespace segment
  boundary; otherwise they retain absolute slash form. Malformed-dot identities, delimiters,
  controls, bidi/line controls and type-ambiguous strings use deterministic quoting. A present empty
  Scope version renders as `@""`, distinct from a missing version.
- Fixed per-kind fields honor schema-2 masks and duration contribution evidence. Counts and observed
  zero remain exact; missing extrema and unavailable numeric slots render as `—`. Duration and size
  values use at most four significant digits, threshold promotion and scientific notation for tiny
  nonzero values without changing report values or attribute identity.
- Span summaries and typed metric attributes render as flat supplements. Reducer conflicts and
  overflow are no longer duplicated inline; structured diagnostics provide the explanation.
- Detailed diagnostics are placed at report, Scope, observation or matching typed point targets.
  Missing-only identified observations remain as `unavailable`; a shared instrument issue is emitted
  once before retained points; valid siblings remain ordinary rows. Known loss, unknown loss,
  occurrence count, detail loss and the reserved summary remain distinct. Fixed fallback and
  lifecycle-only reports use the ordinary renderer without inventing collection failure.
- `sectionHeading` and `separator` are shared semantic roles. Profile no longer uses the green
  application-success role. Formatters decorate escaped tokens without direct chalk calls, and
  indentation stays outside styled tokens. Existing summary/progress roles and non-TTY behavior are
  unchanged.

#### Removed policy and remaining compatibility inventory

- The previous 431-line per-observation `PROFILE_SPAN_VIEW`/`PROFILE_METRIC_VIEW`, human labels,
  preferred order, Plugins grouping and kind/fallback buckets were removed. `profile-view.ts` now
  contains only generic typed identity comparison and diagnostic-code labels.
- `profile-view.yaml` no longer enumerates observations. It owns generic hierarchy, ordering,
  escaping, fields, units, diagnostic placement and style roles. Catalog validation now prohibits
  per-observation groups while the independent Span/metric catalogs and admission/measurement
  coverage remain unchanged.
- `signalStatus` remains the schema-2 compatibility/validation summary for tooling; it does not
  recreate CLI kind sections or place notices. Diagnostic-code cause labels remain a generic code
  mapping, not observation display policy. Histogram buckets remain transported but undisplayed.
- CLI help, `usage.md`, `profiling.md`, telemetry design/verification and verification catalog now
  describe the active generic view. P1/P2 contracts, producers, collection bounds, worker transport,
  application-result behavior and performance consumers were not changed.

#### Verification

Production TypeScript and all workspace formatting/lint checks passed. The focused run covered nine
files and 66 tests: CLI help; generic formatter/numeric/diagnostic/style boundaries; profile-view
drift; summary, presenter and success routing; catalog contract; P2 numeric/report primitives; and
real worker fallback transport.

Commands:

- `npm run format:write` and `npm run format:check`: passed across all workspaces.
- `npm run lint`: passed across all workspaces.
- `npm run build:dev`: passed.
- `npx vitest run packages/gitlode/test/cli/cmd-definition.test.ts packages/gitlode/test/presentation/reporting/formatters.test.ts packages/gitlode/test/presentation/reporting/profile-view-drift.test.ts packages/gitlode/test/presentation/reporting/summary-formatters.test.ts packages/gitlode/test/presentation/presenter.test.ts packages/gitlode/test/presentation/success-report.test.ts packages/gitlode/test/telemetry/catalog-contract.test.ts packages/gitlode/test/telemetry/profile-report-primitives.test.ts packages/gitlode/test/execution/worker-profile-fallback-transport.test.ts`:
  9 files and 66 tests passed.
- Explicit strict tooling check passed:
  `npx tsc --ignoreConfig --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck packages/gitlode/test/support/js-yaml.d.ts packages/gitlode/test/support/telemetry-catalog.ts packages/gitlode/test/telemetry/catalog-contract.test.ts packages/gitlode/test/presentation/reporting/formatters.test.ts packages/gitlode/test/presentation/reporting/profile-view-drift.test.ts packages/gitlode/test/cli/cmd-definition.test.ts packages/gitlode/scripts/capture-profile-evidence.ts`.
- `npm run architecture:check`: all dependency/module checks passed; configuration lint reported its
  existing one warning and zero errors.
- `git diff --check`: passed.

Small real commit/file/plugin Scope excerpts, source OID, normal schema-2 provenance, stdout/stderr
destinations and the exact reproduction command are saved in
[`opentelemetry-m2-profile-p3-real-output.md`](opentelemetry-m2-profile-p3-real-output.md). The
reproduction script is `packages/gitlode/scripts/capture-profile-evidence.ts`. These are actual
non-TTY product captures; synthetic diagnostic/edge fixtures and the old transformed design samples
are not represented as runtime evidence.

#### Independent review and remaining gates

No concrete implementation failure is known. Independent P3 review remains required, followed by
human light/dark terminal readability and wrapping confirmation and cumulative Windows/Linux
functional/package validation. Formal performance calibration/measurement, candidate freeze,
release acceptance and `tests/system` migration remain explicitly unstarted. Review the cumulative
delta from entry `66acbfdffd8b4eae879c98709357763f85cac862` through the final outcome checkpoint;
do not treat this implementation session as P3 or M2 acceptance.

## P3 correction round 1

### Entry and scope

Continue `feature/otel-redesign_M2_profile` after independent review checkpoint
`41a37e5385d2566f3db92e6b68021c5a0fedc8d0`. Fixed reviewed implementation:
`5df4f49732d9ff49fef4067493d3152d276a792d`. Verify ancestry, clean entry and actual remote equality;
record the exact entry including this planning packet. Later changes must be identified as routing
only before proceeding. Remain on this child when returning; trunk is not a Git ref.

Trunk adopts P3-R1 through R4 in the [review outcome](opentelemetry-m2-profile-p3-review.md#independent-review-outcome).
This is P3's first correction round, separate from the completed P2 corrections. Preserve accepted
P1/P2 and generic hierarchy/view-policy removal. Scope is presentation formatter/identity helpers,
focused tests and directly affected documentation/catalog wording. No collector/schema, admission,
public CLI option, dependency, threshold or styling-policy redesign. Existing design settles these
issues; return any new design conflict rather than silently changing it.

### Required corrections and independent regression expectations

1. **P3-R1 ? collision-free Scope identity.** Group measurement and diagnostic scopes consistently
   with nullable version equality and `compareProfileScopes`. Missing and present-empty versions must
   remain separate, and embedded delimiters must not alias distinct admitted identities. Use a
   structured collision-free key/equality, not a new string sentinel. Test same-name null/empty versions
   together, both input orders, measurements and diagnostic-only targets, and delimiter-bearing tokens.
   Preserve existing rendering (`@""` for present empty) and admission rules.
2. **P3-R2 ? suffix escaping and missing-only retention.** Escape the complete displayed suffix before
   decoration for measured and issue-only long names. Include newline, quotes, slash/backslash, C1,
   bidi/line controls and delimiter punctuation with literal expected output independent of renderer
   helpers. Build the accepted quoted absolute rows for malformed-dot diagnostic-only targets; do not
   drop the target or notice because there is no measurement. Check empty-segment variants, ordinary
   sibling ordering, namespace attribute base, and measured plus missing-only target combinations.
   Plain and styled paths must retain exactly the same safe text and expected row boundaries.
3. **P3-R3 ? loss meaning and deterministic diagnostic order.** Display known semantic loss quantities,
   units and saturation without substituting diagnostic occurrences for lost measurements. Preserve
   unknown-amount wording and existing duration-specific explanation without double-reporting it.
   Cover current quantity descriptors, counts differing from occurrences, exact versus saturated,
   and unknown values. Order by complete canonical retained target before code/stage/effect, then
   deterministic retained selector/tie distinctions as defined by the design. Use typed comparisons
   (kind, point attributes and nullable Scope version), not locale or producer arrival order. Test
   opposed input orders with same code/stage but different targets/selectors/quantities. Do not invent
   discarded target detail from a summary or synthesize totals from noncomposable losses.
4. **P3-R4 ? semantic role completeness.** Derive Profile-level marker severity from highest retained
   detailed/summary evidence; info-only uses default marker text. Keep fixed warning fallback behavior.
   Style distinct-frequency digits with primaryValue and punctuation with separator. Style coverage
   labels/counts/punctuation with fieldKey/primaryValue/separator. Extend role spies for info-only,
   warning, compacted maximum severity, frequency and incomplete coverage. Verify identical plain
   text after stripping ANSI and no domain-value styling; style-only fixes must not alter text.

Add meaningful durable regression tests before production correction and record fail-before/pass-after
for each group, including both R2 failure paths. A missing import/setup failure is not semantic
regression evidence. Avoid tests whose expected tokens/order/roles are generated by production helpers.
Keep previously accepted numeric masks, mixed-duration semantics, fallback, quiet/failed-run and
shared application/progress style behavior covered by the existing affected suites.

### Finite checks and return

Run build:dev, the original P3 nine-suite command plus any new directly affected suites, its exact
explicit strict tooling command (extend paths if new modules/tests require it), lint, format write/check
and diff check. Architecture is needed if boundaries/exports change. Record actual counts/skips and
separate TypeScript checks from Vitest execution. No full OS/package/formal performance campaign.

Previously reproduced ordinary commit/file/plugin captures remain historical evidence, not proof of
new boundary fixes. Reproduce the three small captures at most once after correction if needed to
update representative output; preserve original source attribution and distinguish synthetic boundary
cases. Do not rerun for timings or claim human light/dark/TTY acceptance. Return how later terminal
confirmation can exercise the corrected output without a formal measurement workload.

Commit/push meaningful progress normally to the child and verify actual remote equality. Append the
four-group correction/test matrix, exact implementation/final OIDs, evidence changes, checks and
remaining work here. Return for independent focused re-review; no self-acceptance, PR, merge, P3
cumulative validation, tests/system move, candidate freeze or acceptance-record update. If scope/context
requires continuation, return a clean committed incomplete checkpoint with finite remaining work.

### P3 correction round 1 outcome

The four bounded presentation corrections are implemented on
`feature/otel-redesign_M2_profile` and are returned for independent focused re-review. This outcome
does not accept P3 or M2. No PR, merge, formal measurement, cumulative package/OS validation,
`tests/system` move or acceptance-record update was performed.

#### Provenance and checkpoints

- Exact entry: `f4d9f12788147b4054b48847574ba4cbc887d7d6`; the worktree was clean and local
  `HEAD` matched the actual remote branch. Review checkpoint
  `41a37e5385d2566f3db92e6b68021c5a0fedc8d0` and fixed reviewed implementation
  `5df4f49732d9ff49fef4067493d3152d276a792d` were confirmed ancestors. The intervening entry delta
  contained routing/planning documentation only.
- Exact implementation checkpoint: `255b0aacebb5fc7c109d3fe151455abace7f9d51`.
- Exact correction outcome/evidence checkpoint: `094dcb81df02681f4de20daf9c160eaacbf0564c`. The later child
  tip only records that checkpoint OID and is a routing-only documentation delta.

#### Correction and regression matrix

| Group                        | Bounded correction                                                                                                                                                                                                                                                                                            | Fail-before evidence                                                                                                                               | Pass-after evidence                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3-R1 Scope identity         | Scope grouping now uses nested name and nullable-version maps, so missing and present-empty versions and delimiter-bearing components cannot alias. Measurement and diagnostic-only Scopes use the same `compareProfileScopes` equality/order.                                                                | Focused `-t P3-R1`: 1 failed, 19 skipped; four admitted identities collapsed to two headings.                                                      | Same command: 1 passed, 19 skipped, including both input orders, null/empty versions, measurement/diagnostic-only groups and embedded NUL components.                                                                              |
| P3-R2 escaping and retention | The complete remaining observation suffix is escaped before decoration. Malformed-dot missing-only targets now produce quoted absolute issue rows in code-unit name order alongside measured malformed and ordinary namespace rows.                                                                           | Focused `-t P3-R2`: 2 failed, 18 skipped; controls split both measured/missing-only rows and all three malformed missing-only targets disappeared. | Same command: 2 passed, 18 skipped; literal newline/quote/slash/backslash/C1/line/bidi/delimiter expectations, row boundaries, empty-segment variants, ordinary ordering, namespace attribute base and styled/plain parity passed. |
| P3-R3 loss and order         | Known loss renders descriptor meaning, exact/saturated value and unit separately from occurrence count; unknown amount and the duration-specific explanation remain distinct. Diagnostics sort by typed canonical target before code/stage/effects and retained selector/field/detail/quantity identity ties. | Focused `-t P3-R3`: 2 failed, 18 skipped; known quantities were absent and reversed inputs changed notice order.                                   | Same command: 2 passed, 18 skipped across all five descriptors, exact/saturated/unknown amounts, differing occurrence counts, nullable Scope/kind/typed point identity support and opposed input order.                            |
| P3-R4 styling                | The Profile headline marker uses the highest retained detailed/summary severity while fixed fallback warnings remain fixed. Distinct-frequency digits and incomplete-coverage labels/counts/punctuation now use the accepted semantic roles.                                                                  | Focused `-t P3-R4`: 1 failed, 19 skipped; an info-only headline called `warnBadge`, and frequency/coverage roles were incomplete.                  | Same command: 1 passed, 19 skipped; info-only, warning, compacted info/warning maximum severity, frequency and coverage role spies passed with identical stripped text.                                                            |

The generic view catalog now states the nullable collision-free Scope identity, complete suffix
escaping, malformed missing-only row, diagnostic order/loss semantics and the completed style-role
mapping. Active schema, collectors, admission, worker transport, CLI options, dependencies,
thresholds and styling policy were not changed. The touched implementation/evidence files are
`src/presentation/reporting/formatters.ts`, its focused formatter test, the generic view drift test
and `docs/design/telemetry-catalog/profile-view.yaml`, plus this outcome.

#### Verification

- `npm run build:dev`: passed; production TypeScript was checked by the normal build.
- Original P3 nine-file Vitest selection: 9 files, 72 tests passed, 0 failed and 0 skipped. The
  command covered CLI help, formatter and view drift, shared summary/presenter/success behavior,
  catalog contract, numeric/report primitives and worker fallback transport.
- Exact explicit strict tooling command from P3, with the same formatter/view/catalog/CLI/capture
  paths: passed separately from Vitest.
- `npm run lint`: passed across all workspaces.
- `npm run format:write` followed by `npm run format:check`: passed across all workspaces.
- `git diff --check` and the staged implementation diff check: passed.
- Architecture was not rerun because no export, import boundary, dependency or module ownership
  changed.

The three ordinary real-output captures were not rerun: no representative ordinary text changed,
and synthetic boundary fixtures provide the correction evidence without turning them into runtime
captures. Later human terminal confirmation can run the existing
`packages/gitlode/scripts/capture-profile-evidence.ts` workflow and inspect an ordinary profiled CLI
run in real light/dark TTYs for color and wrapping; it must not treat that readability check as a
formal measurement workload.

Independent focused re-review remains next. Human terminal/readability confirmation and cumulative
Windows/Linux functional/package validation remain later gates. Formal calibration/measurement,
candidate freeze, release acceptance and `tests/system` migration remain unstarted.

## P3 R2/R3 correction round 2

### Entry and disposition

Continue `feature/otel-redesign_M2_profile` after review checkpoint
`e6d1d7a9a1c1e19acf3125d8d5e7d56b3fc11ed5`. Reviewed implementation:
`61a34c1f13ee993099c4611b3e4ac966b2ab132c`. Verify clean status, ancestry and actual remote equality;
record full entry including this packet. Later entry differences must be accounted for as routing-only.
Remain on this child; trunk is a conversation role, not a ref. No parent branch updates.

Trunk adopts the two remaining findings in the
[focused review outcome](opentelemetry-m2-profile-p3-review.md#p3-correction-round-1-focused-re-review-outcome).
Keep P3-R1/R4, corrected suffix escaping/known quantity rendering, and P1/P2 accepted behavior.
This is the second P3 correction round, confined to missing-target attachment and deterministic
remaining diagnostic ties. No producer/schema/admission/CLI/style-policy redesign or new kind labels.

### Map identities before editing

Record a concise attachment matrix for observation versus point targets, matching/nonmatching kind,
matching/nonmatching typed attributes, measured/missing-only rows and ordinary/malformed names.
Observation-wide notices attach once to their matching observation; point notices require complete
point identity. Same-name unrelated measurements are not evidence that the target has a row. Account
for short/group-node observations as well as longer suffix rows using the existing layout conventions.
This is a finite inventory of existing contracts, not a new design exercise.

Also list retained fields that can distinguish rendered diagnostic text and how ties are compared.
Keep canonical target/code/stage/effect precedence, and use typed/null-aware comparisons for remaining
fields. Do not derive the test oracle from the comparator's own field list.

#### Pre-edit attachment and ordering matrix

Recorded before test or production edits at entry `df71db30e06e0340e665226ab8f28f37c43ddd33`.
Local `HEAD` and the actual `origin/feature/otel-redesign_M2_profile` agreed, the worktree was clean,
and review checkpoint `e6d1d7a9a1c1e19acf3125d8d5e7d56b3fc11ed5` and reviewed implementation
`61a34c1f13ee993099c4611b3e4ac966b2ab132c` were ancestors. The checkpoint-to-entry delta is this
routing packet only.

| Target evidence                                     | Same-name retained measurement     | Attachment/result                                                                                |
| --------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| Observation, matching kind                          | Any point or Span row of that kind | Attach once to the matching observation; repeated points do not repeat the notice.               |
| Observation, nonmatching kind                       | Row exists only for another kind   | Keep one separate issue-only observation row and notice; leave the unrelated row available.      |
| Observation, no retained row                        | None                               | Keep one issue-only observation row and notice.                                                  |
| Point, matching kind and typed attributes           | Exact Counter/Histogram point      | Attach once to that exact point.                                                                 |
| Point, matching kind but different typed attributes | Other point exists                 | Keep one issue-only point row with its typed attributes and notice; leave the sibling available. |
| Point, nonmatching kind or no retained row          | Unrelated or absent point          | Keep one issue-only point row with its typed attributes and notice.                              |

Every row applies to ordinary short/group-node names, ordinary longer suffix rows and malformed-dot
quoted absolute rows. A matched observation notice uses the existing shared name-only row when the
name has repeated retained rows. Unmatched complete targets remain separate even when their names
are equal; diagnostics for the same unmatched target share one issue row and are sorted once.
Namespace-relative attribute keys continue to use the same first-two-segment base as measured rows.

The retained ordering inventory keeps target, code, stage and effects first, followed by signal
coverage, extent, attribute-key selector, affected fields, detail-loss flags, loss-quantity presence,
descriptor, unit, null/known value and saturation, whole-result evidence, occurrence count and count
saturation, then severity. Comparisons are code-unit, enum-order, numeric, boolean or explicit
null-aware comparisons as appropriate. These fields either select placement/wording, change visible
notice text, or change warning styling. The retained free-form `message` is not rendered by this view
and therefore remains an output-indistinguishable tie.

### Bounded fixes and regression evidence

- **R2:** partition same-name diagnostics by complete target identity; attach exact matches once and
  retain unmatched targets as issue-only rows through the accepted generic layout. Cover measured
  Counter plus missing Span of the same name, and measured Counter plus missing Counter point with
  different typed attributes. Exercise ordinary and malformed names, both input orders, and same-name
  matched/unmatched targets together. Preserve identity/attributes and notices without coalescing or
  duplicate attachment; keep namespace attribute base and R1 nullable Scope identity. Retain corrected
  escaping on every new issue-row path. Do not fabricate unavailable status for unrelated siblings.
- **R3:** after canonical identity comparisons, compare all remaining output-distinguishing retained
  ties, including known/null loss value, loss saturation, occurrence count and count saturation.
  Different notices must not depend on arrival order; comparator equality is acceptable for truly
  indistinguishable output. Use numeric/boolean/null comparisons rather than formatted text or locale.
  Cover same target/code/stage/effect/descriptor/unit with differing quantities and occurrences,
  opposed input orders and isolated saturation/nullability differences. Preserve loss semantics,
  unknown wording, diagnostic severity styling and accepted primary ordering.

Add durable independent expected-output tests first and record semantic fail-before/pass-after for
both findings. Verify missing targets and their notices each survive exactly once, and permutation
invariance covers output rather than merely sorted input arrays. Do not weaken catalog guarantees or
remove valid fixtures to make the implementation pass. If a design conflict emerges, return evidence
before changing the accepted display contract.

### Finite verification and return

Run build:dev, the existing P3 nine-suite command plus new directly affected suites, the exact explicit
strict tooling check (extend new source/test paths if needed), lint, format write/check and diff check.
Architecture only if boundaries/exports change. Record actual counts/skips, before/after evidence and
TypeScript scope separately. No full OS/package/capture/performance campaign: previous ordinary real
captures remain attributed historical evidence and cannot replace these boundary tests.

Limit production changes to presentation formatters/identity helpers, focused tests and directly
necessary canonical/catalog clarification. Append matrix, changed rules, commands, implementation/final
OIDs, local/actual remote equality and residual issues here. Normally commit/push progress; return a
clean committed continuation if the session cannot finish. Do not self-accept P3 or start human/cumulative
validation, PR, merge, freeze, tests/system migration or release acceptance work.

Trunk assigns an independent focused re-review after return. If the same underlying R2 or R3 issue
remains after this second round, use a fresh bounded diagnosis before any further correction; do not
automatically continue local patches or accept unresolved defects merely to end the loop.

### P3 R2/R3 correction round 2 outcome

Status: the bounded R2/R3 implementation and regression evidence are complete; P3 is not
self-accepted. The branch remains `feature/otel-redesign_M2_profile` for an independent focused
re-review.

#### Provenance and implementation

- Entry, local/actual remote equality and routing checkpoint:
  `df71db30e06e0340e665226ab8f28f37c43ddd33`. Review checkpoint
  `e6d1d7a9a1c1e19acf3125d8d5e7d56b3fc11ed5` and reviewed implementation
  `61a34c1f13ee993099c4611b3e4ac966b2ab132c` were ancestors; their delta to entry was the round-2
  routing packet only.
- Implementation checkpoint: `4d49d73dd34c957204f7bc0d5690ae19c2a2b0e2`
  (`fix: preserve complete profile diagnostic targets`). The final documentation checkpoint is the
  subsequent branch tip containing this outcome; its exact OID and actual remote equality are
  reported on return.
- The pre-edit matrix above was recorded before tests or production changed. Formatter attachment
  now partitions each name by complete observation/point target. Exact observation matches attach
  once, exact points require kind plus typed attributes, and unmatched targets each retain one
  issue-only row. Unmatched point rows retain their attributes and namespace-relative base; unrelated
  measured siblings retain their ordinary available values. The same partition is used for
  short/group-node, longer-suffix and malformed quoted-absolute paths.
- Diagnostic sorting retains target/code/stage/effects precedence and now uses typed comparisons for
  affected fields and detail-loss flags. Loss quantity compares presence, descriptor, unit,
  null/known numeric value and saturation; whole-result evidence, numeric occurrence count, count
  saturation and severity close the remaining visible ties. No formatted notice text or locale
  comparison is used.
- R1 nullable/collision-free Scope grouping and R4 semantic styling were not changed. The active
  report schema, producers, admission, worker/fallback transport, CLI, style policy and dependencies
  were not changed. The generic view catalog only makes the corrected target-retention and ordering
  guarantees explicit.

Changed files are `src/presentation/reporting/formatters.ts`, its focused formatter test, the generic
view drift test, `docs/design/telemetry-catalog/profile-view.yaml`, and this handoff.

#### Independent expectations and verification

- Fail-before, with the literal expected lines already present and production still at entry:
  `npx vitest run packages/gitlode/test/presentation/reporting/formatters.test.ts -t 'P3-R[23]'`
  produced 3 failed, 4 passed and 16 skipped. Both ordinary and malformed R2 cases lost the unmatched
  rows/notices and point attributes; the R3 case retained arrival order for null/known values,
  quantity saturation and occurrence saturation.
- Pass-after, same command and unchanged independent literals: 7 passed and 16 skipped. Both input
  orders produce the same complete output; matched/unmatched notices and targets occur exactly once,
  measured siblings remain available, and numeric 2 sorts before numeric 10.
- Direct formatter/catalog suites: 2 files and 26 tests passed.
- Existing P3 nine-suite command: 9 files and 75 tests passed, with no failures or skips. It covered
  CLI help, formatter/view/catalog behavior, shared presentation, report primitives and fallback
  transport.
- The exact explicit strict tooling command from P3 passed with the formatter, drift, catalog, CLI
  and capture-script paths. This is separate test-source TypeScript evidence; Vitest alone is not
  claimed as typechecking. `npm run build:dev` passed for production TypeScript.
- `npm run lint`, root `npm run format:write`, `npm run format:check`, and `git diff --check` passed.
  Architecture was not rerun because no export, import boundary, dependency or ownership changed.

No ordinary capture, human TTY review, formal measurement, cumulative Windows/Linux or package
validation, `tests/system` migration, candidate freeze, release acceptance, PR or merge was started.
Those remain later gates. The immediate next step is independent focused R2/R3 re-review of the
recorded implementation and final documentation checkpoints.
