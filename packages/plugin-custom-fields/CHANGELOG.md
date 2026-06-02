# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-26

### Added

- Initial release of `@gitlode/plugin-custom-fields`.
- Static field projection under `extensions["custom-fields"]` for both commit and file-change
  records.
- Config validation for:
  - required non-empty `fields` object
  - field-name pattern `^[A-Za-z_][A-Za-z0-9_-]*$`
  - supported scalar value types (`string`, `number`, `boolean`, `null`)
  - finite-number requirement for numeric values
- Immutable projected field map via frozen config-derived data.
