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
The human approved retirement of obsolete verification code, local originals and old archive/work
branches. Keep only shared support required by product regressions, with its purpose and removal
condition documented. Do not migrate old assets into a successor benchmark project.

## Current state and next step

On 2026-10-22, the human explicitly accepted the comparison below and authorized removal of the
migration-only publish gate. The validator, dedicated tsconfig/tests, blocked record and script
wiring are removed. No replacement validator is introduced. Ordinary `validate:release`, release
workflow, package checks and human PR/merge/publication authority are preserved. The obsolete performance workspace and its dedicated targets/tooling are being retired.

Next: finish verification of the cleanup below and prepare a source/base-specific PR proposal.
No PR, merge or release is authorized by acceptance.

## Obsolete-asset cleanup — 2026-10-22

The human authorized discarding old originals and archive/work branches without successor backups.
Removed the performance workspace (65 tracked files), its scripts/configuration/dependency entries,
dedicated source-revision tooling, historical performance catalog/guides, launcher code/receipts and
obsolete handoffs/diagnosis assets. No `packages/*/src` changed. Product SDK closure checks and
installed-package validation remain. Release checkout no longer needs full history for the removed
migration validator. Product dependencies retain their resolved versions.

The worker fallback regression now directly uses the identical five-commit deterministic fixture.
Collector regressions retain values/status/diagnostic/rendering assertions and use product schema
normalization instead of the retired formal performance evaluator. Four shared helpers remain for
product regressions with purpose/removal-condition comments. Their independent strict check is
`npm run typecheck:test-support`, included in CI and `validate:release`.

Local retirement completed: 38 entries under `D:/gitlode_test`, the approximately 27 GiB Linux
`/home/t-wakabayashi/gitlode-performance` tree, six old Linux temporary roots, 197 obsolete repository
cache entries and 108 Windows temporary roots. Sealed Linux directories initially rejected deletion;
owner write permission was restored only within the approved tree, then removal succeeded. No
measurement process was stopped. Current accepted three-way outputs and development build cache remain.

Removed 13 old `archive/otel*` branches and the disabled-matrix, f2-first-target and test-layout work
branches from local and remote, using exact remote OID leases. Retain convergence, fixture and M2 until
their human-owned integration is complete. Main/integration and release tags were not changed. Git
history was not rewritten or garbage-collected; deleted branch details are not promised recoverable.

The human additionally authorized deletion of two Windows TEMP directories with uncertain task provenance;
both were removed after checking their paths and process command-line references:
`gitlode-phase4-50d899b48ddd41d9af8e11b9abbf3f57` and
`gitlode-rev-dep-eval-8e4be88d61234a6bae24e43d4068dff4`.
Existing `gitlode-session-*` roots belong to the retained product Git CLI session tests, not the
retired performance harness; ordinary node_modules/coverage/build output are also outside this purge.

Independent code/config review found no blocker. Before workspace removal, the affected three product
suites passed 60 tests; strict shared-support typing passed. Lint and release-boundary typing passed.
Architecture initially saw stale release chunks in development dist; regenerating development output
resolved this without source changes. It passed with the existing config warning (zero errors).

Final Windows `validate:release` passed: 86 product test files / 1,157 tests, no skips; release build,
publint and installed CLI/worker/both adapters/line diff/dynamic plugin/schema/TypeScript consumer all
passed. Format write/check and diff checks passed. No performance measurement or Windows launcher
campaign was restarted. The removal was reviewed independently of its code/config implementation.

Historical gate-removal verification (before infrastructure retirement): manifest comparison permits only the publish primitive change and removal
of the two dedicated validator scripts; `release` and `validate:release` are unchanged. Vitest
discovery changed from 88 to 87 files, with exactly the retired gate suite removed and every other
file/project identity retained. Format write/check and whitespace checks passed. No publishing
command was executed. Product code, lockfile and release workflow were not changed; the prior
candidate CI remains applicable product/package evidence, not a claim of CI on this new commit.

## Historical conclusions

Old F failed its then-current disabled RSS criterion. Saved F2 achieved a valid disabled pass only
for Linux/WSL2/ext4, commit-heavy isomorphic-git, 4,430 commits and the warm-cache protocol. The
remaining matrix was suspended without further valid F2 judgments. These results do not establish
causation or coverage of other workloads, and retirement does not convert failures into success.
Old handoffs and diagnostic assets are removed rather than retained as executable instructions.

## Historical routing verification (before infrastructure retirement)

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
Human acceptance was subsequently given and the migration-only gate is retired; do not launch extra calibration to seek a
more favorable percentage. PR approval/merge and release remain human-controlled.
