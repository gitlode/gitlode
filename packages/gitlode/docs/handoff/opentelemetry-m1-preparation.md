# M1 preparation: placement and release-gate proposal

## Session assignment

Use a new bounded branch conversation for repository inspection and a concrete implementation
proposal. The current conversation owns milestone acceptance and consolidates the result. M0 is
[complete](opentelemetry-m0-result.md); M1 remains open. This assignment does not run repeated
performance measurements or the full test suite, so no long empirical run is planned. Warn the
human before starting any newly discovered operation likely to require substantial execution time.

Use the current planning branch containing this packet. Record actual HEAD, branch/worktree state,
and local refs for `feature/otel-redesign_T13B`, `feature/otel-redesign`, and `integration/v0.13.0`.
Do not merge, rebase, reset, or update refs during inspection. A missing ref or uncertain ancestry
is a finding, not a reason to invent an integration base. The frozen M0 harness is separately
`a53a5b83d18f9e493ebb39c4db481b762448743f`; the measured production candidate is
`a97829b5315d42fbfa2212b718258099e7c90498`.

Read `AGENTS.md`, the recovery plan's M1/M2 conditions, M0 result, and the canonical architecture,
domain design, telemetry, verification, and build/test/release documents. Inspect the actual source,
package scripts, CI and release workflows rather than relying only on previous handoff descriptions.

## Required output

Produce one concise proposal at
`packages/gitlode/docs/handoff/opentelemetry-m1-implementation-proposal.md` containing:

1. A source-backed inventory of telemetry-specific implementation mixed into other domains, with
   proposed current-to-destination file mappings using domain-local `telemetry/` directories where
   appropriate. Distinguish recording calls that belong in product control flow from telemetry-only
   helpers that can move. Preserve ownership, semantics, attributes, no-op behavior, and dependencies.
   Leave coherent existing instrumentation domains intact. Do not invent a new cross-domain facade.
2. Minimal contributor reading-route changes so newcomers can distinguish product and telemetry
   guidance. Link existing canonical docs instead of rewriting them or introducing another source
   of truth. Defer report presentation and `tests/system` migration to their approved M2 slices.
3. One recommended enforceable release-gate design: enumerate actual supported publish paths and
   identify exactly where M2 blockers would be checked, what evidence/status would close them, and
   how missing or malformed state fails closed. Explain how integration CI and feature development
   stay usable. A checklist alone or `validate:release` alone does not prove empirical acceptance;
   avoid turning every integration build into a full measurement run. Include bypass boundaries and
   focused tests for blocked/accepted states. Do not implement the gate in this proposal session.
4. A short ordered implementation breakdown with allowed files, dependency order, verification,
   and session ownership. Include functional/installed-package validation on the applicable platforms,
   immutable M1 candidate preservation, and cumulative review against the actual integration target.
   Separate pre-merge necessities from M2/M3 work; do not make missing full-matrix results a new M1
   blocker absent a concrete material regression.

Return concrete recommendations, not a broad list of alternatives. Identify any unresolved product
or release-authority decision separately; routine move/import choices belong to the implementation
owner under the already accepted direction. This proposal makes those changes reviewable before
editing production code or publishing policy.

## Exclusions and exit

No production changes, package/workspace moves, recorder redesign, release-gate implementation,
publishing, formal measurements, fixture changes, or modification of preserved release trees.
Use read-only checks needed to substantiate the proposal. Do not rerun completed M0 or R1 work.
Save the proposal as a documentation checkpoint commit (authorized intermediate preservation),
format/check the documentation, and return its OID, findings, recommended first implementation slice,
and any decision needed from the planning owner. A proposal commit does not authorize merge or release.
