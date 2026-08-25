# Telemetry performance harness

The development-only harness implements the procedure whose fixture semantics, measurements, and
thresholds are canonical in
[`../design/telemetry-catalog/performance.yaml`](../design/telemetry-catalog/performance.yaml). It
supports the bundled release CLI, adds `--quiet` to every child, and adds `--profile` only for
`target_on`. Each run has a fresh output and checkpoint file on one temporary filesystem.

Repository targets are commit-heavy and file-heavy with either adapter, plus plugin-heavy fixed to
`isomorphic-git`. The plugin recipe creates one deterministic local package, registers it under
multiple namespaces, and exercises success and skip without network, IPC, or injected scripts.
`aggregation_scale` is a fixed Git-independent N/4N recipe and pure evaluator; selecting it in a
command reports that its dedicated T13 collector child runner is not implemented rather than
routing it through a repository benchmark.

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
is no second fixture-wide quantity that can overwrite adapter-specific calibration. The immutable
fixture recipe hash covers schema version, recipe revision, all selected target quantities, and the
aggregation recipe, but excludes mutable completion status and artifact references. Calibration
fingerprints and artifacts store that recipe hash after the selected quantity has been applied.

Capture legacy baseline artifacts without a target implementation:

```bash
npm run performance:capture-legacy -w gitlode -- --fixture commit_heavy_repository --adapter isomorphic-git --baseline-cli /abs/legacy/dist/index.js --legacy-revision <legacy-git-oid> --artifacts /abs/artifacts
```

Run comparison measurement only after that target is complete:

```bash
npm run performance:measure -w gitlode -- --fixture commit_heavy_repository --adapter git-cli --baseline-cli /abs/legacy/dist/index.js --legacy-revision <legacy-git-oid> --candidate-cli /abs/target/dist/index.js --candidate-revision <target-git-oid> --candidate-state target_off --artifacts /abs/artifacts
```

Use `target_on` for profiling comparison. Artifacts record separate legacy, candidate, and benchmark
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

The checked-in targets remain explicitly incomplete because this shared container is not an
approved reference host. No formal calibration or legacy artifact has been claimed. T13 remains
blocked until all targets are calibrated and the reference legacy artifacts are reviewed.
