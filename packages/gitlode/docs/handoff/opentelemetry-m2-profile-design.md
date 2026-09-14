# M2 profile presentation: detailed design for v0.13.0

## Status and authority

The human has accepted the release scope, normal display, collection-issue principles and
[integrated sample](opentelemetry-m2-profile-integrated-review.md). This document consolidates the
resulting design; it is not a discussion log. No production code or tests are implemented by this
session. The human has also accepted the concrete edge rules, schema v2 issue contract and
retention limits. Detailed design is complete; implementation and runtime acceptance remain separate.

The human has also accepted the shared cosmetic-style mapping in section 11, including the two new
shared roles. Functional and cosmetic design are complete; terminal verification remains an
implementation acceptance requirement.

Current implemented contracts remain in [telemetry.md](../design/telemetry.md),
[verification](../design/telemetry-verification.md) and [profiling.md](../profiling.md).
This handoff describes their intended M2 delta. During implementation migrate normative content
into those homes and retain this file as a short completion/dependency pointer. Design completion
is separate from M2 runtime acceptance, performance acceptance and permission to publish or merge.

## 1. Purpose, principles and release boundary

Profile is a developer-facing, human-readable CLI result. It is not primarily intermediate data
for another analysis program. Prefer a predictable, neutral display over per-domain optimization.
Some cognitive load and some regressions from v0.12.0 are accepted to release the OTel migration
and obtain operational feedback. Do not repeatedly reopen release scope for local readability gains.

- Preserve the meaning of OTel measurements. Use-specific aggregation belongs to the consumer.
- Keep semantic identities and relationships in telemetry metadata; keep terminal styling, layout
  and display order in presentation. Do not disguise domain-specific view preferences as semantics.
- Namespace hierarchy expresses names, not runtime Span parentage or additive/exclusive duration.
- Preserve available evidence; distinguish absent data, zero, unavailable fields and incomplete
  aggregates. Never infer missing observations from a catalog of possible observations.
- Keep collection, issue retention and worker transport bounded. Telemetry failure must not change
  application facts, JSONL, checkpoints, ordering, cleanup, result classification or exit behavior.
- Identifiers use meaningful namespaces; shared attributes need not descend from an observation's
  complete name. Scope identifies instrumentation source and is not an observation-name prefix.

### Included in v0.13.0

1. Uniform Scope grouping, two namespace levels, relative names, stable ordering, readable precision,
   flat supplementary attributes and initial styling.
2. Replace per-observation display group/order rules with general rules.
3. For problems already detected by collection/report generation, preserve structured impact evidence
   and implement local notifications and an overall summary. Collector/report changes necessary for
   this are included; this is not a view-only implementation.
4. Retain existing Span grouping and attribute reducers, observation catalog, plugin admission rules
   and measurement limits. Distinct metric attribute sets remain separate repeated-name rows.

### Deferred

- Early priority: redesign local Span aggregation/information retention (section 9).
- Expanding detection to currently unobserved loss, including recorder-side omissions.
- Domain-specific attribute pivots, such as object purpose across cache/read metrics (future C).
- External export, Resource-based presentation, trace-parent views, new profile/verbose modes,
  percentiles and arbitrary plugin-metric admission. These are not prerequisites for this release.

Retain current CLI visibility: profile follows the successful application summary on stderr;
quiet suppresses it; failed runs do not display it. Initialization degradation retains its warning
and no-profile behavior. This design adds no flags or application warnings for collection issues.

## 2. Comparison evidence and accepted tradeoffs

Primary evidence is the human-provided [v0.12.0 capture](cli-output-sample-v0.12.0.md) and
[current capture](cli-output-sample-v0.13.0-current.md): 670 commits/records, one output file,
isomorphic-git and two plugins. These separate runs are layout evidence, not performance evidence.
Legacy source reference: `76b124e23fcc069be1278629cf01b62ae1456c7a`.

The legacy table gives compact phase scanning and domain-specific details. Current output exposes
more distinct observations but separates related information by signal kind, repeats long identifiers,
puts attributes on long measurement lines, and gives some durations excessive fractional precision.
Similar legacy/current names do not establish equivalent measurement boundaries.

