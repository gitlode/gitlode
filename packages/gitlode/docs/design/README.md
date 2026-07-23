# gitlode Design Documentation

This directory contains durable design documentation for the `gitlode` package.

The primary audiences are human developers and coding agents. These documents should explain both
what the current implementation contract is and why the design is shaped that way. End-user-facing
summaries belong in [`../usage.md`](../usage.md), with links back to these design docs when deeper
behavioral detail is useful.

## Canonical design documents

| Area                       | Document                                                         | Owns                                                                                              |
| -------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Architecture               | [`architecture.md`](architecture.md)                             | Layering, module ownership, dependency boundaries, runtime flow, and major trade-offs.            |
| CLI                        | [`cli.md`](cli.md)                                               | Command shape, options, validation, stderr behavior, exit codes, and CLI implementation notes.    |
| Configuration              | [`configuration.md`](configuration.md)                           | Versioned configuration shape, path resolution, precedence, and validation pipeline.              |
| Git adapters               | [`git-adapters.md`](git-adapters.md)                             | Git adapter selection, blob-fact boundaries, `git-cli` protocols, lifecycle, and benchmarking.    |
| Git traversal              | [`git-traversal.md`](git-traversal.md)                           | User-visible traversal behavior, differential extraction, state lifecycle, and deduplication.     |
| Plugins                    | [`plugins.md`](plugins.md)                                       | Plugin configuration, runtime contract, `extensions` output field, lifecycle, and package policy. |
| Output schema              | [`schema.md`](schema.md)                                         | JSON Lines format, record fields, file rotation, and file-level output schema.                    |
| Commit traversal internals | [`commit-traversal-internals.md`](commit-traversal-internals.md) | Internal traversal strategies, certificates, fallback behavior, and strategy tests.               |

## Audience policy

Design docs may include more explanation than agent-specific instruction files. They should preserve
rationale, trade-offs, non-goals, and links to related behavior so human developers can review and
maintain changes safely.

Coding agents should treat these documents as the durable design source. Agent-specific entrypoints
may summarize key guardrails for readability, but they should not become independent specifications.

## Relationship to user documentation

Use [`../usage.md`](../usage.md) for end-user workflows, examples, and user-facing CLI behavior. Use
this directory for implementation contracts and design rationale. When a change affects both code
ownership and user-visible behavior, update both the relevant design document and the user guide.

## Relationship to handoff documents

Use [`../handoff/`](../handoff/) for continuation notes, experiments, and future-work context. When a
handoff item becomes an implemented or accepted design decision, migrate the stable decision into the
appropriate document in this directory and remove obsolete planning detail from the handoff note.
