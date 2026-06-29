# CLI Interface Design

## Purpose

This document is the canonical developer-facing contract for the gitlode CLI interface. It covers
command shape, options, validation, stderr behavior, exit codes, and implementation notes.

End-user workflows and examples belong in [`../usage.md`](../usage.md). Configuration-file shape and
precedence details that are not specific to CLI adaptation belong in [`configuration.md`](configuration.md).

CLI behavior rules belong in this document. Agent-specific files such as `AGENTS.md` and
`.github/instructions/cli.instructions.md` may summarize, route to, or add guardrails around this
document, but they do not replace it and must not be treated as independent sources of truth for CLI
contracts.

## Command Signature

```bash
gitlode [options] <repository-path>
```

`<repository-path>` is a positional argument — the local filesystem path to the target Git repository.

---

## Parameter Reference

### Help Option Groups

`gitlode --help` uses commander 14 native option grouping. The grouped option sections and
assignments are:

| Group                              | Options                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Required Input`                   | `--ref`                                                                                         |
| `Runtime and Diagnostics`          | `--quiet`, `--profile`                                                                          |
| `Output and Repository Metadata`   | `--output-dir`, `--output-prefix`, `--per-file`, `--max-diff-size`, `--repo-name`, `--repo-url` |
| `Extraction Range (Snapshot Mode)` | `--since-ref`, `--since-date`                                                                   |
| `Incremental Extraction`           | `--incremental`, `--state`, `--missing-state`                                                   |
| `File Rotation`                    | `--rotate-lines`, `--rotate-size`                                                               |
| `Configuration File`               | `--config`                                                                                      |

`<repository-path>` remains a positional argument in the synopsis.

### Positional

| Parameter           | Type   | Required | Description                      |
| ------------------- | ------ | -------- | -------------------------------- |
| `<repository-path>` | string | ✅       | Local path to the Git repository |

### Extraction Mode

| Parameter       | Alias | Type                | Required | Default | Description                                                                                                                                                                   |
| --------------- | ----- | ------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--incremental` |       | boolean             |          | `false` | When present, extract only commits new since the last recorded state. When absent, perform a snapshot extraction independently of prior state.                                |
| `--ref <ref>`   | `-r`  | string (repeatable) |          |         | Ref to use as traversal starting point. Accepts branch name, tag, or commit object ID. May be specified multiple times. Required unless provided by config `extraction.refs`. |

Snapshot extraction is the default mode (no flag needed). The term "snapshot" is used in
documentation and `--missing-state=snapshot` to name this extraction model, but it is no longer a
CLI parameter value.

`--ref` accepts multiple values. When absent, refs may come from config `extraction.refs`.
If neither source provides refs, validation fails with `At least one --ref must be specified`.

Accepting multiple values:

```bash
gitlode --ref main --ref develop ./my-repo
gitlode -r main -r develop ./my-repo
```

### Range Filter (snapshot mode only)

| Parameter                | Type   | Description                                                                                                                     |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `--since-ref <ref>`      | string | Exclude commits reachable from this ref. Accepts commit object ID (OID), tag name, or branch name. Resolved via `resolveRef()`. |
| `--since-date <ISO8601>` | string | Include only commits with committer timestamp after this datetime.                                                              |

These parameters are only valid in snapshot mode (no `--incremental` flag). They are mutually exclusive with `--incremental`.

### State Management

| Parameter                           | Alias | Type                | Default                             | Description                                                                                                                                                                                                     |
| ----------------------------------- | ----- | ------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--state <path>`                    | `-s`  | string              |                                     | Path to state file. In snapshot mode, state content is ignored but file is updated on success. In incremental mode, state is read to determine differential range. Required when `--incremental`.               |
| `--missing-state <error\|snapshot>` |       | `error \| snapshot` | `error` (when `--incremental` used) | Behavior when `--incremental` is used and the state file does not exist. `error`: exit with code 1. `snapshot`: warn and fall back to full extraction, then create state file. Only valid with `--incremental`. |

### Output and Repository Metadata

| Parameter                  | Alias | Type    | Default                    | Description                                                                                                                                                                        |
| -------------------------- | ----- | ------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--output-dir <path>`      | `-o`  | string  | `./`                       | Directory to write output `.jsonl` files. Must exist.                                                                                                                              |
| `--output-prefix <string>` |       | string  | derived from remote origin | Filename prefix for output files.                                                                                                                                                  |
| `--per-file`               |       | boolean | `false`                    | When present, emit one record per changed file within each commit. When absent, emit one record per commit (default granularity).                                                  |
| `--max-diff-size <value>`  |       | string  | disabled                   | Skip line-level diff computation for files exceeding this size (accepts bytes or `K`/`M`/`G`). Emits `null` additions/deletions for skipped files. Applies only with `--per-file`. |
| `--repo-name <string>`     |       | string  | —                          | Override `repository.name` in all output records. Does not affect state-file identity or incremental behavior.                                                                     |
| `--repo-url <string>`      |       | string  | —                          | Override `repository.url` in all output records. Does not affect state-file identity or incremental behavior.                                                                      |