The integrated example transforms all 44 current observation rows and all displayed attributes into
seven Scopes. Its layout occupies 178 lines with a maximum of 98 characters. Input values were
already formatted; no raw measurements were recovered. Attribute repetition and vertical length
remain accepted limitations. Package Scopes sort before core Scopes; operation chronology is not
preserved. Styling still requires terminal inspection after implementation.

## 3. Tree, identity and layout

### Scope and names (accepted)

Scope identity is name plus nullable version. Display `Scope: name@version` when present, otherwise
`Scope: name`. Apply the same rule to core, plugin and unknown observations already in the report.
Do not add a Plugins group, signal-kind sections, per-row kind badges or human-label overrides.
Generic presentation does not expand collector admission policy.

Split observation names at dots. The first two segments each create one namespace level beneath
Scope. Remaining segments stay joined by dots on an observation row. Prefix the root name with `/`.
Do not adaptively compress groups or use Scope as a prefix to strip.

```text
Scope: gitlode.git
  /gitlode
    git
      commit.walk : calls=1, total=6.9 s, avg=6.9 s, max=6.9 s, errors=0
      object.cache.lookup : 670 objects
        adapter = isomorphic-git
        object.purpose = materialize
        object.type = commit
      object.cache.lookup : 672 objects
        adapter = isomorphic-git
        object.purpose = topology
        object.type = commit
```

Use two-space indentation, one attribute per supplementary line and minimal separator spacing;
no global column padding. Names with one or two segments may carry their own values on the group
line. Show their own attributes before child observations. Their attribute base is that group name.
A measurement row with a longer suffix does not extend the namespace base.

```text
Scope: gitlode.extraction
  /gitlode
    projection : calls=1, total=6.901 s, avg=6.901 s, max=6.901 s, errors=0
      mode = plugin_enriched
      /gitlode.stream.completion = exhausted(1)
      duration : samples=670, total=4.611 ms, avg=6.882 µs, min=5 µs, max=201.3 µs
        fact.type = commit
        outcome = success
```

Do not sum parent/child rows or synthesize totals. Repeated metric names each retain their complete
attribute set and measurement values. Different kinds sharing a name remain separate rows.

### Deterministic edge rules

Use existing code-unit string ordering and value comparators in `telemetry/normalization.ts`:
Scope name, missing version first then version string; sibling names; kind ties Span/Counter/
Histogram; then sorted attribute key/value pairs. Values sort boolean, number, string; booleans
false first, numbers numerically, strings by code units. A shorter equal-prefix attribute list
sorts first. Never use locale, duration, insertion order or shortened keys to determine output order.

If multiple rows occupy a short-name group node, render its heading once, then repeat its full
absolute observation name on child measurement rows before namespace children. This avoids
inventing a label such as self and preserves cross-kind identities internally.

For names with empty dot segments, use one quoted absolute observation row under Scope instead of
repairing the name or creating empty headings. Non-dotted names otherwise form a single root node.
Use quoted, escaped tokens for empty strings, control characters, leading slash, quotes/backslashes
or punctuation that would collide with delimiters. Escape terminal control and line-separator
characters; do not truncate identity or insert formatter-driven wrapping. Long lines may wrap in
the terminal. Plain ordinary identifiers and enum values keep the sample's spelling. This escaping
policy is rendering only and does not relax data admission or sanitization rules.

Make token spelling deterministic: an unquoted token must match `[A-Za-z0-9_.@-]+`; quote all other
string tokens with JSON string escaping, additionally escaping C1 controls and Unicode line/bidi
controls. The absolute-name `/` marker stays outside the quoted token. Quote string attribute values
that equal boolean literals or parse as finite numbers so their types remain distinguishable.
Scope names/versions retain their existing ordinary package spelling (including `/`); quote them
when they contain whitespace, controls, quotes or backslashes. For an observation rendered without
a namespace group, attributes have no relative base and use absolute keys. For repeated absolute
short-name rows under a group node, the enclosing group remains the attribute base.

## 4. Fields, attributes, precision and style

| Report source   | Display fields, in order                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Span aggregate  | calls=callCount, total=totalDurationSeconds, avg=total/calls, max=maxDurationSeconds, errors=errorCount |
| Counter point   | value followed by unit                                                                                  |
| Histogram point | samples=count, total=sum, avg=sum/count, min=minimum, max=maximum                                       |

