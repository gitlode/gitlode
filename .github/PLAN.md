# gitrail — v0.3.0 Release Plan

## Overview

v0.3.0 follows v0.2.0 without breaking CLI changes. The primary focus is **file-level ETL output**: a new `--output-mode file` flag that produces one output record per changed file per commit, making gitrail suitable for file-granularity analytics in data warehouses.

This release also includes two preparatory changes that improve internal quality and prevent future complexity growth: the `erasableSyntaxOnly` compiler flag and a structural decomposition of `Extractor.run()`.

## Release Goals

- Enforce `erasableSyntaxOnly` in `tsconfig.json` and fix the one existing violation, establishing a permanent guard against non-erasable syntax regressions
- Decompose `Extractor.run()` into focused private methods to reduce cognitive load and localize future feature additions
- Implement `GitAdapter.getFileChanges()` using `isomorphic-git`'s `walk()` API and the `diff` npm package, providing per-file line-level diff statistics
- Introduce `--output-mode file` to produce one JSONL record per changed file per commit, enabling file-granularity dimensional modeling in downstream analytical systems

## Scope Summary

### Included in v0.3.0

- `erasableSyntaxOnly: true` in `tsconfig.json`; expand `NodeStateStore` parameter property to explicit field + assignment
- `Extractor.run()` decomposition: `initializeStateMap()`, `computeNewBranchExclude()`, `buildExcludeHash()`, `processBranch()` as private methods; `BranchRunContext` private interface
- `GitAdapter.getFileChanges(repoPath, commitOid, parentOid?)` — returns `FileChange[]` with `path`, `status`, `additions`, `deletions` (including binary-file null handling)
- `--output-mode commit | file` CLI flag (default `commit`); file mode produces one record per changed file with full commit metadata denormalized
- `additions` and `deletions` line-level diff statistics in file-level records
- `ExtractionResult.commitsWritten` renamed to `recordsWritten` (internal type; no external compatibility concern)
- New runtime dependency: `diff` npm package (BSD-3-Clause)

### Explicitly excluded from v0.3.0

- `--include-files` flag (commit-embedded file array) — deemed a convenience feature; `--output-mode file` provides equivalent analytical value; deferred to a later release
- Configurable field inclusion/exclusion (`--fields` / `--exclude-fields`) — separate subsequent release
- `--rotate-size` human-readable suffixes — separate subsequent release
- Granular performance profiling (`ExtractionResult.timings`) — deferred to v0.3.1 after file-level output performance can be measured empirically
- Progress metrics quality redesign — depends on v0.3.1 performance profiling data; deferred
- Rename detection in file diffs (`"renamed"` status) — isomorphic-git has no built-in support; out of scope
- Submodule change detection — silently skipped

## Development Phases

| #   | Title                                                            | File                                  | Status    |
| --- | ---------------------------------------------------------------- | ------------------------------------- | --------- |
| 1   | TypeScript: `erasableSyntaxOnly` and Parameter Property Refactor | [phase-1.md](plans/v0.3.0/phase-1.md) | Completed |
| 2   | `Extractor.run()` Decomposition                                  | [phase-2.md](plans/v0.3.0/phase-2.md) | Completed |
| 3   | File Diff Computation in Git Adapter                             | [phase-3.md](plans/v0.3.0/phase-3.md) | Completed |
| 4   | File-Level Output Mode (`--output-mode file`)                    | [phase-4.md](plans/v0.3.0/phase-4.md) | Planned   |

**Phase dependency**: Phase 3 must complete before Phase 4. Phases 1 and 2 are independent and can be executed in any order.

## Release Tasks

### Documentation Update

_Update all human-oriented documentation to reflect the complete set of changes introduced in this release. Run after all Development Phases are complete._

#### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

#### Mandatory Files

The following files are required for every release and must be updated regardless of scope:

| File                 | Notes                                                                                                                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHANGELOG.md`       | Prepend a `[{version}]` section following Keep a Changelog format (Added / Changed / Fixed subsections). Breaking changes carry a **Breaking** prefix within Changed. Include a `### Migration` subsection for any breaking CLI changes. |
| `README.md`          | Review for impact; update if CLI behavior or output format is described.                                                                                                                                                                 |
| `.github/roadmap.md` | Remove all roadmap entries that were implemented in this release. Entries that were evaluated but explicitly deferred should remain. This cleanup step is required on every release to keep the roadmap forward-looking.                 |

#### Pre-Execution Step

Before starting this task, review all human-oriented documentation for content that has become stale due to changes introduced in this release's phases. This review is mandatory regardless of what was anticipated at planning time.

Documentation to review:

- `README.md`
- `docs/usage.md`
- `docs/design/` (all files)

For each file, check against the actual implementation for: renamed CLI options, changed output formats, removed limitations, and new behaviors. Update any stale content found during the review.

#### Release-Specific Notes

- `docs/usage.md`: Add `--output-mode` option documentation and a file-mode usage example
- `.github/instructions/architecture.instructions.md`: Update "Git Adapter Interface" section (add `getFileChanges()`); update "Component Responsibilities — Core Logic Layer" section (add output mode branching)
- `.github/instructions/cli.instructions.md`: Add `--output-mode` entry to the CLI parameter table
- `.github/instructions/schema.instructions.md`: Verify "File-Level Output Schema" section matches implementation; remove "file-level diff stats per commit" from "Future Schema Extensions"
- No breaking CLI changes in this release; no `### Migration` subsection required in CHANGELOG

#### Verification

- `CHANGELOG.md` has a `[{version}]` entry with the appropriate subsections
- All roadmap entries with **Release target** equal to this version have been removed from `roadmap.md`
- `npm run format:check` passes

---

## Final Verification Checklist

(to be filled when all phases are complete — run after all Development Phases and Release Tasks are marked complete)

- [ ] `npm run build` passes with no errors
- [ ] `npm test` passes with no failures
- [ ] `npm run format:check` passes
- [ ] `--output-mode file` produces valid JSONL with one record per changed file
- [ ] `--output-mode commit` (default) is identical to pre-v0.3.0 behavior
- [ ] Incremental extraction works correctly with `--output-mode file`
- [ ] File rotation (`--rotate-lines`) works correctly in file mode
- [ ] Binary files produce `additions: null, deletions: null`
- [ ] Root commits produce `"added"` entries for all files
- [ ] Empty commits produce no output records in file mode
- [ ] `CHANGELOG.md` has a `[0.3.0]` entry
- [ ] All roadmap entries with `Release target: v0.3.0` have been removed from `roadmap.md`
