# Changelog

## 0.8.2

### Patch Changes

- b8705e1: Validate changesets shadow workflow with a non-functional patch release entry.

## 0.8.1

### Patch Changes

- c4fbd68: Moved changelog-format guidance from project changelog content into the README, so the changelog remains release-entry focused and better aligned with changeset-based workflows. No functional/runtime behavior changes.
- fb32f1c: Refactor CLI startup flow with no intended behavior change.

## [0.8.0] - 2026-06-02

### Added

- General-purpose `--config` file support beyond plugin loading with versioned schema sections:
  `extraction`, `output`, `repository`, `runtime`, and optional `extensions`.
- Published official config schema artifact and generation flow for the supported v1 config surface.
- Expanded CLI/runtime helper structure and focused unit-test coverage for entrypoint orchestration,
  state-store handling, progress-runtime wiring, success reporting, and repository metadata derivation.

### Changed

- Plugin projection contract now accepts scalar success payloads (`string`, `number`, `boolean`) in
  addition to object payloads.
- Runtime/plugin boundaries were consolidated: plugins now use required
  `init(runtime: PluginRuntimeContext)` and fact-scoped `project(context)`.
- Typed termination and CLI presentation boundaries were clarified so runtime helpers no longer own
  handled process exits.
- `IsomorphicGitAdapter` profiler wiring now uses constructor/options injection rather than mutable
  post-construction setup.
- Config precedence and conflict handling now support config-backed defaults for refs, snapshot
  range, output settings, repository metadata, and profile mode while preserving CLI override rules.

### Migration

- Plugin implementations must adopt the required `init(runtime)` lifecycle and should no longer
  rely on the legacy `project(..., profiler?)` style.
- Users can keep CLI-only usage unchanged, or adopt `--config` for declarative defaults with
  precedence `CLI explicit > config > built-in`.

## [0.7.1] - 2026-05-26

### Added

- Public plugin authoring type entrypoint `gitlode/plugin-api` that re-exports the plugin contract
  types (`PluginFactory`, `ProjectorPlugin`, `ProjectionContext`, `PluginInitResult`,
  `PluginProjectionResult`) for official and third-party plugin development.

### Changed

- Package export map now includes `./plugin-api`, allowing plugins in this monorepo to consume
  plugin contract types without duplicating local type definitions.

## [0.7.0] - 2026-05-25

### Added

- Plugin runtime integration via `--config <path>` with `extensions` namespace output under each
  record.
- Plugin compatibility policy and warning-only runtime compatibility checks based on
  `peerDependencies.gitlode`.
- `DiffAdapter` abstraction in `IsomorphicGitAdapter`.

### Changed

- Output schema now supports optional `extensions` when plugins are configured.
- Project documentation and instruction files now include plugin policy and git-adapter diff
  strategy boundaries.

### Migration

- No migration action is required for existing no-plugin usage.
- Users adopting plugin config should provide a valid JSON config file with `version: 1` and
  non-empty `extensions` entries.

## [0.6.2] - 2026-05-21

### Changed

- Repository migrated to npm workspaces monorepo layout. The published package (`gitlode`) is now
  located under `packages/gitlode/`. All build, test, lint, and format commands continue to run
  from the repository root unchanged; no changes to the installed CLI, output schema, or extraction
  behavior.

> [!NOTE]
> No functional changes
>
> This release contains no changes to the CLI interface, output schema, extraction behavior, or
> runtime dependencies. Existing invocations, state files, and downstream consumers are fully
> compatible with v0.6.1.

## [0.6.1] - 2026-05-21

### Changed

- **Package rename:** Project renamed from `gitrail` to `gitlode` on npm. All `gitrail` v0.6.0 and earlier versions remain published under the old package name; `gitlode` starts at v0.6.1 with identical functionality.
- CLI binary name updated to `gitlode` (previously `gitrail`).
- All documentation, code comments, and examples updated to reference `gitlode`.

### Migration

- Replace `npm install gitrail` with `npm install gitlode` in your dependency manifests and CI/CD workflows.
- Update any shell scripts, CI jobs, or documentation that invoke the `gitrail` CLI command to use `gitlode` instead.

## [0.6.0] - 2026-05-20

