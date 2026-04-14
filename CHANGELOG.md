# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.4]: https://github.com/tomo-waka/gitrail/releases/tag/v0.1.4
[0.1.0]: https://github.com/tomo-waka/gitrail/releases/tag/v0.1.0
