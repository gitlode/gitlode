# M2 first fixed-candidate target measurement

## Current routing: disabled RSS failure diagnosis (2026-10-06)

Trunk reviewed controlled outcome `c86140ef8984444aec1eef79f2261b5b3fc6f68b` and verified all
567 returned files plus manifest, hash `c2e2bd856b0ca2578dc347b2b0d31db23e95802d935268060f641d6e52aec0da`.
The formal disabled result is **fail**, not inconclusive: median peak RSS is 185,655,296 bytes for
legacy and 203,198,464 for candidate, a 17,543,168-byte increase against 9,282,764.8 allowed.
Wall/stability and behavior pass; profile remains unexecuted. The empty reasons array does not
override fail; the evaluator uses it for inconclusive reasons and applies numerical pass/fail separately.

Candidate peak RSS exceeds legacy in all seven measured pairs (approximately 11.75 to 24.11 MiB).
These pair differences describe the data; the contract uses difference of medians, not median of
pair differences. The result is not caused solely by one sampled peak. RSS alone does not identify
a leak, heap retention, SDK import cost, native allocations or the responsible product path.
Aggregate host counters cannot establish that causal attribution either.

The two formal attempts are complete records: first inconclusive on candidate MAD, second failed
on RSS. There is no third-attempt authority. The fresh-attempt instructions below are historical
and superseded by the diagnosis assignment here; do not resume profile or other formal stages.

### Next session: bounded saved-RSS and disabled-path diagnosis

Start from the M2 document checkpoint delivering this section. Shared checkout remains M2;
product/harness for interpretation remain fixed `8fffcc0`, legacy `76b124e`, and historical M0
candidate/harness retain their original identities. Read both outcomes, the prior variability
diagnosis, F provenance, performance catalog/evaluator, and telemetry design/verification contracts.

1. Recompute measured-run peak statistics and allowed RSS from the original samples/artifacts.
   Verify warmup exclusion and sampler PID/process scope, including worker-thread versus child-process
   coverage and whether the sampled maximum equals the recorded peak. Distinguish actual peak
   sampling from heap/live-object accounting. Do not reinterpret the formal metric.
2. Summarize per-run RSS trajectories against elapsed time: initial available sample, peak timing,
   sustained versus brief increases, final available sample, and pair/order dependence. Compare M0,
   first attempt and controlled attempt with their different candidates explicitly attributed.
   Keep all runs and numerical precision. Do not infer product phases from time alone: correlate only
   where saved events support it, and state sampling/phase-resolution limits.
3. Trace the fixed disabled execution/import path: host/worker creation, telemetry initialization,
   no-op composition, SDK/module loading, report/collector allocation and any changed non-telemetry
   extraction/output path versus legacy. Inspect relevant source and preserved bundled artifacts;
   distinguish code reachability from observed allocation. Existing no-op tests establish their
   stated behavior, not zero module-loading/process memory cost. No blanket redesign or cleanup.
4. Return a short ranked set of hypotheses and evidence gaps, then one minimal next action with a
   concrete success/discrimination criterion. If code proves a defect, propose a bounded correction
   without implementing it. If allocation attribution needs execution, propose a finite diagnostic
   experiment with exact variants, observation points, run budget, expected signals and stop rule.
   Instrumented runs would be diagnostic only, never substitutes for the failed formal result.

This session reads saved artifacts and code and computes derived data only. No CLI workload,
benchmark, heap capture, full suite, build/install, formal retry, code/config/threshold/recipe changes,
PR/merge, archive mutation or release acceptance update. Do not introduce a monitoring framework or
scan unrelated host processes. New diagnostic execution requires a subsequent trunk packet.

Save derived scripts/tables outside sealed archives, recording consumed input hashes. Append concise
findings and limitations here; preserve original fail/inconclusive outcomes. Commit and normally push
the documented diagnosis on M2 after checking concurrent ref movement. Report final OID/remote
equality and clean status. Existing readonly diagnostics and historical ENOTEMPTY/EBUSY are outside
scope. Unknown cause is acceptable; unbounded hypothesis exploration is not the assignment.

## Active assignment: one controlled fresh attempt

Trunk accepts the saved-evidence diagnosis at `10540d1a113fabd3a324c5e202f4967de6bba6db`
as cause-unresolved and authorizes exactly one fresh attempt after that diagnosis. The first attempt
remains inconclusive; no outlier removal, threshold change, recalibration or acceptance exception is
authorized. The adjacent M0 quantity discontinuity remains an observation, not a proven recipe defect.
The older diagnosis-only routing below is completed history and is superseded by this section.

### Starting and execution conditions

The human starts a separate measurement conversation from the documentation checkpoint delivering
this section. Product/harness stay `8fffcc0d8e11bb061d70bf870f262092d559c5f2`; legacy, copied M0
manifest, 4,430 quantity, recipes, counts, pair order and thresholds stay as in the first packet.
Use its verified F inputs and restore instructions in a fresh native Linux execution area; reuse
immutable bytes without build/install, never resume first-attempt raw runs. Use fresh per-stage
artifact directories and preserve all new artifacts separately from old sealed archives.

Before workloads, establish a quiet host window with the human: no concurrent builds, tests,
measurements, large copies or other intentionally heavy work. Starting the session alone is not
evidence that the Windows host is idle. Do not stop unrelated processes or change host/WSL/power/Git
settings. If the window cannot be established, return a setup status without consuming a workload
attempt. Repeat Linux launcher preflight and input/environment/filesystem verification.

