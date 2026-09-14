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

Before the redesign-to-integration merge, read the recovery plan's
[accepted pre-merge disposition](instrumentation-opentelemetry-recovery-plan.md#accepted-pre-merge-review-disposition-2026-09-14).
R1 no-op selection, R2 bounded asynchronous collection and corrected-candidate cumulative validation
are accepted. That section also defines evidence limits, optional C1-C6 follow-up and final integration
preparation. The original review is preserved in Git history, not as an active instruction.

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
