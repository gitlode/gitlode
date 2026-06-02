# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-06-02

### Changed

- Updated to the Phase 2 plugin runtime contract in `gitlode` v0.8.0.
- `init(runtime)` is now required and is the single injection point for run-scoped services.
- `project(...)` is now fact-scoped only and no longer receives legacy profiler arguments.
- Compatibility floor updated to `gitlode` `^0.8.0` in both `peerDependencies` and
  development/test dependency alignment.

### Migration

- Use this plugin with `gitlode` v0.8.0 or later.
- If you maintain forks or derived plugins, migrate to required `init(runtime)` and remove
  reliance on legacy `project(..., profiler?)` style signatures.

## [0.1.0] - 2026-05-27

### Added

- Initial release of `@gitlode/plugin-conventional-commits`.
- Commit-message parsing via `conventional-commits-parser` with the parsed payload written under
  `extensions["conventional-commits"]`.
- Projection for both commit records and file-change records using the source commit message.
- Zero-config operation; the plugin factory accepts no plugin-specific options.