> [!NOTE]
> Historical releases — versions 0.1.0 through 0.6.0
>
> These versions were previously published to npm under the package name `gitrail` and have not been republished as `gitlode`.
> The `gitlode` package starts at v0.6.1 with the same functionality as `gitrail` v0.6.0.

### Added

- `--max-diff-size <value>` option to skip line-level diff computation for files exceeding a size threshold in `--per-file` mode. Skipped diffs are emitted with `null` additions/deletions counts, matching the binary-file convention. Accepts byte values with `K`/`M`/`G` suffixes.
- `--repo-name` and `--repo-url` options to override auto-derived `repository.name` and `repository.url` fields in output records. Overrides apply only at projection time and do not affect state-file identity or incremental extraction behavior.
- `skipped_diffs` count in `--profile` output, reporting the number of file diffs skipped due to `--max-diff-size` or binary detection during the extraction.
- Terminal color output for TTY stderr: progress lines, completion summary, profile block, and warning/error badges use `chalk`-based styling with semantic color assignments. Non-TTY output remains plain text.

### Changed

- **Breaking:** State file format updated to version 2. Version 1 state files are rejected in incremental mode with an explicit unsupported-version error. Reinitialize the state file by running without `--incremental` once before resuming incremental extraction.
- Incremental state tracking now covers all ref types — branch, lightweight tag, annotated tag, and raw commit OID. Previously only branch refs were recorded in state; non-branch refs were re-extracted in full on every incremental run.
- Static-ref warning is now emitted for all non-branch refs (commit OID, annotated tag, and lightweight tag) when `--state` is active, reflecting that future incremental deltas for these refs are usually empty unless the ref target changes.
- CLI help is reorganized into six groups: `Required Input`, `Extraction Range (Snapshot Mode)`, `Incremental Extraction`, `Output and Repository Metadata`, `File Rotation`, and `Runtime and Diagnostics`.
- Completion summary field `Branches` renamed to `Refs` to reflect that all ref types are now tracked.
- Measured values in progress, summary, and profile output now use no-space `number+unit` formatting (for example `1.2MB`, `8.5s`) with thousands separators on integer counters.
- Done lines in progress output show `✓` in spinner position; warning lines carry a `[WARN]` badge prefix.

### Migration

- Delete or reinitialize any existing `--state` file before using `--incremental` with v0.6.0. Version 1 state files are no longer accepted; the runtime rejects them with an explicit unsupported-version error.
- The `Branches` field in completion summary output has been renamed to `Refs`. Update any scripts or tooling that parse this field by name.

## [0.5.0] - 2026-05-19

### Added

- Release-boundary extraction workflow guidance using `--ref`, `--since-ref`, `--state`, and
  `--incremental`, including explicit snapshot-bootstrap and incremental follow-up patterns.
- Runtime warning for non-branch refs when `--state` is active, clarifying that tags/raw OIDs are
  not tracked in state and will be re-extracted on incremental runs.
- Native help grouping in CLI output via commander option groups:
  `General`, `Output`, `Differential Extraction`, and `File Rotation`.

### Changed

- **Breaking:** CLI traversal option renamed from `--branch` (`-b`) to `--ref` (`-r`).
- Compatibility contract terminology is now commit object ID (OID)-first across runtime
  diagnostics, contracts, and docs.
- Runtime now performs fail-fast repository object-format gating before traversal/state-boundary
  consumption. Current supported format is `sha1`.
- CLI parse boundary now uses runtime schema validation (zod) instead of the previous
  `opts<T>()` trust boundary.

### Fixed

- State/incremental behavior for non-branch refs is now explicitly surfaced to users via warning
  diagnostics, reducing silent duplicate-ingestion risk in downstream systems.
- Unsupported repository object formats now fail deterministically with a user-facing diagnostic
  before extraction output/state writes begin.

### Migration

- Replace all `--branch`/`-b` usages with `--ref`/`-r` in scripts and CI jobs.
- No output schema migration is required for this release.

## [0.4.1] - 2026-05-15

### Added

- `--rotate-size` now accepts human-readable suffixes `K`, `M`, and `G` (case-insensitive) in
  addition to raw byte integers.

### Changed

- Internal projection contracts were consolidated into a discriminated `Fact` union with a
  unified `FactProjector` pipeline.
