# gitrail — v0.2.0 Release Plan

## Overview

This plan covers the release following v0.1.4.
The target version is **v0.2.0**.

v0.2.0 is the first release with a deliberate minor-version increment. As this project is still pre-1.0.0, this release may introduce breaking changes to the CLI interface. All such changes will be documented in the changelog.

The primary focus is on stabilizing the CLI contract early — particularly around how users specify extraction intent and manage state files — and on cleaning up the architecture before the codebase grows further.

## Release Goals

- Establish a stable, explicit CLI interface for extraction modes and state management
- Prevent accidental data overwrites caused by repeated runs in the same output directory
- Improve cross-session correctness when users add new branches over time
- Reduce architecture coupling in the core layer to improve testability and future feature velocity
- Improve help discoverability for new users

## Scope Summary

### Included in v0.2.0

- Refactor the extractor boundary to move runtime concerns (stderr, timing, state I/O) behind explicit abstractions
- Apply `readonly` modifiers across all pure data interfaces and types
- Add execution-time uniqueness to rotated output filenames to prevent overwrite across sessions
- Introduce explicit extraction mode (`--mode snapshot|incremental`), rename `--since-commit` to `--since-ref`, add `--on-missing-state`, and add shorthand aliases for all major flags
- Add merge-base-based cross-run deduplication when new branches are added across sessions
- Group `--help` output by category for better discoverability
- Update documentation and changelog entries for the release

### Explicitly excluded from v0.2.0

- Progress metrics redesign and phase-level observability
- Configurable field inclusion or exclusion
- All long-term output, schema, and streaming features

---

## Phase 1: Extractor Boundary Cleanup for Runtime and I/O Concerns

_Introduce explicit abstractions for stderr output, timing, and state persistence in the core layer, replacing direct runtime coupling in `extractor.ts`._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

---

## Phase 2: TypeScript `readonly` Audit

_Apply `readonly` modifiers to all interface fields and collection types used as pure data or configuration, starting from value types and working inward._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

---

## Phase 3: Output Filename Uniqueness Across Sessions

_Include a session-unique identifier (execution timestamp) in rotated output filenames so repeated runs in the same directory do not overwrite prior results._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

---

## Phase 4: Explicit Extraction Mode and State Ergonomics

_Replace implicit extraction mode detection with an explicit `--mode snapshot|incremental` flag, rename `--since-commit` to `--since-ref` to accept any Git ref (commit hash, tag, or branch name), introduce `--on-missing-state` to control behavior when the expected state file is absent, and add shorthand aliases (`-m`, `-b`, `-o`, `-s`, `-q`) for all major flags._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

### Design References

- [`instructions/cli.instructions.md`](instructions/cli.instructions.md) — full parameter reference, mutual exclusion rules, validation phases, usage examples
- [`instructions/git-traversal.instructions.md`](instructions/git-traversal.instructions.md) — Traversal Algorithm (Snapshot Mode / Incremental Mode), State File Management (role per mode, HEAD recording semantics)
- Roadmap item: "CLI spec: Explicit extraction mode and state ergonomics"

### Design Decisions

- **`--mode snapshot|incremental`**: default is `snapshot`. `snapshot` extracts independently of prior state; `incremental` reads state to determine the commit boundary. The presence of `--state` alone no longer implies incremental mode — this is a breaking change from v0.1.x behavior.
- **`--since-commit` renamed to `--since-ref`**: accepts commit hash, tag name, or branch name. Resolved via `resolveRef()`. The internal `ExtractionRange` type field changes from `type: "commit"` to `type: "ref"`. This is a breaking CLI change.
- **`--on-missing-state error|snapshot`**: default is `error`. Only valid with `--mode incremental`. `snapshot` emits a warning to stderr and falls back to full extraction, then creates the state file on success.
- **`--state` + `--since-ref` is permitted in snapshot mode**: `--state` serves only as a recording path for the current HEAD; `--since-ref` controls the extraction range independently. This deliberately reverses the prior mutual exclusion between `--state` and `--since-*`.
- **Shorthand aliases via citty `alias` property**: `-m` (--mode), `-o` (--output-dir), `-s` (--state), `-q` (--quiet). The `-b` alias for `--branch` must be handled in the existing `process.argv` manual scan loop, not via citty, because citty does not preserve repeated occurrences.
- **Validation is 3-phase**: (1) format/mutual-exclusion — no I/O; (2) filesystem — repository path, output dir, and state parent directory (new check); (3) Git — ref resolution for each `--branch` and `--since-ref`. All phases complete before any extraction begins.
- **`ExtractorConfig` gains `mode` and `onMissingState` fields**: `mode: "snapshot" | "incremental"`. `onMissingState?: "error" | "snapshot"` (relevant only in incremental mode). `Extractor.run()` uses `mode` to decide whether to read state content.
- **New runtime dependencies**: none.

### Non-Goals

- `--state-dir` (automatic state file path derivation) — deferred to a future release
- Help output grouping — Phase 6
- Cross-run deduplication for newly added branches — Phase 5
- Changes to output format, JSON schema, or `OutputWriter`

### Target Files

