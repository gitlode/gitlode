# Fixture CI correction before PR

## Active assignment: focused CI review and Windows disposition (2026-10-13)

The Git-strategy correction is delivered, not independently accepted. PR remains blocked: Windows
default npm test still fails, even though maxWorkers=2 passes. Do not reclassify the reduced-concurrency
run as a repaired default command. Trunk verified final CI 38346905386 is attempt 1/success at
`1ece6d12cff1d1d836f10554c4ce96c3013f3af4`; local source is clean on the fixture child.

Review-only assignment on feature/otel-redesign_M2_fixture:

- Fixed implementation: `b00258475004a8d7edb1c00bfa5f3f4d69039a5b`.
- Base: `28078f639cd18d39bf895ef56a7192ba1afe869a`.
- Outcome: `1ece6d12cff1d1d836f10554c4ce96c3013f3af4` (handoff only).
- Parent M2 `4f09265` and F2 refs `4ea24d5` remain unchanged.

1. Verify complete three-file correction, source/remote identities and Git 2.54/2.55 primary evidence.
   Confirm maintenance.strategy=gc is test-local and that shared foreground flags and production
   fixture heuristics are unchanged. Review Trace2 parsing: automatic invocation, correct parent/child
   association, successful exits captured before commit return, and a meaningful negative control.
   Keep real pack-count/history/owned-cleanup assertions. Check portability across tested Git versions
   without weakening activation/completion proof or treating a skipped Linux test as Windows evidence.
2. Run build/explicit fixture strict typing and the focused lifecycle suite on available Linux Git
   2.55 (reuse preserved isolated executable if available) and 2.53 where practical. Do not rebuild Git
   or rerun complete OS/package campaigns without a concrete need. Inspect preserved fail-before and
   three sensitivity logs with hashes/source bindings; use a bounded independent probe only for an
   unresolved concrete concern. Restore all temporary changes. Verify CI SHA, first attempt and actual
   source/release/package step execution from live metadata/saved logs. Report execution versus read
   evidence separately. Corrected-source local campaigns are content-bound as documented, not clean
   fixed-OID campaigns; CI provides that separate fixed-checkout evidence.
3. Separately inspect preserved Windows default failure logs and the 2-worker success. Identify exact
   failing tests, deadline/cleanup order and resource ownership; determine what supports concurrency
   attribution and what remains uncertain. Inspect root/workspace worker configuration and test
   cancellation/teardown. Do not treat EBUSY as harmless merely because a later run passes. Record
   any leftover roots/process uncertainty without broad cleanup. Keep the earlier Linux adapter timing
   assertion in invalid setup evidence visible; do not silently mark it repaired.
4. Return a bounded recommended Windows follow-up: configuration of supported test concurrency,
   focused test lifetime/cancellation correction, or further diagnosis, according to actual evidence.
   Distinguish an intentional supported default-policy change from a temporary CLI workaround. Do not
   unilaterally waive default npm test failures, raise deadlines, skip tests, change config or run more
   full campaigns in this review. A concrete proposed fix must keep all tests/assertions and unchanged
   formal measurement policy. Trunk assigns any follow-up implementation separately.

Append accepted/corrections-required for the GC-strategy correction only, findings with precise
failure paths, evidence attribution and Windows follow-up here. PR readiness remains pending until
the Windows obligation is explicitly resolved. Format write/check and diff check; documentation-only
commit/normal push, actual remote/clean/parent/F2 checks, remain on child. No implementation repair,
PR, merge, freeze, eligibility or formal workload/acceptance changes. Do not rerun CI merely for green.

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
  a separate adapter assertion (fake duration samples 0.1/0.3 instead of 0.2/0.2), and is not valid
  fixed-source qualification. That assertion is unrelated to maintenance dispatch; its underlying
  scheduling cause was not established, and no adapter change or workaround was made.
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

## Outcome checkpoint (2026-10-13): pending independent focused review

