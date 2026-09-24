# gitlode Profiling Guide

`--profile` enables one local OpenTelemetry collection session for the worker run. It uses the
same application path, Git operations, plugin callbacks, and JSONL output as an unprofiled run.
The report is SDK-independent and is created after application resources have been disposed.

## CLI behavior

The application summary is printed first. A successful, non-quiet run may then print a Profile
block. Failed runs finalize telemetry but do not display a profile. `--quiet` suppresses progress,
summary, and profile output. If local initialization degrades, extraction continues with a
sanitized warning and no Profile block.

## Generic hierarchy

The view groups every retained Span, counter, and histogram by instrumentation Scope name and
optional version. Within each Scope, the first two dot-separated observation-name segments form
namespace levels; remaining segments form the observation row. The root namespace begins with `/`.
Kinds are not separate sections or badges. Different kinds and repeated metric points with the
same name remain independent rows, ordered by kind and typed attributes.

For example:

```text
Profile
  Scope: gitlode.git
    /gitlode
      git
        commit.walk : calls=1, total=6.9 s, avg=6.9 s, max=6.9 s, errors=0
        object.cache.lookup : 670 objects
          adapter = isomorphic-git
          object.purpose = materialize
```

Scopes, names, kinds, and typed attributes determine a stable code-unit order. Short names may
carry measurements on a namespace line. A name that is also a namespace shows its attributes
before child observations. Malformed-dot names and strings that could be confused with delimiters,
booleans, or numbers are quoted and escaped. Unknown admitted names and plugin Scopes use the same
rules; there is no Plugins or fallback bucket.

## Values and diagnostics

Spans show calls, total, average, maximum, errors, and bounded attribute summaries. Counters show
one value per retained typed attribute set. Histograms show samples, total, average, nullable
minimum and maximum; retained buckets are not expanded and percentiles are not calculated.
Explicit zero is preserved. An unavailable field is `—`, never a synthetic zero.

Durations use ns, µs, ms, or s; sizes use B, KiB, MiB, or GiB. Values use at most four significant
digits, promote when rounding reaches the next unit, and use scientific notation where necessary so
a nonzero value is never displayed as plain zero. Report values themselves are not rounded.

When collection or lifecycle issues exist, a compact notice follows the Profile title. Structured
details appear at the narrowest evidenced report, Scope, observation, point, or attribute location.
An identified observation with no valid result remains visible as `unavailable`; valid siblings
remain ordinary rows. Occurrence counts, known loss amounts, unknown loss amounts, and omitted
diagnostic detail are kept distinct.

If normal report construction fails, the ordinary Profile path explains whether validated
measurement results are present. Without a trusted snapshot, all three results are unavailable and
no partial measurements are reconstructed. If earlier issue provenance is unavailable, that is
stated separately.

Terminal formatting is for human diagnosis and is not a machine-readable compatibility contract.
Consumers requiring a protocol should use the structured `ProfileReport` at the worker boundary
rather than parsing CLI spacing or punctuation.
