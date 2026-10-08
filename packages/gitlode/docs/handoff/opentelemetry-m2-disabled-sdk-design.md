# M2 disabled SDK boundary: detailed design assignment

## Active routing: integration preparation (2026-10-08)

Trunk accepts D1 implementation `04dc187573a63bd2110c381306b26fd050d53220` and D2
implementation `6e84279819ce50e961ef99dc92ffa5a90219bc34`, based on independent reviews
`f35e0e11654574be72868c380c8b58a145bea36e` and `0b10f3057ddfa321c79a05951d27df9ec2c6cdee`.
This closes the source/release-boundary implementation review only. RSS failure, formal performance,
M2 and release acceptance remain unresolved. This section supersedes earlier session assignments.

Assign a documentation/integration-preparation session on `feature/otel-redesign_M2_disabled`.
Expected parent M2 is `57fbfdaf11761cf39ce0b403a497ad5cc5fa7395`. Verify local and actual remote
source/base identities before work. Do not reset unexpected refs. No PR creation or merge is assigned.

1. Consolidate this completed design/implementation/review history into a concise
   `opentelemetry-m2-disabled-sdk-integration.md`, then remove this superseded handoff. Preserve full
   history by exact review OIDs and Git paths. Keep accepted semantic decisions in canonical docs;
   check that the integration note links there rather than creating another normative specification.
   Retain D1/D2 acceptance targets, maintenance/retrieval provenance, reviewed limits, first failures,
   archive path/manifest hash, tested dependency versions and separate evidence attribution.
2. Update README/recovery routing and stale links. Retain the unresolved formal failure, closed RSS
   experiment, old immutable freeze and all remaining T13B/GNOME/final-candidate/T13C gates. Do not
   delete other evidence or expand into broad scripts cleanup. Verify current canonical wording is
   consistent with completed D1/D2, without claiming empirical RSS improvement.
3. Independently check saved source/patch and sealed evidence identity using existing artifacts.
   If independent review logs remain only in temporary storage, preserve available logs in a new
   separately manifested archive under D:/gitlode_test; never append to the existing sealed archive.
   If unavailable, record that limit and retain committed review attribution; do not rerun a campaign
   just to recreate those logs. Tested registry-consumer SDK 2.12.0 and repository-lock SDK 2.10.0
   remain distinct inputs. The removed consumer/tarballs are not a retained frozen runtime.
4. Prepare a non-mutating merge-tree or isolated squash rehearsal against the actual remote M2 base.
   Record source/base full OIDs, ancestry, intended squash tree and exact delta from validated
   `6e84279`. Documentation-only deltas justify reuse of the accepted Windows/Linux validation;
   do not repeat full tests or package builds without a concrete new concern. Stop if there is an
   unexpected implementation/package delta, conflict or moving base that invalidates this mapping.
5. Run documentation format write/check, local link and diff checks. Normally commit/push the
   documentation checkpoint to the child; bind the final source OID/tree after that checkpoint so
   the PR proposal includes all prepared documentation. Return a concise PR title/body proposal,
   source/base/tree identities, evidence/reuse limits and clean/actual-remote checks. Leave shared
   parent refs unchanged and remain on the child. Trunk will request explicit human source/base PR
   approval; the human alone merges. Preserve child history before any later deletion.

After human squash integration, trunk must verify the resulting tree and map it to the accepted
implementation, then assign a new descendant freeze separately. That freeze must retain the actual
package, all dynamic assets and runtime dependency closure, record deltas against `8fffcc0`, and
preserve old failed evidence. No new measurement is authorized by this packet, and no old performance
acceptance transfers merely because functional D1/D2 checks pass.

## Active routing: independent D2 review

D2 is delivered, not accepted. This review-only packet supersedes the implementation assignment
below. Stay on `feature/otel-redesign_M2_disabled`; the human starts the independent session.

- Base: `a2a487ed9a01daed6f2564f44595a5996a8cf49d`.
- Maintenance: `dedc5363e3a56de40637481e4b83fc3bd801ee60`.
- Fixed implementation: `6e84279819ce50e961ef99dc92ffa5a90219bc34`.
- Outcome: `6c8b3a4ea96ed2b61855777f220183ffbdababa2`.
- Delivery: `e3fa36631e4dffbe4e85f5aae470ffd75cbcddb8`.
- Parent M2: `57fbfdaf11761cf39ce0b403a497ad5cc5fa7395`, unchanged.

Trunk verified the base-to-implementation inventory (15 files including maintenance), documentation-only
post-implementation delta (this handoff and telemetry-verification.md), clean status and local parent.
Trunk independently rehashed the Windows archive's 155 listed files: no missing/size/hash mismatch;
manifest SHA-256 matches `ac3d3796276e881e6e7eec0c5652628a83ab4f63b09110fd64c78a24d992a33c`.
This verifies saved-byte integrity, not the correctness of each assertion or acceptance of D2.

### Review scope and decisive questions

Read the approved design, D1 acceptance, full D2 diff and outcome, and relevant canonical system,
release and telemetry verification contracts. Verify ancestry, current source equality, maintenance
retrieval identity and actual parent/child refs. D1 remains accepted unless a concrete regression
from D2 is demonstrated; do not reopen approved root semantics or repeat the whole source review.

1. Does emitted metadata inspection distinguish static/lazy edges, follow shared chunks and external
   package ownership, and reject eager SDK/context/collector/report code for all three roots? Look
   for omitted edges, false negatives from tree-shaking/metadata handling, missing lazy assets and
   overly broad dependency exceptions. Do not demand fixed chunk names or arbitrary plugin coverage.
2. Do ESM/CommonJS guards positively activate in the real host and worker, observe/deny actual resolved
   package identities and preserve extraction behavior? Check worker attribution, plugin-owned SDK
   attribution, meaningful Enabled positives, exactly one degradation warning and no report under
   denial. Ensure absence assertions cannot pass because the guard or workload did not execute.
3. Does removing the enabled asset fail the normal positive assertion rather than count successful
   degradation as telemetry success? Are disposable mutations restored, child deadlines/cleanup
   adequate and fixtures contained? Confirm independent constructor sensitivity and aggregation
   static/lazy inventory coverage without running N/4N workloads.
4. Do commands durably execute all checks with strict tooling/system typing and retain existing package
   assertions? Check scope of new Node preload observation and public-only system boundary. Verify
   historical helper retirement retains reproducibility without weakening lint/orphan rules.
5. Do saved Windows/Linux command chains bind to the fixed source and actual package/runtime inputs,
   including first failures, skips and post-build packing? Consumer SDK 2.12.0 differs from repository
   lockfile SDK 2.10.0; distinguish those inputs explicitly, not a dependency upgrade or frozen-runtime
   acceptance. Tarballs/consumer directories were removed: assess what recorded hashes/logs and retained
   runtime data establish, and identify any concrete missing evidence needed for D2. A later formal
   freeze must independently retain its actual package/runtime/dependency closure.

### Finite independent verification and return

Inspect saved sealed logs/manifests and source correspondence rather than rerunning both full OS
campaigns. Run build and relevant explicit strict typing, new constructor/aggregation tests, and one
bounded release bundle plus installed-package execution to independently exercise graph/guard wiring
on one supported OS. Preserve release output until packing; use outside-checkout TEMP, owned deadlines
and retained first-failure logs. Inspect the other OS's stored full-chain evidence and name it as saved
evidence, not an independent rerun. Run format/check and diff check. Use at most one small probe per
concrete unresolved concern; avoid replaying all negative mutations or repeated package campaigns.
If tooling is unavailable, report that limitation rather than changing dependencies or accepting a
check not performed. Restore probes and do not modify sealed archives.

Return accepted or corrections required for D2, with concrete failure paths/file locations and minimal
remedies for mandatory findings. Separate optional improvements, reported/saved/independently executed
evidence and later candidate/performance obligations. Append the review here; documentation-only
commit and normal push are authorized. Confirm actual remote equality, clean status, unchanged parent
and remain on the child. No implementation repair, PR, merge, parent update, formal/diagnostic
measurement, candidate freeze or acceptance-record edit. Return to trunk for the next assignment.

## Active routing: D2 implementation and release-boundary verification

Trunk accepts the independent D1 review recorded at
`f35e0e11654574be72868c380c8b58a145bea36e` for implementation
`04dc187573a63bd2110c381306b26fd050d53220`. D1 has no mandatory correction. This section
supersedes the previous D1 assignment/review routing; those sections retain scope and evidence.
D2 is now assigned on the same `feature/otel-redesign_M2_disabled` child. Record the exact starting
checkpoint and verify the delta from the review is documentation only. Parent M2 must remain
`57fbfdaf11761cf39ce0b403a497ad5cc5fa7395`; inspect unexpected changes rather than resetting refs.

### Bounded implementation

Read the approved detailed design, D1 review, canonical telemetry verification, architecture and
build-test-release guidance plus tests/system instructions. Implement the following checks in their
existing owners; do not create a general observability or bundler framework.

1. Product-owned emitted-graph verification covers index, worker-entry and plugin-api, recursively
   following static shared-chunk edges and external dependency identities. Distinguish lazy edges
   from eager edges and recognize transitive SDK/context/collector/report ownership. Use parsed
   imports/build metadata or source-map ownership where appropriate; string search or fixed chunk
   names/counts are insufficient. Fail on forbidden eager reachability and private workspace leakage.
2. Installed-package verification uses only packed/public behavior and installed files, not private
   product-source imports. Observe ESM and CommonJS resolution/loading in both actual CLI host and
   worker, with positive guard-activation evidence per isolate. Disabled extraction must complete
   without SDK/context implementation loads. Denying those loads must leave Disabled successful and
   make Enabled degrade with its single sanitized warning while preserving application output.
   Separate plugins' own loads from gitlode's boundary using controlled fixtures.
3. The normal installed Enabled case must positively load lazy assets and produce a valid schema-2
   report/observations. Check representative adapters and plugins through existing package assertions.
   A missing enabled chunk in a disposable installation must be detected by that positive assertion;
   do not mistake a successful degraded application exit for successful enabled telemetry.
4. Prove aggregation-child lazy asset completeness and identity inventory using its existing builder
   and a small functional invocation, not N/4N or any formal/diagnostic workload. Preserve its existing
   inventory semantics when adequate. Bundler changes are allowed only for a demonstrated missing
   asset/hoisting problem. Do not redesign performance protocols or historical artifacts.
5. Demonstrate finite negative sensitivity: one forbidden eager edge must fail the graph/load boundary,
   and an SDK provider-construction regression must fail a distinct check. Reuse accepted D1 actual
   constructor/global-sentinel evidence where it proves the required claim, recording attribution;
   do not count absence of profile output as construction evidence. Restore all disposable mutations.

Keep guards and children bounded with explicit deadlines, owned cleanup and retained first-failure
logs. Do not modify global environment/Node installation or weaken checks to accommodate a guard.
Preserve the system workspace's strict typing, containment, consumer and package boundaries. Update
canonical verification/build guidance and applicable CI/command wiring so the new checks have a
durable execution path, not just a one-time probe. No dependency upgrades, public export changes,
telemetry semantics changes, threshold changes or broad scripts reorganization.

### Historical diagnosis helper disposition

