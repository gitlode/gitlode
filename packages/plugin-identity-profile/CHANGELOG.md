# Changelog

## 0.1.1

### Patch Changes

- c19baaa: Update peerDependencies to require gitlode version ^0.9.0
- Updated dependencies [cb4fbe1]
- Updated dependencies [17769d4]
  - gitlode@0.9.0

## [0.1.0] - 2026-06-08

### Added

- Initial release of `@gitlode/plugin-identity-profile` for author and committer identity normalization and profile enrichment.
- Inline `profileMappings` configuration with raw exact matching, email-first resolution, and name fallback when no email match is found.
- Optional custom `attributes` output, optional `_debug` metadata, and init-time validation and diagnostics via the gitlode plugin runtime.
