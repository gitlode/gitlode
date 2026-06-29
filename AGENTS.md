# gitlode Agent Instructions

This file is the shared entrypoint for coding agents working in this repository.

The repository is a monorepo, but `packages/gitlode` is the primary package. Other packages are
lightweight plugins or supporting packages. Prefer the `packages/gitlode` documentation as the source
for durable product and implementation guidance unless a plugin-specific task clearly says otherwise.

## Documentation audiences

gitlode documentation is organized for three audiences:

- **End users**: people running gitlode. Start with `packages/gitlode/docs/usage.md`.
- **Developers**: people maintaining gitlode. Start with `packages/gitlode/docs/README.md` and
  `packages/gitlode/docs/design/`.
- **Coding agents**: currently Codex and GitHub Copilot. Start here, then follow the same
  durable docs as human developers.

Agent-specific instruction files may provide routing and guardrails, but they must not become
independent sources of truth for design contracts.

## Source of truth

Use these documentation homes when changing behavior:

- User-facing workflows and visible behavior: `packages/gitlode/docs/usage.md`
- Durable implementation design contracts: `packages/gitlode/docs/design/`
- Profiling output interpretation: `packages/gitlode/docs/profiling.md`
- Temporary continuation notes: `packages/gitlode/docs/handoff/`

Avoid duplicating normative facts such as CLI validation rules, output schema fields, architecture
boundaries, traversal correctness rules, and plugin contracts. Short audience-oriented summaries are
allowed when they link back to the canonical document.

## Task-specific reading order

### CLI or configuration changes

Read:

1. `packages/gitlode/docs/design/cli.md`
2. `packages/gitlode/docs/usage.md` when user-facing workflows, examples, or help text are affected
3. `packages/gitlode/docs/design/configuration.md` when config shape, path resolution, or precedence
   is affected

### Architecture or module-boundary changes

Read:

1. `packages/gitlode/docs/design/architecture.md`
2. `.github/instructions/architecture.instructions.md` until its remaining normative details are
   migrated into `packages/gitlode/docs/design/architecture.md`

### Git traversal or incremental extraction changes

Read:

1. `packages/gitlode/docs/design/git-traversal.md`
2. `packages/gitlode/docs/design/walk-commits-strategies.md` for internal `walkCommits` strategy work
3. `.github/instructions/git-traversal.instructions.md` until its remaining normative details are
   migrated into `packages/gitlode/docs/design/git-traversal.md`

### Output schema or file-format changes

Read:

1. `packages/gitlode/docs/design/schema.md`
2. `packages/gitlode/docs/usage.md` for user-facing examples and behavior
3. `.github/instructions/schema.instructions.md` until its remaining normative details are migrated
   into `packages/gitlode/docs/design/schema.md`

### Plugin changes

Read:

1. `packages/gitlode/docs/design/plugins.md`
2. `packages/gitlode/docs/design/configuration.md` when plugin configuration is affected
3. `packages/gitlode/docs/usage.md` when user-facing plugin behavior changes

### Profiling or diagnostics changes

Read:

1. `packages/gitlode/docs/profiling.md`
2. `packages/gitlode/docs/design/architecture.md` when instrumentation boundaries are affected
3. Relevant notes in `packages/gitlode/docs/handoff/` only when continuing unfinished work

## Guardrails

- Keep durable design contracts in `packages/gitlode/docs/design/`, not in agent-specific entrypoints.
- Keep end-user workflows and user-visible behavior in `packages/gitlode/docs/usage.md`.
- Keep handoff documents focused on continuation context; migrate stable decisions into durable docs.
- Update documentation for every affected audience when changing behavior.
- Code comments must be written in English.
- Run `npm run format:write` before finishing implementation work, then verify with
  `npm run format:check`.
