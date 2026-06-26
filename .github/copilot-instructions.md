# gitlode — Copilot Instructions

This file is the GitHub Copilot-specific entrypoint for this repository.

Read the shared coding-agent entrypoint first:

- [`../AGENTS.md`](../AGENTS.md)

Use the durable gitlode documentation as the source of truth for product behavior and implementation
design:

- [`../packages/gitlode/docs/README.md`](../packages/gitlode/docs/README.md)
- [`../packages/gitlode/docs/usage.md`](../packages/gitlode/docs/usage.md)
- [`../packages/gitlode/docs/design/`](../packages/gitlode/docs/design/)
- [`../packages/gitlode/docs/profiling.md`](../packages/gitlode/docs/profiling.md)
- [`../packages/gitlode/docs/handoff/`](../packages/gitlode/docs/handoff/)

## Copilot-specific routing

GitHub Copilot may also load files from [`.github/instructions/`](instructions/) based on their
`applyTo` metadata. Treat those files as Copilot routing aids and transitional guardrails, not as
independent design sources.

When an instruction file and the durable docs differ, prefer the durable docs unless the instruction
file explicitly states that a migration is still pending for that exact rule. If the correct source is
unclear, stop and ask for clarification instead of creating another copy of the rule.

## Documentation policy

Do not add new durable product, architecture, CLI, schema, traversal, plugin, or profiling contracts
to this file. Add or update the appropriate document under `packages/gitlode/docs/`, then keep this
file as a thin entrypoint.
