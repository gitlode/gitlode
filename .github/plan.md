# gitrail — v0.6.2 Release Plan

## Overview

v0.6.2 is a narrowly scoped release dedicated to repository monorepo migration with npm workspaces. The release intentionally excludes all other roadmap entries to minimize concurrent change risk and keep validation focused on structural continuity of the core package.

## Release Goals

- Migrate repository structure to npm workspaces without changing core CLI behavior
- Preserve the published core package identity and installation path (`gitlode`)
- Keep release validation focused on migration correctness and regression prevention

## Scope Summary

### Included in v0.6.2

- `Repository/Build: npm-workspaces monorepo migration for core package continuity`

### Explicitly excluded from v0.6.2

- All other roadmap entries not listed above

## Development Phases

### Phase 1: npm Workspaces Monorepo Migration

- **File**: [`plans/phase-1.md`](plans/phase-1.md)
- **Status**: Planned

Provisional dependency notes:

- Single-phase release: no cross-phase dependencies.
- This phase is intentionally scoped to repository/workspace restructuring and build-script adaptation only.

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

- Update migration-related documentation to reflect new workspace structure, package boundaries, and build/release commands if they changed.
- Confirm user-facing CLI usage examples remain valid after monorepo migration.

#### Verification

- `CHANGELOG.md` has a `[{version}]` entry with the appropriate subsections
- All roadmap entries with **Release target** equal to this version have been removed from `roadmap.md`
- `npm run format:check` passes

---

## Final Verification Checklist

To be filled after all phases and release tasks are complete.
