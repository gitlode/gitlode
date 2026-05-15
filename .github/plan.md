# gitrail — v0.4.1 Release Plan

## Overview

v0.4.1 is a patch release that delivers two internal pipeline improvements and two small CLI UX fixes. There are no breaking changes to the CLI interface, the output JSON schema, or the state file format. All four items are self-contained, low-risk, and share the theme of tightening the codebase after the v0.4.0 architecture redesign.

## Release Goals

- Consolidate commit-grain and file-grain projection into a single discriminated Fact union and unified projector contract
- Correct inaccurate internal type and interface names to reduce reading friction without changing any external contract
- Make unknown CLI arguments a hard error to match git behavior and prevent silent typos
- Accept human-readable size suffixes for `--rotate-size` to align with standard CLI conventions

## Scope Summary

### Included in v0.4.1

- `Pipeline: Discriminated Fact union and unified projector contract` — internal pipeline consolidation; no user-visible change
- `Code hygiene: Identifier naming audit for semantic accuracy` — TypeScript identifier renames only; no behavioral change
- `CLI UX: Warn on unknown CLI arguments` — error on unrecognized options, exit non-zero
- `CLI UX: --rotate-size human-readable size suffixes` — accept `K`/`M`/`G` suffixes; backward compatible

### Explicitly excluded from v0.4.1

- `CLI UX: Release-boundary extraction workflow` — design scope too large for a patch release
- `CLI UX: --help option grouping` — cost/value ratio remains unfavorable; deferred rationale still valid
- `Extraction/File Mode: Exact-content rename detection` — schema-visible change; minor release or later
- `Architecture: Diff algorithm abstraction within IsomorphicGitAdapter` — research cost too high for this cycle
- `Architecture/Runtime: Worker-based extraction runtime` — large architectural change; patch-incompatible
- `Output: Configurable field inclusion/exclusion` — better scheduled after Discriminated Fact union stabilizes

## Development Phases

### Phase 1: Discriminated Fact Union and Unified Projector

- **File**: [`plans/phase-1.md`](plans/phase-1.md)
- **Status**: Completed

### Phase 2: Identifier Naming Audit

- **File**: [`plans/phase-2.md`](plans/phase-2.md)
- **Status**: Completed

### Phase 3: Unknown CLI Arguments Error

- **File**: [`plans/phase-3.md`](plans/phase-3.md)
- **Status**: Completed

### Phase 4: `--rotate-size` Size Suffixes

- **File**: [`plans/phase-4.md`](plans/phase-4.md)
- **Status**: Completed

Provisional dependency notes:

- Phase 2 follows Phase 1: Naming audit runs after Discriminated Fact union so that newly introduced type names are included in the audit scope.
- Phase 3 (Unknown CLI Arguments Error) and Phase 4 (`--rotate-size` Size Suffixes) are independent of Phases 1–2; however, both modify `src/cli/args.ts`. Phase 3 must complete before Phase 4 implementation starts to avoid merge conflicts. If Phase 4 branches before Phase 3 is merged, Phase 4 must rebase on Phase 3's result.
- Phases 3 and 4 are ordered sequentially to accommodate this file-level conflict, not due to any semantic dependency.

## Release Tasks

### Documentation Update

_Update all human-oriented documentation to reflect the complete set of changes introduced in this release. Run after all Development Phases are complete._

#### Status

- [ ] Planned
- [ ] In progress
- [x] Completed

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

- Update `architecture.instructions.md` canonical vocabulary and ownership rules for `Fact`, `FactProjector`, and `DefaultFactProjector` (Phase 1 touchpoint).
- Update `cli.instructions.md` to document: unknown-option fatal error policy (Phase 3) and `--rotate-size` suffix syntax and min/max bounds (Phase 4).
- Update `README.md` and `docs/usage.md` for `--rotate-size` suffix support (Phase 4 touchpoint).
- No migration notes required: no breaking CLI or schema changes in this release.
- Note: `git-traversal.instructions.md` and `architecture.instructions.md` state/checkpoint vocabulary updates are tied to Phase 2 and will be executed after Phase 2 implementation completes.

#### Verification

- `CHANGELOG.md` has a `[{version}]` entry with the appropriate subsections
- All roadmap entries with **Release target** equal to this version have been removed from `roadmap.md`
- `npm run format:check` passes

---

## Final Verification Checklist

- [x] All development phases are marked Completed.
- [x] `CHANGELOG.md` contains a finalized this version's entry with `Added` / `Changed` / `Fixed` and
      `Migration` (if needed) sections.
- [x] Human-oriented docs were reviewed and updated for latest behavior (`README.md`,
      `docs/usage.md`, `docs/design/architecture.md`, instructions files).
- [x] Roadmap cleanup completed for implemented items in this version; remaining entries are forward-looking.
- [x] Verification commands completed:
  - `npm run build` pass
  - `npm test` pass
  - `npm run lint` pass
  - `npm run format:check` pass
