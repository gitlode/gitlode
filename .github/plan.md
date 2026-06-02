# gitlode — v0.8.0 Release Plan

## Overview

v0.8.0 is a plugin-focused minor release. It expands plugin data-expression flexibility,
clarifies runtime/plugin responsibility boundaries, improves CLI orchestration testability,
and extends the configuration surface beyond plugin loading while preserving extraction
semantics.

## Release Goals

- Enable scalar-valued plugin extension outputs with clear contract boundaries.
- Establish consistent run-scoped runtime and plugin service-injection responsibilities.
- Improve main orchestration maintainability and behavioral test coverage without CLI behavior changes.
- Define the next configuration-file expansion path beyond plugin loading.

## Scope Summary

### Included in v0.8.0

- Architecture/CLI Runtime: Run-scoped responsibility boundaries and runtime service injection consistency
- Plugin Contract: Allow scalar values in extensions.<namespace>
- Architecture/CLI Runtime: main orchestration refactoring and unit-test expansion
- Configuration File: General-purpose configuration file beyond plugin loading

### Explicitly excluded from v0.8.0

- Release Engineering: Staged monorepo CI/CD evolution with changesets adoption

## Development Phases

### Phase 1: Plugin Contract Scalar Values and Type-Safety Boundary

- **File**: `plans/phase-1.md`
- **Status**: Completed

### Phase 2: Runtime/Plugin Responsibility Boundary Consolidation

- **File**: `plans/phase-2.md`
- **Status**: Completed

### Phase 3: Main Orchestration Refactor and Unit-Test Expansion

- **File**: `plans/phase-3.md`
- **Status**: Completed

### Phase 4: Configuration File Expansion Beyond Plugin Loading

- **File**: `plans/phase-4.md`
- **Status**: Completed

## Release Tasks

### Documentation Update

- **Status**: Planned
- Update release-facing documentation (CHANGELOG, README, docs) for v0.8.0 scope.
- Remove roadmap entries (or their `Release target: v0.8.0` metadata) that were implemented in this release.

### Verification

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run format:check`

## Final Verification Checklist

- [ ] All planned phases completed and reviewed
- [ ] Documentation update tasks completed
- [ ] Roadmap cleanup completed for implemented v0.8.0 items
- [ ] `npm run build` passed
- [ ] `npm test` passed
- [ ] `npm run lint` passed
- [ ] `npm run format:check` passed