**`--output-prefix` derivation logic** (when not specified):

1. Fetch remote URL for `origin` via `GitAdapter.getRemoteUrl()`
2. Extract the last path segment, strip `.git` suffix → use as prefix
   - `https://github.com/org/my-repo.git` → `my-repo`
   - `git@github.com:org/my-repo.git` → `my-repo`
3. If remote URL is unavailable → use the directory name of `<repository-path>`
4. If `--output-prefix` is explicitly provided → use that value (highest priority)

### File Rotation

| Parameter               | Type          | Default | Description                                                                                                                                                                                                                                                              |
| ----------------------- | ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--rotate-lines <n>`    | number        | none    | Start a new output file after `n` lines                                                                                                                                                                                                                                  |
| `--rotate-size <value>` | bytes or size | none    | Start a new output file after `n` bytes. Accepts a plain integer (bytes) or an integer with suffix `K`, `M`, or `G` (binary: 1K=1024, 1M=1048576, 1G=1073741824). Suffixes are case-insensitive. Minimum: `1M` (1,048,576 bytes). Maximum: `64G` (68,719,476,736 bytes). |

Both may be specified simultaneously — rotation triggers when **either** threshold is reached.

### Control

| Parameter   | Alias | Type    | Default | Description                                                                                                                         |
| ----------- | ----- | ------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `--quiet`   | `-q`  | boolean | `false` | Suppress progress, summary, and profile output on stderr. Warnings and errors are still emitted.                                    |
| `--profile` |       | boolean | `false` | Print per-stage timing information as an aligned multi-line block to stderr after a successful extraction. Suppressed by `--quiet`. |

### Configuration File

| Parameter         | Alias | Type   | Default | Description                                                                                                                                                                                                              |
| ----------------- | ----- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--config <path>` | `-c`  | string | —       | Path to the gitlode configuration file. When provided, enables config-backed defaults (`extraction`, `output`, `repository`, `runtime`) and optional plugin enrichment (`extensions`). Path is resolved relative to CWD. |

Config root contract for `version: 1`:

- Strict root object (`additionalProperties: false`)
- Allowed sections: `extraction`, `output`, `repository`, `runtime`, `extensions`
- Unknown keys at root or section level are user errors
- `extensions` is optional; when present it must be non-empty

Precedence model:

- Scalar/path defaults: `CLI explicit value > config value > built-in default`
- Refs: any CLI `--ref` replaces config `extraction.refs` (no merge)
- Snapshot range: CLI `--since-ref` / `--since-date` replaces config `extraction.range` as a whole
- Rotation thresholds resolve independently per field (`lines`, `size`)
- Profile is enabled when `CLI --profile OR config runtime.profile`

### Successful-Run Stderr Contract

When `--quiet` is not set and extraction succeeds, stderr output is fixed as follows:

1. Zero or more warning lines, if applicable.
2. A three-stage progress history:

- `Preparing extraction`
- `Extracting history`
- `Finalizing output`

3. An aligned completion summary block.
4. When `--profile` is set, an aligned profile block after a single blank line.

TTY-aware rendering is a CLI-edge concern. When `process.stderr.isTTY === true`, chalk-based
color styling is applied (spinner, done marker, stage labels, field keys, values, units, refs, and
severity badges). When `process.stderr.isTTY === false`, styling is disabled and the same text
content is emitted with no ANSI escape sequences.

When `process.stderr.isTTY === true`, the stage lines are rendered in place using a braille spinner:

```text
⠋ Preparing extraction  0.3s
⠙ Extracting history  branch 2/3  commits 1542  records 3108  1.2MB  8.5s
⠹ Finalizing output  0.8s
```

The active line is the only line that updates in place. When a stage completes, the spinner is
removed and the `✓` done marker is placed in the spinner column with a trailing space:

```text
✓ Preparing extraction  0.3s
✓ Extracting history  branch 3/3  commits 1542  records 3108  1.2MB  8.5s
✓ Finalizing output  0.8s
```

Measured values use no-space `number+unit` tokens (e.g. `1.2MB`, `8.5s`, `12.34ms`).
The numeric part is rendered with primary-value emphasis; the unit suffix is rendered with dim styling.

The extracting line always renders fields in this order: spinner/done frame, stage label, branch
position, `commits traversed`, `records written`, humanized `bytes written`, and elapsed time.
The preparing and finalizing lines render only spinner/done + elapsed while active.