The completed read-only `docs/handoff/m2-first-target-diagnosis/derive.cjs` is the known pre-existing
lint/architecture obstruction. In a separate maintenance checkpoint, retire this one helper from the
working tree and replace its live link/reproduction command in the first-target handoff with an exact
Git retrieval recipe using D1 review commit `f35e0e11654574be72868c380c8b58a145bea36e` and original
path. Verify its blob is `f6a8f88772b1a96cc0624c24f578ee4d9751819f` before removal. Preserve derived.json,
historical diagnosis and every external sealed archive. Explain that reproduction uses a restored
copy outside the working tree against saved artifacts; it must not launch measurements. This is
retirement of a completed temporary script, not a lint exclusion or evidence invalidation. Stop if
inspection reveals an active automated consumer. Do not relax lint, orphan detection or allowlists.

### Finite validation and evidence

Develop with focused graph/guard/package tests and strict checks for changed tooling (including
product tooling outside production tsc coverage); run format write/check and diff check. Save a
meaningful implementation checkpoint before cumulative verification. Preserve D1 behavior through
its existing regressions rather than reimplementing the accepted session design.

Against one fixed implementation OID, use isolated Windows and Linux/ext4 Git checkouts with TEMP
outside the checkout. Verify paths, toolchain, Git metadata, deadlines and cleanup before launching
the campaign. Run npm ci and the canonical `npm run validate:release` chain once per OS; this includes
source tests, release build, publint and installed-package checks. Do not run `npm run release` or
changeset publish. Ensure the new graph/load checks actually execute, and record any platform scope
or skipped assertions explicitly. Do not rebuild development output between release bundling and
packing. Retain package/runtime hashes, consumer compiler version and source/command/result mapping.

Store logs and manifests in a new uniquely named archive under D:/gitlode_test with a Linux copy;
verify copied hashes before sealing and never append after sealing. Document operator failures,
unresolved checks and exact verification limits. For an understood setup error, preserve the failure
and make a scoped correction; unexplained product/integrity failures stop the campaign. No repeated
runs to obtain green results, and no additional performance attempt.

Return implementation/maintenance/outcome OIDs, file/command inventory, positive and negative boundary
evidence, Windows/Linux counts/skips, package identities, archive manifest/hash and remaining issues
in this document. Normally push checkpoints to the child and verify actual remote equality, clean
status and unchanged parent. Remain on the child, stop for independent D2 review, and do not self-accept
D2/M2. No PR, merge, parent update, archive-ref replacement, freeze or acceptance-record update.
RSS causality and performance acceptance remain unresolved even if every D2 check passes.

## Trunk disposition and active implementation packet (2026-10-07)

### Active routing: D1 independent review

D1 was delivered; implementation is not yet accepted. The active assignment is now independent
review only on `feature/otel-redesign_M2_disabled`. The D1 implementation instructions below are
historical scope, not authority to modify code in the review session.

- Base: `8d622af2cfc435c06aac3ab0f8b16b5bbaf5e206`.
- Fixed implementation: `04dc187573a63bd2110c381306b26fd050d53220` (18 changed files).
- Outcome: `e34b81429492c7246b4e19c5b1257bf762c986a2`; its delta is this handoff only.
- Parent M2 remains `57fbfdaf11761cf39ce0b403a497ad5cc5fa7395`.

Read the design and D1 outcome below, canonical changed contracts and the complete fixed diff.
Verify ancestry, inventory and current implementation equality. Review the enabled move with
whitespace-insensitive comparison against the old session, as well as ordinary diff; do not mistake
execute-run indentation for a broad application rewrite or overlook the new exception boundary.

Check API no-op isolation/root/explicit-parent semantics; disabled selection before loader/hooks;
real enabled initialization and partial-resource ownership; independent cleanup after failures;
unchanged enabled collection/report/fallback/worker behavior; all nine actual no-op composition
choices; and memoized concurrent/reentrant finalization. Specifically trace whether a backend or
cleanup rejection can replace the original application result/exception, using supported production
and fault paths rather than only an invented unsupported backend. Check tests observe actual owned
resources and the production factory, and canonical claims distinguish source from release evidence.

Run build, explicit strict product-source typing and the reported affected source suites (use existing
paths; omit the two nonexistent selectors noted in the outcome), plus behavioral-baseline. Report
actual counts/skips. One bounded probe per concrete unresolved concern is sufficient; avoid replaying
all mutations or broadening into D2. Restore disposable probes before return. Review existing
negative-sensitivity evidence as reported unless independently repeated. Confirm the derive.cjs
lint/orphan diagnostics predate this slice and remain tracked; do not fix them, waive them or call
the full lint/architecture checks passing. D2/release planning must explicitly resolve or disposition
that pre-existing validation obstruction before claiming a successful cumulative chain.

Record findings with concrete trigger, expected/actual behavior, file/line and minimal remedy.
Separate mandatory defects from optional improvements and D2's deliberately pending obligations.
The absence of installed/emitted load proof is not a D1 defect, nor can D1 acceptance close it.
Finish with accepted or corrections required for D1 only, exact reviewed OID, independent versus
reported evidence and remaining gates. Append the review here, format/check and diff-check, make a
documentation-only checkpoint and normally push it to the child. Verify actual remote equality,
clean status and unchanged parent; remain on the child. No implementation edits, D2, installations,
release/package campaign, workload measurement, PR, merge, freeze or acceptance-record updates.

Design checkpoint `4adfe248e95deba40ea70e33f707eb4a0ddc091c` is accepted with the
clarifications below. The human approved invalid root IDs for Disabled/Degraded. This is design
acceptance only; the formal RSS failure remains unresolved. This section supersedes the earlier
documentation-only assignment and the proposed single implementation session below.

Use a private instance of the public API `ProxyTracerProvider`, never registered globally and never
given a delegate, plus public `createNoopMeter`. Installed API 1.9.0 confirms that this provider's
tracers fall back to API no-op tracers without consulting the global tracer provider. Keep the
provider private; expose only API tracer/meter interfaces. This avoids an SDK provider, not every
object whose API name includes Provider. No private dependency imports or custom tracer are needed.
Construct the root using `{ root: true }` and `ROOT_CONTEXT`. API no-op child spans may preserve an
explicit valid parent context while remaining nonrecording; do not assert universally invalid child
IDs. With no registered context manager, API context-scoped callbacks do not acquire async propagation
automatically. Preserve this existing limitation; Disabled/Degraded must not install a manager to
remove it. Test explicit contexts and an existing compatible manager separately.

### Session sequence

1. **D1: source session boundary and lifecycle implementation**, assigned now on
   `feature/otel-redesign_M2_disabled`. Implement and checkpoint the coherent source change and
   focused regression evidence described below. Return for independent D1 review.
2. **D2: emitted/installed boundary and tooling verification**, assigned after D1 review. Add the
   release graph and real host/worker import guards, packed enabled-chunk positive checks, negative
   sensitivity and aggregation asset-closure verification from the detailed design. Run the bounded
   release/package validation chain and record exact package/source identities. Source-only D1
   evidence cannot substitute for this gate. Do not run formal performance workloads.
3. Independent cumulative review, then trunk prepares integration and requests explicit human PR
   approval. Human squash-merges the child into M2; preserve child history before deletion. Only
   after integration can a separately assigned descendant freeze and measurement follow.

### D1 scope and stopping point

- Read this entire design, canonical telemetry/verification and architecture/domain-design guidance,
  plus repository instructions. Record starting OID, clean status and parent M2 OID. Work on the
  existing child; do not reset it or copy experimental variants into production.
- Introduce the type-only contract, SDK-free owner/no-op backend and lazy enabled implementation.
  Move the existing enabled behavior with minimal changes. Preserve public signatures and hook
  compatibility; route worker hooks through the actual requested enabled state. Update affected
  direct consumers only where required by this split.
- Implement guarded import failure and ownership-aware partial cleanup, original application result
  preservation, memoized finalization and the approved root semantics. Preserve enabled collection,
  report fallback and all nine actual no-op composition choices. Avoid unrelated wrapper changes.
- Add source-level tests for disabled loader non-invocation, global-provider isolation, root/parent
  semantics, enabled recording/context, partial acquisition/cleanup failures, import rejection,
  concurrent/reentrant finalization and application disposal/result preservation. Exercise the real
  production factory, not an alternative test implementation. Preserve existing real worker fallback
  and recorder-identity regressions. Fault tests must have finite deadlines and restore globals.
- Update affected canonical telemetry, architecture and developer/plugin-facing semantic guidance
  with the implementation. Clearly leave emitted/installed zero-load proof pending D2; do not claim
  a release validation or performance pass. No CLI/schema/dependency/export/threshold changes.
- Run build, affected session/execution/collector/worker suites, applicable production strict typing,
  architecture, lint, format write/check and diff check. Report exact commands, counts and skips;
  do not describe a build as full test-source typechecking. Record pre-existing diagnostics separately.
  Keep one meaningful fail-before/sensitivity demonstration per new boundary, not a large mutation
  campaign. Do not run installations or full Windows/Linux package campaigns under D1.
- Make meaningful implementation and outcome checkpoints, normally push to this child, and verify
  actual remote OID and clean worktree. Do not update M2, integration, main, archive refs or frozen
  artifacts. No PR, merge, freeze, formal/diagnostic measurement or acceptance-record edits.
- Return exact implementation/outcome OIDs, changed-file responsibilities, verification evidence and
  remaining D2 obligations here. Remain on the child. Do not self-accept D1 or start D2.

If a deterministic operator/test setup error is understood, preserve the first failure and correct
it within scope. Stop and report a product-contract conflict or an unexplained integrity/workload
failure. Never repeat tests merely to obtain green evidence or broaden into another RSS experiment.

The trunk API/source review required no new human semantic decision. Package graph and runtime load
properties are deliberately left as implementation evidence, not inferred from the design. The
existing aggregation helper already inventories emitted JS files recursively; D2 must verify dynamic
asset completeness before deciding whether any change is necessary.

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

## Detailed design proposal (2026-10-07)

### Review status and provenance

This section is a proposal for trunk design review, not a change to accepted runtime contracts.
The starting checkpoint is `57fbfdaf11761cf39ce0b403a497ad5cc5fa7395` on
`feature/otel-redesign_M2`; the design child is `feature/otel-redesign_M2_disabled`.
The delta from `85526d2f95503acd4adeef833c7de038ae28e8d4` to that checkpoint consists only
of four handoff Markdown files (README, recovery plan, RSS experiment and this assignment).
The working tree was clean and the child did not exist locally before creation. No experimental
implementation is imported into this design.

The closed [RSS experiment](opentelemetry-m2-rss-experiment.md) supplies a reachable-work rationale,
not causal attribution. V1 changes span-ID semantics; V2 also changes empty finalization and bundle
layout. The two time windows, order/cache and observation effects remain confounders. The controlled
formal failure, frozen `8fffcc0`, diagnostic refs and sealed evidence remain unchanged. This design
does not promise an RSS pass or authorize another experiment.

Inspection used checkpoint source, manifests/lockfile, `tsdown.config.ts`, actual entry imports,
session consumers and installed API 1.9.0 JavaScript/declarations. SDK dependencies resolve to
2.10.0 in the lockfile; sdk-trace-base is an index-shim to sdk-trace in this version, so a boundary
check must include the resolved transitive SDK graph. No build or workload was run to infer the
future emitted graph. Proposed release isolation below is a validation obligation, not a measured
property of an unimplemented design.

### Responsibilities and import boundary