Always use the same field format for a kind, including a single call/sample. Preserve explicit
zeros. Omit unobserved observations and empty groups unless a retained issue identifies the target.
Keep histogram buckets in the report but do not display them. Missing optional extrema use `—`
without implying collection failure. An average requires a positive, valid denominator and matching
numerator coverage; see section 5 for detected incomplete values.

Attribute lists are flat and sorted by original keys. Remove the displayed grouping namespace plus
`.` only at a segment boundary and only when the suffix is nonempty. Otherwise prefix the full key
with `/`. Do not derive shortening from Scope or the complete long observation name. No inheritance,
common-attribute hoisting or domain-specific pivoting is introduced.

Span summaries retain current semantics: `single` shows its value; `distinct` shows each retained
value with its Span frequency, e.g. `exhausted(3),cancelled(2)`; `min_max` shows `minimum…maximum`,
including equal endpoints. Retain available observation-coverage counts. Conflicts/overflow become
local issue explanations, not duplicated inline and in notifications. `(n)` is not a count of
`setAttribute` calls. Metrics show their own scalar attribute values, not Span summaries.

Durations and sizes use at most four significant digits with unnecessary fractional zeros removed.
Integer calls, samples and entity counts remain exact. Never round nonzero to unqualified zero.
Only presentation is rounded; all retained report values preserve their numerical precision.

For unit edges, use ns/µs/ms/s and B/KiB/MiB/GiB with existing canonical bases;
select the largest supported unit whose unrounded magnitude is at least one, with the smallest
unit below that threshold. Promote if rounding reaches the next unit threshold. Beyond supported
units or at very small magnitudes use scientific notation as necessary, not new unit families.
Zero duration uses `0 s`; zero size uses `0 B`. Preserve canonical unknown units and existing entity
unit labels; do not round arbitrary non-duration/non-size attributes without semantic unit evidence.

Initial styling: Scope/namespace headings bold; ordinary observation names readable normal style;
values bright; field names, keys, units and separators subdued. A node serving as both namespace
and observation uses heading emphasis for its name. Keep warning text readable without color.
Use existing styling/no-color behavior, not signal-specific colors. Future feedback may change
styling; no review deadline is prescribed.

## 5. Collection issues: accepted behavior

Keep issues separately from measurements with affected target, missing information and cause.
Use the narrowest evidenced target, including a known observation with no surviving measurement.
Broader uncertainty must not become a claim that every descendant failed. Unknown affected subsets
and confirmed total loss are different. Do not enumerate catalog names to fabricate absent rows.

- Show a compact Profile-level summary only when issues exist.
- Put details beside the identified observation or in its attribute supplement.
- Put Scope-only details at that Scope's start; multi-Scope or unknown-target details at Profile start.
- Explain a shared cause once rather than on every observation row.
- If a whole identified observation has no valid result, keep an issue-only row at its normal place.
- If sibling metric points were dropped, retained points are not thereby numerically incomplete.
- If contributing measurements were lost, show retained values with their affected coverage explained.
- If only attribute details were lost, do not mark duration/call values incomplete.
- Preserve normal numeric field structure, using `—` for an unavailable individual field, never zero.
- Quantity of diagnostics is not quantity of lost measurements. Report loss amounts only with known
  meaning and unit. Merge equivalent issues without conflating different effects.
- Reserve a fallback summary for lost issue details. Absence of a notification means no problem was
  identified within the supported collection boundary, not proof of complete instrumentation.

For average availability, if a detected duration omission leaves Span calls covering
more operations than total duration, display avg=`—` unless matching coverage is available. Keep
retained total/max with their incompleteness notification. If no valid duration contribution remains,
show affected duration fields as `—`, even if existing accumulator defaults contain zero. No new
Span grouping or per-attribute timing reconstruction is introduced.

Detailed-notice retention must not control numeric validity. Report support is a bounded
`unavailableFields` set on each retained measurement record, populated during collection/report
validation before diagnostic deduplication or overflow. It describes which of that record's fields
cannot support a displayed number; explanations remain in separate issues. This fixed-size evidence
survives even if a detailed diagnostic is replaced by the broad fallback. Average availability also
depends on its inputs. Do not hide every value merely because a broad issue has unknown extent.

