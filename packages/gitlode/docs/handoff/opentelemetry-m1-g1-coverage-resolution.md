# G1 coverage diagnosis and correction-round-2 boundary

## Planning acceptance and next assignment

The planning owner accepts the diagnosis and minimal correction design from checkpoint
`d654a640d2afcc1a716d69b957a28452a9a0457c`. The next assignment is a new implementation conversation
for correction round 2, using the exact five-file scope and finite regression checklist below.
This section authorizes that bounded implementation and supersedes the diagnosis-only exit boundary
at the end of this document. G1 is still unaccepted; G2 remains accepted and must not be reopened.

Record actual starting HEAD and preserve worktree changes. Add one target_on
`repository_profile_report` attestation per repository target with eight exact pass-only subchecks;
retain existing exception-capable checks. Use an independent literal test oracle to prevent the
shared-incomplete-inventory failure. Ensure unknown subcheck keys and an exception field on the
pass-only group are rejected as well as missing/non-pass outcomes.

Do not run formal measurements or the release pipeline; no long empirical workload is planned.
Run the specified focused checks, preserve the blocked live record, and create a checkpoint commit.
Record commands/results and actual evidence paths; report the resulting OID in the outcome without
trying to embed a commit's own hash inside itself. Return for focused re-review in the existing gate
review conversation; do not declare G1/M1 accepted, merge, publish, or freeze a candidate.

If a concrete contradiction prevents the specified correction, return the predicate and evidence
rather than silently expanding the schema or reopening accepted work. If the same G1 issue remains
after round 2, reconcile it through the bounded diagnosis process, not another patch loop.

## Diagnosis outcome

Diagnosis completed on 2026-09-11 at actual HEAD
`ffecb0af6ba8e0039f19fed4facfd15dbc0bbf77`, with a clean worktree before this document was added.
The fixed correction under diagnosis is `f7d8a01bd75231b15136707ab40e2b21adf16b1b`.
The two later commits, `69f0521` and `ffecb0a`, change only handoff documents; the validator, shared
target definitions, and tests therefore match the fixed correction. The live acceptance record
remains blocked. G2 is not reopened.

G1 is not accepted. A synthetic accepted record is built from
`requiredTelemetryRepositoryChecks`, which contains only `report_size` and
`prohibited_host_spans`. `requiredCheckIdentities()` uses the same array as its entire repository
sidecar oracle. Consequently, the positive fixture and validator agree with each other while both
omit outcomes that `validateSidecarMatrix()`, `evaluateRepositoryProfileReport()`, and the formal
workflow require before a `target_on` sidecar can pass.

The root cause is an incomplete obligation inventory, not a missing runtime evaluator. A comparison's
top-level `status` is an aggregate of performance, behavior, and sidecar status, but it does not make
the individual sidecar predicates machine-checkable in the acceptance record. In particular, the
runtime's fail-before-inconclusive composition can produce an aggregate `fail` when a report is both
oversized and incomplete. Treating that aggregate as an excepted performance result could otherwise
hide the inconclusive report condition. The report-validity predicates therefore need one explicit
pass-only attestation with individually machine-checkable subchecks.

## Complete predicate trace

Each row below is traced from the authoritative runtime or design predicate through the saved formal
artifact into the release record. A required outcome is recorded once per canonical repository target
and covers every `target_on` sidecar in that target's profile-overhead workflow. The outcome may reuse
the comparison's archive and evidence; it does not require a new run or archive.

