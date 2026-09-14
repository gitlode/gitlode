# Cumulative validation of corrected M1 candidate

## Assignment and fixed candidate

Use a separate human-started validation conversation. Trunk has accepted R1 and retained R2
acceptance from the [independent re-review](opentelemetry-m1-r1-r2-review.md#focused-re-review-outcome).
This assignment verifies the cumulative corrected product on Windows and Linux and preserves its
tested package identity. It is not implementation, formal performance acceptance, PR creation or merge.

- Fixed validation source and harness: `6fd46d340c57dd706a8483bb131693b47d9efe08`.
- Accepted R1 correction: `c3e74a292cd459c1fe455803bbe66f6553a192ad`.
- Accepted R2: `0354bab6bcf8e2f78bb6dcb0d23843576504e869`.
- Historical M1 candidate: `681a1a5b53bd0aa957dae72d9fd9684da7ff467a`; do not relabel its evidence.

The fixed source differs from accepted c3e74a2 only in three handoff documents. Verify this and the
source OID before execution. Subsequent trunk documentation commits do not change the fixed target.
Record actual planning branch/HEAD/worktree state at entry and exit. Work from isolated detached
checkouts of the fixed source; do not rebuild in the shared planning worktree or update shared refs.
Use a fresh Git bundle to transfer local commits to Linux if they are not available remotely.

Read `AGENTS.md`, the [recovery plan](instrumentation-opentelemetry-recovery-plan.md), canonical
[build/test/release guidance](../contributing/build-test-release.md), and
[prior M1 evidence](opentelemetry-m1-validation-result.md). This run replaces neither prior records
nor their limitations; it adds evidence for the production changes introduced by R1/R2.

## Environments and bounded operation

This work includes dependency installation, full tests, release builds and installed-package tests
on two platforms, plus artifact transfer. External execution can take substantial time independently
of model reasoning. Tell the human before starting, report the active stage regularly, and record
command durations and exit codes. Do not wait indefinitely on stalled commands or automatically rerun
until a favorable outcome. Preserve the first failure and diagnose its concrete cause before retrying.
If an implementation defect is found, return it to trunk without changing source or acceptance gates.

Use the existing Ubuntu WSL2 private Linux toolchain on native ext4, as documented in the
[M0 environment continuation](opentelemetry-m0-result.md#prepared-linux-environment-for-continuation).
Verify actual Node/npm/Git/platform versions and paths; do not assume an interactive shell activated
the toolchain. Do not modify Docker Desktop, global WSL settings or sealed toolchain/release snapshots.
Use a new unique run directory below `/home/t-wakabayashi/gitlode-performance/` on Linux and a fresh
Windows checkout such as `D:\gitlode_work\m1-corrected-<timestamp>-6fd46d3-windows`.

Set Windows TEMP/TMP and Linux TMPDIR outside their source checkout, with separate npm caches.
The old Windows attempt failed because fixtures traversed parent metadata when TEMP was inside
the checkout. Do not repeat that layout. Keep dependency installation out of archived runtime inputs.
Request environment-specific tool permission if required; no need to install new infrastructure.

## Commands and evidence

On each platform, in its fixed clean checkout:

```text
npm ci
npm run validate:release
npm run typecheck:telemetry-release-acceptance -w gitlode
git diff --check
```

Capture complete stdout/stderr and exit status. `validate:release` already includes dependency,
format, lint, architecture/development build, schema, full source tests, release build, publint and
installed-package system tests. Do not separately repeat successful stages without a new reason.
Confirm the actual command definition at the fixed revision. Never invoke `npm run release`,
`changeset:publish`, npm publish, Version PR automation or the formal performance commands.

Record actual test files/counts/skips instead of assuming the old totals. Windows Linux-only skips
are expected only where the test definition specifies them; identify their cases and show Linux
executed the corresponding coverage. R1 real-composition and R2 observable-callback tests must be
included. State production checked typing separately from the pre-existing test/tooling noCheck.
Verify installed-package coverage includes both Git adapters, line diff, dynamic plugin, schema,
worker/CLI execution and TypeScript consumer behavior. The live acceptance record remains blocked.

After successful validation, preserve the release package on each platform and a complete Linux
production-only installed consumer with lockfile and runtime dependency closure. Follow the prior
M1 preservation method: bind package hashes to the bytes used by installed-package validation;
if the package must be repacked, compare hashes before/after. If any intervening command rebuilt
development output, rebuild release output and revalidate affected package bytes before sealing.
Do not use a mutable development dist as the preserved candidate. Retain Linux modes/symlinks and
verify a fresh extraction of the runtime archive against its file/mode/link inventory.

Save command ledger, environment and toolchain identities, source/harness Git bundle, lockfile hash,
test results, package/runtime hashes and file inventories in a new archive under
`D:\gitlode_test\m1-corrected-<timestamp>-6fd46d3`. Generate an evidence SHA-256 manifest and verify
all its entries after transfer; report the manifest's own hash separately. Keep source checkouts
clean and archives immutable. Do not overwrite M0 or the original M1 archives, recalibrate fixtures,
or attribute older measurements to this candidate. This is a functional validation candidate;
formal M2 measurement inputs will be fixed on the resulting integration history after squash.

## Return and next owner

Append the result below and save a documentation-only checkpoint on `feature/otel-redesign` after
format write/check and diff checks. Return source and final documentation OIDs, platform command
ledgers, actual pass/fail/skip counts, failures/reruns, archive paths/hashes, byte-to-test bindings,
production delta from the original M1 candidate and remaining limitations. Do not mark M1 complete,
change the acceptance record or start an independent review yourself.

Trunk will inspect the outcome, assess preserved evidence and the actual integration-base delta,
and prepare any remaining integration review/cleanup before requesting human PR-creation approval.
The human alone chooses and performs merges. Retain T13B/T13 and archive refs. No push or PR is
authorized by this validation assignment.

## Validation outcome

Pending. R1/R2 are accepted; cumulative corrected-candidate validation and M1 integration are not.
