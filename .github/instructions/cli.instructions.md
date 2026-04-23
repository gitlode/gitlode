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

| Parameter | Alias | Type    | Default | Description                                    |
| --------- | ----- | ------- | ------- | ---------------------------------------------- |
| `--quiet` | `-q`  | boolean | `false` | Suppress progress and summary output on stderr |

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

**Phase 2 — state file existence handling for incremental mode:**

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

# With file rotation
gitrail -b main --rotate-lines 10000 --rotate-size 104857600 ./my-repo
```

---

## CLI Framework

**[citty](https://github.com/unjs/citty)** — decided and in use. TypeScript-native, zero legacy overhead.

---

## Implementation Notes

### `--branch` / `-b` multi-occurrence workaround

citty only retains the **last** occurrence when a string flag appears multiple times. Because `--branch` must be repeatable, all `--branch` and `-b` values are collected by manually scanning `process.argv` **before** delegating to `parseCittyArgs`. citty then parses everything else.

```typescript
const branches: string[] = [];
for (let i = 0; i < rawArgv.length; i++) {
  if (rawArgv[i] === "--branch" || rawArgv[i] === "-b") {
    const val = rawArgv[i + 1];
    if (val !== undefined && !val.startsWith("-")) {
      branches.push(val);
      i++;
    }
  } else if (rawArgv[i]?.startsWith("--branch=")) {
    const val = rawArgv[i]!.slice("--branch=".length);
    if (val) branches.push(val);
  }
}
```

### `cmdDefinition` export

`src/cli/args.ts` exports `cmdDefinition` — a `defineCommand` descriptor with `meta` and `args` but no `run()`. This object is spread into the `defineCommand` call in `src/index.ts` so that citty can populate `--help` output with all argument descriptions:

```typescript
// src/index.ts
import { cmdDefinition } from "./cli/index.js";

const main = defineCommand({
  ...cmdDefinition, // brings in meta + args
  async run() { ... },
});
```

This separation keeps argument definitions co-located with `parseArgs` while allowing the entry point to own the `run()` implementation.
