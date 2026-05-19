# gitrail — v0.6.0 Release Plan

## Overview

v0.6.0 is a minor release focused on CLI reliability and operator control for incremental extraction and per-file diff cost. This release prioritizes user-facing workflow correctness and practical usability improvements over deep architectural refactoring. As a pre-1.0 minor release, behavior and contract adjustments are allowed when they reduce future migration risk, but the scope should remain tightly aligned to CLI and extraction-operability outcomes.

## Release Goals

- Make incremental extraction reliable across non-branch refs when state tracking is enabled
- Give users explicit control over large text-diff cost in per-file extraction mode
- Improve CLI readability and discoverability for interactive usage
- Add low-risk CLI-level metadata override capability for repository context

## Scope Summary

### Included in v0.6.0

- `State/Incremental: Track non-branch refs in state for reliable incremental extraction`
- `Extraction/CLI: User-controlled guardrail for very large text diffs`
- `CLI UX: Terminal output styling and readability`
- `Output: Repository metadata override`

### Explicitly excluded from v0.6.0

- `Extraction/File Mode: Exact-content rename detection (limited scope)`
- `Architecture: Diff algorithm abstraction within IsomorphicGitAdapter`
- `Output: Execution metadata line`
- `Pipeline: Pluggable enrichment stage for organization-specific metadata`
- `Architecture/Runtime: Worker-based extraction runtime for resilience and orchestration`

## Development Phases

### Phase 1: Non-Branch Ref State Tracking

- **File**: [`plans/phase-1.md`](plans/phase-1.md)
- **Status**: Planned

### Phase 2: Large Text-Diff Guardrail

- **File**: [`plans/phase-2.md`](plans/phase-2.md)
- **Status**: Planned

### Phase 3: CLI Readability and Metadata Override

- **File**: [`plans/phase-3.md`](plans/phase-3.md)
- **Status**: Planned

Provisional dependency notes:

- Phase 1 is first because state schema/tracking behavior is foundational for incremental extraction semantics.
- Phase 2 follows to introduce performance guardrails without mixing state-format changes and diff-policy changes in one phase.
- Phase 3 is last because it is mostly UX and CLI option-surface refinement that should align with finalized behavior from Phases 1 and 2.

## Release Tasks

### Documentation Update

_Update all human-oriented documentation to reflect the complete set of changes introduced in this release. Run after all Development Phases are complete._

#### Status

- [x] Planned
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

- Update usage and troubleshooting guidance for non-branch ref incremental behavior under `--state`.
- Document large text-diff guardrail behavior, defaults, and contract impact (`null` counters when skipped).
- Reflect terminal output/readability changes and repository metadata override options in CLI documentation.

#### Verification

- `CHANGELOG.md` has a `[{version}]` entry with the appropriate subsections
- All roadmap entries with **Release target** equal to this version have been removed from `roadmap.md`
- `npm run format:check` passes

---

## Final Verification Checklist

(to be filled when all phases are complete)