Predeclare lightweight external observation for the whole attempt: timestamped Windows aggregate
CPU activity using available built-in counters and Linux vmstat at a fixed five-second interval.
Save clock alignment and observer commands/PIDs/start/stop outcomes. Frequency/temperature are
optional only when already available without new installation/permissions complexity. Counter
unavailability is recorded, not repaired by inventing values or installing monitoring infrastructure.
Check observer startup before measurement and disclose any missing host CPU observation to trunk
before starting. Observations cannot prove isolation and may add cost; keep their configuration
unchanged through stages and do not inject monitors into timed children.

Do not repeatedly scan repository files or invoke Git during timed runs. Record object-layout or
maintenance information only if already available or at a clearly observed non-timed boundary without
editing the harness. Otherwise explicitly retain that diagnostic limitation.

### One-attempt sequence and stopping

Run fresh legacy capture, disabled overhead, then profile overhead, each once, with the same expanded
command model as the first packet. Keep outer command limit 7,200 seconds and harness stage limits
1,800,000/300,000/300,000 ms. Long-running stages require progress updates; no limit increases after
execution starts. Advance only on required formal pass and confirmed supervision/cleanup.

A fail/inconclusive, deadline, runtime drift, unplanned competing workload or missing required evidence
stops dependent stages. Preserve observations and return. In particular, another disabled inconclusive
does not authorize a third attempt, a different quantity, longer warmup, disabled sampling or relaxed
MAD. Do not combine favorable runs from either attempt. A passing second attempt is reported together
with the first inconclusive, not as proof of its cause or automatic whole-target acceptance.

Use the original packet's sealing/copy verification and final process/fixture observations. Stop only
owned observer processes and preserve their logs; do not claim outer groups cover detached workers.
Report paired chronology, MAD, wall/RSS, behavior and profile-sidecar results where executed, plus
resource observations and their limitations. Append outcome here, keep original diagnosis/attempt
unchanged, commit/push documentation only on M2 after checking ref movement, and return clean status
and actual remote OID. No PR/merge, code or acceptance change. Work itself can take substantial time.

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

## Saved-evidence diagnosis (2026-10-02)

**Cause unresolved; common temporal variation is the leading explanation of the shape, not an
identified mechanism.** Diagnosis started at `98c562021713807d078b38475d914400c513e187` on M2.
The original inconclusive classification and skipped profile stage remain unchanged.
No new workload, calibration, profiling, build, installation, product/configuration change or
acceptance update was performed.

### Reproduction and chronology

[Read-only derivation script](m2-first-target-diagnosis/derive.cjs) and
[unrounded derived evidence](m2-first-target-diagnosis/derived.json) are outside the sealed archives.
Reproduce with `node packages/gitlode/docs/handoff/m2-first-target-diagnosis/derive.cjs
D:/gitlode_test/m2-first-target-8fffcc0-20261002
D:/gitlode_test/m0-one-target-20260910T065854Z-a53a5b8` (one command).
The derivation rehashed all 549 M2 and 680 M0 entries without mismatch; M2 manifest identity remains
`383503b7ab78419ed6723f96f8bb3c56f73fb51c8b8f1774a659dfc2e07c6634`, and M0 `evidence.sha256`
remains `af7500f45a531f606ef598adfda931a2963d52192e93d21beec943f2fadb8cce`.
Individual consumed raw/formal/supervision artifacts and their SHA-256 identities are in the derived
file. Fixed code interpretation used `git show 8fffcc0:<path>` for performance-harness,
performance-workflow and performance-fixtures, with the M0-to-fixed diff and F compatibility evidence.

Independent raw-run statistics (milliseconds; table rounded only for readability):

| Evidence/state                  |     Median |       MAD | MAD/median |
| ------------------------------- | ---------: | --------: | ---------: |
| M0 selected calibration, legacy | 24,644.733 |   294.616 |     1.195% |
| M0 capture, legacy              | 23,867.013 |   172.546 |     0.723% |
| M0 disabled, legacy             | 23,735.137 |   278.494 |     1.173% |
| M0 disabled, old candidate      | 24,657.497 |   123.124 |     0.499% |
| M2 capture, legacy              | 26,439.460 |   276.659 |     1.046% |
| M2 disabled, legacy             | 30,042.443 |   511.905 |     1.704% |
| M2 disabled, candidate          | 29,150.686 | 1,873.867 |     6.428% |

M2 paired candidate/legacy ratios, in pair-index order 0–6, are
`1.004721166619, 0.998535303032, 0.992336843349, 1.031689614686,
1.033190136242, 0.966328177693, 1.005192344428`; median overhead is +0.472116662%.
Raw numeric values/order agree with the formal artifact. Recomputed reason list is exactly
`candidate MAD exceeds 5 percent`; RSS/behavior/environment evidence supplies no additional reason.
Passing overhead alone cannot override stability.

