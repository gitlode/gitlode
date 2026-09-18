# M2 profile implementation: P1 handoff

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

Pending. No P1 implementation has started.
