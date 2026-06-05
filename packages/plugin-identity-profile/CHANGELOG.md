# Changelog

## [Unreleased]

### Added

- Bootstrap scaffold for `@gitlode/plugin-identity-profile`.
- Initial workspace packaging, build, and test setup.
- Initial inline-config runtime implementation for identity normalization and profile enrichment.
- Init-time validation and diagnostics using gitlode plugin runtime `warn()` and `error()`.
- Ordered email-first, then name-fallback resolution for author and committer identity mapping.
- Optional custom `attributes` output and `_debug` metadata output.
