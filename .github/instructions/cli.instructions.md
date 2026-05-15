---
description: CLI interface specification for gitrail
applyTo: "src/cli/**"
---

# CLI Interface Specification

## Command Signature

```bash
gitrail [options] <repository-path>
```

`<repository-path>` is a positional argument — the local filesystem path to the target Git repository.

---

## Parameter Reference

### Positional

| Parameter           | Type   | Required | Description                      |
| ------------------- | ------ | -------- | -------------------------------- |
| `<repository-path>` | string | ✅       | Local path to the Git repository |

### Extraction Mode

| Parameter        | Alias | Type                | Required | Default | Description                                                                                                                                    |
| ---------------- | ----- | ------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `--incremental`  |       | boolean             |          | `false` | When present, extract only commits new since the last recorded state. When absent, perform a snapshot extraction independently of prior state. |
| `--branch <ref>` | `-b`  | string (repeatable) | ✅       |         | Ref to use as traversal starting point. May be specified multiple times.                                                                       |

Snapshot extraction is the default mode (no flag needed). The term "snapshot" is used in
documentation and `--missing-state=snapshot` to name this extraction model, but it is no longer a
CLI parameter value.

`--branch` must be specified at least once. There is no default. Accepting multiple values:

```bash
gitrail --branch main --branch develop ./my-repo
gitrail -b main -b develop ./my-repo
```

### Range Filter (snapshot mode only)

| Parameter                | Type   | Description                                                                                                          |
| ------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `--since-ref <ref>`      | string | Exclude commits reachable from this ref. Accepts commit hash, tag name, or branch name. Resolved via `resolveRef()`. |
| `--since-date <ISO8601>` | string | Include only commits with committer timestamp after this datetime.                                                   |

These parameters are only valid in snapshot mode (no `--incremental` flag). They are mutually exclusive with `--incremental`.

### State Management

| Parameter                           | Alias | Type                | Default                             | Description                                                                                                                                                                                                     |
| ----------------------------------- | ----- | ------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--state <path>`                    | `-s`  | string              |                                     | Path to state file. In snapshot mode, state content is ignored but file is updated on success. In incremental mode, state is read to determine differential range. Required when `--incremental`.               |
| `--missing-state <error\|snapshot>` |       | `error \| snapshot` | `error` (when `--incremental` used) | Behavior when `--incremental` is used and the state file does not exist. `error`: exit with code 1. `snapshot`: warn and fall back to full extraction, then create state file. Only valid with `--incremental`. |

### Output

| Parameter                  | Alias | Type    | Default                    | Description                                                                                                                       |
| -------------------------- | ----- | ------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `--output-dir <path>`      | `-o`  | string  | `./`                       | Directory to write output `.jsonl` files. Must exist.                                                                             |
| `--output-prefix <string>` |       | string  | derived from remote origin | Filename prefix for output files.                                                                                                 |
| `--per-file`               |       | boolean | `false`                    | When present, emit one record per changed file within each commit. When absent, emit one record per commit (default granularity). |

**`--output-prefix` derivation logic** (when not specified):

1. Fetch remote URL for `origin` via `GitAdapter.getRemoteUrl()`
2. Extract the last path segment, strip `.git` suffix → use as prefix
   - `https://github.com/org/my-repo.git` → `my-repo`
   - `git@github.com:org/my-repo.git` → `my-repo`
3. If remote URL is unavailable → use the directory name of `<repository-path>`
4. If `--output-prefix` is explicitly provided → use that value (highest priority)

### File Rotation

| Parameter               | Type   | Default | Description                             |
| ----------------------- | ------ | ------- | --------------------------------------- |
| `--rotate-lines <n>`    | number | none    | Start a new output file after `n` lines |
| `--rotate-size <bytes>` | number | none    | Start a new output file after `n` bytes |

Both may be specified simultaneously — rotation triggers when **either** threshold is reached.

### Control

| Parameter   | Alias | Type    | Default | Description                                                                                                                         |
| ----------- | ----- | ------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `--quiet`   | `-q`  | boolean | `false` | Suppress progress, summary, and profile output on stderr. Warnings and errors are still emitted.                                    |
| `--profile` |       | boolean | `false` | Print per-stage timing information as an aligned multi-line block to stderr after a successful extraction. Suppressed by `--quiet`. |

### Successful-Run Stderr Contract

When `--quiet` is not set and extraction succeeds, stderr output is fixed as follows:

1. Zero or more warning lines, if applicable.
2. A three-stage progress history:

- `Preparing extraction`
- `Extracting history`
- `Finalizing output`

3. An aligned completion summary block.
4. When `--profile` is set, an aligned profile block after a single blank line.

TTY-aware rendering is a CLI-edge concern. When `process.stderr.isTTY === true`, the stage lines
are rendered in place using a braille spinner and the canonical layouts below:

```text
⠋ Preparing extraction  0.3s
⠙ Extracting history  branch 2/3  commits 1542  records 3108  1.2 MB  8.5s
⠹ Finalizing output  0.8s
```

The active line is the only line that updates in place. When a stage completes, the spinner is
removed and the completed stage label is re-emitted in the same column with two leading spaces so
the label column stays aligned:

```text
  Preparing extraction  0.3s
  Extracting history  branch 3/3  commits 1542  records 3108  1.2 MB  8.5s
  Finalizing output  0.8s
```

The extracting line always renders fields in this order: spinner frame, stage label, branch
position, `commits traversed`, `records written`, humanized `bytes written`, and elapsed time.
The preparing and finalizing lines render only spinner + elapsed while active.

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

The default completion summary block uses this field order:

- `Records written`
- `Commits traversed`
- `Files created`
- `Bytes written`
- `Elapsed time`
- `Branches`

