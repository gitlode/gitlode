# M1 publish gate implementation packet

## Implementation outcome

Implemented at `21a6c4d8f602eececcf189e756c4c4e5e093359f`, parent
`651f0a53001405b752beef52b31ac21b50c311ac`. The planning owner confirmed matching HEAD and a clean
worktree on receipt. The live acceptance record is `blocked`; the root publish command invokes
the validator before Changesets, and the release checkout now fetches full history. This is intake
verification, not independent acceptance. Next: [fixed-checkpoint gate review](opentelemetry-m1-publish-gate-review.md).

The implementation owner reports strict validator typechecking; focused checks 32 passed / 3 skipped;
full suite 1,153 passed / 17 skipped; lint, formatting, architecture, schema, release build and
diff checks passed. Initial publint failed because sandbox cache/temp writes returned EPERM; an
unsandboxed rerun of publint and installed-package tests passed. These are reported results, not
checks rerun by the planning owner. Review should identify the selected suites and skipped cases;
the totals alone do not identify gate-test coverage or Linux validation. Cumulative Windows/Linux
validation of the actual M1 candidate remains outstanding.

Required target constants were extracted to a side-effect-free tooling module and imported by the
existing performance harness; review this dependency change without changing the frozen M0 harness.
No actual publish, Version PR, formal measurement, merge, or M1/M2/T13B/T13C closure was performed.
The implementation assignment below is completed history; do not reimplement it.

## Assignment and authority

Use a new implementation conversation for the gate only. Placement/navigation at
`97235c37a518c829170568f9c32d5ffe2318803b` is independently accepted. Start from the planning branch
containing this packet; record actual HEAD and worktree state. Preserve existing work and frozen
M0 release trees. The human approved blocking the entire supported Changesets publish operation,
including plugin-only releases, until M2 is accepted. Routine schema/implementation choices below
are assigned to the implementer; do not reconfirm this release policy.

No formal measurement or publishing is part of this assignment. Functional tests/builds still take
execution time; warn before any unexpectedly long preparation. Use bounded local fixtures and
temporary Git repositories. Never test the gate by attempting a real publish.

Read `AGENTS.md`, the recovery plan, M1 proposal and planning disposition, canonical telemetry
performance/verification contracts and catalog, build/test/release guidance, package scripts, and
the actual release workflow. Resolve library/Actions details from installed code or official
documentation if needed; do not add services or dependencies without a concrete necessity.

## Accepted design refinements

This packet supersedes the proposal's tentative gate details:

1. Add `.release/telemetry-migration-acceptance.json` with an explicit versioned schema and initial
   `blocked` state. Implement a deterministic, strictly typechecked development-only validator at
   `packages/gitlode/scripts/check-telemetry-release-acceptance.ts`, with focused tests and a
   `validate:telemetry-release-acceptance` workspace command. Keep a blocked record honestly
   incomplete; put synthetic accepted records in tests, never in the production acceptance file.
2. Guard root `changeset:publish` immediately before Changesets publishing. Root `release` must
   continue through that guarded path after existing functional/package validation. The shared
   Actions publish callback already uses `npm run release`; preserve that single convergence point.
   Do not add the gate to ordinary CI, `validate:release`, build commands, or Version PR creation.
3. Require the actual supported main publishing context. Reject non-main Actions publishing and
   non-main local publishing. The local/manual path must validate its own branch rather than trust
   an injected environment value. Supply sufficient Git history in the workflow for ancestry checks;
   an absent candidate/ref/history or failed Git command is not acceptance.
4. Validate committed review attestations and their identities, not unavailable external archive
   bytes. CI does not access `D:` or download evidence in this slice. Each required attestation names
   its evidence/archive identifier, SHA-256, candidate identity, reviewer and review date. Document
   that the reviewer verifies the bytes and acceptance, while this gate verifies completeness and
   consistency of the committed attestation. A hash string is not proof of artifact authenticity.
