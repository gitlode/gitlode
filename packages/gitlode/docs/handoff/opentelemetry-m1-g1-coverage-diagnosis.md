# G1 coverage diagnosis before correction round 2

## Assignment and exit boundary

Use a fresh bounded diagnosis conversation. Do not implement another patch yet. G2 is accepted at
`f7d8a01bd75231b15136707ab40e2b21adf16b1b`; G1 and the gate slice remain unaccepted, with the live
record blocked. The first correction round missed repository-sidecar schema/signal/diagnostic
requirements. The planning owner is choosing diagnosis early to avoid another partial checklist
repair; the two-correction-round escalation threshold has not yet been reached.

Record actual HEAD/worktree state and inspect the fixed correction OID plus later planning docs.
Read the G1 finding in the review packet, original correction mapping, canonical telemetry performance
and verification contracts, and the repository-sidecar evaluators and their caller paths. G2 ancestry,
reuse approvals, publish wiring, and accepted code placement are not reopened without a directly
affected material defect. No formal measurement or long empirical workload is planned.

## Concrete question

Why can a record accepted by the gate omit an outcome required for a valid target_on sidecar?
The currently confirmed gap is that `requiredTelemetryRepositoryChecks` contains only `report_size`
and `prohibited_host_spans`, while `evaluateRepositoryProfileReport` and its caller also require
report existence/schema, complete spans/counters/histograms, and present empty diagnostics.

Trace the complete existing acceptance path, including report extraction and sidecar caller
validation, into a compact table: authoritative predicate, applicable target/state, current gate
representation, missing representation, and negative-test example. Classify each predicate as a
distinct required attestation outcome, an explicitly named subcheck of an existing outcome, or
already covered by an identified accepted workflow/provenance check. No requirement may disappear
into an unexplained aggregate. Do not invent new thresholds or demand runtime-sidecar evidence for
legacy_off/target_off, which are not applicable.

Check the remaining G1 mapping for the same omission mechanism once, concentrating on report/sidecar
and adjacent formal evaluation paths. Do not repeat the entire review or re-open passed provenance
logic. Distinguish an actual acceptance gap from redundant serialization of a condition already
explicitly checked. Grouping is allowed when named subchecks and required outcomes remain machine
checkable; a free-text attestation summary is insufficient.

## Proposed repair and prevention

Return one minimal schema/test correction design, covering report presence/schema validity, all
three complete signal statuses, diagnostics presence/emptiness, and existing size/prohibited-span
checks with correct identity/scope. State where failure versus inconclusive matters and why missing
or invalid reports cannot use a general performance exception. Reuse existing evidence references;
do not ask the operator to regenerate reports or create separate archives for each subcheck.

Specify a finite regression checklist derived from the canonical predicates, not only from the same
constant array used by the validator and its positive fixture. Include the current incomplete
positive record as a negative case, every missing/invalid new outcome, and a fully accepting case.
Keep the gate an attestation validator; do not import runtime measurement/evaluation machinery into
publishing or implement another ProfileReport evaluator. Preserve accepted G2 source/reuse bindings.

Save findings and the next correction's exact files/tests/exit conditions in
`packages/gitlode/docs/handoff/opentelemetry-m1-g1-coverage-resolution.md`, then checkpoint that
document and return its OID. Run documentation format/check and diff check only unless a bounded
read-only reproduction is needed. No code changes, full suite, release pipeline, actual publish,
Version PR, merge, live-record acceptance, or candidate freeze. The planning owner uses this result
to issue correction round 2 and focused re-review, without another broad design/proposal cycle.
