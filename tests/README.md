# Repository verification code

- `system/`: private installed-package checks through the public CLI/API/schema. No product deep imports.
- `support/`: Node-only repository generation, behavioral comparison and fixture ownership helpers
  used by product regression tests. They must not import test suites or product internals.

Product unit/regression tests remain in `packages/*/test`. Recorder, collector, report, worker and
behavioral baseline assertions retain their product ownership. Root test commands discover those
product projects; installed-package checks have their own public-package boundary. See the
[build guide](../packages/gitlode/docs/contributing/build-test-release.md).

`npm run typecheck:test-support` checks the shared helpers independently with strict TypeScript.
CI and `validate:release` invoke it; root formatting and lint also cover this directory.

The former performance workspace and standalone Windows launcher are retired. Shared fixture helpers
remain because product behavioral regressions still need deterministic repositories, output
equivalence and owned-process cleanup. `TestFixtureOwner` may be removed only when its consumers
have equivalent bounded cancellation, awaited child termination and safe cleanup (or no longer
spawn processes). Retaining this helper does not claim that historical Windows descendant ownership
limitations were solved. Preserve an uncertain root rather than deleting potentially active files.
