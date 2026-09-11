# M1 evidence retained for reintegration and M2

## Scope and accepted inputs

M1 integration is reopened after the human reset; see the [recovery plan](instrumentation-opentelemetry-recovery-plan.md).
This note preserves evidence needed for reintegration and candidate-delta assessment. It does not
attribute old runs to the new T13B tip or accept T13B/M2/T13C and publishing.

- Domain-local placement was independently accepted at `97235c37a518c829170568f9c32d5ffe2318803b`:
  ten exact renames, unchanged recording behavior and exports, and contributor routing.
- Gate G1/G2 and cumulative Windows/Linux validation were accepted at source/harness
  `681a1a5b53bd0aa957dae72d9fd9684da7ff467a`. Obligations and provenance remain canonical in
  [build/test/release guidance](../contributing/build-test-release.md); the live record stays blocked.
- Archive: `D:\gitlode_test\m1-20260911T052245Z-681a1a5`. Planning independently verified all
  40 `evidence.sha256` entries and manifest SHA-256
  `7454ed104bfeb89ce401ff88156e5a261fd22c64608a21d1dce94119c2e4bb08` at the original acceptance.
- Candidate transfer bundle SHA-256:
  `0ac433cd98f3f3a3a44c81fa8dc444474d07866b93150d9476dff0e4de1fab73`.
- Candidate source lockfile SHA-256:
  `f8808ceec4f64f5e6b7ba46d88804929d54e1ae0e8576e5da77237a0f3647ba7`.

## Reversed integration and retained CI correction

The old reviewed integration source was `134e475b2de9559007e11fb724298395f832c6cf`, a fixed
validation checkpoint. Its difference from the later T13B tip `50159a6...` was five handoff files,
with no implementation/package delta. Review accepted cumulative behavior and the rehearsal tree
`619c389da8a12e36fa8465a611a0c8f28eaad0ea` against base `1664798...`. The old merge
`506b657...` used that tree, but directly pushing it bypassed the PR and required-check rules.
That deviation was disclosed; the human subsequently reset integration and now owns every merge.
The old rehearsal does not replace review of the new multistage merge results.

[Initial integration CI](https://github.com/gitlode/gitlode/actions/runs/34570108403) failed because
gate tests inherited `GITHUB_ACTIONS` and `GITHUB_REF` from the runner, rejecting temporary Git
repositories before their intended assertions. Commit `a6a7073f09231df94e1275b237e3bb276b591c03`
isolated these variables with Vitest lifecycle hooks and retained explicit Actions-context tests.
Production gate conditions and publishing wiring were unchanged. Historical verification includes
50/50 focused tests under both integration and PR environments and
[PR CI](https://github.com/gitlode/gitlode/actions/runs/34570822554) with 91 files / 1,201 tests,
release build, publint and installed-package validation passing. These are historical run results.

Recovery reapplies only that test-file change on `50159a6...`, not the old commit's integration
closure documents. All post-reset validation belongs to the new checkpoint; old M0/M1 archives
must not be overwritten. The archived pre-reset tip is `b446834...`, named by the recovery plan.

## Recovery step 4 validation

The test correction is checkpointed on T13B at `7dc4ca7`, based on `50159a6`. Its test file is
byte-for-byte identical in Git content to the previously CI-validated `a6a7073` file. In this recovery
session, all 50 focused gate tests passed with inherited `GITHUB_ACTIONS=true` under each of
`refs/heads/feature/otel-redesign_T13B` and `refs/pull/999/merge`. Explicit Actions-main/non-main
cases remain in the suite. Strict validator typecheck and root/workspace lint passed.

The complete difference from accepted `681a1a5`, excluding documentation and that one test, is empty.
Thus production, packaging, dependencies, workflows, harness implementation and acceptance record
retain the previously validated inputs. Full Windows/Linux suites and installed-package checks were
not rerun here; the prior two-platform evidence and historical fixed-file CI run above are reused
with this explicit delta. No formal measurements, archive rewrites, PR creation or merge occurred.

Completed handoff packets were consolidated into four telemetry continuation documents. Removed-file
references and local Markdown links were checked repository-wide with no remaining broken links.
Root format write/check and diff whitespace checks are required before the documentation checkpoint.
The first PR base was read directly from the remote as `feature/otel-redesign_T13` at
`06136491676e71298c7d5488d3df8ed6a4e5b6bd`, which is an ancestor of the prepared T13B tip. Recheck
it before creating the human-authorized PR. The cumulative PR includes earlier M0/M1 work as well
as this recovery delta; this paragraph is not a claim of a new independent cumulative review.

## Environments of the original validation

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

## Remaining acceptance

Confirm the prepared T13B diff, then obtain explicit permission before creating the T13B-to-T13 PR.
The human merges each stage. Verify each actual result, preserving the integration base's existing
link change. Only final integration closes M1 again. Full T13B, M2 presentation/system-test work,
final candidate validation, T13C and release-authority acceptance remain outstanding.
