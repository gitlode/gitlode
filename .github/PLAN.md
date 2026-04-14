# gitrail — v0.1.4 Release Plan

## Overview

This plan covers the next release after the completed initial build-out.
The target version is **v0.1.4**.

Version numbers between v0.1.0 and v0.1.4 were used during CI/CD verification and are intentionally skipped. This project continues to follow **Semantic Versioning**, and v0.1.4 is planned as a **small, backward-compatible release** focused on modest improvements and validating the stability of the release flow.

The user has already completed some local lint and format maintenance work. That work is treated as baseline repository hygiene and should be preserved during implementation.

## Release Goals

- Ship a small, low-risk release with clear user value
- Keep extraction semantics and JSONL output behavior backward-compatible
- Improve CLI usability for interactive and automated runs
- Exercise the CI/CD and release process on a stable, reviewable change set

## Scope Summary

### Included in v0.1.4

- Fix the CLI `--help` output so defined parameters are displayed correctly
- Add extraction progress reporting to stderr
- Add a post-run execution summary to stderr
- Add a `--quiet` flag for CI, cron, and scripted usage
- Refresh the deprecated `typescript-eslint` flat-config pattern in the ESLint setup
- Update documentation and changelog entries for the release

### Explicitly excluded from v0.1.4

- Help option grouping or custom help renderer work
- Explicit extraction mode / state ergonomics redesign
- Cross-run deduplication for newly added branches
- Full `readonly` audit across all interfaces and types
- Long-term output/schema expansion features

---

## Phase 1: CLI Help Output Fix

_Fix a clear correctness issue in the command-line UX._

### Status

- [x] Planned
- [x] In progress
- [x] Completed

### Tasks

- [x] Reuse the existing command definition already declared in the CLI layer
- [x] Wire that definition into the main entrypoint so `--help` displays the full supported option set
- [x] Keep the fix minimal and avoid redesigning the help renderer in this release

### Target files

- `src/index.ts`
- `src/cli/index.ts`
- `src/cli/args.ts`

### Verification

- [x] `node dist/index.js --help` lists the supported parameters and descriptions
- [x] No existing CLI argument parsing behavior regresses

---

## Phase 2: Runtime Progress and Summary Output

_Add lightweight runtime visibility without changing extraction results._

### Status

- [x] Planned
- [x] In progress
- [x] Completed

### Tasks

- [x] Add periodic progress updates during extraction
- [x] Write progress updates to **stderr only** so JSONL output remains safe for piping
- [x] Add a completion summary including:
  - [x] commits written
  - [x] output files created
  - [x] total bytes written
  - [x] elapsed time
  - [x] processed branches
- [x] Prefer a simple implementation without new runtime dependencies unless a strong need emerges

### Target files

- `src/core/types.ts`
- `src/core/extractor.ts`
- `src/output/writer.ts`
- `src/index.ts`

### Verification

- [x] Progress output appears during larger extraction runs
- [x] Summary output appears at the end of a successful run
- [x] stdout remains valid JSONL when redirected or piped

---

## Phase 3: Quiet Mode for Automation

_Add a small usability feature for non-interactive environments._

### Status

- [x] Planned
- [x] In progress
- [x] Completed

### Tasks

- [x] Add a `--quiet` flag to suppress progress and summary output
- [x] Ensure this affects only stderr chatter, not normal extraction output or exit codes
- [ ] Document the intended use for CI and scheduled jobs

### Target files

- `src/cli/args.ts`
- `src/core/types.ts`
- `src/index.ts`

### Verification

- [x] Running with `--quiet` suppresses progress and summary output
- [x] Extraction results and exit status remain unchanged

---

## Phase 4: Dev-Environment Maintenance

_Apply a narrowly scoped tooling cleanup aligned with current repository maintenance._

### Status

- [x] Planned
- [x] In progress
- [x] Completed

### Tasks

- [x] Update the deprecated `typescript-eslint` configuration pattern in `eslint.config.js`
- [x] Preserve the user’s already completed lint and format fixes
- [x] Avoid a broader lint ruleset redesign in this release

### Target files

- `eslint.config.js`

### Verification

- [x] `npm run lint` passes
- [x] `npm run format:check` passes

---

## Phase 5: Release Documentation and Notes

_Record the small user-facing improvements and release intent clearly._

### Status

- [x] Planned
- [x] In progress
- [x] Completed

### Tasks

- [x] Update the CLI documentation in `README.md`
- [x] Add a v0.1.4 entry to `CHANGELOG.md`
- [x] Ensure the release notes reflect the purpose of this version: modest enhancements plus CI/CD flow validation

### Target files

- `README.md`
- `CHANGELOG.md`

### Verification

- [x] Documentation matches the implemented CLI behavior
- [x] No placeholder text remains in the release notes

---

## Final Verification Checklist

Before considering v0.1.4 ready:

- [x] `npm run build` completes successfully
- [x] `npm test` passes for the full suite
- [x] `npm run lint` passes
- [x] `npm run format:check` passes as the final formatting gate
- [x] `node dist/index.js --help` shows the supported arguments correctly
- [ ] One end-to-end extraction smoke test confirms valid JSONL output
- [ ] One end-to-end extraction smoke test confirms stderr-only progress/summary output
- [ ] One end-to-end extraction smoke test confirms correct behavior with `--quiet`

---

## Release Intent Summary

v0.1.4 is intentionally a **small stability release**.
It improves the CLI experience, keeps the implementation risk low, and provides a practical checkpoint for validating the project’s CI/CD and packaging flow before larger roadmap work begins.
