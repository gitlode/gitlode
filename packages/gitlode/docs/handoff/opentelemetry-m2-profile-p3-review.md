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

## Independent review outcome

Status: **corrections required** for the P3 implementation slice. The generic presentation direction,
old-policy removal and bounded real-output tooling are accepted, but the fixed target does not yet
satisfy several already-approved identity, diagnostic and styling boundaries. This review does not
accept P3 or M2 and does not authorize integration.

### Reviewed provenance

- Review entry/planning checkpoint: `63da8831b207e04cffdc42eeeaed8754bb979922` on
  `feature/otel-redesign_M2_profile`.
- Fixed implementation target: `5df4f49732d9ff49fef4067493d3152d276a792d`; base
  `66acbfdffd8b4eae879c98709357763f85cac862`, implementation/evidence
  `bbf2792fb2f752d20466cd253812e3beabc64603` and accepted P2
  `755e7d34f3d0ea56c7346ce009ec7d7624bab32c` are ancestors.
- Entry was clean, and local `HEAD` and the actual
  `origin/feature/otel-redesign_M2_profile` both resolved to the review checkpoint. The complete
  22-file base-to-target inventory was reviewed. The implementation-to-target delta is only the P3
  outcome in `opentelemetry-m2-profile-implementation.md`; the later checkpoint adds only this review
  assignment.

### Mandatory findings

#### P3-R1: absent and explicitly empty Scope versions are coalesced

`formatProfileLines()` indexes both measurement and diagnostic Scope groups with
`` `${scope.name}\0${scope.version ?? ""}` ``. Consequently `{ name: "scope", version: null }` and
`{ name: "scope", version: "" }` occupy one entry even though ordering and rendering correctly treat
them as distinct identities. An independent probe containing one point in each Scope produced one
`Scope: scope` heading and placed both values below it; `Scope: scope@""` disappeared. This contradicts
the accepted missing-version-before-present-version order, the explicit-empty-version correction and
the no-coalescing requirement. The delimiter key can also alias admitted strings containing the
delimiter.

Bounded correction: retain the nullable version as part of a collision-free structured grouping key
(or use equality consistent with `compareProfileScopes`) for measurements and diagnostics, and add one
independent expectation containing same-name missing and empty versions together. Do not change Scope
rendering or admission.

#### P3-R2: some admitted observation identities bypass escaping, and a malformed missing-only target is lost

For names longer than the two namespace segments, `renderNode()` slices `relativeName` and interpolates
it directly for measured and issue-only rows instead of passing it through the accepted token formatter.
An admitted `root.ns.tail\nINJECT` probe therefore created a literal newline inside the observation
row. Quotes, slashes, C1/bidi/line separators and other delimiter characters in that suffix have the
same bypass. Separately, `renderScope()` deliberately skips malformed-dot diagnostics while constructing
missing-only nodes; without a surviving measurement there is then no absolute row on which to render
the issue, so the identified target and its notice disappear.

This is an output-safety and evidence-preservation failure, not a cosmetic preference. Bounded
correction: escape/quote the complete displayed suffix before decoration, construct quoted absolute
rows for malformed-dot diagnostic-only targets, retain deterministic code-unit ordering, and cover
both measurement and missing-only cases with literal expected tokens independent of renderer helpers.

#### P3-R3: presentation drops known loss quantity and does not implement the full diagnostic order

The schema-2 producers retain exact semantic quantities such as `metric_points`, `span_groups` and
`observation_results`, separately from diagnostic occurrence count. `diagnosticText()` displays a
known quantity only for `span_duration_contributions`; for example, a metric-point overflow with an
exact retained loss value is rendered only as “Additional attribute combinations omitted”, while a
possibly different occurrence count is rendered as “Repeated N times.” The exact quantity, unit and
saturation evidence are therefore absent. In addition, `compareDiagnostics()` compares code, stage
and effects only; it omits the accepted canonical target (including kind and typed point attributes)
and the other retained selectors, so same-name diagnostics can inherit producer arrival order rather
than the specified target/code/stage/effect order.

Bounded correction: render known quantities with their semantic unit and saturation state without
equating them to occurrences, retain the existing explicit unknown-amount wording, and compare the
complete retained canonical target before code/stage/effect (with deterministic remaining ties). Add
opposed-input-order cases where occurrence and loss quantities differ. No producer or schema redesign
is needed.

#### P3-R4: the accepted semantic style mapping is incomplete

The general heading/field/value/unit/separator roles, lack of direct formatter chalk calls and ANSI
stripping parity are sound. Three accepted role details are not implemented:

- the Profile-level headline always calls `warnBadge`, even when all retained detailed/summary
  evidence has maximum severity `info`;
