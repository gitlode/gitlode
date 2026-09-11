# M1 cumulative validation result and preserved candidate

## Planning acceptance

The planning owner accepts cumulative validation and candidate preservation at
`681a1a5b53bd0aa957dae72d9fd9684da7ff467a`. On receipt, planning HEAD was
`134e475b2de9559007e11fb724298395f832c6cf` with a clean worktree. The owner independently verified
`evidence.sha256` as `7454ed104bfeb89ce401ff88156e5a261fd22c64608a21d1dce94119c2e4bb08` and all 40
indexed archive files, including the runtime archive hash recorded below, and inspected the command
ledger and result/provenance records. Tests and ext4 runtime extraction were not rerun in planning.

The observed integration ref remains `745d3d553e7ddbea430993602ddaa36fe816dfc4`, an ancestor of
the proposed source `134e475...`; changes from the validated candidate are seven handoff documents
only. Next is [cumulative integration review and rehearsal](opentelemetry-m1-integration-review.md).
M1, full T13B, M2, T13C and publish acceptance remain incomplete.

## Outcome

Cumulative functional and package validation passed on Windows and Linux for source and harness
`681a1a5b53bd0aa957dae72d9fd9684da7ff467a`. The tested package and a complete production-only Linux
installation are preserved under `D:\gitlode_test\m1-20260911T052245Z-681a1a5`. This checkpoint
records validation and candidate preservation only. It does not complete M1 or T13B, accept M2 or
T13C, authorize publishing, or perform the remaining cumulative review and merge-result checks.

No source code, release-acceptance record, calibration input, candidate/integration ref, or fixture
was changed. The only repository mutation is this result document and its requested checkpoint,
which advances `feature/otel-redesign_T13B` from the planning HEAD recorded below. No formal
performance measurement, merge, Version PR, release, Changesets publish, or npm publish was run.

## Identities and ref relationship

- Planning checkout before validation: branch `feature/otel-redesign_T13B`, HEAD
  `81fe9025ac8ba425a8d2f11c881949af3f096c6d`, clean worktree.
- Fixed source and current harness: `681a1a5b53bd0aa957dae72d9fd9684da7ff467a`.
- Refs recorded before creating the isolated checkouts:
  - `feature/otel-redesign_T13B`: `81fe9025ac8ba425a8d2f11c881949af3f096c6d`
  - `feature/otel-redesign`: `5a6a810b8621759fb9723d0617aabdf1fbbac631`
  - `integration/v0.13.0`: `745d3d553e7ddbea430993602ddaa36fe816dfc4`
- `integration/v0.13.0` is an ancestor of the fixed candidate. The fixed candidate is not an
  ancestor of the integration ref, and their merge base is the integration OID itself,
  `745d3d553e7ddbea430993602ddaa36fe816dfc4`. Thus the candidate remains unmerged as expected.
- The transfer bundle SHA-256 is
  `0ac433cd98f3f3a3a44c81fa8dc444474d07866b93150d9476dff0e4de1fab73`.
- The committed `package-lock.json` SHA-256 is
  `f8808ceec4f64f5e6b7ba46d88804929d54e1ae0e8576e5da77237a0f3647ba7`.

## Environments

| Platform | Environment                                                                | Toolchain                                             | Filesystem and isolation                                                                                                                                                  |
| -------- | -------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows  | Windows 11 Pro 10.0.26200, x64                                             | Node 22.23.1, npm 11.11.0, Git 2.45.1.windows.1       | Detached checkout on NTFS at `D:\gitlode_work\m1-20260911T052245Z-681a1a5-windows`; temp and npm cache in a separate sibling directory                                    |
| Linux    | Ubuntu 26.04 LTS on WSL2, kernel 6.18.33.1-microsoft-standard-WSL2, x86_64 | Prepared private Node 22.23.1, npm 10.9.8, Git 2.53.0 | Detached checkout, temp, cache, installed runtime, and verification extraction on native ext4 below `/home/t-wakabayashi/gitlode-performance/m1-20260911T052245Z-681a1a5` |

Both `npm ci` runs used the committed lockfile and passed. Windows installed 323 packages and Linux
installed 324 packages; the difference is platform-specific optional dependency selection. Both npm
runs reported the same audit inventory of seven vulnerabilities (one low, three moderate, three
high); no dependency mutation or audit fix was performed.

## Functional and package results

| Check                            | Windows                                                                                                                                                                   | Linux                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `npm run validate:release`       | Passed on the complete rerun                                                                                                                                              | Passed                                                     |
| Source suite                     | 91 files passed; 1,184 passed and 17 skipped out of 1,201 tests                                                                                                           | 91 files and all 1,201 tests passed; no skips              |
| Release validation               | dependency consistency, formatting, lint, architecture/development build, generated schema, release build, strict packed metadata, and installed-package scenarios passed | Same checks passed                                         |
| Installed-package scenarios      | version 0.12.0; both Git adapters produced two records; line diff, dynamic plugin, schema, worker/CLI, and NodeNext TypeScript consumer passed                            | Same results                                               |
| Strict gate typecheck            | Passed with the dedicated checked TypeScript configuration                                                                                                                | Passed with the dedicated checked TypeScript configuration |
| Focused release-acceptance suite | 1 file, 50 tests passed                                                                                                                                                   | 1 file, 50 tests passed                                    |

The 17 expected Windows skips comprise the Linux process-supervision and supervised-workflow cases
(14 and 3 respectively). They are not silently omitted: Linux executed the same complete suite with
1,201 passes and zero skips, including `performance-supervisor.test.ts` (22 tests) and
`performance-workflow.test.ts` (16 tests).

