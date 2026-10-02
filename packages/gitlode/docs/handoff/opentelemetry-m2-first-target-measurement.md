# M2 first fixed-candidate target measurement

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
