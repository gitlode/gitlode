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
calibrates repository sizes by doubling candidate workloads until the legacy disabled median reaches
10–30 seconds on the reference environment, then freezes those quantities in a manifest for the
entire migration.

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

For each fixed performance fixture, the JSON UTF-8 representation of `ProfileReport` must remain at
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
