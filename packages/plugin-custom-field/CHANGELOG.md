# Changelog

## 1.0.0

### Minor Changes

- 0de550d: [Changed] Updated official plugins to the new gitlode plugin interface by removing message-bearing `skip`/`fatal` results and shifting warning/error reporting to plugin runtime diagnostics.

### Patch Changes

- 3489a70: Update peerDependencies to require gitlode version ^0.10.0
- Updated dependencies [0435c9d]
- Updated dependencies [5ece811]
- Updated dependencies [66088bb]
  - gitlode@0.10.0

## 0.4.1

### Patch Changes

- c19baaa: Update peerDependencies to require gitlode version ^0.9.0

## 0.4.0

### Minor Changes

- 6a56f48: Allow scalar top-level value.

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

## [0.2.0] - 2026-05-26

### Added

- Initial release of `@gitlode/plugin-custom-field`.
- Static field projection under `extensions["custom-field"]` for both commit and file-change
  records.
- Plugin config schema uses `value` as the top-level key for projected field maps.
- Config validation for:
  - required non-empty `value` object
  - field-name pattern `^[A-Za-z_][A-Za-z0-9_-]*$`
  - supported scalar value types (`string`, `number`, `boolean`, `null`)
  - finite-number requirement for numeric values
- Immutable projected field map via frozen config-derived data.
