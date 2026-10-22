# Performance verification workspace

This is development-only tooling, not part of the published gitlode runtime.

- `scripts/`: supervised operator entrypoints, internal workers and calibration/process tooling.
- `support/`: evaluation/fixture implementation and the unfinished Windows launcher.
- `test/`: dedicated tests of this infrastructure (including unit tests of the harness).
- `fixtures/manifest.json`: current input specification; no calibration is implied.

Use the [repository verification guide](../README.md) and canonical [harness guide](../../packages/gitlode/docs/contributing/telemetry-performance-harness.md). Windows handle audit, ownership completion and formal Linux measurement require separate authorization; relocation grants none.

Under the [v0.13.0 convergence policy](../../packages/gitlode/docs/design/telemetry-v013-acceptance.md), this legacy infrastructure is optional. Root product tests and release validation do not run its dedicated tests or typecheck. Use `npm run test:performance` or `npm run typecheck:performance` explicitly when authorized; these are infrastructure checks, not new performance measurements. Existing product tests that consume shared helpers still run.
