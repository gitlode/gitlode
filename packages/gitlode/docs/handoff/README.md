# gitlode Handoff Documents

This directory contains continuation notes for unfinished work, future implementation sessions, and
investigations that may be resumed by human developers or coding agents.

Handoff documents are useful working context, but they are not durable source-of-truth design
documents.

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

## Current handoff notes

- [`instrumentation-opentelemetry-migration.md`](instrumentation-opentelemetry-migration.md):
  historical continuation context for the span-first instrumentation migration.
- [`profiling-and-walk-commits-next.md`](profiling-and-walk-commits-next.md): walkCommits
  profiling and bidirectional traversal prototype sequencing.
- [`walk-commits-timestamp-frontier.md`](walk-commits-timestamp-frontier.md): current notes for
  timestamp-priority frontier design in a future bidirectional traversal prototype.