Use fixed per-kind field identifiers, not arbitrary keys: Span `calls,total,avg,max,errors`, Counter
`value`, Histogram `samples,total,avg,min,max`. Empty means no additional unavailability beyond
optional null extrema. Null extrema and zero-denominator average remain unavailable independently
of this set. Keep a bounded duration-contribution count internally to distinguish no retained
duration from a genuine zero duration; this is collection-quality evidence, not a new user metric.
Field validity is independent of whether the diagnostic explaining it survives. Existing numeric
slots remain finite; default zero in an unavailable slot is not an observed zero and consumers must
honor the mask. Validation must reject malformed masks and cannot use them to admit NaN/Infinity.

For an empty report with no issues, omit Profile. If only issues remain, print Profile and those
issues. Telemetry shutdown failures after a valid snapshot are lifecycle notices, not evidence that
retained measurements are missing. Preserve that distinction rather than assigning blanket partial.

## 6. Structured issue contract

Evolve the SDK-independent worker report to schema version 2. Keep measurement arrays and existing
Span aggregation identity. Enrich the existing diagnostics representation rather than adding a
second independently maintained issue list. All consumers of the worker report must be updated
atomically; do not add a new public persistence/import compatibility promise.

Each diagnostic carries the existing code, stage, severity and occurrence count, plus:

| Concept          | Representation and invariant                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target           | Report-wide, Scope, observation, or metric point; observation includes Scope/version/name/internal kind; point adds a validated canonical attribute set                              |
| Signal coverage  | Bounded subset of Span/Counter/Histogram kinds, independent of display hierarchy                                                                                                     |
| Effect           | Missing observations/points; incomplete measurement fields; missing attribute detail; unknown collection coverage; lost issue detail; lifecycle notice without established data loss |
| Extent           | Entire identified target or unidentified subset; do not infer entire from one discarded point                                                                                        |
| Attribute/fields | Optional validated attribute key or bounded set of affected numeric fields                                                                                                           |
| Cause            | Existing diagnostic code and lifecycle stage; no presentation strings in semantic metadata                                                                                           |
| Loss amount      | Optional quantity plus explicit unit; absent if unknown; separate from diagnostic occurrences                                                                                        |

A notice may have several effects only where separately evidenced. Use structured target identity,
not an index into retained measurement arrays. This supports observations with no surviving value.
Never retain arbitrary invalid attribute payloads merely to explain their rejection. Validate target
components independently; if point identity is invalid, retain a valid observation identity instead.

Keep `signalStatus` as a conservative, derived compatibility summary for internal checks; do not use
it to place CLI notifications. Derive partial only from data-impact effects and unavailable only
from confirmed failure to obtain the entire signal result. A broader issue of unknown extent must
not assert every row is incomplete. Source evidence is retained in diagnostics; per-node status flags
are not additional independently mutable state.

Derivation must remain valid after diagnostic compaction. The reserved summary preserves a fixed
per-kind union of data-impact effects and explicit confirmed-whole-result-unavailable evidence,
separately from lifecycle-only effects. It also records which detail was discarded. Do not derive
complete from the surviving detailed records alone. A result with retained measurements cannot be
wholly unavailable; conflicting evidence is a report-validation issue, not a reason to erase values.

### Retention limits

Preserve measurement limits: 128 Span groups, 16 distinct values per Span attribute, 128 metric points
per instrument. Keep diagnostics capacity at 16 (15 detailed records plus one reserved summary).
Expand deduplication identity to include target, effect, extent, fields, code and stage. Repetition
increments occurrence count; add loss quantities only when disjoint losses with the same unit are
known. Do not combine lifecycle occurrence counts into lost-sample counts.

Structured detail bound: at most 4096 UTF-16 code units of serialized structured target/effect detail per
record; retain existing sanitized-message limit of 512. This is an explicit detail bound, not a
claim about exact JavaScript heap size. If a target exceeds the bound, discard finer components and
retain a valid broader target; never truncate an identity into a different identity. Disclose detail
loss. When detailed capacity is exhausted, retain an affected-kind union and unknown-extent flag in
the reserved summary; do not maintain unbounded overflow identity lists. Counts saturate safely with
an explicit saturation indication instead of exceeding safe integer range.

4096 is the selected conservative initial detail budget, not an empirically optimal threshold. It
allows ordinary Scope/name/key identities and bounded point dimensions while limiting 15 detailed
payloads to 61,440 UTF-16 code units, excluding bounded messages and fixed fields. Account for
serialized escaping in the budget. Enforce the budget during bounded copying, before building an
unbounded temporary serialization. Use point-to-observation-to-Scope-to-report fallback and preserve
kind/effect evidence in fixed fields; never rely on an over-budget diagnostic to report its own loss.

