# gitlode

> Extract Git commit history as JSON Lines — ready for warehouses, dashboards, and metrics pipelines.

**gitlode** is an ETL bridge between Git repositories and analytical systems. It reads a local Git
repository and emits one commit per line as [JSON Lines](https://jsonlines.org/) (`.jsonl`), so
downstream systems can ingest commit history without understanding Git internals.

gitlode is a faithful extractor: it maps Git object data as stored and leaves interpretation,
aggregation, and reporting to your downstream tools.

_Named after the mining term lode (a vein of valuable ore), with a nod to load — gitlode (not gitload)._

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

- Reads the local `.git` directory directly via [isomorphic-git](https://isomorphic-git.org/) — no `git` CLI required at runtime
- Outputs one record per line in JSON Lines format (commit-granularity by default)
- Two extraction modes: snapshot (full extraction each run) and `--incremental` (differential extraction using a state file)
- Handles multi-branch extraction with cross-branch deduplication
- General-purpose `--config` file for extraction/output/repository/runtime defaults
- Plugin system for extending output records via `extensions.<namespace>`

## Requirements

- Node.js ≥ 22.0.0
- A local Git repository (cloned and fetched via your preferred method — gitlode reads `.git` data directly and does not require the `git` CLI)

## Installation

```bash
npm install -g gitlode
```

## Quick Start

```bash
# One-time extraction from a local clone
gitlode -r main ./my-repo

# Continuous extraction — fetch remote changes, then extract new commits
git -C ./my-repo fetch origin
gitlode --incremental -r origin/main -s ./gitlode-state.json --missing-state snapshot ./my-repo
```

See the [User Guide](docs/usage.md) for detailed workflow patterns including incremental setup,
release-tag-based extraction, and CI configuration.

## CLI Reference

```bash
gitlode [options] <repository-path>
```

| Parameter                  | Alias | Type                | Required | Default | Description                                                                                                                                                                                                |
| -------------------------- | ----- | ------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<repository-path>`        |       | positional          | ✅       | —       | Local path to the Git repository                                                                                                                                                                           |
| `--incremental`            |       | boolean             |          | `false` | When set, reads state to extract only new commits. When absent, performs a full snapshot extraction.                                                                                                       |
| `--ref <ref>`              | `-r`  | string (repeatable) | ✅       | —       | Ref to traverse from. Accepts branch name, tag, or raw commit OID. Specify one or more times.                                                                                                              |
| `--output-dir <path>`      | `-o`  | string              |          | `./`    | Directory for output `.jsonl` files                                                                                                                                                                        |
| `--output-prefix <string>` |       | string              |          | derived | Filename prefix (derived from remote origin if omitted)                                                                                                                                                    |
| `--state <path>`           | `-s`  | string              |          | —       | State file path. Required with `--incremental`.                                                                                                                                                            |
| `--missing-state`          |       | `error \| snapshot` |          | `error` | Behavior when state file is absent. Only valid with `--incremental`.                                                                                                                                       |
| `--since-ref <ref>`        |       | string              |          | —       | Exclude commits reachable from this ref (tag, branch, or commit object ID). Snapshot mode only.                                                                                                            |
| `--since-date <ISO8601>`   |       | string              |          | —       | Include only commits after this datetime. Snapshot mode only.                                                                                                                                              |
| `--per-file`               |       | boolean             |          | `false` | When set, emits one record per changed file per commit; when absent, emits one record per commit (default).                                                                                                |
| `--max-diff-size <value>`  |       | string              |          | —       | Skip line-level diff computation for files above this size (`K`/`M`/`G` suffix supported). Outputs `null` additions/deletions for skipped diffs. Applies only with `--per-file`.                           |
| `--repo-name <string>`     |       | string              |          | —       | Override `repository.name` in all output records. Does not affect state-file identity or incremental behavior.                                                                                             |
| `--repo-url <string>`      |       | string              |          | —       | Override `repository.url` in all output records. Does not affect state-file identity or incremental behavior.                                                                                              |
| `--rotate-lines <n>`       |       | number              |          | —       | Start new file after `n` lines                                                                                                                                                                             |
| `--rotate-size <bytes>`    |       | string              |          | —       | Start new file after threshold (raw bytes or `K`/`M`/`G` suffix, case-insensitive; range `1M` to `64G`)                                                                                                    |
| `--quiet`                  | `-q`  | boolean             |          | `false` | Suppress progress, summary, and profile output on stderr. Warnings and errors remain visible.                                                                                                              |
| `--profile`                |       | boolean             |          | `false` | Print per-stage timing information to stderr after a successful extraction. Suppressed by `--quiet`.                                                                                                       |
| `--config <path>`          | `-c`  | string              |          | —       | Path to gitlode configuration file. Provides defaults for refs/range/output/repository/profile, and can declare plugin entries under `extensions`. See the [User Guide](docs/usage.md#configuration-file). |

Progress, summary, and profile output are written to **stderr**; use `--quiet` to suppress them.
Validation errors exit with code `1`; runtime errors with code `2`. See the
[User Guide](docs/usage.md#cli-reference) for the full list of mutual exclusion rules.

## Output

In the default commit-granularity mode, each line in the output `.jsonl` file is a JSON object representing one commit. With `--per-file`, each line represents one changed file within a commit, with full commit metadata denormalized onto each record plus a `file` object containing `path`, `status`, `additions`, and `deletions`.

Commit-mode record example:

```json
{
  "oid": "a1b2c3d4...",
  "subject": "Fix null pointer in auth module",
  "body": "",
  "author": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "timestamp": "2024-01-15T09:00:00+09:00"
  },
  "committer": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "timestamp": "2024-01-15T09:05:00+09:00"
  },
  "parents": ["parenthash1"],
  "repository": { "name": "my-repo", "url": "https://github.com/org/my-repo" }
}
```

| Field                                      | Description                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `oid`                                      | Full commit object ID (OID)                                                               |
| `subject`                                  | First line of the commit message                                                          |
| `body`                                     | Remainder of the commit message (empty string if none)                                    |
| `author`                                   | Person who originally authored the changes                                                |
| `committer`                                | Person who committed (may differ from author after rebase/cherry-pick)                    |
| `author.timestamp` / `committer.timestamp` | ISO 8601 datetime using the offset embedded in the commit object                          |
| `parents`                                  | Array of parent commit OIDs (empty for the initial commit; two entries for merge commits) |
| `repository.name`                          | Repository name derived from remote origin URL (falls back to directory name)             |
| `repository.url`                           | Remote origin URL, or `null` if no remote is configured                                   |

Current runtime support is limited to repositories using the `sha1` object format due to
`isomorphic-git` behavior in gitlode-used operations. Repositories with unsupported object
formats fail fast with:
`Unsupported repository object format: <format>. Supported formats: sha1.`

Output files are named `<prefix>-<timestamp>-000001.jsonl`, `<prefix>-<timestamp>-000002.jsonl`, and so on. The prefix is
derived from the repository's remote origin URL; use `--output-prefix` to override. The timestamp
segment (`YYYYMMDDTHHmmssZ`) is captured once per session, so all files from a single run share
the same timestamp and will not overwrite files produced by earlier runs. Use
`--rotate-lines` or `--rotate-size` to split output across multiple files.

> **Note:** Output line order is not guaranteed to be chronological. Sort by `committer.timestamp`
> in your downstream system.

## Documentation

- [User Guide](docs/usage.md) — detailed workflows, mode explanations, and full CLI reference
- [Architecture](docs/design/architecture.md) — layer responsibilities, end-to-end flow, and key design decisions
- [Git Traversal](docs/design/git-traversal.md) — DAG traversal, differential extraction modes, and deduplication strategy
- [Output Schema](docs/design/schema.md) — JSONL format, field definitions, timestamp conversion, and file rotation
- [Configuration File](docs/design/configuration.md) — config schema, precedence model, path resolution, and conflict rules
- [Plugin System](docs/design/plugins.md) — plugin contract, configuration file format, lifecycle, and official plugin package policy
- [Changelog](CHANGELOG.md) — release history and notable changes by version

## Project

`gitlode` is developed in the [gitlode monorepo](https://github.com/gitlode/gitlode), which hosts
the CLI together with its official plugins. For source code, the issue tracker, and contribution
guidelines, see the repository homepage.

## License

[MIT](LICENSE)

## Changelog

[Changelog](CHANGELOG.md)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
