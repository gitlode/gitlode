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
Formal fail or inconclusive results are saved and then return a nonzero command status. Measurement
never changes the manifest. Re-run environmental interference with the unchanged manifest and do
not relax catalog thresholds.

The checked-in targets remain explicitly incomplete because this shared container is not an
approved reference host. No formal calibration or legacy artifact has been claimed. T13 remains
blocked until all targets are calibrated and the reference legacy artifacts are reviewed.
