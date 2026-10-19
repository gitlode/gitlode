# F2 first-target Linux performance judgment

HQ delegated the complete first-target work unit on 2026-10-19: preservation/restoration, input
review, fixed-quantity eligibility, legacy capture, disabled comparison and independent result
review. Valid pass or valid fail completes this unit; inconclusive remains a separate result.
Routine stage approval and one-failure stopping rules in historical handoffs are superseded.

- Parent fixture: d458300cea9de9609e42b6335374d7764d2b3675, PR #117 integrated; CI 39220679971 success.
- Work branch: feature/otel-redesign_M2_f2-first-target. Parent refs remain unchanged.
- Saved product F2: 4ea24d53afc57778addf3f47752e0fe73a7011ea.
- Saved legacy: 76b124e23fcc069be1278629cf01b62ae1456c7a.
- Independent fixed execution harness: b00258475004a8d7edb1c00bfa5f3f4d69039a5b, old paths inside its isolated checkout.
- Target: commit_heavy_repository/isomorphic-git; start at 4,430 total commits, not a new smallest-quantity claim.

Windows runtime/audit work remains on hold. No profile comparison, quantity search, other matrix,
product improvement, threshold change, release or parent integration is implied. Runtime bytes and
resolved dependencies remain frozen. Any local harness fix needs a separate identity and independent
review; measurement meaning changes return to HQ.

## Preservation and preparation

User explicitly accepted same-PC dual-copy loss risk for this work unit on 2026-10-19. This is not an
external backup or an upload authorization. Originals remain sealed and untouched.

F2 archive at D:/gitlode_test/m2-freeze-4ea24d5-20261008-f2 and its Linux archive copy: manifest
20ee1498e139e27d9044468e541f2d68251c8a5e9df3d99e958f608795305fee; all 628 members in both copies
rehashed successfully. Restored full product 11,414 entries and legacy 1,617 entries match original
inventories, including symlink targets. No product build or install occurred.

Working Linux root: /home/t-wakabayashi/gitlode-performance/m2-f2-first-target-20261019T084700Z.
Windows mirror: D:/gitlode_test/m2-f2-first-target-20261019T084700Z.

Harness source is a separate clean checkout of b002584, with preserved F2 execution dependencies and
workspace dist copied without installation/build (source/lock/dependency contracts unchanged).
The new harness archive has 12,187 inventory entries; separate restoration matches before/after.
Archive SHA-256: 7466ab826905f6da3151ea8dc051514b32dcd9e26efe715bb23979d72052f6a4.
Restored supervisor/process-group limited tests: 48 passed. These are restoration checks, not formal
performance results or Windows containment evidence.

Node 22.23.1, npm 10.9.8, Git 2.53.0 and kernel match historical M0. Actual fixture/output/TMPDIR
are homedir ext4. Original M0 environment.sh/readiness supports homedir ext4; the later F2 preparation
/tmp tmpfs is not the historical calibration environment. The formal environment fingerprint does
not encode filesystem identity, so external review records it explicitly. Reported total memory is
4,096 bytes higher than the historical fingerprint; no numerical acceptance criteria change.

## Execution records

Exact-byte input packet, independent review, eligibility, adoption, later launch packets and every
attempt remain separate records under the new root. Retain failed/inconclusive runs; do not select
favorable attempts or overwrite snapshots. `HistoricalSelection.protocol` is an explicitly reviewed
retrospective description of the old maintenance procedure, not an invented historical version field.

The preparation checkpoint preceded formal execution. Subsequent records below supersede that
preparation status; the original checkpoint and all input packets remain preserved.

### Fixed-quantity eligibility and adoption

The initial operator setup stopped before any CLI launch because it attempted to overwrite an
identical read-only manifest in the mirror. The operator now skips identical bytes and preserves
changed prior metadata. This was a zero-workload setup failure, not a measured retry or harness change.

Eligibility attempt 01 completed with two warmups and seven measured legacy runs. Median wall time
was 26,080.74694299999 ms; MAD was 622.8513160000002 ms (2.3881651754884728%). The 10–30 second
window and 5% variation limit passed. All 20 fixture boundaries matched; supervision completed with
cleanup confirmed and no cleanup/finalization errors. Independent saved-data review accepted the
result, and trunk adopted 4,430 commits without a renewed smallest-quantity claim.

- Eligibility artifact SHA-256: da923d669da0ccb3fd733db38fefd847f90b8a2f1e9ddea681f0238a06f62c02.
- Eligibility seal: 73 files, SHA-256 ead9e8a1cf097e0fd24c32f7d931be21bf74edc0a5c9d667e7904136076c0cca.
- `inputs/fixture-adoption.json`: 2988d3262563aaac33c18ec08f71ff05a5414e9578b583d0d611c27e3a562e57.
- New `inputs/adopted-manifest.json`: aead6a6c13cb364580ce005e0de329d3581699216930c2ade777e45272b86687.
- `inputs/capture-disabled-launch-packet.json`: 2a9f2bbc19c3f75121559146265e65cebb0a5d3f908bd9ff9394b99fd27e9b81.

