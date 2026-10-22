# Telemetry acceptance for v0.13.0

The human-approved convergence policy of 2026-10-22 supersedes the earlier telemetry migration
performance requirements for this release. Preserve implemented product functionality and intent.
Reducing verification requirements is not permission to remove or narrow telemetry features.

Compare v0.12.0, the actual release candidate with profile disabled, and that same candidate with
profile enabled against the same repository and equivalent extraction settings. Choose a practical
repository and a small, declared set of executions. Record candidate identity, environment, commands,
absolute extraction times and relative differences. No large generated fixture, minimum-duration
calibration, platform matrix or detailed memory measurement is required for this acceptance.

There is no agreed numerical slowdown threshold. Present observations to the human for acceptance;
do not manufacture a numerical pass or repeat executions until a preferred result appears. Preserve
unsuccessful executions and explain any justified repeat. Bound cumulative work before execution and
return for a value/cost decision when verification or infrastructure work expands.

Check JSONL equivalence using a simple content comparison where feasible. Explain any normalization
and compare equivalent records/settings. If only counts or byte sizes can reasonably be checked,
state explicitly that these do not prove content identity. Do not build a new comparison framework.

Retain proportionate functional, profile-output and installed-package checks for the actual candidate.
Existing evidence may be reused where applicable, with its limitations stated. A limited timing or
output check does not establish unmeasured memory behavior, all workloads or all operating systems.

Historical first-target passes, RSS failures and incomplete calibrations keep their original meaning.
The [earlier performance protocol](telemetry-performance.md) and its catalog describe those results;
their matrix, calibration, RSS and aggregation requirements are not current v0.13.0 release conditions.
An independent sibling benchmark repository is a separate task and is not a release prerequisite.

The human owns acceptance and PR approval/merge. On 2026-10-22, the human accepted the bounded
comparison of candidate `d6dc7e03a99e29a47d0f35b33df489f0eaf87759` and authorized retirement of
the temporary migration publish gate. Its validator, dedicated tests/typecheck and blocked record
are removed without replacement. Ordinary release and package checks remain. This acceptance does
not authorize publication or claim unmeasured workloads are verified. The
[convergence record](../handoff/opentelemetry-v013-convergence.md) retains results and limitations.