Warmups are excluded from every statistic above. Capture warmups were 26.215/25.034 s;
disabled warmup pair 0 was legacy 25.893 then candidate 26.706 s, pair 1 candidate 29.601 then
legacy 26.368 s. Saved supervisor events establish all nine capture children and all eighteen
comparison children in order; zero-based raw pair indices correspond to one-based supervisor
iterations. Measured comparison starts span 10:18:31.949–10:24:50.132 UTC (19:18–19:24 JST),
with A-B/B-A alternation intact. Pairs 0/1 and 6 are about 27 s; pairs 2–5 are mostly 29–31.5 s
in both states. This is a rise and recovery, not monotonic warming or one isolated candidate outlier.
The five saved progress observations agree with the active state/iteration and event intervals;
their Linux load averages are about 1.11–1.19 on 24 logical CPUs. They do not measure host contention.

### Calibration and execution conditions

M0 selected 4,430 at pilot ordinal 22; its measured range was 24.228–26.825 s and warmups
22.916/27.407 s. Final pilot 23 at 4,429 had median 9.877 s, MAD 0.814%, range 9.797–10.104 s.
The complete 23-pilot history has no above-5% MAD or lower-threshold classification inversion.
The adjacent-quantity discontinuity is real saved evidence; it does not invalidate the catalog's
observed integer selection rule. Target hash and quantity, immutable legacy CLI, Node/npm/Git,
OS/kernel/CPU, two warmups/seven measurements, native ext4 class and release mode support the
authorized reuse. They do not establish unchanged performance over time. M2 capture is already
about 10.8% slower than M0 capture with the same legacy; the candidate change cannot explain that.

The catalog's 10–30 s window applies to calibration selection. At fixed `8fffcc0`,
`classifyCalibrationMedian` enforces both bounds; comparison `evaluateComparison` checks baseline
median below 10 s, both MAD limits and wall/RSS thresholds, without a 30 s upper-median gate.
Thus the 30.042 s comparison baseline is not an extra formal failure. Reuse does not waive current
stability, imply recalibration authority or allow quantity/threshold adjustment.

F's build-only tmpfs was replaced by the recorded external ext4 TMP; M0 and M2 timed roots both
resolve to `/dev/sdf`. Paths/runtime restoration and supervisor cleanup protocol differ, while
the fixture recipe, timed spawn-to-close measurement and configured 20 ms RSS sampler are unchanged.
Observed M2 consecutive RSS sample gaps have medians 19.81–19.92 ms and maxima at most 23.684 ms;
M0 capture/disabled gaps are similarly near 20 ms (max 23.157 ms). There is no large sampler gap
explaining seconds of drift, though regular polling does not rule out common harness interference.
Before-run vmstat was idle with no swap use and ample memory/storage; after-run process observations
and cleanup passed. There is no continuous CPU-time, frequency, temperature, host-load or I/O-latency
record during the timed children. RSS samples and Linux load averages cannot reconstruct those.

### Ranked hypotheses and next action

1. **Shared execution/resource variation during the comparison:** strongest support is the paired
   rise/recovery and slower unchanged legacy versus M0. Sparse low Linux load weakens obvious Linux
   workload saturation, but neither proves isolation nor identifies scheduling, host load, power,
   thermal or storage behavior. Missing simultaneous resource observations prevent choosing among them.
2. **Generated repository representation/cache effects:** the 4,429/4,430 calibration jump and
   per-command fresh repository generation make this a concrete alternative for historical duration
   differences. Fixed fixture code repeatedly invokes Git commit and does not explicitly freeze
   packing/maintenance settings. No preserved object-layout/maintenance record proves a transition.
   Within-comparison snapshot reuse weakens a static layout explanation for the rise/recovery;
   dynamic cache/I/O effects remain unmeasured. No Git-maintenance cause is established.
3. **Candidate-specific cost or variability:** possible contributor to its larger MAD and pair
   differences (roughly -3.37% to +3.32%), but cannot alone explain the shared temporal shape or slower
   legacy capture. Disabled runs have no enabled report; saved data cannot localize a product path.
4. **Launcher/sampler/supervisor disturbance:** sampling cadence and successful deadlines/cleanup
   contradict gross stalls or timeout failure. Changed supervision may affect shared execution, but
   no observation ties it to the middle pairs. Its cost was not independently measured.

Recommend **one trunk-authorized fresh target attempt**, preserving this first attempt intact, with
the same fixed binaries, manifest/4,430 quantity, thresholds, counts, ordering, filesystem class and
deadlines. Preconditions: repeat input/runtime/compatibility checks, establish a quiet agreed host
window without changing settings, and predeclare the same stop-on-first-inconclusive dependent-stage
policy. Add only low-rate, timestamped external observations: host CPU activity and available
frequency/temperature counters, plus Linux vmstat at a fixed modest interval. Save a read-only
object-layout/maintenance snapshot after normal fixture preparation if available without modifying
the harness; absence is a stated limitation, not permission for a code change. Keep observers and
their logs outside the timed product path; acknowledge observer cost and do not add stress/profiling.
This can test whether stability recurs and whether shared changes coincide with resource signals;
it cannot by itself prove causation or transfer M0 acceptance. Another inconclusive result means
the target remains unaccepted and dependent profile work stops, with evidence returned for a separate
decision; no automatic retry or recalibration. This recommendation was not executed.

## Controlled fresh attempt outcome (2026-10-05; trunk review pending)

**Fail; stopped after disabled overhead.** Fresh legacy capture passed; disabled comparison failed
the unchanged peak RSS gate, so profile was never started. Exactly one workload per executed stage
ran, without retry, resumption or combination with the first attempt. The first attempt remains
inconclusive (candidate MAD 6.428%) and cause-unresolved. Neither attempt accepts this target, T13B,
M2 or release; this packet does not authorize a third attempt.

