# M2 profile integration evidence

## Completed profile integration ? 2026-10-02

PR #113 was human squash-merged at `c29376b0b771efac9d736cb5315ae3d1d303984f`, parent
`12b43f911ff9d9e1c9ecab09faa0148b3db2dbe6`. Trunk checked GitHub merge state and local/actual remote
M2 equality. Tree `4b9cfc312944b257799465e6ea77e2103d7fe658` exactly equals reviewed source
`a2de670213c1791127a63b1ff8c541e512ea743b`; no new product delta requires repeated validation.
Local/remote `archive/otel-m2-profile-a2de670` preserves all profile review checkpoints. The human may
now delete the profile work branch; retain that archive and `archive/otel-m2-styling-1d97c99`.
The preparation records below are historical evidence, not pending PR instructions. M2 and release
acceptance remain open; continue with system-workspace design in the recovery plan.

## Disposition and fixed inputs

Profile P1/P2/P3 and styling are complete; cumulative functional/package validation is complete.
This is profile-to-M2 integration preparation, not final M2 or release acceptance. Follow the
[M2 continuation plan](instrumentation-opentelemetry-recovery-plan.md) for remaining gates.

- Entry source: `feature/otel-redesign_M2_profile`, `acebf5b5e56f37dde39672f3715d7b6c9bb8661b`.
- Intended base: `feature/otel-redesign_M2`, `12b43f911ff9d9e1c9ecab09faa0148b3db2dbe6`.
- Validated candidate: `f4d90d1ce1828c2f06abc9684bcc10006b09e7cd`, tree
  `d68714d0b1e4b4c7820f71d12349b2817c190291`.

On 2026-10-02 actual remote, local and tracking refs matched both entry OIDs. One clean worktree
was on profile. Base and candidate are ancestors of entry source; candidate-to-entry changes are
only three handoff documents. Base has not changed. The documentation checkpoint containing this
note supersedes entry source for the proposed squash; its full OID and resulting tree are returned
to trunk after commit. Shared base refs remain unchanged.

Read-only ancestry checks and `git merge-tree --write-tree` establish a conflict-free merge with
the unchanged base, whose resulting tree equals source. Because base is an ancestor, the intended
squash has that same source tree and a new commit parented by base. Candidate-to-checkpoint changes
remain confined to handoff documents; no production/test/config/package delta needs extra validation.
Recheck actual source/base immediately before human integration if either ref changes.

The accepted design checkpoint is `d87bfd6fb8d4e874bb78424111f21f78fd6c9a6d`, preserved at
`archive/otel-m2-profile-design-20260918`. Canonical contracts already own the implemented design:
[telemetry](../design/telemetry.md), [report catalog](../design/telemetry-catalog/profile-report.yaml),
[view catalog](../design/telemetry-catalog/profile-view.yaml),
[verification](../design/telemetry-verification.md), [CLI styling](../design/cli.md) and
[profiling interpretation](../profiling.md). No design contract is changed by this cleanup.

## Accepted implementation and squash mapping

P1 is accepted at `dc6cfbd69e99cbf13ba6ef4191a123ef182627b5`, with independent re-review
recorded at `8ea9cfca2fb0cb7ab6455d9805cc1479ff19e932`. All four corrections and preprocessing
hardening were accepted; the reviewer independently ran build and 7 files / 112 tests. This is
primitive acceptance, not runtime or M2 acceptance. P2 is accepted at
`755e7d34f3d0ea56c7346ce009ec7d7624bab32c`, with independent acceptance recorded at
`4ba32fad97897f00adafe9275e7fb9bd589f6b8f`. All R1-R4 and actual transport obligations are accepted;
157 focused tests, build and strict tooling checks were independently verified in the final review.
This closes the runtime/consumer slice, not the complete profile or M2 acceptance.

P3 implementation is accepted at `c694b69cc964226ccbf07325ee45ab32b6ff2e74`, recorded by independent
review at `1a012d589604c6e570e155b3aa49a6d31a038f5d`. R1-R4 are closed; build, strict tooling and
nine suites/75 tests were independently verified. P1/P2 remain accepted. This is implementation
acceptance, not human terminal/cumulative/M2 acceptance.

The CI/duration correction `d9e994cc28bc91b9ca86f3a3e6e798371ec85481` is accepted at
`aab058e0b0507fc599a2aae7b2cd4474ea3043ce`. Shared styling, flat default layout,
compact unit tokens and renderer extraction were reviewed at `f055885`; the sole test-stub correction
`0256c71` was accepted by trunk. Supervisor cleanup correction `97cab518` was independently accepted
at `68daa1f`. This note and the [remaining observations](opentelemetry-m2-profile-observations.md)
preserve attribution; the completed styling packets remain in Git at the entry source.

