# M2 disabled SDK boundary integration evidence

## Status and authority (2026-10-08)

D1 and D2 are independently accepted for source/lifecycle and release boundary only. Integration
preparation started clean at `1faf787ad67d34c8314996b4dde4035bce603b88` on
`feature/otel-redesign_M2_disabled`. Actual remote child matched that checkpoint. Local parent,
tracking parent and actual remote `feature/otel-redesign_M2` are
`57fbfdaf11761cf39ce0b403a497ad5cc5fa7395`. No PR creation or merge is authorized.

This note replaces the completed design/implementation/review packet. It records attribution and
remaining work; canonical contracts remain in [telemetry](../design/telemetry.md),
[verification](../design/telemetry-verification.md), [architecture](../design/architecture.md),
[domain design](../design/domain-design.md), [plugins](../design/plugins.md),
[build/release](../contributing/build-test-release.md), [usage](../usage.md) and
[profiling](../profiling.md). These already describe the accepted invalid no-op root, explicit-parent
and context semantics, SDK-free owner with lazy Enabled implementation, partial cleanup, memoized
finalization and emitted/installed verification. No empirical RSS improvement is claimed.

## Exact history and acceptance targets

The historical path for every packet below is
`packages/gitlode/docs/handoff/opentelemetry-m2-disabled-sdk-design.md`.
Retrieve exact history with `git show <full-OID>:<historical-path>`; completed assignments there are
historical, not active authority.

| Checkpoint                            | Full OID                                   |
| ------------------------------------- | ------------------------------------------ |
| Approved design                       | `4adfe248e95deba40ea70e33f707eb4a0ddc091c` |
| D1 base                               | `8d622af2cfc435c06aac3ab0f8b16b5bbaf5e206` |
| D1 implementation (acceptance target) | `04dc187573a63bd2110c381306b26fd050d53220` |
| D1 outcome                            | `e34b81429492c7246b4e19c5b1257bf762c986a2` |
| Independent D1 accepted review        | `f35e0e11654574be72868c380c8b58a145bea36e` |
| D2 base                               | `a2a487ed9a01daed6f2564f44595a5996a8cf49d` |
| Historical helper maintenance         | `dedc5363e3a56de40637481e4b83fc3bd801ee60` |
| D2 implementation (acceptance target) | `6e84279819ce50e961ef99dc92ffa5a90219bc34` |
| D2 outcome                            | `6c8b3a4ea96ed2b61855777f220183ffbdababa2` |
| D2 delivery                           | `e3fa36631e4dffbe4e85f5aae470ffd75cbcddb8` |
| Independent D2 accepted review        | `0b10f3057ddfa321c79a05951d27df9ec2c6cdee` |
| Trunk disposition / preparation start | `1faf787ad67d34c8314996b4dde4035bce603b88` |

Both reviews have no mandatory correction. D1 preserves application results/exceptions through real
owned-resource failures and all nine no-op composition choices. D2 verifies recursive emitted
static/lazy/external ownership for index, worker-entry and plugin-api; positive ESM/CJS guards in
actual host/worker; plugin-owned SDK attribution; Disabled success under denial; Enabled positive
schema-2 observations; missing lazy asset sensitivity; actual constructor sentinels; aggregation
inventory/dynamic closure and strict durable command wiring. Controlled fixture coverage is finite;
declared external dependency closure is conservative. Optional future worker-thread attribution
hardening is recorded in the exact D2 review, not a current blocker.

Maintenance retired only `packages/gitlode/docs/handoff/m2-first-target-diagnosis/derive.cjs`.
Its original blob is `f6a8f88772b1a96cc0624c24f578ee4d9751819f`, retrievable from the D1 review
OID and original path. The [first-target retrieval recipe](opentelemetry-m2-first-target-measurement.md)
restores exact bytes outside checkout for read-only derivation from saved artifacts. Derived JSON,
sealed archives and lint/orphan rules remain unchanged; no active consumer was found in D2 review.

