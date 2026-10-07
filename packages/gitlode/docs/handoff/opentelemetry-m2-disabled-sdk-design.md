# M2 disabled SDK boundary: detailed design assignment

## Trunk disposition and active implementation packet (2026-10-07)

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
