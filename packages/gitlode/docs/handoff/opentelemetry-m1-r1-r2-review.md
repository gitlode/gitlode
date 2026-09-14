# Independent review of M1 pre-merge R1/R2 corrections

## Assignment and fixed inputs

Use a new human-started review conversation, independent of implementation. Review only the accepted
pre-merge R1/R2 corrections and their affected dependencies. The trunk conversation owns acceptance
and the subsequent cumulative validation assignment. Do not implement corrections in this review.

- Base: `3ed3cf47a9efcddffbbf4a45144325c7cfa807ad`.
- R1: `f755cc775f7ecb8e299a0eb3f36cea0f40bd7eda`.
- R2 / final implementation target: `0354bab6bcf8e2f78bb6dcb0d23843576504e869`.
- Implementation outcome checkpoint: `93f881784c6c9c47e51fdaaf9b42a852c8afa068`.
- Working branch: `feature/otel-redesign`; subsequent changes adding this review packet must be
  documentation only. Verify commit existence, ancestry, diff inventory and worktree before and
  after review. Do not silently review a changed implementation target.

The implementation diff has 13 source/test/durable-document files; the outcome adds one handoff
file. Trunk checked the reported OIDs, clean worktree, diff scope and whitespace, and inspected the
main composition/session/reader changes. This was routing verification, not independent acceptance.

Read `AGENTS.md`, the [accepted recovery disposition](instrumentation-opentelemetry-recovery-plan.md#accepted-pre-merge-review-disposition-2026-09-14),
the [implementation outcome](opentelemetry-m1-r1-r2-implementation.md#implementation-outcome),
[telemetry design](../design/telemetry.md), [verification](../design/telemetry-verification.md), and
the relevant build/test and collaboration guidance. R1/R2 here are the September 14 findings, not
the old M0 supervisor correction. Existing M0/M1 evidence does not accept these production changes.

## Review criteria

Assess every accepted R1/R2 exit criterion; the points below focus review without replacing that
contract or adding optional refactoring to M1.

For R1, follow effective session state through normal default worker composition and plugin
bootstrap. Confirm disabled and initialization-degraded paths select no-op Git, extraction,
projection, line-diff, output and plugin recorders and the Git-owned no-op DAG binding. Inspect
the new DAG binding's difference, reachable and certified-closure semantics, including options,
partial iteration and errors; eliminating observations must not change underlying algorithm work.
Enabled behavior, owner recording points and result/JSONL/checkpoint semantics must remain intact.

Inspect the test session/clock injection and optional composition fields. Verify that clock-read
assertions actually exercise production selection rather than merely configuring a clock that an
accidentally active recorder does not use. Review the reported three real-repository cases (disabled
isomorphic-git, degraded Git CLI, enabled isomorphic-git), plugin execution and existing regression
coverage together. Do not demand a combinatorial matrix without a concrete missing failure path,
but identify any omitted path that invalidates the accepted criterion. No-op object tests alone
are insufficient; no formal wall-clock performance claim follows from zero timing reads.

For R2, inspect the installed SDK collection behavior and finite positive timeout validation. The
production default is 1,000 ms; tests override it to 25 ms with a 2,000 ms outer deadline. Verify
the ordinary production constructor uses the finite default and the test override does not bypass
the mechanism. Assess normal, rejected and non-settling real observable callbacks, including an
unlisted plugin metric, metric partial/unavailable status, sanitized diagnostics, result identity,
subsequent shutdown/context cleanup, memoized finalization and late settlement. Distinguish the
SDK's callback errors returned in a collection result from rejection of collection itself.

The bound is on asynchronous collection waiting, not arbitrary plugin cancellation or synchronous
event-loop preemption. Do not broaden this review into a plugin sandbox, generic supervisor,
all-hooks removal, C1-C6 cleanup, metadata redesign or a new publish-gate review. Check that the
durable documentation states the actual guarantee and that no unrelated contracts were relaxed.

## Verification and evidence accounting

Implementation reported build, R1 focused 7 files / 126 tests, R2 focused 2 files / 73 tests, and
combined 9 files / 179 tests passing with no skips; architecture, lint, format and diff checks passed.
One existing Rev-dep compactness warning was reported, with zero errors. Treat these as reported
results unless independently rerun. The exact affected-suite command is in the implementation packet.

Run the affected combined suite once after the required development build, or a justified bounded
subset that independently exercises both corrections. Verify production typechecking through the
checked composite configuration; distinguish it from test/tooling `noCheck`. Trunk inspected the
configuration and confirmed that distinction. Do not expand into repository-wide tooling typing.
Use finite deadlines for callback tests and preserve failure/skip details. Run whitespace checks
on the fixed diff and verify that any post-target changes are documentation only.

Do not rerun full Windows/Linux release/installed-package validation, formal calibration or formal
measurements. Those are separate assignments. If new concrete concerns require broader checks,
explain their relevance and external runtime before starting. Preserve prior archives unchanged.

## Output and stop condition

Write the review result below, then save a documentation-only checkpoint after format write/check
and diff checks. Do not change implementation, acceptance records, frozen candidates or milestone
status. Do not push, create a PR, merge or publish. Keep the child/archive branches intact.

Return the fixed reviewed OID, actual final HEAD/worktree, separate R1/R2 judgments and combined
judgment, exact checks newly run versus reported evidence, and concrete remaining failure paths.
Group required corrections once with source location, violated accepted contract, trigger and effect.
Keep optional improvements separate. If accepted, return to trunk for cumulative Windows/Linux
functional and installed-package validation; this review alone does not complete M1 or permit a PR.

## Review outcome

Pending independent review. R1/R2 remain implemented but unaccepted.
