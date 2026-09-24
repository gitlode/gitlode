# P2 independent data-integrity and failure-isolation review

Current assignment: [post-diagnosis R4 focused review](#post-diagnosis-r4-focused-review).
The correction returned at 755e7d3. R4/P2 remain unaccepted; R1-R3 and transport remain accepted.
Earlier packets/outcomes are historical context.

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

## Correction round 1 focused re-review

### Fixed state and scope

Continue on `feature/otel-redesign_M2_profile` in a new human-started independent review conversation.

- Correction entry: `9e6ed7d28f0c5854d7ed6b62cd790f346ad6e4bf`.
- Main correction: `bb5740e683e2463636ac4481b562308156703102`.
- Follow-up implementation/tests: `3c0e11480897e6a14cf3d9e0028ec17152f812ea`.
- **Full fixed target: `5bc2cf3c0910a5dc591ae53db05ca846f610cd05`.**

Trunk inspected the 14-file correction inventory. The follow-up changes builder source as well as
iterator tests; it must be included. Its delta to the final target is outcome documentation only.
Verify ancestry, actual remote equality, clean worktree and entry/exit OIDs. Later routing-only commits
do not change the target; identify any unexpected source delta before continuing.

Read the [correction assignment and outcome](opentelemetry-m2-profile-implementation.md#p2-correction-round-1),
original findings, accepted design sections 5/10 and the changed canonical guidance. Review correction
paths and affected invariants, not a fresh redesign or a repeat of all previously resolved P1 questions.
P2 is still unaccepted and P3 unassigned. No implementation repair, PR, merge, freeze or measurement.

### Required questions

1. **R1, qualified by trunk:** preserve mixed-validity retained total/max with incomplete-duration
   explanation, unavailable average on coverage mismatch, all-invalid unavailability and genuine zero.
   Follow real producer through builder, bridge and tooling, including both input orders and full
   diagnostic budget/summary. Do not revive the rejected blanket total/max mask requirement. Available
   retained numbers must not imply whole-run completeness or allow healthy formal acceptance.
2. **R2:** independently verify throwing-first/middle point isolation, iterator acquisition/advance/
   result-state failure, retention of already safe values and later safely obtainable siblings.
   No retry of a failed iterator; exact one rejected value differs from unknown remaining loss.
   Check follow-up source/test changes and normal-builder recovery rather than catastrophic fallback.
3. **R3:** Counter/Histogram invalid values, attributes, getter failure and overflow preserve the
   narrowest independently validated target. Confirm point identity is not built from unsafe values;
   observation broadening retains known Scope/name, extent and quantity remain truthful, and existing
   limits/admission are unchanged. Check restoration of any test-mutated limits.
4. **R4:** independently audit the new complete report validator, not only the known malformed Counter
   fixture. Check required fields, kind-specific masks, finite numbers, statuses, detail and summary
   variants, bounds, target/effect associations, fallback provenance and canonical-equality handling.
   Validation must be total/fail-closed for malformed inputs and must not repair them into acceptance;
   valid producer reports must not be rejected merely because the validator shares a mistaken fixture.
   Check normalization/detachment and equality against actual valid producer output, partial reports,
   compacted diagnostics and fallback. Review all extraction/evaluator call sites and unchanged release
   obligations; no threshold relaxation or historical artifact relabeling.
5. **Transport proof:** the actual built worker entry must hit real builder-body failure and carry
   the ordinary schema-2 fallback result to the client. Verify receiver-side application content and
   classification (not reference equality across threads), mandatory delivery evidence, finite timeout,
   progress routing and worker cleanup. Inspect the internal construction seam: no public request/CLI
   failure switch, accidental normal-path injection or alternate message protocol.

### Finite independent evidence and return

Run build:dev, this packet's original 16 suites plus presenter.test.ts and
`packages/gitlode/test/execution/worker-profile-fallback-transport.test.ts` (reported: 271 pass / 3
Linux-only skips), and the exact strict changed-tooling command in the correction outcome. Record
actual counts and skips; no full OS/package/formal-performance campaign. Existing supervision-only
Linux skips remain outside these new paths unless a concrete dependency changes that assessment.

Inspect the earlier independent counterexample evidence. The correction session did not rerun durable
regressions on the old implementation, so do not describe its evidence as a new fail-before run.
Use bounded independent probes or a temporary old-tree regression only when needed to resolve an
actual uncertainty; restore/delete probes before return. Do not demand an expensive rerun solely
for identical counts. Test execution and standalone typechecking remain distinct evidence.

Run fixed-diff whitespace checks and format write/check for documentation. Return per-item decisions,
P2 overall accepted/corrections-required, concrete remaining failure paths, independent versus reported
checks and residual P3 responsibilities. If any correction remains, batch the findings and return to
trunk instead of fixing them here. Trunk applies the bounded correction/diagnosis policy if needed.
Append the outcome here, commit documentation only, normally push to this child and verify actual
remote OID/clean status. No force push or parent updates. P2 acceptance alone does not authorize P3.

### Correction round 1 focused re-review outcome

Corrections are still required for P2 at fixed correction target
`5bc2cf3c0910a5dc591ae53db05ca846f610cd05`. R1, R2, R3 and the actual worker-thread transport
proof are accepted in this focused re-review. R4 remains incomplete, so this review does not accept
P2 and does not authorize P3, a PR, merge, formal measurement, package/release validation or an
acceptance-record change.

#### Reviewed state

- Review entry/checkpoint was clean at `d63b84229b0f13ef25bcdbd74239bda34392d654`; local HEAD and
  the actual `origin/feature/otel-redesign_M2_profile` ref agreed. Correction entry
  `9e6ed7d28f0c5854d7ed6b62cd790f346ad6e4bf`, main correction
  `bb5740e683e2463636ac4481b562308156703102`, builder/test follow-up
  `3c0e11480897e6a14cf3d9e0028ec17152f812ea` and fixed target `5bc2cf3...` are all in the assigned
  ancestry.
- The correction entry-to-target inventory is the expected 14 files. The target-to-entry delta is
  limited to the four routing/handoff documents identified by trunk; there is no unexpected source
  or test change after the fixed target.
- The follow-up builder source change was reviewed, not treated as test-only: reading `next.done` is
  now inside the iterator advance boundary, so a throwing result-state getter records unknown
  remaining loss without retrying the iterator.

#### Per-item decisions

1. **R1 accepted under trunk's qualification.** Both valid/invalid input orders pass through the real
   Span processor and builder with `callCount=2`, `durationContributionCount=1`, retained total/max,
   unavailable average and partial status. All-invalid duration slots remain unavailable despite zero
   accumulator defaults, while a genuine zero contribution remains available. Under a full 15-detail
   budget, the reserved summary retains `incomplete_measurement_fields`; presentation keeps the
   partial/incompleteness notice and formal tooling fails the report rather than accepting it as
   healthy. No blanket total/max mask is required or requested.
2. **R2 accepted.** Each obtained value has its own normalization boundary. Throwing first and middle
   values retain later array siblings and record exact one-result loss. Iterator acquisition,
   `next()`/`done` failure retains already obtained values, stops without retry and records unknown
   remaining loss; a throwing value getter remains a one-value rejection and iteration can continue.
   These paths remain in the normal partial builder result rather than invoking catastrophic fallback.
3. **R3 accepted.** Invalid Counter/Histogram values and value getter failures use an exact point
   target only after Scope, instrument and attributes are independently normalized. Invalid attribute
   input broadens to the known observation without erasing Scope/name. Point overflow carries the
   rejected point, entire-target extent and exact disjoint quantity one. Catalog admission and the
   production point limit are unchanged; the test-only limit mutation is restored in `finally`.
4. **R4 corrections required.** The shared validator is total for throwing inputs, validates and
   detaches required scalar/container fields, masks, finite numbers, collection bounds, detailed and
   summary variants, and requires exact canonical equality. Valid normal, partial, compacted and fixed
   fallback producer reports are accepted, so the correction does not merely share a malformed
   fixture. All formal extraction/evaluation call sites use it before measurement or acceptance, and
   thresholds and historical artifact schemas are unchanged. However, the validator does not enforce
   cross-field report or diagnostic invariants; the mandatory finding below remains.
5. **Transport proof accepted.** The test starts the actual built `dist/execution/worker-entry.js`,
   triggers an invoked builder-body failure through worker construction data, and receives the normal
   schema-2 fixed fallback result through `dispatchWorkerRunRequest`. It verifies success
   classification, receiver-side application/checkpoint content equivalence, mandatory fixed-delivery
   provenance, progress routing and a finite timeout; the client settles by terminating the worker.
   The seam is absent from `WorkerRunRequest`, CLI/config and public package surfaces and does not add
   an alternate result protocol or normal-path injection.

#### Mandatory finding

**P2-R4-C1: the complete-report validator accepts internally contradictory reports and diagnostics.**
`normalizeProfileReport()` normalizes each measurement and diagnostic and then checks plain canonical
equality, but it does not validate the relationships between signal status, retained arrays and
diagnostic evidence, nor the associations among diagnostic target, coverage, affected fields,
effects and delivery provenance (`packages/internal-contracts/src/telemetry/normalization.ts:608-846`).
The canonical report catalog requires an unavailable signal to have an empty array and every partial
or unavailable status to have explanatory evidence
(`packages/gitlode/docs/design/telemetry-catalog/profile-report.yaml:283-287`); fixed builder failure
also requires report-delivery provenance.

An independently executed, non-mutating probe against the built fixed target returned `true` from
`normalizeProfileReport()` for all of these malformed cases:

- an `unavailable` Counter signal with a retained Counter point;
- an empty `unavailable` Counter signal with no explanatory diagnostic;
- a `report_delivery_failure` diagnostic whose `reportDelivery` is `null`; and
- one diagnostic whose point target is Histogram, coverage is Counter and affected fields are Span.

The evaluator happens to classify the first two examples as inconclusive because their status is not
complete, and any detailed diagnostic makes the latter examples fail, so the known malformed reports
do not become a healthy formal pass today. Nevertheless, the shared function advertised as the
complete active-schema validator returns them as valid, and `extractProfileReportMeasurements()` can
therefore extract from contradictory reports outside the evaluator. This violates R4's total,
fail-closed validation contract and leaves future consumers dependent on incidental evaluator policy.

Bounded fix: add report-level status/array/explanation validation and diagnostic association checks,
including fixed-delivery effect/provenance consistency, to the shared validator. Add adversarial
contract and formal-consumer cases for the four counterexamples while retaining acceptance tests for
actual normal, partial, compacted-summary and fixed-fallback producer output. Do not weaken evaluator
thresholds or relabel historical artifacts.

#### Independent, reported and skipped evidence

- Independently run: `npm run build:dev` passed.
- Independently run: the original 16 suites plus `presenter.test.ts` and
  `worker-profile-fallback-transport.test.ts` passed 271 tests with 3 skipped (18 files, 274 total).
  The skips are the existing Windows skips for the Linux-only supervised-workflow entrypoint setup
  and `stall=false`/`stall=true` later-child cases. They are unrelated to the corrected producer,
  validator and worker transport paths, so no bounded Linux request is added.
- Independently run: the exact correction-outcome strict TypeScript command over `js-yaml.d.ts`,
  `performance-harness.ts` and `telemetry-catalog.ts` passed. This is tooling-source typechecking;
  Vitest is not claimed to typecheck test sources.
- Independently run: fixed correction diff whitespace check
  `git diff --check 9e6ed7d..5bc2cf3` passed. The four R4 counterexamples above were inline runtime
  probes and created no files.
- Reported only, not rerun in this focused review: the correction session's focused 45-test builder
  run, lint, architecture check and implementation-time format checks. No full OS/package/release
  campaign or formal performance measurement was run.

#### Finite return

Correct only P2-R4-C1 and return a new fixed target for focused independent re-review. Preserve the
accepted R1 mixed-duration behavior, R2/R3 corrections, worker transport proof, P1 bounds and fallback
lifecycle, thresholds, blocked release record and historical evidence identities. Do not begin P3.

## R4 round 2 focused re-review

### Fixed scope

Review independently on `feature/otel-redesign_M2_profile` in a new human-started conversation.

- Round-2 entry: `0595eeae51edfd3e4ce7bb1daad89f861761e240`.
- Implementation: `477fde1e7407ed9c63835541a32cde4bb8a987ae`.
- Full fixed target: `280824cab82b85ca87a63eeb73b3e248df8df230`.

Trunk checked the eight-file inventory and confirmed that implementation-to-final delta is only
handoff outcome documentation. Verify clean entry/exit status, ancestry and actual remote equality;
post-target routing-only commits do not change the target. Investigate unexpected source changes.

Read [the invariant matrix and round-2 outcome](opentelemetry-m2-profile-implementation.md#p2-r4-correction-round-2),
the prior R4-C1 finding, accepted design and active report catalog. Limit review to R4 relationship
validation, affected consumer boundaries and regressions. R1-R3 and transport stay accepted unless a
concrete new dependency invalidates their evidence. No production fixes, P3, PR, merge or measurement.

### Questions and acceptance evidence

- Check the matrix against pre-existing accepted contracts, not merely newly added canonical wording.
  Distinguish collection status, retained-value availability, whole-result evidence, target extent and
  report-delivery failure. Confirm kind/effect-specific explanations for partial/unavailable, empty
  array semantics, and fixed fallback's special provenance.
- Independently verify all six negative families: retained data with unavailable status; unexplained
  unavailable; unexplained partial; delivery effect without provenance; reverse delivery association;
  target/coverage/affected-field kind contradictions. Check both detailed and summary representations,
  not just the exact previous fixtures. Normalization must reject rather than repair contradictory data.
- Audit reverse implications introduced by the relationship pass as carefully as missing checks:
  whole-result flags versus retained values/partial recovery, data-impact effects versus complete
  status, and narrowed targets versus multi-kind coverage. Verify the rules do not turn evidence about
  a target into a stronger unsupported claim about an entire signal. Use the existing builder's
  recoverable status/value path as a positive boundary. Do not make a new semantic rule solely to
  satisfy the validator; return a concrete contract conflict if one exists.
- Preserve valid broad/Scope/multi-kind diagnostics, detail loss, per-kind summary unions, report-only
  lifecycle notices, overflow exceptions and unknown prior-detail provenance. No demand for detailed
  evidence that legitimate compaction intentionally discards. Test real producer normal, partial,
  compacted and fixed-fallback reports, including mixed-duration retained total/max, empty cases and
  shutdown details. Available retained values do not establish whole-run completeness.
- Inspect changed fixtures: the primitive/performance fixture adjustments must correct invalid inputs,
  not remove a legitimate producer state or hide a regression. Keep tests' expected relationships
  independent from the validator's rule constants.
- Confirm formal extraction/evaluation invokes validation first and rejects contradictory reports;
  do not claim these six contradictions previously caused a healthy evaluator pass. The prior issue
  was shared-validator/extraction validity, while current evaluator policy already made them non-pass.
  Thresholds, blocked acceptance and historical artifact identities must remain unchanged.

Run `npm run build:dev`, then the six focused suites:

- `packages/internal-contracts/test/telemetry/profile-report-active.test.ts`
- `packages/gitlode/test/telemetry/local-collection.test.ts`
- `packages/gitlode/test/telemetry/profile-report-primitives.test.ts`
- `packages/gitlode/test/telemetry/worker-telemetry-session.test.ts`
- `packages/gitlode/test/telemetry/performance-harness.test.ts`
- `packages/gitlode/test/telemetry/repository-sidecar.test.ts`

Also run `packages/gitlode/test/telemetry/catalog-contract.test.ts` and the exact strict tooling command
in the round-2 outcome. Reported results are 140 plus 11 passes, not independent evidence until run.
Inspect fail-before evidence (six probes and grouped test failures); repeat only a bounded probe needed
for an unresolved concern. Do not repeat accepted transport/full OS/package/formal measurement checks
without a concrete changed dependency. Record test execution separately from TypeScript checks.
Run fixed-diff whitespace checks and format write/check for review documentation.

### Return

Append R4 accepted/corrections-required and P2 overall decision, concrete remaining failures, tested
positive boundaries, independent versus reported evidence and residual P3 work. Review only: do not
repair source/tests during this conversation. If the same R4 issue remains after this second correction
round, recommend a fresh bounded diagnosis session, not an automatic third local correction. Do not
accept merely to end the loop; tie each remaining mandatory finding to an existing contract and impact.
Save a documentation-only checkpoint, normally push to this child and verify actual remote equality
and clean status. No force push or parent updates. Human returns outcome; trunk assigns the next step.

### R4 round 2 focused re-review outcome

Corrections are still required for R4 at fixed target
`280824cab82b85ca87a63eeb73b3e248df8df230`; consequently P2 remains unaccepted. This review does
not authorize an automatic third correction round, P3, a PR, merge, formal measurement, package or
release validation, or an acceptance-record change.

#### Reviewed state

- Review entry/instruction checkpoint `16727d8e8b6a13a4e1ec444a3f2c622b3e7851c4` was clean; local
  HEAD and the actual `origin/feature/otel-redesign_M2_profile` ref agreed. Round-2 entry
  `0595eeae51edfd3e4ce7bb1daad89f861761e240`, implementation
  `477fde1e7407ed9c63835541a32cde4bb8a987ae` and the fixed target are ancestors/in the assigned
  history. The fixed eight-file inventory matches the packet, and the target-to-entry delta contains
  only the four expected routing/handoff documents.
- Review remained limited to R4 relationships and the formal consumer boundary. No concrete new
  dependency invalidated accepted R1-R3 or worker transport evidence.

#### Mandatory finding

**P2-R4-C2: the relationship validator rejects legitimate partial recovery when a diagnostic proves
an entire target was lost.** `validateProfileReportRelationships()` treats any per-kind
`wholeResultUnavailable` evidence as proof that the whole signal must be unavailable and empty
(`normalization.ts:880-904`). That reverse implication is stronger than the accepted contract:
`wholeResultUnavailable` qualifies the diagnostic's target, while `signalStatus` summarizes the
kind. The accepted design explicitly distinguishes a wholly unavailable identified target from
retained sibling points, requires retained evidence to be preserved, and says retained values cannot
make a signal wholly unavailable (`opentelemetry-m2-profile-design.md:214-216,274-285`). The existing
producer implements that boundary: `deriveProfileSignalStatus()` makes a kind unavailable from
whole-result evidence only when its retained value count is zero; otherwise data-impact evidence
leaves the retained result partial (`profile-report-primitives.ts:83-133`).

Two independently executed temporary probes used the real `BoundedDiagnosticAccumulator` and
`ProfileReportBuilder`. A lost Counter point with `extent: entire_target` and
`wholeResultUnavailable: true`, plus a valid retained sibling point, produced a partial Counter
signal with one retained value. `normalizeProfileReport()` rejected that producer report. Repeating
the case after filling all 15 detailed slots caused the lost-point evidence to enter the reserved
summary; the builder again produced partial with the sibling retained and the validator again
rejected it. Both probes failed only at the expected normalize-equals-producer assertion and were
deleted afterward.

The committed positive test hides this valid boundary by changing broad Scope evidence to
`wholeResultUnavailable: true` and expecting the otherwise-partial report to be rejected
(`profile-report-active.test.ts:376-385`). This does not establish the stronger rule independently of
the validator. The new canonical wording requires confirmed whole-result evidence to explain an
_unavailable signal_; it does not state the converse that every whole-target loss makes the entire
kind unavailable. The impact is producer/consumer incompatibility: formal extraction and evaluation
classify a valid partial report as invalid/inconclusive and discard safely retained measurements.

Bound the correction to removing the reverse signal-wide implication. Keep the forward rules:
unavailable still requires empty values plus confirmed whole-result evidence for the kind (or the
fixed no-measurement delivery exception), while whole-target evidence may coexist with partial status
and retained sibling values in both detailed and compacted form. Add producer-to-validator and
formal-consumer regressions for both representations. Reconcile the round-2 matrix/test wording with
the established target versus signal distinction; do not weaken the six contradiction checks.

#### Confirmed rejection and acceptance boundaries

- The six assigned negative families fail closed: unavailable with retained data; unexplained
  unavailable; unexplained partial; delivery effect without provenance; provenance without the
  delivery effect; and target/coverage/affected-field kind contradictions. Detailed checks and the
  reserved-summary kind/effect association checks are present. Normalization rejects rather than
  repairs them.
- Formal extraction invokes `normalizeProfileReport()` before reading measurements, and repository
  evaluation maps validation failure to inconclusive. The committed consumer regressions confirm
  that these contradictions do not become healthy passes. Thresholds, blocked acceptance and
  historical artifact identities did not change.
- Actual normal, mixed-duration partial, compacted and fixed-fallback producer cases in the focused
  suites remain accepted. Complete-empty, justified partial-empty, broad/Scope and multi-kind
  coverage, detail loss, report-only lifecycle notices, shutdown details and the no-measurement fixed
  fallback also remain accepted. The exception is the legitimate whole-target/partial-sibling
  boundary above, in both detailed and summary forms.
- The performance fixture changes supply missing evidence for previously contradictory synthetic
  partial states and make the fixed-fallback fixture internally consistent; they do not remove a
  legitimate producer state. The active-contract test expectation identified above does encode the
  unsupported reverse implication and must be corrected with the validator.

#### Independent evidence

- `npm run build:dev`: passed.
- The exact six focused suites passed 140/140 tests with no skips.
- `packages/gitlode/test/telemetry/catalog-contract.test.ts` passed 11/11 tests with no skips.
- The exact strict tooling command from the round-2 outcome passed. This is a separate TypeScript
  check; the Vitest counts are not claimed as test-source typechecking.
- `git diff --check 0595eea..280824c` passed. The two bounded review probes failed as described above,
  which is counterexample evidence rather than a suite regression; both temporary files were removed
  and absence/clean status was verified before this documentation change.
- Reported-only fail-before evidence (six inline probes and 3/8 grouped failures), lint, and the
  implementer's format results were inspected but not relabeled as independent execution. Accepted
  transport/full OS/package/release checks and formal measurement were not repeated.

#### Finite return

Because a relationship-validator issue remains after R4 correction round 2, return to trunk for the
assigned fresh bounded diagnosis session rather than starting an automatic third local correction.
Diagnose the target-versus-signal implication, preserve all six valid contradiction rejections and
the fixed-delivery exception, and return a new fixed target only if trunk assigns a correction. Do not
start P3 while P2 remains unaccepted.

## Post-diagnosis R4 focused review

### Fixed target and authority

Review in a new human-started independent conversation on `feature/otel-redesign_M2_profile`.

- Entry/base: `4fd2ac81bc70f5324247bdce9d4b1ff196f6f5f2`.
- Accepted diagnosis: `cd65c002ceed7e18d10e308c31cef807a430811f`.
- Implementation: `d2c4a7d2460d6089874c7a7367c324570a9b43e5`.
- Full fixed target: `755e7d34f3d0ea56c7346ce009ec7d7624bab32c`.

Trunk inspected the eight-file inventory and normalization delta; the final delta after d2c4a7d is
outcome documentation only. Verify ancestry, clean status, entry/exit OID and actual remote equality.
Subsequent routing-only commits do not move the target. Investigate unexpected implementation changes.
Trunk has not rerun the reported tests or accepted R4. R1 under trunk's duration qualification, R2,
R3 and actual worker transport remain accepted absent a concrete affected dependency.

Read the [diagnosis and correction outcome](opentelemetry-m2-profile-implementation.md#post-diagnosis-r4-correction-outcome),
its preceding assignment, the prior R4-C2 finding and accepted target/extent/status contracts. Review
only the diagnosis-driven correction and its affected invariants; do not restart the full P2 audit.
No source/test fixes, P3, PR, merge, freeze, formal measurement or release/acceptance update.

### Finite review questions

1. Confirm the unconditional whole-target -> whole-signal reverse implication is removed. Detailed
   point/observation/Scope loss and summary existential OR may coexist with partial retained siblings.
   Normalization and extraction must preserve those legal outputs. Summary compaction cannot recreate
   exact discarded target information or strengthen coverage.
2. Confirm the remaining reverse condition uses exact detailed report/entire-target, covered kind,
   whole-result flag and allowed effect. A broadened report/unidentified-subset and reserved summary
   cannot trigger it. Check independent boundary cases, not an expectation copied from the predicate.
   Verify exact report-wide loss plus retained values is a contradictory synthetic input, while the
   existing normal-builder recovery path remains valid and unchanged.
3. Preserve the forward unavailable/empty/evidence rule, complete-with-impact rejection, explained
   partial, delivery exception and all six original contradiction families. Verify zero/nonzero
   retained values, detailed/summary no-sibling unavailable, complete-empty, justified partial-empty,
   fixed fallback and broadened target positives.
4. Follow real accumulator/builder detailed and 15+1 compacted sibling reports through validator and
   extraction. Both must be valid/extractable and formal evaluation must be non-healthy `fail`, not
   `pass` or invalid-schema `inconclusive`. Do not confuse report validity with performance acceptance.
5. Verify field comments and canonical changes clarify existing target semantics without changing
   schema/public shape, producer behavior, thresholds or historical evidence. Check fixture changes
   against the accepted diagnosis, especially removal of the old broad-Scope false rejection.

Run build:dev and the exact seven-suite command in the latest correction outcome (reported 157 pass,
no skips), plus its explicit strict tooling command. Record actual counts, and distinguish test
execution from typechecking. Inspect fail-before evidence: two formal-consumer regressions and literal
contract failure are semantic evidence; the corrected missing test import is not. Repeat bounded probes
only for concrete uncertainties; no full OS/package/transport campaign or formal performance run.
Run fixed-diff whitespace checks and format write/check for documentation. Remove/restore any temporary
probe before returning; do not commit probe or implementation modifications during review.

### Return and preservation

Append R4 accepted/corrections-required, P2 overall decision, concrete residual failures (if any),
independent versus reported evidence and residual P3 responsibility. If another issue remains, return
the bounded evidence to trunk rather than starting repairs or silently weakening acceptance.
Record a documentation-only checkpoint, normally push to this child and verify actual remote equality
and clean status. Remain on this child: trunk is a planning-session role, not a Git ref. No force push
or parent ref update. Review acceptance does not automatically authorize P3 or a PR.
