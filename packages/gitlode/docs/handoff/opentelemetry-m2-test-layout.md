# M2 verification layout (2026-10-19)

HQ authorizes relocation and bounded validation only. Base: `942c317d2cad1c850bc75207d7e7333ebbcb07f6`. Work branch: `feature/otel-redesign_M2_test-layout`. Parent, F2 archives, thresholds, acceptance and product runtime remain unchanged. No measurement, qualification, native audit, PR or merge is authorized.

The shared checkout was clean and the Windows process inventory showed no matching performance/Vitest/Windows-launcher workload before edits. This is a Windows observation, not a universal process-absence guarantee. No process was stopped and no evidence deleted. Previous audit continuation is explicitly on hold.

## Inventory and decisions

See [tests layout](../../../../tests/README.md). Node-only common helpers move to tests/support to avoid importing product test suites from tooling. Product behavioral baseline/collector/worker regressions remain in the package and only update helper imports. The release validator, obligation inventory, build provenance and release-boundary checker remain package tooling, not measurement infrastructure. Existing tests/system remains a public-package-only workspace.

- `packages/gitlode/test/support/performance-harness.ts` → `tests/performance/support/performance-harness.ts`
- `packages/gitlode/test/support/performance-fixtures.ts` → `tests/performance/support/performance-fixtures.ts`
- `packages/gitlode/test/support/performance-equivalence.ts` → `tests/performance/support/performance-equivalence.ts`
- `packages/gitlode/test/support/performance-workflow.ts` → `tests/performance/support/performance-workflow.ts`
- `packages/gitlode/test/support/fixture-lifecycle.ts` → `tests/performance/support/fixture-lifecycle.ts`
- `packages/gitlode/test/support/deterministic-repository.ts` → `tests/support/deterministic-repository.ts`
- `packages/gitlode/test/support/fixture-git.ts` → `tests/support/fixture-git.ts`
- `packages/gitlode/test/support/test-fixture-owner.ts` → `tests/support/test-fixture-owner.ts`
- `packages/gitlode/test/support/profile-equivalence.ts` → `tests/support/profile-equivalence.ts`
- `packages/gitlode/test/support/windows-launcher/budgets.md` → `tests/performance/support/windows-launcher/budgets.md`
- `packages/gitlode/test/support/windows-launcher/case.ts` → `tests/performance/support/windows-launcher/case.ts`
- `packages/gitlode/test/support/windows-launcher/correction-round1-receipt.json` → `tests/performance/support/windows-launcher/correction-round1-receipt.json`
- `packages/gitlode/test/support/windows-launcher/correction-round2-receipt.json` → `tests/performance/support/windows-launcher/correction-round2-receipt.json`
- `packages/gitlode/test/support/windows-launcher/deadlines.ts` → `tests/performance/support/windows-launcher/deadlines.ts`
- `packages/gitlode/test/support/windows-launcher/driver.mjs` → `tests/performance/support/windows-launcher/driver.mjs`
- `packages/gitlode/test/support/windows-launcher/failure-vectors.ps1` → `tests/performance/support/windows-launcher/failure-vectors.ps1`
- `packages/gitlode/test/support/windows-launcher/framing-vectors.ps1` → `tests/performance/support/windows-launcher/framing-vectors.ps1`
- `packages/gitlode/test/support/windows-launcher/host.ps1` → `tests/performance/support/windows-launcher/host.ps1`
- `packages/gitlode/test/support/windows-launcher/io.d.mts` → `tests/performance/support/windows-launcher/io.d.mts`
- `packages/gitlode/test/support/windows-launcher/io.mjs` → `tests/performance/support/windows-launcher/io.mjs`
- `packages/gitlode/test/support/windows-launcher/Job.cs` → `tests/performance/support/windows-launcher/Job.cs`
- `packages/gitlode/test/support/windows-launcher/launcher.ts` → `tests/performance/support/windows-launcher/launcher.ts`
- `packages/gitlode/test/support/windows-launcher/outcome-receipt.json` → `tests/performance/support/windows-launcher/outcome-receipt.json`
- `packages/gitlode/test/support/windows-launcher/protocol.ts` → `tests/performance/support/windows-launcher/protocol.ts`
- `packages/gitlode/test/support/windows-launcher/runner.mjs` → `tests/performance/support/windows-launcher/runner.mjs`
- `packages/gitlode/test/support/windows-launcher/scenario.mjs` → `tests/performance/support/windows-launcher/scenario.mjs`
- `packages/gitlode/test/support/windows-launcher/Transport.cs` → `tests/performance/support/windows-launcher/Transport.cs`
- `packages/gitlode/test/support/windows-launcher/validation-receipt.json` → `tests/performance/support/windows-launcher/validation-receipt.json`
- `packages/gitlode/test/support/windows-launcher/workload.mjs` → `tests/performance/support/windows-launcher/workload.mjs`
- `packages/gitlode/test/support/windows-launcher-stage-a/source-receipts.json` → `tests/performance/support/windows-launcher-stage-a/source-receipts.json`
- `packages/gitlode/scripts/telemetry-performance-supervised.ts` → `tests/performance/scripts/telemetry-performance-supervised.ts`
- `packages/gitlode/scripts/telemetry-performance.ts` → `tests/performance/scripts/telemetry-performance.ts`
- `packages/gitlode/scripts/telemetry-aggregation.ts` → `tests/performance/scripts/telemetry-aggregation.ts`
- `packages/gitlode/scripts/telemetry-aggregation-child.ts` → `tests/performance/scripts/telemetry-aggregation-child.ts`
- `packages/gitlode/scripts/telemetry-repository-sidecar.mjs` → `tests/performance/scripts/telemetry-repository-sidecar.mjs`
- `packages/gitlode/scripts/tooling/aggregation-collector-bundle.ts` → `tests/performance/scripts/tooling/aggregation-collector-bundle.ts`
- `packages/gitlode/scripts/tooling/atomic-json.ts` → `tests/performance/scripts/tooling/atomic-json.ts`
- `packages/gitlode/scripts/tooling/calibration-pilot-projection.ts` → `tests/performance/scripts/tooling/calibration-pilot-projection.ts`
- `packages/gitlode/scripts/tooling/calibration-workflow.ts` → `tests/performance/scripts/tooling/calibration-workflow.ts`
- `packages/gitlode/scripts/tooling/fixture-requalification.ts` → `tests/performance/scripts/tooling/fixture-requalification.ts`
- `packages/gitlode/scripts/tooling/fixture-root-cleanup.ts` → `tests/performance/scripts/tooling/fixture-root-cleanup.ts`
- `packages/gitlode/scripts/tooling/performance-process-group.ts` → `tests/performance/scripts/tooling/performance-process-group.ts`
- `packages/gitlode/scripts/tooling/performance-progress.ts` → `tests/performance/scripts/tooling/performance-progress.ts`
- `packages/gitlode/scripts/tooling/performance-supervisor.ts` → `tests/performance/scripts/tooling/performance-supervisor.ts`
- `packages/gitlode/scripts/tooling/production-calibration-artifacts.ts` → `tests/performance/scripts/tooling/production-calibration-artifacts.ts`
- `packages/gitlode/test/telemetry/aggregation-child.test.ts` → `tests/performance/test/aggregation-child.test.ts`
- `packages/gitlode/test/telemetry/atomic-json.test.ts` → `tests/performance/test/atomic-json.test.ts`
- `packages/gitlode/test/telemetry/calibration-pilot-projection.test.ts` → `tests/performance/test/calibration-pilot-projection.test.ts`
- `packages/gitlode/test/telemetry/calibration-workflow.test.ts` → `tests/performance/test/calibration-workflow.test.ts`
- `packages/gitlode/test/telemetry/fixture-lifecycle.test.ts` → `tests/performance/test/fixture-lifecycle.test.ts`
- `packages/gitlode/test/telemetry/fixture-timeout-ownership.test.ts` → `tests/performance/test/fixture-timeout-ownership.test.ts`
- `packages/gitlode/test/telemetry/performance-harness.test.ts` → `tests/performance/test/performance-harness.test.ts`
- `packages/gitlode/test/telemetry/performance-process-group.test.ts` → `tests/performance/test/performance-process-group.test.ts`
- `packages/gitlode/test/telemetry/performance-supervisor.test.ts` → `tests/performance/test/performance-supervisor.test.ts`
- `packages/gitlode/test/telemetry/performance-workflow.test.ts` → `tests/performance/test/performance-workflow.test.ts`
- `packages/gitlode/test/telemetry/production-calibration-artifacts.test.ts` → `tests/performance/test/production-calibration-artifacts.test.ts`
- `packages/gitlode/test/telemetry/repository-sidecar.test.ts` → `tests/performance/test/repository-sidecar.test.ts`
- `packages/gitlode/test/telemetry/windows-launcher.test.ts` → `tests/performance/test/windows-launcher.test.ts`
- `packages/gitlode/test/telemetry/windows-launcher-protocol.test.ts` → `tests/performance/test/windows-launcher-protocol.test.ts`
- `packages/gitlode/test/telemetry/windows-launcher-io.test.ts` → `tests/performance/test/windows-launcher-io.test.ts`
- `packages/gitlode/test/telemetry/windows-launcher-case-failure.test.ts` → `tests/performance/test/windows-launcher-case-failure.test.ts`
- `packages/gitlode/test/telemetry/windows-launcher-driver-failure.test.ts` → `tests/performance/test/windows-launcher-driver-failure.test.ts`
- `packages/gitlode/test/fixtures/performance/manifest.json` → `tests/performance/fixtures/manifest.json`

Launcher and lifecycle checked configs also move to tests/performance. Historical receipts retain exact bytes. Existing handoff paths remain historical, with this mapping as current routing.

## Validation

Pending completion; no acceptance inferred from relocation.

## Next measurement decision (proposal only)

Prefer preserved F2 4ea24d53afc57778addf3f47752e0fe73a7011ea and legacy 76b124e23fcc069be1278629cf01b62ae1456c7a with separately preserved pre-ownership Linux harness b00258475004a8d7edb1c00bfa5f3f4d69039a5b. Old paths remain correct inside that isolated revision. Requires HQ permission to use an unintegrated fixed harness, closure preservation/restoration, scoped input review and fixture eligibility; no F2 rebuild or dependency update.

Alternative: freeze the relocated harness after reviewing relocation and current optional-ownership differences from b002584. Source/package/path-dependent evidence needs renewed bounded verification; old acceptance is supporting evidence, not a new identity. No harness is frozen by this change.

Windows handle audit and optional-owner descendant cleanup remain unresolved. Mocked/static checks after relocation do not establish runtime containment. Independent backup/risk acceptance remains an HQ decision; no external upload is authorized.
