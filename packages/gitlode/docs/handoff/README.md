# gitlode Handoff Documents

This directory contains continuation notes for unfinished work, future implementation sessions, and
investigations that may be resumed by human developers or coding agents.

Handoff documents are useful working context, but they are not durable source-of-truth design
documents.

## Active OpenTelemetry work

PR preparation remains blocked by Windows default source-test failures. GC-strategy correction is
independently accepted. Trunk assigned a Windows two-worker default and separate timeout ownership
correction, followed by plain Windows npm test and independent review.
The shared sidecar's optional invocation-local ownership seam is authorized after scope review;
implementation `b98bbe5` reports successful supported-policy Windows tests and fixed-SHA CI.
Independent review `4ecc79f` requires P1 descendant-quiescence correction and P2 durable Volta
setup instructions. Resource policy is accepted; ownership and Windows PR-readiness remain blocked.
P2 at `05134d0` is independently accepted in `56f1983`. Job Object feasibility is supported within
the tested boundary. Stage A `4947470` did not establish five-second suitability. The human approved
explicit finite per-test budgets for process/OS integration cases, retaining the general default and
safety assertions. Stage B standalone transport resumes under that policy, then independent review
before helper integration; Stage A is not retroactively accepted.
Stage B `9bb3713` / outcome `6e05147` has one pass/seven first-run failures. It is incomplete,
not acceptance-review ready. Next is bounded diagnosis of encoding, orphan setup and enforced
deadline/cleanup accounting; no complete matrix rerun or deadline extension is assigned.
Diagnosis `ee1dc83` confirms encoding/accounting defects and establishes the detached orphan setup.
The active packet now assigns their minimal correction with clipped enclosing deadlines and ordered,
stop-on-first-unexplained-failure validation. Standalone acceptance and helper integration remain pending.
Correction `f45062d`, outcome `ef6d171`, reports finite checks and all nine process entries passed.
The [independent complete-launcher review](opentelemetry-m2-stage-b-independent-review.md) returned
corrections required for error/deadline/settlement paths; normal-user transport and inherited-handle
runtime gates remain open. Return to trunk for bounded correction disposition; no new campaign or
helper integration is assigned by the review.
Current assignment:
[fixture CI correction](opentelemetry-m2-fixture-ci-correction.md). Prior integration tuples are
historical until corrected-source full tests, CI and focused review pass.

Current packet: [fixture integration evidence and human source/base review](opentelemetry-m2-fixture-integration.md).
Fixture corrections and the external-review adoption contract are accepted and canonical docs updated; actual qualification,
adoption and comparison authorization remain pending and require separate reviewed packets.
The human approved foreground maintenance and bounded fixed-quantity requalification. F2 runtime
preservation is accepted; timing awaits human integration, a new preserved harness and reviewed inputs.
The disabled SDK boundary is squash-integrated into M2 at `4ea24d5` by PR #116; its
[integration evidence](opentelemetry-m2-disabled-sdk-integration.md) retains acceptance attribution.
D1 `04dc187` and D2 `6e84279` are independently accepted; performance acceptance remains open.
Trunk accepted the design with the human-approved invalid no-op root identity. D1 covers source
session/lifecycle changes; D2 covers emitted/installed boundary verification.
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
