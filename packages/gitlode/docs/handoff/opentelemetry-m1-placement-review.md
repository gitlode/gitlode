# M1 placement: fixed-checkpoint review

## Assignment

Use a new independent review conversation with this packet and repository files, not the placement
implementation conversation. Review commit `97235c37a518c829170568f9c32d5ffe2318803b` against its
parent. Record actual HEAD and worktree state; later planning-only commits do not change the review
target. M0 is complete, but M1 remains open. No long repeated measurements are planned.

Read `AGENTS.md`, architecture/domain-design contracts, telemetry/verification contracts, the
[placement packet](opentelemetry-m1-placement.md), and the accepted source map in the
[proposal](opentelemetry-m1-implementation-proposal.md). The gate proposal is not part of this diff.

## Focus

- Confirm the ten exact moves with rename-aware diff and unchanged contents; check owners, existing
  barrels, test imports, and moved modules resolve the intended identities. Public names and package
  exports must remain unchanged. Pure rename similarity alone does not prove correct import wiring.
- Verify the remaining production differences are import resolution/formatting, preserving recording
  points, control flow, scopes/attributes, no-op identity, and timing behavior.
- Inspect the five Rev-dep entrypoint path updates. They must preserve coverage of the moved files
  without broadening dependency permissions, suppressing checks, or making nested directories new
  domains. Check stale paths and absence of new nested telemetry barrels.
- Review the four navigation-document changes for correct links and minimal guidance. Existing
  canonical contracts must remain authoritative; future publish-gate functionality must not be
  described as already implemented.

Implementation reported focused tests 21 files / 321 passing, architecture check, lint, formatting,
and diff check. Inspect available evidence or explicitly label outcomes known only from the report.
Use bounded targeted verification when a concrete concern needs it; do not rerun the whole suite
merely to repeat a count. Full Windows/Linux installed-package validation remains assigned to the
later cumulative M1 candidate, and its absence is not a newly introduced blocker for this move slice.

## Return and exclusions

Do not edit code, commit, merge, publish, implement the gate, measure performance, or freeze a new
candidate. Return the exact reviewed OID, accepted or required corrections, contract-linked findings
with file references, optional improvements separately, and evidence actually checked. Acceptance
of this slice does not complete M1 or T13B. The planning owner will consolidate any corrections or
proceed to the separate publish-gate implementation assignment once this slice is accepted.