5. Perform final release-candidate validation AFTER Changesets version/changelog/lockfile updates.
   The record names that exact full candidate OID, which must be an ancestor of the publish checkout.
   The candidate tree and publish tree may differ ONLY at the acceptance-record path. Do not create
   blanket exceptions for manifests, lockfiles, workflows, tests, or version metadata. Relevant
   uncommitted/untracked source or release-policy changes must fail closed. Describe treatment of
   ignored build outputs explicitly; normal generated build output must not look like a source edit.
   This avoids a second semantic validator for Changesets edits and closes the candidate/record
   self-reference problem. The acceptance record commits after the measured/validated candidate.
6. Retire this temporary migration gate through a separate reviewed removal after the initial
   v0.13.0 publication, preserving its accepted evidence in history. Until then it continues to
   enforce the record; no automatic version-based bypass or empty/missing-record success is allowed.
   Gate retirement is future maintenance, not part of this implementation and not a prerequisite
   to the initial v0.13.0 publish.

## Acceptance record and failure behavior

Cover the M2 obligations already accepted in the recovery plan: frozen M1 candidate provenance;
complete T13B target/comparison matrix and aggregation/volume requirements; profile readability
review including partial/unavailable cases; staged system-test organization; contributor navigation;
final-candidate Windows/Linux functional and installed-package results and bundle identity;
delta assessment from the frozen M1 candidate; T13C closure; and release-authority acceptance.

Reuse canonical target identities, comparison types, and exception requirements. Do not compute new
performance statistics or clone the full telemetry catalog into the validator. Resolve required
identities from a suitable existing source without importing measurement side effects. Scope the
schema to these actual obligations. Keep the blocked/accepted state model small and explicit.

Reject absent/unreadable/malformed records, unknown schema/fields, malformed full OIDs/SHA-256 values,
missing/duplicate required target identities, incomplete sections, pending/failed/inconclusive
results, missing reviewers/evidence, inconsistent candidate identities, invalid ancestry/context,
and prohibited candidate-to-publish differences. An explicit performance exception requires every
field in the existing catalog plus release-authority approval; it is not a generic pass escape hatch.
Require final-candidate evidence or explicit reviewed delta justification for older-candidate reuse;
do not silently equate M0 candidate acceptance with release acceptance.

The validator returns nonzero with a concise actionable reason and never runs measurements, changes
the record, infers missing approvals, or publishes. Release scripts must not reach Changesets when
the guard fails. Direct tool invocation by a credential holder or modification of the guard remains
outside repository enforcement; document the existing review/Trusted Publishing authority boundary.

## Allowed changes and verification

Allowed: acceptance JSON; validator and narrowly needed tooling helpers/tests; root/gitlode package
scripts; `.github/workflows/release.yml`; and canonical `build-test-release.md` gate documentation
with minimal contributor link adjustments. Production telemetry, relocation work, package exports,
profile output, tests/system migration, official fixtures, and performance thresholds are excluded.
In build/test/release guidance, replace the existing claim that `validate:release` alone means ready
to publish with the implemented two-part functional-validation plus acceptance-attestation policy.

Test missing/malformed/blocked and fully accepted records, exact matrix coverage, accepted and invalid
exceptions, record/candidate mismatch, ancestor/non-ancestor/missing-history cases, permitted
record-only change, rejected package/version/lockfile/source changes after candidate validation,
dirty relevant files, and main/non-main contexts. Test guarded command wiring and non-invocation
of a stub publisher when blocked; no credentials, registry publish, or real external measurement.
Show that normal CI/Version PR creation/`validate:release` do not invoke the acceptance gate.

Run focused tests, strict typecheck for the validator and owned helpers despite the broader tooling
project's `noCheck`, relevant build/lint, `npm run format:write`, `npm run format:check`, and
`git diff --check`. Report the actual commands and evidence paths. Broaden tests only for affected
dependencies or concrete failures; complete cumulative Windows/Linux installed-package validation
still belongs to the later M1 candidate-validation session.

Commit the verified implementation as a checkpoint with the live record blocked. Return the OID,
schema/command behavior, failure coverage, limits and evidence. Stop for independent review; do not
mark M1/M2 complete, fill real acceptance evidence speculatively, freeze a new candidate, merge,
publish, or start formal measurements. If a concrete repo constraint makes the above design
unimplementable, report it with a bounded alternative rather than silently weakening the gate.
