# Telemetry performance harness

The test/development-only harness implements the procedure whose fixture semantics, measurements,
thresholds, and incompatibility rules are canonical in
[`../design/telemetry-catalog/performance.yaml`](../design/telemetry-catalog/performance.yaml).
It launches a clean release bundle as a child process, always adds `--quiet`, samples that child's
RSS externally on Linux, and gives every run a fresh output directory on the repository's temporary
filesystem. `target_on` additionally receives `--profile`; quiet mode suppresses presentation, not
collection.

## Reference workflow

From the repository root, first create clean release bundles (or preserve the legacy bundle at a
separate path), then calibrate each repository fixture on the designated quiet reference host:

```bash
npm run build:clean
npm run build:release
npm run performance:calibrate -w gitlode -- --fixture commit_heavy_repository --adapter isomorphic-git --baseline-cli /absolute/path/to/legacy/dist/index.js
```

Repeat calibration for both repository fixtures and adapters. Calibration alone may update
`test/fixtures/performance/manifest.json`; it doubles the workload and freezes the first candidate
whose seven-run legacy median is in the cataloged window. Commit the completed manifest before
migration measurement.

Run a normal comparison without modifying the manifest:

```bash
npm run performance:measure -w gitlode -- --fixture commit_heavy_repository --adapter git-cli --baseline-cli /absolute/path/to/legacy/dist/index.js --candidate-cli /absolute/path/to/target/dist/index.js --candidate-state target_off --artifacts /absolute/path/to/artifacts
```

Use `--candidate-state target_on` for the profile comparison. Artifacts default to
`packages/gitlode/.benchmark-artifacts/` and contain raw warmups, measured pairs, order, child exits,
RSS samples, output observations, fingerprints, behavioral equivalence, statistics, and evaluation.
Preserve legacy artifacts with the baseline revision and completed manifest. Re-run after
interference or an inconclusive result; never edit thresholds or recalibrate during migration.

The checked-in manifest is intentionally **incomplete** until a stable reference host is nominated.
Container scheduling and shared-host interference make this branch environment unsuitable for
freezing a 10–30 second baseline. A pass takes 18 child runs per pilot, plus additional pilots for
every doubling, fixture, and adapter. T13 must not start until the completed manifest and
`legacy_off` artifact set have been reviewed and stored.