Keep orchestration in execution and retain OTel API types in every instrumentation/plugin contract.
Use the existing `worker-telemetry-session.ts` path as the SDK-free composition entry. Keep the
`WorkerTelemetrySession` class name, static asynchronous `create(enabled = true)` and instance
methods, but change its private implementation into a session owner delegating to one selected
backend. This minimizes internal consumer churn and preserves catalog ownership names. This is a
run lifecycle boundary, not a new tracing facade or destination/exporter abstraction.

| File/group (relative to `packages/gitlode`)                                                                                                            | Proposed responsibility and runtime edges                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/execution/telemetry/worker-telemetry-session.ts`                                                                                                  | SDK-free owner, disabled selection before any import attempt, guarded lazy enabled import, warning/fallback, root execution and finalization memoization. Imports OTel API, SDK-free no-op module and contract metadata only.   |
| New `src/execution/telemetry/worker-telemetry-contract.ts`                                                                                             | Internal type-only backend construction/result contract, warning and test-hook types. Uses API types and `ProfileReport` via `import type`; no runtime imports or SDK types.                                                    |
| New `src/execution/telemetry/noop-worker-telemetry.ts`                                                                                                 | SDK-free fallback construction; no collectors/report builders or global provider lookup. Concrete no-op semantics require the human decision recorded below.                                                                    |
| New `src/execution/telemetry/enabled-worker-telemetry.ts`                                                                                              | Owns enabled initialization, resource ledger, root, real providers/context manager, collection/report/shutdown. Sole lazy target of owner; exports internal enabled construction function. No SDK creation at module top level. |
| Existing `local-span-processor.ts`, `local-metric-reader.ts`, `diagnostic-accumulator.ts`, `profile-report-builder.ts`, `profile-report-primitives.ts` | Retain current collection/report responsibilities; runtime reachability from enabled module only in product execution. No move to foundation/contracts.                                                                         |
| `src/execution/execute-run.ts`                                                                                                                         | Retains application composition and result policy. Calls existing async factory, receives API tracer/meter/root, keeps singleton domain recorder/DAG selection using `recordingEnabled`. No SDK import.                         |
| `src/execution/worker-entry.ts`                                                                                                                        | Retains worker message boundary. Test seam imports only SDK-free owner; forwards actual enabled argument instead of forcing `true`.                                                                                             |
| `src/execution/worker-client.ts`, `src/execution/index.ts`, `src/index.ts`                                                                             | Retain dispatch, domain barrel and CLI boundary. No enabled-module imports/re-exports.                                                                                                                                          |
| `src/execution/telemetry/index.ts`                                                                                                                     | Existing internal test convenience barrel is SDK-heavy. Product imports must not use it; do not re-export the enabled implementation or route owner imports through it. Existing collector tests may retain it.                 |
| `scripts/telemetry-aggregation.ts`, `scripts/telemetry-aggregation-child.ts`                                                                           | Retain owner-path import and await factory; keep tooling behavior/identity policy, account for lazy chunks in bundle inventory.                                                                                                 |
| `tsdown.config.ts`                                                                                                                                     | Retain stable three entries, external SDK dependencies and bundled private workspaces. Preserve dynamic split and package asset closure; change config only if real graph verification requires it.                             |

The backend type includes API `getTracer`, `getMeter`, `rootSpan`, `rootContext`, boolean
`recordingEnabled`, and an internal asynchronous finalization operation returning optional report
data. Public instance methods remain the current methods including `runInRootContext<Value>` and
`finalize<Result>`. The owner holds the first application result and optional initialization warning;
backends cannot replace application results. Do not export these types through package exports.
The enabled module imports the contract only as types, avoiding a runtime cycle to the owner.

Eager work may retain OTel API, core scope/convention constants, `TELEMETRY_SPANS` run metadata,
SDK-independent profile model/normalization and timing helpers already reachable through the
contracts barrel. Moving or slimming that barrel is unnecessary. Catalog YAML is never loaded at
runtime. Collectors, report construction/fallback implementations, SDKs, SDK transitive dependencies
and context-async-hooks stay outside the product eager closure. Merely retaining a report type
must not add a runtime report-builder import.

The host path is `src/index.ts -> execution/index.ts -> execute-run.ts -> session owner`; dispatch
then creates `worker-entry.js`. The worker path is `worker-entry.ts -> execute-run.ts -> session
owner`, including its test hook. Host imports of `executeWorkerRunRequest` through shared modules
must remain safe even though the host never creates a worker session. Only an enabled worker calls
`await import("./enabled-worker-telemetry.js")`. Place that expression inside the initialization
`try`, with no eager preload, module-scope import promise or hidden SDK re-export.

The release requirement applies to static transitive closures of `dist/index.js`,
`dist/worker-entry.js` and `dist/plugin-api.js`, including every shared hashed chunk and external
resolution. They must contain no runtime edge to SDK/context-manager/collector/report-builder code.
Dynamic edges may reach an enabled chunk, which must be included under published `dist` and resolve
from the installed worker. Source `import()` alone does not establish this: bundling may hoist a
dependency into a shared chunk. Inspect output module metadata plus parsed emitted imports/code
ownership and prove runtime behavior in both isolates. Do not assert exact chunk names/counts.

### Approved no-op root semantics (2026-10-07)

The human explicitly approved changing Disabled and initialization-Degraded root span identity from
the current SDK's valid unsampled IDs to the standard API no-op invalid span context. This semantic
decision is no longer pending. It does not approve implementation or accept the whole design review.

Construct the session root with explicit root semantics and ROOT_CONTEXT; do not inherit an external
active parent merely to obtain a valid ID. The root is nonrecording with invalid trace/span IDs.
Disabled and fallback do not generate replacement valid IDs or construct SDK providers for identity.
Keep API span/context types, and the established root lifetime and API context-scoped execution.
Document that a plugin inspecting the provided root span context can observe this change; disabled
telemetry no longer supplies a valid tracing identity for correlation. Extraction outputs, checkpoint
semantics, warning policy and enabled span identity/parent/async propagation remain unchanged.

Do not generalize this root decision to every child span or context. Specify and test the chosen API
no-op behavior with explicit valid parent contexts as well as the invalid session root. It must not
record through unrelated global tracer/meter providers, and must not register, replace or disable an
external context manager. Initialization-Degraded may already have loaded SDK code; retain owned
partial-resource cleanup before returning the SDK-free fallback. This approval does not promise to
unload evaluated SDK modules or eliminate wrapper allocations.

The concrete API construction and parent-context cases remain subject to design review against the
installed dependency. Migration of this approved semantic contract into canonical developer/plugin
guidance and tests belongs to the separately assigned implementation, not this documentation checkpoint.

### Initialization state machine and ownership

| State                         | Trigger                                   | Actions and next state                                                                                                              |
| ----------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Unselected                    | `create(false)`                           | Construct SDK-free no-op backend, no import hook/provider/context registration; Disabled.                                           |
| Unselected                    | `create(true)`                            | Enter guarded import attempt; Importing.                                                                                            |
| Importing                     | Module resolves/evaluates successfully    | Invoke enabled constructor under the same isolation boundary; Initializing.                                                         |
| Importing                     | Resolution, linking or evaluation rejects | One sanitized initialization warning, no retry; Degraded with SDK-free fallback. Some dependencies may already have evaluated.      |
| Initializing                  | All resources and root/context ready      | Transfer ledger ownership to enabled backend; Enabled.                                                                              |
| Initializing                  | Any step fails                            | Independently clean all owned partial resources, then one warning and SDK-free fallback; Degraded. No second provider construction. |
| Disabled / Degraded / Enabled | First `finalize(result)`                  | Store first result and memoized promise before executing lifecycle work; Finalizing.                                                |
| Finalizing                    | Concurrent/repeated `finalize(other)`     | Return exactly the same promise; ignore later result arguments.                                                                     |
| Finalizing                    | Best-effort stages complete               | Cache exact finalization object; Finalized.                                                                                         |
| Finalized                     | Any `finalize(other)`                     | Return same promise and same resolved object, without new cleanup/report work.                                                      |

Enabled loading/initialization is once per session; there is no automatic enable/degrade recovery or
mode switching. Concurrent independent enabled sessions in one isolate are unsupported, as today;
production creates one session per single-request worker. Test contexts must isolate global state.
`recordingEnabled` is true only after successful initialization; false in Disabled and Degraded.
Disabled and Degraded return no `profileReport` property, rather than an empty schema-v2 report.
Degraded carries exactly `{code: "telemetry_initialization_failed", message: null}`. The owner
returns that warning; execution emits the existing structured warning once. Imports/cleanup must
not emit additional product warnings or expose raw exceptions.

The enabled constructor keeps an explicit resource ledger: processor, reader, trace provider,
meter provider, candidate context manager, registered owned manager and root if started. Record
acquisition immediately after each successful construction; transfer processor/reader cleanup
ownership to the respective provider only after successful provider construction. If a constructor
throws before returning, clean still-owned processor/reader directly. Never shut the same resource
down both independently and through its provider. End a started root before trace shutdown on
initialization failure. All cleanup failures are contained and do not skip subsequent resources.

Candidate manager construction, enable and registration remain distinct attempts. Registration
success transfers ownership to the session. Rejected registration preserves the external compatible
manager and disables only the candidate; failure to enable/register triggers owned candidate cleanup.
For a manager registered by gitlode, unregister/disable through `context.disable()` only while that
registration remains owned. External replacement/disable during a run is unsupported; the API has
no public compare-and-unregister primitive. Never inspect private global fields to guess ownership.
Existing compatible external manager ownership is never acquired. No fallback registers or disables
a manager to obtain no-op tracing. Degraded does not retroactively claim that SDKs were never loaded.

### Finalization and application lifecycle

Keep the accepted order: application work and application resource disposal, root end, trace flush,
span snapshot, metric collection, report construction, all telemetry shutdown, result delivery.
Preserve enabled async propagation, root parent policy, catalog observations, manual collection's
1,000 ms SDK timeout, structured diagnostic effects/coverage, fixed schema-v2 report fallback and
worker transport. Timeout does not cancel callbacks or preempt synchronous plugin execution.
Retain best-effort independent stages and post-shutdown diagnostic enrichment; an already-built
report survives shutdown failure. A snapshot failure must reach a safe unavailable/fixed fallback
and still execute shutdown, rather than rejecting finalization. Do not add an indiscriminate catch
that labels an initialization failure as a report or invents trusted measurements.

Disabled/Degraded finalization ends the API root once, performs no flush/collect/report/provider
shutdown and returns the original result with only the optional warning. Partial initialization
cleanup has already completed before Degraded is returned. Both backends isolate telemetry failures;
owner-level promise memoization uses a deferred microtask or preallocated promise so reentrant hooks
cannot start a second finalization before the promise is stored. The method itself must not be
`async`, which would wrap and change promise identity. Repeated callers must use the same result
type; the existing generic signature does not promise safety for conflicting later type arguments.

Success, typed user error and unexpected application failure all retain current result classification
and finalization. In default execution unexpected errors become `runtime-error`; the supplied
telemetry test path still preserves the original thrown value. Ensure the owned session is finalized
in an application-lifecycle guard if an unexpected rejection occurs outside the existing application
catch; preserve and rethrow that original value after cleanup rather than converting it into success
or a telemetry error. Do not catch reporter/application errors as initialization failures. Keep
application disposal inside root lifetime. Getters after finalization do not reopen a session;
starting new application work with a finalized session is unsupported.

The returned application result retains reference identity within session finalization. Execution's
existing attachment of profile data may create a transport result object; do not confuse that with
session result identity. Success-only display and quiet behavior remain unchanged. Existing disabled
singleton Git/DAG/extraction/expansion/projection/line-diff/output/plugin recorders remain selected;
this change does not bypass tracing wrappers or redesign extraction.

### Compatibility and internal test routing

There is no public package export, plugin-context signature, CLI option, config, schema or dependency
change. `WorkerTelemetrySession.create()` is already asynchronous; retain its default `true`, so
callers and aggregation tooling need no async cascade. Keep current instance names/types and
warning/finalization shapes, and re-export moved types from the existing owner path using type-only
exports. The construction object and private resource fields are implementation details; change
their internal types to the backend contract without exposing SDK resources.

Keep `createWorkerTelemetrySessionForTest(hooks)` as the enabled-default compatibility form, adding
an optional enabled argument for actual disabled composition tests. Route it through exactly the
same owner/factory as production. Preserve existing lifecycle failure names and timeout override;
add `enabled_module_import` and a narrow internal loader override for deterministic rejected-import
tests. The loader seam must sit around the real dynamic import, never inside an eagerly imported
SDK implementation. Fault hook exceptions also enter initialization isolation. Disabled must not
call the loader or any provider/context/collector hook even when hooks contain failures.

Update the existing worker-data builder-failure seam to pass its `enabled` argument; it must not
force SDK initialization when `input.profile` is false. Keep hooks internal, never driven by a CLI
flag, environment option or public plugin contract. Tests needing collectors may keep their
SDK-heavy internal barrel imports; release import tests must launch the real entries rather than
import that barrel. Existing session tests, execution composition tests and aggregation scripts are
the known direct consumers. Historical inspection scripts/artifact identity files remain untouched.

### Decisive verification plan for implementation

These are future checks, not runs authorized in this document session. Use finite test deadlines
and disposable negative variants; never mutate preserved experiment/frozen evidence.

| Evidence owner                                                                                     | Required positive evidence                                                                                                                                                                                                                                                                                                     | Negative sensitivity / failure criterion                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session unit/integration tests (`test/telemetry/worker-telemetry-session.test.ts`)                 | Disabled never invokes import/construction hooks; global recording trace/meter providers cannot capture session calls; no-op root/tracer/meter/context semantics follow the approved decision. Finalize promise/object/result identity holds concurrently and repeatedly in all states.                                        | Throwing loader and provider hooks have no effect when disabled; intentionally route through a global provider and require the recording sentinel to detect it.                                                                                                                             |
| Initialization tests in same file                                                                  | Actual import rejection and module-evaluation rejection degrade; failures before/after each acquisition clean all and only owned resources once, one warning, no report, no fallback SDK construction.                                                                                                                         | Inject trace/meter/context initialization and cleanup failures together; later cleanup must still occur. Count actual constructor effects in addition to hook invocations.                                                                                                                  |
| Enabled session/collector tests                                                                    | Real providers still record root/child, counters/histograms and observable metrics; context survives awaited work; external compatible manager is retained. Root end follows application disposal. Existing timeout, diagnostics, report fallback, simultaneous shutdown failure and worker transport cases still pass.        | Broken snapshots, throwing builder, rejected/non-settling observable and failing shutdown remain bounded and non-rejecting; finalization does not skip remaining stages.                                                                                                                    |
| Execution tests (`test/execution/execute-run.test.ts`, worker-client tests and plugin owner tests) | Actual disabled and Degraded composition retains all nine observed no-op recorder slots, no instruments/clock reads/timing tokens; success/user error/runtime error keep result/output/disposal behavior. Worker seam respects profile=false.                                                                                  | Replace one no-op recorder with its real implementation in a disposable variant and require identity/instrument assertions to fail. Do not infer composition from clocks alone.                                                                                                             |
| Product-owned release graph check                                                                  | Parse actual build output graph for all three entries, shared chunks, dynamic targets and external dependency closure. Attribute collector/report code via build module metadata or source-map ownership, not filenames alone. Assert no forbidden eager SDK/collector/report edge and no private workspace specifier leakage. | Disposable static import of enabled module in owner, worker seam or shared barrel must fail the graph check. A disabled provider-construction regression must fail a separate constructor check even if imports remain lazy.                                                                |
| Installed-package workspace (`tests/system/scripts/test-installed-package.ts`)                     | Packed installed CLI launches real worker with profile off/on, both adapters and representative plugins; external runtime load guard records host and worker separately. Disabled resolves/loads no forbidden SDK/context implementation; enabled actually loads the enabled chunk and produces a valid report.                | Deny resolution/loading of SDK family plus its transitive SDK graph: disabled succeeds and enabled cleanly degrades with one warning. Removing a required dynamic chunk from a disposable installation must fail the normal enabled-report assertion rather than count fallback as success. |
| Existing equivalence checks                                                                        | Disabled/enabled/degraded extraction compares JSONL bytes/sequence within adapter, semantic results/checkpoints, plugin values and application cleanup using existing approved normalization. Success-only profile and quiet UX remain covered.                                                                                | Changed semantic output/ref/count, absent checkpoint timestamp and inappropriate disabled warning/report must fail. Do not normalize newly differing facts away.                                                                                                                            |

The load guard must observe both ESM resolution/loading and CommonJS dependency loads, installed
realpaths and package identities. Worker startup must inherit the observation mechanism explicitly;
a host-only preload is insufficient. Attribute application/plugin loads separately: a plugin that
independently imports an SDK is outside gitlode's zero-load guarantee and must not contaminate the
boundary fixture. A global-provider sentinel can deliberately preload SDKs in separate tests;
those tests establish zero session construction/recording, not zero process SDK loads.

Keep release-graph/internal ownership checks in product-owned tests/tooling, while installed checks
use only package/public entry behavior and installed filesystem evidence. Do not add private source
imports to the system workspace. Normal packed installations still contain declared SDK packages;
the promise is no disabled evaluation/construction, not smaller install size or absent dependency
files. Assert absence of SDK constructors and collector module evaluation, not just absence of
`--profile` output or elapsed time. Build inspection, real runtime guards and global sentinels provide
independent evidence rather than mocks detached from production composition.

### Canonical documentation migration on approved implementation

This proposal deliberately leaves the following accepted documents/catalogs unchanged. Each
implementation slice updates its affected audience in the same reviewable checkpoint.

| Canonical home                                                                                                                                                                   | Exact intended update / rationale                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [telemetry.md](../design/telemetry.md), API boundary / Worker telemetry session / Local profile mode / Failure isolation / composition ownership                                 | Define SDK-free disabled/fallback, guarded enabled import, resource ownership, finalization identity and approved no-op/context semantics. Distinguish requested disabled from initialization-degraded without adding a user-selectable mode. |
| [telemetry-verification.md](../design/telemetry-verification.md), recorder composition / Failure injection / equivalence                                                         | Add real entry/load/provider negative sensitivity, import failure and partial cleanup, context/no-op semantics and concurrent finalization checks.                                                                                            |
| [architecture.md](../design/architecture.md), execution/telemetry boundary; [domain-design.md](../design/domain-design.md), execution charter / package envelope / source layout | Clarify lazy worker SDK implementation and SDK-free owner, same-domain import responsibilities, no SDK leakage through barrels. Closed domain/package allowances stay unchanged; no new telemetry domain/barrel.                              |
| [build-test-release.md](../contributing/build-test-release.md), Release build and bundling / Installed-package validation                                                        | Require lazy runtime asset closure and disabled static-graph/runtime proof; preserve three stable entries and flexible hashed chunks.                                                                                                         |
| [usage.md](../usage.md), plugin telemetry guidance; [profiling.md](../profiling.md), CLI behavior                                                                                | Explain approved no-op behavior relevant to plugin authors and initialization degradation; state that disabled does not initialize the local SDK. Keep warning/report/quiet UX unchanged.                                                     |
| [telemetry-performance.md](../design/telemetry-performance.md) and [harness guide](../contributing/telemetry-performance-harness.md)                                             | No thresholds/fixture/protocol changes. Link candidate-delta evidence if needed; keep existing acceptance authority.                                                                                                                          |
| [recovery plan](instrumentation-opentelemetry-recovery-plan.md) and this handoff                                                                                                 | Record trunk disposition, bounded implementation assignment and descendant evidence identities. Migrate accepted decisions into canonical homes; retain historical failures and experimental limits.                                          |

The span/metric/attribute/report/view catalogs, generated metadata, public exports, dependency
versions, acceptance records and frozen artifacts need no change. The root still has owner
`WorkerTelemetrySession`, identical enabled lifetime/observations and schema-v2 transport. Do not
duplicate catalog rules in the new internal contract or add a replacement observation catalog.

### Finite implementation and review sequence

1. Trunk reviews this proposal and the human semantic decision. Assign one bounded implementation
   session on this child; no implementation begins under the present design assignment.
2. Implement the contract/owner/no-op boundary and move the existing enabled lifecycle into its lazy
   module. Route hooks/worker seam and update direct consumers with no extraction rewrite. Add
   session/context/global-provider/partial-cleanup/finalization tests and update telemetry docs.
3. Add real release graph and installed host/worker/load negative checks in their existing owners;
   verify packed enabled assets and aggregation-child bundle closure. Make a bundler adjustment only
   if those checks reveal hoisting or omitted dynamic assets. Update build/verification guidance.
4. Complete functional validation once on the fixed implementation: format write/check, focused
   session/execution/collector tests, architecture/build checks, then the required release/package
   chain (including publish-acceptance policy without changing the blocked record). Broaden only for
   a failure or new change. Preserve exact source/runtime/package identities and first failures.
5. Independent trunk review checks semantics, all import graphs and failure ownership against this
   design. Resolve findings in a bounded session before candidate preparation; no automatic PR/merge.
6. Human assigns any integration and repaired-candidate preservation. Compare accepted M2 ancestor
   with the repaired candidate, inventory source/build/tooling/doc deltas and new runtime chunks,
   preserve candidate/harness/fixture/dependency identities and then separately assign measurement
   under existing readiness and formal policy. Reuse old evidence only for explicitly identical
   scope. Formal RSS remains failed until actual descendant acceptance; full applicable T13B,
   final combined candidate checks and T13C remain obligations.

These are finite implementation/review slices, not authority to run all sessions automatically.
Wrapper allocation, span aggregation, script reorganization, fixture redesign and export backends
remain in their existing deferred homes. No new diagnostic workload is proposed to justify the
already-approved removal of reachable unnecessary SDK work.

## D1 source implementation checkpoint (2026-10-07)

D1 source/lifecycle work is implemented on `feature/otel-redesign_M2_disabled`, pending independent
review. Starting HEAD was `8d622af2cfc435c06aac3ab0f8b16b5bbaf5e206`; the worktree was clean.
Local parent M2, its remote-tracking ref, merge base and actual remote parent all resolve to
`57fbfdaf11761cf39ce0b403a497ad5cc5fa7395`. Actual remote child initially matched the starting HEAD.
No parent, integration, archive, frozen artifact or acceptance record is updated.

The source checkpoint contains the type-only contract, SDK-free owner/API no-op backend and lazy
enabled backend, plus guarded import/partial cleanup, deferred finalization, worker enabled routing,
execution lifecycle guard, focused regressions and canonical audience documentation. It does not
establish emitted or installed zero-load proof. The outcome section below records the committed
source identity, final command evidence and remaining D2 obligations. No D1 self-acceptance is made.

## D1 outcome for independent review (2026-10-07)

Implementation checkpoint: `04dc187573a63bd2110c381306b26fd050d53220`, normally pushed to the
assigned child. This outcome-only documentation checkpoint follows it; its exact OID is returned
with the final remote/worktree verification rather than attempting a self-referential commit hash.
D1 is ready for independent review, not self-accepted. No product-contract conflict was found.

### Changed-file responsibilities

All paths below are relative to `packages/gitlode`.

| Files                                                               | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/execution/telemetry/worker-telemetry-contract.ts`              | Type-only API/backend, finalization, warning and internal hook contract; no SDK types/runtime imports.                                                                                                                                                                                                                                                                                                                                       |
| `src/execution/telemetry/worker-telemetry-session.ts`               | SDK-free owner, disabled selection before loader/hooks, guarded dynamic import, one sanitized degradation warning and deferred promise/result memoization. Existing factory/method defaults and type-only compatibility exports remain.                                                                                                                                                                                                      |
| `src/execution/telemetry/noop-worker-telemetry.ts`                  | Private never-delegated API ProxyTracerProvider plus API no-op meter, explicit invalid root, API context and root-only finalization. No global provider lookup or SDK construction.                                                                                                                                                                                                                                                          |
| `src/execution/telemetry/enabled-worker-telemetry.ts`               | Moved existing enabled providers/collection/report/shutdown with minimal lifecycle changes; partial resource ownership/cleanup including a started root, and unavailable span snapshot on failure before continued collection/shutdown.                                                                                                                                                                                                      |
| `src/execution/execute-run.ts`                                      | Acquired-session lifecycle guard preserves unexpected rejection after cleanup. Existing application classification, disposal, nine actual no-op composition choices and report transport remain. Most diff lines are indentation under this guard.                                                                                                                                                                                           |
| `src/execution/worker-entry.ts`                                     | Existing internal builder-failure hook forwards actual requested enabled state.                                                                                                                                                                                                                                                                                                                                                              |
| `test/telemetry/worker-telemetry-boundary.test.ts`                  | 21 source-factory regressions: no loader/provider/context hooks when disabled, global isolation, invalid root/explicit parent/context semantics, rejected import/evaluation/hook, owned partial cleanup and actual cleanup rejection, reentrant finalization, broken span snapshot. Fault promises have finite deadlines; globals/spies are restored. SDKs deliberately imported by this test are sentinels, not process zero-load evidence. |
| `test/execution/execute-run.test.ts`                                | Success/user/runtime classification and disposal before root end in all three states; retained application-result identity; original composition rejection after finalization. Existing nine recorder/DAG identity regressions remain.                                                                                                                                                                                                       |
| `test/execution/worker-profile-fallback-transport.test.ts`          | Preserves real enabled worker fallback; adds profile=false through the same hook and application-result comparison. This uses development output, not an installed package.                                                                                                                                                                                                                                                                  |
| `docs/design/telemetry.md`, `docs/design/telemetry-verification.md` | Canonical no-op/root/context, lazy boundary, degradation/ownership/finalization contracts and separate source versus release evidence.                                                                                                                                                                                                                                                                                                       |
| `docs/design/architecture.md`, `docs/design/domain-design.md`       | Same-domain lazy implementation and SDK-free owner/type contract; no new domain/package/export.                                                                                                                                                                                                                                                                                                                                              |
| `docs/design/plugins.md`, `docs/usage.md`, `docs/profiling.md`      | Developer/plugin/user guidance for invalid no-op root identity, context limitation and initialization degradation.                                                                                                                                                                                                                                                                                                                           |
| `docs/contributing/build-test-release.md`                           | Records independent lazy asset/release boundary obligations as pending D2.                                                                                                                                                                                                                                                                                                                                                                   |
| This handoff                                                        | Starting identities, implementation/outcome attribution, verification and stopping boundary.                                                                                                                                                                                                                                                                                                                                                 |

