# OpenTelemetry v0.13.0 convergence

## Objective and authority

Resume product development by concluding telemetry acceptance at proportionate cost. The
[2026-10-22 acceptance policy](../design/telemetry-v013-acceptance.md) is current. Older assignments,
calibration/matrix plans and Windows launcher completion instructions are historical, not executable
continuations. Do not resume the suspended matrix or build the sibling benchmark project.

## Current state and Git

- Trunk work branch: `feature/otel-redesign_v013_convergence`.
- Starting snapshot: `6aac640aed8ebffaf45de939c6911710fcce7739`, the verified local/remote
  `feature/otel-redesign_M2_disabled-matrix` tip on 2026-10-22. Worktree was clean.
- Intended first PR base: `feature/otel-redesign_M2_fixture` (`d458300` at inspection).
  The starting snapshot already includes that branch. Carry forward relevant changes without merging
  the old intermediate measurement branches individually.
- Intended remaining integration chain: convergence → fixture → M2 → integration/v0.13.0.
  Exact source/base and contents require human approval before each PR; humans merge. No shared base
  receives direct pushes. Reconfirm integration strategy before PR creation; no PR is authorized now.
- M2 is `4f09265`; integration is `7e0055a` at remote inspection. Preserve these refs.
- Since suspension record `74b0541`, only AGENTS/Skill additions occurred. Preserve those human changes.
- Compared with F2 `4ea24d5`, inspected `packages/*/src` has no difference. Later verification,
  workspace, scripts and documentation changes remain; this is not a blanket final-package equivalence
  claim. Use the current candidate, not a mandated historical runtime, for new acceptance.

## Scope and disposition

Keep product functionality, SDK-free disabled behavior, schema-v2 reports, presentation and existing
product regressions. Keep installed-package validation. No product rollback is currently justified.
Leave old verification code, branches and local evidence in place initially; do not turn cleanup into
a prerequisite or silently delete assets. Do not export them to a new benchmark project.

`tests/performance` is currently included in root Vitest, CI typechecking and `validate:release`.
Separate legacy benchmark-infrastructure verification from the normal product path in a bounded
follow-up, retaining an explicit optional command if the code remains. Inspect classification before
excluding anything that directly verifies product behavior. Do not describe retired checks as passed.

The supported publish command currently requires the old migration validator and a blocked schema-1
record. **Proposed transition, pending human choice:** keep publication blocked during convergence;
after explicit acceptance of the actual candidate, retire the temporary migration-only validator,
its dedicated tests/record and command wiring in a reviewed change. Preserve ordinary release checks
and human publication authority. Do not build a replacement evidence-validation framework. An
alternative is a small candidate-bound human-acceptance record, if the human wants a lasting
machine-enforced migration gate.

## Next bounded steps

1. Confirm the publish-gate transition choice. Update normal validation routing and durable guidance
   consistently, without changing product semantics or fixing historical benchmark infrastructure.
2. Select one available real repository and equivalent extraction settings. Propose a small fixed run
   count, elapsed-time boundary and straightforward JSONL comparison before executing. Do not require
   calibration, prescribed 10–30-second workloads or a multi-OS campaign. Record time as observations,
   not an invented pass/fail threshold. Avoid frequent agent polling through a long workload.
3. Build/check the actual candidate once using applicable ordinary tests and installed-package checks;
   reuse matching evidence rather than mechanically repeating all campaigns. Any unexpected failure
   receives a bounded assessment of product risk versus further cost.
4. Present three-way times, output equivalence scope, functional/profile checks and remaining limits
   for human acceptance. Then apply the chosen gate transition and prepare the human-reviewed PR.

Use this Trunk for the short policy/routing decisions. Delegate a coherent implementation or review
only when it reduces context or provides useful independent scrutiny; do not create a session per
minor step. No measurement, baseline installation, release validation campaign or asset deletion has
been started in this convergence step.

## Historical references

[Suspension and saved results](opentelemetry-m2-disabled-matrix.md),
[profile integration](opentelemetry-m2-profile-integration.md),
[disabled SDK integration](opentelemetry-m2-disabled-sdk-integration.md), and
[test-layout CI correction](opentelemetry-m2-test-layout-ci-correction.md) supply facts, not renewed
assignments. Old F's RSS fail and the limited first-target valid pass remain unchanged.
