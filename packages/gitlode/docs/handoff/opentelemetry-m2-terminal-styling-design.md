# M2 terminal styling: return packet

## Status and boundaries

Human visual tuning is complete for now: the human judged the Profile CLI output acceptable after
selecting a flat layout and compact unit tokens. The maintenance refactor and subsequent catalog-test
fix were also explicitly confirmed. Cleanup and validation at f0558856f018f24b5766d6ed8b5d241f9cb02747
are complete. See the [independent review request](opentelemetry-m2-terminal-styling-review.md)
for the pinned review range, CI results and unresolved test instability discovered in this session.
Independent review is assigned by trunk. Do not self-accept the implementation or infer M2/release acceptance.

Source branch: feature/otel-redesign_M2_styling. Intended return base: feature/otel-redesign_M2_profile.
Entry source: 76486d25870172528ce9af086ace756388b6c8d8; entry ancestry, clean worktree and actual remote
equality were verified before creating the styling child. Trunk is a conversation role, not a Git ref.
Normal commits/pushes preserve history. No force push, base-ref update, PR, merge or branch deletion.
PR requires explicit human approval naming source/base; only the human merges and deletes branches.

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

Trunk should assign independent focused review of the entry-to-final diff, shared consumers,
streaming/error behavior, optional grouping and diagnostic identity/ordering, tests and contracts.
After that review and green final CI, request human PR approval with explicit source/base. After human
squash, verify source/content correspondence before cumulative acceptance. Preserve the styling ref.