No dependency, lockfile, CLI/config/schema, public package export, observation catalog, threshold or
fixture contract changed. No experimental production variant was copied into this implementation.

### Verification evidence

Commands ran from the repository root. Git commands used per-invocation
`-c safe.directory=C:/Users/t-wakabayashi/source/gitlode`; no persistent Git configuration change
was made. Development build/architecture and source tests do not establish release/package proof.

- `npm run build:dev`: pass (production composite solution; tooling retains its existing noCheck).
- `npx tsc -p packages/gitlode/tsconfig.json --noEmit --incremental false --composite false --noCheck false`:
  pass, explicit strict product-source check. This is not full test-source typechecking.
- Final source suite command below: **10 files, 172 tests passed, 0 skipped**. Two supplied selectors
  (`profile-report-builder.test.ts` and `diagnostic-accumulator.test.ts`) match no standalone files;
  their actual collector/report/diagnostic cases are in `local-collection.test.ts` and session tests.
  No separate nonexistent suite is claimed.

```text
npx vitest run packages/gitlode/test/execution packages/gitlode/test/telemetry/worker-telemetry-boundary.test.ts packages/gitlode/test/telemetry/worker-telemetry-session.test.ts packages/gitlode/test/telemetry/local-collection.test.ts packages/gitlode/test/telemetry/profile-report-builder.test.ts packages/gitlode/test/telemetry/diagnostic-accumulator.test.ts packages/gitlode/test/telemetry/profile-report-primitives.test.ts
```

