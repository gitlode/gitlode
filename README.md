# gitlode

> Extract Git commit history as JSON Lines — ready for warehouses, dashboards, and metrics pipelines.

**gitlode** is an ETL bridge between Git repositories and analytical systems. It reads a local Git
repository and emits one commit per line as [JSON Lines](https://jsonlines.org/) (`.jsonl`), so
downstream systems can ingest commit history without understanding Git internals.

gitlode is a faithful extractor: it maps Git object data as stored and leaves interpretation,
aggregation, and reporting to your downstream tools. If you already have an analytical system and
want commit history in it, gitlode brings the data over.

This repository is the gitlode monorepo. The flagship CLI is published as the
[`gitlode`](https://www.npmjs.com/package/gitlode) package on npm. Official plugins will live
alongside it under [`packages/`](packages/) as the ecosystem grows.

## Use cases

- **Continuous ingestion into a warehouse** — periodically fetch your repository and load only new
  commits into BigQuery, Snowflake, Redshift, DuckDB, or similar via incremental mode.
- **Developer activity dashboards** — measure commit frequency, contributor growth, and team
  velocity over time.
- **Release and change-velocity metrics** — track commit cadence, time-between-releases, and
  change volume per area of the codebase.
- **Cross-repository aggregation** — run gitlode across many repositories and stack the JSONL
  output into a single unified dataset.
- **Ad-hoc analysis with DuckDB or pandas** — extract once and query the `.jsonl` directly with
  `duckdb.read_json()` or `pandas.read_json(..., lines=True)`.

> gitlode is **not** for interactive history inspection — questions like "who changed this line?"
> or "what commits touched this file?" are better answered by a Git client or IDE. gitlode targets
> bulk extraction into analytical systems.

## Features

- Reads `.git` directly via [isomorphic-git](https://isomorphic-git.org/) — no `git` CLI required
  at runtime
- One record per line in JSON Lines (commit-granularity by default, optional per-file granularity)
- Snapshot and incremental extraction modes with atomic state-file checkpoints
- Multi-ref extraction with cross-branch deduplication within a run

## Quick start

```bash
# Install the CLI globally
npm install -g gitlode

# One-time snapshot extraction
gitlode -r main ./my-repo

# Continuous extraction — fetch first, then extract only new commits
git -C ./my-repo fetch origin
gitlode --incremental -r origin/main -s ./gitlode-state.json --missing-state snapshot ./my-repo
```

For the full CLI reference, output schema, and workflow patterns, see the
[`gitlode` package README](packages/gitlode/README.md) and the
[User Guide](packages/gitlode/docs/usage.md).

## Packages

This monorepo hosts the gitlode CLI and its official plugins.

| Package                        | npm                                                | Description                                |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------ |
| [`gitlode`](packages/gitlode/) | [`gitlode`](https://www.npmjs.com/package/gitlode) | The gitlode CLI — commit history extractor |

Additional official plugins will appear here as the plugin ecosystem grows, published under the
`@gitlode/*` scope.

## Documentation

- [User Guide](packages/gitlode/docs/usage.md) — detailed workflows, mode explanations, and full
  CLI reference
- [Architecture](packages/gitlode/docs/design/architecture.md) — layer responsibilities,
  end-to-end flow, and key design decisions
- [Git Traversal](packages/gitlode/docs/design/git-traversal.md) — DAG traversal, differential
  extraction modes, and deduplication strategy
- [Output Schema](packages/gitlode/docs/design/schema.md) — JSONL format, field definitions,
  timestamp conversion, and file rotation
- [Changelog](packages/gitlode/CHANGELOG.md) — release history of the `gitlode` package

## Repository structure

```
.
├── packages/
│   └── gitlode/        # gitlode CLI (published to npm as `gitlode`)
├── CONTRIBUTING.md     # Contribution guide for the whole repository
├── LICENSE
└── README.md           # You are here
```

Future official plugins will live as additional packages under `packages/` (published as
`@gitlode/*`).

## Development

This repository is an npm workspaces monorepo. From the repository root:

```bash
npm install            # install dependencies for all packages
npm run build          # build all packages
npm test               # run tests for all packages
npm run lint           # lint all packages
npm run format:check   # verify formatting (what CI runs)
npm run format:write   # apply formatting
```

To target a specific package, use the workspace flag — for example
`npm run build -w packages/gitlode`.

Requires Node.js ≥ 22.0.0.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow, branch policy, and code
style rules.

## License

[MIT](LICENSE)
