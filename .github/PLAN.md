# gitrail — v0.4.0 Release Plan

## Overview

v0.4.0 is a pre-v1 minor release centered on an architecture redesign. Because gitrail is still in a pre-release stage, this release may include large internal restructuring and intentional CLI breaking changes where they materially improve the long-term model.

The primary focus is the roadmap item `Architecture: Fact-based extraction pipeline and orchestration split`, delivered together with closely related CLI and observability work that benefits from the same stage boundaries.

## Release Goals

- Replace the current mixed-responsibility extraction flow with a fact-based, stage-oriented pipeline and explicit orchestration boundary
- Move checkpoint timing, sink lifecycle, and progress ownership out of `Extractor` and into the orchestration layer while preserving current extraction semantics
- Redesign the CLI parameter model around extraction intent and record grain so the user-facing model matches the redesigned pipeline concepts
- Add stage-aligned profiling and improved progress reporting based on meaningful execution boundaries rather than record count alone

## Scope Summary

### Included in v0.4.0

- `Architecture: Fact-based extraction pipeline and orchestration split` (mandatory release theme item)
- `CLI UX: Parameter model redesign for extraction and output grain`
- `Development: Granular performance profiling`
- `CLI UX: Progress metrics quality and progress-display redesign`

### Explicitly excluded from v0.4.0

- `CLI UX: Release-boundary extraction workflow` — adjacent to extraction semantics, but too large to combine with the architecture migration and CLI breaking-change set in one release
- `Architecture: Diff algorithm abstraction within IsomorphicGitAdapter` — defer until profiling data from the redesigned pipeline shows whether diff interchangeability is an immediate priority
- `Output: Configurable field inclusion/exclusion` — better scheduled after projector boundaries are stable and the new pipeline has landed
- `Output: Repository metadata override` — compatible with the new projector split, but not foundational to the architecture redesign theme
- `Output: Execution metadata line` — defer until sink responsibilities and release-level metadata needs are re-evaluated after the redesign
- `Output: stdout support and stream-based OutputWriter` — depends on sink abstraction but is still user-need driven rather than release-defining
- `Code hygiene: Identifier naming audit for semantic accuracy` — revisit after the redesign stabilizes the new internal vocabulary, to avoid renaming the same concepts twice
- CLI-only polish items such as `--rotate-size` suffixes, unknown-argument diagnostics, and `--help` grouping — intentionally deferred to keep v0.4.0 focused on the architecture-led change set

## Development Phases

### Phase 1: Fact Vocabulary and Compatibility Facade

- **File**: [`plans/phase-1.md`](plans/phase-1.md)
- **Status**: Completed

### Phase 2: Commit Traversal Stage Extraction

- **File**: [`plans/phase-2.md`](plans/phase-2.md)
- **Status**: Completed

### Phase 3: File-Change Expansion and Projector Split

- **File**: [`plans/phase-3.md`](plans/phase-3.md)
- **Status**: Completed

### Phase 4: Coordinator, Output Sink, and Checkpoint Orchestration

- **File**: [`plans/phase-4.md`](plans/phase-4.md)
- **Status**: Completed

### Phase 5: CLI Parameter Model Redesign

- **File**: [`plans/phase-5.md`](plans/phase-5.md)
- **Status**: Planned

### Phase 6: Stage-Aligned Profiling Instrumentation

- **File**: [`plans/phase-6.md`](plans/phase-6.md)
- **Status**: Planned

### Phase 7: Progress Reporting Redesign and Obsolete-Path Cleanup

- **File**: [`plans/phase-7.md`](plans/phase-7.md)
- **Status**: Planned

Provisional dependency notes:

- Phases 1 through 4 deliver the architecture migration in dependency order.
- Phase 5 follows Phase 4 so the breaking CLI redesign can target the final orchestration and granularity model rather than temporary compatibility shapes.
- Phase 6 depends on the Phase 4 stage boundaries being real, because profiling should instrument the actual coordinator, traversal, expansion, projection, and sink responsibilities.
- Phase 7 depends on Phase 6 profiling outputs and also absorbs the final architecture cleanup step from the roadmap migration plan.

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

- Document the architecture redesign in the design docs and update any instructions files whose component boundaries or terminology are no longer accurate
- Add explicit migration notes for CLI breaking changes introduced by the parameter model redesign
- Reconcile progress-reporting and profiling documentation with the final stderr/output contract decided during phase design

#### Verification

- `CHANGELOG.md` has a `[{version}]` entry with the appropriate subsections
- All roadmap entries with **Release target** equal to this version have been removed from `roadmap.md`
- `npm run format:check` passes

---

## Final Verification Checklist

(to be filled when all phases are complete)
