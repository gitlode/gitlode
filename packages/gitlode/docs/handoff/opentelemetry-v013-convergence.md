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

Legacy `tests/performance` verification is now explicit opt-in through `npm run test:performance`
and `npm run typecheck:performance`. Root Vitest, CI and `validate:release` retain product tests and
installed-package checks, while no longer requiring the legacy infrastructure project. Its source,
assertions and historical evidence remain intact. Product regressions using shared performance
helpers remain included; this is a policy change, not evidence that retired checks passed.

The supported publish command currently requires the old migration validator and a blocked schema-1
record. **Human-approved transition:** keep publication blocked during convergence;
after explicit acceptance of the actual candidate, retire the temporary migration-only validator,
its dedicated tests/record and command wiring in a reviewed change. Preserve ordinary release checks
and human publication authority. No replacement migration validator will be built.

## Next bounded steps

1. Normal validation routing is updated. Keep the publish block until human candidate acceptance.
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
minor step. The bounded comparison below is complete. Human candidate acceptance is pending; the
publish block remains in place. No asset deletion or historical performance campaign was performed.

## Historical references

[Suspension and saved results](opentelemetry-m2-disabled-matrix.md),
[profile integration](opentelemetry-m2-profile-integration.md),
[disabled SDK integration](opentelemetry-m2-disabled-sdk-integration.md), and
[test-layout CI correction](opentelemetry-m2-test-layout-ci-correction.md) supply facts, not renewed
assignments. Old F's RSS fail and the limited first-target valid pass remain unchanged.

## Routing verification

Windows, 2026-10-22: Vitest file discovery before/after matches by complete file path: 105 before,
88 product files unchanged, 17 optional infrastructure files unchanged, no overlap. Explicit optional
workspace execution passed atomic-json 12/12; normal root project execution passed profile formatter
34/34. These were short unit checks, not calibration or native launcher campaigns. No Linux execution,
full suite or installed-package campaign was repeated for this routing-only change. Those remain
candidate/CI checks, not claimed results here. Product source, thresholds, publish wiring, blocked
record and dependency versions/lockfile are unchanged. Existing format/lint coverage is retained.

## Actual-candidate comparison — 2026-10-22

Human selected gitlode itself. Candidate and input ref:
`d6dc7e03a99e29a47d0f35b33df489f0eaf87759` (294 commits).
The candidate's [push CI](https://github.com/gitlode/gitlode/actions/runs/39711315183)
succeeded, including source tests, release build, packed metadata and installed-package checks;
all job steps succeeded. This is evidence for that SHA, not subsequent documentation commits.

Windows, Node 22.23.1, npm 11.11.0; commit-level snapshot, isomorphic-git, no plugin. Released
`gitlode@0.12.0` was installed separately with `--ignore-scripts --no-audit --no-fund --save-exact`;
its resolved dependencies are recorded in `.cache/convergence/legacy/package-lock.json`.
Candidate `npm run build:release` succeeded. Neither frozen F2 nor legacy archives were modified.
This compares complete application versions with their resolved dependencies, not an isolated causal
estimate of telemetry alone.

Each invocation used `node <cli> --config <config> --ref <fixed-ref> --output-dir <unique-dir>
--output-prefix result --repo-name gitlode --repo-url https://github.com/gitlode/gitlode
[--profile] <repository-path>`. Config was
`{"version":1,"runtime":{"gitAdapter":"isomorphic-git"}}`. No quiet flag; stdout/stderr were
redirected to files, with `NO_COLOR=1`. Time includes process startup, extraction, output and profile
rendering through process exit. Three rotating rounds, 30-second per-run deadline, no retries,
no warm-up exclusion or cache flushing. All nine invocations exited 0.

| Variant                | Times in execution order (seconds) | Median   | Difference from v0.12.0 median |
| ---------------------- | ---------------------------------- | -------- | ------------------------------ |
| v0.12.0, profile off   | 2.219680 / 2.089058 / 2.105123     | 2.105123 | —                              |
| Candidate, profile off | 2.237040 / 2.211111 / 2.199195     | 2.211111 | +0.105988 s / +5.03%           |
| Candidate, profile on  | 2.515496 / 2.407484 / 2.357300     | 2.407484 | +0.302361 s / +14.36%          |

Order: legacy/off/on, off/on/legacy, on/legacy/off. Enabled versus disabled median:
+0.196373 seconds / +8.88%. These are observations, not threshold-based pass/fail findings.

All outputs were directly byte-compared and equal: 294 valid JSON records, 240,988 bytes each,
SHA-256 `c1dcf8da83fea482905aa1a93c058fef1434b1c5e74bbd2092b40c46c08b86bc`.
Profile sections appeared only in the three enabled logs. The common warning explains that a fixed
commit OID does not advance for future incremental extraction; it appeared once in every run.
This was plain redirected-output inspection, not a new terminal-theme acceptance campaign.

Local raw results, commands, timing operator, config and logs:
`.cache/convergence/three-way-d6dc7e0-20261022` and `.cache/convergence/compare.mjs`.
These are local working evidence, not independently backed-up artifacts. The complete timing values
and output identity are retained here. Dependency lock hashes:

- Baseline: `15b6a071484e9b786363363c751d7f97f17cfdf89348b0657cb6c536e165cd82`
- Candidate: `feede822c7789bbf770963dc511f699dfb01c573bead0a40561bb9f4d1274ea8`

Recommendation: accept this limited ordinary-use comparison under the convergence policy, subject
to human judgment. The absolute increase is about 0.106 seconds disabled and 0.302 seconds enabled.
It does not establish large-repository, per-file, plugin, git-cli, cold-cache, cross-platform or memory
behavior. Existing product/package CI supplements, but does not expand, the empirical scope.
Historical F RSS failure and F2 first-target result retain their original meanings.
After human acceptance, retire the migration-only gate; do not launch extra calibration to seek a
more favorable percentage. PR approval/merge and release remain human-controlled.
