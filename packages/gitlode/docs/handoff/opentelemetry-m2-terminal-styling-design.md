# M2 terminal styling: return packet

## Status and boundaries

Styling implementation and corrections are accepted and human squash-integrated by PR #112 at
`f4d90d1ce1828c2f06abc9684bcc10006b09e7cd`, with exact source-tree correspondence. Source history is
preserved at `archive/otel-m2-styling-1d97c99`. Next is cumulative profile validation; follow the
[current packet](instrumentation-opentelemetry-recovery-plan.md#current-assignment-cumulative-profile-functionalpackage-validation). See the [accepted review and remaining observations](opentelemetry-m2-terminal-styling-review.md).
On 2026-10-02 the human confirmed completed sample/real-repository checks are sufficient to proceed;
no additional shared-consumer visual sample gates this integration. GNOME light/dark remains M2
pre-release work. A reusable comprehensive dummy-data sample is future tooling, not a release blocker.
Cumulative profile/M2 validation and publish acceptance remain open.

Source branch: feature/otel-redesign_M2_styling. Intended return base: feature/otel-redesign_M2_profile.
Entry source: 76486d25870172528ce9af086ace756388b6c8d8; entry ancestry, clean worktree and actual remote
equality were verified before creating the styling child. Trunk is a conversation role, not a Git ref.
Normal commits/pushes preserve history. No force push, base-ref update, PR, merge or branch deletion.
PR requires explicit human approval naming source/base; only the human merges and deletes branches.

## R1 bounded correction outcome — 2026-10-01

R1 is corrected; trunk's limited-diff confirmation is pending. The independent review remains
**Corrections required** as recorded; this correction does not grant M2 acceptance.

- Start: `0d944b3113c481231218f2ca2f4f1cf53995d693`, equal to local/tracking/actual remote,
  on the requested styling branch with one clean worktree. Checkpoint ancestry was verified.
- Implementation correction: `0256c71bc3e429c13e0dc0aa938514d87858fd1b`. Only
  `test/presentation/reporting/summary-formatters.test.ts` changed: both stubs spread
  `plainStyling` and override their existing observed roles. Callbacks and output assertions are
  unchanged. No production/interface, palette, layout, collector, schema or unrelated test changes.
- Before correction, the review's exact summary-only strict command reproduced TS2741 at lines
  33 and 82. After correction, that command passed. The same flags also passed for all six changed
  presentation tests: styling, diagnostics, presenter, reporting/formatters, reporting/profile-view-drift
  and reporting/summary-formatters (with `test/support/js-yaml.d.ts`). No diagnostic suppression.
- Focused Vitest passed 2 files / 8 tests (summary-formatters and styling). Focused oxlint, root
  `npm run format:write`, root `npm run format:check` and `git diff --check` passed. No additional
  local full-suite or package verification was run. The separate `local-collection.test.ts:69`
  Attributes issue was neither changed nor claimed resolved.
- Correction push CI: [run 36812819253](https://github.com/gitlode/gitlode/actions/runs/36812819253),
  exact source `0256c71bc3e429c13e0dc0aa938514d87858fd1b`, attempt 1: success. Job
  `110211391160` reports successful source tests, release build, packed metadata and installed-package
  system test steps, as well as the preceding validation steps. No new failure or retry.
- This outcome is a subsequent documentation-only checkpoint, distinct from the implementation
  correction OID above. Its own OID and push CI are reported in the final handoff, not attributed
  to the correction-source CI.

Unresolved instability, unobserved display environments/shared-consumer visual checks, and M2
acceptance remain open as detailed in the independent review. No CI retry, PR, merge, parent-ref
update or formal measurement is part of this correction.

## Adopted outcome

Canonical contracts: [CLI styling](../design/cli.md), [profiling guide](../profiling.md),
[profile view catalog](../design/telemetry-catalog/profile-view.yaml).

- Shared source-editable role rules own decoration and padding; value and attributeName use default
  foreground without decoration. fieldLabel, unit and separator remain dim.
- h1 is shared by completion/Profile; h2 is Scope; h3/h4 follow display depth for namespaces and
  observation names. Deeper names are undecorated. Headings have one space padding per side.
- namespaceDepth defaults to 0. Keep grouping and its regression tests for future experiments;
  deleting grouping is a later human decision. Numbers and measurement units are adjacent.
- Renderers emit to a writeLine sink; the array formatter is a collecting adapter. Empty reports
  do not interrupt progress. Failures propagate and already emitted lines can remain visible.
- Data preparation separates same-name measured and diagnostic-only entries. Render inputs are
  read-only; a local observation-name brand marks identity rather than validation. No collector,
  schema, aggregation, background detection or runtime theme configuration change was introduced.

## Evidence and human feedback

Inspected locked Vitest 4.1.10 formatters and tinyrainbow 3.1.0, installed Chalk 6.0.0, and official
Windows Terminal/Chalk documentation. Vitest's padded foreground/background labels informed trials;
this is implementation comparison, not evidence of universal contrast.

Human environment: Windows Terminal 1.24.11911.0, Campbell/Tango Light, Cascadia Mono; plain text also
used. Bold mainly changed brightness, not weight. White/brightWhite values failed on light backgrounds;
plain values, padded headings and C's related cyan backgrounds were adopted. Yellow on light was
previously somewhat weak; no isolated final re-evaluation is recorded. Exact widths/intensity settings
and separate final shared-progress/diagnostic results are not recorded. Overall Profile approval must
not be expanded into evidence for unobserved roles or terminals.

GNOME Tango dark/light remain unobserved. The human authorized Windows/plain-first work and did not
request a VM. Return this gap to trunk; WSL within Windows Terminal is not a second renderer.
The human owns real repository preparation/selection; do not prepare or record repository identities.

Key checkpoints (history retains detailed trials):

| Source  | Evidence/outcome                                                           |
| ------- | -------------------------------------------------------------------------- |
| 70e9e0d | Human explicitly confirmed direct Chalk sample source                      |
| 5f1aa77 | Plain values/background headings reviewed; font recorded                   |
| 7178f28 | Shared h1, padding, differentiated backgrounds adopted                     |
| e8a4216 | A/C sample supplied; C selected, viewed OID not explicitly restated        |
| a4bb707 | Human-selected flat default and compact units; subsequent Profile approval |
| 4f7576b | Maintenance refactor explicitly reviewed and accepted by human             |
| 8123fb5 | Catalog validator fixed; human confirmed correction                        |

Do not claim that a later cleanup or squash OID was the human-viewed trial source. Assess visible
deltas before requesting further visual checks. No visible product changes are intended after these
checkpoints. No formal performance candidate is frozen.

## Temporary artifacts

Removed capture-profile-evidence.ts and preview-terminal-styling.ts, including primitive/padding/A-C
samples. Historical helpers are available at a4bb707; old handoff commands are marked archival.
No package scripts or CI depend on them. The one-off refactoring script was already removed.
The capture helper's owned temporary-directory prefix was checked and no remaining directory found.
Production renderers, style/layout parameters and regression tests remain maintained code.

## Verification and remaining return steps

At 8123fb5: root npm test passed 95 files, 1277 tests, 17 skipped. One preceding run had a transient
5-second repository-fixture timeout and EBUSY cleanup; the isolated full rerun passed. The catalog
failure was an earlier fixed-two-level validator missed by narrow presentation test selection.

Final cleanup tree: root tests passed 95 files / 1277 tests with 17 skipped. Syncpack, full lint,
format, architecture, schema checks and release build passed. Packed metadata (publint strict)
and installed-package CLI/worker/both adapters/line diff/dynamic plugin/schema/TypeScript consumer
checks passed. The first package check encountered sandbox npm-cache EPERM; rerunning only the
package checks with the required permissions passed. Owned failed-run temp directories were removed.
Exact-source Linux CI at f055885 passed on its third attempt: 95 files / 1294 tests, release build,
strict publint and installed-package tests. The two preceding attempts failed in different tests;
their evidence and unresolved attribution are recorded in the linked review request. A successful
retry is not a fix for that instability. Keep skipped/unobserved evidence explicit. This packet does not waive publish
or cumulative Windows/Linux/package acceptance gates. No publish command is authorized.

Independent focused review is complete; see the linked acceptance and risk record.
After that review and green final CI, request human PR approval with explicit source/base. After human
squash, verify source/content correspondence before cumulative acceptance. Preserve the styling ref.

## Cumulative profile functional/package validation — 2026-10-02

Fixed candidate `f4d90d1ce1828c2f06abc9684bcc10006b09e7cd`, tree
`d68714d0b1e4b4c7820f71d12349b2817c190291`, passed fresh isolated Windows/Linux validation.
The tree matches styling source and actual remote archive `1d97c9941f87bff6013ee411800f70ee91b42e5a`.
Candidate is an ancestor of planning checkpoint `bdd62a28daf6db90e320dbfdcdf2bfa349b19f83`;
their delta contains only three handoff documents. Planning checkout remained on profile.

| Platform | Environment and isolation                                                                                                                                                                                                     | Result                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Windows  | Windows 11 Pro 10.0.26200, NTFS; Node 22.23.1, npm 11.11.0, Git 2.45.1.windows.1; `D:/gitlode_work/m2-profile-20261002T-validation-f4d90d1/windows`, separate evidence-root TEMP/cache                                        | 96 files; 1,286 passed, 26 Linux-only skips; `validate:release` exit 0, 108.644 s |
| Linux    | Ubuntu 26.04 / WSL2 kernel 6.18.33.1, native ext4 `/dev/sdf`; private Node 22.23.1, npm 10.9.8, Git 2.53.0; `/home/t-wakabayashi/gitlode-performance/m2-profile-20261002T-validation-f4d90d1/source`, sibling ext4 temp/cache | 96 files; 1,312 passed, zero skips; `validate:release` exit 0, 37.694 s           |

Both platforms passed pinned `npm ci`, root `npm run validate:release`, and separate
`npm run typecheck:telemetry-release-acceptance -w gitlode` on their first invocation.
Fresh checkout with no build cache and the canonical initial `tsc -b` prove checked production
TypeScript; production configs do not enable `noCheck`. The separate strict gate-tooling check
does not substitute for that production proof. Windows skips are 23 process-supervision and three
supervised-workflow cases, all executed on Linux; every case/parameter is enumerated in `windows/skips.txt`.

Evidence root: `D:/gitlode_test/m2-profile-20261002T-validation-f4d90d1`.
Verified `manifest.json` contains 77 file entries; SHA-256
`010799ad4296e8406d015ad470d81e1e54e23dfb8de16ba36af11ff92258b6f7`.
It covers candidate bundle, source/planning mapping, configs, runner commands, full logs, command exits,
environment, skips, package bytes and transfer binding. Command mapping is in `inputs/windows.ps1`
and `inputs/linux.py`, with results under `windows/` and `linux/logs/`. Linux native evidence remains
under the workspace above; logs and packages were copied to the evidence root and hashes checked.
Outer limits were 600 s for installation, 1,200 s for canonical validation, 180 s for typing/pack/publint,
and 600 s for preservation installed-package checks. No limit fired; owned test processes exited,
detached checkouts remained clean, and external temp/cache were retained. Initial shell/toolchain
discovery errors preceded product commands and did not cause product reruns.

No development build followed successful release validation. Each platform packed release output,
ran strict publint and the existing installed-package system test, then repacked; pre/post bytes matched.
Both package-check invocations covered CLI/worker, both adapters, line diff, dynamic plugin, schema
and NodeNext TypeScript consumer. Preserved `pre/gitlode-0.12.0.tgz` SHA-256:

- Windows: `b0660280274eee4df2ae0d5deb1bea4df7c79f6e3a7882eb30b131a996d7a9f2`.
- Linux: `0ada39db9502252b7c62eb702aa2691b9c57a0ee71eb19df2cf2c9638f884628`.

No failure, retry, code correction or formal measurement occurred. This first-run success does not
resolve historical ENOTEMPTY/timeout/EBUSY attribution. Trunk owns evidence assessment and the next
profile-to-M2 integration packet. Human PR/merge approval, tests/system migration, formal T13B,
GNOME light/dark, final combined-candidate checks and T13C remain open; publish acceptance stays blocked.
