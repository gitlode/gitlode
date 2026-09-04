# Telemetry Performance Verification

This document defines the performance acceptance policy for the telemetry redesign. Exact
thresholds, fixture requirements, measurement fields, and environment metadata are canonical in
[`telemetry-catalog/performance.yaml`](telemetry-catalog/performance.yaml). Functional verification
is defined separately in [`telemetry-verification.md`](telemetry-verification.md).

## Comparison model

The migration compares redesigned profile-disabled execution with the pre-migration disabled
baseline, then compares redesigned profile-enabled execution with redesigned disabled execution.
The old and new enabled profilers are not compared because they intentionally collect different
signals and observation volumes.

Profile-disabled is the normal execution path and has the stricter acceptance threshold: no more
than 5 percent median wall-clock overhead and no more than the greater of 8 MiB or 5 percent peak RSS
growth. Local profile is explicitly enabled for diagnosis and permits no more than 15 percent median
wall-clock overhead and the greater of 32 MiB or 15 percent peak RSS growth.

## Reproducible measurement

Measurements use clean release builds and run the bundled or installed CLI as a child process.
`--quiet` suppresses presentation noise without disabling requested local collection. Baseline and
candidate runs use the same repository snapshot and filesystem class but separate output
directories.

Two warmups precede seven measured pairs. Pair order alternates between baseline-first and
candidate-first, and acceptance uses the median paired ratio. A fixture shorter than ten seconds is
useful for semantics and volume but is not a wall-clock gate.

High variation, environment mismatch, failed child execution, or failed output equivalence makes a
measurement inconclusive rather than passing or failing. Inconclusive measurements are rerun under
controlled conditions.

## Fixtures

The suite contains commit-heavy and file-heavy deterministic repositories for both Git adapters, a
deterministic plugin-heavy projection case, and a Git-independent aggregation scale case. Phase 0
calibrates repository sizes with a two-stage search on the reference environment. It doubles the
candidate workload to bracket the ten-second lower threshold, then uses deterministic integer binary
search to select the smallest permitted quantity whose observed legacy-disabled median is at least
ten seconds. The selected median must not exceed thirty seconds. This refinement is required even
when a doubling step jumps directly from below ten seconds to above thirty seconds.

Every calibration pilot uses the cataloged warmup and measured-run counts. Its child and behavioral
evidence must pass before its median participates in the search. A pilot whose median absolute
deviation exceeds five percent makes the attempt inconclusive. The same applies if completed pilots
classify a smaller quantity at or above ten seconds while classifying a larger quantity below ten
seconds; individual median values need not otherwise be strictly increasing. The harness must not
automatically retry or select a favorable sample. The initial manifest quantity is the minimum
permitted quantity. If it already exceeds thirty seconds, or adjacent permitted integer quantities
leave no value inside the window, calibration fails with preserved evidence rather than weakening
the accepted window.

The harness atomically persists artifact-safe progress after every completed pilot, including the
quantity, unrounded median and median absolute deviation, raw warmup and measured outcomes,
validation results, normalized behavior, revisions, and target recipe hash. A terminal failure after
workflow preparation begins must preserve all completed pilots. Temporary output and checkpoint
paths are excluded. An interrupted attempt may inform diagnosis but its measurements are not resumed
or combined with a later formal attempt. Successful quantities are then frozen in the manifest for
the entire migration.

The plugin fixture deliberately excludes network, IPC, and arbitrary script work. Such costs belong
to the injected workload and are not evidence of host telemetry overhead.

## Bounded growth and volume

The aggregation fixture runs equivalent identity and attribute sets at `N` and `4N`. Aggregate
groups, datapoints, and histogram buckets must remain constant, and profile-specific RSS growth may
increase by no more than 8 MiB. This complements point-in-time peak limits by detecting raw span or
sample retention.

Trace-volume checks reject the return of per-record, per-write, per-blob, per-diff, and per-commit
file-expansion spans. Git CLI command spans may scale only with actual command invocations and must
not cause additional commands. Plugin-created spans are reported separately from host volume.

Repository sidecar acceptance is a separate formal workflow. For `target_on`, the sidecar and a
valid `ProfileReport` are required; `legacy_off` and `target_off` are not-applicable. The repository
checks report schema, signal status, diagnostics, the 1 MiB report limit, and prohibited host
spans, and propagates fail or inconclusive to the top-level evaluation after saving the artifact.
It does not reuse aggregation N/4N/RSS evaluation. Git CLI command-start counts are not inferred
from runtime spans; any T09 command-parity result is explicitly contract evidence unless an
independent development-only command-start measurement is available.

For each fixed performance fixture, the development-only collector's JSON UTF-8 representation of `ProfileReport` must remain at
or below 1 MiB. This is a fixture acceptance limit, not a claim that an unbounded number of configured
plugin scopes consumes constant space.

## Metrics and environment

Raw artifacts retain wall time, peak RSS, output and extraction counts, report size, aggregate and
datapoint counts, diagnostics, environment fingerprint, fixture hash, script revision, and baseline
revision. Values are not rounded in stored artifacts. CPU time may be recorded for investigation but
is not an initial cross-platform gate.

Peak RSS is sampled externally from the target gitlode child process at intervals no longer than 25
milliseconds. The benchmark harness's own memory is excluded.

## Microbenchmarks

No universal nanoseconds-per-operation threshold is assigned to individual recorder calls. JIT,
CPU, and Node changes make such a gate unstable. Microbenchmarks instead verify clock reads and
instrument lifecycle and help locate regressions. Formal acceptance comes from the paired
end-to-end and bounded-growth measurements.

## Failed acceptance

A failed threshold first triggers noise, observation-volume, no-op path, allocation, clock,
instrument, SDK view, and collector-retention investigation using the unchanged manifest. Thresholds
are not relaxed automatically.

Any accepted exception records the affected fixture and adapter, raw result, cause, rationale,
impact, and reevaluation condition. Removing an observation to meet performance criteria is a design
change and cannot occur silently inside an implementation branch.
