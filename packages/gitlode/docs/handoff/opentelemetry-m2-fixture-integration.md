# M2 fixture lifecycle integration evidence

## Status and next human action (2026-10-13)

The fixture child is prepared for human source/base review and squash into
`feature/otel-redesign_M2`. C1/C2/C3 are accepted at the implementation below; trunk accepted adoption
design `29572fe` through checkpoint `d01bcd4`. The actual target is **not adopted**. Qualification,
comparison authorization and release acceptance have no new evidence. External review with exact
hash bindings is the chosen policy; automatic launch preflight, publish archive resolution and release
schema expansion are not assigned.

Durable owners are the [performance adoption contract](../design/telemetry-performance.md#fixture-qualification-and-adoption-review),
[operator packets](../contributing/telemetry-performance-harness.md#operator-review-packets) and
[release dossier mapping](../contributing/build-test-release.md#fixture-qualification-release-review).
This note retains integration identities, attributed validation and unresolved gates, rather than
repeating their normative record graph.

Next: human review of the exact returned source/base/tree and PR proposal. Only after human squash
does trunk verify tree equivalence, preserve child history and separately assign new integrated
harness preservation/restoration/compatibility and pre-eligibility input review. Final release
authority must later approve the qualification dossier's calibration-attestation role. This packet
authorizes no PR creation, merge, parent update, freeze, eligibility, formal/diagnostic measurement
or acceptance-record mutation. Remain on the fixture child.

## Exact history and approved scope

| Role                                                            | Exact OID                                  |
| --------------------------------------------------------------- | ------------------------------------------ |
| Parent M2 / intended squash base                                | `4f09265791c82452a5800cc6d9855938bf88a46e` |
| Fixed F2 product/harness (both preservation refs)               | `4ea24d53afc57778addf3f47752e0fe73a7011ea` |
| Diagnosis / human foreground-policy basis                       | `686ef2cd02ea6a5e6aec5572f31907b26708aa6a` |
| Initial implementation                                          | `c300743efe3971f776f0df4a2bfa3d0ce720e255` |
| Validation correction                                           | `7bba56c14f55b08af36e5d871e5a0e4e3f16c33f` |
| Initial full-suite implementation                               | `741f951b34195b5ba332a688cb9c1950cdbd0baa` |
| Subsequent Windows test-bound correction                        | `c9a1e15c94bb557cd8bed99a4d07d09018bbeae2` |
| Initial delivered slice                                         | `59e9131ed505843bf4b9a2b7a74147838a13cc5a` |
| Independent initial review: corrections required                | `0ae8079a5a5c469dd39b7addf5e5a207acfb0798` |
| Correction base                                                 | `ccdc5bf801d7d2aba724875916ab71b704813a7b` |
| Accepted corrected implementation                               | `503112984d9a524cbfab286a59927f8234545f52` |
| Correction outcome                                              | `98f109e4b49b045759f851c750b3bfcb8e2e4546` |
| Independent focused re-review: C1/C2/C3 accepted                | `a53ade4cac96338a5274d3270694a69248ba4d4c` |
| Trunk correction disposition                                    | `12fda93565dd0b83f49d4be252d4ee86978fddcd` |
| Adoption design                                                 | `29572fe1373410f7903848b7f747ef7ed53b08bc` |
| Trunk contract disposition / this session's starting checkpoint | `d01bcd488bfda24b8f1306a6434fbeab9baab240` |

Historical Git path: `packages/gitlode/docs/handoff/opentelemetry-m2-fixture-lifecycle.md`.
Retrieve the complete superseded assignment/design/review history without restoring it as active
routing:

```bash
git show d01bcd488bfda24b8f1306a6434fbeab9baab240:packages/gitlode/docs/handoff/opentelemetry-m2-fixture-lifecycle.md
```

The same starting bytes are retained in the log archive below. Retain child history after squash;
this session creates no new preservation ref or branch deletion. Historical F2, RSS experiment and
formal failure artifacts remain intact.

Approved policy: foreground automatic maintenance with existing heuristics, attributable logical/
layout/filesystem/cache protocol, and one bounded legacy-only check of historical total 4,430 commits
(five base commits included), files=1/plugins=0/rotations=1/scale=0 for
`commit_heavy_repository/isomorphic-git`. Recipe hash:
`6668bd8a9c032a9d2c9ca2a7aca0a1b7e56055c24b3431e561d3fee156ed738f`.
Legacy revision: `76b124e23fcc069be1278629cf01b62ae1456c7a`; lifecycle protocol:
`foreground-maintenance-inventory-v1`. No renewed-minimality, cold-cache or historical physical-layout
equivalence claim. Thresholds/counts, fresh-target search and product runtime remain fixed.

## Accepted corrections and verification attribution

- **C1:** initial review reproduced saved completed success after disposal refusal and failed rewrite.
  Correction persists a non-success barrier before deletion, retains all roots if barrier write
  fails, and publishes completion only after required disposal. Group cleanup, disposal/per-root
  outcomes and saved terminal evidence remain distinct; recovery is one write without worker retry.
  Two-root partial refusal, final/recovery-write failure, positive disposal and outside sentinel
  cases passed independent re-review. Deleted roots cannot be restored after terminal-write failure.
- **C2:** initial review reproduced filesystem-device and mismatched operation-pair acceptance.
  Correction validates filesystem/digests/unique instance-owned IDs and exact operation/ordinal pairs;
  actual raw-run, pilot, sidecar and requalification consumers derive expected operations from run
  identity. Another child's valid pair is rejected. Independent literal ordinal probe passed 45
  assertions; six negative stored-evidence cases and real workflow/projection consumers passed.
  Nine synthetic requalification pairs derive from one observed pair: stored validation sensitivity,
  not nine live runs or workload eligibility. Historical/aggregation reads remain separate.
- **C3:** initial source tracing exposed repeated failed finalization replacing the primary lock
  cause. Actual correction regressions preserve the primary object/serialized cause, skip second
  finalization and record secondary cleanup errors separately. Five workflow modes cover usable
  storage, unusable lifecycle storage, all storage unavailable, throwing cleanup IPC and throwing
  stderr. Unsafe roots remain; bounded diagnostics promise no universal delivery.

All three and the overall correction slice were accepted independently at `a53ade4`; no optional
implementation expansion or new mandatory finding was requested. The external-adoption enforcement
limits remain explicit operational findings, resolved by the approved manual contract, not by code.

The following results are historical execution evidence, **not executions in this documentation
session**. Linux was native WSL Ubuntu, Node 22.23.1/npm 10.9.8/Git 2.53.0; Windows Node 22.23.1/
npm 11.11.0/Git 2.45.1.windows.1. Linux detached copies used `--no-hardlinks`, reused dependency/dist
copies and explicit development builds. These were disposable validation setups, never new frozen
harnesses or independent dependency installations.

| Owner / source                                   | Commands and result                                                                                                                                                                                                                                                                                                                 | Limits / first failure                                                                                                                                                                                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial implementation `741f951`                 | Ten Vitest suites: Linux 211 pass/0 skips (37.05s); Windows 176 pass/34 skips/1 fail (95.66s). Strict fixture-lifecycle typing, release build/graph, lint/architecture passed.                                                                                                                                                      | Windows comparison hit synthetic 30s command cap. `c9a1e15` raised only test caps to 60s/outer 120s; targeted 1 pass/20 unselected (40.16s). The other 176 were not rerun. Linux full batch does not cover the later delivery verbatim.                   |
| Independent initial review at `59e9131`          | Build:dev + explicit strict typing; ten suites Linux 211 pass/0 skips (34.46s). Windows lifecycle/comparison filter 13 pass/22 skips (42.76s). Lint/architecture passed. Three defect-probe assertions reproduced findings.                                                                                                         | Release build was attributed implementation evidence, not independently rerun. Two Windows skips are Linux-only, 20 unselected.                                                                                                                           |
| Correction working edits toward `5031129`        | Fail-before C1 Linux 4/4 failures, C2 Windows 6/6 failures, C3 Windows 2/2 failures; then corrected cases pass. Linux ten-suite 226 pass/0 skips (47.23s); later lifecycle/supervisor 59 pass (9.25s), final C1 4 pass/35 unselected, all-unavailable 1 pass/25 unselected. Build:dev/strict typing passed.                         | 226-pass batch precedes Windows synthetic setup correction and final diagnostic/assertion edits; not an exact final-source campaign. Windows initial 38 pass/7 skips/1 timeout (141.05s) plus teardown EBUSY remains a failed result.                     |
| Correction Windows                               | Setup corrected from nine real pairs to distinct synthetic pairs based on one real pair: 1 pass/19 unselected (4.25s). Final lifecycle 18 pass/2 Linux-only skips (39.69s); initial workflow 21 pass/5 Linux-only skips; final all-unavailable 1 pass/25 unselected (14.97s). Release build/strict typing/lint/architecture passed. | No test/formal deadline raised in correction round; initial timed-out Git work caused teardown lock. Faster synthetic setup proves no product/eligibility success. Linux root disposal is not Windows evidence.                                           |
| Independent focused re-review at exact `5031129` | Build:dev/explicit strict typing; Linux six suites 139 pass/0 skips/0 outer failures (47.13s); literal ordinal probe 45 assertions. Windows C3 5 pass/41 skipped (55.41s), lifecycle 18 pass/2 Linux-only skips (40.64s).                                                                                                           | Linux six suites: lifecycle, supervisor, workflow, calibration-workflow, production-calibration-artifacts, performance-harness. Prior build/lint/architecture and 226-pass batch were reported-only, not rerun. No full dual-OS/package campaign claimed. |

The initial ten-suite paths under `packages/gitlode/test/telemetry/` were fixture-lifecycle,
performance-harness, performance-workflow, performance-supervisor, performance-process-group,
calibration-workflow, production-calibration-artifacts, repository-sidecar, catalog-contract and
release-acceptance (`.test.ts`). Commands used local Vitest (`node node_modules/vitest/vitest.mjs run`
on Linux / `npx vitest run` on Windows), `npm run build:dev` and
`tsc -p packages/gitlode/tsconfig.fixture-lifecycle.json`. Nested failing retention probes are expected
inside passing outer sensitivity tests, not concealed outer failures.

Other first results stay attributed in historical Git: strict checking exposed previously unchecked
tool/test types; Windows 8.3 TEMP expansion caused ten lifecycle failures before ancestor lstat fix;
synthetic bimodal MAD-zero setup was corrected without changing statistics; old synthetic routing
inputs and absent development worker caused eight failures/100 passes/six skips before setup repair.
Linux shell/CRLF/native-binding setup failures preceded testing; reachable-pack setup corrected an
unreachable object. Lint rejected four non-null assertions before explicit guards. Architecture saw
leftover release chunks before verified generated-output cleanup/development rebuild. A Windows `|`
filter ran no tests; separate filters produced preserved results. Ownership/network/WSL access used
command-scoped Git settings and owner context without global configuration changes. Independent
focused review's final CR status-command failure was followed by a separate clean check.

## Preserved regression logs

New archive: `D:/gitlode_test/m2-fixture-integration-20261013-040c5404b44e`.
`manifest.json`: **24,436 bytes**, SHA-256
`2950f0038c9ab8abb64e6c9f5731fc4c4a272ee51793c3d59bf96cf6f2b136ae`.
The separate `manifest.sha256` pins its exact bytes. All **47 members** were checked for byte count
and SHA-256 against the manifest after source/copy comparison. Previously recorded log hashes match.

Inventory groups retain original absolute source paths and attributed checkpoints:

- `logs/independent-initial/`: five saved logs from `/tmp/gitlode-independent-m2-2oo_wxxr`.
- `logs/correction-round1/`: twelve logs from `/tmp/gitlode-fixture-round1`, including original C1
  fail-before and separately named pre-final/final results.
- `logs/independent-focused/`: four logs from `/tmp/gitlode-focused-review-mlfcPd`, including exact
  fixed-source build/strict/suites and literal ordinal evidence.
- `logs/windows-round1/`: 25 existing `gitlode-round1-*.log` files from
  `C:/Users/t-wakabayashi/AppData/Local/Temp`, including C2/C3 fail-before, timeout/EBUSY, corrected
  and final checks. The historical 8.3 spelling names the same original Windows TEMP location.
- `historical/`: starting handoff bytes at `d01bcd4`.

Missing: `/tmp/gitlode-fixture-final-h8c2MI` exists but has no top-level saved log files. Initial
Windows implementation/independent review outcomes identified no saved log paths; their tool-result
reports remain historical Git evidence. No missing log was fabricated or campaign rerun. This is
regression-log preservation, not a harness freeze, eligibility evidence or external backup. Old sealed
archives were not appended to. Temporary dependency/build copies were not preserved as a new harness.

## Integration correspondence and remaining gates

At start, actual remote child equals `d01bcd4`; actual local/remote parent equals `4f09265`; both
`archive/otel-m2-product-4ea24d53afc5` and `archive/otel-m2-harness-4ea24d53afc5` equal `4ea24d5`.
Parent is the source's merge base. `5031129` to start changes only three handoff Markdown files.
This delivery adds canonical/routing documentation only: implementation/test/catalog bytes remain
equal to accepted `5031129`. Existing attributed validation can be reused on that content basis;
do not claim it was run under the documentation commit or future squash OID.

Run non-mutating `git merge-tree --write-tree <exact-base> <exact-source>` after the documentation
checkpoint; compare the result with the source tree and inspect exact base-to-source inventory.
The fast-forward ancestry makes that merged tree the expected squash tree. The returned packet pins
final source, base, source tree and expected tree externally because this commit cannot contain its
own OID. No checkout/index merge, parent mutation or squash commit is needed. A changed source/base
invalidates that specific rehearsal and requires renewed human review.

Remaining sequence: human integration/tree verification/history preservation; new harness closure
and restoration/compatibility review; independent hash-bound input review; separately assigned fixed
legacy eligibility; independent result/lifecycle/supervision review; explicit trunk target adoption;
reviewed pinned launch authorization; future comparison matrix and final-candidate/reuse/T13C/release
authority approval. F2 runtime and historical failure remain fixed. No target acceptance, RSS cause,
all-target qualification or pending gate is inferred from this documentation delivery.

## PR proposal (not created)

Title: **Bind controlled fixture lifecycle evidence and document reviewed adoption**

Base branch: `feature/otel-redesign_M2`; source branch: `feature/otel-redesign_M2_fixture`.
The exact source/base/tree tuple accompanies the post-checkpoint return packet.

Proposed body:

> Repository performance workflows now preserve per-instance lifecycle inventories and prepared
> copies, bind each CLI/sidecar to its actual operation, retain primary failures, and persist a
> non-success disposal barrier before deleting owned roots. This integrates the independently
> accepted fixture implementation and C1/C2/C3 corrections at `5031129`.
>
> Canonical docs define archived external input/execution review, explicit trunk adoption and pinned
> comparison authorization, with existing schema-1 release dossiers and human release authority.
> They state the manual enforcement limits. No automatic preflight or release-schema extension is
> included. Completed handoff history is consolidated with exact provenance and preserved logs.
>
> Validation is reused from the attributed implementation/independent review on unchanged code,
> test and catalog bytes; the latest independent review ran 139 Linux cases and Windows C3/lifecycle
> checks at exact `5031129`. Historical timeout/EBUSY and earlier pre-final batches remain identified.
> Documentation formatting, local links, diff checks and exact source/base merge-tree equivalence
> are verified in the returned packet. No new full/package campaign or empirical work ran.
>
> After human squash, verify the expected tree and preserve child history. New harness restoration/
> compatibility and input review precede separately assigned eligibility; actual target adoption,
> comparison and release gates remain pending. F2 runtime, historical failures and live acceptance
> are unchanged.
