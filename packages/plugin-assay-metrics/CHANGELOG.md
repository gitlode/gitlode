# Changelog

## 0.2.0

### Minor Changes

- ff0a655: [Changed] Assay metric `max` renamed to `net-change` to clarify its calculation logic as the maximum of additions and deletions within a file.
- 0de550d: [Changed] Updated official plugins to the new gitlode plugin interface by removing message-bearing `skip`/`fatal` results and shifting warning/error reporting to plugin runtime diagnostics.

### Patch Changes

- 3489a70: Update peerDependencies to require gitlode version ^0.10.0

## 0.1.0

- Initial release of `@gitlode/plugin-assay-metrics`.
