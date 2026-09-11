# gitlode Profiling Guide

`--profile` enables one local OpenTelemetry collection session for the worker run. It uses the
same application path, Git operations, plugin callbacks, and JSONL output as an unprofiled run.
The report is SDK-independent and is created after application resources have been disposed.

## CLI behavior

The application summary is printed first. A successful, non-quiet run may then print a Profile block.
Failed runs finalize telemetry but do not display a profile. `--quiet` suppresses progress, summary,
and profile output; warnings and errors retain their normal behavior. If local initialization
degrades, extraction continues with a sanitized warning and no profile block.

## Profile sections

Observations are kept separate and presented in the diagnostic order defined by
[`design/telemetry-catalog/profile-view.yaml`](design/telemetry-catalog/profile-view.yaml):

- Spans: label, total duration, calls, average, maximum, errors, and bounded attribute summaries.
- Counters: one row per observed datapoint, including explicit zero values, with unit and sorted attributes.
- Histograms: count, total, average, nullable minimum/maximum, and unit. Buckets remain in the report
  but are not expanded, and percentiles are not calculated.
- Diagnostics: severity, signal, stage, cataloged label, repeated count, and bounded message.

Groups without observations are omitted. Unknown observations remain visible in deterministic fallback
groups. Plugin observations are grouped by resolved scope name and optional version (`name@version`;
otherwise `name`); namespace and configuration are not reconstructed as identities.

When spans, counters, or histograms are partial or unavailable, a compact status summary appears
before the signal sections and the affected section repeats its state. Complete empty signals are
omitted. Collection overflow and lifecycle failures are profile diagnostics, not application warnings.

Durations use canonical seconds and may render as ns, µs, ms, or s. Byte values use B, KiB, MiB, or
GiB. Entity units use readable plural labels and unknown units remain canonical. Nonzero values are
never rendered as an unqualified zero.

The terminal formatting is intended for human diagnosis and is not a machine-readable compatibility
contract. Consumers requiring a protocol should use the structured `ProfileReport` at the worker
boundary rather than parsing CLI spacing or punctuation.