The executed suite includes the canonical safety coverage relevant to this milestone:

- profiling-disabled/enabled and frozen-output equivalence in `behavioral-baseline.test.ts` (12
  tests), plus repository-sidecar output equivalence;
- actual Git adapter, plugin lifecycle, and plugin projection operation ownership in the
  `*-telemetry-owner.test.ts` suites;
- direct disabled-recorder/no-op behavior in `domain-metric-recorders.test.ts` (36 tests); and
- worker initialization/finalization/collection failure isolation in
  `worker-telemetry-session.test.ts` (32 tests), with application/extraction failure paths elsewhere
  in the same full suite.

The live `.release/telemetry-migration-acceptance.json` remains exactly in `blocked` state. The
focused 50-test gate suite passed on both platforms. Direct invocation of the non-publishing
validator in each detached fixed checkout exited 1 and failed closed because local publishing
requires an attached `main` branch; no publisher-capable command was invoked.

### Truthful rerun record

The first Windows composite `npm run validate:release` exited 1 during the source suite: 89 files
passed, two files failed, 1,182 tests passed, two failed, and 17 skipped. The temporary directory had
mistakenly been placed inside the checkout, so two metadata-walk fixtures reached the repository
root `package.json` instead of finding no parent metadata. No downstream release build, publint, or
installed-package step from that failed composite was credited. The temp/cache directories were
moved to a verified sibling path outside the checkout, after which the complete canonical command
was rerun and passed through all downstream steps. The original failure log and successful rerun log
are both retained.

## Preserved package and runtime

After the focused gate test rebuilt shared `dist` in development form, `build:release` was rerun on
each platform before preservation. On each platform the sequence was: pack the candidate, run strict
publint, run the complete installed-package system test, then pack again. The pre/post package hashes
matched, binding the preserved bytes to the tested release output.

| Artifact                        | SHA-256                                                            | Notes                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Windows `gitlode-0.12.0.tgz`    | `d29851015e732a18815859adbd27e56ec0cf59fab8b6f87123d89a84a9c200bb` | Windows package/test provenance; `dist/index.js` is mode 0644 in the npm manifest                                                     |
| Linux `gitlode-0.12.0.tgz`      | `c1798ef7e7a7dc1006aa388f747a8caa3d959f683a5db1eba18b6e618bd98376` | Exact local copy hash also verified after transfer to ext4; `dist/index.js` is mode 0755                                              |
| Linux installed runtime archive | `5d1eb261b3580b613822b9496c886d6809dd0ca804c5cb10467b3bf528410deb` | Complete production-only consumer tree, package lock, `gitlode`, and all runtime dependencies; tar preserves Linux modes and symlinks |

The Linux runtime installation added 69 production packages. Before sealing, it started as version
0.12.0 under the recorded prepared Node binary at
`/home/t-wakabayashi/gitlode-performance/m0-20260909-a97829b/toolchain/node-v22.23.1-linux-x64/bin/node`.
All non-symlink entries were then made non-writable. A fresh ext4 extraction verified all 4,085 file
hashes and the complete mode/type/symlink tree against the archived manifests. The five mode-0777
entries are npm `.bin` symlinks, not writable regular files or directories. No later build or setup
uses the sealed snapshot.

The installed-package fixture identity is the deterministic two-commit recipe in
`packages/gitlode/scripts/test-installed-package.ts`, SHA-256
`6598a554f3582df6260f090dc900ccfd52cba65cc5fe3f0857314432e97b3f9e`, at the fixed candidate OID.
The archive also records package inventories, bundle file hashes, schema/package metadata, and the
Linux installed tree file and mode manifests.

## Calibration provenance separation

No calibration or formal measurement was run. The accepted M0 material remains attributed only to
product `a97829b5315d42fbfa2212b718258099e7c90498` and harness
`a53a5b83d18f9e493ebb39c4db481b762448743f`, with target recipe SHA-256
`6668bd8a9c032a9d2c9ca2a7aca0a1b7e56055c24b3431e561d3fee156ed738f`. Its accepted calibrated
manifest is copied separately under `manifests/m0-accepted/` and retains SHA-256
`93b3010b76337ea8f3bdc9fc725c2ab4cd98824b33f9c6ab99f3bc34750b7945`.

The fixed candidate's unchanged, uncalibrated repository manifest is separately copied under
`manifests/m1-uncalibrated/`; its SHA-256 is
`a19361cf82c222a3fec52c2a0842ae0ec396a871c626d943b997d0467a700489`. It was not relabeled as M0
calibration evidence. M2 must perform its required candidate-delta assessment and remaining matrix
under the accepted reuse rules.

## Evidence and remaining obligations

The archive contains the candidate Git bundle, Windows and Linux command logs, the failed Windows
attempt and successful complete rerun, package manifests and tarballs, production dependency
inventory, installed-tree hashes/modes, M0/M1 manifest provenance, and a repository-wide SHA-256
index with a verification log. Both fixed validation source checkouts were clean after all checks.

Outstanding work remains intentionally unchanged: independent cumulative review against the
then-current integration target, merge-result verification and reviewed merge into
`integration/v0.13.0`, full T13B/M2 performance and readability/system-test/documentation/final
candidate obligations, T13C closure, acceptance-record review, and explicit release authority. None
of those obligations is satisfied or waived by this functional-validation checkpoint.
