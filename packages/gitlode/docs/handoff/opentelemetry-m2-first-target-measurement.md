# M2 first fixed-candidate target measurement

## Current routing: bounded diagnosis, no new measurement

Trunk reviewed outcome `4f42f1184ded2a73ae6f6b950805b2924aaeb5cc` and rehashed the returned
549 entries plus manifest with no mismatch. Capture pass and disabled inconclusive are retained;
profile remains unexecuted. This is evidence review, not performance acceptance or a new run.
Formal candidate MAD is 6.428 percent, over the unchanged 5 percent limit.

Measured baseline/candidate seconds by pair, rounded only for this explanatory table:

| Pair | Order | Legacy | Candidate |
| ---- | ----- | -----: | --------: |
| 0    | A-B   | 26.668 |    26.794 |
| 1    | B-A   | 27.317 |    27.277 |
| 2    | A-B   | 30.168 |    29.937 |
| 3    | B-A   | 30.554 |    31.523 |
| 4    | A-B   | 30.042 |    31.040 |
| 5    | B-A   | 30.166 |    29.151 |
| 6    | A-B   | 27.189 |    27.330 |

Both series move together across the attempt. This supports investigating common temporal variation,
not attributing the failure to Windows/WSL, thermal/power policy, background tasks or the product without
evidence. Small paired ratios do not override the catalog's absolute stability gate. Historical M0
and current timing differ; reuse compatibility is not proof of stationarity during this attempt.

### Next session packet: saved-evidence diagnosis only

Start from the M2 documentation checkpoint delivering this section, with outcome `4f42f11` as its
ancestor. Read the outcome below, performance catalog/evaluator, F compatibility assessment and M0
calibration evidence. Use fixed harness/product `8fffcc0` for code interpretation, not current tip
as a replacement source. No child implementation branch is needed; shared checkout stays on M2.

1. Independently recompute median, MAD, paired ratios and reason classification from original numeric
   runs, separating warmups from measured pairs. Check pair indices/order and timestamps against
   saved progress; do not sort away chronology, discard samples or invent a different acceptance rule.
2. Compare capture, disabled warmups/pairs and historical calibration/measurement durations. Inspect
   actual filesystem/runtime/environment evidence, sampling/launch changes and available resource
   observations. Verify calibration reuse assumptions and clarify the 10-to-30-second calibration
   criterion versus comparison-stage duration rules in the existing evaluator. Do not change either.
3. Rank concrete hypotheses with supporting/contradictory evidence and missing observations. Limit
   this to saved data and relevant code; no benchmarks, stress tests, calibration, profiling campaigns,
   OS-setting changes or broad host scans. Unknown cause is an acceptable diagnosis outcome.
4. Recommend one bounded next action: a specific correction if proven, or one controlled fresh attempt
   with explicit preconditions and minimally intrusive external observations if justified. Explain
   what it can establish and what failure would mean. Do not execute it; trunk decides retry authority
   and dependent-stage routing. Do not make external measurements part of the timed product path.

Append a concise diagnosis here and preserve derived tables/scripts outside sealed archives with
source artifact identities. Keep original results unchanged. Commit and normally push documentation
only on M2 after checking ref movement; report exact final OID/remote equality and clean status.
No full tests, installs/builds, PR/merge, new candidate, threshold/recipe changes or acceptance updates.
Avoid a generic infrastructure project or attempting to prove every possible cause. Historical
ENOTEMPTY/EBUSY and existing TypeScript errors are outside this diagnosis.

The measurement instructions below are completed attempt history, not permission to run again.

## Authority and fixed inputs

This separate human-started session performs formal measurement only, with no implementation repair.
Workloads, preparation and repeated measured runs take substantial time independently of model
reasoning. Announce stages, observe progress and deadlines, and return evidence instead of waiting
indefinitely. Trunk reviews the result; completing this packet does not accept full T13B or M2.

Product/harness: `8fffcc0d8e11bb061d70bf870f262092d559c5f2`.
Legacy: `76b124e23fcc069be1278629cf01b62ae1456c7a`.
Target: `commit_heavy_repository/isomorphic-git`, 4,430 commits.
Calibration recipe hash: `6668bd8a9c032a9d2c9ca2a7aca0a1b7e56055c24b3431e561d3fee156ed738f`.
Trunk authorizes the historical M0 calibration reuse under the conditions below, not old measurement
acceptance. This target is the first part of the complete matrix, not a replacement acceptance gate.

