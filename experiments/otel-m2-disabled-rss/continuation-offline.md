# Diagnostic continuation after offline correction

Instruction checkpoint: 6dc7c3d08def06cf76f99c3612a24ed856586101.
Parent: 4ed4184faf9d97d949afeda369857d4da58c3e2b. Controller only; zero product diff.
Human quiet window: 2026-10-07 14:25–17:25 JST; hard stop 17:25 JST.
Root: /home/t-wakabayashi/gitlode-performance/m2-rss-continuation-20261007T1422.

inspection.mts is the shared complete processing path for offline replay and new runs.
It validates generatedAt existence/type/parseability and exact equality of application
checkpoint to persisted version-2 payload before existing performance normalization.
All semantic fields, JSONL, derived counts, disabled observations and cleanup remain gates.
offline.mts verifies all 102 original archive hashes and preserves corrected derived results
outside sealed evidence. Initial agent assertion about disk version was corrected against
the existing saveStateFile contract, with its failed stage retained. Twelve checks pass.
The original run 2 processing failure is never changed to passed.

Reuse the same original fixture at its canonical absolute path via a new-root symlink,
and the exact fixed runtimes/dependencies/Node. No restoration to a replacement fixture,
generation, rebuild, repack or policy change. Runtime dependency links follow RESTORE.md.
continuation.py gate rechecks original snapshot equality, identities, ownership, fsck,
three inventories and fresh external/fixed deadline cleanup preflights.
Run continuation.py gate once and persist its command success separately. Then runs once.
Ordinals are only 3 V2, 4 V2, 5 V1, 6 V0, no retry. Each execution/processing is 300000 ms,
20 ms sampling unchanged; new total workload budget is 1800 seconds. Commit/push first.

Old V0/V1 and new V2/V2/V1/V0 are separate temporal blocks. New V2/V1/V0 contrasts
are within-window; old/new contrasts and replicate spreads are supporting observations
with cross-window confounding. Retain V1 span-ID and V2 finalization/layout confounders.
No formal measurement, product repair, PR/merge or acceptance change is authorized.
