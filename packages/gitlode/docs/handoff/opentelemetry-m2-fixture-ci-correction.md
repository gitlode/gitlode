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