- `npx vitest run packages/gitlode/test/telemetry/behavioral-baseline.test.ts`: **1 file, 12 tests passed,
  0 skipped**. Frozen pre-migration behavior and same-adapter disabled/enabled equivalence remain.
- `npx oxlint packages/gitlode/src/execution packages/gitlode/test/execution packages/gitlode/test/telemetry/worker-telemetry-boundary.test.ts`:
  pass for the affected source/test scope.
- `npm run format:write` followed by `npm run format:check`: pass across workspaces.
- `git diff --check`: pass. UTF-8 reading and relative local target checks covered **69 Markdown links**
  across changed documents; linked lifecycle/verification anchors were inspected.

Broad checks retain pre-existing diagnostics, separately from implementation evidence:

- `npm run lint`: exit 1, only `docs/handoff/m2-first-target-diagnosis/derive.cjs` lines 2/3/4,
  `import(no-commonjs)` (three existing require calls). The exact file/calls exist at starting
  `8d622af`; no edit or policy exception was applied.
- `npm run architecture:check`: development build passes; architecture exit 1 only for the same
  existing `derive.cjs` orphan. All module boundaries, circular/dependency/export/import checks pass.
- `npx rev-dep config lint`: exit 0, existing compact detector declaration warning (0 errors,
  1 warning); configuration is unchanged.

First diagnostics/corrections are retained rather than relabeled as green runs: initial full lint
also found a new prefer-const in the boundary test, corrected before the final targeted/broad checks.
Initial architecture also interpreted a literal evaluation-test data URL as an unresolved package;
the test now constructs its URL in a local variable and asserts the actual module-evaluation error.
No product import is hidden by this test-only adjustment. One documentation editing command failed
on Python's Windows default cp932 decoding before reaching architecture docs; remaining edits use
explicit UTF-8, and all changed Markdown is valid UTF-8. Initial sandbox Git calls needed a
per-command safe.directory; sandbox network access failed, then authorized normal push/read-only
remote verification succeeded outside the network sandbox. These are operator/tool setup failures,
not application/workload failures.

### Bounded negative sensitivity

Three disposable source mutations, each restored byte-for-byte in a finally block, ran only the
named production-factory test filter. Each Vitest invocation exited 1 as required; a 30-second outer
process deadline bounded each invocation. No frozen/experimental evidence was modified.

| Mutation                                                      | Command suffix on `npx vitest run packages/gitlode/test/telemetry/worker-telemetry-boundary.test.ts` | Result                                                                                                                                               |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bypass `if (!enabled)` early no-op selection                  | `-t "disabled never calls a rejected"`                                                               | 1 failed / 20 filtered skips: rejected loader produced an inappropriate initialization warning.                                                      |
| Route no-op `getTracer` through `trace.getTracer`             | `-t "no-op root/explicit parent"`                                                                    | 2 failed / 19 filtered skips: external SDK sentinel recorded the child.                                                                              |
| Execute backend finalization before storing the owner promise | `-t "memoizes reentrant, concurrent and repeated enabled"`                                           | 1 failed / 20 filtered skips, plus 54 expected negative-variant unhandled stack errors from repeated reentry; process completed in under one second. |

The reentry test was subsequently limited to one deliberate reentry to keep future failure output
bounded as well; the final 172-test positive suite includes that revision. The negative run is not
relabeled. Global tracer/meter sentinel tests also positively call the unrelated global APIs and
assert that those sentinels detect recording, so absence through the session is meaningful.
These are source boundary sensitivities only, not D2 import/load guard sensitivity.

### Remaining D2 and stopping boundary

After independent D1 review, a separately assigned D2 must:

1. Add emitted graph checks for all three stable entries, shared/dynamic chunks, external SDK and
   transitive SDK closure, collector/report ownership and private workspace specifier leakage.
2. Add real host and worker ESM/CommonJS resolution/load guards and independent constructor checks;
   SDK denial must allow Disabled and cleanly degrade Enabled with one warning. Attribute fixture
   plugin loads separately. Demonstrate disposable negative sensitivity.
3. Positively validate packed installed Enabled chunk/report behavior and negative missing-chunk
   detection, representative adapters/plugins, plus aggregation-child dynamic asset completeness.
   Existing recursive aggregation inventory alone is not this proof. Change bundling only if needed.
4. Run the assigned bounded release/package validation chain and record exact source/package/runtime
   identities and any blocked publish gate. Source-only tests cannot substitute for that chain.

This D1 session ran no installation, release bundling/package campaign, formal or diagnostic
measurement, PR, merge, parent update, candidate freeze or acceptance-record update. The old formal
RSS failure and all remaining cumulative review/integration/candidate/T13B/T13C obligations remain.
Return on the child with normal pushes, actual remote equality and clean status; wait for independent
review without starting D2 or accepting D1.

## D1 independent review (2026-10-07)

**Disposition: accepted for D1 only.** Reviewed implementation
`04dc187573a63bd2110c381306b26fd050d53220` against base
`8d622af2cfc435c06aac3ab0f8b16b5bbaf5e206`, approved design, D1 outcome and changed canonical
contracts. No mandatory source/lifecycle correction was found. This does not accept D2, release
isolation, cumulative integration or performance. No acceptance record is updated.

### Independently established scope and findings

Review began at clean `93b8e8c7ec207f124b4745cca6343a9590e680c2` on the assigned child.
Ancestry checks passed for base -> implementation -> starting checkpoint. The fixed diff has 18
files, matching the outcome inventory. Post-implementation changes through the starting checkpoint
are only three handoff documents; current production/test source equals the fixed implementation.
Local parent, parent tracking ref, merge base and actual remote parent are
`57fbfdaf11761cf39ce0b403a497ad5cc5fa7395`; actual remote child initially equaled the starting
checkpoint. Git used per-command safe.directory, with no persistent configuration change.

