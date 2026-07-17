# Changelog

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
- 98f9ec6: [Added] Expanded built-in file type detection to recognize more Java ecosystem files, including Gradle/Groovy scripts, JSP-related files, Maven descriptors, and Java archive artifacts.

## 0.1.0 - 2026-06-09

### Added

- Implemented file type classification plugin runtime for `@gitlode/plugin-file-type`.
- Added config parser and validation for `debug`, `ruleSets`, `mappings`, and `unknownPolicy`.
- Added built-in `common` rule set with curated suffix and basename mappings.
- Added matching engine with precedence rules, case behavior, and longest-suffix selection.
- Added support for mapping signatures:
  - suffix keys via the `*.` form (for example `*.ts`)
  - exact basename keys (for example `Dockerfile`, `.gitignore`, `.config.json`)
- Added unknown handling policies:
  - `emit` -> outputs `{ "name": "Unknown" }`
  - `skip` -> plugin returns `skip`
- Added optional debug metadata output (`_debug.source`, `_debug.matched`) when `debug: true`.