PR #112 was human squash-merged into profile at
`f4d90d1ce1828c2f06abc9684bcc10006b09e7cd`, parent
`76486d25870172528ce9af086ace756388b6c8d8`. Trunk verified GitHub merge state and actual remote/local
profile equality. Its tree `d68714d0b1e4b4c7820f71d12349b2817c190291` exactly matches source
`1d97c9941f87bff6013ee411800f70ee91b42e5a`. Local/remote archive
`archive/otel-m2-styling-1d97c99` preserves that source and all reviewed ancestors. The human may
now delete local/remote `feature/otel-redesign_M2_styling`; preserve the archive. No branch was deleted
by trunk. Equal trees preserve content attribution, not rewritten measurement ancestry.

A future profile-to-M2 squash must record its resulting OID, parent and tree correspondence to the
reviewed source. Equal trees preserve content attribution, not original measurement ancestry. Do
not relabel candidate evidence under a squash OID or update acceptance records here. Preserve
source/archive identities until human-authorized branch retirement.

Historical real commit/file/plugin CLI excerpts were captured at
`737f36338e45e08fbfed2095dcd2a81c5f09098d` and remain in Git in
`opentelemetry-m2-profile-p3-real-output.md`. They are runtime excerpts, not final terminal or
performance evidence. Retired capture/display helpers remain in Git at `a4bb707`; their commands
are not current instructions. Completed correction rounds and display trials remain in Git at the
entry source; they have been removed from the live handoff set.

## Human display acceptance and limits

On 2026-10-02 the human confirmed completed sample and real-repository checks suffice for integration.
Do not restore sample generation or additional manual display confirmation as an integration gate.
GNOME light/dark remains an explicit pre-release check, preferably before candidate freeze. A reusable
dummy-data sample is future maintenance tooling, not an integration or release gate.

Human environment: Windows Terminal 1.24.11911.0, Campbell/Tango Light, Cascadia Mono; plain text also
used. Bold mainly changed brightness, not weight. White/brightWhite values failed on light backgrounds;
plain values, padded headings and C's related cyan backgrounds were adopted. Yellow on light was
previously somewhat weak; no isolated final re-evaluation is recorded. Exact widths/intensity settings
and separate final shared-progress/diagnostic results are not recorded. Overall Profile approval must
not be expanded into evidence for unobserved roles or terminals.

GNOME Tango dark/light remain unobserved. The human authorized Windows/plain-first work and did not
request a VM. Return this gap to trunk; WSL within Windows Terminal is not a second renderer.
The human owns real repository preparation/selection; do not prepare or record repository identities.

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

## Saved evidence assessment for integration

This preparation read the saved runners, command results, full validation/package logs, source
mapping, production configs, final source states, package bindings, transfer verification and skip
inventory. All 77 manifest entries were checked for size/hash and the recorded manifest hash matched.
Seven assigned product commands per platform have exit 0, with no fired deadline. Logs confirm the
reported suite totals, strict publint and installed-package coverage. Source states are detached and
clean at the fixed candidate. Pre/post package hashes and transferred Linux bytes agree.

Windows skips enumerate 23 Linux process-supervision cases and three supervised-workflow cases,
including parameter counts; all execute on Linux with zero skips. Clean initial checked production
`tsc -b` and configs without production `noCheck` support production typing; the separately named
gate-tooling typecheck is not a substitute. No concrete cumulative-packet omission was found, so no
product/package commands were rerun. Native Linux artifacts were assessed through their hash-verified
Windows mirror, not by rerunning Linux. Historical failure and display limits remain in the
[remaining observations](opentelemetry-m2-profile-observations.md).

## Integration proposal and next work

Suggested PR title: **Integrate M2 profile schema v2 and shared terminal styling**.

Suggested description: Introduce bounded profile diagnostics and measurement availability, propagate
the schema-v2 report through collection and worker delivery, and use generic Scope/name presentation
with shared terminal styling. P1/P2/P3 and corrections are accepted; saved Windows/Linux cumulative
validation at `f4d90d1` passed, and the proposed source differs from that candidate only in handoff
documents. Release acceptance remains blocked pending tests/system, T13B, GNOME, final candidate
validation and T13C; historical ENOTEMPTY and Windows timeout/EBUSY remain unresolved.

After human profile squash, verify its exact source/base/tree mapping before preparing the private
`tests/system` design/migration/review packet from the accepted M2 tip. Preserve commands, checked
TypeScript and dependency boundaries; distinguish migration-only acceptance tooling from lasting
regression checks and retain current gates. The new packet must fix base, bounded first release-CLI
workflow scope, exclusions, checks and exit evidence. No broad test move is pre-authorized.
