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
child evidence is unavailable. Repository target sidecar integration remains pending until its
caller is wired into the timed target workflow.

The aggregation command requires `--fixture aggregation_scale` and `--artifacts <directory>` and
writes `aggregation-scale.json`. Each artifact records the manifest recipe hash, source revision,
built collector runner path, four raw child outcomes, N/4N report measurements, RSS deltas, volume
evaluation, and pass/fail/inconclusive reasons. Children execute built JavaScript with `node`; the
timed repository CLI is never used for collector timing or memory evidence. Missing, malformed,
failed, or signal-terminated children are inconclusive. A supported RSS measurement that violates
the 8 MiB N-to-4N growth limit is a failure. Platforms without external child RSS support, such as
the current Windows test environment, therefore produce an inconclusive artifact and nonzero exit.

## Reference workflow

After preserving a clean legacy release bundle, calibrate all five manifest targets separately:

```bash
npm run performance:calibrate -w gitlode -- --fixture commit_heavy_repository --adapter isomorphic-git --baseline-cli /abs/legacy/dist/index.js --legacy-revision <legacy-git-oid>
```

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
Formal fail or inconclusive results are saved and then return a nonzero command status. Measurement
never changes the manifest. Re-run environmental interference with the unchanged manifest and do
not relax catalog thresholds.
Malformed checkpoint, missing `generatedAt`, invalid filename, unreadable JSONL, and incorrect
repository path are structured behavioral errors. Available raw runs, normalized evidence, capture
errors, fixture/revision identity, and target-scoped provenance are written before a nonzero exit.
This artifact guarantee begins after manifest and CLI validation, when repository/child workflow
preparation starts. Expected preparation, rotation setup, child capture, and behavior-validation
failures are covered; an unreadable manifest or invalid command line may exit without an artifact.

The checked-in targets remain explicitly incomplete because this shared container is not an
approved reference host. No formal calibration or legacy artifact has been claimed. T13 remains
blocked until all targets are calibrated and the reference legacy artifacts are reviewed.
