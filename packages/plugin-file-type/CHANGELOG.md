# Changelog

## 0.1.0

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
- Added plugin unit tests for config validation, classifier semantics, built-in mappings, and
  runtime behavior.

### Notes

- The plugin is intended for per-file extraction. Commit facts are skipped by design.
