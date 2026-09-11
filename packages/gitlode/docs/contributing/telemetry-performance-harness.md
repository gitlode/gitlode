# Telemetry performance harness

The development-only harness implements the procedure whose fixture semantics, measurements, and
thresholds are canonical in
[`../design/telemetry-catalog/performance.yaml`](../design/telemetry-catalog/performance.yaml). It
supports the bundled release CLI, adds `--quiet` to every child, and adds `--profile` only for
`target_on`. Each run has a fresh output and checkpoint file on one temporary filesystem.

Repository targets are commit-heavy and file-heavy with either adapter, plus plugin-heavy fixed to
`isomorphic-git`. The plugin recipe creates one deterministic local package, registers it under
multiple namespaces, and exercises success and skip without network, IPC, or injected scripts.
`aggregation_scale` is a fixed Git-independent recipe. Run it with the dedicated
`performance:aggregate` development-only workflow; it launches four independent collector
children, records reports and RSS evidence separately, and returns inconclusive/nonzero when RSS or
child evidence is unavailable. Repository target profiling uses a separate development-only sidecar
child around the release `worker-entry.js`; its output and checkpoint are isolated from the timed
CLI workflow. For `target_on`, this sidecar and its `ProfileReport` are required. `target_off` and
`legacy_off` record a not-applicable sidecar. Repository acceptance is evaluated independently of
aggregation N/4N/RSS growth: report schema, signal status, diagnostics, the 1 MiB report limit,
and prohibited host spans are propagated into the top-level evaluation. Runtime Git command-start
counts are not inferred from span counts; T09 command-parity tests remain separate contract
evidence.

The aggregation command requires `--fixture aggregation_scale` and `--artifacts <directory>` and
writes `aggregation-scale.json`. Each artifact records the manifest recipe hash, source revision,
built collector runner identity/hash, four raw child outcomes, N/4N report measurements, RSS deltas, volume
evaluation, and pass/fail/inconclusive reasons. Children execute built JavaScript with `node`; the
timed repository CLI is never used for collector timing or memory evidence. Missing, malformed,
failed, or signal-terminated children are inconclusive. A supported RSS measurement that violates
the 8 MiB N-to-4N growth limit is a failure. Platforms without external child RSS support, such as
the current Windows test environment, therefore produce an inconclusive artifact and nonzero exit.

## Reference workflow

Run the `performance:*` npm commands in Linux (including WSL2), with Linux-native Node, Git,
temporary storage, and release snapshots. These commands enter `telemetry-performance-supervised.ts`;
`telemetry-performance.ts` is the internal worker, not the supervised operator entrypoint.
The supervisor prints stage, fixture, adapter, quantity, iteration, state, PID, and elapsed time,
including a heartbeat every five seconds. Preparation defaults to a 30-minute deadline; each
execution or processing stage defaults to five minutes. Explicit positive-integer overrides are
`--preparation-timeout-ms`, `--execution-timeout-ms`, and `--processing-timeout-ms`. The chosen limits
are recorded. Do not increase them as an automatic retry after an unexplained stall.