When `process.stderr.isTTY === false`, the CLI suppresses the stage heartbeat UI entirely and emits
only warnings and the final summary block. This non-TTY behavior is intentional and is not treated
as a fallback error.

Only the currently active stage line may update in place. Completed stage lines remain visible.
Every active stage must emit a liveness signal even when semantic counters are not changing. Phase
7's chosen liveness signal is `spinner + elapsed`, with a silence budget of at most `1s` between
visible updates while a stage is actively running.

The active stage line updates at most once per second during steady-state work, plus immediate
updates on stage transitions, semantic progress changes, warning recovery redraws, and final
completion.

`Preparing extraction` and `Finalizing output` therefore also refresh while active, even though
they do not expose quantitative counters.

The `Extracting history` line includes these fields, in this order:

- spinner frame and stage label
- `branch <current>/<total>`
- `commits traversed`
- `records written`
- humanized `bytes written`
- `elapsed`

The `Preparing extraction` and `Finalizing output` lines show the spinner, stage label, and
elapsed time while active.

Warning lines are prefixed with `[WARN] ` in both TTY and non-TTY modes. In TTY mode, the badge
is styled with `chalk.yellow.bold`; the message body uses default foreground.

The default completion summary block uses this field order:

- `Records written`
- `Commits traversed`
- `Files created`
- `Bytes written`
- `Elapsed time`
- `Refs`

The aligned completion summary block has the following canonical layout, including zero-record
successful runs:

```text
Extraction complete
  Records written   : 3108
  Commits traversed : 1542
  Files created     : 524
  Bytes written     : 1.2MB
  Elapsed time      : 8.5s
  Refs              : main, develop
```

The default summary remains distinct from profiling output. Per-stage timings stay exclusive to
`--profile` and are not promoted into the normal successful-run summary.

If a warning interrupts an in-place progress line, the warning is printed on its own line and the
active stage line is then redrawn.

---

## Mutual Exclusion Rules

The following combinations are invalid and must produce a clear error message before any processing begins:

| Combination                                 | Error Message                                               |
| ------------------------------------------- | ----------------------------------------------------------- |
| `--since-ref` + `--since-date`              | `--since-ref and --since-date cannot be used together`      |
| `--incremental` + `--since-ref`             | `--since-ref cannot be used with --incremental`             |
| `--incremental` + `--since-date`            | `--since-date cannot be used with --incremental`            |
| `--missing-state` without `--incremental`   | `--missing-state is only valid with --incremental`          |
| `--incremental` + no `--state`              | `--state is required when using --incremental`              |
| config `extraction.range` + `--incremental` | `Config extraction.range cannot be used with --incremental` |

`--state` + `--since-*` is **permitted** in snapshot mode (no `--incremental`). `--state` serves
only as a write-only recording path in that context; `--since-*` controls the extraction range
independently.

---

## Validation Rules

All validation must complete before extraction and file output begin. Validation proceeds in five phases:

1. **CLI format / mutual exclusion** — no file reads (`--missing-state` value, CLI mutual exclusions, numeric formats, ISO 8601 for CLI `--since-date`)
2. **Config load/schema validation** (`--config` only) — read JSON, validate strict `version: 1` schema, normalize config-relative paths
3. **CLI/config merge + conflict checks** — effective refs/range/profile/output/repository/rotation resolution, required-effective-ref check, config-range + incremental fail-fast rule
4. **File system** — `<repository-path>` existence, effective output directory existence, `--state` parent directory existence, state-file presence checks for incremental mode
5. **Git** — repository identity (`resolveRef` on first effective ref), repository object-format compatibility gate, effective `since-ref` resolution, state file content validation (JSON structure, `version`, `repositoryPath` match)

**Validation stage 2 — state file existence handling for incremental mode:**

- If `--incremental` and state file does not exist:
  - `--missing-state error` (default when absent) → exit with code 1
  - `--missing-state snapshot` → emit warning to stderr, set fallback flag (behave as snapshot with no range filter)

