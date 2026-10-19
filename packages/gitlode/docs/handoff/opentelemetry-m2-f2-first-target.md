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

Formal execution has not started at this preparation checkpoint. Input review and a quiet-window
observation precede eligibility; independent evidence review and exact-hash trunk adoption precede
capture/comparison. The user backup decision is already resolved for this unit.
