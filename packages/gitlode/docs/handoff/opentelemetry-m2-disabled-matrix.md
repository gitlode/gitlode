# Remaining Linux disabled comparisons

HQ delegated the remaining four targets on 2026-10-20. Complete qualification/calibration, legacy
capture, disabled comparison, independent review and evidence preservation. Valid fail is a useful
terminal result, not permission to optimize the product. Preserve every unsuccessful attempt. Retry
only with a documented cause and remedy compatible with the unchanged protocol. Return to HQ if
uncertainty stops decreasing or measurement meaning, thresholds, product bytes or scope must change.

Work branch: `feature/otel-redesign_M2_disabled-matrix`, based on the accepted first-target result
`0b0a774f92a4649573a14c546591325cb0a5c968`. Parent branches remain unchanged.

- Product: saved F2 `4ea24d53afc57778addf3f47752e0fe73a7011ea`.
- Baseline: saved legacy `76b124e23fcc069be1278629cf01b62ae1456c7a`.
- Harness: isolated `b00258475004a8d7edb1c00bfa5f3f4d69039a5b`.
- Comparison: `disabled_overhead`, `target_off` versus `legacy_off`.
- Preserve the [first-target valid pass](opentelemetry-m2-f2-first-target.md); do not rerun it.

| Target                                   | Initial total commits | Other fixed quantities           | Existing selection |
| ---------------------------------------- | --------------------: | -------------------------------- | ------------------ |
| commit_heavy_repository / git-cli        |                     8 | files 1, plugins 0, rotations 1  | none               |
| file_heavy_repository / isomorphic-git   |                     9 | files 16, plugins 0, rotations 4 | none               |
| file_heavy_repository / git-cli          |                     9 | files 16, plugins 0, rotations 4 | none               |
| plugin_heavy_projection / isomorphic-git |                     9 | files 4, plugins 8, rotations 2  | none               |

All four need fresh calibration. Quantities count the five base commits. Fixed-harness doubling and
integer refinement, 2 warmups/7 measured runs, 10–30 second eligibility and <=5% MAD remain unchanged.
Explicit manifests/artifacts live outside the harness; no concurrent manifest writers. A manifest
written by calibration is provisional until all pilots, lifecycle links and supervisor cleanup pass
review. Its artifact/environment references must resolve before capture/comparison.

The user explicitly accepted same-PC Linux/Windows dual-copy risk for this work unit on 2026-10-20.
Each copy has a 10 GiB planning boundary, not a prediction of required space; reassess before exceeding
it. No external upload is authorized. Original sealed archives remain unmodified.

New root: `/home/t-wakabayashi/gitlode-performance/m2-f2-disabled-matrix-20261020`.
Mirror: `D:/gitlode_test/m2-f2-disabled-matrix-20261020`.
Reused closure and original archive references are exact-hashed in `inputs/calibration-launch-packet.json`.
The new harness was restored from the preserved archive; 12,187 harness entries, 11,414 product entries
and 1,617 legacy entries matched. No install or product build occurred. Fixed runtime paths remain in
the previous isolated restoration; new TMPDIR and artifacts are separate.

No profile comparison, aggregation campaign, Windows ownership/audit work, product optimization,
release or parent merge is authorized. Linux comparisons are independent of unfinished Windows
infrastructure. Remaining release work will be summarized alongside results, tied to product risk,
not used as an extra prerequisite for these comparisons.

## Current state

Independent calibration input review accepted packet
`ce95d79ca63c72a870fd803d9046a7bd6ede17c8f57de6cdf07da832f6d2664e`.
The commit-heavy/git-cli calibration-01 ended inconclusive after approximately 5 hours 17 minutes.
Twenty-four complete pilots did not finish quantity selection. Preparation of quantity 64,016 exceeded
the unchanged 1,800,000 ms deadline; the operator returned exit 2. This is not an F2 performance fail.
The last completed pilot (64,032) cannot be adopted from an incomplete search. No capture or disabled
comparison was launched for this target, and its manifest still matches the starting manifest.

Terminal supervision confirms process cleanup, no cleanup/finalization errors, and intentional
retention of 25 diagnostic roots. Those roots remain untouched and were additionally archived in both
locations: `retained-roots/commit-heavy-git-cli-calibration-01.tar.gz`, 488,014,311 bytes, SHA-256
`2a5d988f14da92a74a4b9ffe622a7b7673afa52ba72085a86a3ccc829c93ce1e`.
Full attempt sealing is in progress. Intermediate progress snapshots are diagnostic evidence only.

Independent read-only review by `/root/f2_protocol_review` confirms the inconclusive classification.
The preceding six observed preparation intervals were approximately 21.4–23.8 minutes. Sequential
Git/filesystem operations, foreground maintenance and lifecycle inventory are plausible contributors;
the exact cause remains unresolved. The saved late observation shows available RAM/disk and low load,
not proof of a specific bottleneck. Do not retry this target, extend deadlines or resume its history.
The other three targets may proceed sequentially after preservation and capacity checks: no shared
runtime malfunction was established. Linux usage was approximately 6.6 GiB after root preservation,
below the 10 GiB planning boundary. Monitor growth before starting further campaigns.

The user reconfirmed the current work unit's same-PC dual-copy approval on 2026-10-20;
`inputs/backup-reconfirmation.json` preserves that direct answer separately from prior attribution.

## Remaining release risks (proposal, not prerequisites for this comparison)

| Area                                  | Purpose and existing evidence                                                                                                   | Unfinished part / reason to address before release                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enabled performance and report output | F2 enabled package smoke and report/session/evaluator regressions exist.                                                        | Review enabled-versus-disabled measurements and complete signals, diagnostics, size and prohibited spans. Disabled results cannot establish SDK cost or useful diagnostic output.                                      |
| Aggregation growth                    | Built aggregation child and bounded-growth evaluator tests exist.                                                               | N/4N observations and RSS evidence address raw observation retention as input grows, distinct from a short repository peak measurement.                                                                                |
| Presentation                          | Windows Terminal/plain output has human acceptance; excerpts and rendering tests exist.                                         | Focused GNOME light/dark confirmation remains to catch unreadable important values/failure states. Do not repeat accepted Windows trials or add a new sample-tooling gate.                                             |
| Final shipping candidate              | Saved F2 has immutable runtime/package identity and first-target evidence.                                                      | Review actual final source/version/dependency/bundle differences and justify selective evidence reuse. Different scripts/workspaces alone do not require all measurements to be repeated.                              |
| Package validation                    | F2 Linux CLI/API/plugin/schema/typing and lazy-asset boundary evidence exists; later clean layout-CI release validation passed. | Validate the final combined package to detect omitted lazy assets, exports/types or dependency drift. Keep Windows and Linux evidence distinct.                                                                        |
| Windows test infrastructure           | Adopted fixture helpers and the unintegrated standalone launcher have separate evidence.                                        | Resolve handle/settlement uncertainties before adopting the prototype, or explicitly retain limited operating guarantees. Its completion is not a Linux performance prerequisite or proof of a Windows product defect. |

This read-only risk review was supplied by `/root/layout_review` against `9680a407`. Evidence anchors:
[profile integration](opentelemetry-m2-profile-integration.md),
[F2 preservation](opentelemetry-m2-repaired-candidate-freeze.md),
[layout CI correction](opentelemetry-m2-test-layout-ci-correction.md),
[performance contract](../design/telemetry-performance.md),
[standalone launcher boundary](../contributing/windows-standalone-launcher.md), and
[release evidence](../contributing/build-test-release.md).
None authorizes profile/aggregation/Windows campaigns in this work unit or changes release gates.
