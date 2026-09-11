# M1 cumulative functional validation and candidate preservation

## Assignment and fixed identities

Use a new validation conversation. Placement and the publish-gate slice are independently accepted;
G1/G2 have no remaining required corrections. Validate the cumulative implementation at exactly
`681a1a5b53bd0aa957dae72d9fd9684da7ff467a`. This is the prospective immutable M1 migration candidate,
not the final v0.13.0 release candidate. Read this latest planning packet before checking out that
OID: older handoffs within the fixed checkout still say review is pending.

Record actual planning HEAD/worktree state and current refs for `feature/otel-redesign_T13B`,
`feature/otel-redesign`, and `integration/v0.13.0`. Verify the fixed candidate exists and record its
ancestry to the local integration ref. Do not change refs or merge; cumulative integration review and
merge-result checks follow this validation. If the ref relationship changed, report it explicitly.

This work can take substantial execution time independently of model reasoning: clean dependency
installation, builds, the whole functional suite, packing and temporary consumer installations run
on two platforms. Inform the human before starting and provide progress at least every 60 seconds.
No repeated formal performance workload is planned. Give external commands explicit generous
deadlines appropriate to their stage; inspect stage/process state rather than waiting indefinitely.

## Preparation and environment

Read `AGENTS.md`, the recovery plan's M1/M2 conditions, canonical build/test/release and telemetry
verification guidance, gate review acceptance, and the M0 environment/result records. Those M0
records supply provenance; they do not validate this changed candidate.

Create new isolated fixed-OID checkouts on Windows and Linux/WSL2. Transfer a Git bundle containing
the candidate and required history if needed. Use separate artifact/temp directories and do not
build in or modify the preserved M0 release trees. Linux source/build/temp storage must be native
ext4; activate the prepared private Linux toolchain before npm commands. Windows validation may use
the established Windows toolchain. Record OS, architecture, Node/npm/Git, filesystem, exact source
OID, lockfile hash, and environment differences. Do not relabel different environments as identical.
Report a concrete unavailable tool/capability instead of silently skipping a platform.

## Required verification

Install from the committed lockfile and run canonical `npm run validate:release` on both platforms.
It is functional/package validation and must remain usable with the migration record blocked.
The required results include dependency consistency, formatting/lint, architecture/development
build, generated schema checks, source tests, release bundle, strict packed-package metadata checks,
and installed-package scenarios for both Git adapters, line diff, dynamic plugins, schema, and the
TypeScript consumer. Also run the existing strict release-acceptance validator typecheck, which is
not implied by the broader tooling project's `noCheck` build.

Record actual suite counts and skips. The 17 Windows Linux-only supervision/workflow skips are not
failures, but their execution must be demonstrated on Linux; investigate unexpected Linux skips.
Identify the relevant equivalence, operation ownership, no-op and failure-isolation coverage in the
executed suite. Do not create redundant tests merely to increase counts or treat the earlier
focused gate/placement checks as cumulative validation.

If sandbox/cache/temp permissions cause a failure, preserve its log, correct only the concrete
environment issue through the available approval mechanism, and rerun the failed check plus any
downstream checks that did not execute. Keep a truthful command ledger: a composite command that
failed is not a successful run just because selected later commands pass. Show complete component
coverage if using individually completed remaining steps. Stop and return a diagnosis for source
failures, unresolved hangs or unexpected semantic results; do not edit code in this validation session.

Verify the live acceptance record remains blocked and use the gate's focused tests to establish
intended behavior. Do not run `release`, `changeset:publish`, `changeset publish`, or `npm publish`.
Do not create a Version PR, run formal calibration/measurement, or invent M2 acceptance attestations.

## Candidate preservation and return

After successful checks, preserve the tested release package and a complete installed Linux runtime
tree including production dependencies in a new immutable archive; preserve Windows package/test
provenance as well. Avoid preserving only a mutable `dist/index.js`. Identify the exact tested and
installed bytes, package version, dependency inventory/lock provenance, source and harness OIDs,
bundle/tree manifest hashes, environments, and fixture identity. Confirm the installed tree starts
under the recorded toolchain before sealing. Further setup/builds must never mutate that snapshot.

Use `681a1a5b53bd0aa957dae72d9fd9684da7ff467a` for this candidate's source and associated current
harness identity. M0 measurements remain explicitly tied to source `a97829b5315d42fbfa2212b718258099e7c90498`
and harness `a53a5b83d18f9e493ebb39c4db481b762448743f`; do not relabel them. Retain the accepted
M0 calibration manifest and recipe provenance separately from this checkout's uncalibrated manifest,
with hashes and clear purposes. Do not recalibrate or silently overwrite either. M2 must assess
candidate deltas and complete its matrix on the required candidate under the accepted reuse rules.

Archive logs, command ledger, input identities, complete bundle/dependency manifests, and checksums
under a new `D:\gitlode_test\m1-...` directory. Verify every archived checksum after transfer, and
preserve Linux permissions via an appropriate archive. Keep the fixed validation checkouts clean.
Write a concise result at `packages/gitlode/docs/handoff/opentelemetry-m1-validation-result.md` in
the planning checkout, with platform results, known skips, failures/reruns, artifact paths/hashes,
candidate identity, and outstanding merge/release obligations. Commit that documentation checkpoint;
it does not change the fixed validation candidate.

Return the result commit and evidence. The planning owner accepts the candidate preservation and
assigns cumulative review/merge-result verification against the then-current integration target.
Do not mark M1 complete or merge during this assignment. Full T13B/M2/T13C acceptance and publish
authorization remain outstanding even if every functional check passes.
