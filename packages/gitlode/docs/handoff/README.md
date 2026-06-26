# gitlode Handoff Documents

This directory contains continuation notes for unfinished work, future implementation sessions, and
investigations that may be resumed by human developers or coding agents.

Handoff documents are useful working context, but they are not durable source-of-truth design
documents.

## Current handoff documents

- [`instrumentation-opentelemetry-migration.md`](instrumentation-opentelemetry-migration.md):
  planning notes for moving profiling and instrumentation toward a span-oriented design aligned with
  OpenTelemetry concepts.
- [`profiling-and-walk-commits-next.md`](profiling-and-walk-commits-next.md): continuation context
  for future `walkCommits` strategy and profiling work.

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

After migration, remove or shorten obsolete handoff details so future readers do not confuse
planning context with current design.
