# Saved RSS diagnosis evidence (2026-10-06)

This is derived evidence, outside the sealed archives. No product execution is performed by these
scripts. Run from the repository root with Python 3.8 or later:

```text
python packages/gitlode/docs/handoff/m2-rss-diagnosis/analyze.py
python packages/gitlode/docs/handoff/m2-rss-diagnosis/inspect-code.py
```

`analyze.py` optionally accepts the archive parent instead of `D:/gitlode_test`. It reads the six
original capture/comparison artifacts and six terminal supervision artifacts. It checks every
consumed artifact against its archive manifest; `derived.json` preserves their byte lengths and
SHA-256 hashes and manifest identities. This is consumed-input verification, not a new verification
of every unrelated archive entry. No original evidence is modified.

`trajectories.csv` retains all 81 runs: 27 capture runs and 54 disabled runs, including 18 warmups.
Statistics in `derived.json` exclude warmups (seven measured runs per series). CSV rows retain source
series order; `eventElapsedMs` orders children within each attempt/stage using the saved supervisor
execution event. Every run matches exactly one execution event. Pair indices are zero-based and
events use one-based iteration. Baseline-first A-B and candidate-first B-A alternate for both
warmup and measured pairs.

Times and bytes are saved without deliberate rounding. First/last samples mean available samples,
not initialized idle RSS or RSS after process exit. Peak times are relative to the sampler's start,
slightly after spawn; wall time starts before spawn. `above95PeakMs` and
`longestAbove95PeakMs` use a left-held estimate between consecutive samples at or above 95% of that
run's sampled peak. Unsampled initial/final intervals are excluded; these estimates are descriptive,
not continuous measurement or new gates. Five equal wall-time bins retain median sampled RSS;
bin boundaries have no inferred product-phase meaning. Original full samples remain in the archives.

`inspect-code.py` reads fixed/legacy Git blobs and hashes both F runtime archives. It streams their
bundled JavaScript without extracting into the archives or executing it. `code-identities.json`
retains exact member hashes/sizes and navigation-token counts. Review copies go only to ignored
`.cache/m2-rss-diagnosis`; token presence alone does not establish execution or memory allocation.
The source revision and the actual imports/branches were also read manually. The inspected source
matches the fixed revision; current HEAD is not substituted for the measured candidate.

M0 candidate/harness are `a97829b`/`a53a5b8`; both M2 attempts use `8fffcc0`/`8fffcc0`.
All three use legacy `76b124e`. These are separate evidence populations and are never pooled.
The [diagnosis in the routing document](../opentelemetry-m2-first-target-measurement.md#disabled-rss-failure-diagnosis-2026-10-06)
owns the findings and the proposed next decision.
