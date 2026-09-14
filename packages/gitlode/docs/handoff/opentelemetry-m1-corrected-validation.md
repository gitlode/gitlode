# Cumulative validation of corrected M1 candidate

## Assignment and fixed candidate

Use a separate human-started validation conversation. Trunk has accepted R1 and retained R2
acceptance from the [independent re-review](opentelemetry-m1-r1-r2-review.md#focused-re-review-outcome).
This assignment verifies the cumulative corrected product on Windows and Linux and preserves its
tested package identity. It is not implementation, formal performance acceptance, PR creation or merge.

- Fixed validation source and harness: `6fd46d340c57dd706a8483bb131693b47d9efe08`.
- Accepted R1 correction: `c3e74a292cd459c1fe455803bbe66f6553a192ad`.
- Accepted R2: `0354bab6bcf8e2f78bb6dcb0d23843576504e869`.
- Historical M1 candidate: `681a1a5b53bd0aa957dae72d9fd9684da7ff467a`; do not relabel its evidence.

The fixed source differs from accepted c3e74a2 only in three handoff documents. Verify this and the
source OID before execution. Subsequent trunk documentation commits do not change the fixed target.
Record actual planning branch/HEAD/worktree state at entry and exit. Work from isolated detached
checkouts of the fixed source; do not rebuild in the shared planning worktree or update shared refs.
Use a fresh Git bundle to transfer local commits to Linux if they are not available remotely.

Read `AGENTS.md`, the [recovery plan](instrumentation-opentelemetry-recovery-plan.md), canonical
[build/test/release guidance](../contributing/build-test-release.md), and
[prior M1 evidence](opentelemetry-m1-validation-result.md). This run replaces neither prior records
nor their limitations; it adds evidence for the production changes introduced by R1/R2.

## Environments and bounded operation

This work includes dependency installation, full tests, release builds and installed-package tests
on two platforms, plus artifact transfer. External execution can take substantial time independently
of model reasoning. Tell the human before starting, report the active stage regularly, and record
command durations and exit codes. Do not wait indefinitely on stalled commands or automatically rerun
until a favorable outcome. Preserve the first failure and diagnose its concrete cause before retrying.
If an implementation defect is found, return it to trunk without changing source or acceptance gates.

Use the existing Ubuntu WSL2 private Linux toolchain on native ext4, as documented in the
[M0 environment continuation](opentelemetry-m0-result.md#prepared-linux-environment-for-continuation).
Verify actual Node/npm/Git/platform versions and paths; do not assume an interactive shell activated
the toolchain. Do not modify Docker Desktop, global WSL settings or sealed toolchain/release snapshots.
Use a new unique run directory below `/home/t-wakabayashi/gitlode-performance/` on Linux and a fresh
Windows checkout such as `D:\gitlode_work\m1-corrected-<timestamp>-6fd46d3-windows`.

Set Windows TEMP/TMP and Linux TMPDIR outside their source checkout, with separate npm caches.
The old Windows attempt failed because fixtures traversed parent metadata when TEMP was inside
the checkout. Do not repeat that layout. Keep dependency installation out of archived runtime inputs.
Request environment-specific tool permission if required; no need to install new infrastructure.

## Commands and evidence

On each platform, in its fixed clean checkout:

```text
npm ci
npm run validate:release
npm run typecheck:telemetry-release-acceptance -w gitlode
git diff --check
```

Capture complete stdout/stderr and exit status. `validate:release` already includes dependency,
format, lint, architecture/development build, schema, full source tests, release build, publint and
installed-package system tests. Do not separately repeat successful stages without a new reason.
Confirm the actual command definition at the fixed revision. Never invoke `npm run release`,
`changeset:publish`, npm publish, Version PR automation or the formal performance commands.

Record actual test files/counts/skips instead of assuming the old totals. Windows Linux-only skips
are expected only where the test definition specifies them; identify their cases and show Linux
executed the corresponding coverage. R1 real-composition and R2 observable-callback tests must be
included. State production checked typing separately from the pre-existing test/tooling noCheck.
Verify installed-package coverage includes both Git adapters, line diff, dynamic plugin, schema,
worker/CLI execution and TypeScript consumer behavior. The live acceptance record remains blocked.

After successful validation, preserve the release package on each platform and a complete Linux
production-only installed consumer with lockfile and runtime dependency closure. Follow the prior
M1 preservation method: bind package hashes to the bytes used by installed-package validation;
if the package must be repacked, compare hashes before/after. If any intervening command rebuilt
development output, rebuild release output and revalidate affected package bytes before sealing.
Do not use a mutable development dist as the preserved candidate. Retain Linux modes/symlinks and
verify a fresh extraction of the runtime archive against its file/mode/link inventory.

Save command ledger, environment and toolchain identities, source/harness Git bundle, lockfile hash,
test results, package/runtime hashes and file inventories in a new archive under
`D:\gitlode_test\m1-corrected-<timestamp>-6fd46d3`. Generate an evidence SHA-256 manifest and verify
all its entries after transfer; report the manifest's own hash separately. Keep source checkouts
clean and archives immutable. Do not overwrite M0 or the original M1 archives, recalibrate fixtures,
or attribute older measurements to this candidate. This is a functional validation candidate;
formal M2 measurement inputs will be fixed on the resulting integration history after squash.

## Return and next owner

Append the result below and save a documentation-only checkpoint on `feature/otel-redesign` after
format write/check and diff checks. Return source and final documentation OIDs, platform command
ledgers, actual pass/fail/skip counts, failures/reruns, archive paths/hashes, byte-to-test bindings,
production delta from the original M1 candidate and remaining limitations. Do not mark M1 complete,
change the acceptance record or start an independent review yourself.

Trunk will inspect the outcome, assess preserved evidence and the actual integration-base delta,
and prepare any remaining integration review/cleanup before requesting human PR-creation approval.
The human alone chooses and performs merges. Retain T13B/T13 and archive refs. No push or PR is
authorized by this validation assignment.

## Validation outcome

### Result and provenance

The cumulative corrected-candidate validation passed on Windows and Linux at fixed source and
harness `6fd46d340c57dd706a8483bb131693b47d9efe08`. This is functional and package evidence only. No
code correction, acceptance-record change, calibration, formal performance measurement, PR, merge,
push or publisher-capable command was performed. The live telemetry migration acceptance record
remains `blocked`, and M1 integration remains pending.

The planning worktree entered this run clean on `feature/otel-redesign` at
`e2ec15ea61e323a777430b270404623d4cc323e5`, 12 local commits ahead of the then-recorded remote.
The fixed candidate resolved to tree `de87935d9ceedc24e9f169bf12ce44d6979f04d7`. Its delta from
accepted R1 correction `c3e74a292cd459c1fe455803bbe66f6553a192ad` was exactly the three
expected handoff documents. Both platform runs used fresh detached bundle clones and ended with
clean source checkouts. The planning branch, T13B, T13, integration and pre-reset archive refs were
not updated by validation.

The new immutable evidence archive is
`D:\gitlode_test\m1-corrected-20260914T061714Z-6fd46d3`. Its 62-entry
`evidence.sha256` was verified after Linux-to-Windows transfer; the manifest's own SHA-256 is
`dd17838aa8c3d21f605606c5dcd259b08d60c91892447d10990e51d80bd60472`. The fresh source/harness
bundle SHA-256 is `d29416c14e2f650cd1db51423f7cceaad435562bc63653d498f7d6fb3320ccc0`.

### Environments and command results

| Platform | Environment                                                                             | Toolchain                                       | Isolation                                                                                                 |
| -------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Windows  | Windows 11 Pro 10.0.26200, x64, NTFS                                                    | Node 22.23.1, npm 11.11.0, Git 2.45.1.windows.1 | `D:\gitlode_work\m1-corrected-20260914T061714Z-6fd46d3-windows`; sibling temp/cache outside the checkout  |
| Linux    | Ubuntu 26.04 LTS on WSL2, kernel 6.18.33.1-microsoft-standard-WSL2, x86_64, native ext4 | private Node 22.23.1, npm 10.9.8, Git 2.53.0    | `/home/t-wakabayashi/gitlode-performance/m1-corrected-20260914T061714Z-6fd46d3`; separate ext4 temp/cache |

The fixed revision's actual `validate:release` definition matched the documented complete pipeline.
Both `npm ci` runs passed: Windows installed 323 packages and Linux installed 324. Each reported
seven audit findings (one low, three moderate and three high); no dependency mutation or audit fix
was performed.

| Required command                                            | Windows           | Linux                    |
| ----------------------------------------------------------- | ----------------- | ------------------------ |
| `npm ci`                                                    | exit 0; 21.613 s  | exit 0; 14.98 s          |
| `npm run validate:release`                                  | exit 0; 104.386 s | exit 0; 40.32 s          |
| `npm run typecheck:telemetry-release-acceptance -w gitlode` | exit 0; 0.600 s   | exit 0; 0.27 s           |
| `git diff --check`                                          | exit 0; 0.038 s   | exit 0; less than 0.01 s |

Production checked typing therefore passed separately on both platforms. The pre-existing
test/tooling `noCheck` boundary described in the build guidance was not treated as production typing.

### Source tests and installed-package coverage

Windows passed all 91 test files with 1,190 passed and 17 skipped of 1,207 tests. The skips were the
14 cases inside the explicitly Linux-only process-supervision definition and the three cases inside
the explicitly Linux-only supervised-workflow definition. Linux passed all 91 files and all 1,207
tests with no skips, including all 22 tests in `performance-supervisor.test.ts` and all 16 tests in
`performance-workflow.test.ts`.

The cumulative suites included the corrected production-path evidence:

- R1 real composition ran in `execute-run.test.ts` (23 tests), including the case that observes
  actual disabled and initialization-degraded object selection, connected telemetry clock activity,
  all recorder/DAG bindings, both Git adapters and representative file/plugin paths.
- R2 ran in `local-collection.test.ts` (38 tests) and `worker-telemetry-session.test.ts` (35 tests).
  These include the documented finite default timeout and real SDK asynchronous observable callbacks
  for normal completion, rejection and non-settlement of an unlisted plugin metric, with bounded
  finalization, partial diagnostics, continued cleanup, idempotence and safe late settlement.

On both platforms, the canonical pipeline and the preservation binding run passed publint and the
complete installed-package system test. Package version 0.12.0 started through the installed CLI and
worker; isomorphic-git and Git CLI each produced two records; line diff, dynamic plugin, schema and
the NodeNext TypeScript consumer passed.

Every required product command passed on its first execution, so no validation rerun was made. Two
pre-execution Linux environment-snapshot attempts exited 2 and 1 because PowerShell-to-bash quoting
lost the intended group and then a task-local path variable. Their logs and diagnoses are retained.
No candidate command had started, and the successful retry changed only the operator command to use
literal absolute paths.

### Preserved package and runtime identities

No development build occurred after either successful canonical release pipeline. On each platform,
the current release output was packed, checked again with strict publint and the installed-package
test for preservation binding, then packed again. Pre/post package bytes matched exactly.

| Artifact                     | SHA-256                                                            | Binding                                                                                           |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Windows `gitlode-0.12.0.tgz` | `63beec97129799f0963be8fa5c8160673bdf094959763ff528a3be7f116d2da7` | pre/post pack matched; installed-package checks passed against the intervening release output     |
| Linux `gitlode-0.12.0.tgz`   | `87a74532f3f53ac87f64a3ed830f841a98cc8b1c4466d44b20115955c078fb8f` | pre/post pack matched; transferred copy hash matched                                              |
| Linux production runtime     | `c91e77aebfe06a29ba6899d99541957bf6ff9a92d8340ffca471abcb626a9b54` | installed only from the preserved Linux package; includes lockfile and 69-package runtime closure |

The installed runtime lockfile SHA-256 is
`fb1cbd6c1d5e1ab71d1da217f2e3b1570a57057824eb53e349c481ef36a25c79`. All non-symlink runtime
entries were made non-writable before archiving. A fresh ext4 extraction verified all 4,085 file
hashes and all 4,469 mode/type/link inventory entries, including five npm `.bin` symlinks, and the
extracted CLI reported version 0.12.0.

### Delta and remaining limits

Relative to historical M1 candidate `681a1a5b53bd0aa957dae72d9fd9684da7ff467a`, the corrected
candidate changes six production files by 166 insertions and 17 deletions. R1 accounts for effective
recording-state composition and no-op Git, extraction, projection, line-diff, output, plugin and DAG
selection. R2 accounts for the finite local metric-collection timeout and session finalization
handling. The archive records the exact file-level delta; documentation/test/handoff consolidation
is not represented as production change.

This run adds cumulative functional, typing, package and runtime-preservation evidence for R1/R2. It
does not relabel historical M0/M1 evidence, validate a future squash or integration tree, establish
formal performance acceptance, close the live release gate or mark M1 complete. Trunk must still
inspect this evidence and the eventual integration-base delta before the human authorizes or performs
any final integration PR or merge.