The complete fixed change was inspected, including ordinary and whitespace-insensitive execution
comparison and a whitespace-normalized comparison of the old finalization body with the moved enabled
body. Enabled lifecycle differences are the guarded unavailable span snapshot/status and backend
report return; flush, metric timeout/collection, report fallback and post-shutdown enrichment retain
the old flow. Execute-run's indentation is not an application rewrite: the substantive new boundary
finalizes an acquired session on unexpected rejection. Worker-entry forwards the requested enabled
state. Changed architecture/domain, telemetry/verification, plugin, usage, profiling and build guidance
agree with the approved source contract and explicitly retain pending release evidence.

| Concern and location (relative to `packages/gitlode`)                                     | Independent assessment                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/execution/telemetry/worker-telemetry-session.ts:77` and `noop-worker-telemetry.ts:7` | Disabled returns before loader and hooks. The no-op provider is private, never registered/delegated, with API no-op meter. Installed API 1.9.0 ProxyTracerProvider/ProxyTracer source confirms fallback uses that private provider, not global lookup. Root explicitly uses root=true/ROOT_CONTEXT; explicit valid children preserve parent context without recording. Existing-manager and absent-manager behavior is tested separately. |
| `src/execution/telemetry/enabled-worker-telemetry.ts:365`                                 | Real production enabled factory acquires processor/reader before providers, transfers cleanup only after successful constructors, distinguishes candidate/owned manager and ends an acquired root on failure. Each cleanup rejection is contained before the next resource. Disabled/Degraded never construct fallback SDK providers. Tests spy on actual owned shutdown/disable/end, not just attempt names.                             |
| `src/execution/telemetry/enabled-worker-telemetry.ts:157`                                 | Root end, flush, snapshot, collect, builder/fixed fallback and individual shutdown fault paths retain result delivery. Actual asynchronous observable rejection/non-settlement and actual root/snapshot failures are covered. Unavailable span snapshot still permits metric collection and shutdown. Supported factory backends contain lifecycle rejection.                                                                             |
| `src/execution/telemetry/worker-telemetry-session.ts:57`                                  | Promise is stored before the deferred backend call. Reentrant/concurrent/repeated calls preserve exact promise, resolved object and first result reference across all three states; root end occurs once.                                                                                                                                                                                                                                 |
| `src/execution/execute-run.ts:541`                                                        | With the supported production factory, cleanup faults do not replace the original unexpected application rejection. The independently run combined-fault probe below exercised actual SDK shutdown rejection and later meter cleanup. A deliberately rejecting arbitrary custom backend would reject the owner promise and this await, but that is not a supported production backend/fault path and is not classified as a D1 defect.    |
| `test/execution/execute-run.test.ts:412` and `:1305`                                      | Actual composition retains all nine recorder/DAG selections, including both built-in projection paths and plugin projection, with identity/timing checks. Success/user-error/runtime-error disposal stays before root end in Enabled/Disabled/Degraded. Real development worker fallback test retains enabled report transport and verifies profile=false through the same hook.                                                          |

Mandatory defects: none. Optional hardening: an outer last-resort owner rejection guard could protect
against future backend bugs, but it would need explicit report/cleanup semantics and is not required
to accept the supported D1 paths. No implementation change is requested by this review.

### Independent commands and bounded probe

Commands ran at the repository root against source equal to the fixed implementation:

- `npm run build:dev`: exit 0.
- `npx tsc -p packages/gitlode/tsconfig.json --noEmit --incremental false --composite false --noCheck false`:
  exit 0, strict product-source typing, not full test-source typing.
- The command below: exit 0, **11 files / 184 tests passed / 0 skipped**. This combines the reported
  affected suites (10 files / 172 tests) and behavioral-baseline (1 file / 12 tests); neither
  nonexistent selector was included.

```text
npx vitest run packages/gitlode/test/execution packages/gitlode/test/telemetry/worker-telemetry-boundary.test.ts packages/gitlode/test/telemetry/worker-telemetry-session.test.ts packages/gitlode/test/telemetry/local-collection.test.ts packages/gitlode/test/telemetry/profile-report-primitives.test.ts packages/gitlode/test/telemetry/behavioral-baseline.test.ts
```

One disposable combined-fault probe extended the existing acquired-session unexpected-rejection test:
real BasicTracerProvider.shutdown completed its original cleanup then rejected; the test also asserted
one trace shutdown and one later MeterProvider.shutdown, original thrown-object identity and one root
end. `npx vitest run packages/gitlode/test/execution/execute-run.test.ts -t "finalizes an acquired session" --testTimeout 5000`
passed **1 test / 26 filtered skips**, with no unhandled errors. The probe used the production factory,
not a fabricated backend. Original bytes were restored in finally; subsequent source/test diff against
`04dc187` was empty. No disposable test or implementation edit is committed.

### Existing diagnostics, reported evidence and remaining gates

Independently rerun broad checks remain failing, not waived or represented as passing:

- `npm run lint`: exit 1, only the three derive.cjs no-commonjs diagnostics at lines 2/3/4.
- `npm run architecture:check`: build passes, exit 1 only for that derive.cjs orphan; other displayed
  checks pass. The existing config warning remains (0 errors / 1 warning).
- Git blob comparison proves derive.cjs is byte-identical at base and current HEAD:
  `f6a8f88772b1a96cc0624c24f578ee4d9751819f`. These diagnostics predate this slice and remain tracked.
  D2/release planning must explicitly resolve or disposition this validation obstruction before
  claiming a successful cumulative chain. This review does not authorize its repair or exception.

The outcome's three disposable negative mutations and their exact fail/skip/unhandled-error counts
remain **reported evidence**, not independently repeated sensitivity runs. Inspection confirms the
positive tests observe the production factory and meaningful global/owned-resource sentinels; the
revised bounded reentry test passed independently. The previous targeted oxlint, Markdown-link checks
and operator correction history likewise remain attributed to the outcome, not new independent runs.
This review's combined-fault probe is positive fault-isolation evidence, not a negative mutation.

D2 is deliberately unperformed: emitted three-entry/shared/transitive SDK closure, real host/worker
ESM/CommonJS import/load and constructor guards, packed enabled positive/missing-chunk sensitivity,
aggregation dynamic asset closure and bounded release/package identities remain open. Their absence
is not a D1 defect and D1 acceptance cannot close them. The old formal RSS failure, cumulative review,
human integration approval, candidate preservation and T13B/T13C obligations remain unchanged.
No installation, release campaign, measurement, PR, merge, parent change or formal acceptance update
was performed. Trunk receives this D1-only review while the worktree remains on the child.

Review document verification: `npm run format:write`, `npm run format:check` and `git diff --check`
pass. The checkpoint changes only this handoff. Normal push and final actual remote/clean/parent
verification are returned with the checkpoint OID, avoiding a self-referential document hash.

## D2 work record (2026-10-07)

Started at `a2a487ed9a01daed6f2564f44595a5996a8cf49d` on the assigned child with clean
status. Delta from accepted D1 review `f35e0e1` is documentation only (three handoffs).
Local parent M2 is `57fbfdaf11761cf39ce0b403a497ad5cc5fa7395`.

Maintenance: verified derive.cjs blob `f6a8f88772b1a96cc0624c24f578ee4d9751819f`, searched
repository references and found no active automated consumer. Retired only that helper and replaced
the live first-target link/command with exact retrieval and outside-checkout reproduction instructions.
Derived JSON and sealed archives are unchanged. This is a separate maintenance checkpoint.

Initial setup evidence: sandbox Git rejected repository ownership; per-command safe.directory fixes
that without global configuration. Optional instruction-file probes found no tests/system/AGENTS.md,
tests/system/README.md or tests/README.md; canonical system instructions are in domain/build guides.
WSL enumeration in the sandbox failed E_ACCESSDENIED; host access must be checked before Linux work.
No release or performance result is inferred from these setup probes.

### D2 implementation checkpoint preparation

Maintenance checkpoint: `dedc536` (normal push completed). New implementation remains tooling/tests
only: emitted metadata verifier in tsdown config; strict release-boundary project/command; installed
ESM/CJS guard and actual worker-result observation; independent constructor sentinel; aggregation
inventory/graph/functional assertions and deadlines; canonical build/verification/system-boundary docs.
No dependency, public export, product session semantics or performance protocol changed. Existing
aggregation filename/byte inventory semantics and bundling are retained.

Development evidence (not the fixed release campaign): strict system and release-boundary checks,
full lint and architecture pass; focused D1 plus new suites: 13 files / 187 passed / 0 skipped.
Actual eager-owner mutation failed release graph at Forbidden eager owner; actual extra MeterProvider
construction failed the separate constructor sentinel (1 failed). Both used 60-second subprocess
deadlines, finally byte restoration and archived logs. D1 global-provider evidence remains attributed
to the accepted D1 implementation/review, not reclassified as installed load evidence.

Initial/corrected development logs are retained under
`D:/gitlode_test/m2-d2-boundary-20261007T173933/development`. Initial new build/config failures were
native TS config import resolving .js instead of .ts, pre-existing internal pkg field absent from
public tsdown config types, and dependency packages without root exports (dunder-proto). Corrected
with native .ts import, preservation of existing pkg through object spread, and manifest lookup via
Node package search paths. No checks were waived. Initial aggregation inspection assumed the TS 7
package exposed the compiler API; it does not. Inspection now uses existing tsdown/Rolldown metadata
and resolution, without adding dependencies. Initial strict/lint diagnostics were fixed. Initial
architecture after release packing found leftover generated hashed chunks; development output was
restored before the final architecture pass. An attempted cleanup found dist already absent after
the negative build and stopped before deletion. No product source remained mutated.

First installed run failed output comparison because multiple timestamped output files accumulated
in the reused directory. Corrected each owned output directory to start empty. Corrected installed
run passed both adapters and plugin attribution, actual host/worker guards, Disabled SDK absence,
Enabled SDK/report presence, denial degradation and missing lazy asset sensitivity. Package identity
was f7378758e1d016a8f789f375984be5adb81ea6b2e6e46b235c526e4ee6f77956 (development tarball;
fixed-campaign identities follow separately). Comparison now retains byte/sequence equality rather
than parsed-record equality. This checkpoint precedes cumulative validation; D2 is not self-accepted.

The first retrieval check showed Git show --output redirects diffs but not raw blob stdout (empty
output file). Corrected to Python subprocess byte capture; restored blob identity matched the
original before any use. The first documentation edit hit Windows cp932 decoding and stopped before
writing; subsequent editing explicitly uses UTF-8. No derivation/measurement was launched.

## D2 outcome for independent review (2026-10-07)

**Implementation and bounded functional/package verification complete; independent D2 review pending.**
No D2/M2 self-acceptance, formal/diagnostic measurement, PR, merge, parent update, candidate freeze,
archive-ref replacement or acceptance-record change was performed. RSS causality and performance
acceptance remain unresolved. The child remains `feature/otel-redesign_M2_disabled`.

- Starting checkpoint: `a2a487ed9a01daed6f2564f44595a5996a8cf49d`.
- Maintenance checkpoint: `dedc5363e3a56de40637481e4b83fc3bd801ee60`; the tested byte-preserving
  retrieval recipe correction is included in the implementation checkpoint.
- Fixed implementation: `6e84279819ce50e961ef99dc92ffa5a90219bc34`, tree
  `507a9cbd7e79f25668c4b4f56f01fdec0842a85a` (14 files beyond maintenance).
- Accepted D1 source remains `04dc187573a63bd2110c381306b26fd050d53220`: production source diff
  across all five production workspaces is empty. No repository dependency/lockfile change.
- Parent M2 remains `57fbfdaf11761cf39ce0b403a497ad5cc5fa7395`.
- This outcome checkpoint is documentation only: this handoff and canonical verification wording
  replacing stale pending-check status with its durable requirement. Verified code/build/package
  configuration is unchanged. The subsequent delivery binding records its
  exact OID without trying to embed a commit's own hash in itself.

### File and command ownership

| Files relative to repository root                                                                                               | Responsibility / durable execution                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/gitlode/scripts/tooling/release-telemetry-boundary.ts`, `packages/gitlode/tsdown.config.ts`                           | Build module/edge metadata, static shared-chunk and conservative declared external closure, SDK/context/collector/report ownership, private specifier rejection and lazy asset existence. Runs during every release bundle, including existing CI. Graph inventory is emitted into the build log.                                                    |
| `packages/gitlode/tsconfig.release-boundary.json`, `packages/gitlode/package.json`                                              | Explicit strict checks for config, new product tooling and affected/new tests; `typecheck:release-boundary` precedes bundling. Existing private pkg config behavior is preserved.                                                                                                                                                                    |
| `tests/system/scripts/installed-load-guard.ts`, `tests/system/scripts/test-installed-package.ts`                                | Packed/public-only real CLI/worker guard, installed dependency inventory/realpaths, result observation, positive report/asset checks, denial and missing-asset sensitivity, JSONL byte/sequence equality, package/runtime/compiler identities and owned child deadlines. Existing `typecheck:system` and `test:system:package` execute these checks. |
| `packages/gitlode/test/telemetry/sdk-construction-boundary.test.ts`                                                             | Actual SDK constructor interception through the production factory, with positive Enabled activation; independent of import/load and global-provider evidence. Runs in source tests.                                                                                                                                                                 |
| `packages/gitlode/test/telemetry/aggregation-child.test.ts`, `packages/gitlode/scripts/tooling/aggregation-collector-bundle.ts` | Reconstruct sorted filename/byte inventory, resolve emitted static/dynamic graph, require local modules to belong to inventory and invoke small Enabled/Disabled children. Builder/child deadlines added; bundling and inventory semantics unchanged. Runs in source tests.                                                                          |
| Canonical build/verification/domain docs                                                                                        | Commands, release proof, strict tooling ownership and installed-files/Node preload inspection boundary.                                                                                                                                                                                                                                              |
| First-target handoff and this handoff                                                                                           | Historical helper retrieval, first failures, source attribution, evidence and independent-review stopping boundary.                                                                                                                                                                                                                                  |