Retained detailed records use current first-accepted retention; canonical sorting is for display,
not a claim that bounded retention is order-independent. Limits should be verified at boundaries.

### Existing detection sites and effects

| Site                                  | Information to preserve                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| Span group limit                      | Valid known Scope/name; missing additional aggregate; do not label accepted groups incomplete |
| Span invalid duration/aggregate       | Known aggregate and affected duration fields; preserve other valid evidence                   |
| Span distinct-value limit             | Aggregate, attribute key and attribute-detail loss; duration values remain valid              |
| Span single-value conflict            | Aggregate/key and conflicting attribute summary; not Span error status                        |
| Metric point retention limit          | Instrument and omitted-point evidence; point identity if safely retained                      |
| Invalid metric point/type             | Valid instrument/point identity when available; rejected result, not synthesized zero         |
| Report validation rejection           | Valid identity components and rejected result; never copy unsafe rejected payloads            |
| Trace flush/metric collection failure | Known kind coverage and stage; narrow targets only with evidence                              |
| Shutdown failure                      | Lifecycle notice; do not invent loss of an already built report                               |
| Diagnostic detail limit               | Reserved broad issue-detail-loss summary                                                      |

This mapping covers existing detections only. Existing collector admission exclusions are not
new missing-data failures. Review finalization to ensure shutdown notices reach the final immutable
snapshot without changing application-result handling or running cleanup twice.

## 7. Diagnostic wording

Use `!` as a plain-text notification marker. Headline: `Collection issues detected.` or
`Telemetry lifecycle issues detected.` for lifecycle-only notices; use a combined neutral headline
when both apply. No success/complete banner. Explain known missing information and cause in English.
Technical kind terms are allowed in exceptional explanations when necessary to describe coverage;
they do not restore kind-based hierarchy or normal row badges.

Use `unavailable` only for an identified observation with no valid result. A shared instrument issue
preceding retained points uses one name-only issue row, followed by ordinary repeated-name rows;
it is not a third namespace group or another measured datapoint. Deduplicate local explanations;
the overall headline need not repeat them. Within a placement, order by canonical target, code,
stage and effect. Keep structured diagnostics richer than their concise terminal wording.

Examples and provenance are in the integrated review. Its synthetic scenarios are not observed
failures. Exact sentences may be refined for clarity without changing effect/extent semantics.

## 8. Implementation responsibilities and acceptance

These are implementation slices for a subsequent session, not authorization to implement now.

1. Contracts and local diagnostics: versioned report, impact types, validation, bounded accumulator,
   derived status, worker transport and lifecycle snapshot handling. Update contract fixtures and
   report consumers together, including performance tooling that inspects report status.
2. Collectors/report builder: propagate known target/effect at existing detection sites. Preserve
   aggregation keys, recorder ownership and observation admission. Do not fabricate identity after
   it has been lost or copy raw exceptions/configuration into diagnostics.
3. Presentation: one generic Scope/name tree over all retained measurements and issues, deterministic
   sorting, attribute bases/escaping, units and style. Replace signal sections and name-specific
   group/order/fallback buckets. Keep kind only for identity, numeric fields and issue coverage.
4. Contracts/docs cleanup: remove per-observation labels/group/order from `profile-view.ts` and its
   YAML catalog as display dependencies; retain or relocate generic units/style/diagnostic policy.
   Update metadata/view-coverage tests to validate generic handling rather than require known-name
   display entries. Observation/reducer catalogs remain except for necessary issue-contract changes.
5. Update canonical telemetry/report/presentation contracts, profiling interpretation, verification
   catalog and relevant usage examples. Do not leave handoff and canonical docs as competing truths.

Meaningful verification must cover:

- all retained kinds together per Scope, plugin/unknown identities, version and cross-kind ties;
- short group-node observations, repeated metric attribute sets, attribute base boundaries,
  unusual strings, non-dotted names, escaping and deterministic mixed-type comparison;
- one/many calls, explicit zero, optional absent extrema, unit thresholds and nonzero preservation;
- separate measurement/attribute loss, sibling-point loss, wholly unavailable known targets,
  broad unknown impact, shutdown-only notices and details overflow without false completeness;