| File                              | Action | Notes                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/args.ts`                 | Modify | Rename `since-commit` → `since-ref` in `argsDef`; add `mode` arg with alias `-m`; add `on-missing-state` arg; add aliases `-o`, `-s`, `-q`; extend `-b` manual scan; rewrite mutual exclusion (5 rules replacing 2); add Phase 2 state parent dir check; replace `--since-commit` walkCommits validation with `resolveRef()` for `--since-ref`; update `ExtractorConfig` population |
| `src/core/types.ts`               | Modify | `ExtractionRange`: rename `type: "commit"` → `type: "ref"`; add `mode: "snapshot" \| "incremental"` to `ExtractorConfig`; add `onMissingState?: "error" \| "snapshot"` to `ExtractorConfig`                                                                                                                                                                                         |
| `src/core/extractor.ts`           | Modify | Guard state-reading block with `this.config.mode === "incremental"`; implement `--on-missing-state snapshot` fallback (warn + full traversal) and `error` (exit 1) when state file is absent in incremental mode; update `ExtractionRange` type check from `"commit"` → `"ref"`                                                                                                     |
| `test/cli/args.test.ts`           | Modify | Add tests for `--mode`, `--since-ref`, `--on-missing-state`, aliases `-m`/`-b`/`-o`/`-s`/`-q`; update mutual exclusion tests (5 new, remove 2 old); add Phase 2 state parent dir test; update `--since-commit` test to expect unknown-flag error                                                                                                                                    |
| `test/cli/cmd-definition.test.ts` | Modify | Reflect renamed arg `since-ref` and new args `mode`, `on-missing-state` in command definition assertions                                                                                                                                                                                                                                                                            |
| `test/core/extractor.test.ts`     | Modify | Add tests: snapshot mode ignores state content; incremental mode reads state; `--on-missing-state snapshot` fallback emits warning and performs full traversal; `--on-missing-state error` (enforced in `args.ts`, not `Extractor`) — confirm `Extractor` does not need to re-validate                                                                                              |

### Implementation Notes

- The existing `process.argv` manual scan loop collects `--branch` and `--branch=`; it must also collect `-b` followed by a non-flag value. Add that case alongside the existing `--branch` cases.
- The prior state-reading block in `Extractor.run()` silently skips to full extraction on `ENOENT`. With the new design, this behavior moves to `args.ts` (for the `--on-missing-state` decision) and the `ENOENT` path in `Extractor` should become unreachable in incremental mode. The snapshot-mode path should skip state-reading entirely.
- The old `--since-commit` validation called `walkCommits()` to verify the hash existed. Replace this with a single `resolveRef()` call for `--since-ref` — if it throws `REF_NOT_FOUND`, emit `Ref not found: <ref>` and exit 1.
- The old mutual exclusion `--state && (sinceCommit || sinceDate)` → error must be removed. Review `args.test.ts` for tests that assert this behavior and update them to assert the opposite (permitted in snapshot mode).

### Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks:**

- `gitrail -b main ./repo` — snapshot mode (default), no state, exits 0
- `gitrail --mode snapshot -b main -s ./state.json ./repo` — snapshot; creates/overwrites state file; prior state content is not used
- `gitrail --mode incremental -b main -s ./state.json ./repo` (state exists) — reads state, differential extraction, exits 0
- `gitrail --mode incremental -b main -s ./state.json ./repo` (state missing, default `--on-missing-state error`) — exits 1 with message `--state is required when using --mode incremental` ... actually state file is missing, not `--state` omitted. Confirm message is `State file not found: <path>`  
  → Update: exits 1 with the configured error message for missing state file
- `gitrail -m incremental -b main -s ./state.json --on-missing-state snapshot ./repo` (state missing) — emits warning to stderr, performs full extraction, creates state file, exits 0
- `gitrail -b main --since-ref v1.0 ./repo` — snapshot from tag boundary, exits 0
- `gitrail -b main --since-ref v1.0 -s ./state.json ./repo` — snapshot from tag, records HEAD in state file (not tag hash)
- `gitrail -m incremental -b main -s ./state.json --since-ref v1.0 ./repo` — exits 1: `--since-ref cannot be used with --mode incremental`
- `gitrail --mode incremental -b main ./repo` (no `--state`) — exits 1: `--state is required when using --mode incremental`
- `gitrail --since-commit abc123 ./repo` — citty unknown-arg error (confirm `--since-commit` is no longer recognized)

---

## Phase 5: Cross-Run Deduplication for Newly Added Branches

_When branches are added across sessions, compute the merge base with previously seen branches and use it as the traversal boundary, preventing duplicate commits in downstream output._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

---

## Phase 6: Help Option Grouping and Discoverability

_Group CLI options under labelled sections in the `--help` output and add descriptive notes to guide users toward the incremental extraction workflow._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

---

## Phase 7: Release Documentation and Notes

_Update the README, changelog, and any migration notes to reflect breaking CLI changes and new behavior introduced in this release._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

---

## Final Verification Checklist

_To be filled in when phase implementation detail is finalized._

---

## Release Intent Summary

v0.2.0 is a **CLI stability and architecture release**.
It establishes the intended CLI contract for extraction modes and state management, prevents operational hazards in repeated runs, and cleans up core architecture before the codebase grows further.
Breaking changes to the CLI interface are intentional and will be documented in the changelog.
