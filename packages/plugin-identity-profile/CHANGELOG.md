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

## 0.1.1

### Patch Changes

- c19baaa: Update peerDependencies to require gitlode version ^0.9.0

## [0.1.0] - 2026-06-08

### Added

- Initial release of `@gitlode/plugin-identity-profile` for author and committer identity normalization and profile enrichment.
- Inline `profileMappings` configuration with raw exact matching, email-first resolution, and name fallback when no email match is found.
- Optional custom `attributes` output, optional `_debug` metadata, and init-time validation and diagnostics via the gitlode plugin runtime.