The independent input reviewer rehashed 43 reference occurrences and accepted capture, with disabled
comparison conditional on a separately reviewed valid capture. Historical manifests remain unchanged.

### Legacy capture

Capture attempt 01 completed with nine legacy runs and formal behavior/sidecar pass. Supervision
completed, cleanup was confirmed and cleanup/finalization errors were empty. The 73 artifact files
were copied and rehashed on both filesystems; seal SHA-256 is
35265097cc1502fdf56c52873c3d0a83473780d940fd2925abe9673cbd9aa3a1.
Independent capture execution review accepted the nine raw/embedded runs, 20 fixture boundaries,
42-entry prepared copy, adopted inputs and cleanup. Median was 24,384.34527400002 ms, MAD ratio
0.48298945358839695%. All seven measured normalized outputs contained 4,430 records and 1,974,468
bytes, with JSONL hash c56611ecd521ac3ac605b2fc383bc7daeefe4f2c065281dfc88d4ec4891f5241.
The exact-hash review is saved as `inputs/capture-execution-review.json`.

### Disabled comparison attempt 01

The fixed supervised path completed two warmup pairs and seven measured pairs, alternating order,
without a retry, threshold change, deadline extension, product rebuild or dependency update. The
formal artifact reports pass for performance, behavior and sidecar evaluation (disabled sidecars
are not applicable). Independent final review accepted a **valid pass**, recomputing the metrics,
matching all 18 raw runs, 38 fixture boundaries and 14 measured behavior records, and confirming
the stored evaluator/link validator and clean supervision. No workload was rerun for that review.
`inputs/disabled-execution-review.json` has SHA-256
e844ac7b13ba332e288604966fd5ca2af565286cb294ef26c0e8620e1426cbc6.

| Metric                            |                Legacy |                     F2 | Existing criterion/result                             |
| --------------------------------- | --------------------: | ---------------------: | ----------------------------------------------------- |
| Wall-clock median                 | 25,999.76262699999 ms | 25,594.379026999988 ms | Paired-ratio overhead -2.0406463250650986%; limit +5% |
| Wall-clock MAD / median           |   0.4743750193779183% |    0.8937960548239905% | Each <=5%                                             |
| Median of measured child peak RSS |     187,236,352 bytes |      185,483,264 bytes | Increase -1,753,088 bytes; limit 9,361,817.6 bytes    |

The wall-clock gate uses the median paired ratio, not the ratio of the two displayed medians.
The RSS allowance is max(8 MiB, 5% of the legacy median peak). Sampling uses the unchanged 20 ms
external child-RSS collector. Harness memory is not included.

The 109-file comparison seal has SHA-256
78d6213e7faafdd058ce7439432efc9008d83e246d4c1d919c11b0ca0d154f62.
Supervision completed with cleanup confirmed, empty cleanup/finalization errors and exit 0.
Postflight rehashed product 11,414, legacy 1,617 and harness 12,187 inventory entries: no mismatches.
Harness HEAD remains b002584 and its Git worktree is clean. No measurement process or fixture remains;
TMPDIR retains only tsx and Node compilation caches, which are not fixture roots or measurement evidence.

The final `evidence-manifest.json` seals 323 files / 130,687,694 bytes (plus the manifest), including
input/adoption/review packets, all three stages, operator failures, logs, scripts and the independently
restored harness archive. Every member was rehashed in both Linux and Windows copies.
Manifest SHA-256: 60b5fe2024b4b5f8cb8ee02097d7e565b106221aeccc20eaeee1ef7293fb6fcc.
The original F2 archive remains a separately sealed dependency of this evidence, not rewritten here.

This completes the delegated first-target work unit. Qualification, capture and comparison each used
one measured attempt; the earlier operator copy failure launched zero CLI workloads. Review-only
helper invocation errors were corrected against saved data and did not create measurement retries.

### Interpretation and remaining decisions

This is one commit-heavy, isomorphic-git, 4,430-commit comparison on Linux/ext4 under WSL2, using the
foreground-maintenance/inventory protocol. It represents quiet bundled CLI extraction with warm-cache
effects from inventory reads. It does not establish cold-start behavior, all repository shapes, Git CLI,
plugin-heavy workloads, Windows performance, enabled profile cost, bounded growth or full-matrix
acceptance. The lower observed values do not establish a general speedup or prove the attribution of
the earlier RSS regression. F's historical RSS fail remains unchanged; F2 is a distinct saved candidate.

Windows launcher/ownership/handle work is still separate and unfinished. No release gate or acceptance
record was changed. HQ next decides whether to authorize further comparisons/matrix work and how the
remaining release obligations should proceed. Product optimization and profile comparison do not
follow automatically from this result. The user-approved same-PC double-copy risk applies only to
this work unit; this archive is not an independent off-machine backup.
