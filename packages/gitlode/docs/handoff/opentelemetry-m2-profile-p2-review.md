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