## Evidence attribution and retained failures

D1 implementation reported build, strict product typing and 10 files / 172 tests passing. Independent
D1 review ran build, strict typing and affected suites plus behavioral baseline: 11 files / 184 passed /
0 skipped. Its bounded real shutdown-rejection probe passed 1 test / 26 filtered skips and restored
source bytes. Reported D1 negative mutations detected bypassed Disabled selection (1 failure), global
tracer delegation (2 failures), and premature finalization (1 failure, 54 negative-variant unhandled
stack errors). Reentry was subsequently bounded; these mutations were not independently replayed.
Initial prefer-const, literal data-URL resolution and cp932 editing failures remain in exact history.
D1 broad lint/architecture failures were the pre-existing derive.cjs obstruction, not waived passes;
D2 maintenance resolved it and D2 full lint/architecture passed.

D2 fixed campaigns used clean detached source, external TEMP, bounded supervisors and cleanup:

| Saved campaign, not rerun in preparation                   | Result                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Windows: Node 22.23.1 / npm 11.11.0 / Git 2.45.1.windows.1 | npm ci and validate:release pass; 98 files / 1,314 passed / 28 Linux-only skips |
| Linux/ext4: Node 22.23.1 / npm 10.9.8 / Git 2.53.0         | npm ci and validate:release pass; 98 files / 1,342 passed / 0 skipped           |

Both chains include graph, constructor, aggregation, publint and installed assertions. Packing follows
release bundling without a development rebuild. Linux nested intentional failures are passing
retention-test fixtures. D2 development retains first native TS import/config typing/manifest-root
resolution failures, unsupported TS 7 compiler-API assumption, strict/lint diagnostics, leftover
release-chunk architecture failure, accumulated timestamp-output comparison failure, empty Git
`show --output` retrieval and cp932 edit failure. Corrections and logs remain in the sealed archive;
none is represented as a successful first run. Forbidden eager collector ownership and extra
MeterProvider mutations failed distinct checks and were restored, not repeated in preparation.

Independent D2 review ran Windows build:dev, strict release-boundary/system typing, 2 files / 3 tests
with no skips, build:release and one installed-package campaign (11 guard cases plus existing
assertions). It did not rerun full validate:release or Linux. No independent command failed.
Accepted D1 global/resource evidence, D2 reported negative sensitivity, saved full OS campaigns and
independent D2 finite execution remain separate evidence categories.

### Sealed campaign identity

Archive: `D:/gitlode_test/m2-d2-boundary-20261007T173933`.
Recorded Linux copy:
`/home/t-wakabayashi/gitlode-performance/m2-d2-boundary-20261007T173933/archive`.
Manifest `sealed-manifest.json` SHA-256:
`ac3d3796276e881e6e7eec0c5652628a83ab4f63b09110fd64c78a24d992a33c`.
Preparation independently rehashed all 155 files / 36,313,274 bytes without mismatch and checked
source tree `507a9cbd7e79f25668c4b4f56f01fdec0842a85a` against fixed Git source.
`implementation.patch` matches exact maintenance-to-fixed Git diff bytes (48,177), not base-to-fixed;
the additional base delta is the historical helper deletion. Source-identity inventory matches that
scope. No archive was appended to. Separate Linux/ext4 archive rehash is not claimed.

Source identity/patch, preflight/commands/final records, validate-release logs, installed identities,
22 guard traces, normalization and development first-failure/negative logs remain in that archive.
Windows tarball SHA-256:
`b0405d2a753be0aac367e465531aa5d49f172644270dd4fa32cb2e8924e25bc7`.
Linux tarball SHA-256:
`e4d37c208cd6e6dba3ab887efa097e9c096ec97c41611a4ff8047732a845af45`.
Six runtime JS hashes agree across OSes and independent Windows build; per-file values are in
`runtime-comparison.json` and installed package identities. Packing-byte differences were not diagnosed.
Registry consumers used SDK 2.12.0 / semantic-conventions 1.43.0 / TypeScript 7.0.2; repository-lock SDK
remains 2.10.0. This is not a dependency upgrade. Removed tarballs/consumers are not a retained frozen
runtime or complete dependency closure, and cannot now be independently rehashed as such.

