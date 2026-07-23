# Changelog

## 1.0.0

### Patch Changes

- Updated dependencies [0e54d85]
  - gitlode@0.12.0

## 0.3.0

### Patch Changes

- Updated dependencies [f54225f]
- Updated dependencies [6e34a21]
- Updated dependencies [ca5c2ee]
- Updated dependencies [304185a]
- Updated dependencies [12a1c95]
  - gitlode@0.11.0

## 0.2.0

### Minor Changes

- 0de550d: [Changed] Updated official plugins to the new gitlode plugin interface by removing message-bearing `skip`/`fatal` results and shifting warning/error reporting to plugin runtime diagnostics.

### Patch Changes

- 3489a70: Update peerDependencies to require gitlode version ^0.10.0

## 0.1.1

### Patch Changes

- c19baaa: Update peerDependencies to require gitlode version ^0.9.0

## [0.1.0] - 2026-06-08

### Added

- Initial release of `@gitlode/plugin-identity-profile` for author and committer identity normalization and profile enrichment.
- Inline `profileMappings` configuration with raw exact matching, email-first resolution, and name fallback when no email match is found.
- Optional custom `attributes` output, optional `_debug` metadata, and init-time validation and diagnostics via the gitlode plugin runtime.