- structured cloning, schema consumers, safe target validation, retention at/below/above limits,
  no unbounded lost-target lists and no failure escape into application execution;
- no type sections or routine badges; existing success/quiet/stderr behavior;
- representative commit/file/plugin output, styled terminal and plain/no-color output, and synthetic
  partial/unavailable states. The accepted supplied sample covers commit/plugin, not actual file
  workload execution. That file-workload runtime evidence remains an implementation acceptance gate.

Run appropriate unit/integration checks and existing equivalence gates; do not use snapshot tests
alone to establish semantic correctness. Preserve formal M2/performance obligations in the parent
[M2 plan](instrumentation-opentelemetry-recovery-plan.md); layout examples do not replace them.

## 9. Future work with explicit priority

### Early follow-up: Span aggregation and retention

Preserve OTel measurement meaning and let consumers specify aggregation needs. Current Scope/name
aggregation and independent `single`/`distinct`/`min_max` reducers lose duration/attribute associations
and joint attribute combinations. A formatter cannot recover them. This is a concrete design debt
to address early, not optional presentation polish. No target release is assigned yet.

Distinguish one Span's attribute updates (same-key overwrite in the SDK) from aggregation across
separate same-name Span instances. `(1)` establishes a final-value frequency, not API invocation
count. Review all three reducers together, including the impact of `single` conflicts being treated
as collection issues. Compare bounded attribute-set aggregation with retaining individual completed
observations; do not preselect unbounded raw storage. Define required analysis capabilities, memory
bounds, admission, privacy, loss reporting and future export boundaries before implementation.

