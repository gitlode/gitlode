# OpenTelemetry Instrumentation Redesign Handoff

## Status and authority

Runtime migration T00A through T12 and performance readiness T13A are complete. The implemented
contract lives in [telemetry design](../design/telemetry.md), observation catalogs, and the
[verification contract](../design/telemetry-verification.md). Completed implementation instructions
were removed; their history remains in the pre-recovery commits.

The [recovery plan](instrumentation-opentelemetry-recovery-plan.md) owns current sequencing,
branch integration and the M0/M1/M2 distinction. M0 is complete; M1 is awaiting reintegration through
T13B, T13 and the redesign parent branch. The first two PRs have been merged by the human; the
R1/R2 corrections, independent review and renewed cumulative validation are now accepted.
Final integration awaits human PR authorization and merge. Integration does not accept formal performance
or publishing. C1-C6 general cleanup proposals do not expand this unit's release gates.

| Unit     | Status   | Continuation evidence                                                                                                                                  |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T00A–T12 | complete | API migration, recorders, SDK collection, operation owners, plugins and runtime presentation reviewed; see canonical design and verification contracts |
| T13A     | complete | Sidecar, aggregation and clean package/readiness verification reviewed                                                                                 |
| T13B     | pending  | M0 one-target path accepted; M1 placement, gate and two-platform validation accepted; reintegration and full M2 performance acceptance remain          |
| T13C     | pending  | Consolidation follows full T13B and M2 acceptance                                                                                                      |

No original design gate remains unresolved. New contract changes require planning-owner resolution;
an implementation or measurement session cannot change thresholds, observations or ownership locally.
The objective remains useful OTel API-based profiling without changing extracted facts, JSONL,
checkpoint semantics or application failures. Profile readability is a pre-release M2 obligation.
External export and combined collection modes are outside this migration.

## Remaining units

### T13B: Reference calibration and performance acceptance

Prerequisites: T13A, an approved reference environment, and a preserved pre-migration release CLI
with its exact Git revision.

Recovery mapping: M0 establishes the usable Linux/WSL2 measurement path; M2 completes this unit's
full acceptance. M1 integration alone does not complete this unit. Windows pilot artifacts are
diagnostic history, not formal evidence for the newly selected Linux/WSL2 environment. The reviewed
calibration repairs below need not be reopened without a concrete defect or an approved design change.

The bracketed calibration repairs and v3 recipe are implemented and reviewed. Preserve their
accepted behavior; the remaining scope is:

- calibrate and freeze all five repository targets using the accepted 10–30 second legacy-disabled
  procedure and record target-scoped environment and calibration artifact references;
- capture the complete `legacy_off` artifact matrix and verify its deterministic behavior evidence;
- build the redesigned release candidate and run all cataloged `disabled_overhead` and
  `profile_overhead` comparisons with the paired protocol;
- run the fixed N and 4N aggregation-scale comparison and the cataloged report-size, trace-volume,
  command-count, RSS, and bounded-growth checks;
- investigate failed or inconclusive results with the unchanged manifest and thresholds; and
- preserve and report raw artifacts and provenance outside normal package contents, recording any
  proposed exception with every catalog-required field for trunk review.

Exit gate: required calibration and legacy capture are complete and accepted. Every comparison and
check passes or, only where the catalog permits exceptions, has a complete proposal for explicit
acceptance. An exception proposal alone does not close T13B. No result may be inferred from
test-scale fixtures or an incompatible environment.

### T13C: Consolidation and handoff closure

Prerequisites: T13B acceptance, including explicit trunk approval of any performance exception.

Recovery mapping: complete this unit at M2, after the additional pre-release obligations in the
recovery plan are accepted. An M1 merge does not authorize deleting either handoff.

Scope:

- run the final cataloged functional, owner, fault, equivalence, volume, bounded-growth,
  architecture, type, lint, test, build, package, schema, syncpack, and format checks;
- migrate all remaining stable performance and implementation facts into their durable design,
  contributing, profiling, usage, architecture, domain, and plugin documentation homes;
- remove migration-status and transitional wording that no longer describes the implementation;
- verify by repository-wide search that no removed contract or migration-only code remains; and
- delete this handoff after its remaining facts have durable homes.

Exit gate: T13B and the additional M2 obligations are accepted, no migration-only
code or note remains, this handoff is deleted, and the trunk session confirms the redesign complete.

## Working rules

Select functional, owner, failure-isolation and equivalence cases from the canonical
[verification contract](../design/telemetry-verification.md), and formal obligations from the
[performance contract](../design/telemetry-performance.md) and its catalog. Tests of short fixtures
do not substitute for formal reference measurements. Preserve original evidence identities across
squash and follow the recovery plan's new-candidate boundary before M2 measurements.

Follow [collaboration guidance](../agents/collaborative-work.md) for session scope and human PR/merge
authority. Keep unaccepted T13B/T13C work explicit until release acceptance; delete this remaining
handoff only after its open facts have durable homes and its obligations are accepted.