- Internal state/checkpoint naming was normalized to `StateStore`, `ExtractionState`, and
  `BranchState` terminology for semantic clarity.
- CLI parser runtime migrated from `citty` to `commander`, enabling strict unknown-option
  detection and native repeatable option parsing.

### Fixed

- Unknown CLI options now fail fast with exit code `1` and a clear `Unknown option: --<flag>`
  message instead of being silently ignored.

### Migration

No migration action is required for v0.4.1. User-facing CLI and output/state schemas remain
backward compatible.

## [0.4.0] - 2026-05-13

### Added

- Fact-based pipeline stage boundaries are fully implemented: `BranchTraversalPlanner`,
  `CommitTraversalExtractor`, `FileChangeExpander`, projector split, and
  `DefaultExtractionCoordinator` orchestration.
- Stage-aligned profiling (`--profile`) with hierarchical `profilingEntries` output including
  `elapsed/*` scoped timings.
- Phase-aware progress UX with stable stage lines (`Preparing extraction`, `Extracting history`,
  `Finalizing output`) and completion summary including `Commits traversed`.

### Changed

- `--mode snapshot|incremental` replaced by boolean `--incremental` flag. Snapshot is now the default; incremental mode is activated by passing `--incremental`. The `-m` alias is removed.
- `--output-mode commit|file` replaced by boolean `--per-file` flag. Commit granularity is now the default; file granularity is activated by passing `--per-file`.
- `--on-missing-state error|snapshot` renamed to `--missing-state error|snapshot`. Behavior is unchanged.

### Fixed

- `--quiet` behavior is aligned with the final stderr contract: progress-stage lines, completion
  summary, and profile block are suppressed while warnings and errors remain visible.
- Runtime edge wiring now constructs the coordinator pipeline directly; the `Extractor`
  compatibility facade and checkpoint-vocabulary compatibility aliases are removed.

### Migration

The three renamed parameters are not backwards-compatible. The old flag names (`--mode`, `--output-mode`, `--on-missing-state`) are **silently ignored** by the CLI parser — no error is emitted, but the intended behavior will not take effect. Update any scripts or pipelines that use these flags.

| Before (≤ v0.3.0)                    | After (v0.4.0)                    | Notes                                           |
| ------------------------------------ | --------------------------------- | ----------------------------------------------- |
| `--mode incremental`                 | `--incremental`                   | Boolean flag; snapshot is the default (no flag) |
| `--mode snapshot`                    | _(omit flag)_                     | Snapshot is now the default                     |
| `-m snapshot` / `-m incremental`     | `-m` removed                      | `-m` alias no longer exists                     |
| `--output-mode file`                 | `--per-file`                      | Boolean flag; commit granularity is the default |
| `--output-mode commit`               | _(omit flag)_                     | Commit granularity is now the default           |
| `--on-missing-state error\|snapshot` | `--missing-state error\|snapshot` | Renamed; values and semantics unchanged         |

**Rationale:**

- `--incremental` and `--per-file` replace multi-value string flags with booleans because the flags represent on/off choices, not selections from an open-ended set. Boolean flags are idiomatic for this pattern.
- `--missing-state` drops the `on-` prefix for consistency with the new style and to match the noun-first naming convention used by `--state`.

---

## [0.3.0] - 2026-04-20

### Added

- `--output-mode commit|file` flag (default `commit`). In `file` mode, each output record represents one changed file within a commit, carrying full commit metadata (denormalized) plus a `file` object with `path`, `status` (`"added"`, `"modified"`, or `"deleted"`), `additions`, and `deletions`. Binary files produce `additions: null` and `deletions: null`. Empty commits produce no output records.
- `diff` npm package added as a runtime dependency (BSD-3-Clause), used for per-file line-level diff statistics in `--output-mode file`.

### Changed

- Progress output now reads "Processed N records…" (previously "Processed N commits…"). In commit mode the count is equivalent; in file mode, N reflects the number of file-level records written.
- Summary output now shows "Records written :" (previously "Commits written :").
- `ExtractionResult.commitsWritten` renamed to `recordsWritten` (internal TypeScript type only; not serialized to any output file). Affects only callers that import and inspect this type programmatically.
- `erasableSyntaxOnly: true` added to `tsconfig.json`. Compile-time constraint only; no runtime effect.

