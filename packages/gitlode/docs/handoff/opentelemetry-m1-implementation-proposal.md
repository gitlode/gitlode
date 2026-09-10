# OpenTelemetry M1 implementation proposal

## Scope and inspected state

This proposal is the bounded M1 preparation requested by
[`opentelemetry-m1-preparation.md`](opentelemetry-m1-preparation.md). It does not authorize source
moves, release-policy changes, formal measurement, integration, or publishing. The implementation
owner must preserve product behavior and the accepted contracts in
[`../design/telemetry.md`](../design/telemetry.md),
[`../design/telemetry-verification.md`](../design/telemetry-verification.md), and
[`../design/domain-design.md`](../design/domain-design.md).

The repository was inspected read-only on 2026-09-10 with a clean worktree before this document was
added. The local state was:

| Ref                                   | OID                                        |
| ------------------------------------- | ------------------------------------------ |
| `HEAD` / `feature/otel-redesign_T13B` | `65ddc195eeebba6f1962b2f6241058f7a17b1792` |
| `feature/otel-redesign`               | `5a6a810b8621759fb9723d0617aabdf1fbbac631` |
| `integration/v0.13.0`                 | `745d3d553e7ddbea430993602ddaa36fe816dfc4` |
| frozen M0 harness                     | `a53a5b83d18f9e493ebb39c4db481b762448743f` |
| M0 measured production candidate      | `a97829b5315d42fbfa2212b718258099e7c90498` |

The measured candidate is an ancestor of the inspected HEAD. The common ancestor of the inspected
HEAD and `feature/otel-redesign` is the latter ref; the common ancestor with the local integration
ref is the integration ref. These are inspection findings, not authorization to update or merge a
ref. The implementation session must record the then-current integration ref again before cumulative
review.

## Recommended source placement

Move only telemetry-specific helpers into a `telemetry/` directory inside their existing domain.
The new directories are organizational and do not create domains, barrels, package exports, or a
cross-domain facade. Keep each public domain barrel's exports unchanged and update its internal
targets. Update direct imports in owners and tests mechanically. Do not rename exported symbols,
change constructors, split files, or alter recorder and no-op implementations in this slice.

| Current file                                                                   | Destination                                                                              |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `packages/git-adapters/src/git-impl/dag-metric-recorder.ts`                    | `packages/git-adapters/src/git-impl/telemetry/dag-metric-recorder.ts`                    |
| `packages/git-adapters/src/git-impl/git-metric-recorder.ts`                    | `packages/git-adapters/src/git-impl/telemetry/git-metric-recorder.ts`                    |
| `packages/git-adapters/src/git-impl/git-telemetry.ts`                          | `packages/git-adapters/src/git-impl/telemetry/git-telemetry.ts`                          |
| `packages/line-diff-adapters/src/line-diff-impl/line-diff-metric-recorder.ts`  | `packages/line-diff-adapters/src/line-diff-impl/telemetry/line-diff-metric-recorder.ts`  |
| `packages/gitlode/src/extraction/built-in-fact-projector-metric-recorder.ts`   | `packages/gitlode/src/extraction/telemetry/built-in-fact-projector-metric-recorder.ts`   |
| `packages/gitlode/src/extraction/extraction-pipeline-metric-recorder.ts`       | `packages/gitlode/src/extraction/telemetry/extraction-pipeline-metric-recorder.ts`       |
| `packages/gitlode/src/extraction/file-change-fact-expander-metric-recorder.ts` | `packages/gitlode/src/extraction/telemetry/file-change-fact-expander-metric-recorder.ts` |
| `packages/gitlode/src/output/jsonl-file-writer-metric-recorder.ts`             | `packages/gitlode/src/output/telemetry/jsonl-file-writer-metric-recorder.ts`             |
| `packages/gitlode/src/plugin-runtime/plugin-projection-metric-recorder.ts`     | `packages/gitlode/src/plugin-runtime/telemetry/plugin-projection-metric-recorder.ts`     |
| `packages/internal-foundation/src/dag/observations.ts`                         | `packages/internal-foundation/src/dag/telemetry/observations.ts`                         |

The first nine files construct instruments, translate bounded telemetry attributes or errors, own
timing tokens, or provide no-op recorders. The DAG file is likewise an SDK-independent observation
hook contract; the algorithms still own the calls that populate it. No nested `telemetry/index.ts`
is needed: within-domain owners may import the moved modules directly, while cross-domain consumers
continue through the existing domain barrel.

The following code deliberately stays where it is:

- Calls such as `recordCommitAccepted`, `recordExpanded`, `completeOutputWrite`, Git command/session
  completion, DAG hook calls, and plugin projection completion remain in their product operation
  owners. Moving them would change control-flow ownership.
