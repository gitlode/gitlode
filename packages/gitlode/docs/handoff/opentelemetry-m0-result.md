# M0 completion and one-target evidence

The planning owner accepts M0 as complete after inspecting the returned artifacts. This establishes
an executable and diagnosable measurement path with one complete repository target. M1 integration,
full T13B acceptance, and M2 release readiness remain open. Next is the
[bounded M1 preparation assignment](opentelemetry-m1-preparation.md).

## Identity and results

Archive: `D:\gitlode_test\m0-one-target-20260910T065854Z-a53a5b8`.
Target: `commit_heavy_repository/isomorphic-git`.

- Harness: `a53a5b83d18f9e493ebb39c4db481b762448743f`.
- Legacy release: `76b124e23fcc069be1278629cf01b62ae1456c7a`.
- Candidate release: `a97829b5315d42fbfa2212b718258099e7c90498`.
- Selected quantity: 4,430 commits; the other four repository targets remain incomplete.
- Target recipe hash: `6668bd8a9c032a9d2c9ca2a7aca0a1b7e56055c24b3431e561d3fee156ed738f`.

| Stage             | Result   | Evidence summary                                                                           |
| ----------------- | -------- | ------------------------------------------------------------------------------------------ |
| Calibration       | complete | 23 candidate evaluations, selected 4,430 commits                                           |
| Legacy capture    | pass     | behavior and top-level sidecar evaluation pass                                             |
| Disabled overhead | pass     | paired median wall-clock overhead +3.887%; peak RSS increase 7,426,048 bytes               |
| Profile overhead  | pass     | paired median wall-clock overhead -4.046%; peak RSS increase 1,814,528 bytes; sidecar pass |

Both comparisons have passing formal performance, behavior, and sidecar evaluations with no reasons
reported. The negative profile overhead is an observed result of this comparison, not proof that
enabling telemetry improves performance. It does not quantify possible common harness interference.
Do not generalize this target to other workloads or a changed release candidate.

All four supervision artifacts record `completed`, exit 0, and empty cleanup/finalization errors.
The operator reported all profile sidecar runs passing, approximately 13.2 KiB reports, no diagnostics
or prohibited host spans, no automatic retries, and no residual measurement processes. The planning
owner verified top-level sidecar acceptance, not a separate recount of every report field or a fresh
process inspection.

## Evidence verification and preservation

The planning owner independently verified the SHA-256 of `evidence.sha256` as
`af7500f45a531f606ef598adfda931a2963d52192e93d21beec943f2fadb8cce` and every one of its 680 entries.
The calibration artifact, three formal result artifacts, revision record, selected manifest, and
all four terminal supervision records were inspected. No measurements were repeated for acceptance.

The archive contains command logs, exit codes, environment and release provenance, the frozen
harness bundle, raw and formal artifacts, and manifests before/after calibration. Preserve the
selected manifest and calibration provenance when planning later matrix work. Do not silently
recalibrate this target, assume the repository's unmodified manifest is already calibrated, or treat
M0 evidence as verification of the later M1/final release candidate.

## Execution-time finding

The user reported a session duration of 1h 42m 57s. Supervisor elapsed times sum to approximately
89 minutes: calibration approximately 64 minutes, legacy capture 4 minutes, disabled comparison
8 minutes, and profile comparison 12 minutes (rounded individually). These are observed command
durations, not model reasoning time or a prediction for another attempt. The remainder of the session
cannot be attributed from these records alone. Repeated fixture preparation and measured runs make
this workflow inherently capable of long execution. Future measurement packets must warn about that
before execution; numerical estimates are not required.
