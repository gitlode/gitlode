# gitlode Profiling Guide

`--profile` enables one local OpenTelemetry collection session for the worker run. It uses the
same application path, Git operations, plugin callbacks, and JSONL output as an unprofiled run.
The report is SDK-independent and is created after application resources have been disposed.

## CLI behavior

The application summary is printed first. A successful, non-quiet run may then print a Profile
block. Failed runs finalize telemetry but do not display a profile. `--quiet` suppresses progress,
summary, and profile output. If local initialization degrades, extraction continues with a
sanitized warning and no Profile block.

With profiling disabled, the source session selects API no-op telemetry without importing its local
SDK implementation, constructing SDK providers or installing a context manager. Initialization
failure after an enabled request also falls back to API no-op telemetry, after owned partial cleanup;
it may already have loaded SDK code. The [telemetry contract](design/telemetry.md#worker-telemetry-session)
defines no-op root/context semantics. Emitted and installed zero-load proof remains pending D2
release verification; this source change does not establish performance acceptance.

## Generic hierarchy

The view groups every retained Span, counter, and histogram by instrumentation Scope name and
optional version. Within each Scope, full observation names appear directly as rows with a `/`
prefix; namespace grouping is disabled by default. Source-level namespace grouping remains
available for layout experiments; see [CLI styling guidance](design/cli.md).
Kinds are not separate sections or badges. Different kinds and repeated metric points with the
same name remain independent rows, ordered by kind and typed attributes.

For example:

Illustrative plain output (including heading padding):

```text
 Profile
   Scope: gitlode.git
     /gitlode.git.commit.walk  : calls=1, total=6.9s, avg=6.9s, max=6.9s, errors=0
     /gitlode.git.object.cache.lookup  : 670objects
      /gitlode.git.adapter = isomorphic-git
      /gitlode.git.object.purpose = materialize
```

Scopes, names, kinds, and typed attributes determine a stable code-unit order. If namespace
grouping is enabled in source, short names may carry measurements on a namespace line, and a
name that is also a namespace shows its attributes before child observations. Malformed-dot names and strings that could be confused with delimiters,
booleans, or numbers are quoted and escaped. Unknown admitted names and plugin Scopes use the same
rules; there is no Plugins or fallback bucket.

## Values and diagnostics

Spans show calls, total, average, maximum, errors, and bounded attribute summaries. Counters show
one value per retained typed attribute set. Histograms show samples, total, average, nullable
minimum and maximum; retained buckets are not expanded and percentiles are not calculated.
Explicit zero is preserved. An unavailable field is `—`, never a synthetic zero.

Durations use ns, µs, ms, or s; sizes use B, KiB, MiB, or GiB. Values use at most four significant
digits, promote when rounding reaches the next unit, and use scientific notation where necessary so
a nonzero value is never displayed as plain zero. Measurement numbers and units are adjacent
without a separating space (for example `6.9s`, `1KiB`, `670objects`). Report values themselves are not rounded.

When collection or lifecycle issues exist, a compact notice follows the Profile title. Structured
details appear at the narrowest evidenced report, Scope, observation, point, or attribute location.
An identified observation with no valid result remains visible as `unavailable`; valid siblings
remain ordinary rows. Occurrence counts, known loss amounts, unknown loss amounts, and omitted
diagnostic detail are kept distinct.

If normal report construction fails, the ordinary Profile path explains whether validated
measurement results are present. Without a trusted snapshot, all three results are unavailable and
no partial measurements are reconstructed. If earlier issue provenance is unavailable, that is
stated separately.

Available numeric values and scalar attribute values use the terminal's default foreground without
additional emphasis. This body-text treatment is shared with progress and completion values.
Color and emphasis supplement the hierarchy and notices; plain text retains their meaning.
Heading backgrounds include one space of padding on each side. Plain output retains the same
spacing. Developers adjusting the display can follow the source-level styling guidance in
[`design/cli.md`](design/cli.md) and evaluate the complete output on their own repositories.

Terminal formatting is for human diagnosis and is not a machine-readable compatibility contract.
Consumers requiring a protocol should use the structured `ProfileReport` at the worker boundary
rather than parsing CLI spacing or punctuation.