- `packages/gitlode/src/execution/telemetry/`,
  `packages/internal-contracts/src/telemetry/`, and
  `packages/internal-foundation/src/otel-support/` are already coherent domains or domain-local
  infrastructure and remain intact.
- `packages/gitlode/src/presentation/reporting/profile-view.ts` remains with presentation, which
  owns labels, grouping, and reading order. Presentation improvement is an M2 slice.
- DAG algorithm fields that carry an optional observation sink remain in DAG types and control flow;
  only the hook declaration file moves.
- Tests remain in their current owning suites. This slice changes their import paths but does not
  reorganize test directories. In particular, it does not begin the approved M2 `tests/system`
  migration.

The move must preserve exported names, OpenTelemetry scopes, catalog identifiers, attributes,
recording points, terminal outcomes, timing behavior, no-op singleton behavior, and the existing
package dependency envelope. `npm run architecture:check` must confirm that the directory nesting
has not been interpreted as a new domain.

## Minimal contributor reading routes

Make four small durable documentation edits; do not copy observation catalogs or handoff status into
them.

1. Add a telemetry task route to repository `AGENTS.md`: start with telemetry design; add verification
   for recorder/owner/collector changes, performance plus the harness guide only for empirical work,
   profiling for user-visible report interpretation, and build/test/release for publish policy.
2. Add a short "Telemetry change routes" section to `packages/gitlode/docs/design/README.md` that
   distinguishes product operation/recorder changes from worker collection and presentation changes,
   linking the existing canonical documents.
3. Extend `packages/gitlode/docs/design/domain-design.md` source-layout guidance: a nested
   `telemetry/` groups telemetry-only helpers within the owning domain, is not a domain itself, and
   must not absorb recording calls from product control flow.
4. Extend `packages/gitlode/docs/contributing/README.md` with routes for normal verification,
   formal performance execution, and publish gating. Update
   `packages/gitlode/docs/contributing/build-test-release.md` only with the implemented gate command,
   its acceptance-record boundary, and the fact that `validate:release` remains functional/package
   validation rather than empirical acceptance.

`docs/README.md`, `usage.md`, and `profiling.md` already route their audiences adequately and need no
M1 change. Profile presentation guidance and representative-output review stay in M2.

## Recommended enforceable release gate

### Current publish paths and boundary

The repository currently exposes two supported ways to reach Changesets publishing:

1. `.github/workflows/release.yml` runs on `main` pushes or manual dispatch. Its
   `changesets/action` uses `publish: npm run release`; `release` runs `validate:release` and then
   `changeset:publish`.
2. A release operator can invoke root `npm run release` or the separately exposed root
   `npm run changeset:publish` with publish credentials.

CI in `.github/workflows/ci.yml` builds and validates release artifacts but does not publish. Direct
`changeset publish`, `npm publish`, or edits to a workflow/script are technical bypasses outside the
supported commands. Repository code cannot prevent a credential holder from using those commands;
branch protection, review of release-policy files, and npm Trusted Publishing restricted to the
approved workflow remain the authority boundary.

### Gate shape

Add a repository-owned, versioned JSON acceptance record at
`.release/telemetry-migration-acceptance.json` and a deterministic validator at
`packages/gitlode/scripts/check-telemetry-release-acceptance.ts`. Add
`validate:telemetry-release-acceptance` to the `gitlode` workspace. Change the root
`changeset:publish` script to run that validator immediately before the underlying
`changeset publish`; retain root `release` as `validate:release` followed by that guarded script.
Thus both supported manual commands and the actual Changesets publish callback converge on one
gate.

Do not add the acceptance validator to `validate:release`, normal CI, release builds, Version PR
creation, or integration branch checks. The record is committed at M1 with `status: "blocked"`, so
feature development and package validation remain usable while an attempted publish fails. The
release workflow should additionally reject a publish callback whose GitHub ref is not
`refs/heads/main`; manual dispatch may still create/update a Version PR, but cannot publish from
another ref.

The record has one schema version, release line, overall `blocked` or `accepted` status, and these
required sections:

- frozen M1 candidate: full source and harness OIDs, release-bundle and production-dependency
  manifest hashes, archive identity, environment identity, fixture manifest/recipe identity;
- T13B: every cataloged target/comparison and aggregation/volume check, each with `pass` or an
  explicitly accepted exception, evidence path/hash, candidate OID, reviewer, and review date;
- profile readability: reviewed representative commit/file/plugin and partial/unavailable output;
- staged system-test organization and contributor-navigation acceptance;
- final candidate: full OID, Windows and Linux functional/installed-package results, release bundle
  hash, and an explicit delta assessment from the frozen M1 candidate; and
- T13C closure and release-authority acceptance.