Read F outcome/disposition, M0 result, recovery plan, performance contract/catalog and harness guide.
Sealed inputs: `D:/gitlode_test/m2-freeze-8fffcc0-20261002` and corresponding native Linux archive.
Manifest SHA-256: `738b6a16a9c1c08fad90f5993ede2f7b6a872865b9e91c3f37817d423ea3e7ea`.
Use RESTORE.md and the preserved closure inventories; restore into fresh Linux execution areas.
Do not install, rebuild, update dependencies or modify the fixed runtime/source. Mutable workflow
outputs, external TMP/cache, command logs and copied fixture manifests stay outside sealed inputs.

## Before measurement

- Verify source OIDs, runtime/CLI/worker hashes and dependency closure against F. Candidate CLI hash
  is `f6592528e2ccb7902ddbe96d67c3f27517454b840a3867f98dbf56dfac1f76de`; legacy CLI hash is
  `379ed9dca9c25c2a7715371f3c64631317c98a3c2dd7a55f64bcbbac3cca5779`.
- Preflight the selected external launcher on a disposable case before long work. Keep its limits
  distinct from harness stage limits. Outer group termination does not prove detached harness groups
  stopped; inspect supervisor terminal evidence and owned identities, never broadly kill processes.
- Recheck actual Node/npm/Git, CPU/OS/kernel, competing workloads and filesystem class against M0.
  The F compatibility function is not a filesystem/load check. Use Linux-native storage and a short
  external TMP path; inspect the old M0 setup to confirm the timed fixture's filesystem class.
  Do not inherit F's build-only tmpfs TEMP blindly. If actual compatibility cannot be established,
  return before workload execution with the discrepancy; do not silently recalibrate or override it.
- Copy `inputs/m0/manifest.json` and its referenced calibration/environment artifacts into a new
  execution input area with references resolvable. Keep the original manifest bytes/hash and quantity.
  Four targets remain incomplete; do not invent a global sealed hash. Preserve the M0 harness OID
  on calibration provenance and record the new harness separately on new results.
- Save explicit absolute command paths and chosen deadlines before execution. Use the canonical
  supervised `performance:*` entrypoints from the detached fixed harness. Existing default stage
  deadlines apply unless a reasoned override is recorded before the first attempt; never increase
  limits automatically after failure. Do not run duplicate workloads concurrently.

## Authorized sequence: one attempt per stage

Use the harness guide's commands with explicit `--manifest`, `--fixture commit_heavy_repository`,
`--adapter isomorphic-git`, `--artifacts`, and the applicable absolute CLI/revision arguments:

1. `npm run performance:capture-legacy -w gitlode -- ...`
2. `npm run performance:measure -w gitlode -- --comparison disabled_overhead ...`
3. `npm run performance:measure -w gitlode -- --comparison profile_overhead ...`

Each stage gets a fresh artifact directory. Advance only after its required formal evaluation and
supervision both pass. Inspect completed/exit status, cleanupConfirmed/errors, persistence results,
behavior, sidecar/schema-v2 quality, wall/RSS and catalog requirements; command exit zero alone is
insufficient. Profile comparison uses the same new candidate for target_off and target_on.
Retain all raw warmups/measured runs, quantities, recipe/environment identities and formal artifacts.

On fail, inconclusive, timeout, abnormal exit, drift or missing evidence, preserve the first attempt
and stop dependent stages. Report classification, last stage/progress, owned process state and
diagnostic paths. No retries, threshold/recipe changes, selection changes, source fixes or resumed
partial attempts. The absence of repeated calibration does not waive duration/stability checks in
the actual evaluation. Clearly identified pre-workload setup errors may be corrected with original
logs preserved; once a workload starts, apply the measurement stop policy.

## Return

Save new artifacts under a distinct Linux root and `D:/gitlode_test`, seal a manifest and verify copied
bytes. Do not append to F/M0 archives. Check immutable inputs before/after, report remaining owned
processes and fixture disposition, and leave historical residue untouched. Two OS copies are not
external backup. Do not run full tests, Windows campaigns, other targets, aggregation or GNOME checks.

Append a concise outcome here with exact command/limits, source/runtime/provenance identities,
per-stage pass/fail/inconclusive and metrics, artifact paths/hash, cleanup evidence, skipped dependent
stages and limitations. Shared checkout stays on M2; only documentation is committed and normally
pushed there after checking for concurrent ref movement. No implementation branch, PR, merge,
acceptance-record edit or new candidate is authorized. Return to trunk for evidence review and the
next target assignment; no self-acceptance of the overall performance matrix.

## First attempt outcome (2026-10-02; trunk review pending)

**Inconclusive; stopped after disabled overhead.** Legacy capture passed. Disabled comparison's
candidate MAD exceeded 5 percent, so profile comparison was not started. No workload was retried,
resumed or repaired. This result does not accept the target, T13B, M2 or release.

