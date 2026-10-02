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

P1/P2/P3, styling and the supervisor cleanup correction are accepted. Next is human-approved
styling-to-profile squash preparation, then complete-profile cumulative validation and integration
into M2. See the [styling return](opentelemetry-m2-terminal-styling-design.md) and
[review/remaining risks](opentelemetry-m2-terminal-styling-review.md). Additional sample display is
not an integration gate; GNOME remains a pre-release check. Full T13B, tests/system organization,
final-candidate validation and T13C remain open. Earlier profile packets are historical evidence until
profile integration cleanup; they are not instructions to restart completed sessions.

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