The validator accepts only the exact schema and enumerations, full hexadecimal OIDs and hashes,
nonempty evidence identifiers, `accepted` top-level status, and closed status for every section. An
exception is accepted only when all fields required by the performance catalog and an explicit
release-authority approval are present. It verifies that all T13B evidence names the final candidate
unless the delta assessment explicitly classifies why candidate reuse is valid. It also requires the
final candidate to be an ancestor of the publish checkout and permits changes after it only in the
acceptance record and Changesets-owned version/changelog/package-lock metadata. Any source, workflow,
test, configuration, or telemetry-contract change after final validation fails closed and requires a
new final-candidate assessment.

Missing files, unreadable JSON, unknown fields, duplicate target identities, missing matrix entries,
`pending`, `failed`, or `inconclusive` evidence, hash/OID mismatch, a dirty relevant worktree, wrong
release ref, and command errors all exit nonzero. The validator reads existing artifacts and hashes;
it never runs measurements or converts their outcome into acceptance. This is an enforceable record
of reviewed empirical acceptance, not empirical evidence itself.

Focused tests use temporary repositories and injected environment values. They cover at least:

- missing, malformed, unknown-version, incomplete, pending, failed, and inconclusive records;
- a complete passing matrix and a fully populated explicitly accepted exception;
- absent exception approval or required exception evidence;
- wrong candidate OID, non-ancestor candidate, prohibited post-candidate change, allowed
  Changesets-only change, dirty relevant files, and non-main publish context; and
- both root publish scripts containing the guard, plus workflow wiring to the guarded `release`
  command.

The record and validator should not authenticate an external archive beyond checking recorded
identities and hashes. Artifact authenticity and acceptance remain review/release-authority duties.

## Ordered implementation breakdown

### Pre-merge M1 necessities

1. **Mechanical placement slice.** Allowed production files are the ten mapped files, their existing
   owner imports and domain barrels, and tests whose relative imports change. Add no behavior or
   facade. Run focused recorder/owner/no-op tests, then `npm run architecture:check`.
2. **Navigation slice.** Allowed docs are `AGENTS.md`, `docs/design/README.md`,
   `docs/design/domain-design.md`, `docs/contributing/README.md`, and the narrowly scoped gate update
   to `docs/contributing/build-test-release.md`. Review links and avoid repeating catalogs.
3. **Publish-gate slice.** Allowed files are `.release/telemetry-migration-acceptance.json`, the new
   validator and focused test, root and gitlode `package.json`, and `.github/workflows/release.yml`.
   Land the record blocked; do not fill M2 evidence speculatively. Verify every blocked/accepted test
   state and prove normal CI/`validate:release` does not call the gate.
4. **Functional validation and freeze.** Run formatting (`npm run format:write`, then
   `npm run format:check`), lint, architecture, schema, source tests, release build, publint, and the
   installed-package test. Obtain the complete repository and installed-package result on Windows
   and Linux/CI; a sandbox-only ownership failure must be rerun in the applicable normal environment,
   not silently accepted. Do not run formal performance measurements. After review, commit the exact
   M1 implementation candidate and copy its complete release bundle plus production dependency
   closure to a new immutable archive. Record content hashes, source/harness OIDs, environment, and
   fixture identity. Do not overwrite or relabel the M0 candidate/archive.
5. **Cumulative integration review.** Re-read the actual `integration/v0.13.0` ref, review
   `integration/v0.13.0...<M1-candidate>` cumulatively, verify that all known M0 performance results
   are either passing or explicitly triaged and that partial coverage is labeled partial, rerun the
   applicable merge-result checks, and only then request/perform the reviewed merge. The planning
   owner accepts M1; the implementation owner does not mark T13B, T13C, or release readiness complete.

Use one bounded implementation owner for slices 1-3 because the moves and gate scripts are dependent,
then a separate review owner for the fixed diff. Use separate functional-validation/freeze and later
formal-measurement sessions so a measurement archive is never rebuilt while in use.

### Deferred M2 and M3 work

M2 owns the remaining four repository targets and complete T13B matrix, any diagnosis or accepted
exception, representative profile readability changes/review, the first private `tests/system`
workspace migration, final-candidate revalidation, acceptance-record transition to `accepted`, T13C,
stable-document consolidation, and handoff cleanup. Missing full-matrix results are recorded release
blockers but are not new M1 integration blockers unless they expose a concrete material regression.

M3 continues to own external export, destination/backend abstractions, concurrent local/external
collection, unrelated test migrations, and reusable instrumentation redesign. None belongs in the
M1 implementation diff.

## Release-authority decision

The planning owner should confirm that the v0.13.0 gate intentionally blocks the entire Changesets
publish operation, including an otherwise independent plugin-only publish, until M2 is accepted.
This proposal recommends that fail-closed boundary because the current release workflow has one
shared publish callback and one Trusted Publishing authority. Permitting plugin-only publication
would require an explicit release-product policy and a reliably tested package-selection rule; it
must not be inferred by the implementation owner.