The aligned completion summary block has the following canonical layout, including zero-record
successful runs:

```text
Extraction complete
  Records written   : 3108
  Commits traversed : 1542
  Files created     : 524
  Bytes written     : 1.2 MB
  Elapsed time      : 8.5s
  Branches          : main, develop
```

The default summary remains distinct from profiling output. Per-stage timings stay exclusive to
`--profile` and are not promoted into the normal successful-run summary.

If a warning interrupts an in-place progress line, the warning is printed on its own line and the
active stage line is then redrawn.

---

## Mutual Exclusion Rules

The following combinations are invalid and must produce a clear error message before any processing begins:

| Combination                               | Error Message                                          |
| ----------------------------------------- | ------------------------------------------------------ |
| `--since-ref` + `--since-date`            | `--since-ref and --since-date cannot be used together` |
| `--incremental` + `--since-ref`           | `--since-ref cannot be used with --incremental`        |
| `--incremental` + `--since-date`          | `--since-date cannot be used with --incremental`       |
| `--missing-state` without `--incremental` | `--missing-state is only valid with --incremental`     |
| `--incremental` + no `--state`            | `--state is required when using --incremental`         |

`--state` + `--since-*` is **permitted** in snapshot mode (no `--incremental`). `--state` serves
only as a write-only recording path in that context; `--since-*` controls the extraction range
independently.

---

## Validation Rules

All validation must complete before extraction and file output begin. Validation proceeds in three phases:

1. **Format / mutual exclusion** — no I/O (mutual exclusion rules, branch count, `--missing-state` value, numeric arg formats, ISO 8601 format for `--since-date`)
2. **File system** — `<repository-path>` existence, `--output-dir` existence, `--state` parent directory existence, `--state` file existence check (result passed to subsequent logic)
3. **Git** — repository identity (`resolveRef` on first branch), each `--branch` ref resolution, `--since-ref` resolution via `resolveRef()`, state file content validation (JSON structure, `version`, `repositoryPath` match)

**Validation stage 2 — state file existence handling for incremental mode:**

- If `--incremental` and state file does not exist:
  - `--missing-state error` (default when absent) → exit with code 1
  - `--missing-state snapshot` → emit warning to stderr, set fallback flag (behave as snapshot with no range filter)

| Condition                                                     | Phase | Error                                                                                 |
| ------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------- |
| `<repository-path>` does not exist                            | 2     | `Repository not found: <path>`                                                        |
| `<repository-path>` is not a Git repository                   | 3     | `Not a Git repository: <path>`                                                        |
| `--branch` not specified                                      | 1     | `At least one --branch must be specified`                                             |
| `--missing-state` value invalid                               | 1     | `--missing-state must be "error" or "snapshot"`                                       |
| `--output-dir` does not exist                                 | 2     | `Output directory not found: <path>`                                                  |
| `--state` parent directory does not exist                     | 2     | `Parent directory for state file not found: <dir>`                                    |
| `--since-date` is not valid ISO 8601                          | 1     | `Invalid date format for --since-date. Expected ISO 8601 (e.g. 2024-01-01T00:00:00Z)` |
| `--since-ref` ref not found in repository                     | 3     | `Ref not found: <ref>`                                                                |
| `--rotate-lines` or `--rotate-size` is not a positive integer | 1     | `<param> must be a positive integer`                                                  |
| State file `repositoryPath` mismatch                          | 3     | `State file was created for a different repository: <recorded-path>`                  |

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
gitrail --branch main ./my-repo
gitrail -b main ./my-repo

# Multiple branches, custom output dir
gitrail -b main -b develop -o ./output ./my-repo

# Snapshot with state recording (for later incremental runs)
gitrail --branch main --state ./gitrail-state.json ./my-repo

# Incremental run using state file
gitrail --incremental --branch main --state ./gitrail-state.json ./my-repo
gitrail --incremental -b main -s ./gitrail-state.json ./my-repo

# Incremental with auto-initialization on first run (fall back to full snapshot if no state)
gitrail --incremental -b main -s ./gitrail-state.json --missing-state snapshot ./my-repo

# Snapshot from a release tag (extract only commits after v1.0)
gitrail --branch main --since-ref v1.0 ./my-repo

# Snapshot from a release tag with state recording
gitrail -b main -b develop --since-ref v1.0 -s ./gitrail-state.json ./my-repo

# Time-based snapshot
gitrail --branch main --since-date 2024-01-01T00:00:00Z ./my-repo

# File-granularity output (one record per changed file per commit)
gitrail --per-file -b main ./my-repo

# Successful-run profiling output on stderr
gitrail --profile -b main ./my-repo

# With file rotation
gitrail -b main --rotate-lines 10000 --rotate-size 104857600 ./my-repo
```

---

## CLI Framework

**[commander](https://github.com/tj/commander.js)** — decided and in use as of v0.4.1 (migrated from citty). TypeScript-compatible, zero legacy overhead, native strict-mode unknown-option detection, native repeatable option support.

---

## Unknown Option Behavior

Unknown options (flags not registered in the command definition) are a **hard error** in gitrail. This behavior mirrors mainstream CLI conventions and git's own fatal-on-unknown-option policy.

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
- Values for recognized options (e.g. `main` in `--branch main`)
- Repeated recognized options (e.g. `--branch main --branch develop`)
- Short alias forms (`-b`, `-o`, `-s`, `-q`)

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

### `--branch` / `-b` repeatable option

commander handles repeatable options natively via the accumulator pattern:

```typescript
.option('-b, --branch <ref>', 'description', (val, prev: string[]) => [...prev, val], [])
```

The resulting value is `string[]`. No manual pre-scan of `process.argv` is needed.