---

## [0.2.0] - 2026-04-17

### Added

- `--mode snapshot|incremental` flag to select extraction mode explicitly (`-m` alias)
- `--on-missing-state error|snapshot` flag to control behavior when the state file is absent in incremental mode
- Shorthand aliases for all major flags: `-m` (--mode), `-b` (--branch), `-o` (--output-dir), `-s` (--state), `-q` (--quiet)
- Cross-run deduplication for newly added branches in incremental mode: when a branch appears for the first time, gitrail computes the merge base with already-extracted branches and uses it as the commit boundary, preventing duplicate output
- Output filenames now include a session timestamp segment (`{prefix}-{timestamp}-{seq}.jsonl`), preventing files from different runs from overwriting each other

### Changed

- **Breaking:** `--since-commit` is renamed to `--since-ref`. The new flag accepts a tag name, branch name, or full commit hash (any ref resolvable via `git rev-parse`). Passing `--since-commit` now exits with an unknown-argument error.
- **Breaking:** The presence of `--state` alone no longer implies incremental mode. Extraction mode must be specified explicitly with `--mode incremental`. Running without `--mode` defaults to `snapshot`, which ignores existing state content and overwrites the state file on success.
- Output filename format changed from `{prefix}-{seq}.jsonl` to `{prefix}-{timestamp}-{seq}.jsonl`. Files written by older versions of gitrail will not be overwritten, but the new filename pattern should be reflected in any downstream ingestion configuration.

### Migration

#### `--since-commit` → `--since-ref`

Replace all occurrences of `--since-commit` with `--since-ref`. The argument semantics are a strict superset: any commit hash that was valid for `--since-commit` is also valid for `--since-ref`.

Before:

```bash
gitrail -b main --since-commit abc123def456 ./my-repo
```

After:

```bash
gitrail -b main --since-ref abc123def456 ./my-repo
# or use a tag or branch name directly
gitrail -b main --since-ref v1.0 ./my-repo
```

#### Explicit `--mode` required for incremental extraction

If you were relying on `--state` to implicitly enable incremental mode, add `--mode incremental` to your command:

Before:

```bash
gitrail -b main -s ./gitrail-state.json ./my-repo
```

After:

```bash
gitrail -m incremental -b main -s ./gitrail-state.json ./my-repo
```

If your intent was to record state without differential extraction (snapshot with state recording), the old command behavior is now the explicit default — no change needed other than confirming you do not pass `--mode incremental`.

---

## [0.1.4] - 2026-04-14

### Added

- Lightweight runtime progress reporting and a completion summary on stderr
- `--quiet` mode for CI, cron, and other scripted runs

### Fixed

- CLI help output now shows the supported arguments and descriptions correctly

### Changed

- Switched the project linter from ESLint to oxlint as part of repository maintenance
- Release messaging and packaging flow were validated through this small documentation-focused release

## [0.1.0] - 2026-04-10

### Added

- Initial release
- Extract Git commit history to JSON Lines (JSONL) format
- Support for multi-branch extraction with cross-branch deduplication
- Incremental (differential) extraction via `--state` file
- Differential extraction via `--since-commit` or `--since-date`
- Output file rotation by line count (`--rotate-lines`) or byte size (`--rotate-size`)
- Automatic `--output-prefix` derivation from remote origin URL
- Timestamp output in ISO 8601 format with commit's own timezone offset
- No system-installed Git required (uses isomorphic-git)

[0.6.1]: https://github.com/gitlode/gitlode/releases/tag/v0.6.1
[0.6.0]: https://github.com/gitlode/gitlode/releases/tag/v0.6.0
[0.5.0]: https://github.com/gitlode/gitlode/releases/tag/v0.5.0
[0.4.1]: https://github.com/gitlode/gitlode/releases/tag/v0.4.1
[0.4.0]: https://github.com/gitlode/gitlode/releases/tag/v0.4.0
[0.3.0]: https://github.com/gitlode/gitlode/releases/tag/v0.3.0
[0.2.0]: https://github.com/gitlode/gitlode/releases/tag/v0.2.0
[0.1.4]: https://github.com/gitlode/gitlode/releases/tag/v0.1.4
[0.1.0]: https://github.com/gitlode/gitlode/releases/tag/v0.1.0
