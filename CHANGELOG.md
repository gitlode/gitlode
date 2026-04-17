# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-17

### Added

- `--mode snapshot|incremental` flag to select extraction mode explicitly (`-m` alias)
- `--on-missing-state error|snapshot` flag to control behavior when the state file is absent in incremental mode
- Shorthand aliases for all major flags: `-m` (--mode), `-b` (--branch), `-o` (--output-dir), `-s` (--state), `-q` (--quiet)
- Cross-run deduplication for newly added branches in incremental mode: when a branch appears for the first time, gitrail computes the merge base with already-extracted branches and uses it as the commit boundary, preventing duplicate output
- Output filenames now include a session timestamp segment (`{prefix}-{timestamp}-{seq}.jsonl`), preventing files from different runs from overwriting each other

### Changed

- **Breaking:** `--since-commit` is renamed to `--since-ref`. The new flag accepts a tag name, branch name, or full commit hash (any ref resolvable via `git rev-parse`). Passing `--since-commit` now exits with an unknown-argument error.
- **Breaking:** The presence of `--state` alone no longer implies incremental mode. Extraction mode must be specified explicitly with `--mode incremental`. Running without `--mode` defaults to `snapshot`, which ignores existing state content and overwrites the state file on success.
- Output filename format changed from `{prefix}-{seq}.jsonl` to `{prefix}-{timestamp}-{seq}.jsonl`. Files written by older versions of gitrail will not be overwritten, but the new filename pattern should be reflected in any downstream ingestion configuration.

### Migration

#### `--since-commit` → `--since-ref`

Replace all occurrences of `--since-commit` with `--since-ref`. The argument semantics are a strict superset: any commit hash that was valid for `--since-commit` is also valid for `--since-ref`.

Before:

```bash
gitrail -b main --since-commit abc123def456 ./my-repo
```

After:

```bash
gitrail -b main --since-ref abc123def456 ./my-repo
# or use a tag or branch name directly
gitrail -b main --since-ref v1.0 ./my-repo
```

#### Explicit `--mode` required for incremental extraction

If you were relying on `--state` to implicitly enable incremental mode, add `--mode incremental` to your command:

Before:

```bash
gitrail -b main -s ./gitrail-state.json ./my-repo
```

After:

```bash
gitrail -m incremental -b main -s ./gitrail-state.json ./my-repo
```

If your intent was to record state without differential extraction (snapshot with state recording), the old command behavior is now the explicit default — no change needed other than confirming you do not pass `--mode incremental`.

---

## [0.1.4] - 2026-04-14

### Added

- Lightweight runtime progress reporting and a completion summary on stderr
- `--quiet` mode for CI, cron, and other scripted runs

### Fixed

- CLI help output now shows the supported arguments and descriptions correctly

### Changed

- Switched the project linter from ESLint to oxlint as part of repository maintenance
- Release messaging and packaging flow were validated through this small documentation-focused release

## [0.1.0] - 2026-04-10

### Added

- Initial release
- Extract Git commit history to JSON Lines (JSONL) format
- Support for multi-branch extraction with cross-branch deduplication
- Incremental (differential) extraction via `--state` file
- Differential extraction via `--since-commit` or `--since-date`
- Output file rotation by line count (`--rotate-lines`) or byte size (`--rotate-size`)
- Automatic `--output-prefix` derivation from remote origin URL
- Timestamp output in ISO 8601 format with commit's own timezone offset
- No system-installed Git required (uses isomorphic-git)

[0.2.0]: https://github.com/tomo-waka/gitrail/releases/tag/v0.2.0
[0.1.4]: https://github.com/tomo-waka/gitrail/releases/tag/v0.1.4
[0.1.0]: https://github.com/tomo-waka/gitrail/releases/tag/v0.1.0
