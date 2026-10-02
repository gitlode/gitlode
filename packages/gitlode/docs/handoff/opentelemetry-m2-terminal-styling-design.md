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
