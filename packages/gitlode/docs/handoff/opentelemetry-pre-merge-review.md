# OpenTelemetry Redesign Pre-Merge Review Handoff

## Purpose, audience, and provenance

This handoff is for the development session preparing to merge `feature/otel-redesign` into
`integration/v0.13.0`. It preserves the independent review delivered to the human on 2026-09-14;
document preparation did not repeat the analysis.

Reviewed comparison:

- Base: `integration/v0.13.0`, `1664798a9f586b1ac4e632d02d3a37cb0c6ebf0d`.
- Head: `feature/otel-redesign`, `8c0b200f7e0ac8f175199b76201297364dccd1a1`.
- Findings, counts, and validation below describe that comparison, not subsequent revisions.
- The review made no source changes. Reproduction results were observed during the review session;
  they are not archived formal performance evidence.

The human requested this document so the development session can consider the review before merge.
The request does not itself accept every proposed refactoring or change milestone status. Confirmed
findings are distinguished from improvement proposals below. The
[recovery plan](instrumentation-opentelemetry-recovery-plan.md) remains the sequencing and integration
authority; the [redesign plan](instrumentation-opentelemetry-redesign-plan.md) retains unfinished
T13B/T13C work. Durable contracts remain in [telemetry design](../design/telemetry.md),
[verification](../design/telemetry-verification.md), and
[performance verification](../design/telemetry-performance.md).

## Decision summary for the development session

Early M1 integration remains a sound strategy. Telemetry touches operation owners throughout the
product, so integrating those boundaries early reduces conflicts with other v0.13.0 work. The review
found no sufficient reason to redesign the recorder APIs or reverse the domain-local placement before
M1.

The review does recommend correcting the disabled-recorder wiring before M1. A second confirmed
finding, unbounded asynchronous metric collection, can be corrected inside collection infrastructure
at M2 but should be tracked as a release blocker. Severity and milestone are separate judgments:
the latter also accounts for conflict risk and the explicitly staged integration plan.

Most simplification opportunities can preserve existing operation-owner call sites and belong at M2.
External export, backend integration, and broader reusable abstractions remain post-v0.13.0 work.

## Confirmed findings

### R1 — P2: Disabled profiling still constructs active domain recorders

**Recommended timing: before M1.**

Relevant implementation:

- [execute-run.ts](../../src/execution/execute-run.ts):
  `createDefaultWorkerExecutionTelemetry()` and recorder construction during application composition.
- [plugin-bootstrap.ts](../../src/execution/plugin-bootstrap.ts): plugin projection recorder creation.
- [worker-telemetry-session.ts](../../src/execution/telemetry/worker-telemetry-session.ts):
  `createDegradedProviders()` and disabled/initialization-degraded session construction.
- [built-in-fact-projector-metric-recorder.ts](../../src/extraction/telemetry/built-in-fact-projector-metric-recorder.ts):
  an example of an active recorder calling `timing.start(true)`.
- [timing.ts](../../../internal-contracts/src/telemetry/timing.ts): clock reads and timing tokens.

