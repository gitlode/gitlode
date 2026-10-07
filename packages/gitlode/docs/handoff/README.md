# gitlode Handoff Documents

This directory contains continuation notes for unfinished work, future implementation sessions, and
investigations that may be resumed by human developers or coding agents.

Handoff documents are useful working context, but they are not durable source-of-truth design
documents.

## Active OpenTelemetry work

Current assignment: [disabled SDK boundary independent D2 review](opentelemetry-m2-disabled-sdk-design.md).
D1 is independently accepted at implementation `04dc187`; D2 and performance acceptance remain open.
Trunk accepted the design with the human-approved invalid no-op root identity. D1 covers source
session/lifecycle changes; separate D2 emitted/installed boundary verification remains required.
The bounded RSS experiment is closed with unresolved attribution; further formal measurement is not
assigned. The human approved this product design direction, not an experimental-code merge.

Start with the [M2 continuation plan](instrumentation-opentelemetry-recovery-plan.md) for milestones,
remaining decisions, branch/evidence preservation and session routing. M1 is integrated; M2 proceeds
on `feature/otel-redesign_M2`. The [redesign plan](instrumentation-opentelemetry-redesign-plan.md)
retains T13B/T13C exit criteria. The [M0 result](opentelemetry-m0-result.md) supplies reusable environment
setup and one-target provenance; the [M1 evidence note](opentelemetry-m1-validation-result.md) supplies
corrected functional/package validation and squash attribution. These four notes retain unfinished
work context, not active instructions to repeat M1. Stable contracts live in design/contributing docs.

P1/P2/P3, styling, corrections and cumulative validation are complete. Profile is squash-integrated into M2 by PR #113 at `c29376b`. The private
`tests/system` workspace is also integrated by PR #114. The
[readiness slice](opentelemetry-m2-measurement-readiness.md) is integrated by PR #115;
[candidate preparation F](opentelemetry-m2-candidate-freeze.md) is accepted; next is the
[first fixed-candidate target measurement](opentelemetry-m2-first-target-measurement.md). See the
[profile integration evidence](opentelemetry-m2-profile-integration.md) for acceptance, OIDs, squash
mapping and saved validation, and [remaining observations](opentelemetry-m2-profile-observations.md)
for instability and future Span work. Full T13B, GNOME pre-release checks, final-candidate validation
and T13C remain open; publish is blocked. Additional display samples are not an integration gate.
Completed profile implementation/review/display documents remain in Git history.

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