Development final commands passed: strict release-boundary typing, `npm run typecheck:system`,
`npm run lint`, `npm run architecture:check`, format write/check and diff check. Focused source command
was the accepted D1 review's 11-suite command plus `aggregation-child.test.ts` and
`sdk-construction-boundary.test.ts`: **13 files / 187 passed / 0 skipped**. Initial diagnostics and
scoped corrections remain recorded above and in the archive; no lint/orphan/typing rule was relaxed.

### Fixed Windows/Linux campaign

Each OS used a fresh detached Git clone at the same fixed implementation, verified clean before
launch, with its real TEMP outside the checkout. Windows used
`D:/gitlode_test/m2-d2-work-20261007T173933/windows/source` and sibling `temp`. Linux source and TEMP
were on native ext4 under `/home/t-wakabayashi/gitlode-performance/m2-d2-work-20261007T173933`.
The supervisors verified tool paths/versions, Git metadata and OID, used 600 seconds for `npm ci`
and 1,200 seconds for the canonical chain, and retained first-failure output with no retry.
Installed children have 180-second deadlines; negative probes used 60 seconds; supplemental report
normalization used 30 seconds. No global Node/environment installation was changed.

| OS / toolchain                                                   | Commands and actual result                                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Windows; Node 22.23.1, npm 11.11.0, Git 2.45.1.windows.1         | `npm ci` exit 0; `npm run validate:release` exit 0, 135.318 seconds. Source: **98 files / 1,314 passed / 28 skipped**. |
| Ubuntu WSL2 / ext4; private Node 22.23.1, npm 10.9.8, Git 2.53.0 | `npm ci` exit 0; `npm run validate:release` exit 0, 54.181 seconds. Source: **98 files / 1,342 passed / 0 skipped**.   |

The 28 Windows skips are existing Linux-only groups: 23 in performance-supervisor's Linux process
supervision and 5 in performance-workflow's supervised workflow integration. No D2 graph, guard,
constructor, aggregation or installed-package assertion was skipped on either OS. Linux logs include
two deliberately failing nested fixture suites (1 failed / 19 filtered skips each) exercised by the
passing diagnostic-retention source tests; they are not failed canonical campaigns or retries.
The existing Rev-dep config warning remains (0 errors / 1 warning); architecture itself passes.

The canonical chain executed dependency/format/lint/strict-system/architecture/schema/source checks,
release build with strict product tooling and all three graph roots, strict publint and the actual
installed-package command. Build output was not replaced with development output between bundling
and packing. Final isolated checkouts still have the fixed OID, clean tracked/untracked status and
no installed-package temp leftovers. Checkouts are retained for inspection; consumers were cleaned.
Command durations here are functional execution records, not performance measurements or acceptance.

### Positive and negative boundary evidence

Both OS runs contain 11 installed guard cases, each positively activating ESM and CommonJS mechanisms
in actual host isolate 0 and worker isolate 2. Guard loader support threads are not mislabeled as
application isolates. Both adapters' Disabled cases, including SDK denial, have zero forbidden
resolution/load events, no initialization warning/report, successful extraction and exact JSONL
byte/sequence equality. The boundary plugin fixture is SDK-free. A separate disabled plugin-owned
SDK fixture records the SDK importer as that plugin, leaves the session unprofiled and is excluded
from the product zero-load assertion.

Normal Enabled loads the installed lazy asset and real SDK implementations only in the worker,
returns successful extraction and a complete schema-2 report with observations. SDK denial records
three denied dependency requests per enabled invocation, produces exactly one sanitized warning,
no report and unchanged JSONL. Removing the discovered Enabled-only runtime asset in the disposable
installation still permits degraded extraction, but the normal positive report assertion rejects it;
original bytes are restored in finally. It is never counted as successful Enabled telemetry.

The installed inventory follows manifests from SDK/context roots transitively, excludes the permitted
API package and records seven implementation package owners/versions/realpaths per isolate. Registry
consumer resolution selected SDK/context/core/resources 2.12.0 and semantic-conventions 1.43.0 on
both OSes. This is an actual consumer execution input, not a repository dependency upgrade; source
`npm ci` retains the lockfile's SDK 2.10.0. The consumer compiler is **TypeScript 7.0.2** on both OSes.

A supplemental read-only product-owned probe uses the fixed checkout's official contract export to
fully normalize the captured installed reports; it adds no private product import to system tooling.
All four ordinary reports are accepted: isomorphic has 21 span groups / 21 counter points / 9
histogram points; git-cli has 21 / 12 / 8; all have empty diagnostics. Probe text, cwd, commands,
deadlines/results and logs are archived. The installed runner's durable assertion separately checks
schema version, complete signals, observations and lazy loading; canonical source tests retain full
normalizer ownership.

Development negative evidence is separately attributed: the forbidden eager-enabled import fails
the graph's owner boundary; an actual extra MeterProvider construction fails the distinct real
constructor sentinel (1 failed). Both mutations were restored byte-for-byte and their first logs
retained. The fixed canonical suites exercise the restored positive code. D1 global-provider and
owned-resource evidence remains attributed to accepted D1; absent profile output is not used as
constructor evidence. Aggregation's existing builder passes inventory, local static/lazy asset
closure and small functional Enabled/Disabled checks on both OSes; no missing asset/hoisting issue
was demonstrated, so no bundler redesign or N/4N workload was performed.

### Package and runtime identities

Tarball SHA-256 (separately identified OS/npm packing artifacts):

- Windows: `b0405d2a753be0aac367e465531aa5d49f172644270dd4fa32cb2e8924e25bc7`.
- Linux: `e4d37c208cd6e6dba3ab887efa097e9c096ec97c41611a4ff8047732a845af45`.

All six emitted installed JavaScript files have identical bytes/hashes across OSes. Compared release
files, schemas, package manifest and README bytes also match. Tarball byte equality is not asserted;
the exact packing-byte difference between OS/npm versions was not diagnosed. Temporary tarballs
and consumer trees were removed; retained identities and guard traces bind the actual installations.

| Runtime asset in this snapshot (names are evidence, not layout contracts) | SHA-256, identical on both OSes                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `index.js`                                                                | `bd02db6e5746d7a14ab559981b0ce4c5fb16f3fc12ba6728448d34de8f7f0f83` |
| `worker-entry.js`                                                         | `287b935c6e20cd56103a07c5591bf2605b5660ea3cedc1216bd83142561bff1c` |
| `plugin-api.js`                                                           | `8bba4d70cb37504b55e608f1e4230a247ab6cea62b216718ac839ceaf88ada01` |
| `execute-run-BT4z1P12.js`                                                 | `c44a3f42599c6f9d9758b43e333d79ff66e8124ad027c403bf8449f66d3f8b96` |
| `normalization-uhF4KS5d.js`                                               | `b9543a9a4e3d6193db5398350b173bfba61c2e65c78f59d68cdf9de9665c62e4` |
| `enabled-worker-telemetry-C2kERK-0.js`                                    | `7d5755b37ad2c19e8d69c00886101be21f9d47882511f27c6dd54c13feb22406` |

### Sealed archive and remaining limits

New Windows archive: `D:/gitlode_test/m2-d2-boundary-20261007T173933`.
Verified Linux copy:
`/home/t-wakabayashi/gitlode-performance/m2-d2-boundary-20261007T173933/archive`.
Both copies contain **155 evidence files / 36,313,274 bytes**, plus identical
`sealed-manifest.json`, SHA-256
`ac3d3796276e881e6e7eec0c5652628a83ab4f63b09110fd64c78a24d992a33c`.
All copied file bytes/hashes and complete inventories matched before sealing. Nothing was appended
after sealing. Earlier sealed archives, derived.json and historical refs remain untouched.

`source-identity.json`, `implementation.patch`, `handoff-at-fixed.md`, each OS's `preflight.json`,
`commands.json`, `final.json`, `validate-release.log`, `installed/package-identity.json`, guard
JSONL/command logs and normalization logs supply source/command/result mapping. `development/`
retains initial operator/build/type/lint/architecture/package failures, corrected focused evidence,
negative logs and reproduction supervisors. `runtime-comparison.json` records cross-OS file hashes.

Verification limits are explicit: external closure inspection is conservative declared-dependency
analysis; runtime guards cover controlled public extraction/plugin fixtures, not every possible
third-party plugin or unsupported concurrent session. Windows Linux-only supervision scope is
skipped there and executed on Linux. No D2 functional blocker was found; independent review remains
required. Cumulative integration, human PR approval, descendant candidate preparation and all formal
RSS/performance/T13B/T13C acceptance obligations remain outside this session and unresolved.

### D2 delivery binding