Instruction/shared M2 checkpoint: `3e4eb180a13bf0fe229f3a39162dab88fa728454`.
Product/harness: `8fffcc0d8e11bb061d70bf870f262092d559c5f2`;
legacy: `76b124e23fcc069be1278629cf01b62ae1456c7a`.
Historical calibration remains attributed to M0 harness
`a53a5b83d18f9e493ebb39c4db481b762448743f`, not the new harness.
The copied selected manifest retains SHA-256
`93b3010b76337ea8f3bdc9fc725c2ab4cd98824b33f9c6ab99f3bc34750b7945`, 4,430 commits and the
packet's recipe hash. Its calibration/environment references resolve beside the new manifest;
four targets remain incomplete and no global sealed fixture-manifest hash was invented.

### Execution and identities

Fresh Linux root: `/home/t-wakabayashi/gitlode-performance/m2-first-target-8fffcc0-20261002` (`R`
below). Fixed archives were extracted there without installation, rebuilding or dependency changes.
Ubuntu WSL2/ext4, kernel `6.18.33.1-microsoft-standard-WSL2`, x64, Ryzen 9 3900X / 24 logical CPUs,
Node `22.23.1`, npm `10.9.8`, Git `2.53.0` matched M0. Memory differed by the previously recorded
12,288 bytes. Actual M0 native preparation/measurement TMP roots and new
`TMPDIR=TMP=TEMP=/home/t-wakabayashi/gl-m2t1` resolve to ext4 on `/dev/sdf`; F's build-only tmpfs
was not reused. Linux-only PATH selected restored Node/npm and `/usr/bin/git`; `NODE_OPTIONS`
was unset, cache was `R/npm-cache`. Pre-workload load was 0.44/0.20/0.20 and vmstat samples were
100% idle; no competing Linux measurement/build was observed. This is sampled Linux evidence,
not continuous host isolation or proof of the cause of later variation.

Both F archive copies matched all 552 entries and their manifest before and after execution.
Restored candidate, harness, legacy and Git-support inventories matched F (4,625 / 15,619 /
1,617 / 251 entries); restored Node matched the immutable M0 distribution. Candidate CLI/worker
SHA-256 remained `f6592528e2ccb7902ddbe96d67c3f27517454b840a3867f98dbf56dfac1f76de` /
`ec2c6b27ef2bf64a95ba5e46ab59414245dea951756ee195c5064c9dd93c9df5`;
legacy CLI remained `379ed9dca9c25c2a7715371f3c64631317c98a3c2dd7a55f64bcbbac3cca5779`.
Source OIDs, clean detached status, Git executable hash and dependency/link closure were verified.
Final tracked source/runtime/Node/Git-support bytes matched restoration. Only restored `.git/index`
metadata changed during initial `git status`; exact before/after hashes are recorded and final status
is clean. Sealed inputs and historical residue were untouched.

The unchanged external launcher hash is
`23b916a0aee69275359527875cd3a9bc6e20fc9759008bddba0d14f6c2e32c8b`.
Its fresh disposable preflight returned exit 124 / SIGKILL after 2,041 ms at the 2-second deadline;
parent/group 176352 and descendant 176359 had no observed live remainder. Before workloads, each
outer command limit was fixed at 7,200 seconds to accommodate preparation and repeated runs;
it does not extend the unchanged harness stage limits: preparation 1,800,000 ms, execution and
processing 300,000 ms each. No deadline fired or was increased.

Exact expanded absolute argv, cwd, environment and limits are in `evidence/legacy.command.json`
and `evidence/disabled.command.json`. These executed the canonical supervised npm entrypoints from
`R/runtime/fixed-harness-and-build/source`, using absolute npm
`R/runtime/node/node-v22.23.1-linux-x64/bin/npm`:

```bash
# R is the absolute fresh Linux root above; these abbreviations expand to the recorded argv.
M="$R/inputs/m0/manifest.json"
B="$R/runtime/legacy-runtime/legacy-0.12.0/dist/index.js"
C="$R/runtime/candidate-consumer/tested-consumer/node_modules/gitlode/dist/index.js"
npm run performance:capture-legacy -w gitlode -- --manifest "$M" --fixture commit_heavy_repository --adapter isomorphic-git --preparation-timeout-ms 1800000 --execution-timeout-ms 300000 --processing-timeout-ms 300000 --baseline-cli "$B" --legacy-revision 76b124e23fcc069be1278629cf01b62ae1456c7a --artifacts "$R/legacy"
npm run performance:measure -w gitlode -- --manifest "$M" --fixture commit_heavy_repository --adapter isomorphic-git --preparation-timeout-ms 1800000 --execution-timeout-ms 300000 --processing-timeout-ms 300000 --comparison disabled_overhead --baseline-cli "$B" --legacy-revision 76b124e23fcc069be1278629cf01b62ae1456c7a --candidate-cli "$C" --candidate-revision 8fffcc0d8e11bb061d70bf870f262092d559c5f2 --artifacts "$R/disabled"
```

