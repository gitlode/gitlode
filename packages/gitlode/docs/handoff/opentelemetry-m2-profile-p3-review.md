# P3 independent presentation review

P3 implementation review is complete: accepted at c694b69, recorded at 1a012d5.
Next: [real-terminal confirmation preparation](opentelemetry-m2-profile-terminal-check.md).
Human real-TTY and cumulative validation are pending. Earlier packets are historical evidence.

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

## P3 correction round 1 focused re-review

### Fixed inputs and authority

Review in a fresh human-started independent conversation on `feature/otel-redesign_M2_profile`.

- Correction entry/base: `f4d9f12788147b4054b48847574ba4cbc887d7d6`.
- Implementation: `255b0aacebb5fc7c109d3fe151455abace7f9d51`.
- Outcome: `094dcb81df02681f4de20daf9c160eaacbf0564c`.
- Full fixed target: `61a34c1f13ee993099c4611b3e4ac966b2ab132c`.

Trunk inspected four implementation/test/catalog files; implementation-to-final changes are confined
to the implementation handoff. Verify ancestry, clean entry/exit and actual remote equality; identify
any later source changes rather than silently reviewing a different target. Routing-only commits do
not move this target. Trunk has not independently rerun the 72 reported tests or accepted P3.

Read the original P3-R1..R4 findings above, the
[correction outcome](opentelemetry-m2-profile-implementation.md#p3-correction-round-1-outcome), and the
accepted design's identity, escaping, diagnostic ordering/quantities and semantic style rules. Compare
new catalog wording to that design, not merely to new tests. P1/P2 remain accepted. Limit review to
these corrections and concrete affected regressions; no layout preference redesign, implementation
repair, PR, merge, formal performance or package/OS campaign.

### Focused questions

1. R1: same-name missing/present-empty versions remain separate for measurements and diagnostics,
   in either input order. Embedded delimiters cannot alias identities. Group equality/order matches
   accepted Scope comparison; rendering and admission are unchanged.
2. R2: measured and issue-only suffixes escape the complete displayed token before decoration.
   Check controls, quotes/slashes, C1/bidi/line separators with literal independent expectations.
   Malformed-dot missing-only targets survive as absolute quoted rows, including mixed measured/
   missing targets, cross-kind/typed point targets and ordinary siblings. No diagnostic loss or
   duplicate attachment; ordering, row boundaries and attribute bases remain correct.
3. R3: known loss meaning/unit/value/saturation remains distinct from occurrence count and unknown
   amounts for all supported descriptors. Preserve duration explanation without duplication; no
   fabricated quantity on compacted unknown details. Canonical target precedes code/stage/effect,
   with deterministic retained ties and typed comparisons. Verify opposed input orders and nullable
   versions, point attributes, selectors and same-target diagnostics; do not accept a comparator that
   preserves arrival order for distinguishable output or aliases delimiters.
4. R4: overall marker follows maximum retained severity, including reserved summary; info-only is
   not warning-colored. Frequency digits and coverage label/count/punctuation use their own semantic
   roles. Fixed fallback remains warning. Use role-spy evidence plus ANSI-stripped parity, and preserve
   genuine values/unavailable text and application/progress styles. Styling-only changes preserve text.
5. Check durable tests expose the original failures rather than derive expected tokens/order from
   production helpers. Distinguish reported fail-before commands and skipped nonmatching tests from
   independently reproduced evidence. Ensure ordinary rows, P2 masks/partial/fallback semantics and
   routing are still covered without restarting accepted producer reviews.

### Finite verification and return

Run build:dev, the original nine-suite command and exact strict tooling command from the correction
outcome (reported: 72 passed, no skips). Record actual results; Vitest execution alone is not test
source typechecking. Inspect fail-before evidence for each group; use temporary bounded probes only
for concrete uncovered concerns and remove/restore them before returning. Run fixed-diff whitespace
checks and format write/check for review documentation. Lint/architecture may remain reported-only
unless a new concern justifies rerunning them.

Do not automatically repeat the three ordinary captures: prior reproduction is historical evidence,
not proof of these synthetic boundaries. Reproduce a small case only if a correction plausibly changes
its output. Capture script output is non-TTY; human light/dark styling and wrapping confirmation remains
pending and requires actual TTY use, not merely rerunning the capture script. Do not claim human approval.

Append per-finding accepted/corrections-required and overall P3 implementation decision, concrete
remaining failures, independent versus reported checks and outstanding human/cumulative gates. Batch
findings and return to trunk; no fixes within review. Normally commit/push documentation on this child,
verify actual remote OID and clean status, and remain on the child. No force push or parent updates.
Acceptance of this slice does not complete M2 or authorize PR/merge or the next validation campaign.

## P3 correction round 1 focused re-review outcome

Status: **corrections required** for the P3 implementation slice. P3-R1 and P3-R4 are accepted for
this correction round. P3-R2 and P3-R3 still have bounded presentation failures, so this review does
not accept P3 or M2 and does not authorize integration or the later validation campaign.

### Reviewed provenance

- Review entry/planning checkpoint: `46a3e603a0522d23284be7f48df49e853e83dfcd` on
  `feature/otel-redesign_M2_profile`. The worktree was clean, and local `HEAD` and the actual
  `origin/feature/otel-redesign_M2_profile` both resolved to that checkpoint at entry.
- Fixed correction target: `61a34c1f13ee993099c4611b3e4ac966b2ab132c`; correction base
  `f4d9f12788147b4054b48847574ba4cbc887d7d6`, implementation
  `255b0aacebb5fc7c109d3fe151455abace7f9d51` and outcome
  `094dcb81df02681f4de20daf9c160eaacbf0564c` are ancestors.
- The base-to-target implementation/evidence inventory is the formatter, its focused test, the view
  drift test, the generic view catalog and the correction outcome. The target-to-entry delta is
  routing/handoff documentation only; there is no later source or test change to silently move the
  fixed target.

### Per-finding decision

#### P3-R1: accepted

Scope grouping uses nested maps keyed independently by name and nullable version. Missing and
present-empty versions therefore remain distinct, delimiter-bearing components cannot alias, and
the flattened groups use `compareProfileScopes` for the accepted equality/order. The durable test
uses both measurement and diagnostic-only Scopes, both input orders, null/empty versions and embedded
NUL components with literal headings. No rendering or admission change was found.

#### P3-R2: corrections required for unmatched same-name targets

Complete suffix escaping and malformed-dot missing-only construction are corrected for the covered
cases. Literal control/quote/slash/backslash/C1/line/bidi expectations are independent of production
escaping helpers, and styled/plain parity is checked.

However, `renderScope()` suppresses construction of a missing-only node whenever _any_ measurement
has the same observation name. The surviving diagnostic is then offered only to those rows, and
`appendMeasurementDiagnostics()` discards it when its kind or typed point attributes do not match.
Consequently, a retained Counter row plus an entire-target missing Span diagnostic of the same name
shows neither an issue-only target nor its notice. The same loss occurs for a retained Counter point
and a missing same-name Counter point with a different canonical attribute set. Independent temporary
probes reproduced both paths: output retained the Profile summary and the unrelated measurement but
lost `No valid result retained: invalid aggregation discarded.` entirely.

This affects ordinary and malformed names and is a diagnostic-evidence loss, not a request for a kind
section or badge. Bounded correction: partition same-name diagnostics by complete kind/point target,
attach exact matches once, and render each unmatched retained target through the accepted issue-only
convention without duplicating notices or changing namespace/attribute bases. Add durable literal
tests for mixed measured/missing cross-kind and differing typed-point identities, in both relevant
name layouts.

#### P3-R3: corrections required for remaining deterministic ties

Known loss descriptors now render semantic meaning, value, saturation and unit separately from
occurrence count; unknown amounts and the duration-specific explanation remain distinct. The primary
target comparison is typed and precedes code/stage/effect, and the durable opposed-order test covers
different kinds, selectors and quantity descriptors.

The remaining comparator stops after loss descriptor and unit and does not compare the retained loss
value/saturation or diagnostic occurrence count/saturation. Those fields visibly change notice text.
An independent temporary probe used two report diagnostics with the same target, code, stage, effects,
descriptor and unit but different exact/saturated loss values and occurrence counts. Reversing the
input reversed the two rendered notices. Thus distinguishable output still preserves producer arrival
order, contrary to the accepted deterministic-retained-ties rule.

Bounded correction: after canonical identity comparisons, compare every remaining output-distinguishing
retained tie, including loss value/nullability and saturation plus occurrence count and saturation,
using typed comparisons. Add an opposed-input-order regression where descriptor and unit are equal
but those values differ. This requires no producer, schema or loss-meaning change.

#### P3-R4: accepted

The Profile headline now uses `warnBadge` only when the highest retained detailed or reserved-summary
severity is warning; info-only detail and summary evidence use the default marker. Fixed delivery
fallback remains warning. Distinct-frequency digits and coverage label/count/punctuation use their
accepted roles, and the role spy verifies stripped-text parity for info, warning, compacted severity,
frequency and coverage cases. No application-success/progress styling or plain text changed.

### Independent checks and evidence separation

- `npm run build:dev`: passed; the normal production TypeScript build completed.
- Exact original nine-file Vitest selection: 9 files, 72 tests passed, 0 failed and 0 skipped.
- Exact standalone strict tooling command from P3: passed separately from the production build and
  Vitest execution.
- Independently rerun focused current-target tests: P3-R1 1 passed/19 skipped; P3-R2 2 passed/18
  skipped; P3-R3 2 passed/18 skipped; P3-R4 1 passed/19 skipped. These establish the implemented
  covered cases, not the uncovered boundaries above.
- Temporary bounded probes: one run had the cross-kind R2 and same-descriptor R3 probes both fail
  with 20 nonmatching tests skipped; a second run had the typed-point R2 probe fail with 20
  nonmatching tests skipped. All probe edits were removed before documentation changes.
- Fixed base-to-target and target-to-entry `git diff --check`: passed.
- Review documentation `npm run format:write`, `npm run format:check` and final `git diff --check`:
  passed.

The correction outcome's focused fail-before counts are **reported-only**. The implementation commit
contains production and tests together, so this review did not treat its narrative as an independently
executed red checkpoint. The outcome's lint and implementation-time format checks are also
reported-only; no new boundary/export concern justified rerunning lint or architecture. The earlier
ordinary captures remain historical non-TTY evidence and were not repeated because these failures are
synthetic attachment/order boundaries, not representative ordinary-output changes. No capture or
image is evidence of human light/dark TTY approval.

The corrected R1/R4 behavior and much of R2/R3 are presentation-local. The two remaining failures are
also formatter/test/catalog follow-up; no residual P1/P2 producer, report schema, admission, numeric
mask, partial-value, fallback transport or routing regression was found in the focused scope. The
catalog currently overstates complete missing-target retention and deterministic diagnostic ordering
until these two paths are corrected.

Human real-terminal light/dark readability and wrapping remain pending. Cumulative Windows/Linux
source and installed-package validation remains a separate later gate. No implementation repair, PR,
merge, formal measurement, cumulative package validation, acceptance update or `tests/system` move
was performed.

## P3 round 2 focused re-review

### Fixed scope

Use a fresh human-started independent conversation on `feature/otel-redesign_M2_profile`.

- Entry/base: `df71db30e06e0340e665226ab8f28f37c43ddd33`.
- Implementation: `4d49d73dd34c957204f7bc0d5690ae19c2a2b0e2`.
- Full fixed target: `c694b69cc964226ccbf07325ee45ab32b6ff2e74`.

Trunk inspected the five-file inventory: formatter, formatter/drift tests, view catalog and handoff.
Implementation-to-final delta is outcome documentation only. Verify ancestry, clean status, local/actual
remote equality and post-target changes; later routing-only commits do not change this fixed target.
No independent test execution or P3 acceptance has been performed by trunk at intake.

Read the original and focused R2/R3 findings, accepted display design and the
[round-2 matrix/outcome](opentelemetry-m2-profile-implementation.md#p3-r2r3-correction-round-2).
Review these corrections and their affected paths. R1/R4 and P1/P2 remain accepted unless a concrete
regression affects them. Do not reopen layout preferences or start implementation repair, PR, merge,
formal measurement, cumulative package validation or tests/system work.

### Required checks

- R2: follow the shared name partition through short/group-node, long suffix and malformed absolute
  paths. Observation notices attach once at matching kind; points require complete typed attributes.
  Same-name unrelated measured rows must not suppress missing targets. Independently verify cross-kind
  and differing typed-point cases, matched plus unmatched targets, multiple notices per target and both
  input orders. Target, attributes and notice must each survive at the right location exactly once;
  valid siblings remain available. Preserve Scope identity, escaping, attribute namespace base and
  styling on every new issue-row path. Do not mistake a broad observation notice for a distinct point.
- R3: verify target/code/stage/effect precedence and all output-distinguishing retained ties. Cover
  equal descriptor/unit with null/known loss values, numeric 2 versus 10, loss/count saturation,
  occurrences and severity, plus typed attributes and detail/field selectors. Reversed inputs must
  produce identical complete output. Comparator equality may remain for truly indistinguishable
  output; do not sort by formatted text, locale or a lossy delimiter key.
- Test quality: inspect literal expected output and the pre-edit matrix against the accepted design,
  not just the new implementation/catalog. Check the larger formatter rewrite for duplicate/missing
  attachment or unintended ordinary layout changes. Keep prior R1/R4 and P2 masks/fallback behavior
  covered. Do not change schema/producers to rationalize a formatter failure.

Run build:dev, the existing exact P3 nine-suite command (reported 75 pass, no skips), and the exact
explicit strict tooling command from the outcome. Record actual evidence and TypeScript scope.
Inspect reported fail-before (3 failed/4 passed) and pass-after evidence without relabeling it as your
own execution. Run bounded additional probes only for a concrete uncovered concern; restore/remove
probes before return. No repeated ordinary captures or full OS/package/performance campaigns unless
a concrete changed dependency requires a new trunk assignment. Human real-TTY approval remains pending.
Run fixed-diff whitespace checks and format write/check for review documentation.

### Return

Append R2/R3 decisions and P3 implementation overall accepted/corrections-required, concrete remaining
failure paths, independent versus reported checks and residual human/cumulative gates. If the same
underlying R2/R3 issue remains after round 2, recommend a fresh bounded diagnosis; do not repair it or
start an automatic third correction. Accepted implementation is not terminal/M2 or integration acceptance.
Commit documentation only, normally push to the child, verify actual remote equality and clean status,
and remain on the child. Trunk is a session role, not a ref; no force push or parent branch updates.

## P3 round 2 focused re-review outcome

Status: **accepted** for P3-R2, P3-R3 and the P3 implementation slice. Complete target identity now
controls notification attachment and issue-only retention, and every retained field that can change
the displayed diagnostic has a typed deterministic tie-break. This is implementation acceptance only;
it does not accept the real-terminal or cumulative gates, M2, integration, release, PR or merge.

### Reviewed provenance and scope

- Review entry and requested checkpoint: `f784c4d12be57c2d564b4618c2123f6a305d3749` on
  `feature/otel-redesign_M2_profile`. Entry was clean, and local `HEAD` and the actual
  `origin/feature/otel-redesign_M2_profile` both resolved to that OID.
- Fixed target: `c694b69cc964226ccbf07325ee45ab32b6ff2e74`; implementation
  `4d49d73dd34c957204f7bc0d5690ae19c2a2b0e2` and entry/base
  `df71db30e06e0340e665226ab8f28f37c43ddd33` are ancestors. The fixed five-file inventory was
  reviewed. The implementation-to-fixed-target delta is outcome documentation only, and the sole
  post-target change at entry is the round-2 review assignment in this document.
- Review was limited to the returned R2/R3 formatter, tests, generic view catalog and their directly
  affected paths. No source repair, capture, formal measurement, cumulative package/OS validation,
  tests/system work, PR, merge or parent-branch update was performed.

### R2 decision: accepted

`partitionNameDiagnostics()` now classifies diagnostics against retained rows using the complete
admitted target: observation matching requires kind, while point matching requires kind and the full
typed attribute set. Diagnostics with no exact retained match are grouped by the same typed target
comparison and rendered once as separate issue-only rows. The target's attributes, unavailable state
and all of its notices remain local to that row; unrelated same-name measurements remain available.

The same partition is used for short/group-node observations, longer suffix rows and quoted malformed
absolute rows. Scope selection remains nullable and collision-free, suffix/absolute tokens remain
escaped before styling, and point attributes retain the accepted namespace-relative or absolute base.
Observation-wide notices are emitted once rather than repeated for every retained point, while exact
point notices attach only to the matching typed point. Multiple diagnostics for one target remain
distinct and are each emitted once.

The committed literal expectations cover both input orders, matched and unmatched observation/point
targets, cross-kind same-name rows, boolean versus boolean-looking string attributes, ordinary long
names and malformed names. An additional temporary probe combined two Counter points, a same-name
Histogram, boolean `false`, string `"false"`, an unmatched numeric point and multiple notices for one
observation. Forward and reversed inputs produced identical complete output; each notice appeared once,
the unmatched target's attribute survived, and the valid siblings remained available. The probe was
removed before this documentation change.

### R3 decision: accepted

The comparator preserves complete canonical target, code, stage and effects precedence, followed by
the retained coverage, extent, attribute-key, affected-field and detail-loss selectors. It then compares
loss-quantity presence, descriptor, unit, null versus known numeric value and saturation, whole-result
evidence, numeric occurrence count, count saturation and severity. Scope versions, kinds, point values,
nullable numbers and booleans use their typed comparisons; no formatted text, lossy delimiter key,
locale comparison or producer arrival order is used. Comparator equality remains only for fields such
as the unrendered free-form message or otherwise display-indistinguishable records.

The committed tests independently fix the complete expected notice order, including unknown versus
known quantity, numeric 2 versus 10, quantity saturation, occurrence count and occurrence saturation.
They also reverse complete target/selector inputs and compare the entire output. The temporary probe
additionally opposed diagnostics whose visible duration field and detail-loss explanations differ;
forward and reversed inputs were byte-identical. Known loss quantity remains separate from occurrence
count and no P2 numeric/mask/fallback behavior changed.

### Independent checks and residual gates

- `npm run build:dev`: passed; this typechecked the normal production project.
- Exact assigned P3 nine-suite Vitest selection: 9 files, 75 tests passed, 0 failed and 0 skipped.
- Exact assigned standalone `tsc --ignoreConfig --noEmit --strict` command over the YAML support,
  catalog/formatter/drift/CLI tests and capture script: passed. This is test/tooling-source evidence
  separate from Vitest and the production build.
- Temporary bounded probe: 1 passed and 23 skipped; it was removed, and the formatter test returned
  byte-for-byte to the fixed target before the review document was edited.
- Fixed entry/base-to-target and target-to-review-checkpoint `git diff --check`: passed. The reported
  implementation fail-before result (3 failed, 4 passed, 16 skipped) and pass-after result (7 passed,
  16 skipped) were inspected as reported evidence and were not relabeled as independent execution.
- R1/R4 and P1/P2 remain accepted. No affected regression or need to reopen those decisions was found.
  The previously reported lint result remains reported-only; no boundary change justified an
  architecture rerun.

P3 implementation acceptance does not authorize integration. Human light/dark real-TTY readability,
color perception and wrapping remain pending, as does the separately assigned cumulative Windows/Linux
source and installed-package validation. Formal measurement and later M2/release decisions also remain
outside this review.

## Focused CI and duration-diagnostic correction review outcome

Status: **accepted** for the bounded CI-failure and duration-diagnostic correction at
`d9e994cc28bc91b9ca86f3a3e6e798371ec85481`. No correction-required finding was found in the fixed
three-file implementation delta. This decision does not reopen accepted P1/P2/P3 contracts and does
not accept the human real-terminal gate, cumulative validation, M2, integration, release, PR or merge.

### Reviewed provenance and scope

- Review entry and outcome checkpoint: `7043f2c80e2b5deb33f7a69b49a2c39c5e1733d2` on
  `feature/otel-redesign_M2_profile`; entry was clean, and local `HEAD`, the tracking ref and the
  actual remote ref resolved to that OID before the review checkpoint. Baseline
  `ea9811b548254a51c8f595a595c0eff8b0b42a9a`, fixed implementation
  `d9e994cc28bc91b9ca86f3a3e6e798371ec85481` and the outcome checkpoint form the requested ancestor
  chain. The implementation-to-outcome delta contains only the implementation and terminal-check
  handoffs.
- The fixed implementation delta changes only `formatters.ts`, its focused formatter test and
  `local-collection.test.ts`. No producer, schema, aggregation, admission or accepted P1/P2/P3 policy
  changed. Review was confined to numeric availability, target-local diagnostic rendering, test
  meaning and compacted quality evidence.

### Decision and failure-path analysis

- Measurement-attached duration diagnostics now receive the exact rendered measurement row and use
  the same `deriveSpanNumericAvailability()` result as its numeric fields. Mixed input therefore keeps
  retained total/maximum and marks only average unavailable; all-invalid input marks
  total/average/maximum unavailable; a retained genuine-zero contribution remains displayed as zero.
  `affectedFields` limits the explanatory candidates but no longer independently declares them
  unavailable.
- Availability cannot leak from a same-name unrelated row. Existing partitioning first requires the
  target kind for an observation and kind plus complete typed attributes for a point. Only that matched
  row is passed to the diagnostic formatter. Issue-only rows and shared same-name headings pass no
  measurement, so they use the non-inferential `duration summary incomplete` wording rather than
  borrowing another kind or point's availability.
- The producer-to-report-to-formatter tests retain exact aggregate values, contribution coverage,
  partial status and formal-consumer failure semantics for both mixed input orders. They independently
  require all-invalid unavailability, preserve genuine zero after mixed compaction, and require the
  reserved summary's Span incomplete-field effect and visible omitted-detail notification. The updated
  assertions replace stale field order, kind heading and wording dependencies with stronger semantic
  checks; they do not suppress the diagnostic to pass.
- After diagnostic compaction, the reserved summary still states that collection/telemetry issues
  exist, preserves the Span `incomplete_measurement_fields` association and reports one omitted
  occurrence. It does not invent a target or affected-field detail that the summary did not retain.
  No concrete failure path remained after inspection and the bounded probe below.

### Independent execution, CI confirmation and reported evidence

- Independent `npm run build:dev`: passed.
- Independent focused Vitest run over `local-collection.test.ts` and `formatters.test.ts`: 2 files and
  70 tests passed, with no failures or skips.
- Independent established P3 standalone strict TypeScript command over the YAML/catalog support,
  catalog/formatter/drift/CLI tests and capture script: passed. Vitest is not treated as test-source
  typechecking.
- A temporary formatter probe covered a same-name Counter beside an absent Span target and a shared
  same-name Span/Counter heading. It passed 1 test with 23 skipped: both non-row-attached notices used
  `duration summary incomplete` and neither borrowed `average unavailable` from a different row. The
  probe was removed, and all three implementation/test files returned exactly to the fixed target
  before this document was edited.
- GitHub API confirmation of [implementation run
  36085229805](https://github.com/gitlode/gitlode/actions/runs/36085229805) found head SHA
  `d9e994cc28bc91b9ca86f3a3e6e798371ec85481`, completed/success, with its sole `Test and Build` job
  successful. `Run source tests`, `Build release artifact`, `Validate packed package metadata` and
  `Run installed-package system test` each completed successfully and none was skipped.
- The same independent API check of [outcome run
  36085475426](https://github.com/gitlode/gitlode/actions/runs/36085475426) found head SHA
  `7043f2c80e2b5deb33f7a69b49a2c39c5e1733d2` and the same job and four required steps completed
  successfully without skips.
- The implementation author's fail-before sequence, full 94-file/1245-test root run, nine-suite run,
  lint and other pass-after evidence were inspected as reported evidence only; this review did not
  relabel or rerun them. No concrete concern justified another full suite or package-validation run.

### Unconfirmed and remaining gates

The exploratory whole-file standalone strict check for `local-collection.test.ts` was not repeated.
Its recorded line-69 `Record<string, unknown>` versus OTel `Attributes` mismatch predates this delta;
the changed paths pass the established strict scope, so the mismatch remains an unresolved non-blocker
for this bounded correction. Human light/dark, normal/narrow-width and plain-output real-terminal
confirmation remains **PENDING**. Cumulative Windows/Linux source and installed-package validation,
formal measurement, M2 completion and release acceptance remain separate later gates. Trunk must
explicitly assign the next step.