### Setup and fixed inputs

Started clean on M2 at `b0ca2c977f9ea843a3050d5cce04362a4ec49a11`. Before workloads the human
confirmed exclusive local-machine use for this session from approximately 2026-10-05 17:47 JST
for 15 hours, through approximately 2026-10-06 08:47 JST. Workloads ran 17:51:23–18:05:11 JST
within that window. No unrelated process was stopped; host/WSL/power/Git settings were unchanged.

Fresh Linux root (`R`): `/home/t-wakabayashi/gitlode-performance/m2-controlled-8fffcc0-20261005`.
Product/harness remained `8fffcc0d8e11bb061d70bf870f262092d559c5f2`; legacy remained
`76b124e23fcc069be1278629cf01b62ae1456c7a`. Historical calibration retained M0 harness
`a53a5b83d18f9e493ebb39c4db481b762448743f`. Copied selected manifest SHA-256 remained
`93b3010b76337ea8f3bdc9fc725c2ab4cd98824b33f9c6ab99f3bc34750b7945`, with resolvable calibration/
environment references, 4,430 commits and unchanged recipe hash
`6668bd8a9c032a9d2c9ca2a7aca0a1b7e56055c24b3431e561d3fee156ed738f`. Four other targets remain
incomplete; no global manifest hash was invented.

Both F copies matched all 552 entries before and after execution, with unchanged manifest
`738b6a16a9c1c08fad90f5993ede2f7b6a872865b9e91c3f37817d423ea3e7ea`. Extracted candidate/harness/
legacy/Git-support closures matched 4,625/15,619/1,617/251 inventory entries; Node matched immutable
M0. No install/build/dependency update occurred. Candidate CLI/worker SHA-256 remained
`f6592528e2ccb7902ddbe96d67c3f27517454b840a3867f98dbf56dfac1f76de` /
`ec2c6b27ef2bf64a95ba5e46ab59414245dea951756ee195c5064c9dd93c9df5`; legacy CLI remained
`379ed9dca9c25c2a7715371f3c64631317c98a3c2dd7a55f64bcbbac3cca5779`.
Final runtime/source/toolchain inventories matched restoration except `.git/index` metadata refreshed
by initial status; both index hashes are recorded, tracked bytes unchanged and detached status clean.

Ubuntu WSL2/ext4, x64, kernel `6.18.33.1-microsoft-standard-WSL2`, Ryzen 9 3900X / 24 logical CPUs,
Node `22.23.1`, npm `10.9.8`, Git `2.53.0` matched M0. The existing 12,288-byte memory difference
remained. M0 timed roots and fresh `TMPDIR=TMP=TEMP=/home/t-wakabayashi/gl-m2t2` resolve to ext4
on `/dev/sdf`; F's build-only tmpfs was not reused. Explicit Linux-only PATH selected restored
Node/npm and native Git, NODE_OPTIONS unset, cache `R/npm-cache`. Fixed-harness manifest validation/
environment compatibility had no errors. Initial vmstat samples were 99–100% idle.

Unchanged launcher SHA-256: `23b916a0aee69275359527875cd3a9bc6e20fc9759008bddba0d14f6c2e32c8b`.
Fresh disposable preflight returned exit 124 / SIGKILL at 2,044 ms for a 2-second deadline;
group 248611 and descendant 248618 had no observed live remainder. Every planned outer command
limit stayed 7,200 seconds; harness limits stayed 1,800,000/300,000/300,000 ms. No deadline fired
or was increased. Absolute argv, cwd, environment and limits are in
`evidence/{legacy,disabled,profile}.command.json`; profile is planned only. Executed commands used
absolute `R/runtime/node/node-v22.23.1-linux-x64/bin/npm` from
`R/runtime/fixed-harness-and-build/source`:

```bash
M="$R/inputs/m0/manifest.json"
B="$R/runtime/legacy-runtime/legacy-0.12.0/dist/index.js"
C="$R/runtime/candidate-consumer/tested-consumer/node_modules/gitlode/dist/index.js"
npm run performance:capture-legacy -w gitlode -- --manifest "$M" --fixture commit_heavy_repository --adapter isomorphic-git --preparation-timeout-ms 1800000 --execution-timeout-ms 300000 --processing-timeout-ms 300000 --baseline-cli "$B" --legacy-revision 76b124e23fcc069be1278629cf01b62ae1456c7a --artifacts "$R/legacy"
npm run performance:measure -w gitlode -- --manifest "$M" --fixture commit_heavy_repository --adapter isomorphic-git --preparation-timeout-ms 1800000 --execution-timeout-ms 300000 --processing-timeout-ms 300000 --comparison disabled_overhead --baseline-cli "$B" --legacy-revision 76b124e23fcc069be1278629cf01b62ae1456c7a --candidate-cli "$C" --candidate-revision 8fffcc0d8e11bb061d70bf870f262092d559c5f2 --artifacts "$R/disabled"
```

### Results and chronology

