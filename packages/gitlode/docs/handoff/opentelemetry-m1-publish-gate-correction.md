# M1 publish gate: correction round 1

## Assignment

Use a new bounded implementation conversation. Correct G1 (obligation coverage) and G2 (provenance
integrity) together in the gate reviewed at `21a6c4d8f602eececcf189e756c4c4e5e093359f`. Start from
the planning branch containing this packet and record actual HEAD/worktree state. The gate remains
unaccepted and the live record remains blocked. This is gate correction round 1, distinct from the
earlier supervisor R1. Return a checkpoint for focused re-review in the existing gate review session.

No formal measurement, actual publisher invocation, Version PR, merge, or new candidate freeze.
No long empirical workload is planned; warn before unexpectedly substantial setup or validation.
Read the original gate packet, independent review outcome, M2 obligations, and canonical performance
and verification contracts. Preserve accepted placement work and supported publish wiring.

## G1: explicit coverage of required evidence

The current positive record lacks calibration/legacy capture and individual report-size/parity/etc.
obligations but passes. Comparisons plus aggregationScale and one traceVolume attestation are not
an adequate machine-checkable inventory of the agreed M2 requirements.

Before editing the validator, write a compact obligation-to-schema mapping in the correction outcome
or canonical gate guidance. Reuse existing target identities and map every requirement to its scope,
status and evidence reference. This is implementation traceability, not a new performance policy.
Include all five calibrated targets, all five legacy_off captures, ten comparisons, aggregation N/4N,
report size, prohibited host spans, Git command parity, RSS/bounded growth and behavioral acceptance.
Use the catalog/verification contracts to determine the actual applicability of each check. Do not
invent a meaningless Cartesian matrix or require repository evidence for Git-independent aggregation.

Require each obligation's identity and accepted outcome explicitly so absent, duplicate, unknown,
wrong-scope or non-accepting entries fail closed. Structured subchecks within a comparison or report
are fine; a generic untyped summary is not. One archive may support several named checks: do not
require duplicated files, new measurements, or raw-result parsing just to supply separate identities.
Preserve catalog-specific statuses and exception boundaries; do not allow a generic performance
exception to waive failed calibration, missing observations, or behavior correctness without an
existing contract allowing it. Keep target/catalog definitions coherent instead of creating another
independent acceptance policy.

Add negative tests derived from a valid complete record that remove each required class and key,
duplicate/mis-scope identities, introduce unknown checks, or change required outcomes to incomplete,
failed, or inconclusive. A complete positive fixture must contain the evidence the real gate promises
to require. Tests must demonstrate G1's original incomplete-positive path is now rejected.

## G2: real revisions and evidence-specific reuse

Require frozen migration candidate, declared harness revisions and evidence source revisions to
resolve to actual Git commits in available history. Use real temporary commits in positive tests,
not arbitrary hex strings. Check that the frozen migration candidate is an ancestor of the final
candidate (identity is allowed); retain final-candidate-to-publish ancestry and record-only tree checks.
Missing history or an unrelated frozen product candidate must fail closed. Harness commits need
existence, not a blanket ancestry constraint against the product candidate: they are separately
versioned tooling and may be newer or on another lineage.

Do not relabel all attestations with the final candidate merely to satisfy equality checks. Preserve
the distinction between the release revision being accepted and the revision that generated evidence.
Calibration and legacy capture refer to the preserved legacy revision and target recipe; these are
baseline evidence, not older redesigned-candidate reuse. Repository comparisons identify actual
baseline/candidate states and relevant revisions, harness and fixture identity. Keep their links to
calibration/capture internally consistent without reading the external artifact bytes in CI.

For reused older redesigned-candidate evidence, bind the reviewed reuse justification to exact
evidence identities, source OIDs and final destination OID. Require matching reviewed delta provenance
and valid product ancestry for that reuse. Reject dangling reuse claims, source mismatches, nonexistent
revisions, unrelated product candidates and absent approvals. A global free-text delta rationale is
not a substitute for evidence-specific binding. The reviewer still judges whether the rationale is
valid; the validator checks its presence, scope and relationships, not semantic equivalence of code.

Cover missing frozen/harness commits, unrelated frozen/final candidates, valid same/ancestor cases,
valid separate harness history, baseline provenance, and accepted/rejected evidence reuse with real
temporary repositories. A string-format test alone does not validate G2.

## Scope, validation and convergence

Allowed: validator, narrowly required side-effect-free target/obligation helpers, gate tests and strict
typecheck configuration, canonical gate documentation, and this correction's outcome. Change the
blocked record shape only if strictly needed for schema coherence; never set it accepted. Preserve
root/Actions wiring and ordinary CI independence. Do not redesign the publisher, add archive downloads,
modify production telemetry or loosen thresholds. `safe.directory` diagnostic polish is optional
and deferred unless necessary to run bounded verification; document any environmental limitation.

Run gate tests and strict typecheck, shared-harness/workflow regression tests affected by helper
changes, relevant lint, format write/check and diff check. Report exact suite names, executed/skipped
cases and platform. Use safe isolated stubs for publishing tests, never a real publish command.
Do not rerun the complete release pipeline solely to repeat earlier counts. Cumulative Windows/Linux
installed-package validation remains later M1 work.

Return the obligation/schema mapping, G1/G2 before/after behavior, commit OID, commands/results and
evidence paths, remaining limitations, and any justified scope deviation. Then stop for focused
re-review. If the same underlying issue remains after two correction rounds, use the existing bounded
diagnosis rule rather than continuing local patches or relaxing acceptance.