- a `distinct` Span summary sends the frequency digits together with parentheses to `separator`
  instead of styling the digits as `primaryValue`;
- the incomplete coverage suffix such as `(observed 1)` is undecorated, rather than using `fieldKey`
  for its label, `primaryValue` for its count and `separator` for punctuation.

An info-only independent styling spy recorded `warnBadge:!`. Existing style tests assert only a
warning path and selected roles, so their text-parity pass does not cover these semantic assignments.
Bounded correction: derive the overall marker from the highest retained severity (including the fixed
summary evidence), split summary/coverage tokens across the approved roles, and extend the role spy
with info, frequency and incomplete-coverage cases. Plain text must remain byte-for-byte identical.

### Accepted implementation and policy-removal scope

- The formatter uses one Scope/two-level namespace hierarchy without kind sections, badges, Plugins
  or fallback buckets, per-name labels, preferred observation order or synthetic totals. Cross-kind
  measured rows and repeated typed metric points remain separate, and attributes shorten only at the
  grouping namespace boundary.
- Fixed fields, genuine zero, optional extrema, numeric masks and mixed/all-invalid duration
  availability use the shared P2 derivation. The inspected duration/size threshold cases retain four
  significant digits, promote units after rounding and keep tiny nonzero values visible; presentation
  does not mutate report values or typed attributes.
- Detailed report/Scope/observation/point routing, shared observation notices, ordinary valid siblings,
  fixed fallback wording, lifecycle-only wording and the 15+1 summary path are present. P3-R2 and P3-R3
  bound the remaining target/quantity/order corrections; no residual P1/P2 producer failure was found.
- `profile-view.ts` and `profile-view.yaml` no longer enumerate observations. Catalog validation rejects
  obsolete per-observation groups, while the independent Span/metric catalogs, admission metadata,
  owner verification and schema-2 measurement contracts remain. The large removed formatter/drift
  suites were replaced with generic checks, but the four mandatory boundary groups above are missing;
  66 passing tests therefore do not establish those accepted behaviors.
- CLI help, usage, profiling, telemetry and verification guidance describe the generic view without
  claiming terminal, cumulative or M2 acceptance. Architecture ownership remains presentation-side.

### Independent checks and evidence

- `npm run build:dev`: passed; the production TypeScript project was checked by its normal build.
- Exact assigned nine-file Vitest selection: 9 files, 66 tests passed, 0 failed and 0 skipped.
- Exact assigned strict tooling command: passed for the catalog helper, catalog/formatter/drift/CLI
  tests and capture script under standalone `--strict`; this is separate from the production build.
- Fixed base-to-target and target-to-review-checkpoint `git diff --check`: passed.
- Previously reported implementation `npm run lint` and `npm run architecture:check` were inspected as
  reported-only. No module-boundary concern justified rerunning them; the reported architecture check
  had its pre-existing one configuration warning and zero errors.
- Temporary bounded probes reproduced P3-R1, P3-R2, arbitrary-unit four-significant-digit display and
  the info-marker role. The probe file was removed before documentation changes. The arbitrary-unit
  display did not erase a nonzero value or alter the structured report and is not a correction finding.

The capture script was inspected before execution. It owns one `mkdtemp` root, places generated Git
repositories, configs, plugin fixture packages and JSONL output beneath it, awaits each `execFile`
child, has a 2 MiB capture bound and removes the root in `finally`, including failure paths. The three
assigned captures were reproduced exactly once after `npm run build:dev`; all exited successfully and
each CLI stdout was 0 bytes. Commit output showed `gitlode.execution`, file output showed the distinct
`gitlode.line_diff@""` Scope, and plugin output showed the two retained outcome points under
`@gitlode/performance-fixture-plugin@1.0.0` on stderr.

The committed excerpts remain real but partial non-TTY evidence. Their recorded product source is
`737f36338e45e08fbfed2095dcd2a81c5f09098d`; the reviewed target additionally changes formatter,
profile-view and tests in `bbf2792fb2f752d20466cd253812e3beabc64603`, notably summary interpretation
for compacted diagnostics. The committed ordinary excerpts contain no such diagnostic and were
structurally reproduced at the reviewed code, but their timing values remain attributable only to the
original run. This review's reproduction timings are intentionally not committed or compared as
performance evidence. The transformed integrated sample and fault examples remain design/synthetic
evidence, not captures.

Human light/dark real-terminal readability, color perception and wrapping remain pending regardless
of capture success. Cumulative Windows/Linux source and installed-package validation also remains a
separate post-correction gate. No formal measurement, implementation repair, PR, merge, acceptance
update or tests/system move was performed.