| Authoritative predicate                                                                                                                                                             | Applicable target/state                   | Current gate representation                                                                                         | Required representation                                        | Classification and negative example                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `target_on` capture completes with sidecar status `available`; a missing or inconclusive capture is rejected by `validateSidecarMatrix()` and the caller                          | Five repository targets, `target_on` only | Only indirectly folded into comparison `status`                                                                     | `repository_profile_report.subchecks.sidecarAvailable: pass`   | Named subcheck of the new required `repository_profile_report` attestation. Reject missing, inconclusive, failed, or excepted outcome                                                                                     |
| An available sidecar contains a report; the sidecar process also rejects a successful worker result without one                                                                     | Five repository targets, `target_on` only | Only indirectly folded into comparison `status`                                                                     | `repository_profile_report.subchecks.reportPresent: pass`      | Named subcheck. Reject a sidecar whose report is absent                                                                                                                                                                   |
| `extractProfileReportMeasurements()` accepts the report: object, schema version 1, required arrays, no raw span/sample fields, and valid non-negative safe-integer span call counts | Five repository targets, `target_on` only | No explicit check                                                                                                   | `repository_profile_report.subchecks.schemaValid: pass`        | Named subcheck backed by the existing evaluator, not a second schema implementation. Reject malformed or structurally invalid report evidence                                                                             |
| `signalStatus.spans === "complete"`                                                                                                                                                 | Five repository targets, `target_on` only | No explicit check                                                                                                   | `repository_profile_report.subchecks.spansComplete: pass`      | Named subcheck. Reject missing, partial, unavailable, or other status                                                                                                                                                     |
| `signalStatus.counters === "complete"`                                                                                                                                              | Five repository targets, `target_on` only | No explicit check                                                                                                   | `repository_profile_report.subchecks.countersComplete: pass`   | Named subcheck. Reject missing, partial, unavailable, or other status                                                                                                                                                     |
| `signalStatus.histograms === "complete"`                                                                                                                                            | Five repository targets, `target_on` only | No explicit check                                                                                                   | `repository_profile_report.subchecks.histogramsComplete: pass` | Named subcheck. Reject missing, partial, unavailable, or other status                                                                                                                                                     |
| `diagnostics` exists as an array                                                                                                                                                    | Five repository targets, `target_on` only | No explicit check                                                                                                   | `repository_profile_report.subchecks.diagnosticsPresent: pass` | Named subcheck. Although schema extraction also checks the array, keeping the presence result named distinguishes missing evidence from a nonempty valid array                                                            |
| `diagnostics.length === 0`                                                                                                                                                          | Five repository targets, `target_on` only | No explicit check                                                                                                   | `repository_profile_report.subchecks.diagnosticsEmpty: pass`   | Named subcheck. Reject any diagnostic, including an overflow or lifecycle diagnostic                                                                                                                                      |
| JSON UTF-8 size is at most 1 MiB                                                                                                                                                    | Five repository targets, `target_on` only | `report_size`, exact target and scope                                                                               | Preserve unchanged                                             | Already explicit. An oversized valid report is `fail`; the existing fully reviewed performance-exception path remains available                                                                                           |
| No host span outside the accepted core catalog is observed                                                                                                                          | Five repository targets, `target_on` only | `prohibited_host_spans`, exact target and scope                                                                     | Preserve unchanged                                             | Already explicit. A nonzero prohibited count is `fail`; preserve the existing reviewed performance-exception policy                                                                                                       |
| Sidecars are unique, expected, and bound to the matching run ID                                                                                                                     | Formal workflow matrix                    | Saved `sidecarEvaluation.errors`, folded into comparison `status`, plus per-sidecar provenance in the same artifact | No additional per-run release-record rows                      | Already covered by the identified formal workflow/provenance check. Review of the linked comparison artifact checks this matrix; duplicating all warmup/measured run IDs in the record would add a second evidence matrix |
| `legacy_off` and `target_off` sidecars are `not-applicable`                                                                                                                         | Off states only                           | Formal workflow matrix and unavailable/not-applicable measurements                                                  | No repository check                                            | Not applicable. Correction must not require runtime report evidence for either off state                                                                                                                                  |

Report extraction failure, missing report, unavailable sidecar, incomplete signal status, and missing
diagnostics are `inconclusive` in the formal workflow because the evidence cannot establish the
predicate. A nonempty diagnostics array, oversized report, or prohibited host span is `fail` because
valid evidence establishes a violated predicate. Fail takes precedence when both classes occur in
one report, which is why the new grouped validity attestation and all eight named subchecks must
require literal `pass` and must reject an `exception` field. A general performance exception may
address a measured size or volume failure; it cannot create evidence that was absent, repair an
invalid schema, complete an unavailable signal, or erase a diagnostic.

## One-pass check of the remaining G1 mapping

No second acceptance gap was found outside the repository-sidecar validity slice:

- five calibration and five legacy-capture identities are exact, and their child/behavior outcomes
  are pass-only;
- ten comparison identities are exact; wall-clock and peak-RSS outcomes have the reviewed exception
  path while behavioral correctness remains pass-only;
- the five `aggregation_scale/none:n_to_4n` outcomes exactly name span-group, metric-datapoint,
  histogram-bucket, raw-observation-retention, and profile-RSS-growth obligations;
- Git command parity is explicit for only the two Git CLI repository targets, as required; and
- report size and prohibited host spans already have exact per-target `target_on` identities.

The extra report-size branch in `evaluateVolume()` is not another required aggregation attestation:
the performance catalog applies the 1 MiB repository report limit to commit-heavy, file-heavy, and
plugin-heavy fixtures, not `aggregation_scale`. Its conditional Git span/start comparison is also
not applicable to the Git-independent aggregation fixture. `pluginSpanCount` is required to be
reported separately but has no acceptance threshold. These implementation diagnostics must remain
in the artifact, but adding gate outcomes for them would invent requirements. Runtime-sidecar
evidence is likewise not required for `legacy_off` or `target_off`.

