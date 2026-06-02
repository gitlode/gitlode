# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-27

### Added

- Initial release of `@gitlode/plugin-conventional-commits`.
- Commit-message parsing via `conventional-commits-parser` with the parsed payload written under
  `extensions["conventional-commits"]`.
- Projection for both commit records and file-change records using the source commit message.
- Zero-config operation; the plugin factory accepts no plugin-specific options.