Use a fresh artifact directory per command. Inspect its `supervision-*.json` file with
`kind: performance-supervision` together with the normal workflow artifact. `completed` only means
the worker finished its protocol; a formally inconclusive worker can still exit 2 with completed
supervision. Deadline, interruption, or abnormal-exit evidence invalidates the attempt even if some
formal-looking files were written earlier. Completed raw runs remain diagnostic evidence and cannot
be stitched into another attempt. Bounded `.diagnostic.log` files may contain local paths; keep them
separate from formal evidence. For cleanup and evidence contracts see
[execution supervision](../design/telemetry-performance.md#execution-supervision).

Final evidence persistence is also supervised. A raw diagnostic-log failure produces exit 2 but
still permits a terminal inconclusive snapshot. If the first terminal snapshot write fails, the
supervisor makes one recovery write with the persistence failure identified; it does not rerun any
workflow stage. When snapshot storage remains unwritable, stderr says that the terminal artifact is
unavailable and exit 2 remains authoritative. A previously written `running` snapshot must not be
treated as finalized in that case. Preserve earlier completed workflow artifacts for diagnosis, but
do not admit them into a formal attempt whose supervision did not finish.

After preserving a clean legacy release bundle, calibrate all five manifest targets separately:

```bash
npm run performance:calibrate -w gitlode -- --fixture commit_heavy_repository --adapter isomorphic-git --baseline-cli /abs/legacy/dist/index.js --legacy-revision <legacy-git-oid>
```

Calibration first doubles the manifest's initial integer quantity until it brackets the ten-second
lower threshold. It then performs deterministic integer binary search within that bracket and
selects the smallest permitted quantity whose observed median is at least ten seconds. A doubling
step above thirty seconds is therefore a refinement trigger, not by itself a calibration failure.
The selected median must still be at most thirty seconds. An initial quantity above thirty seconds,
or adjacent integer quantities below ten and above thirty seconds, is a terminal no-acceptable-size
failure.

Each pilot uses two warmups and seven measured runs. Child or behavior failure or median absolute
deviation above five percent makes the attempt inconclusive without automatic retry. Classification
is non-monotonic, and therefore also inconclusive, only when a smaller completed quantity is at or
above ten seconds while a larger completed quantity is below ten seconds; raw medians need not be
strictly increasing. After every completed pilot the harness atomically writes a progress artifact
with the quantity, unrounded median and deviation, artifact-safe raw runs, validation results,
normalized behavior, revisions, and target recipe hash. Expected failures after workflow preparation
preserve that history before returning nonzero. Progress from an interrupted attempt is diagnostic
only and must not be resumed or combined with a new formal attempt.

The progress filename is `<fixture>-<adapter>-calibration-progress.json`; attempts remain in
execution order. Atomic persistence writes and replaces a temporary sibling on the same filesystem.
Terminal unsuccessful attempts use `<fixture>-<adapter>-calibration-failure.json` and distinguish
failed selection from inconclusive measurement. Both artifacts exclude temporary repository,
output, and checkpoint paths. The successful calibration artifact includes the same complete pilot
history rather than retaining only the selected pilot.

Calibration alone updates the selected target. Quantities express the **final total commit count**,
including the five commits in the T00A base recipe. The manifest is globally ready only when both
repository fixtures with both adapters and plugin-heavy/isomorphic-git are complete, with an
environment reference and calibration artifact reference for every target.

`calibrationTargets[*].quantities` is the sole authoritative source for repository execution; there
is no second fixture-wide quantity that can overwrite adapter-specific calibration. Each calibration
artifact uses a target-scoped recipe hash over schema version, recipe revision, target identity, and
that target's selected quantities. Later calibration of another target therefore cannot invalidate
it. A separate sealed manifest hash exists only after the exact five-target matrix is complete.
Environment fingerprints store these as distinct `calibrationTargetRecipeHash` and optional
`sealedManifestHash` fields. The removed `fixtureManifestHash` name is not reused for a target hash.
Calibration uses its target hash; legacy capture and both comparisons use the selected target's hash
and include the sealed hash only when the final manifest is complete.

Capture legacy baseline artifacts without a target implementation:

```bash
npm run performance:capture-legacy -w gitlode -- --fixture commit_heavy_repository --adapter isomorphic-git --baseline-cli /abs/legacy/dist/index.js --legacy-revision <legacy-git-oid> --artifacts /abs/artifacts
```

Run disabled overhead only after that target is complete. This compares the legacy CLI with profile
off against the target CLI with profile off:

```bash
npm run performance:measure -w gitlode -- --comparison disabled_overhead --fixture commit_heavy_repository --adapter git-cli --baseline-cli /abs/legacy/dist/index.js --legacy-revision <legacy-git-oid> --candidate-cli /abs/target/dist/index.js --candidate-revision <target-git-oid> --artifacts /abs/artifacts
```

Run profile overhead with the same target CLI and revision on both sides; the harness supplies
`target_off` without `--profile`, then `target_on` with `--profile`:

```bash
npm run performance:measure -w gitlode -- --comparison profile_overhead --fixture commit_heavy_repository --adapter git-cli --candidate-cli /abs/target/dist/index.js --candidate-revision <target-git-oid> --artifacts /abs/artifacts
```

Artifacts record separate baseline, candidate, and benchmark
script revisions; the completed manifest/hash and calibration provenance; fingerprints; raw
warmups/measured pairs; child exit and RSS samples; output/checkpoint behavior; and evaluation.
Legacy artifacts also contain normalized checkpoint/filename evidence plus SHA-256 for each exact
JSONL file, so determinism can be audited without retaining temporary paths or session timestamps.
Capture accepts a baseline only when all measured runs agree and the fixture-specific commit,
rotation, size-skip, and plugin invariants hold. File-heavy execution derives `--rotate-lines` from
the deterministic change volume, supplies `--max-diff-size`, and requires the manifest's exact file
rotation count and at least one skipped diff.
Formal fail or inconclusive results are saved and then return a nonzero command status. Comparison
measurement never changes the manifest. Calibration changes only its selected target after
successful terminal selection. Re-run environmental interference with the unchanged manifest and
do not relax catalog thresholds.
Malformed checkpoint, missing `generatedAt`, invalid filename, unreadable JSONL, and incorrect
repository path are structured behavioral errors. Available raw runs, normalized evidence, capture
errors, fixture/revision identity, and target-scoped provenance are written before a nonzero exit.
This artifact guarantee begins after manifest and CLI validation, when repository/child workflow
preparation starts. Expected preparation, rotation setup, child capture, behavior-validation,
calibration-window, stability, monotonicity, and safe-integer failures are covered; an unreadable
manifest or invalid command line may exit without an artifact.

The checked-in targets remain explicitly incomplete until formal reference calibration succeeds.
No environment or baseline is considered accepted merely because a local command was run; the
target-scoped artifacts and manifest entries carry that provenance. T13 remains incomplete until all
targets are calibrated and the reference legacy artifacts are reviewed.
