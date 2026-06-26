# gitlode Documentation

This directory is the documentation home for the `gitlode` package.

The repository is a monorepo, but `packages/gitlode` is the primary package. Other packages are
lightweight plugins or supporting packages, so most durable product and design documentation belongs
here.

## Documentation audiences

gitlode documentation is organized for three primary audiences.

| Audience      | Needs                                                                                         | Start here                                                                          |
| ------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| End users     | Run gitlode, configure extraction, understand output, and troubleshoot user-visible behavior. | [`usage.md`](usage.md)                                                              |
| Developers    | Understand implementation design, behavior contracts, trade-offs, and maintenance policy.     | [`design/`](design/)                                                                |
| Coding agents | Find task-specific canonical docs and avoid duplicating or drifting design rules.             | Repository-level `AGENTS.md` when present, then this index and [`design/`](design/) |

These audiences overlap. For example, plugin authors and advanced users may need both the user guide
and design documentation. Coding agents should use the same durable design docs as human developers,
with agent-specific entrypoints only providing routing and guardrails.

## Source-of-truth policy

Avoid duplicating normative facts such as CLI validation rules, output schema fields, architecture
boundaries, traversal correctness rules, and plugin contracts. Each durable contract should have one
canonical documentation home.

Audience-oriented summaries are allowed when they improve readability, but summaries should link
back to the canonical document instead of becoming independent specifications.

| Information type                                              | Canonical location                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| End-user workflows and user-visible behavior                  | [`usage.md`](usage.md)                                                   |
| Architecture, module ownership, and implementation boundaries | [`design/architecture.md`](design/architecture.md)                       |
| Configuration file contract and precedence                    | [`design/configuration.md`](design/configuration.md)                     |
| Git traversal behavior and differential extraction            | [`design/git-traversal.md`](design/git-traversal.md)                     |
| Internal `walkCommits` strategy design                        | [`design/walk-commits-strategies.md`](design/walk-commits-strategies.md) |
| Output schema and JSON Lines file format                      | [`design/schema.md`](design/schema.md)                                   |
| Plugin runtime contract and package policy                    | [`design/plugins.md`](design/plugins.md)                                 |
| Profiling output interpretation                               | [`profiling.md`](profiling.md)                                           |
| Continuation context for unfinished work                      | [`handoff/`](handoff/)                                                   |

## Documentation map

- [`usage.md`](usage.md): end-user guide for extraction modes, workflows, CLI options, file-level
  output, configuration, and plugin usage.
- [`profiling.md`](profiling.md): guide to the developer-oriented `--profile` diagnostics output.
- [`design/`](design/): durable implementation design documents for human developers and coding
  agents.
- [`handoff/`](handoff/): continuation notes for in-progress or future work. Handoff documents are
  not durable source-of-truth design documents.

## Updating documentation

When changing behavior, update the documentation for every affected audience:

- User-visible behavior changes should update [`usage.md`](usage.md) and, when relevant,
  [`profiling.md`](profiling.md).
- Implementation contract changes should update the appropriate document in [`design/`](design/).
- Temporary planning or continuation notes should live in [`handoff/`](handoff/) until stable
  decisions are migrated into durable docs.
- Agent-specific entrypoints, such as GitHub Copilot instruction files, should route to these docs
  instead of owning separate design contracts.