| Stage             | Formal result | Metrics and supervision                                                                                                                  |
| ----------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy capture    | pass          | Median 26,883.397326 ms; MAD 729.562593 ms (2.713804%); median peak RSS 186,593,280 bytes; completed / exit 0; elapsed 284,768.712413 ms |
| Disabled overhead | fail          | Paired wall overhead +1.277550592%; RSS increase 17,543,168 bytes; completed / exit 2; elapsed 501,408.308360 ms                         |
| Profile overhead  | skipped       | Dependent stage stopped; no enabled report or profile-overhead result                                                                    |

Disabled baseline/candidate medians were 24,954.091113 / 25,181.073503 ms, MADs
108.719237 / 313.121993 ms (0.435677% / 1.243482%), median peak RSS 185,655,296 / 203,198,464 bytes.
Allowed RSS increase is `max(8 * 1024 ** 2, 185655296 * 0.05) = 9,282,764.8` bytes; observed growth
is 9.449323%. RSS fails while paired wall overhead and stability pass. Fixed evaluator `reasons` is
empty: it records inconclusive conditions, while numeric threshold failure is expressed by `status=fail`.
Saved-data recomputation confirms this result without changing evaluation or thresholds.

Measured pairs in original order (seconds rounded only for this table):

| Pair | Order |    Legacy | Candidate | Candidate/legacy |
| ---- | ----- | --------: | --------: | ---------------: |
| 0    | A-B   | 24.554258 | 24.867952 |      1.012775506 |
| 1    | B-A   | 25.077245 | 25.181074 |      1.004140356 |
| 2    | A-B   | 24.854758 | 25.366762 |      1.020599850 |
| 3    | B-A   | 24.467494 | 27.775836 |      1.135213767 |
| 4    | A-B   | 24.975898 | 24.803502 |      0.993097508 |
| 5    | B-A   | 24.954091 | 28.056769 |      1.124335451 |
| 6    | A-B   | 25.062810 | 25.088013 |      1.001005573 |

Measured child starts span 08:59:15.321167–09:04:45.651389 UTC (17:59–18:04 JST). Warmups remain
separate: pair 0 legacy 23.990010 then candidate 25.172292 s; pair 1 candidate 25.140575 then legacy
24.691998 s. Capture retained two warmups/seven measured runs; comparison two warmup/seven measured
pairs with prescribed alternation. Slower candidate pairs 3/5 are retained; no sample was discarded.
Unrounded wall/RSS values, start timestamps, order, sampler gaps and resource overlap are saved in
`evidence/raw-and-quality-audit.json` and `evidence/resource-observations-summary.json`, with consumed
formal/supervision identities. All 27 timed CLI children exited 0 without capture errors; supported
RSS sampling stayed 20 ms. Every run produced 4,430 commits/records, one JSONL file, 1,974,468 bytes
and zero skipped diffs. Behavior and sidecar evaluations passed with empty reasons. All executed states
were profile-disabled, sidecars not-applicable; there is no enabled schema-v2 ProfileReport or volume result.

### Observations and cleanup

Both observers were checked healthy before workloads. Windows used built-in
`Win32_PerfFormattedData_PerfOS_Processor`, `Name=_Total`, `PercentProcessorTime`, on a fixed 5,000 ms
Stopwatch schedule with UTC timestamps, final PID 6640. Linux observer 248698 ran `/usr/bin/vmstat -t 5`
in UTC, vmstat PID/group 248700. Configuration stayed unchanged through stages, outside timed children.
Commands/identities/start/stop/raw logs/clock records are preserved. Windows UTC bracket
08:51:04.4769903–08:51:04.5864043 enclosed Linux `date -u` 08:51:04.543274850 from the operator call.
The Python clock record's `windowsBefore` label is actually a Linux-side read, not an independent
Windows observation. No clocks were changed.

Windows retained 176 samples, median 8% / maximum 22% aggregate CPU. Actual intervals were
4.110053–5.893863 s, median 5.003316 s, including query/scheduling jitter. Capture/disabled sample
counts were 57/100, median CPU 8%/8%, maximum 22%/19%. Linux retained 187 interval samples excluding
its initial since-boot average, idle 92–100%, median 94%, reported iowait and swap-in/out all zero;
both stages had minimum idle 92%, median 94%. Aggregate counters include workloads/observers and
cannot prove isolation or explain either failure. No CPU-time, frequency, temperature, process attribution,
storage latency or object-layout/maintenance evidence was collected. No repository scans/Git calls ran
during timed children; the harness removes fixtures before the final boundary, so no object-layout
snapshot was available without intervention. These diagnostic limitations remain.

Stop files gracefully stopped only owned observers at 09:05:31 UTC: Windows exit 0, Linux vmstat
requested SIGTERM (`-15`); observer processes had exited on final observation. Terminal supervision:
`legacy/supervision-1791190284531-1abf01d8-4499-41c6-a191-eb5defceb4dd.json` and
`disabled/supervision-1791190609698-68a874d6-2776-469e-990c-3bda73a6303b.json`.
Both have `cleanupConfirmed=true`, empty cleanup/finalization errors and persisted diagnostics.
Exit 2 is completed formal failure, not timeout/abnormal termination. Final scoped observation found
no live members of groups 248883/248931/267109/267143, no new TMP fixture directories, only tsx/Node
caches. Supervision cleanup is required separately from outer groups; escaped groups, kernel races
and host loss are outside these observations. No broad kill or historical-residue cleanup occurred.

