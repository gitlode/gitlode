# M1 evidence for M2 candidate attribution

## Completed integration

The human squash-merged [PR #111](https://github.com/gitlode/gitlode/pull/111) at
`7e0055a3f66e38d2f2a8f3554d30c41c2fefb1c0`, parent `1664798a9f586b1ac4e632d02d3a37cb0c6ebf0d`.
Trunk confirmed local/remote integration and the initial `feature/otel-redesign_M2` match this OID.
Tree `d12d76daca57baa9e4d7fd21192e50ef1d96932d` matches the accepted rehearsal exactly.
Relative to PR source `acad3ed56e134b1a066332cd3d42eb9c01d931b7`, only the integration base's
existing domain-design link is added. Relative to validated `6fd46d3`, only handoff documents differ.
[Post-merge CI](https://github.com/gitlode/gitlode/actions/runs/34816748419) succeeded.
M1 is complete; formal T13B, M2 and T13C acceptance remain open and the publish record is `blocked`.

## Accepted corrections and verification

- R1 no-op recorder/DAG composition: `f755cc775f7ecb8e299a0eb3f36cea0f40bd7eda`, corrected
  actual-path regression evidence at `c3e74a292cd459c1fe455803bbe66f6553a192ad`.
- R2 bounded asynchronous metric collection: `0354bab6bcf8e2f78bb6dcb0d23843576504e869`.
  The SDK timeout defaults to 1,000 ms; callback cancellation and synchronous preemption are not promised.
- Independent review `6fd46d340c57dd706a8483bb131693b47d9efe08` accepted R1 and maintained
  R2 acceptance, with 9 files / 179 affected tests passing. All nine recorder/binding selections
  were mutation-checked during correction; independent review repeated timing and non-timing cases.
- Fixed cumulative source/harness: `6fd46d340c57dd706a8483bb131693b47d9efe08`.
  Windows: 91 files, 1,190 passed / 17 Linux-only skips. Linux: 91 files, 1,207 passed / zero skips.
  The skips are 14 process-supervision and three supervised-workflow cases, all executed on Linux.
- Both platforms passed the full `validate:release` pipeline and installed-package coverage for
  both Git adapters, line diff, dynamic plugins, schema, CLI/worker and TypeScript consumer.
  R1 real composition and R2 real SDK normal/reject/non-settle callbacks were included.
- Every required product command passed on its first run. Two Linux environment-capture quoting
  failures occurred before product execution; both logs remain preserved. No code repair or formal
  measurement occurred during validation.

## Corrected immutable evidence

Archive: `D:\gitlode_test\m1-corrected-20260914T061714Z-6fd46d3`.
Manifest SHA-256: `dd17838aa8c3d21f605606c5dcd259b08d60c91892447d10990e51d80bd60472`.
Source/harness bundle SHA-256: `d29416c14e2f650cd1db51423f7cceaad435562bc63653d498f7d6fb3320ccc0`.
Full validation outcome checkpoint: `dd4cba745e3e5c93d5a49965947835ebb450579d`.
Trunk independently checked all 62 manifest entries and inspected the ledger/summary before PR creation.
No full suite was repeated merely for a handoff-only delta or identical merge tree.

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

## Historical evidence and remaining boundaries

Original M1 source/harness `681a1a5b53bd0aa957dae72d9fd9684da7ff467a` remains archived at
`D:\gitlode_test\m1-20260911T052245Z-681a1a5`. Its 40-entry manifest SHA-256 is
`7454ed104bfeb89ce401ff88156e5a261fd22c64608a21d1dce94119c2e4bb08`; the old Linux runtime hash is
`5d1eb261b3580b613822b9496c886d6809dd0ca804c5cb10467b3bf528410deb`. Original Windows/Linux
results were 1,184 passed / 17 skipped and 1,201 passed / zero skipped. The original Windows run
required a complete rerun after moving TEMP outside its checkout; the corrected run above did not.
These older results and package inventories are historical, not substituted for R1/R2 validation.

R1/R2 changed six production files relative to that original candidate (166 insertions, 17 deletions).
The exact delta is in the corrected archive. The GitHub Actions environment-isolation test fix,
domain-local helper placement and accepted G1/G2 gate are included in the corrected validation.
Earlier recovery detail remains in `acad3ed` and the recorded archives; it is not an active task list.

M0 calibration and one-target comparisons remain attributed only to their original product/harness
in the [M0 result](opentelemetry-m0-result.md). Do not overwrite their calibrated manifest or use the
repository's uncalibrated manifest as though calibration had occurred. M2 requires an explicit reuse
assessment and a new product/harness attribution boundary on the post-squash history.

The integration tree equivalence above supports functional reuse; it does not make pre-squash OIDs
ancestors of the release candidate or establish formal overhead acceptance. Preserve Git objects and
immutable packages, agree future squash timing, and validate the final combined candidate according
to the [M2 plan](instrumentation-opentelemetry-recovery-plan.md) and canonical publish guidance.
