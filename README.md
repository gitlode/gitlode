# gitrail

A CLI tool that extracts commit history from a local Git repository and outputs it as [JSON Lines](https://jsonlines.org/) (`.jsonl`) files, suitable for ingestion into data warehouses and analytical systems.

## Features

- Reads the local `.git` directory directly via [isomorphic-git](https://isomorphic-git.org/) — no `git` CLI required at runtime
- Outputs one record per line in JSON Lines format (commit-granularity by default)
- Two extraction modes: snapshot (full extraction each run) and `--incremental` (differential extraction using a state file)
- Handles multi-branch extraction with cross-branch deduplication

## Requirements

- Node.js ≥ 22.0.0
- A local Git repository (cloned and fetched via your preferred method — gitrail reads `.git` data directly and does not require the `git` CLI)

## Installation

```bash
npm install -g gitrail
```

## Quick Start

```bash
# One-time extraction from a local clone
gitrail -b main ./my-repo

# Continuous extraction — fetch remote changes, then extract new commits
git -C ./my-repo fetch origin
gitrail --incremental -b origin/main -s ./gitrail-state.json --missing-state snapshot ./my-repo
```

See the [User Guide](docs/usage.md) for detailed workflow patterns including incremental setup,
release-tag-based extraction, and CI configuration.

## CLI Reference

```bash
gitrail [options] <repository-path>
```

| Parameter                  | Alias | Type                | Required | Default | Description                                                                                                 |
| -------------------------- | ----- | ------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `<repository-path>`        |       | positional          | ✅       | —       | Local path to the Git repository                                                                            |
| `--incremental`            |       | boolean             |          | `false` | When set, reads state to extract only new commits. When absent, performs a full snapshot extraction.        |
| `--branch <ref>`           | `-b`  | string (repeatable) | ✅       | —       | Ref to traverse from. Specify one or more times.                                                            |
| `--output-dir <path>`      | `-o`  | string              |          | `./`    | Directory for output `.jsonl` files                                                                         |
| `--output-prefix <string>` |       | string              |          | derived | Filename prefix (derived from remote origin if omitted)                                                     |
| `--state <path>`           | `-s`  | string              |          | —       | State file path. Required with `--incremental`.                                                             |
| `--missing-state`          |       | `error \| snapshot` |          | `error` | Behavior when state file is absent. Only valid with `--incremental`.                                        |
| `--since-ref <ref>`        |       | string              |          | —       | Exclude commits reachable from this ref (tag, branch, or hash). Snapshot mode only.                         |
| `--since-date <ISO8601>`   |       | string              |          | —       | Include only commits after this datetime. Snapshot mode only.                                               |
| `--per-file`               |       | boolean             |          | `false` | When set, emits one record per changed file per commit; when absent, emits one record per commit (default). |
| `--rotate-lines <n>`       |       | number              |          | —       | Start new file after `n` lines                                                                              |
| `--rotate-size <bytes>`    |       | number              |          | —       | Start new file after `n` bytes                                                                              |
| `--quiet`                  | `-q`  | boolean             |          | `false` | Suppress progress, summary, and profile output on stderr. Warnings and errors remain visible.               |
| `--profile`                |       | boolean             |          | `false` | Print per-stage timing information to stderr after a successful extraction. Suppressed by `--quiet`.        |

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

| Field                                      | Description                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `oid`                                      | Full SHA-1 commit hash                                                                      |
| `subject`                                  | First line of the commit message                                                            |
| `body`                                     | Remainder of the commit message (empty string if none)                                      |
| `author`                                   | Person who originally authored the changes                                                  |
| `committer`                                | Person who committed (may differ from author after rebase/cherry-pick)                      |
| `author.timestamp` / `committer.timestamp` | ISO 8601 datetime using the offset embedded in the commit object                            |
| `parents`                                  | Array of parent commit hashes (empty for the initial commit; two entries for merge commits) |
| `repository.name`                          | Repository name derived from remote origin URL (falls back to directory name)               |
| `repository.url`                           | Remote origin URL, or `null` if no remote is configured                                     |

Output files are named `<prefix>-<timestamp>-000001.jsonl`, `<prefix>-<timestamp>-000002.jsonl`, and so on. The prefix is
derived from the repository's remote origin URL; use `--output-prefix` to override. The timestamp
segment (`YYYYMMDDTHHmmssZ`) is captured once per session, so all files from a single run share
the same timestamp and will not overwrite files produced by earlier runs. Use
`--rotate-lines` or `--rotate-size` to split output across multiple files.

> **Note:** Output line order is not guaranteed to be chronological. Sort by `committer.timestamp`
> in your downstream system.

## Documentation

- [User Guide](docs/usage.md) — detailed workflows, mode explanations, and full CLI reference
- [Changelog](CHANGELOG.md) — release history and notable changes by version

## Developer Guide

- [Contributing Guide](CONTRIBUTING.md) — local setup, quality checks, and pull request workflow
- [Architecture](docs/design/architecture.md) — layer responsibilities, end-to-end flow, and key design decisions
- [Git Traversal](docs/design/git-traversal.md) — DAG traversal, differential extraction modes, and deduplication strategy
- [Output Schema](docs/design/schema.md) — JSONL format, field definitions, timestamp conversion, and file rotation

## License

MIT
