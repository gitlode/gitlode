# M1 placement and navigation implementation packet

## Implementation outcome

Implemented in checkpoint `97235c37a518c829170568f9c32d5ffe2318803b`; independent review is accepted
with no required corrections. See the [review outcome](opentelemetry-m1-placement-review.md#accepted-outcome).
The planning owner confirmed matching HEAD and a clean worktree on receipt, all ten renames at
100% similarity, and that the `.rev-dep.config.json` diff only updates five explicit entrypoint paths
to their new locations. No dependency allowlist or domain rule was relaxed. The checkpoint's
`git show --check` passed. This intake check does not replace the independent review.

The implementation owner reported 21 focused test files / 321 passing tests, architecture check,
lint, format write/check, diff check, no stale paths, and no nested telemetry barrels. These checks
were not repeated by the planning owner. Full Windows/Linux installed-package and cumulative
integration validation remain later M1 obligations. No publish gate, measurement, merge, or new
candidate freeze was performed. Next: [publish-gate implementation](opentelemetry-m1-publish-gate.md).

The original implementation instructions below are historical; do not repeat the moves.

## Assignment and identity

Use a separate implementation branch conversation. Implement the ten-file map in the accepted
[proposal](opentelemetry-m1-implementation-proposal.md#recommended-source-placement), together with
its minimal contributor reading routes. This slice is authorized under the accepted recovery plan;
do not stop to reconfirm routine file moves or import choices. The human accepted blocking all
supported Changesets publishing until M2; gate implementation remains a separate assignment.

Proposal base: `571a65c14e9e001c142884b4289660e84d68970a` on `feature/otel-redesign_T13B`, followed by
planning-only updates containing this packet. Record actual starting HEAD and worktree state; preserve
other work. Do not merge or update the integration branch. Frozen M0 harness
`a53a5b83d18f9e493ebb39c4db481b762448743f`, measured candidate, and archived fixtures remain unchanged.

No long repeated measurement is planned. Builds and functional tests take execution time separately
from model reasoning; warn before an unexpectedly substantial environment setup or validation run,
and keep reporting progress. Do not run formal calibration to validate file moves.

## Scope and invariants

Read `AGENTS.md`, architecture/domain design, telemetry and verification contracts, the M1 recovery
conditions, and the proposal. Follow the exact ten current-to-destination mappings. Update their
owner imports, existing domain-barrel targets, moved modules' relative imports, and affected tests.
Keep package/public-domain exports, instrument names, scopes, attributes, recording points, no-op
singletons, timing behavior, and control-flow ownership unchanged. Nested `telemetry/` directories
do not become new domains or acquire new barrels. Do not move telemetry calls out of product owners.

Update only the routing/placement guidance in:

- `AGENTS.md`;
- `packages/gitlode/docs/design/README.md`;
- `packages/gitlode/docs/design/domain-design.md`; and
- `packages/gitlode/docs/contributing/README.md`.

Route readers to existing contracts. Describe only implemented behavior; do not document a future
publish gate as available. Defer the gate-specific `build-test-release.md` update to its own slice.
No recorder redesign, helper extraction, profile presentation, `tests/system` migration, package
export expansion, new dependencies, performance threshold change, or release-policy implementation.
Do not loosen architecture checks to accommodate moves; report a concrete contract conflict if one
appears. `execution/telemetry`, `internal-contracts/telemetry`, and `otel-support` stay intact.

## Verification and exit

Use rename-aware diff review to establish that production differences are file placement and import
resolution only. Check stale paths and unchanged exported names. Run affected recorder/owner/no-op
tests and `npm run architecture:check` (including the development build), plus relevant lint and
`npm run format:write`, `npm run format:check`, and `git diff --check`. Choose actual test paths from
the repository rather than inventing new tests that merely mirror renames. Record commands/results
and any validation limitation. Complete Windows/Linux installed-package and cumulative integration
checks remain part of the later M1 candidate-validation assignment.

Preserve the result in a meaningful checkpoint commit; intermediate commits are allowed. Return the
OID, rename/import diff summary, documentation changes, verification results, and any blocker. Do not
merge, declare M1 complete, freeze a new measurement candidate, publish, or start gate implementation.
The planning owner will assign review of this fixed slice and the separately scoped publish gate.
