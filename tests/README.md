# Repository verification code

- `system/`: private installed-package checks through the public CLI/API/schema. No product deep imports.
- `performance/`: private calibration, comparison, fixture lifecycle, process supervision and experimental Windows launcher tooling, plus its dedicated tests and assets. It may exercise internal product seams; this does not relax the installed-package boundary.
- `support/`: Node-only repository generation, behavioral comparison and fixture ownership helpers shared by product regression tests and performance tooling. It must not depend on either suite. Checked by the performance TypeScript project and formatted/linted by root commands.

Product unit/regression tests remain in `packages/*/test`. In particular recorder, collector, report, worker and behavioral baseline assertions retain their product ownership. Some product regressions consume performance evaluators/fixtures to verify that the formal consumer understands genuine product output; this is an explicit test-only dependency, with no reverse import into product tests.

See [performance commands and safety](../packages/gitlode/docs/contributing/telemetry-performance-harness.md), [Windows prototype limits](../packages/gitlode/docs/contributing/windows-standalone-launcher.md) and [build/release](../packages/gitlode/docs/contributing/build-test-release.md).

Root `npm test`, watch and coverage discover product projects only. Legacy performance infrastructure is retained for explicit use through `npm run test:performance`; it is not a v0.13.0 acceptance prerequisite. `npm run typecheck:performance` checks tooling/shared support; `npm run typecheck:windows-launcher -w @gitlode/performance-tests` checks the experimental launcher and its test closure. `tsconfig.fixture-lifecycle.json` preserves the existing wider focused check, without treating historical diagnostics as new relocation failures.

`npm run performance:* -w gitlode` remains a compatibility command; the implementation now lives in `tests/performance/scripts`. The private workspace also exposes these commands. Relative operator arguments still resolve from the caller's cwd; use absolute snapshot/artifact paths. Default manifest and artifact directory now belong to the performance workspace. Never run a measurement or native Windows campaign just to check discovery.

Saved JSON receipts under `performance/support/windows-launcher*` are historical evidence: their old paths/hashes describe old revisions and are intentionally unchanged. They do not validate the relocated source. Immutable runtime archives and handoff history are not rewritten by relocation.
