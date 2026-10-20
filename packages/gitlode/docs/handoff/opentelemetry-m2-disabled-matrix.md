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

Preparation complete; independent calibration input review pending. No new workload launched yet.
