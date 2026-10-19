# Performance typecheck clean-build correction

## Cause and scope

Starting local and actual remote target: `8e9cae6ce67ac208677d3805f2c94f88cc6d2b89`.
Both CI runs 39214995399 (8e9cae6) and 39213389999 (9ed7156) failed at the performance typecheck with exactly 24 TS2307, 23 TS7006 and 2 TS2339 diagnostics; later validation steps did not run.

The checker consumes internal-contracts and internal-foundation package exports whose types live in generated dist. Neither the previous workspace command nor its callers built those dependencies before checking. The relocation introduced the CI/root gate before architecture's development build.

The earlier clean-install review ran build:dev before the checker, as its retained operator scripts prove. Its successful checks remain valid for that order, but did not establish the CI order. The earlier unconditional integration recommendation is superseded by this correction and the requirement to confirm the final pushed SHA's complete CI.

Implementation: `239a507f7481c0c1234221feff1cbb604edb013e`.
The performance workspace command now runs `npm run build:dev -w @gitlode/internal-contracts && tsc -p tsconfig.json`. Existing project references build foundation as well. The direct workspace, root typecheck, CI and validate:release all reach this command. No checker options, test assertions, dependency versions, lockfile, thresholds or product source changed. Contributor guidance documents the prerequisite.

## Independent review

Separate reviewer `/root/ci_fix_review` accepted the two-file correction with no mandatory findings. It checked project references, the three entrypoints, unchanged strict checker, lack of cycles, and command safety. Review was read-only; runtime evidence below belongs to trunk verification.

## Clean verification

Linux Node 22.23.1/npm 10.9.8/Git 2.53.0; Windows Node 22.23.1/npm 11.11.0. Existing committed lockfile used unchanged. Installation lifecycle was checked; neither validation chain invokes publication, formal measurement or handle audit.

1. Linux isolated direct checkout: npm ci, assert contracts/foundation dist absent, run old workspace typecheck. All 49 original diagnostics reproduced. Switch only to the fixed commit, assert both dist directories still absent, run corrected workspace typecheck. Pass, zero remaining diagnostics. Thus all observed implicit-any/unknown-property failures disappear with dependency generation; no source typing repair was required.
2. Separate Linux isolated release checkout at the fixed commit: npm ci, assert contracts/foundation/product dist absent, run unmodified root npm run validate:release without a manual preceding build. Entire chain passed: dependency/format/lint, both tooling typechecks, architecture, schemas, source tests, release build, publint and installed-package system test.
3. Source test result: 104 files passed / 1 skipped; 1,409 tests passed / 9 skipped. These are the existing Windows-only standalone launcher cases on Linux. Nested intentional failure/timeout probes appear in the log; the outer suite and command exit are successful. No newly added skip or weakened condition.
4. Installed-package checks passed both Git adapters, worker/CLI, line diff, dynamic plugin, schema, TypeScript consumer and missing-enabled-asset sensitivity. Consumer TypeScript 7.0.2.
5. Windows separate clean checkout: npm ci, assert contracts/foundation dist absent, corrected workspace typecheck passed. Windows full root/installed campaigns were not repeated; this is not new Windows containment acceptance.
6. Root format:write/check and diff check passed. Isolated source status and lockfile are unchanged.

Evidence roots: `/tmp/gitlode-typecheck-fix-pj7kE0` (two independent Linux checkouts and full logs), and the Windows path recorded in `.cache/layout-ci-fix/windows-root.txt`. Original CI logs and invocation script are retained in `.cache/layout-ci-fix`. No historical F2/legacy/harness or prior failure evidence was modified.

## Delivery boundary

This documentation checkpoint has identical implementation to 239a507. After normal push, trunk must check the exact delivery SHA's GitHub CI through all subsequent steps and record its run URL/conclusion in the final response and local evidence. Do not substitute an older SHA's success. No PR, parent merge, release or performance acceptance is authorized by this result.
