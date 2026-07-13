# gitlode Documentation

This directory is the documentation home for the `gitlode` package.

The repository is a monorepo, but `packages/gitlode` is the primary package. Other packages are
lightweight plugins or supporting packages, so most durable product and design documentation belongs
here.

## Documentation audiences

gitlode documentation is organized for three primary audiences.

| Audience      | Needs                                                                                         | Start here                                                                       |
| ------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| End users     | Run gitlode, configure extraction, understand output, and troubleshoot user-visible behavior. | [`usage.md`](usage.md)                                                           |
| Developers    | Understand implementation design, behavior contracts, trade-offs, and maintenance policy.     | [`design/`](design/)                                                             |
| Coding agents | Find task-specific canonical docs, agent-facing working principles, and routing guardrails.   | Repository-level `AGENTS.md`, then [`agents/`](agents/) and [`design/`](design/) |

These audiences overlap. For example, plugin authors and advanced users may need both the user guide
and design documentation. Coding agents should use the same durable design docs as human developers,
with agent-specific entrypoints only providing routing and guardrails.

## Source-of-truth policy

Avoid duplicating normative facts such as CLI validation rules, output schema fields, architecture
boundaries, traversal correctness rules, and plugin contracts. Each durable contract should have one
canonical documentation home.

Audience-oriented summaries are allowed when they improve readability, but summaries should link
back to the canonical document instead of becoming independent specifications.

| Information type                         | Canonical location               |
| ---------------------------------------- | -------------------------------- |
| End-user workflows and visible behavior  | [`usage.md`](usage.md)           |
| Durable implementation design contracts  | [`design/`](design/)             |
| Contributor and repository policies      | [`contributing/`](contributing/) |
| Profiling output interpretation          | [`profiling.md`](profiling.md)   |
| Durable agent collaboration guidance     | [`agents/`](agents/)             |
| Continuation context for unfinished work | [`handoff/`](handoff/)           |

## Documentation map

- [`usage.md`](usage.md): end-user guide for extraction modes, workflows, CLI options, file-level
  output, configuration, and plugin usage.
- [`profiling.md`](profiling.md): guide to the developer-oriented `--profile` diagnostics output.
- [`design/`](design/): durable implementation design documents for human developers and coding
  agents.
- [`contributing/`](contributing/): contributor-facing repository maintenance policies, such as
  lint rule adoption.
- [`agents/`](agents/): durable collaboration and working-principle documents for coding agents.
- [`handoff/`](handoff/): continuation notes for in-progress or future work. Handoff documents are
  not durable source-of-truth design documents.

## Updating documentation

When changing behavior, update the documentation for every affected audience:

- User-visible behavior changes should update [`usage.md`](usage.md) and, when relevant,
  [`profiling.md`](profiling.md).
- Implementation contract changes should update the appropriate document in [`design/`](design/).
- Contributor policy changes should update the appropriate document in [`contributing/`](contributing/).
- Durable changes to agent collaboration practices should update the appropriate document in
  [`agents/`](agents/).
- Temporary planning or continuation notes should live in [`handoff/`](handoff/) until stable
  decisions are migrated into durable docs.
- Agent-specific entrypoints, such as GitHub Copilot instruction files, should route to these docs
  instead of owning separate design contracts.
