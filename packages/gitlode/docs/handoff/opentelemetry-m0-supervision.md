# M0 supervision exit packet

Current status: the one-target assignment below has completed and M0 is accepted. See the
[M0 result](opentelemetry-m0-result.md) for outcomes and preserved evidence. The assignment text is
historical, not an instruction to repeat calibration. Next is [M1 preparation](opentelemetry-m1-preparation.md).

## Scope and status

The development harness now runs under a separate Linux supervisor. This slice changes harness
execution and diagnostic evidence only; it does not change production telemetry, performance
thresholds, fixture selection, profile presentation, or workspace layout. M0 subsequently completed
the calibration and comparison path for one target. M1 integration is not authorized by these
tests alone. Canonical behavior lives in the [performance design](../design/telemetry-performance.md)
and [operator guide](../contributing/telemetry-performance-harness.md).

Implementation started from `2d164d9483c60d5f9c68a54da6b445a527d4ff01`; that base does not contain
supervision. Following independent focused re-review, the planning owner accepts R1 and freezes
`a53a5b83d18f9e493ebb39c4db481b762448743f` as the measurement harness revision. There are no remaining
required review corrections. Keep this OID distinct from the immutable production release candidate
OID below. This acceptance covers the harness implementation, not formal performance results.

The independent review has now completed with one required correction, R1 (final evidence-write
failure handling). R1 implementation, focused validation, and
[focused re-review](opentelemetry-m0-supervision-review.md#focused-re-review-after-r1) are complete.
The original 1,147-test result predates R1; use the correction evidence below for the new failure paths.

## R1 correction result

R1 was implemented and verified from the unchanged base
`2d164d9483c60d5f9c68a54da6b445a527d4ff01` in the separate Linux correction checkout
`/home/t-wakabayashi/gitlode-performance/m0-supervision-r1-20260910-2d164d9/source`. The subsequent
focused re-review accepted the correction; no formal calibration or performance measurement was run.

Final diagnostic-log failure now produces an identifiable inconclusive snapshot and exit code 2
when snapshot storage remains writable. A failed final snapshot is retried once as an inconclusive
terminal snapshot. If that recovery also fails, the supervisor still returns exit code 2, reports
two fixed-size stderr messages, marks terminal evidence unavailable to the operator entrypoint, and
does not describe the earlier `running` snapshot as finalized. These paths run only after the
existing owned-group and listener/timer cleanup; they do not repeat the worker workflow. The
structured snapshot records diagnostic-log persistence separately from snapshot persistence.

The correction changed the supervisor, operator entrypoint, supervisor tests, workflow integration
test, performance design/catalog/operator guidance, and this exit packet. Linux verification passed:

- `performance-supervisor.test.ts`: 22/22, including independent diagnostic-write failure,
  recoverable terminal-snapshot failure, and persistently unwritable terminal snapshot tests;
- actual tsx entrypoint integration: 3/3 selected tests, covering normal completion, a stalled later
  child with earlier evidence retained, and bounded setup-failure reporting;
- strict standalone typecheck of `performance-progress.ts`, `performance-supervisor.ts`, and
  `telemetry-performance-supervised.ts`;
- `npm run build:dev`, repository `npm run lint`, `npm run format:write`,
  `npm run format:check`, and `git diff --check`.

The first entrypoint test attempt used `/proc` as the injected unwritable target and reached the
test's five-second timeout. The injection was replaced with a deterministic temporary regular file
used as the artifact directory; the corrected test and integration rerun passed. This was a test
fault-target issue, not a supervisor lifecycle failure. Logs, the complete changed/untracked file
inventory and hashes, and the correction-only patch are under
`/home/t-wakabayashi/gitlode-performance/m0-supervision-r1-20260910-2d164d9/{logs,evidence}`. The
prior archive remains unchanged.

The Windows correction archive is `D:\gitlode_test\m0-supervision-r1-20260910-2d164d9`.
The planning owner verified its reported hashes and all entries in `evidence/evidence.sha256`:

- correction patch: `e1e60aa7948ffc614bbf8ef6862da4d1e82a64b1d904a2684423ef0fbf879a52`;
- changed-file inventory: `6fe0bc2773874a2c3c15f9665853e7323f4c42a357ce65ce1bacd8991cbc78fe`;
- evidence manifest: `5cc2de383b996f3ea43c836898fa8d5d67c29c465c028c9196d556344649dc04`.

Current implementation/test files matched the correction inventory before checkpoint preparation.
The recovery plan differed by session-routing updates; subsequent checkpoint documentation is also
outside the Linux implementation validation. Saved logs confirmed 22 supervisor and 3 selected
entrypoint tests passed. The planning owner did not rerun those tests or perform focused re-review.

Linux validation uses `/home/t-wakabayashi/gitlode-performance/m0-supervision-20260910-2d164d9/source`
with the toolchain recorded in the [environment handoff](opentelemetry-m0-environment.md).
The initial six-file harness regression run passed 88 tests. Subsequent command-entrypoint tests
exercise normal completion and a second child deliberately left running: the deadline terminates
the latter while retaining its first completed run. Fault tests also cover blocked event loops,
each stage deadline, abrupt worker exits, and a grandchild that ignores graceful termination.
These use synthetic small workloads and are not performance results. Logs are in the sibling
`logs/` directory; preserve the final validation log with the reviewed change.

Final validation passed all 90 test files / 1,147 tests (`npm test`, including the development build),
repository lint, and strict standalone typechecking of the three new supervisor/IPC/entrypoint
modules. Repository `format:write` and `format:check` passed on Windows. The evidence archive is
`D:\gitlode_test\m0-supervision-20260910-2d164d9`; it preserves logs, the base bundle, the tracked
diff, and copies/hashes of changed files, including new files absent from a plain Git diff.

## Next bounded assignment: one repository target

Prerequisites are satisfied: independent review and R1 re-review are accepted, and the harness OID
is frozen at `a53a5b83d18f9e493ebb39c4db481b762448743f`. The measurement conversation has not yet
started. Use this updated packet from the planning branch even though the frozen checkout's older
handoff text still says review is pending. Later documentation-only commits do not change the frozen
code identity. Do not use the latest branch HEAD as an implicit substitute for the frozen OID.

Use a separate execution session. Read this packet, the environment handoff, the recovery plan,
the performance design/catalog, and the operator guide. Own only environment verification,
one-target execution, and evidence preservation. Do not repair the harness, change thresholds,
retry inconclusive results, or start the full matrix in that session.

Create a new Linux-native attempt directory, check out exactly
`a53a5b83d18f9e493ebb39c4db481b762448743f` detached into its `source/`,
run `npm ci` and `npm run build:dev`, and verify the tracked checkout is clean. Record the harness
OID, toolchain/environment inventory, CLI tree hashes/provenance, and explicit deadline settings.
Use the existing immutable installed release trees, after checking their archived provenance.
They contain the production code under test; the newer harness revision is intentionally separate.
If production code changes before measurement, prepare and identify a new immutable release tree
instead of relabeling an existing snapshot.

Transfer the frozen commit through a Git bundle from the Windows repository if needed; clone it
into the new ext4 directory and verify `git rev-parse HEAD` before building. Keep setup operations
bounded and inspect failures before continuing. Activate the private Linux toolchain before npm
installation/build as well as before measurement. The operator owns these preparation steps; ask
for infrastructure help only for a concrete missing capability or approval, not to reconfirm the
already approved Linux/WSL2 choice. Do not run concurrent builds or measurements on this host.

From that new checkout, activate the prepared environment and create a new attempt directory:

```bash
set -euo pipefail
source /home/t-wakabayashi/gitlode-performance/m0-20260909-a97829b/environment.sh
attempt="$(dirname "$PWD")/one-target-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir "$attempt"
mkdir "$attempt/tmp"
export TMPDIR="$attempt/tmp"
cp packages/gitlode/test/fixtures/performance/manifest.json "$attempt/manifest.json"
cp "$attempt/manifest.json" "$attempt/manifest-before.json"
legacy=/home/t-wakabayashi/gitlode-performance/m0-20260909-a97829b/releases/legacy-0.12.0/dist/index.js
candidate=/home/t-wakabayashi/gitlode-performance/m0-20260909-a97829b/releases/candidate/node_modules/gitlode/dist/index.js
legacy_revision=76b124e23fcc069be1278629cf01b62ae1456c7a
candidate_revision=a97829b5315d42fbfa2212b718258099e7c90498
common=(--manifest "$attempt/manifest.json" --fixture commit_heavy_repository
  --adapter isomorphic-git --preparation-timeout-ms 1800000
  --execution-timeout-ms 300000 --processing-timeout-ms 300000)
```

Run each command separately, capturing stdout/stderr and exit status outside the timed CLI while
retaining live progress inspection. Read output at intervals no longer than 60 seconds; a running
tool process is not a reason to wait indefinitely. Review its
supervision snapshot and formal artifact before starting the next command. Do not paste all stages
into an unattended script or treat an exit code alone as acceptance.

```bash
npm run performance:calibrate -w gitlode -- "${common[@]}" \
  --baseline-cli "$legacy" --legacy-revision "$legacy_revision" \
  --artifacts "$attempt/calibration"
```

Continue only when this target is complete with valid calibration evidence. Preserve the selected
manifest and its hash; the other four targets deliberately remain incomplete.

```bash
npm run performance:capture-legacy -w gitlode -- "${common[@]}" \
  --baseline-cli "$legacy" --legacy-revision "$legacy_revision" \
  --artifacts "$attempt/legacy"
```

Continue only after a valid legacy capture and completed supervision:

```bash
npm run performance:measure -w gitlode -- "${common[@]}" \
  --comparison disabled_overhead --baseline-cli "$legacy" --legacy-revision "$legacy_revision" \
  --candidate-cli "$candidate" --candidate-revision "$candidate_revision" \
  --artifacts "$attempt/disabled"
```

Review the comparison result, then run the enabled comparison when the execution path is valid:

```bash
npm run performance:measure -w gitlode -- "${common[@]}" \
  --comparison profile_overhead --candidate-cli "$candidate" \
  --candidate-revision "$candidate_revision" --artifacts "$attempt/profile"
```

A valid performance failure is a finding to diagnose, not an invitation to relax a gate.
Stop on inconclusive, unexpected behavior, or a deadline; preserve all artifacts and bounded logs,
record stage/iteration/PID/reason, and return one concrete diagnosis assignment. Do not combine
partial runs across attempts. M0 closure still needs the planning owner to assess this evidence.

On exit, archive the attempt, manifest before/after, revision and environment records, command
outcomes, and hashes under a new `D:\gitlode_test` subdirectory. Return a short target result table
and artifact paths. A successful one-target path establishes operability, not full T13B acceptance,
and never substitutes for M2 verification of the final release candidate.