### Independent review log preservation

Available D2 temporary review logs were copied and byte-compared into a new separate archive:
`D:/gitlode_test/m2-disabled-integration-review-20261008-verified`.
Its 31 files / 8,474,794 bytes include command logs, installed traces and package identity.
Manifest `sealed-manifest.json` SHA-256:
`db0e77196d9b19e50b121d2d0f6411082d4c25813fc7f8c49c20bb61115fdcd3`.
This preserves available logs attributed to review `0b10f30`; copying does not constitute a new run.
D1 standalone independent-review logs were not located in the available TEMP search; committed exact
review attribution remains, with no campaign rerun to reconstruct logs.

The first preservation attempt remains in sibling `m2-disabled-integration-review-20261008`.
Its manifest is INVALID: short TEMP versus expanded FullName produced incorrect relative paths.
It is retained as operator-failure evidence, never used as a sealed evidence source. The verified
archive was created separately; neither existing archive was modified afterward.

## Rehearsal, proposal and remaining gates

Source is the documentation checkpoint following this note on `feature/otel-redesign_M2_disabled`;
base is actual remote `feature/otel-redesign_M2` at
`57fbfdaf11761cf39ce0b403a497ad5cc5fa7395`. Base is an ancestor of source, so a squash onto that base
has exactly the source tree. Final full source/tree OIDs are bound in the return after commit/push,
avoiding a self-referential document hash. Repeat `git merge-tree --write-tree <base-OID> <source-OID>`
and compare its output with `git rev-parse <source-OID>^{tree}` without updating any ref.

Validated `6e84279` to preparation start changes exactly four Markdown files: telemetry-verification,
handoff README, recovery plan and superseded design packet. Preparation only replaces that packet
and updates README/recovery/RSS experiment links. Final delta is documentation only; no implementation,
package/dependency/export/test/config delta or new concern justifies another full test/package campaign.
Reuse accepted Windows/Linux functional validation with those attribution limits; format write/check,
local Markdown links and diff checks cover this checkpoint. Moving base, conflict or unexpected
implementation/package delta invalidates this mapping and must stop integration preparation.

Proposed PR title: **Complete disabled SDK source and release boundary**.
Proposed source/base: `feature/otel-redesign_M2_disabled` -> `feature/otel-redesign_M2`.
Proposed body: Disabled telemetry selects an SDK-free no-op session; Enabled initializes lazily with
owned-resource cleanup and result-preserving finalization. Add emitted graph, installed host/worker
load/denial, constructor and lazy-asset checks, and retire the completed diagnosis helper. D1/D2 are
independently accepted at the exact targets above. Reuse fixed Windows/Linux release validation and
finite independent review; subsequent changes are documentation only. This integrates functional
boundary work; RSS causality, formal performance and release acceptance remain unresolved.

Trunk must request explicit human source/base PR approval; only the human merges. Preserve child
history before later deletion, verify resulting squash tree and map it to accepted implementation.
Then assign a separate descendant freeze retaining actual package, dynamic assets and runtime
dependency closure, with deltas against immutable `8fffcc0d8e11bb061d70bf870f262092d559c5f2`.
Keep the [old freeze](opentelemetry-m2-candidate-freeze.md),
[failed formal target](opentelemetry-m2-first-target-measurement.md) and
[closed RSS experiment](opentelemetry-m2-rss-experiment.md) immutable in attribution. Full applicable
T13B, GNOME light/dark, final combined-candidate verification, external artifact backup, T13C and
M2/release acceptance remain open; publish stays blocked. No old performance acceptance transfers.
Preparation performs no PR, merge, parent-ref update, measurement, freeze or acceptance-record edit.