Reference: [OTel Set Attributes](https://opentelemetry.io/docs/specs/otel/trace/api/#set-attributes).
The current reducers are gitlode's local analysis policy, not OTel's Span attribute semantics.

### Feedback-driven topics

Domain-specific pivots such as `gitlode.git.object.purpose`, alternative grouping axes, display
filtering, style refinements and compact attribute summaries remain candidates. Add semantic
relationships to metadata only when they are meaningful independently of a preferred view. Naming
policy documentation and suspected semantic inconsistencies deserve audit; no bulk attribute rename
or interpretation inferred solely from matching name prefixes is authorized here.

## 10. Boundary examples and invariants

The examples below are synthetic and illustrate the specified edge rules, not captured product output.

| Input/evidence                                    | Output or handling                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Duration 0.00099996 s                             | `1 ms` after four-significant-digit rounding and unit promotion                                  |
| Byte value 1023.96 B                              | `1 KiB` after rounding reaches the next unit boundary                                            |
| Missing histogram minimum, otherwise valid result | `min=—`, no collection warning solely for optional absence                                       |
| String attribute value `true` versus boolean true | `"true"` versus `true`                                                                           |
| Observation name `gitlode..read`                  | Absolute `/"gitlode..read"` row beneath Scope, without empty groups                              |
| Detailed issue capacity exceeded                  | Fixed fallback retains kind/effect evidence and discloses omitted detail; no guessed target list |
| Shutdown failure after valid measurement snapshot | Lifecycle notice; no inferred measurement loss                                                   |

For two ended Spans, one valid 10 ms duration and one detected invalid duration, assuming both
error statuses are valid and unset:

```text
Scope: example
  /example
    operation : calls=2, total=10 ms, avg=—, max=10 ms, errors=0
      ! Duration summary excludes 1 invalid duration; average unavailable.
```

The total/max describe retained durations, while calls includes both operations. `5 ms` would
incorrectly treat the missing duration as zero. This collector-quality handling does not split
Spans by attributes or expand missing-data detection into recorders. If all durations were invalid,
total/avg/max would each be unavailable, and calls/errors could still remain valid.

Contract review must preserve these invariants: issue overflow cannot restore numeric validity;
retained numeric validity cannot establish whole-run completeness; lifecycle-only detail overflow
cannot invent measurement loss; a lost sibling point cannot invalidate an intact point's values.
The retained measurement mask and fixed fallback effect summary serve different responsibilities.

## 11. Shared cosmetic styling extension

### Required principles

Styling supplements an already interpretable plain-text result. It must not carry information
available only through color, weight or brightness. Styled and plain modes have identical text,
ordering, indentation, punctuation and notification placement after removing styling escapes.

Use semantic roles in shared `src/presentation/styling.ts`, with terminal colors/weights defined
there. Profile formatters must not call chalk directly or choose colors from names or attribute
values. Values such as `success`, `error`, `ready`, `true` and `false` have the same value style;
do not infer severity from domain data, numeric magnitude, ratios or elapsed time.

Add shared roles when existing roles do not fit semantically. Do not repurpose `stageLabel` for
arbitrary headings or `refsValue` for generic identifiers simply because their colors look useful.
Existing progress/application-summary styling remains as defined. This extension is an initial
specification subject to operational feedback, without a prescribed review date.

### Accepted role mapping

| Profile element                                               | Shared semantic role    | Initial treatment                 |
| ------------------------------------------------------------- | ----------------------- | --------------------------------- |
| Profile title, Scope heading, namespace heading               | New `sectionHeading`    | Default foreground, bold          |
| Ordinary observation name                                     | Default text            | Default foreground, normal weight |
| Numeric field label and attribute key                         | Existing `fieldKey`     | Dim                               |
| Available numeric value and scalar attribute value            | Existing `primaryValue` | Bright white                      |
| Unit                                                          | Existing `unitSuffix`   | Dim                               |
| Structural separators `:`, `=`, field commas                  | New `separator`         | Dim                               |
| Unavailable numeric `—` and result `unavailable`              | Default text            | Default foreground, normal weight |
| Warning-severity collection/lifecycle notification marker `!` | Existing `warnBadge`    | Yellow, bold                      |
| Info-severity notification marker `!`                         | Default text            | Default foreground, normal weight |
| Notification explanation                                      | Default text            | Default foreground, normal weight |

The two new roles describe general structure and punctuation, not profile-only concepts. Their
plainStyling implementations return input unchanged. `sectionHeading` uses `chalk.bold` and
`separator` uses `chalk.dim` in the shared factory. A role may initially share visual treatment with
another role without sharing its meaning.

Use `sectionHeading` instead of the current green `summaryHeader` for Profile. Keep
`summaryHeader` for the existing application completion summary. Profile's heading does not assert
that measurements are complete or operations error-free, including when printed after success.

Style only a group-node observation's name as a heading; style its fields by their own roles.
Style the entire `Scope: name@version` heading together. The root `/` and attribute absolute-name
`/` belong to their name/key token and inherit that token's style; do not dim them separately as
separators. Quoting/escaping is performed first and inherits the escaped token's role.

For attribute summaries, scalar values and frequency/range numbers use `primaryValue`; punctuation
such as parentheses, commas and the range ellipsis uses `separator`. Thus `exhausted(3)` retains
the same meaning in both modes. Coverage labels use `fieldKey` and their counts use `primaryValue`.
Placeholders are not measurement numbers; keep `—` visible in default foreground rather than dim.

Use diagnostic severity supplied by telemetry, not inferred from message text. Summary-marker
severity is the highest retained issue severity, including severity preserved in the bounded
fallback. Preserve that fixed severity evidence during diagnostic compaction. Current profile
diagnostics have info/warning severity, so no use of `errorBadge` is needed. This does not turn a
profile diagnostic into an application warning. Explanatory text must convey impact without color;
the decoration alone is not a new displayed severity field.

Keep `errors=0` and `errors=2` in ordinary field/value styles in this initial mapping. The numeric
error count is telemetry-defined and could support later emphasis, but this extension introduces
no conditional numeric coloring or thresholds. `unavailable` is not automatically red/yellow:
any warning emphasis comes from an evidenced accompanying diagnostic, not from missingness alone.

### Composition and acceptance

Apply escaping, formatting, ordering and spacing to semantic tokens before decoration. Leave
indentation/line breaks outside decorators and avoid styling whole measurement/attribute rows.
Reuse the existing stderr TTY-aware factory and color-support policy; add no color flag or forced
ANSI mode. Plain/non-TTY output contains no styling escapes. Color capability may suppress colors
even in a TTY; the text remains independently readable.

Verify token-to-role mapping with a test Styling implementation and verify styled/plain text
equivalence after stripping ANSI. Include group-node observations, quoted identifiers, relative
and absolute attributes, frequencies/ranges, missing fields, info/warning notifications and their
overflow summary. Test that domain values such as success/error do not select styles. Inspect
representative terminal output on light/dark backgrounds; this remains runtime acceptance, not
evidence established by Markdown examples. Do not make exact ANSI sequences a public contract.