### Formal results and cleanup

| Stage             | Formal result | Wall/RSS and supervision evidence                                                                                                               |
| ----------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy capture    | pass          | Median 26,439.459795 ms; MAD 276.659350 ms (1.046%); median peak RSS 194,203,648 bytes; completed / exit 0; supervisor elapsed 289,710.89948 ms |
| Disabled overhead | inconclusive  | Paired median overhead +0.472116662%; RSS increase 8,347,648 bytes; candidate MAD 6.428%; completed / exit 2; elapsed 566,572.743835 ms         |
| Profile overhead  | skipped       | Dependent stage stopped under the packet; planned command retained but never executed                                                           |

Disabled baseline/candidate medians were 30,042.442903 / 29,150.685748 ms, MADs
511.904589 / 1,873.866672 ms, and median peak RSS 187,838,464 / 196,186,112 bytes.
The exact formal reason is `candidate MAD exceeds 5 percent`. The wall/RSS observations do not
override that inconclusive classification. Legacy capture's observed duration is within 10–30 s;
the comparison retained the catalog's actual duration/stability evaluation without recalibration.
Timing differs from historical M0 evidence; no cause or acceptance exception is inferred.

All raw runs are retained: capture 2 warmups + 7 measured runs, comparison 2 warmups + 7 measured
pairs, interleaved in the prescribed order. All 27 CLI children exited 0; capture errors were empty,
RSS sampling was supported with configured 20 ms interval. Every run produced 4,430 commits/records,
one JSONL file, 1,974,468 bytes and zero skipped diffs. Both formal behavior and sidecar evaluations
passed with empty reasons. All executed states were profile-disabled, with not-applicable sidecars;
there is no enabled schema-v2 ProfileReport, report-size/volume acceptance or profile-overhead result.
The workflow artifacts themselves are schema 2.

Terminal supervision records are `legacy/supervision-1790935828274-6841b3a7-1da5-4c2d-816f-bc38a7ca8085.json`
and `disabled/supervision-1790936151301-948fcf61-16d8-4cfc-a9ac-924f67e789a4.json`.
Both have `cleanupConfirmed=true`, empty cleanup/finalization errors and saved diagnostics/terminal
snapshots. Exit 2 is the completed inconclusive workflow result, not timeout or abnormal termination.
Last progress was processing/repository-cleanup, measured iteration 7, respectively legacy_off and
target_off. Final scoped `/proc` observation found no live members of launcher/worker groups
176500 / 176547 / 194854 / 194888; no fixture directories remain in the new TMP. Only tsx and
Node compile caches remain there. Detached groups are checked through supervisor cleanup evidence,
not inferred from outer termination. Observation excludes escaped groups, kernel races and host loss;
no broad process kill or historical-residue cleanup occurred.

### Preservation and return boundary

New Linux archive: `R/archive`; verified Windows copy:
`D:/gitlode_test/m2-first-target-8fffcc0-20261002`.
`sealed-manifest.json` SHA-256:
`383503b7ab78419ed6723f96f8bb3c56f73fb51c8b8f1774a659dfc2e07c6634`.
All 549 entries plus the manifest matched in both copies, zero size/hash mismatches.
`R/copy-verification.json` and
`D:/gitlode_test/m2-first-target-8fffcc0-20261002-copy-verification.json` retain copy verification.
Raw/formal results, command logs, deadlines, calibration provenance, per-stage inspections, progress
identities, full before/after runtime inventories and final process/fixture observations are preserved.
Runtime restoration is outside the sealed result archive; immutable runtime bytes remain preserved
by F's unchanged manifest `738b6a16a9c1c08fad90f5993ede2f7b6a872865b9e91c3f37817d423ea3e7ea`.
Two local OS copies are not external backup.

Three pre-workload operator setup errors were corrected with their execution records preserved:
inherited read-only destination-directory mode, a continuation that initially retained that mode,
and a missing continuation path variable. Only the new execution copy's directory mode/setup changed.
Post-measurement auxiliary audit type errors and an inspection wording correction are also recorded;
they only reread existing artifacts and did not repeat or alter a workload/formal result.
No install/build, code repair, tests, Windows campaign, other target, aggregation, GNOME check,
acceptance-record edit, PR or merge was performed.

Before writing this outcome, shared HEAD and actual remote M2 both remained at the instruction
checkpoint, with no concurrent changes. Only this result document is committed and normally pushed
on M2; the final documentation OID and actual remote equality are returned in the session.
Trunk must review this first attempt and assign any investigation or subsequent measurement;
profile comparison and the remaining matrix/release obligations remain open.