Pre-workload operator events are recorded in `evidence/attempt-policy.json`: sandbox counter denial
then authorized access; shell quoting corrected to absolute Linux observer paths; early Windows cadence
corrected before workloads with old logs retained; immediate health check before first asynchronous
sample corrected after sample arrival; self-copy SameFileError before launcher corrected by external
script invocation. Auxiliary Python error reporting also imported operator `inspect.py` instead of stdlib
`inspect`. None launched/repeated a workload. Original attempt and diagnosis are unchanged.

### Preservation and return

New Linux archive: `R/archive`; verified Windows copy:
`D:/gitlode_test/m2-controlled-8fffcc0-20261005`. Sealed manifest SHA-256:
`c2e2bd856b0ca2578dc347b2b0d31db23e95802d935268060f641d6e52aec0da`.
All 567 files plus manifest matched in both copies, zero size/hash mismatches. Verification:
`R/copy-verification.json` and `D:/gitlode_test/m2-controlled-8fffcc0-20261005-copy-verification.json`.
New raw/formal results, provenance, commands/limits, progress, observer logs, inspections and inventories
are separate from unchanged F/M0/first-attempt archives. Runtime restoration stays outside this archive;
F preserves immutable runtime inputs. Two local OS copies are not external backup.

Before writing, shared HEAD and actual remote M2 still matched the starting checkpoint. Only this document
is committed and normally pushed on M2 after ref-movement checks; final OID/remote equality/clean status
are returned in the session. No product/configuration/threshold/recipe change, tests/build/install, other
target, acceptance update, PR or merge occurred. Trunk receives this failed attempt for evidence review
and a separate next decision; profile and the remaining matrix stay open.

## Disabled RSS failure diagnosis (2026-10-06)

**Cause unresolved; controlled disabled RSS fail confirmed.** This session started clean at
`e5ee774932b4309580ee123455164b6f3e6f7a81` on `feature/otel-redesign_M2`. It analyzed saved data
and fixed code only. No measurement, heap capture, product execution, build/install, tests,
implementation/configuration/threshold/recipe change, retry, PR/merge or acceptance update occurred.
First-attempt inconclusive and controlled fail remain unchanged; profile remains unexecuted.

Reproducible derived scripts, full-precision statistics, all-run trajectories and consumed hashes:
[`m2-rss-diagnosis/`](m2-rss-diagnosis/README.md). Six original formal artifacts and six terminal
supervision artifacts matched their archive manifests. F candidate/legacy runtime archive hashes
and inspected CLI/worker hashes match preserved provenance. These checks cover consumed evidence,
not a fresh verification of every archive file. M0 uses candidate `a97829b` / harness `a53a5b8`;
both M2 attempts use candidate/harness `8fffcc0`. Legacy is always `76b124e`. Historical M0
acceptance cannot transfer to M2, and these populations are not combined.

### Recomputed statistics and process scope

Warmups are excluded: seven measured runs per series. RSS medians/MADs are exact bytes; allowed
growth is the existing `max(8 MiB, baseline median peak * 0.05)`.

| Disabled evidence |     Legacy median / MAD |  Candidate median / MAD | Difference of medians | Allowed growth | Formal status                    |
| ----------------- | ----------------------: | ----------------------: | --------------------: | -------------: | -------------------------------- |
| M0, old candidate | 193,216,512 / 1,085,440 | 200,642,560 / 1,441,792 |             7,426,048 |    9,660,825.6 | pass                             |
| M2 first          | 187,838,464 / 2,961,408 | 196,186,112 / 1,515,520 |             8,347,648 |    9,391,923.2 | inconclusive: candidate wall MAD |
| M2 controlled     | 185,655,296 / 1,273,856 | 203,198,464 / 3,350,528 |            17,543,168 |    9,282,764.8 | fail: RSS                        |

Capture legacy median peak RSS is 192,233,472 / 194,203,648 / 186,593,280 bytes respectively.
Controlled wall medians/MADs recompute to 24,954.091113 / 108.719237 ms and
25,181.073503 / 313.121993 ms (rounded here); paired median overhead is +1.2775505919578656%.
Wall/stability pass, behavior/sidecar checks pass. `evaluateComparison` at fixed revision
(`test/support/performance-harness.ts:610-658`) gives numerical RSS fail with empty inconclusive
`reasons`. RSS MAD above is descriptive; it is not the contract's wall stability criterion.

The sampled maximum equals recorded peak in **all 81 runs**, including all warmups and captures.
Fixed `runReleaseCli` spawns Node with the release CLI, then `sampleChildRss` reads
`/proc/<that child.pid>/status` `VmRSS * 1024` immediately and every configured 20 ms until close.
It does not sum descendants or sample the supervisor/harness. Node worker threads share that
process address space, so host and worker RSS are included together, without isolate attribution.
Separate child processes, including any Git CLI helpers, are excluded. Both legacy and candidate
use one worker thread; this migration did not introduce a second CLI process. Output decoding and
behavior comparison happen in the harness after close and cannot directly add to sampled child RSS.
Across consumed runs the largest saved intersample gap is 23.684055 ms. A readable sample can lag
the actual `/proc` read; missed short peaks, unsampled start/exit intervals and polling overhead
remain. VmRSS is resident process memory, not heap size, live objects, allocation volume or a leak test.

### Time trajectories and order

