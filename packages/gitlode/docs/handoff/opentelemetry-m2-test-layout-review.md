# Test-layout independent review and clean-install validation

## Decision

Recommend integration of this relocation slice. No mandatory implementation finding remains from this review. This is not performance, Windows containment, M2 or release acceptance. PR creation, merge and formal measurement await HQ instructions.

- Fixed reviewed target: `9ed7156de5b4005990eba8ba9eb82edf3d9d6249`.
- Implementation: `5b94157890971f0187098d335f5dd755bc3901d8`.
- Direct comparison base / fixture parent: `942c317d2cad1c850bc75207d7e7333ebbcb07f6`.
- M2 parent: `4f09265791c82452a5800cc6d9855938bf88a46e`.
- Actual remote child tip matched the fixed target before review. Any commit containing this result is documentation-only and is not silently substituted for the reviewed target.

## Independent review

A separate reviewer, `/root/layout_review`, reviewed the full rename-aware fixed diff without implementation edits or test execution. Mandatory findings: none.

- The 63 moved implementation/test/asset paths and two checked configurations have coherent ownership. Performance and launcher infrastructure live in tests/performance; shared Node-only helpers live in tests/support; product regressions remain package-owned.
- Imports, repository roots, child script paths, generated wrapper imports, fixture assets and aggregation bundler cwd preserve their intended resolution. No algorithm, assertion, threshold or product behavior change was identified.
- All 105 original test paths map exactly to the new set, including 17 relocations. Test/suite declarations, parameter cases and skip conditions were reviewed, not merely counted.
- Private workspace declarations and link are added without altering existing dependency resolutions. Product source, public package exports/runtime dependencies/packaging inputs, tests/system and release acceptance have no diff.
- CI, checked TypeScript, lint/format and architecture routes include the new closure. Cross-workspace consumer accounting preserves unused-export checks. Compatibility commands point to the relocated supervisor.
- The fixture manifest and five historical receipts have identical Git blobs. Existing frozen runtimes and external evidence were not changed; historical references are retained.

## Fresh isolated validation

Source for every execution below is the fixed target. Both checkouts were created with Git metadata and no node_modules. They used the unchanged committed lockfile, outside-checkout TEMP directories, and npm ci with lifecycle scripts enabled. No install was performed in the shared working tree.

Before installation, workspace lifecycle scripts and dependency install markers were inspected: no workspace install/prepare hook launches workloads; esbuild runs its binary installer, while fsevents is macOS-only. Neither installation invoked calibration, capture or comparison.

| Check                                                  | Windows                                                          | Linux/ext4               |
| ------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------ |
| Node / npm                                             | 22.23.1 / 11.11.0                                                | 22.23.1 / 10.9.8         |
| Clean npm ci                                           | pass, 325 packages                                               | pass, 326 packages       |
| Lock SHA-256 before/after                              | unchanged                                                        | unchanged                |
| Workspace recognition                                  | pass                                                             | pass                     |
| Development build                                      | pass                                                             | pass                     |
| Performance, launcher and lifecycle strict TS projects | pass                                                             | pass                     |
| Actual Vitest file discovery                           | 105, exactly mapped, no duplicates/missing/extra; 17 performance | same                     |
| Limited shared selection                               | 8 files / 37 passed                                              | 8 files / 37 passed      |
| Actual supervised entrypoint selection                 | not repeated                                                     | 5 passed / 21 deselected |
| Performance workspace lint                             | pass                                                             | pass                     |
| Old and new performance:measure aliases                | expected exit 2 before workload launch                           | same                     |
| Post-validation tracked/untracked status               | clean                                                            | clean                    |

The limited selection covers atomic JSON, calibration projection/artifact processing, mocked launcher protocol/I/O/failure handling, and aggregation bundling/worker assets. It does not run a native Windows launcher campaign. Linux routing uses small synthetic supervisor tests, including retained evidence after teardown; its 21 skips are name-filter deselections, not OS failures.

The safe alias arguments were `--artifacts --invalid`. Source inspection established that this fails before supervisePerformance is called. No help/list assumption was used to start a performance command.

Windows uses an invocation-local byte-identical copy of installed npm.exe per contributor guidance. The existing shared installation and global PATH were not changed. Linux preflight checked Node/npm paths and direct child npm resolution before install/tests. Package-specific platform dependency counts differ normally; existing lockfile resolutions were not updated.

### Operator failures retained separately

- The first Windows limited-test invocation was interrupted by PowerShell treating expected test stderr as a terminating NativeCommandError. Its partial log is retained as limited.log, with no successful result claimed. After adjusting only the verification wrapper's stderr handling, limited-corrected.log records 37 passes at identical source. No product or test edit was made. No matching validation Node process remained after the interrupted invocation.
- The Linux script's last tail command received a CR character in its filename and returned nonzero after validation completed. Individual command exit records, lock comparison and clean status had already been written. Reading the existing routing log confirmed 5 passes; tests were not rerun for this reporting error.
- The earlier copied-dependency Linux npm-PATH failure and successful rerun remain in the original evidence. This clean-install validation supersedes neither historical record.

## Evidence and reuse

- Windows source and new logs: `D:/gitlode_test/layout-review-9ed7156-e50e3a53`.
- Linux source and logs: `/tmp/gitlode-layout-clean-B9QeDs`; log copies are in the Windows archive's linux directory.
- `correspondence.json` records exact discovery mapping on both OSes and revalidation of all 44 prior evidence members.
- Prior manifest: `edb50d034f127177da1af2ca127a18b9cdbe717c87f03039c972203f06812cc9`, under `.cache/test-layout`; all 44 members matched.
- Prior implementation evidence reused: final root lint/format and architecture result (one existing compactness warning, no errors), plus previously reported focused/product tests. These were not newly executed full campaigns. The implementation-to-reviewed-target diff is only .gitignore whitespace and handoff documentation, so runtime/configuration evidence remains applicable. Initial failed/intermediate logs are not treated as successful final evidence.
- Fresh evidence is local only. No independent external backup or upload is implied.
- Fresh `evidence-manifest.json`: 66 members, SHA-256
  `77162c9db5ac9c2067ff0f099b4b7f7f5606788a76c5265848cce2ce2ebd6aaf`.
  All members were rehashed; Linux originals and returned log copies are byte-identical.
  An initial copy-comparison shell quoting error was corrected without rerunning tests.

## Limits and next authority boundary

Full root tests, release/installed-package campaigns, native Windows containment, token/handle audit, fixture eligibility and formal measurements were not run. Distribution safety here rests on unchanged packaging/product inputs, independent boundary review and the clean build/asset tests, not a new release campaign.

Existing Windows ownership/handle-audit uncertainties are unchanged and separate from relocation. Static/mocked launcher checks do not establish runtime containment. No observed relocation regression requires a code correction.

HQ must next authorize integration or any further work. Future use of saved F2 and fixed harness b002584 remains a separate proposal: this review neither restores/freezes that harness nor evaluates product performance. Numeric gates and historical fails remain unchanged.
