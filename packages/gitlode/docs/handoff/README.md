# gitlode Handoff Documents

## Current OpenTelemetry task (2026-10-22)

Start with [v0.13.0 convergence](opentelemetry-v013-convergence.md). It supersedes all earlier
OpenTelemetry continuation instructions, matrix campaigns and Windows launcher assignments.
The [current acceptance policy](../design/telemetry-v013-acceptance.md) preserves product features and
uses proportionate three-way timing/output confirmation with human acceptance.

Retired migration plans, experiments and launcher assignments have been removed. Historical failures
are not relabelled as success; the convergence record retains the limited conclusions relevant to
acceptance. Do not restore old campaigns as release prerequisites.

The Git CLI adapter plan and deferred test-code typechecking note are separate workstreams.

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
