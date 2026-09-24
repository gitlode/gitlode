# P2 independent data-integrity and failure-isolation review

## Fixed scope and authority

Review in a new human-started conversation on `feature/otel-redesign_M2_profile`.

- Base: `8af0b6af5f4630699dc0b95c00a5d6f478acaba8`.
- Accepted P1: `dc6cfbd69e99cbf13ba6ef4191a123ef182627b5`.
- Full fixed P2 target: `57ba7537068b00002b2618b2f4a364f9468365c7`.
- Last implementation checkpoint: `85c48e0ddc82211a899bb11e4aec70bba04eb96d`.

Trunk inspected the 32-file base-to-target inventory and confirmed that 85c48e0..57ba753 contains
only the implementation handoff outcome. Review all three implementation checkpoints, not only the
last consumer commit. Verify ancestry, clean status, entry/exit HEAD and actual remote OID. Later
routing-only commits do not move the fixed target; stop to identify unexpected source changes.

Read AGENTS.md, [accepted design](opentelemetry-m2-profile-design.md), its integrated examples,
[P2 assignment/outcome](opentelemetry-m2-profile-implementation.md#p2-runtime-and-consumer-migration),
[P1 acceptance](opentelemetry-m2-profile-p1-review.md#correction-round-1-re-review-outcome), and canonical
telemetry, verification, architecture, report/performance catalogs and profiling interpretation.
Implementation claims are evidence to check, not additional authority to weaken the accepted design.

No production/test correction, P3 implementation, PR, merge, freeze, formal performance run or publish
is assigned. The old layout in the presentation bridge is intentional; review its truthfulness, not
P3 aesthetics. Do not reopen accepted P1 without a concrete integration regression.

## Review obligations

1. **Atomic migration.** Trace actual contract exports and all consumers in the P2 inventory,
   including unchanged files. Search for active v1 assumptions, staging-only exports, fixture/version
   drift and unsafe casts. Verify real worker/application serialization and return paths carry schema
   2 without another protocol, and that unrelated output/artifact schema versions remain unchanged.
2. **Producer semantics.** Map existing detection sites to target, effects, kind coverage, extent,
   key selector, masks, whole-result evidence and loss quantity. Inspect overflow, invalid point,
   attribute/reducer conflict, collection timeout and unexpected traversal failures. Confirm that
   unknown coverage or an interrupted traversal does not become a falsely exact missing-result count,
   guessed target or claim of whole loss. Do not add new detection obligations beyond the design.
3. **Normal builder isolation.** Invalid values retain valid siblings; a throwing normalizer or
   iterator must not silently discard safely processable data. Verify contradictory unavailable
   status/retained values becomes explained partial inside normal validation, including full diagnostic
   capacity, without catastrophic fallback. Masks and duration contributions preserve true zeros,
   missing fields, valid totals and average availability independently of compacted issue details.
4. **Diagnostic integrity.** Follow detail identity, summary/recompaction, per-kind effects, coverage,
   severity, quantities and saturation through real producers and the normal report, not only pure
   helpers. Retention limits must not change signal meaning. Distinguish empty diagnostics from unknown
   earlier detail and ensure the serialized 15+1/budget contract still holds.
5. **Lifecycle and fixed fallback.** Test actual invoked builder-body failure after partial work,
   broken normal diagnostic snapshot, simultaneous shutdown failure and unsafe thrown payloads.
   No partial measurement salvage or normal-builder retry. Trace every fallback factory call: check
   the accepted once-only construction/sealing contract and whether post-cleanup handling reconstructs
   the report or loses previously trusted diagnostics. Distinguish harmless immutable sealing from a
   concrete lost-evidence/identity/count violation; cite the design if a deviation requires correction.
   Mandatory delivery-failure evidence must survive bounds; snapshot failure must not invent collection
   loss. Cached repeated/concurrent finalize, cleanup order/ownership and application identity remain.
6. **Visibility and consumers.** Follow fallback and masked normal data through actual worker result,
   presenter and tooling. No unavailable number rendered/countable as observed zero; no healthy-empty
   acceptance for fallback. Preserve success-only, quiet, failed-run suppression and disabled/degraded
   no-profile/no-op behavior. Distinguish report delivery from collection failure. Review reserved
   summary handling in sidecar/aggregation evaluators and release evidence; no threshold relaxation or
   historical artifact relabeling. Live acceptance stays blocked.
7. **Evidence and documentation.** Compare canonical activation claims with implementation and tests.
   The reported affected/full counts and skips need exact command/case attribution. Direct helper
   tests or injected entry hooks do not prove actual builder-body/worker transport paths. Identify
   concrete missing P2 proof separately from deferred P3 layout/package validation.

## Finite independent checks

Build with `npm run build:dev`, then run these affected suites with `npx vitest run` (use actual paths
below, batching is allowed). Record actual counts and individually identify platform skips:

- `packages/internal-contracts/test/telemetry/profile-contract.test.ts`
- `packages/internal-contracts/test/telemetry/normalization.test.ts`
- `packages/internal-contracts/test/telemetry/profile-report-active.test.ts`
- `packages/gitlode/test/telemetry/local-collection.test.ts`
- `packages/gitlode/test/telemetry/profile-report-primitives.test.ts`
- `packages/gitlode/test/telemetry/worker-telemetry-session.test.ts`
- `packages/gitlode/test/execution/execute-run.test.ts`
- `packages/gitlode/test/execution/worker-client.test.ts`
- `packages/gitlode/test/presentation/reporting/formatters.test.ts`
- `packages/gitlode/test/presentation/success-report.test.ts`
- `packages/gitlode/test/telemetry/catalog-contract.test.ts`
- `packages/gitlode/test/telemetry/repository-sidecar.test.ts`
- `packages/gitlode/test/telemetry/aggregation-child.test.ts`
- `packages/gitlode/test/telemetry/performance-harness.test.ts`
- `packages/gitlode/test/telemetry/performance-workflow.test.ts`
- `packages/gitlode/test/telemetry/release-acceptance.test.ts`

This explicit selection need not reproduce the implementer's 17-file count. Resolve which additional
suite they ran before attributing that reported count to independently executed evidence. Inspect the
changed-tooling strict check; reproduce with the exact declaration/support paths if feasible and
record command scope. Do not claim Vitest typechecks test sources. Existing unrelated standalone
calibration typing failures do not authorize broad typing cleanup or silent noCheck substitution.

Use targeted additional probes only for concrete uncovered failure paths. Restore any temporary
probe/mutation before returning and verify content. Do not rerun full package/release/OS campaigns or
formal measurement. Windows Linux-only skips are not passes; determine whether any skipped case is
newly necessary to establish this slice and return a bounded Linux verification request if so.
Check the fixed diff with `git diff --check`; run format write/check for review documentation.

## Return and preservation

Batch mandatory findings with a concrete counterexample, contract reference, impact and bounded fix.
Separate optional improvements, evidence gaps and deferred P3 responsibility. Return accepted or
corrections required for P2, exact target, independently run versus reported-only checks, skip scope,
remaining consumer/runtime risks and a finite next-step recommendation. Do not repair findings here.

Append the review outcome to this packet. Save a documentation-only checkpoint on this child, normally
push and verify actual remote equality. No force push or parent ref update. Human returns the outcome;
trunk decides corrections or P3 assignment. P2 acceptance is not profile/M2 completion or PR approval.

## Outcome

Corrections are required for P2 at the fixed target
`57ba7537068b00002b2618b2f4a364f9468365c7`. This review does not accept P2 and does not authorize
P3, a PR, merge, formal measurement, package/release validation or an acceptance-record change.

### Reviewed state

- Review entry/checkpoint: `03516ac4c99d3617f0a91016480a078dcd2829e7`; local HEAD and the actual
  `origin/feature/otel-redesign_M2_profile` ref agreed and the worktree was clean.
- The fixed target and all three implementation checkpoints (`8f0f8cc8b4135817544131173d9c3fe167b51c13`,
  `ca62c355edd4d8c8ee4d9cdc533a9cf967f01a10` and
  `85c48e0ddc82211a899bb11e4aec70bba04eb96d`) are in the assigned history after base
  `8af0b6af5f4630699dc0b95c00a5d6f478acaba8`; accepted P1 target
  `dc6cfbd69e99cbf13ba6ef4191a123ef182627b5` is an ancestor.
- The base-to-target inventory is the expected 32 files. The target-to-entry delta contains only the
  four routing/handoff documents named by trunk; no source or test change moved the fixed target.
- Schema 2 is the only active `ProfileReport` export. The removed staging files and names have no
  active source consumer. Unrelated application JSONL, performance artifact and release-acceptance
  schema versions remain unchanged.

### Mandatory findings

1. **P2-R1: mixed valid/invalid Span durations expose incomplete totals and maxima as observed
   numbers.** `LocalSpanProcessor.onEnd()` records the invalid contribution and increments neither
   the duration sum nor contribution count, but `snapshot()` always emits `unavailableFields: []`
   (`local-span-processor.ts:163-202,349-360`). With one valid two-second contribution followed by
   one invalid contribution for the same aggregate, the independently executed probe produced
   `callCount=2`, `durationContributionCount=1`, an empty mask, and numeric availability
   `{total:true, avg:false, max:true}`. The accepted design requires detected duration omission to
   make total, average and maximum unavailable/incomplete independently of diagnostic retention; a
   retained accumulator value is not an exact total or maximum of all calls. The current presenter
   and tooling therefore can display/count incomplete values as observed measurements. Populate the
   fixed Span field mask at the producer for every affected duration field, preserve it through the
   normal builder, and add a mixed-validity real-producer-to-presentation/tooling regression (also
   retain the genuine-zero case).
2. **P2-R2: a throwing normalizer discards later safe siblings and reports a falsely exact loss
   quantity.** `ProfileReportBuilder.#buildSignal()` wraps the whole `for ... of` in one `try/catch`
   (`profile-report-builder.ts:145-164`). A throwing getter in the first Counter point exits the loop;
   a following valid point is never normalized, yet `#addValidationIssue()` records exactly one
   disjoint `observation_results` loss. The probe returned no counters and `partial` for input
   `[throwing, valid]`. This violates the normal-builder isolation contract that a throwing
   normalizer must not discard safely processable siblings and also converts unknown additional loss
   into an exact count. Isolate each normalization call so later array siblings continue; handle a
   throwing iterator separately with unknown/unidentified remaining loss, and cover both paths.
3. **P2-R3: metric diagnostics discard safely known target identity.** Both `invalid()` and
   `overflow()` in `local-metric-reader.ts:175-216` always emit a report target. After catalog
   admission and canonical attribute validation, the converter already knows Scope, instrument,
   kind and point attributes (`local-metric-reader.ts:229-292`). An independently executed invalid
   NaN Counter probe confirmed that the emitted target was `{type:"report"}` although the exact
   empty-attribute point identity was safe. Point-retention overflow has the same loss. The accepted
   detection-site mapping requires the narrowest safely evidenced observation/point target and must
   not turn known loss into broad unknown coverage. Pass the known identity into point validation and
   overflow diagnostics, falling back only as individual components fail validation, and add target,
   extent and quantity assertions for invalid values, invalid attributes and retention overflow.
4. **P2-R4: the formal repository consumer can mark a malformed schema-2 report healthy.**
   `extractProfileReportMeasurements()` checks only version, top-level arrays, call counts and that
   each `unavailableFields` value is an array (`performance-harness.ts:292-333`); it neither validates
   allowed mask members nor the required point/report fields. `evaluateRepositoryProfileReport()`
   then treats that partial check as schema validity (`performance-harness.ts:963-1025`). The probe
   supplied a Counter containing only `unavailableFields: ["not-a-counter-field"]`, complete statuses
   and empty diagnostics; evaluation returned `pass`. This can support a false `schemaValid` release
   subcheck and healthy-empty interpretation. Validate the complete active bounded contract (or use a
   shared total validator) before evaluating completeness, volume or diagnostics; malformed masks,
   missing fields and malformed reserved summaries must be inconclusive/fail-closed. Add adversarial
   evaluator tests without weakening thresholds or changing historical artifact schemas.

### Confirmed behavior and evidence gap

- Normal builder validation retains ordinary valid siblings for non-throwing invalid values. A
  separate independent probe confirmed that contradictory unavailable status plus a retained value
  remains on the normal path with a full 15+1 diagnostic budget: the value survived, status became
  partial and the reserved summary remained within 16 entries.
- Diagnostic identity, per-kind effects, whole-result evidence, count/quantity saturation and
  fallback recompaction tests passed. Source inspection found no new diagnostic-capacity-dependent
  numeric validity path beyond P2-R1.
- Real repository sidecars traverse the worker entry and returned normal schema-2 reports for both
  adapters and plugin fixtures. The fixed fallback is covered through an actual invoked builder-body
  failure, unsafe thrown payload, broken diagnostic snapshot, simultaneous shutdown failures,
  repeated/concurrent finalization, application return attachment and `structuredClone`.
- There is still no actual `worker_threads` transport test carrying the fixed fallback: the
  worker-client success fixture has no profile, while fallback assertions call execution/session code
  directly. This is a concrete missing P2 proof, distinct from the four implementation findings.
  Add one bounded worker-entry/client serialization regression that induces the real builder-body
  fallback and observes schema 2, mandatory delivery provenance and application-result identity on
  the receiving side.
- Disabled and initialization-degraded sessions remain report-absent; normal success-only and quiet
  presentation behavior is preserved. The intentionally old presentation bridge honors signal
  unavailability, field masks supplied to it, genuine zero, fallback delivery and reserved summary
  wording. Generic namespace layout and final styling remain P3 work.

### Independent, reported and skipped checks

- Independently run: `npm run build:dev` passed.
- Independently run: the packet's exact 16-file `npx vitest run` selection passed 254 tests with
  3 skipped (257 total). The additional presentation consumer suite
  `packages/gitlode/test/presentation/presenter.test.ts` passed 7/7, reconciling the implementer's
  17-file count to 261 passed and 3 skipped.
- The three skips are the Linux-only supervised-workflow cases in
  `performance-workflow.test.ts`: entrypoint setup failure and the two `stall=false/true` later-child
  cases. They are platform skips, not passes. They exercise existing process-group supervision, not
  a new P2 schema/producer/consumer path, so this review does not request a separate bounded Linux run.
- Independently run: the exact changed-tooling strict command over `js-yaml.d.ts`,
  `performance-harness.ts` and `telemetry-catalog.ts` passed. This is the tooling typecheck evidence;
  Vitest is not test-source typechecking and the documented tooling-project `noCheck` boundary remains.
- Independently run temporary probes: four counterexamples passed, and the full-budget normal-builder
  probe passed. All probe files were deleted and absence was verified before documentation changes.
- Independently run: `git diff --check 8af0b6af..57ba753` passed.
- Reported only, not rerun here: the implementer's checkpoint-specific 3-file/63-test and
  4-file/85-test runs, `npm test -w gitlode` (702 passed, 17 skipped), lint and architecture checks.
  No full package/release/OS campaign or formal performance measurement was run.

### Finite return

Correct P2-R1 through P2-R4 and add the one real fallback worker-transport regression, then return a
new fixed correction target for focused independent re-review. Preserve the accepted P1 primitives,
the current 15+1 bounds, thresholds, blocked release record and historical evidence identities. Do
not begin P3 while these P2 data-integrity, isolation and consumer-validation corrections remain open.
