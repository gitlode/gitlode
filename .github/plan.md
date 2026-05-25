# gitrail — v0.7.0 Release Plan

## Overview

v0.7.0 is a plugin architecture release focused on enabling organization-specific enrichment in the extraction pipeline while keeping the core Git fact model stable. The release also includes adjacent package compatibility policy and a contained Git diff abstraction needed for future optimization flexibility.

## Release Goals

- Deliver pluggable enrichment execution as a first-class extension point
- Define official plugin distribution and compatibility policy for `@gitlode/*` packages
- Isolate line-diff algorithm choice behind an internal adapter without changing core `GitAdapter` contracts

## Scope Summary

### Included in v0.7.0

- `Pipeline: Pluggable enrichment stage for organization-specific metadata`
- `Distribution/Compatibility: Official plugin package policy and version contract`
- `Architecture: Diff algorithm abstraction within IsomorphicGitAdapter`

### Explicitly excluded from v0.7.0

- `Architecture/Runtime: Worker-based extraction runtime baseline for resilience and supervision`
- `Architecture/Runtime: Orchestration-ready expansion of the extraction runtime foundation`
- `Release Engineering: Staged monorepo CI/CD evolution with changesets adoption`
- `Extraction/File Mode: Exact-content rename detection (limited scope)`
- `Extraction/File Mode: Similarity-based rename detection for edited moves`
- `CLI UX: User-controlled color policy for non-TTY and CI logs`
- `Output: Configurable field inclusion/exclusion`
- `Development: Profiling interpretation model and usability`

## Development Phases

### Phase 1: Plugin Runtime and Enrichment Pipeline Integration

- **File**: `plans/phase-1.md`
- **Status**: Completed

### Phase 2: Official Plugin Package Policy and Compatibility Contract

- **File**: `plans/phase-2.md`
- **Status**: Completed

### Phase 3: Internal DiffAdapter Abstraction in IsomorphicGitAdapter

- **File**: `plans/phase-3.md`
- **Status**: Planned

## Release Tasks

### Documentation Update

- **Status**: Planned
- Update release-facing docs and changelog for plugin architecture introduction and compatibility policy
- Confirm plugin configuration and extension behavior documentation is consistent with implemented CLI and runtime behavior
- Roadmap cleanup: remove entries with `Release target: v0.7.0` that were implemented

### Verification

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run format:check`

## Final Verification Checklist

- Pending (filled after all phases and release tasks are complete)