The CSV preserves initial/peak/final times and bytes, sample gaps, five elapsed-time-bin medians,
and durations near each run's own peak for every run, without outlier removal. All 81 runs match
one saved execution event, and A-B/B-A alternation is intact. These events bound whole CLI execution;
saved logs do not timestamp worker import, provider initialization, extraction phases or GC. Neither
elapsed-time bins nor peak timing identifies a product phase. `--quiet` does not supply phase traces.

Controlled measured runs (seconds rounded here; exact values in CSV):

| Pair / order | Legacy peak bytes / first peak s | Candidate peak bytes / first peak s | Delta bytes | Candidate time at >=95% of its peak s |
| ------------ | -------------------------------: | ----------------------------------: | ----------: | ------------------------------------: |
| 0 / A-B      |             181,538,816 / 16.106 |                 199,847,936 / 7.831 |  18,309,120 |                                 5.607 |
| 1 / B-A      |             184,381,440 / 16.209 |                 209,657,856 / 7.826 |  25,276,416 |                                 3.541 |
| 2 / A-B      |             185,655,296 / 15.206 |                 203,198,464 / 8.156 |  17,543,168 |                                 4.391 |
| 3 / B-A      |             185,245,696 / 24.145 |                197,562,368 / 27.693 |  12,316,672 |                                 2.760 |
| 4 / A-B      |             188,657,664 / 24.727 |                207,597,568 / 24.223 |  18,939,904 |                                 4.362 |
| 5 / B-A      |             186,978,304 / 18.272 |                205,152,256 / 27.586 |  18,173,952 |                                 2.071 |
| 6 / A-B      |             186,236,928 / 16.089 |                 202,395,648 / 8.110 |  16,158,720 |                                 5.141 |

Every controlled measured pair has higher candidate peak, in both orders; values do not increase
monotonically with pair index. Slow wall pairs 3/5 are not the two largest RSS peaks. Candidate
first-peak timing splits between approximately 31-32% and 98-100% of wall duration. Near-peak
sampled residency is 2.071-5.607 s total, with longest uninterrupted estimates 0.441-1.327 s;
this is repeated/sustained high residency rather than only a single sampled spike. These estimates
use left-held intervals at >=95% of the per-run peak and exclude unsampled boundary intervals.
They are descriptive, not alternative acceptance metrics.

Controlled initial readable samples arrive 0.555-0.831 ms after sampler start, with only
1,429,504-3,366,912 bytes; they precede any established loaded-module baseline. Measured candidate
last samples range 65,511,424-138,309,632 bytes versus legacy 88,199,168-171,012,096 bytes.
Final available samples may catch worker termination/teardown and cannot estimate retained heap.
The median of each run's last-fifth RSS median is 190,144,512 candidate versus 173,748,224 legacy;
the analogous first-fifth medians are 174,673,920 versus 170,598,400. Candidate elevation is not
limited to the maximum, but its changing gap does not isolate an import cost.

Historical M0 candidate peaks first occur at 22.712-24.209 s, legacy at 13.723-16.224 s;
first M2 candidate at 6.729-30.780 s, legacy at 21.253-23.259 s. M0/first/controlled last-fifth
series medians are legacy 180,738,048 / 167,149,568 / 173,748,224 and candidate
191,877,120 / 181,264,384 / 190,144,512 bytes. Warmups remain separately visible in CSV;
controlled warmup candidate peaks 202,788,864 / 200,085,504 already exceed legacy
184,602,624 / 184,795,136. Across the two M2 attempts, unchanged candidate median peak rises
7,012,352 bytes while unchanged legacy falls 2,183,168 bytes. This rules out attributing the
entire between-attempt difference to a candidate revision change; allocation/GC/native residency
and execution-condition variability remain unobserved. Aggregate host counters do not resolve them.

### Fixed disabled code and preserved bundles

At `8fffcc0`, `src/index.ts` imports execution; `worker-client.ts` dispatches one
`node:worker_threads` Worker. F's actual CLI and worker both statically import
`execute-run-C-9tXXhg.js` (295,418 bytes, SHA-256 in `code-identities.json`). That chunk statically
imports OTel API, context-async-hooks, sdk-metrics and sdk-trace-base before the profile branch.
Its module-level telemetry catalogs/metadata and report implementation code are reachable in both
host and worker module graphs. Worker isolates have separate module evaluation; the bytes/RSS cost
of that duplication is not measured here. Legacy's analogous chunk is 131,669 bytes and has no SDK
imports; file-size difference itself is not a resident-memory estimate. CLI/worker hashes exactly
match F's fixed identities; this conclusion comes from preserved bundles, not just source imports.

`executeWorkerRunRequest` calls `WorkerTelemetrySession.create(input.profile)`. The disabled branch
(`worker-telemetry-session.ts:158-170, 422-433`) calls `createDegradedProviders`, allocating
`BasicTracerProvider` with `AlwaysOffSampler`, `MeterProvider`, a nonrecording root span/context
and session. Default composition still obtains tracer/meter objects for core scopes. This is
concrete reachable allocation, even though it does not record. It is not proven to account for
17,543,168 bytes. Disabled does not enable/register `AsyncLocalStorageContextManager`, construct
`LocalSpanProcessor`, `LocalMetricReader`, `BoundedDiagnosticAccumulator` or `ProfileReportBuilder`,
collect metrics/build a report, or create enabled sidecar data. Finalization ends the nonrecording
root and shuts down providers; absence of active resources guards collection/report work.

