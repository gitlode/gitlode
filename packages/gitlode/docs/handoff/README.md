# gitlode Handoff Documents

This directory contains continuation notes for unfinished work, future implementation sessions, and
investigations that may be resumed by human developers or coding agents.

Handoff documents are useful working context, but they are not durable source-of-truth design
documents.

## Active OpenTelemetry work

Start with the [M2 continuation plan](instrumentation-opentelemetry-recovery-plan.md) for milestones,
remaining decisions, branch/evidence preservation and session routing. M1 is integrated; M2 proceeds
on `feature/otel-redesign_M2`. The [redesign plan](instrumentation-opentelemetry-redesign-plan.md)
retains T13B/T13C exit criteria. The [M0 result](opentelemetry-m0-result.md) supplies reusable environment
setup and one-target provenance; the [M1 evidence note](opentelemetry-m1-validation-result.md) supplies
corrected functional/package validation and squash attribution. These four notes retain unfinished
work context, not active instructions to repeat M1. Stable contracts live in design/contributing docs.

The [profile design](opentelemetry-m2-profile-design.md) is accepted at `d87bfd6`.
P1 is [independently accepted](opentelemetry-m2-profile-p1-review.md#correction-round-1-re-review-outcome)
at `dc6cfbd`. The active next assignment is
[post-diagnosis R4 focused review](opentelemetry-m2-profile-p2-review.md#post-diagnosis-r4-focused-review)
at `755e7d3`. R1-R3 and transport remain accepted; R4 awaits independent acceptance.
P2/P3 and M2 acceptance remain pending.

The Git CLI adapter plan and deferred test-code typechecking note are separate workstreams; they are
not automatically additional M2 obligations.

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