Implementation OID: **`b00258475004a8d7edb1c00bfa5f3f4d69039a5b`**; tree:
`fbcb568fcfbbdfd0ed44a6d9120699edaa65dff6`. The only changed paths from the starting checkpoint are
the lifecycle test, its contributor explanation and this handoff. Final test Git blob:
`822b55c25d46c4793a2a175c540535e495222be6`; file SHA-256:
`32e0e3d460ab20f90d95af7f684aba5ee4a4baa3b52714f20bee2ef0826882b7`.
Local final Linux testing used the starting commit's actual Git database with that exact test overlay;
the Windows final run started on the final implementation working tree, and its commit was created
while the run was active. These are explicitly content-bound local results, not claims that the
entire local campaign started at a clean implementation OID. CI below checked out that actual OID.

Final Windows command `npm test -- --maxWorkers=2` exits 0: **99 files passed, 1,338 tests passed,
39 skipped**, 219.26 seconds (`windows-final-workers2.log`). The skip set is the existing platform
conditions, including the original Linux lifecycle/supervisor cases and the added Linux negative
control. No existing test was disabled. On this 24-available-processor host, the original/default
concurrency executions failed deadline assertions: initial baseline timeout/EBUSY, then corrected
default run with baseline, sidecar and three C2 cases (5 failed/1,333 passed/39 skipped).
The unchanged baseline passed focused, and all test files passed with two workers at unchanged
five-second test deadlines. This establishes the observed association with concurrency/load;
the host's precise latency cause remains unproven. Default-concurrency Windows is **not** claimed
green or repaired by this GC-test correction. The user's unspecified earlier local log was not
provided, so correspondence is limited to these newly captured exact local failure identities.

Normal implementation push produced
[CI run 38346438746](https://github.com/gitlode/gitlode/actions/runs/38346438746), attempt 1,
job **115128858071**, source **`b00258475004a8d7edb1c00bfa5f3f4d69039a5b`**. Completed **success**:
source tests **99 files/1,377 tests passed**, release build, packed metadata/publint and installed
package test all executed successfully. No required step was skipped, and no CI rerun was requested.
Runner inputs: Git 2.55.0, Node 22.23.3, npm 10.9.9. Full before/after job logs, final run metadata
and job/step conclusions are preserved; expected nested retention failures remain nested evidence.
The installed package's reported tarball SHA-256 is
`e4d37c208cd6e6dba3ab887efa097e9c096ec97c41611a4ff8047732a845af45`.
This is ordinary CI functional evidence, not a frozen runtime or formal measurement.

New regression evidence archive:
**`D:/gitlode_test/m2-fixture-ci-correction-20261013-b002584`**, **38 members**.
Every copied member was verified against its source SHA-256; `manifest.json` records byte counts,
original paths, local source bindings and CI identities. Manifest SHA-256:
**`ac05e59f2c5e0ed9c10875ebf35246b81e68a7e9204778c20631ab5eb1dc2ded`**;
`manifest.sha256` pins those bytes. Build setup failures for missing OpenSSL/Rust are preserved;
the isolated Git 2.55 reproduction build disables optional TLS/HTTP/XML/gettext/Tcl/Rust features.
Source tarball SHA-256 is `457fdb04dc8728e007d4688695e6912e6f680727920f2a40bf11eacc17505357`.
This archive preserves regression logs, not a new frozen harness, eligibility or acceptance record.
Prior sealed archives were not modified.

After the implementation push, actual remote child matched the implementation OID, parent M2
remained `4f09265791c82452a5800cc6d9855938bf88a46e`, and actual local/remote F2 product/harness
preservation refs remained `4ea24d53afc57778addf3f47752e0fe73a7011ea`. Test-created hooks were removed
by normal teardown and Git status was clean. This outcome checkpoint changes only this handoff;
verify its normal push and clean local/remote equality before returning.

Stop for an independent focused review of strategy selection, positive automatic dispatch,
return-time completion/negative sensitivity, unchanged pack/history/cleanup proof, local failure
classification and CI provenance. No independent review has been performed in this correction
session. No PR, merge, formal measurement, 4,430-commit generation, freeze, eligibility, parent or
acceptance update was performed or authorized. Review must refresh latest source/tree and CI before
any later integration/PR approval request.