The composition path constructs active Git, extraction, projection, line-diff, output, and plugin
recorders regardless of profile state. An SDK that does not retain observations does not suppress
the work performed before the API recording call: clock reads, timing-token allocation, attribute
construction, and DAG accumulation still occur. This conflicts with the disabled-mode contract in
[Local profile mode](../design/telemetry.md#local-profile-mode), which specifies no-op domain recorders.

Review reproduction used the deterministic repository fixture, the actual
`executeWorkerRunRequest()` composition path, `profile: false`, the isomorphic-git adapter, and file
granularity. Counting `performance.now()` calls originating in telemetry timing produced:

| Observation                  | Result  |
| ---------------------------- | ------- |
| Application result           | success |
| Records written              | 12      |
| Telemetry timing clock reads | 108     |
| Profile report present       | no      |

This demonstrates unnecessary disabled-path work; it does not quantify wall-clock regression or
establish a failed formal performance threshold.

Recommended correction: select the existing no-op recorder families during composition according to
the session's **effective** recording state, including initialization degradation. Do not distribute
`if (profile)` branches through extraction operations. The affected composition code is likely to
conflict with other feature work, which is an additional reason to correct it before M1.

Verification should exercise the actual disabled and initialization-degraded composition paths.
Existing direct no-op tests establish the behavior of the no-op objects but do not establish that
production selects them. Preserve application-result, JSONL, and checkpoint equivalence.

### R2 — P1: Asynchronous plugin metric callbacks can prevent finalization from completing

**Recommended timing: explicit M2 release blocker.**

[LocalMetricReader.collectSnapshot()](../../src/execution/telemetry/local-metric-reader.ts) calls
`this.collect()` without a timeout. Plugins receive the standard `Meter` and can register asynchronous
observable callbacks. Excluding plugin-created metrics from the local report happens after SDK
collection, so it does not prevent those callbacks from running.

The review reproduced this with the installed SDK and a real `WorkerTelemetrySession`:

1. Create an enabled session and obtain a plugin-scoped meter.
2. Register an observable gauge callback that awaits a manually controlled unresolved promise.
3. Call `session.finalize()` with an already-determined successful application result.
4. The callback runs and finalization remains pending at a 100 ms observation point.
5. Resolving the callback's promise allows finalization to complete with the application result.

The installed SDK implementation was also inspected: with no timeout supplied, collection awaits
callback settlement without a deadline. The 100 ms observation is reproduction evidence, not a
proposed collection timeout.

Recommended correction: provide a finite metric-collection timeout and preserve the existing
failure-isolation behavior, including returning the application result and continuing shutdown.
Verification should use an actual asynchronous observable callback, not only an injected failure
flag. This can be addressed within collection infrastructure without changing product operation
owners, so it fits M2 despite its severity.

## Change-volume analysis

Counts are Git diff line counts, including comments, blank lines, fixtures, and snapshots. The
classification is by file ownership, not an estimate of semantic complexity.

| Category                                     |   Files |      Added |   Deleted | Net growth |
| -------------------------------------------- | ------: | ---------: | --------: | ---------: |
| Production source                            |      73 |      7,715 |     1,294 |      6,421 |
| Tests, test support, and fixtures            |      77 |     19,493 |       818 |     18,675 |
| Documentation and YAML catalogs              |      27 |      6,136 |       885 |      5,251 |
| Validation and performance scripts           |      18 |      3,334 |         2 |      3,332 |
| Configuration, dependencies, and other files |      14 |        280 |        66 |        214 |
| **Total**                                    | **209** | **36,958** | **3,065** | **33,893** |

Approximately 80% of net growth is tests, documentation, and validation tooling. The large diff is
real, but it is not equivalent to adding 34,000 lines of extraction logic.

Production-source breakdown:

| Area                                                    | Net growth |
| ------------------------------------------------------- | ---------: |
| Shared telemetry contracts and metadata                 |      2,143 |
| Worker SDK composition, collection, and report building |      1,611 |
| Operation owners and dependency wiring                  |      1,309 |
| Domain-local recorders and hooks                        |        848 |
| Presentation                                            |        620 |
| OTel lifecycle helpers                                  |        250 |
| Removed legacy instrumentation                          |       -360 |

The branch combines five kinds of work: API migration; observation redesign across spans, counters,
and histograms; local collection/report reconstruction; catalog and consistency verification; and
performance calibration, evidence management, and release gating. All relate to the migration, but
OTel API compatibility alone does not require all of them. The latter two categories reflect
project-specific verification and maintenance choices.

## Architectural assessment and improvement proposals

### Retain domain ownership; simplify repeated mechanisms

Domain-local recorder and hook additions account for 848 lines, approximately 2.5% of total net
growth. Their placement is not the principal source of expansion. Observation points already existed
outside the old centralized instrumentation implementation; the new recorders make the conversion
from domain observations to standard instruments explicit.

Owners have meaningful responsibilities that should remain local: output-call success versus bytes
actually written, partial completed work before expansion failure, plugin callback time versus host
result application, and DAG work versus the enclosing Git span. Centralizing those semantics would
make a common telemetry component depend on domain control flow and risk rebuilding a large custom
instrumentation API above OTel.

The preferred direction is to preserve semantic recorder methods and operation ownership while
reducing repeated construction, lifecycle, metadata, and validation mechanisms.

### C1 — M2 proposal: Reduce independently maintained metadata copies

The seven YAML catalogs total 4,090 lines. Separately,
[metadata.ts](../../../internal-contracts/src/telemetry/metadata.ts) contains 1,819 lines and
[profile-view.ts](../../src/presentation/reporting/profile-view.ts) contains 431 lines. These are not
all duplicates, but observation changes require coordinated manual edits across representations,
followed by tests that compare them. Some copied fields, such as telemetry `owner` and `zeroPolicy`,
serve consistency tests rather than production behavior.

Consider generating the minimum required runtime metadata from the canonical YAML at development or
build time. No production YAML parser is needed. The objective is fewer independently maintained
definitions, not merely fewer generated lines. This is a proposal for consideration, not an accepted
change to the current catalog policy.

### C2 — M2 proposal: Share instrument-construction boilerplate

Catalog lookup and Counter/Histogram construction repeat description, unit, and bucket handling
across recorders. Small common construction helpers can reduce this duplication while keeping
semantic operations such as `completeExpansion()` in their owning domains. Preserve recorder APIs
to avoid revisiting product call sites after integration.

### C3 — M2 proposal: Separate span lifecycle from error-recording policy

In addition to the generic `withAsyncSpan`,
[git-telemetry.ts](../../../git-adapters/src/git-impl/telemetry/git-telemetry.ts) and
[execute-run.ts](../../src/execution/execute-run.ts) repeat start/context/catch/end logic. Different
handling of `GitAdapterError` explains part of the duplication. A shared lifecycle mechanism with
separate error-recording policy is a possible simplification. Because this can affect call sites,
keep it a small independent change rather than a prerequisite for M1.

### C4 — M2 proposal: Clarify collector and report-builder validation boundaries

The metric reader validates histogram count, sum, and bucket consistency; the
[report builder](../../src/execution/telemetry/profile-report-builder.ts) validates the converted
histogram again. Span and metric attribute validation also have similar implementations. Defensive
validation is useful, but multiple validators create maintenance work when their responsibilities
are not explicit.

Separate validation of SDK input from report cloning and sorting, and share invariant checks where
appropriate. This is not a recommendation to remove validation wholesale.

### C5 — M2 proposal: Improve test fidelity and reduce production test machinery

The test increase is not inherently excessive. Async iterator termination, Git subprocesses,
resource disposal, plugin lifecycle, partial success, parent context, and profile on/off equivalence
all warrant verification. The behavioral snapshot alone contributes 1,729 lines.

The gap is at composition boundaries: direct no-op tests do not prove no-op selection, as R1 shows.
The worker session also contains numerous test hooks with injected-failure handling alongside actual
operation-failure handling. Replacing some hooks with tests that fail or delay actual dependencies
could reduce production-only test branches and strengthen the evidence. R2 demonstrates the value
of testing actual SDK callback behavior.

### C6 — M2 proposal: Separate migration evidence tooling from lasting regression checks

The release acceptance validator adds 812 lines and its test adds 946 lines. This is the cost of
migration provenance and acceptance management, not an intrinsic cost of OTel API compatibility.
Do not remove tooling that supports existing evidence before M1. At M2, distinguish migration-only
management from reusable performance regression verification.

The planned private system-test workspace is a useful ownership boundary, but moving files alone
will not reduce the underlying complexity. Preserve evidence attribution and required checks during
any consolidation.

## Recommended milestone disposition

These are review recommendations for incorporation into the development session's plan, not a
replacement for the recovery plan or an automatic expansion of approved work.

| Timing                  | Recommended disposition                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before M1               | Correct R1 and verify actual disabled/degraded composition.                                                                                                |
| Before M1               | Confirm existing operation-owner, recorder API, and DAG observation boundaries as the integration baseline; no broad redesign is justified by this review. |
| M2 release requirement  | Correct R2 with bounded collection and real asynchronous-callback verification.                                                                            |
| Existing M2 obligations | Complete readable profile output, formal performance acceptance, and final-candidate verification.                                                         |
| M2 cleanup candidates   | Consider C1 through C6 in bounded slices that preserve owner call sites where possible.                                                                    |
| After v0.13.0           | External export, backend integration, and broader reusable instrumentation abstractions.                                                                   |

## Validation performed during the review

`npm run build:dev` passed. Two focused Vitest invocations passed, totaling 14 files and 231 tests.
The first invocation covered these paths (7 files, 147 tests):

```text
packages/gitlode/test/telemetry/worker-telemetry-session.test.ts
packages/gitlode/test/telemetry/local-collection.test.ts
packages/gitlode/test/telemetry/domain-metric-recorders.test.ts
packages/internal-foundation/test/otel-support
packages/git-adapters/test/git-impl/dag-telemetry-binding.test.ts
```

The second invocation covered these paths (7 files, 84 tests):

```text
packages/gitlode/test/telemetry/behavioral-baseline.test.ts
packages/gitlode/test/execution/execute-run.test.ts
packages/git-adapters/test/git-impl/git-cli-blob-failure-partial.test.ts
packages/git-adapters/test/git-impl/git-cli-fault-injection.test.ts
packages/git-adapters/test/git-impl/git-cli-persistent-session.test.ts
packages/gitlode/test/execution/plugin-telemetry-owner.test.ts
packages/gitlode/test/plugin-runtime/plugin-projection-telemetry-owner.test.ts
```

R1 and R2 were reproduced separately as described above. The review did not rerun complete release
validation, formal performance measurements, or verification of external archived artifacts.
The [M0 result](opentelemetry-m0-result.md) concerns a different candidate and one workload; it was
not treated as performance acceptance for the reviewed head across all workloads.

## Continuation and closure

Before the proposed merge, the development session should give R1 and R2 explicit dispositions and
carry unresolved release work into M2. Keep optional cleanup proposals separate from required
corrections; their presence does not justify reopening the entire redesign. Assess any later source
delta before reusing the review's evidence.

This document does not authorize a PR or merge. Existing integration authority and candidate/evidence
rules remain in the recovery plan. When the findings and proposals have been resolved or transferred
to their owning work plans, remove completed continuation content. Any accepted durable contract
changes belong in the design or contributing documentation, not in this review handoff.