`recordingEnabled=false` selects singleton no-op Git/DAG/line-diff/expansion/projection/output/
pipeline recorders, including plugin composition when applicable. Timing helper construction does
not itself read a clock; no-op starts use shared tokens. Existing direct and production-composition
tests establish these selections, no instruments and no recorder-clock/per-operation timing-token
cost. They do not prove zero imports, provider/scope objects, process RSS or all wrapper allocation.

Tracing wrappers still run with the SDK's nonrecording tracer. In particular the async-iterable
helper keeps iterator lifecycle/serialization, closures/promises and span contexts; default built-in
projection still instruments its stream. Work proportional to records can therefore remain without
recorded spans. Compared with legacy's `noopInstrumentation`, this is a concrete allocation-churn
hypothesis, not demonstrated live retention. Domain diffs also replace per-record output span work
with no-op recorder calls and remove process-commit spans. The commit fixture uses commit granularity,
so blob materialization/line-diff and plugin-heavy paths are not exercised just because their modules
load. Reviewed commit traversal/projection/output data flow retains streamed processing, visited sets,
topology caches and JSONL writes; no new disabled raw-span/sample/report accumulation was found.
There are incidental bookkeeping/error-path changes (e.g. output sequence updated after successful
open and blob read error settlement); they do not prove an explanation for successful commit-only RSS.
No broad redesign or unrelated cleanup is proposed.

### Ranked hypotheses and one finite next action

1. **Eager module graph plus disabled SDK/provider baseline:** strongest concrete migration difference,
   present in preserved host/worker bundles and disabled construction. Could raise the resident floor
   and alter GC behavior; missing post-import/pre-work snapshots prevent quantifying it. Identical
   candidate binaries with different attempt RSS mean a fixed startup cost alone is not established.
2. **Nonrecording tracing/iterator churn interacting with GC/native residency:** wrappers execute despite
   no-op domain recorders; changing within-run gap and multiple peak timings are compatible. No allocation,
   GC or per-isolate heap observations distinguish this from extraction caches or allocator residency.
3. **Shared/runtime/fixture variation:** unchanged legacy/candidate shift across attempts, and late
   teardown drops, support this as a contributor. Both pair orders, all seven positive controlled
   deltas, regular polling and quiet-window aggregate observations weaken a solely isolated-noise
   explanation. They cannot identify layout, scheduling, GC or native memory causality.

Active collector/report retention is low priority because disabled construction excludes it; no
leak or specific faulty extraction cache is demonstrated. Code proves avoidable SDK work, not a
contract defect sufficient to choose a repair without execution attribution.

Recommend a **single subsequent trunk packet for a three-variant disabled diagnostic**, not a formal
third attempt or implementation acceptance. Preserve F and both failed/inconclusive records. In an
isolated diagnostic checkout based on `8fffcc0`, use the same Node/dependency versions, native ext4,
saved manifest/4,430 snapshot, arguments, no profile and output checks. Any diagnostic build or temporary
code below needs that new packet; none was performed here.

- V0: fixed logic with only identical boundary observation hooks.
- V1: V0 except disabled session uses API no-op tracer/meter and nonrecording root/context, constructing
  no SDK providers; keep eager SDK imports and iterator/application logic unchanged.
- V2: V1 plus defer enabled SDK/session/collector imports into an enabled-only chunk, ensuring neither
  host nor disabled worker imports SDKs. Preserve catalogs, API wrappers and application logic; inspect
  the diagnostic bundles to prove import isolation, or stop before workloads if isolation fails.

Budget: exactly six diagnostic CLI runs, order V0,V1,V2 then V2,V1,V0, no warmups, retries, forced GC,
heap capture or formal evaluator substitution. Save hashes for each variant and snapshot; use one
immutable prepared fixture with separate output/state per run. Observe host after imports/before
worker creation, worker after module load/before request, after disabled session/composition, before
extraction and after extraction/before finalization, and host after worker termination. At each boundary
save timestamp/process RSS plus that isolate's heapUsed/heapTotal/external/arrayBuffers; host/worker
RSS is the same process metric and must not be added. Sample external CLI VmRSS at the unchanged
20 ms cadence. No per-record logging or extra monitors. Boundary observations are diagnostic overhead.

Discrimination criterion: V0-to-V1 isolates provider construction; V1-to-V2 isolates eager SDK imports.
Treat an effect as resolved only if both blocked comparisons have the same direction and the smaller
absolute effect exceeds the largest within-variant replicate spread, at the matching pre-extraction
boundary and in peak RSS. Report actual bytes rather than assuming the formal threshold is the effect
size. A startup reduction without peak reduction shows startup cost but does not explain the failure;
if neither contrast resolves peak RSS, stop with wrapper/GC/native/fixture causes unresolved. Verify
4,430 records and equivalent normalized JSONL/checkpoint behavior for every variant; any mismatch,
timeout, cleanup uncertainty or unexpected workload stops dependent runs. Keep existing 300,000 ms
execution/processing deadlines, owned-process cleanup and a 30-minute total workload budget. Stop
after six runs even if signals overlap; no expanding variant matrix. This diagnoses allocation scope
and informs one bounded repair decision, never replaces the controlled formal fail or grants retry,
profile-stage or release authority.