## Minimal correction design

Keep `performance.checks[]` and the existing attestation/provenance shape. Add one
`repository_profile_report` entry per canonical repository target at `target_on`, linked to the
target's profile-overhead comparison. Its fixed `subchecks` object contains exactly the eight names
above, each with literal `pass`. A side-effect-free constant owns the subcheck names; the validator
combines the new check identity with the existing two repository performance checks when constructing
the exact required identity set. This is one additional attestation per target, not eight duplicate
attestations, and adds no evaluator, threshold, archive, or per-run matrix.

The validator must choose outcome policy by check identity:

- `repository_profile_report` accepts only `status: pass`, requires all eight exact pass-only
  subchecks, and rejects `exception`;
- `report_size`, `prohibited_host_spans`, aggregation checks, and Git command parity retain the
  existing `pass` or complete reviewed-performance-exception policy; and
- all repository checks retain exact canonical target, `target_on` scope, and
  `comparisonEvidenceId` binding to that target's `profile_overhead` evidence.

The accepted test fixture must be driven by an explicit literal repository-check oracle in the test,
not solely by the production constants. Assert the production inventory against that literal list.
This directly prevents the omission mechanism that allowed the current incomplete positive record.

## Exact correction-round-2 files

Correction round 2 is bounded to:

- `packages/gitlode/scripts/tooling/telemetry-performance-targets.ts`: define the grouped validity
  check and its eight pass-only subcheck names without changing targets, comparisons, or thresholds;
- `packages/gitlode/scripts/check-telemetry-release-acceptance.ts`: require the combined exact matrix
  and enforce pass-only versus exception-capable outcome classes;
- `packages/gitlode/test/telemetry/release-acceptance.test.ts`: replace the circular repository-check
  fixture oracle and add the finite regressions below;
- `packages/gitlode/docs/contributing/build-test-release.md`: name the new per-target sidecar/report,
  signal, and diagnostic outcomes in the canonical gate description; and
- `packages/gitlode/docs/handoff/opentelemetry-m1-publish-gate-correction.md`: append the implemented
  round-2 outcome, commands, and checkpoint OID after verification.

Do not change the runtime sidecar, performance harness/evaluators, acceptance record, G2 provenance,
publish wiring, performance thresholds, or evidence/archive format.

## Finite regression checklist and exit conditions

Use one temporary-repository accepted record and bounded mutations; no formal workload is needed.

1. Assert the production repository inventory equals the literal three-ID oracle
   (`repository_profile_report`, `report_size`, and `prohibited_host_spans`) and its validity-subcheck
   inventory equals the literal eight-name oracle.
2. Verify the current round-1 positive shape, containing only the two old repository checks for each
   target, is rejected with the missing `repository_profile_report` identity.
3. Remove the grouped validity entry from an otherwise complete record and verify its exact missing
   identity is rejected; then remove each of its eight subchecks in turn and verify the exact missing
   subcheck is rejected (nine bounded cases).
4. Replace each subcheck's `pass` in turn with `inconclusive` and `failed` and verify rejection (16
   parameterized cases). Separately set the grouped status to `inconclusive`, `failed`, and
   `exception`; verify rejection, including a syntactically complete performance exception (three
   cases).
5. For the grouped validity identity, verify duplicate, unknown ID, wrong target, wrong scope, and missing or
   mismatched `comparisonEvidenceId` remain rejected by the existing matrix/link checks (five
   bounded mutations; reuse existing tests where they already prove the branch).
6. Verify `report_size` and `prohibited_host_spans` still accept `pass` and a fully populated reviewed
   exception, and still reject incomplete exception details (bounded preservation check).
7. Verify one record containing all three repository checks for all five targets, all eight validity
   subchecks at `pass`, and the unchanged accepted G2 provenance resolves successfully.
8. Run the focused gate test file, strict validator typecheck, documentation formatting, repository
   format check, and `git diff --check`. Run no full suite, release build/pipeline, installed-package
   test, formal measurement, or publish-capable command for this correction.

Exit only when the literal test oracle and production inventory agree; every missing or non-pass
validity outcome fails closed; exception-capable outcomes retain their existing behavior; the fully
accepting record passes; the live record remains blocked; G2 bindings and accepted publish wiring are
unchanged; required docs are updated; focused checks pass; and the implementation is checkpointed for
focused re-review. This diagnosis itself authorizes no code change, acceptance, candidate freeze,
Version PR, merge, or publication.
