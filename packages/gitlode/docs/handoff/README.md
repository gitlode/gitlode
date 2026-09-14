# gitlode Handoff Documents

This directory contains continuation notes for unfinished work, future implementation sessions, and
investigations that may be resumed by human developers or coding agents.

Handoff documents are useful working context, but they are not durable source-of-truth design
documents.

## Active OpenTelemetry work

Start with the [recovery plan](instrumentation-opentelemetry-recovery-plan.md) for the current
reintegration route, human PR/merge authority, milestones, and next assignment. The
[redesign plan](instrumentation-opentelemetry-redesign-plan.md) retains unfinished T13B/T13C scope.
The [M0 result](opentelemetry-m0-result.md) preserves Linux/WSL2 setup and one-target evidence;
the [M1 evidence note](opentelemetry-m1-validation-result.md) preserves candidate validation,
package identities, and the CI correction needed for reintegration. Completed session packets
have been removed; accepted contracts live in the design and contributing documentation.

Before the redesign-to-integration merge, read the
[pre-merge review handoff](opentelemetry-pre-merge-review.md). It preserves the independent review of
`1664798` to `8c0b200`, including confirmed findings, change-volume analysis, M1/M2 recommendations,
and the limits of the review evidence.

## Lifecycle

Use handoff documents for:

- preserving context between development sessions;
- recording experiments, open questions, and candidate designs;
- giving future human developers and coding agents enough context to resume work safely.

Do not use handoff documents as the final home for stable contracts. When work is completed or a
design decision becomes durable, migrate the stable content to the appropriate canonical document:

- user-visible workflows or behavior: [`../usage.md`](../usage.md);
- profiling diagnostics behavior: [`../profiling.md`](../profiling.md);
- implementation contracts and rationale: [`../design/`](../design/).

After migration:

- delete the handoff document when no unfinished work remains; do not retain it as implementation
  history;
- when unfinished work remains, remove completed sections and keep only the context needed to
  continue that work.