Outcome checkpoint: `6c8b3a4ea96ed2b61855777f220183ffbdababa2` (documentation only), normally
pushed after implementation `6e84279819ce50e961ef99dc92ffa5a90219bc34` and maintenance
`dedc5363e3a56de40637481e4b83fc3bd801ee60`. At that outcome, actual remote child matched exactly,
status was clean and the child remained checked out. Local parent, parent tracking ref, merge base
and actual remote parent all matched `57fbfdaf11761cf39ce0b403a497ad5cc5fa7395`. Read-only
post-seal verification rehashed all 155 files without mismatch and confirmed the manifest hash.
No sealed archive was appended to.

Outcome documentation verification passed root format write/check, diff check and UTF-8/local
Markdown target verification (28 relative links across the five affected documents). This binding
is a final handoff-only delivery commit; its actual remote/clean/unchanged-parent check and OID are
returned to trunk with the final message, avoiding a self-referential hash. **Stop for independent
D2 review.** No formal measurement, PR, merge, parent update, freeze or acceptance update follows.

## Independent D2 review (2026-10-07)

**Disposition: accepted for D2 only; mandatory corrections: none.** Reviewed fixed implementation
`6e84279819ce50e961ef99dc92ffa5a90219bc34` against
`a2a487ed9a01daed6f2564f44595a5996a8cf49d`, the approved design, accepted D1 review, complete D2
change/outcome and canonical architecture/domain, telemetry/verification and build/release contracts.
D1 remains accepted. This functional boundary review does not resolve RSS causality or performance
acceptance, accept M2 integration, freeze a candidate or update an acceptance record.

### Identity and review scope

Started clean at `21556b2baaf5d77313e0073cf39920b84664cc1e` on
`feature/otel-redesign_M2_disabled`. Base -> fixed implementation -> start ancestry passes.
Base-to-fixed inventory is 15 files including maintenance; maintenance-to-fixed is 14 files.
Current implementation/config/tests equal the fixed implementation: subsequent changes are only
four Markdown files. Production source across the five production workspaces equals accepted D1;
dependencies, lockfile, public exports and lint/architecture configuration are unchanged.
The sealed `implementation.patch` and source-identity inventory describe **maintenance-to-fixed**,
not base-to-fixed: byte comparison against that exact Git diff passes (48,177 bytes). The retired
helper is the additional base-to-fixed deletion, not an omitted implementation change.

Initial actual remote child equaled the starting checkpoint. Local parent, tracking parent,
merge base and actual remote parent all equal `57fbfdaf11761cf39ce0b403a497ad5cc5fa7395`.
Git used per-command safe.directory only. Initial sandbox remote access failed; authorized network
execution read the actual remote successfully. No persistent Git/global environment change was made.

### Independent assessment

| Concern / repository location                                                                                  | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/gitlode/scripts/tooling/release-telemetry-boundary.ts:55`, `packages/gitlode/tsdown.config.ts:81`    | Rolldown emitted imports, dynamicImports and moduleIds are inspected during generateBundle. Each of index, worker-entry and plugin-api recursively follows static shared chunks; lazy edges do not become eager edges. All emitted local lazy targets are checked for existence. Source ownership covers the current enabled/collector/report implementation files, including retained module ownership after tree shaking. External manifests are followed transitively by resolved package directory with cycle protection; API is permitted, SDK/context/core/resources/semantic-conventions and private workspace specifiers are rejected. No blanket third-party dependency exception is present. Actual emitted graph has the enabled implementation solely behind a lazy edge; independently rebuilt eager closures pass with 3/2/1 chunks. Those counts/names are snapshot evidence, not assertions. |
| `tests/system/scripts/installed-load-guard.ts:6`, `:128`, `tests/system/scripts/test-installed-package.ts:320` | Inherited preload registers ESM hooks and CJS load/resolve interception in the real CLI and request worker. Each positively exercises all three probe events; worker-result success additionally proves real extraction ran. Inventory follows actual SDK/context manifests, including sdk-trace-base's sdk-trace owner and transitive core/resources/semantic-conventions, recording names, versions and realpaths. Denial checks both requests and resolved identities. The Node Worker observer attaches before product request dispatch; loader support threads are not counted as application isolates. Both saved campaigns and independent run show host 0/worker 2 activation.                                                                                                                                                                                                                       |
| `tests/system/scripts/test-installed-package.ts:375`                                                           | Controlled plugin-owned SDK import is positively attributed to its plugin importer and leaves the session without a report; finally restores the SDK-free fixture before product zero-load cases. Both adapters independently pass Disabled with and without denial, zero SDK events, no initialization warning/report and exact output byte/sequence equality. Enabled actually loads SDK only in worker 2 and produces complete schema-2 observations. Denial records three denied requests, exactly one sanitized warning, no report and unchanged output.                                                                                                                                                                                                                                                                                                                                                |
| `tests/system/scripts/test-installed-package.ts:446`                                                           | Enabled-only installed JS asset is discovered from positive versus disabled loads, removed only in the disposable installation and restored in finally. Missing asset permits degraded application success, but the ordinary assertEnabledReport rejects it. This is sensitivity of the positive telemetry assertion, not acceptance of degraded output as telemetry success. Child commands own 180-second deadlines and process-tree cleanup; consumers are outside the checkout and removed in finally.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `packages/gitlode/test/telemetry/sdk-construction-boundary.test.ts:46`                                         | Real SDK exports are wrapped at their constructors and invoked through the production session factory. Disabled/import-degraded counts remain zero; Enabled positively constructs trace/meter/context once each. This independent constructor check does not infer construction from import traces or absent output. Saved extra-MeterProvider mutation fails the zero-count assertion; independently executed restored test passes. Accepted D1 resource/global-sentinel evidence remains separately attributed.                                                                                                                                                                                                                                                                                                                                                                                            |
| `packages/gitlode/test/telemetry/aggregation-child.test.ts:17`                                                 | Existing builder's sorted filename-plus-byte inventory is reconstructed exactly. Bundler resolution traverses static/dynamic local assets and requires each resolved local module to belong to inventory; a dynamic edge is positively required. Small scale-4 Enabled/Disabled invocations pass with bounded build/child deadlines. Inventory/bundling semantics are preserved; no N/4N or measurement is needed or performed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `packages/gitlode/tsconfig.release-boundary.json`, `tests/system/tsconfig.json`, package commands              | Explicit strict projects include new product tooling/config/tests and all system scripts respectively. Root validate:release and release bundle commands durably reach the checks. Existing installed CLI/help/version, adapters, line diff, plugin, schema and strict public TypeScript consumer assertions remain. System scripts import local helpers/Node only; installed asset inspection and Node preload observation fit the documented public package boundary. Supplemental saved full report normalization belongs to product tooling, not a system private-source exception.                                                                                                                                                                                                                                                                                                                      |
| `packages/gitlode/docs/handoff/opentelemetry-m2-first-target-measurement.md:389`                               | Historical helper retrieval from D1 review commit returns blob `f6a8f88772b1a96cc0624c24f578ee4d9751819f` (independently reconstructed/hashed exact Git bytes). Recipe preserves bytes through Python and restores outside checkout before read-only use against saved archives. derived.json remains unchanged; no active automated consumer was found. Retirement introduces no ignore/allowlist/lint/orphan-rule change. The derivation was not executed and sealed archives were not modified.                                                                                                                                                                                                                                                                                                                                                                                                           |

No concrete D2 regression or mandatory remedy was found. Optional future hardening: associate
activation explicitly with the observed Worker's threadId if the CLI later creates additional
application workers; current single-request worker wiring and captured traces establish the actual
worker today. Declared-dependency closure is conservative rather than a parser of every external
package's conditional execution. Controlled plugin coverage is intentionally finite, as approved.

### Independently executed finite verification

Windows, Node 22.23.1 / npm 11.11.0, current source equal to the fixed implementation:

- `npm run build:dev`: exit 0.
- `npm run typecheck:release-boundary -w gitlode`: exit 0, explicit strict tooling/config/new-test typing.
- `npm run typecheck:system`: exit 0.
- `npx vitest run packages/gitlode/test/telemetry/sdk-construction-boundary.test.ts packages/gitlode/test/telemetry/aggregation-child.test.ts`:
  exit 0, **2 files / 3 passed / 0 skipped**.
- `npm run build:release`: exit 0, strict boundary typing and all three emitted graph roots executed.
- `npm run test:system:package`: exit 0, one installed campaign, all 11 guard cases plus existing
  package assertions. No development rebuild occurred between release bundle and packing.

Logs and independent guard JSONL/identities are retained separately under
`%TEMP%/gitlode-d2-independent-21556b2` (outside checkout); installed commands retain their owned
180-second deadlines and first-failure facility. No independent command failed, no dependency was
changed, and no extra mutation or package retry was performed. Installed tarball SHA-256 is
`b0405d2a753be0aac367e465531aa5d49f172644270dd4fa32cb2e8924e25bc7`; all six installed runtime
hashes and compiler Version 7.0.2 match saved Windows package-identity.json exactly. Independent
consumer SDK closure again resolves 2.12.0 (semantic-conventions 1.43.0), separately from repository
lockfile SDK 2.10.0. Installed consumer cleanup completed. This is not a repeated full release chain.

### Saved evidence inspected, not independently rerun

Read-only rehash of the Windows archive verifies **155 files / 36,313,274 bytes**, zero size/hash
mismatches, and manifest SHA-256
`ac3d3796276e881e6e7eec0c5652628a83ab4f63b09110fd64c78a24d992a33c`.
Inspected source identity/patch, both OS preflight/commands/final records, full validate-release logs,
installed identities and all 22 guard traces, normalization evidence, development first failures
and negative supervisor/logs. The Linux evidence inspected is the sealed Windows archive's Linux
campaign copy; no independent Linux execution or rehash of the separate ext4 archive is claimed.

Saved Windows full chain: 98 files / 1,314 passed / 28 existing Linux-only skips.
Saved Linux/ext4 full chain: 98 files / 1,342 passed / 0 skipped. Both execute strict checks, graph,
constructor, aggregation, publint and installed assertions with exit 0. Linux's two nested intentional
fixture failures belong to passing diagnostic-retention tests, not failed/retried campaigns.
Preflight/final bind clean detached fixed OID, external TEMP, toolchain/executable hashes and cleanup;
command order places packing after release bundling. Saved forbidden-eager mutation fails at actual
collector ownership; saved extra MeterProvider construction fails the separate sentinel. Neither
negative mutation was independently replayed. Development operator failures remain retained and
separate from the fixed successful campaigns.

Saved Linux tarball hash is `e4d37c208cd6e6dba3ab887efa097e9c096ec97c41611a4ff8047732a845af45`;
all six runtime JS hashes agree across OSes and with this independent build. Removed tarballs and
consumer trees cannot now be rehashed or reconstructed as the original complete dependency closure.
Recorded hashes/installed traces and command logs establish the tested D2 package/runtime inputs;
they do not provide a retained frozen consumer. No concrete missing evidence blocks this functional
D2 review. A later formal freeze must retain and independently verify its actual package, runtime
and dependency closure; this review does not transfer historical runtime identity into that freeze.

### Return boundary

Only this review document is changed. Root format write/check and Git diff-check are required before
the documentation-only commit. Normal push and actual remote/clean/unchanged-parent verification
follow; final commit OID is returned outside this document to avoid a self-referential hash.
Remain on the child and return to trunk for assignment. No implementation repair, PR, merge, parent
update, formal/diagnostic measurement, freeze or acceptance-record edit was performed. Cumulative
integration and all descendant RSS/performance/T13B/T13C obligations remain separate and unresolved.
