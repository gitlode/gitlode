# P3 independent presentation review

## Fixed inputs and authority

Review in a fresh human-started conversation on `feature/otel-redesign_M2_profile`.

- Base: `66acbfdffd8b4eae879c98709357763f85cac862`.
- Implementation/evidence: `bbf2792fb2f752d20466cd253812e3beabc64603`.
- Full fixed target: `5df4f49732d9ff49fef4067493d3152d276a792d`.
- Accepted P2: `755e7d34f3d0ea56c7346ce009ec7d7624bab32c`.

Trunk inspected the 22-file inventory; implementation-to-final delta is outcome documentation only.
Review the complete base-to-target delta, including the CLI help and empty Scope-version fixes, not
only the final evidence commit. Verify ancestry, clean entry/exit, local/actual remote equality and
post-target changes. Later routing-only documentation does not move the review target.

Read AGENTS.md, the complete [accepted design](opentelemetry-m2-profile-design.md),
[integrated examples](opentelemetry-m2-profile-integrated-review.md),
[P3 assignment/outcome](opentelemetry-m2-profile-implementation.md#p3-generic-profile-presentation),
[real-output evidence](opentelemetry-m2-profile-p3-real-output.md), and affected canonical telemetry,
view/verification catalogs, profiling, CLI and architecture guidance. Compare implementation-authored
canonical updates to the accepted design rather than treating new wording as independent authority.

No source/test repairs, PR, merge, freeze, formal measurement, acceptance update or tests/system move.
Do not reopen approved layout tradeoffs or P1/P2 without a concrete affected dependency. Human real
terminal readability and cumulative Windows/Linux package validation remain separate after review.

## Review obligations

1. Scope name/version and two namespace levels: code-unit ordering, short/group-node values before
   children, duplicate points and cross-kind names, malformed-dot names and unknown admitted identities.
   Verify empty versus absent versions and no lost/coalesced values. No per-name labels/order, Plugins
   buckets, kind sections, synthetic totals or hidden fallback grouping.
2. Escaping and attributes: relative base is the grouping namespace, not Scope or the full observation;
   segment boundaries and absolute slash markers preserve identity. Check typed value ordering and
   boolean/numeric-looking strings, controls/C1/bidi/line separators, quoted names and delimiters.
   Check output safety with literal expected tokens independent of formatter helpers.
3. Numbers: fixed field shape regardless of frequency, exact counts, genuine zero and optional extrema,
   masks/contribution coverage, mixed-duration retained total/max with explanation and all-invalid
   unavailability. Four significant digits, unit selection/promotion and tiny/large notation must not
   erase nonzero values or change report precision/attributes. Reuse accepted P2 semantics.
4. Diagnostics: trace report/Scope/observation/typed point attachment, shared-observation notices and
   missing-only rows. Check precise and discarded target/key evidence, unaffected sibling preservation,
   occurrence versus loss quantity, incomplete/unknown detail and 15+1 summaries. No duplicated warning
   meaning, lost notice, invented exact loss or inferred collection failure from report-delivery failure.
   Verify empty/lifecycle-only/fixed-fallback output and maximum severity without relying only on images.
5. Styling/routing: sectionHeading/separator and all semantic roles match design; no direct chalk in
   formatters, domain-value coloring or application-success styling for Profile. Escaping precedes
   decoration; strip ANSI to compare identical text/spacing/ordering. Preserve non-TTY/quiet/failed-run
   behavior and ordinary stderr routing, and check shared Styling changes do not break other presenters.
6. Removed policy/tests/docs: removal of large old formatter/drift suites must retain meaningful
   behavior coverage, not merely lower counts or copy renderer constants. Catalog changes remove view
   enumeration without weakening independent observation admission/measurement contracts. Check help,
   usage, profiling and canonical contracts for obsolete signal sections or premature acceptance claims.
7. Evidence/tooling: inspect capture script's temp ownership, cleanup/failure handling, child completion,
   output destinations and fixture/plugin paths before reproducing. Its excerpts are real but partial:
   do not claim complete display/TTY/light-dark acceptance from them. Confirm product delta between
   sample source `737f36338e45e08fbfed2095dcd2a81c5f09098d` and reviewed target; keep measured timing
   values attributed to the original run. Distinguish transformed design examples and synthetic faults.

## Finite independent checks

Run build:dev and the exact nine-suite Vitest selection in the P3 outcome (reported 66 passes), plus
its exact strict tooling check. Record independent counts/skips/typecheck scope. Inspect tests for
missing accepted boundary coverage; add temporary bounded probes only for concrete concerns and
remove/restore them before returning. No full suite/package/formal-performance campaign is assigned.

After script inspection, reproduce the three small deterministic captures once if feasible; report
actual commands/output status and any environment limitation. This uses real subprocesses/builds and
may take time beyond reasoning; communicate progress. Do not enlarge repositories or repeat captures
for favorable timings. Human real-terminal checks remain pending regardless of capture success.

Run fixed-diff whitespace checks and format write/check for review documentation. Previously reported
lint/architecture may be reused as reported-only unless a concrete concern justifies rerunning them.

## Return and preservation

Append accepted/corrections-required for the P3 implementation slice, batching mandatory findings with
concrete failure paths, accepted-contract basis and bounded correction. Separate optional taste changes,
evidence gaps and deferred human/cumulative gates. Record fixed target, independent versus reported
checks, sample provenance and any residual P1/P2 impact. Do not self-authorize integration or M2.
Save a documentation-only checkpoint and normally push to the same child; verify actual remote equality
and clean status. Remain on the child; trunk is the planning conversation, not a Git branch. No force
push or parent updates. Human returns the outcome; trunk assigns correction or terminal/cumulative steps.