| Condition                                     | Phase | Error                                                                                                   |
| --------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------- |
| `<repository-path>` does not exist            | 2     | `Repository not found: <path>`                                                                          |
| `<repository-path>` is not a Git repository   | 5     | `Not a Git repository: <path>`                                                                          |
| no effective refs after CLI/config merge      | 3     | `At least one --ref must be specified`                                                                  |
| `--missing-state` value invalid               | 1     | `--missing-state must be "error" or "snapshot"`                                                         |
| effective output directory does not exist     | 4     | `Output directory not found: <path>`                                                                    |
| `--state` parent directory does not exist     | 4     | `Parent directory for state file not found: <dir>`                                                      |
| `--since-date` is not valid ISO 8601          | 1     | `Invalid date format for --since-date. Expected ISO 8601 (e.g. 2024-01-01T00:00:00Z)`                   |
| effective `since-ref` not found in repository | 5     | `Ref not found: <ref>`                                                                                  |
| `--rotate-lines` is not a positive integer    | 1     | `--rotate-lines must be a positive integer`                                                             |
| `--rotate-size` has invalid format            | 1     | `--rotate-size must be a positive integer (bytes) or an integer with suffix K, M, or G (e.g. 500M, 1G)` |
| `--rotate-size` value is out of range         | 1     | `--rotate-size must be between 1048576 and 68719476736 bytes`                                           |
| config `extraction.range` + `--incremental`   | 3     | `Config extraction.range cannot be used with --incremental`                                             |
| Repository object format unsupported          | 5     | `Unsupported repository object format: <format>. Supported formats: <supported-list>.`                  |
| State file `repositoryPath` mismatch          | 5     | `State file was created for a different repository: <recorded-path>`                                    |

---

## Exit Codes

| Code | Meaning                                            |
| ---- | -------------------------------------------------- |
| `0`  | Success                                            |
| `1`  | User error (invalid arguments, validation failure) |
| `2`  | Runtime error (I/O failure, unexpected Git error)  |

---

## Usage Examples

```bash
# Snapshot extraction of main branch (default mode — no flag needed)
gitlode --ref main ./my-repo
gitlode -r main ./my-repo

# Multiple branches, custom output dir
gitlode -r main -r develop -o ./output ./my-repo

# Snapshot with state recording (for later incremental runs)
gitlode --ref main --state ./gitlode-state.json ./my-repo

# Incremental run using state file
gitlode --incremental --ref main --state ./gitlode-state.json ./my-repo
gitlode --incremental -r main -s ./gitlode-state.json ./my-repo

# Incremental with auto-initialization on first run (fall back to full snapshot if no state)
gitlode --incremental -r main -s ./gitlode-state.json --missing-state snapshot ./my-repo

# Snapshot from a release tag (extract only commits after v1.0)
gitlode --ref main --since-ref v1.0 ./my-repo

# Snapshot from a release tag with state recording
gitlode -r main -r develop --since-ref v1.0 -s ./gitlode-state.json ./my-repo

# Time-based snapshot
gitlode --ref main --since-date 2024-01-01T00:00:00Z ./my-repo

# File-granularity output (one record per changed file per commit)
gitlode --per-file -r main ./my-repo

# Successful-run profiling output on stderr
gitlode --profile -r main ./my-repo

# With file rotation (plain bytes or human-readable suffix)
gitlode -r main --rotate-lines 10000 --rotate-size 104857600 ./my-repo
gitlode -r main --rotate-lines 10000 --rotate-size 100M ./my-repo
```

---

## CLI Framework

**[commander](https://github.com/tj/commander.js)** — decided and in use as of v0.4.1 (migrated from citty). TypeScript-compatible, zero legacy overhead, native strict-mode unknown-option detection, native repeatable option support.

---

## Unknown Option Behavior

Unknown options (flags not registered in the command definition) are a **hard error** in gitlode. This behavior mirrors mainstream CLI conventions and git's own fatal-on-unknown-option policy.

### Error output

```
Unknown option: --<flag>
```

Written to stderr. No `"error:"` or `"fatal:"` prefix — consistent with the existing user-error message style.

### Exit code

`1` — same as all other user-input validation errors.

### Scope of the check

The following are **not** flagged as unknown options:

- `--` (terminates option parsing; tokens after `--` are treated as positional arguments)
- The positional `<repository-path>` argument
- Values for recognized options (e.g. `main` in `--ref main`)
- Repeated recognized options (e.g. `--ref main --ref develop`)
- Short alias forms (`-r`, `-o`, `-s`, `-q`)

### Interaction with `--quiet`

Unknown option errors are **not** suppressed by `--quiet`. A silent typo with `--quiet` would be the hardest failure mode to diagnose.

### Typo suggestion

Edit-distance heuristics (suggesting the closest known option name) are **not implemented**. Deferred as a follow-up roadmap item.

---

## Implementation Notes

### `program` export

`src/cli/args.ts` exports a module-level `Command` instance named `program`. This object defines all option and argument metadata and is used in two places:

- `parseArgs()` — calls `program.parse(process.argv)`
- `cmd-definition.test.ts` — inspects registered options and arguments without calling `parseArgs()`

### `--ref` / `-r` repeatable option

commander handles repeatable options natively via the accumulator pattern:

```typescript
.option('-r, --ref <ref>', 'description', (val, prev: string[]) => [...prev, val], [])
```

The resulting value is `string[]`. No manual pre-scan of `process.argv` is needed.
