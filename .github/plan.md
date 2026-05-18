# gitrail — v0.5.0 Release Plan

## Overview

v0.5.0 is a minor release focused on making release-oriented extraction a first-class workflow and tightening the surrounding CLI contract. The release should improve how users bootstrap extraction around release refs, remove avoidable SHA-1-specific assumptions from the documented and validated surface, and harden or clarify the CLI paths that become more important once the workflow is promoted to a first-class feature. Pre-1.0 minor releases may include behavior and contract adjustments when they reduce larger v1.0 migration risk; this release should keep that latitude focused on a coherent workflow-and-compatibility theme rather than broad internal churn.

## Release Goals

- Make release-boundary extraction a clear, supported user workflow rather than an implicit ref-manipulation workaround
- Clarify and, where dependency support allows, broaden the product contract from SHA-1-specific commit hashes to Git commit object IDs
- Improve CLI robustness and discoverability in the same surface area touched by the release-boundary workflow
- Keep the release centered on workflow, compatibility, and CLI quality instead of mixing in unrelated architecture or output-surface expansion

## Scope Summary

### Included in v0.5.0

- `CLI UX: Release-boundary extraction workflow` — mandatory scope item for this release; define and implement a first-class release-oriented extraction workflow around release refs, snapshot bootstrap, and incremental follow-up
- `Compatibility: Hash-algorithm-agnostic commit OID support` — compatibility/correctness companion item that aligns the product contract with Git object IDs and removes avoidable SHA-1-only assumptions where supported
- `CLI: Schema validation for parsed CLI options` — small hardening item that becomes more valuable as the CLI parameter model grows more nuanced; reduces type-assertion drift risk in `parseArgs()` without reopening higher-level workflow semantics
- `CLI UX: --help option grouping and discoverability` — small documentation/UX companion for a release that adds or clarifies differential-extraction workflow guidance; improves discoverability of the state- and boundary-related options users must understand together

### Explicitly excluded from v0.5.0

- `Extraction/File Mode: Exact-content rename detection` — valuable, but it broadens the release into output-schema and file-mode semantics that are unrelated to the release-boundary workflow
- `Extraction/CLI: User-controlled guardrail for very large text diffs` — worthwhile performance-control item, but it is operationally separate from the v0.5.0 workflow and compatibility theme
- `Architecture: Diff algorithm abstraction within IsomorphicGitAdapter` — internal design work without enough user-facing value for this release theme
- `Architecture/Runtime: Worker-based extraction runtime` — too large and cross-cutting for the same release as a workflow-model change
- `Pipeline: Pluggable enrichment stage for organization-specific metadata` — still required before v1.0.0, but too large to combine with the release-boundary design work in this release
- `Output: Configurable field inclusion/exclusion` — better planned alongside projection/output-surface priorities rather than this release's extraction-boundary theme
- `Output: Repository metadata override` — genuinely small, but it pulls the release toward output customization rather than the chosen extraction-workflow theme
- `Output: Execution metadata line` — also small, but unrelated to the release-boundary and compatibility objectives

## Development Phases

### Phase 1: Release-Boundary Extraction Workflow

- **File**: [`plans/phase-1.md`](plans/phase-1.md)
- **Status**: Completed

### Phase 2: Commit OID Compatibility Contract

- **File**: [`plans/phase-2.md`](plans/phase-2.md)
- **Status**: Planned

### Phase 3: CLI Parser Hardening and Help Discoverability

- **File**: [`plans/phase-3.md`](plans/phase-3.md)
- **Status**: Planned

Provisional dependency notes:

- Phase 1 is first because it is the primary release feature and the main source of CLI/workflow semantics for v0.5.0.
- Phase 2 follows Phase 1: commit-OID compatibility should be aligned against the finalized release-boundary workflow, ref-resolution behavior, and any user-visible wording chosen in Phase 1.
- Phase 3 follows Phase 1 because schema validation and help grouping both depend on the final CLI option surface and help text after the release-boundary workflow design is fixed.
- Phase 3 is kept after Phase 2 as well to avoid repeated edits to the same CLI-facing files and documentation while terminology is still moving.

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

- Update CLI and usage documentation for the final release-boundary workflow and any new or revised parameter semantics.
- Update Git traversal and architecture documentation if release-ref resolution, ref-boundary semantics, or commit OID terminology change.
- Add migration notes if user-visible CLI behavior or documented compatibility guarantees change.

#### Verification

- `CHANGELOG.md` has a `[{version}]` entry with the appropriate subsections
- All roadmap entries with **Release target** equal to this version have been removed from `roadmap.md`
- `npm run format:check` passes

---

## Final Verification Checklist

- [ ] All development phases are marked Completed.
- [ ] `CHANGELOG.md` contains a finalized this version's entry with `Added` / `Changed` / `Fixed` and `Migration` (if needed) sections.
- [ ] Human-oriented docs were reviewed and updated for latest behavior (`README.md`, `docs/usage.md`, `docs/design/`, instructions files as applicable).
- [ ] Roadmap cleanup completed for implemented items in this version; remaining entries are forward-looking.
- [ ] Verification commands completed:
  - `npm run build` pass
  - `npm test` pass
  - `npm run lint` pass
  - `npm run format:check` pass
