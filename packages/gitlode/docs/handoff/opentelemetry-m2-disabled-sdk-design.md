# M2 disabled SDK boundary: detailed design assignment

## Approved direction and session boundary (2026-10-07)

The human approved detailed design for removing SDK loading and provider construction from the
disabled execution path. This is a product design decision supported by known reachable unnecessary
work, not a claim that the six-run experiment established the formal RSS failure's cause or cure.
The experiment is closed at `8d9996bbc7d35f537967057faa37c9d9e6075980`, outcome on M2
`85526d2f95503acd4adeef833c7de038ae28e8d4`. Preserve experimental refs and evidence; do not merge
experimental code. No additional diagnostic or formal runs are assigned.

The human starts an independent design session. Create `feature/otel-redesign_M2_disabled` from
the M2 documentation checkpoint delivering this packet; its predecessor is `85526d2`. Record the
exact starting OID and verify the intervening delta is documentation only. If the child already
exists, inspect rather than reset it. Work is design/documentation only: no production/test edits,
package/lockfile changes, builds, installations, benchmarks, PRs, merges, freeze or acceptance edits.
Normally push meaningful documentation checkpoints to the child, verify actual remote equality and
clean status, and remain on the child on return. The human starts sessions and reports outcomes.

Trunk reviews the completed design before assigning implementation. This child can later host an
approved implementation; intended integration is a human-approved squash into M2 before new candidate
preservation. Keep frozen `8fffcc0` and failed formal artifacts immutable. A repaired candidate must
be a descendant on accepted M2 history, with its own runtime/evidence identities.

## Required reading and inspection

- Recovery plan and completed RSS experiment, including variant confounders and controlled RSS fail.
- Canonical telemetry design/verification, architecture/domain-design, profile contract and catalog.
- Build/test/release guidance, bundler config, actual CLI/worker entry graphs and package exports.
- Current worker-telemetry-session, execute-run, worker-client/entry, telemetry barrels and their users.
- Installed OTel API implementation/types for the proposed no-op mechanism. Prefer actual dependency
  evidence; if external API facts need verification, use official sources and distinguish versions.

Do not reproduce large historical logs or treat experiment V2 as the required production architecture.

## Required detailed design

Produce one concrete recommended design, with file/responsibility/import mapping, state/transition
table, failure handling, compatibility decisions and finite implementation slices. Append it here.

1. Define the small SDK-free session contract and factory used by execution, and the enabled
   implementation boundary. Distinguish type-only imports from runtime edges. Establish which
   catalogs/helpers can remain eager and which SDK/collector/report modules must stay behind the
   enabled boundary. Cover both CLI host and worker graphs, including barrels, shared chunks and
   package bundling; source-level dynamic import alone is not proof of release isolation.
2. Distinguish disabled from enabled initialization failure: disabled must not attempt SDK import,
   provider creation or context-manager registration. Degraded may already have loaded SDKs or
   partially created resources, so it must not claim zero SDK load retroactively. Specify one warning,
   ownership-aware partial cleanup and the SDK-free fallback, with no second provider construction.
   Dynamic import rejection/module evaluation failure must enter the intended failure isolation path.
3. Specify no-op tracer/meter/root/context behavior independent of unrelated global providers.
   Keep product instrumentation OTel API-based; no custom profiling facade or general exporter layer.
   Explicitly resolve valid-but-unsampled versus invalid span IDs, parent/root context, active context
   during callbacks/iterators/plugins and externally registered context-manager interaction. Identify
   what is canonical behavior, incidental current SDK behavior, or a proposed observable change.
   Do not silently equate both nonrecording implementations. Use supported APIs without private-field
   mutation or global registration/disable side effects merely to obtain no-op behavior.
4. Preserve enabled root lifetime, async propagation, observations, metrics collection timeout,
   structured diagnostics, schema-v2 fallback/report transport and cleanup guarantees. Define
   finalization memoization/result identity and telemetry-failure isolation in every state, including
   concurrent/repeated calls and lifecycle with success/typed failure/unexpected application failure.
   Keep success-only/quiet presentation and existing domain no-op recorder/DAG selections.
5. Identify public/internal signature compatibility, test-hook routing and affected consumers/tooling.
   Keep asynchronous factory changes local where possible; no unrelated wrapper or extraction
   rewrite. No dependency upgrade, public export expansion, catalog/threshold/fixture changes.
6. Define decisive tests: actual disabled host/worker release paths cannot load SDKs; providers are
   not created even with global API providers present; enabled behavior still records; import failure
   and partial initialization degrade with correct warning/cleanup; real composition no-op identity,
   disabled output equivalence and installed-package dynamic-chunk availability remain covered.
   Negative sensitivity must distinguish a violated import/provider boundary, not rely solely on clocks
   or mocks detached from production composition. Include build graph and runtime/package evidence.
7. Map exact canonical documentation updates for implementation. In this design session leave current
   contracts unchanged; list proposed changes and rationale clearly. Give a finite validation plan,
   implementation/review split and candidate-delta/re-measurement obligations. No promise of RSS pass;
   old formal fail remains until actual descendant acceptance.

## Decision and scope control

The approved direction is sufficient to resolve ordinary file layout and interface design choices;
do not ask for repeated approval of it. If plugin/user-visible semantics cannot be preserved, or an
OTel API limitation forces a substantive tradeoff, present a concrete recommendation, alternatives
and affected contracts to the human in this design conversation. Do not silently weaken context,
error or cleanup guarantees. If no such decision is needed, complete the recommended design and
return it for trunk review rather than asking to start each design section.

Do not generalize this into whole scripts organization, span aggregation redesign, wrapper allocation
optimization, repository fixture redesign or a new telemetry framework. Preserve these deferred
topics in their existing homes. Do not add experiments to prove the already approved design direction.

## Exit packet

Return design status, exact checkpoint/remote OID, affected-file inventory and responsibilities,
resolved semantic decisions, any concrete unresolved blocker, implementation session sequence and
verification obligations. Run document format write/check and diff/link checks. No test/build campaign
is required for documentation; targeted code/API inspection is allowed. Design completion is not
implementation acceptance or permission for PR/merge. Trunk next assigns a bounded implementation.
