# Fixture CI correction before PR

## Active assignment (2026-10-13)

The human blocked PR creation after observing local and GitHub source-test failures. The previous
source/base/tree rehearsal is historical; do not create that PR. Trunk inspected CI run
38335718829, job 115095214372, source `74fd6926934688766ccd0edfcc21597154f3da9e`:
https://github.com/gitlode/gitlode/actions/runs/38335718829

Actual outer result: 99 files, 98 passed/1 failed; 1,375 tests passed/1 failed. The failing test is
fixture-lifecycle.test.ts, "completes forced low-threshold automatic maintenance in the foreground",
line 191: expected packs: 1 after the empty commit, observed packs: 2. The preceding two-pack setup,
supervisor exit and cleanup assertions passed. Nested intentional retention-test failures are not
this failure; their outer workflow suite passed. Release build, publint and installed tests were skipped.
CI reports Git 2.55.0; previous Linux review uses 2.53.0. Trunk checked current WSL Git 2.53.0 and
Windows Git 2.45.1.windows.1. Version dependence is a hypothesis, not yet the root cause. Local user
failure identity remains to be established; do not assume every local failure is this Linux-only case.

## Bounded branch implementation session

Stay on feature/otel-redesign_M2_fixture; start at the documentation checkpoint delivering this packet
(predecessor `74fd692`). Parent M2 remains `4f09265791c82452a5800cc6d9855938bf88a46e`, F2 unchanged.
Keep accepted C1/C2/C3 and product runtime fixed except for a demonstrated directly related defect.

1. Preserve the cited complete CI log and fixed source identity. Reproduce the failing maintenance
   case or explain version-specific behavior with pinned Git source/manual evidence. Check actual
   effective repository config, commit-triggered maintenance dispatch and low-threshold setup.
   Establish local test results on supported available environments; retain first failures and exact
   Git/Node/test OIDs. Do not misclassify expected nested assertion failures as outer suite failures.
2. Correct the smallest demonstrated test/fixture or harness defect. Preserve the real proof that
   automatic maintenance is triggered and completes under foreground settings before command return,
   with owned-group cleanup and correct semantic history. A vacuous absence-of-writer check, skipping
   newer Git, pinning CI to hide the failure, accepting arbitrary pack counts or replacing automatic
   maintenance with explicit full gc does not preserve that proof. If exact pack-count assumptions
   are not portable, replace them with an observable operation/completion oracle that has meaningful
   positive activation and bounded negative sensitivity. No global Git settings, product workload
   recipe/threshold changes or broad framework expansion. If current production foreground controls
   prove insufficient, return the concrete compatibility issue before broadening implementation.
3. Preserve fail-before/pass-after. Run targeted regression plus strict fixture tooling typing, then
   root npm test on the corrected fixed implementation in local Windows and Linux where available.
   Record skips and exact scope; no retry-until-green. Run required build/lint/architecture/format
   checks without stale release dist contamination. Do not raise timeouts merely to mask this assertion.
4. Normally push the implementation checkpoint and inspect its CI. Require source tests and subsequent
   release/package steps to execute successfully; a stale green run or skipped steps do not qualify.
   If another real failure occurs, preserve and diagnose it, not automatically rerun CI. No formal
   workload, 4,430-commit generation, eligibility check or frozen runtime rebuild is assigned.
5. Record source OIDs, root cause versus hypotheses, exact changed scope, independent sensitivity,
   local/CI runs and first failures here. Make separate implementation/outcome checkpoints and push.
   Stop for focused independent review; do not self-accept, prepare/create PR, merge, freeze or update
   parent/acceptance records. Verify actual remote equality, clean status and parent/F2 unchanged.

Following review, integration preparation must refresh final source/tree and verify latest source CI
before trunk asks for PR approval again. Earlier narrow reviews remain attributed evidence, not proof
that the failing full CI passed. Human source/base approval is still required for the eventual PR.

## Correction implementation (2026-10-13)

