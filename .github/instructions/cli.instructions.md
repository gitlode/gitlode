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

### Branch Selection

| Parameter        | Type   | Required | Description                                                                             |
| ---------------- | ------ | -------- | --------------------------------------------------------------------------------------- |
| `--branch <ref>` | string | ✅       | Ref (branch name) to use as traversal starting point. Repeatable for multiple branches. |

`--branch` must be specified at least once. There is no default. Accepting multiple values:

```bash
gitrail --branch main --branch develop ./my-repo
```

### Output

| Parameter                  | Type   | Required | Default                    | Description                              |
| -------------------------- | ------ | -------- | -------------------------- | ---------------------------------------- |
| `--output-dir <path>`      | string |          | `./`                       | Directory to write output `.jsonl` files |
| `--output-prefix <string>` | string |          | derived from remote origin | Filename prefix for output files         |

**`--output-prefix` derivation logic** (when not specified):

1. Fetch remote URL for `origin` via `GitAdapter.getRemoteUrl()`
2. Extract the last path segment, strip `.git` suffix → use as prefix
   - `https://github.com/org/my-repo.git` → `my-repo`
   - `git@github.com:org/my-repo.git` → `my-repo`
3. If remote URL is unavailable → use the directory name of `<repository-path>`
4. If `--output-prefix` is explicitly provided → use that value (highest priority)

### Differential Extraction

| Parameter                | Type   | Required | Description                                                                                         |
| ------------------------ | ------ | -------- | --------------------------------------------------------------------------------------------------- |
| `--state <path>`         | string |          | Path to state file. If file exists → differential mode. If not → full extraction, then create file. |
| `--since-commit <hash>`  | string |          | Extract only commits newer than this hash (exclusive)                                               |
| `--since-date <ISO8601>` | string |          | Extract only commits with committer timestamp after this datetime                                   |

### File Rotation

| Parameter               | Type   | Required | Default | Description                             |
| ----------------------- | ------ | -------- | ------- | --------------------------------------- |
| `--rotate-lines <n>`    | number |          | none    | Start a new output file after `n` lines |
| `--rotate-size <bytes>` | number |          | none    | Start a new output file after `n` bytes |

Both may be specified simultaneously — rotation triggers when **either** threshold is reached.

---

## Mutual Exclusion Rules

The following combinations are invalid and must produce a clear error message before any processing begins:

| Combination                       | Error Message                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `--since-commit` + `--since-date` | `--since-commit and --since-date cannot be used together`                               |
| `--state` + `--since-commit`      | `--state and --since-commit cannot be used together. Use --state for incremental runs.` |
| `--state` + `--since-date`        | `--state and --since-date cannot be used together. Use --state for incremental runs.`   |

---

## Validation Rules

All validation must complete before extraction and file output begin. Validation proceeds in three phases:

1. **Format / mutual exclusion** — no I/O (mutual exclusion rules, branch count, numeric arg formats, ISO 8601 format for `--since-date`)
2. **File system** — `<repository-path>` existence, `--output-dir` existence
3. **Git** — repository identity (`resolveRef` on first branch), `--since-commit` reachability (`walkCommits` with the hash as `excludeHash`)

| Condition                                                     | Error                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `<repository-path>` does not exist                            | `Repository not found: <path>`                                                        |
| `<repository-path>` is not a Git repository                   | `Not a Git repository: <path>`                                                        |
| `--branch` not specified                                      | `At least one --branch must be specified`                                             |
| `--output-dir` does not exist                                 | `Output directory not found: <path>`                                                  |
| `--since-date` is not valid ISO 8601                          | `Invalid date format for --since-date. Expected ISO 8601 (e.g. 2024-01-01T00:00:00Z)` |
| `--since-commit` hash not found in specified branch           | `Commit <hash> not found in branch <name>`                                            |
| `--rotate-lines` or `--rotate-size` is not a positive integer | `<param> must be a positive integer`                                                  |

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
# Full extraction of main branch
gitrail --branch main ./my-repo

# Multiple branches, custom output dir
gitrail --branch main --branch develop --output-dir ./output ./my-repo

# Incremental run using state file
gitrail --branch main --state ./gitrail-state.json ./my-repo

# Manual differential by commit hash
gitrail --branch main --since-commit abc123def456 ./my-repo

# With file rotation
gitrail --branch main --rotate-lines 10000 --rotate-size 104857600 ./my-repo
```

---

## CLI Framework

**[citty](https://github.com/unjs/citty)** — decided and in use. TypeScript-native, zero legacy overhead.

---

## Implementation Notes

### `--branch` multi-occurrence workaround

citty only retains the **last** occurrence when a string flag appears multiple times. Because `--branch` must be repeatable, all `--branch` values are collected by manually scanning `process.argv` **before** delegating to `parseCittyArgs`. citty then parses everything else.

```typescript
const branches: string[] = [];
for (let i = 0; i < rawArgv.length; i++) {
  if (rawArgv[i] === "--branch") {
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
