# gitrail

A CLI tool that extracts Git repository commit history and outputs it as [JSON Lines](https://jsonlines.org/) (`.jsonl`) files, suitable for ingestion into data warehouses and analytical systems.

## Features

- Reads Git repository data via [isomorphic-git](https://isomorphic-git.org/) — no system-installed Git required
- Outputs one commit per line in JSON Lines format
- Supports incremental (differential) extraction via a state file
- Handles multi-branch extraction with cross-branch deduplication

## Requirements

- Node.js ≥ 22.0.0
- No system-installed Git required (uses isomorphic-git)

## Installation

```bash
npm install -g gitrail
```

## Quick Start

```bash
# 1. Full extraction — creates gitrail-000001.jsonl in the current directory
gitrail --branch main ./my-repo

# 2. Subsequent incremental run — only commits added since the last run are written
gitrail --branch main --state ./gitrail-state.json ./my-repo

# On the first run above the state file is created automatically.
# On subsequent runs only new commits are extracted.
```

## CLI Reference

```bash
gitrail [options] <repository-path>
```

| Parameter                  | Type       | Required | Default                    | Description                                                    |
| -------------------------- | ---------- | -------- | -------------------------- | -------------------------------------------------------------- |
| `<repository-path>`        | positional | ✅       | —                          | Local path to the Git repository                               |
| `--branch <ref>`           | string     | ✅       | —                          | Ref to start traversal from. Repeatable for multiple branches. |
| `--output-dir <path>`      | string     |          | `./`                       | Directory for output `.jsonl` files                            |
| `--output-prefix <string>` | string     |          | derived from remote origin | Filename prefix for output files                               |
| `--state <path>`           | string     |          | —                          | State file for incremental extraction                          |
| `--since-commit <hash>`    | string     |          | —                          | Extract commits newer than this hash (exclusive)               |
| `--since-date <ISO8601>`   | string     |          | —                          | Extract commits after this datetime                            |
| `--rotate-lines <n>`       | number     |          | —                          | Start new file after `n` lines                                 |
| `--rotate-size <bytes>`    | number     |          | —                          | Start new file after `n` bytes                                 |
| `--quiet`                  | boolean    |          | `false`                    | Suppress progress and summary output for automation            |

### Help and runtime output

- Run `gitrail --help` to display the full supported option list and descriptions.
- During extraction, progress updates and the final completion summary are written to **stderr**.
- Use `--quiet` for CI, cron, and scripted runs when you want to suppress non-error status output.
- Validation and runtime errors are also written to **stderr** and use the exit codes listed below.

### Mutual exclusion rules

The following combinations are invalid and produce exit code 1:

- `--since-commit` and `--since-date` cannot be used together
- `--state` and `--since-commit` cannot be used together
- `--state` and `--since-date` cannot be used together

### Exit codes

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| `0`  | Success                                                    |
| `1`  | User error (invalid arguments, repository not found, etc.) |
| `2`  | Runtime error (I/O failure, unexpected Git error, etc.)    |

## Output Format

Each line is a JSON object representing one commit:

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

## Incremental Extraction

Use `--state` for efficient incremental runs against the same repository:

```bash
# First run: full extraction — all commits are written, state file is created
gitrail --branch main --state ./gitrail-state.json ./my-repo

# Subsequent runs: only commits added since the last run are written
gitrail --branch main --state ./gitrail-state.json ./my-repo
```

The state file records the last extracted commit hash per branch. On subsequent runs, only commits
reachable from the branch tip that are **not** reachable from the recorded commit are extracted.

If the state file is deleted, the next run falls back to full extraction automatically.

## Output File Naming

Output files are named `<prefix>-000001.jsonl`, `<prefix>-000002.jsonl`, and so on.

**Prefix derivation** (when `--output-prefix` is not specified):

1. Read the remote origin URL of the repository
2. Take the last path segment and strip the `.git` suffix (e.g. `https://github.com/org/my-repo.git` → `my-repo`)
3. If no remote origin is configured, fall back to the repository directory name

Use `--output-prefix` to override this logic entirely.

**File rotation** is triggered when either threshold is reached:

- `--rotate-lines <n>` — start a new file after writing `n` lines
- `--rotate-size <bytes>` — start a new file after the file exceeds `n` bytes

Both thresholds can be combined; rotation occurs as soon as either is exceeded.

## Usage Examples

```bash
# Full extraction of the main branch
gitrail --branch main ./my-repo

# Multiple branches, custom output directory
gitrail --branch main --branch develop --output-dir ./output ./my-repo

# Incremental extraction using a state file
gitrail --branch main --state ./gitrail-state.json ./my-repo

# Differential extraction from a specific commit
gitrail --branch main --since-commit abc123def456 ./my-repo

# With file rotation (new file every 10,000 lines or 100 MB)
gitrail --branch main --rotate-lines 10000 --rotate-size 104857600 ./my-repo

# Quiet mode for automation
gitrail --branch main --state ./gitrail-state.json --quiet ./my-repo
```

## Project Information

- [Changelog](CHANGELOG.md) — release history and notable changes by version

## Developer Guide

Developer-oriented references:

- [Contributing Guide](CONTRIBUTING.md) — local setup, quality checks, and pull request workflow
- [Architecture](docs/design/architecture.md) — layer responsibilities, end-to-end flow, and key design decisions
- [Git Traversal](docs/design/git-traversal.md) — DAG traversal, differential extraction modes, and deduplication strategy
- [Output Schema](docs/design/schema.md) — JSONL format, field definitions, timestamp conversion, and file rotation

## License

MIT