Started on the requested branch at `28078f639cd18d39bf895ef56a7192ba1afe869a`, with clean
tracked/untracked status. Product runtime, C1/C2/C3, parent M2 and F2 are unchanged.

The CI failure is a test configuration defect, not evidence that the foreground controls are
insufficient. Git 2.54 changed the unscheduled maintenance default from `gc` to `geometric`:
[release note](https://github.com/git/git/blob/v2.55.0/Documentation/RelNotes/2.54.0.adoc),
[2.55 strategy selection](https://github.com/git/git/blob/v2.55.0/builtin/gc.c#L1858-L1866).
The old test only lowered `gc.autoPackLimit` and `gc.auto`, so its commit dispatched automatic
maintenance without selecting the task whose threshold it lowered. With 2.55 it retained two packs.
Foreground configuration still governs completion of the selected tasks; it does not select GC.

The smallest correction is test-local `maintenance.strategy=gc`. The original two-pack setup and
exact one-pack positive expectation remain. A matching disabled automatic-maintenance control keeps
exactly two packs. Shared foreground flags remain the production constants. The worker now records
configuration origins/scopes and freezes Trace2 plus pack count immediately after the empty commit
returns, before notifying the supervisor. Assertions positively identify `maintenance --auto`, `gc`
and `repack` child starts and matching successful exits in that snapshot. Owned-group cleanup and
eight reachable commits remain separate assertions. No explicit GC replaces commit dispatch.
Contributor documentation explains this probe without changing the workload recipe or thresholds.

Local evidence is retained under `.cache/fixture-ci-correction/` pending outcome archiving:

- `ci-before.log`: complete cited job 115095214372 at source `74fd6926934688766ccd0edfcc21597154f3da9e`;
  the outer suite has one real failure, and release/package steps were skipped.
- Linux Node 22.23.1/npm 10.9.8/Git 2.53.0: original focused suite 20/20;
  corrected focused suite 21/21 and full suite 99 files/1,377 tests passed.
- Pinned Git 2.55.0 from `https://www.kernel.org/pub/software/scm/git/git-2.55.0.tar.xz`:
  `git255-before.log` reproduces the exact line-191 two-pack failure at the starting source;
  `git255-after.log` has corrected focused 21/21. Final code, including worker environment sanitation,
  passes strict fixture lifecycle typing and full root `npm test`, 99 files/1,377 tests
  (`strict-final.log`, `linux255-final.log`). Linux copy is `/tmp/gitlode-fixture-ci-correction`,
  with actual starting commit fetched into its private Git database. Earlier archive-only full run
  lacked `.git` and failed source-resolution tests; `linux-before.log` retains this setup error and
  the separate pre-existing adapter flake, and is not valid fixed-source qualification.
- Disposable independent mutations on 2.55: selecting geometric fails GC activation; overriding
  `maintenance.auto=false` only on the commit fails the positive maintenance-child assertion;
  overriding both detach flags to true fails `gc successful completion before command return`.
  Each exits 1; `sensitivity.py` restores the corrected test after the probes. Their bounded logs are
  `default-strategy.log`, `disabled-activation.log`, `detached-completion.log`. No mutation is committed.
- Windows Node 22.23.1/npm 11.11.0/Git 2.45.1.windows.1: starting full root test
  (`windows-before.log`) has 98 files passed/1 failed, 1,337 tests passed/1 failed/38 skipped.
  `behavioral-baseline` regeneration hits the unchanged five-second deadline, then cleanup gets
  EBUSY. This is distinct from CI: foreground maintenance is Linux-only. Focused unchanged baseline
  passes in 3.68 seconds (`windows-baseline-focused.log`). Default-concurrency corrected full run
  also exhibits deadline failures; preserve its complete outcome and diagnose concurrency separately.

Build/dev, lint, architecture, system typing, schema, dependency consistency and required root
format-write/check have run. Architecture reports its existing one configuration warning with zero
errors. No release build is mixed into these source checks. Source identity, final Windows scope,
normal push and implementation-OID CI results must be recorded in the outcome checkpoint below.
Independent focused review remains required; this implementation session does not self-accept.
