# Changelog

## 0.4.0

### Minor Changes

- 0de550d: [Changed] Updated official plugins to the new gitlode plugin interface by removing message-bearing `skip`/`fatal` results and shifting warning/error reporting to plugin runtime diagnostics.

### Patch Changes

- 3489a70: Update peerDependencies to require gitlode version ^0.10.0

## 0.3.2

### Patch Changes

- c19baaa: Update peerDependencies to require gitlode version ^0.9.0

## 0.3.1

### Patch Changes

- c4fbd68: Moved changelog-format guidance from project changelog content into the README, so the changelog remains release-entry focused and better aligned with changeset-based workflows. No functional/runtime behavior changes.

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
