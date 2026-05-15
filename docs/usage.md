# gitrail — User Guide

gitrail extracts Git commit history from a local repository and writes it as
[JSON Lines](https://jsonlines.org/) (`.jsonl`) files — one record per line — suitable for
ingestion into data warehouses, analytics platforms, or any system that consumes
newline-delimited JSON.

---

## Extraction Modes

gitrail has two extraction modes:

### Snapshot mode (default)

By default (no `--incremental` flag), gitrail extracts commits independently of any prior state. It always walks from the
current tip of the specified branch(es) back through history. No state file is consulted during
extraction.

**When to use:**

- One-time or ad-hoc extraction
- Extracting commits since a specific release tag via `--since-ref`
- Resetting or re-initializing an incremental workflow

### Incremental mode

`--incremental` reads a state file to determine where the previous extraction ended, then
extracts only commits added since that point.

**When to use:**

- Regularly feeding new commits into a data warehouse or analytics pipeline
- Long-running repositories where re-extracting everything on each run is costly

Incremental mode requires `--state`.

---

## Typical Workflows

### 1. One-time analysis

Extract all commits reachable from a branch:

```bash
gitrail --branch main ./my-repo
# or with shorthand aliases
gitrail -b main ./my-repo
```

Output is written to `./my-repo-<timestamp>-000001.jsonl` (prefix derived from the remote origin
URL, or the directory name if no remote is configured).

---

### 2. Continuous incremental extraction

For pipelines that regularly load new commits into a data warehouse.

> gitrail reads only the local `.git` directory. To pick up newly pushed commits, run
> `git fetch` before each gitrail invocation. Note that `git fetch` updates **remote-tracking
> refs** (e.g. `origin/main`), not local branch refs (`main`). Use the remote-tracking ref
> name with `--branch` (e.g. `-b origin/main`) so that a plain `git fetch` is sufficient.
> Alternatively, use `git pull` to advance the local branch, or work with a **bare clone**
> where `git fetch` updates refs directly.

**Step 1 — initialize state (once):**

```bash
gitrail -b main -s ./gitrail-state.json ./my-repo
```

This extracts all commits and writes a state file recording the current HEAD of each branch.

**Step 2 — all subsequent runs:**

```bash
git -C ./my-repo fetch origin
gitrail --incremental -b origin/main -s ./gitrail-state.json ./my-repo
```

Only commits added since the last run are extracted. The state file is updated on success.

**Simplified: auto-initialize with `--missing-state snapshot`**

If you prefer a single command that handles both the first run and all subsequent runs:

```bash
gitrail --incremental -b main -s ./gitrail-state.json --missing-state snapshot ./my-repo
```

- First run (state file absent): emits a warning to stderr, performs full extraction, creates
  the state file.
- Subsequent runs: differential extraction as normal.

---

### 3. Extract commits since a release tag

Use `--since-ref` to extract only commits that appeared after a given ref — equivalent to
`git log <ref>..<branch>`:

```bash
# All commits on main that are not reachable from v1.0
gitrail -b main --since-ref v1.0 ./my-repo
```

`--since-ref` accepts a tag name, branch name, or full commit hash.

**With state recording** (for subsequent incremental runs):

```bash
gitrail -b main -b develop --since-ref v1.0 -s ./gitrail-state.json ./my-repo
```

> **Note:** The state file records each branch's current HEAD hash — not the `--since-ref`
> boundary. A subsequent incremental run picks up commits since the HEAD recorded at this run,
> not since `v1.0`. If a branch's HEAD is reachable from the since-ref (meaning zero commits
> would be output for that branch), gitrail emits a warning to stderr.

---

### 4. CI and ephemeral environments

In CI pipelines where the environment is recreated on each run, choose the approach that fits
your setup:

**Option A — stateless snapshot (simplest)**

```bash
gitrail -b main ./my-repo
```

No state file required. Suitable when the downstream system handles deduplication
(e.g. upsert by `oid`).

**Option B — incremental with persistent state**

Store the state file on a persistent volume mounted into the container:

```bash
gitrail --incremental -b main \
  -s /mnt/state/gitrail-state.json \
  --missing-state snapshot \
  ./my-repo
```

`--missing-state snapshot` ensures the first run after a new deployment or volume recreation
succeeds without manual intervention.

---

## State File Management

### What the state file records

After a successful run, gitrail writes a JSON file at the path given by `--state`. It records the
HEAD commit hash for each processed branch at the time of extraction:

```json
{
  "version": 1,
  "generatedAt": "2024-06-01T12:00:00.000Z",
  "repositoryPath": "/absolute/path/to/my-repo",
  "branches": [
    { "name": "main", "lastCommitHash": "a1b2c3d4e5f6..." },
    { "name": "develop", "lastCommitHash": "d4e5f6a7b8c9..." }
  ]
}
```

### Role of `--state` in each mode

| Mode          | State file read?     | State file written?                        |
| ------------- | -------------------- | ------------------------------------------ |
| `snapshot`    | No (content ignored) | Yes (created or overwritten on success)    |
| `incremental` | Yes                  | Yes (updated with current HEAD on success) |

In snapshot mode, `--state` serves only as a recording path — prior content has no effect on
extraction. This makes it safe to run without `--incremental` to re-initialize state without affecting
any output.

### `--missing-state`

Controls behavior when `--incremental` is used and the state file does not exist:

| Value             | Behavior                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `error` (default) | Exits with code 1. Requires manual state initialization before the first incremental run. |
| `snapshot`        | Emits a warning to stderr, performs full extraction, and creates the state file.          |

### State file location

gitrail does not infer a default path. Specify `--state <path>` explicitly and choose a location
that persists across runs.

---

## Multi-Branch Extraction

Specify `--branch` (or `-b`) multiple times to extract from several branches in one run:

```bash
gitrail -b main -b develop -b release/1.x ./my-repo
```

**Deduplication:** commits shared between branches are written exactly once. gitrail maintains a
visited hash set across all branches within a single run.

**Output order:** all commits from the first branch are written before the second branch begins,
in the order `--branch` arguments were given.

### Adding a new branch to an existing incremental workflow

When a branch listed in `--branch` has no entry in the state file, gitrail automatically prevents
cross-run duplicates. It computes the **merge base** of all branches already recorded in the
state file and uses that commit as the extraction boundary for the new branch, excluding commits
already output in prior runs.

**Fallback — no common ancestor:** if the new branch shares no history with any branch in the
state (e.g. an orphan branch created with `git checkout --orphan`), gitrail cannot find a merge
base and falls back to full traversal for that branch. Duplicate commits may appear in the output
in this case. If duplicates are unacceptable, discard prior output and re-run with
snapshot mode (without `--incremental`) across all branches to re-extract cleanly, then resume incremental extraction.

For the detailed algorithm and worked examples see
[Git Traversal design](design/git-traversal.md#across-runs).

---

## Git DAG Constraints

These properties of Git's data model affect how gitrail output should be interpreted.

### Output order is not chronological

gitrail traverses the commit graph using breadth-first search (BFS). Across merge branches, BFS
order does not match commit timestamp order. **Do not rely on line order in `.jsonl` files for
chronological ordering.** Sort by `committer.timestamp` in your downstream system.

### Commits carry no branch information

A Git commit object contains no branch field. "Extracting branch X" means "walk from the commit
that ref X currently points to." The same commit hash may be reachable from multiple branches;
gitrail deduplicates by hash within each run but does not record which branch a commit was reached
through.

### Branch refs are mutable

A branch pointer moves forward with new commits. A force-push can rewrite history so that
previously recorded commits are no longer reachable from the branch. If this occurs between runs,
the recorded `lastCommitHash` in the state file may no longer be in the branch's history. gitrail
detects this and falls back to full extraction for that branch, emitting a warning to stderr.

---

## File Rotation

By default, all output goes to a single `.jsonl` file. Use rotation to split across multiple
files:

```bash
# New file every 10,000 lines
gitrail -b main --rotate-lines 10000 ./my-repo

# New file every 500 MiB
gitrail -b main --rotate-size 500M ./my-repo

# Both — rotation triggers on whichever threshold is reached first
gitrail -b main --rotate-lines 10000 --rotate-size 1G ./my-repo
```

`--rotate-size` accepts either a raw byte integer (for backward compatibility) or an integer
with suffix `K`, `M`, or `G` (case-insensitive, binary base). Valid range is `1M` to `64G`
inclusive.

Output files are named `<prefix>-<timestamp>-000001.jsonl`, `<prefix>-<timestamp>-000002.jsonl`, etc. The prefix is
derived from the repository's remote origin URL (last path segment, `.git` stripped). Use
`--output-prefix` to override. The timestamp segment (`YYYYMMDDTHHmmssZ`) is captured once per
session; all files from a single run share the same timestamp and will not overwrite files from
earlier runs.

---

## CLI Reference

```
gitrail [options] <repository-path>
```

### Positional

| Parameter           | Required | Description                      |
| ------------------- | -------- | -------------------------------- |
| `<repository-path>` | ✅       | Local path to the Git repository |

### Extraction mode

| Parameter        | Alias | Type                | Default | Description                                                                                          |
| ---------------- | ----- | ------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `--incremental`  |       | boolean             | `false` | When set, reads state to extract only new commits. When absent, performs a full snapshot extraction. |
| `--branch <ref>` | `-b`  | string (repeatable) | —       | Ref to traverse from. At least one required.                                                         |

### Range filter (snapshot mode only)

| Parameter                | Type   | Description                                                                        |
| ------------------------ | ------ | ---------------------------------------------------------------------------------- |
| `--since-ref <ref>`      | string | Exclude commits reachable from this ref. Accepts tag, branch name, or commit hash. |
| `--since-date <ISO8601>` | string | Include only commits with committer timestamp after this datetime.                 |

### State management

| Parameter         | Alias | Type                | Default | Description                                                          |
| ----------------- | ----- | ------------------- | ------- | -------------------------------------------------------------------- |
| `--state <path>`  | `-s`  | string              | —       | State file path. Required with `--incremental`.                      |
| `--missing-state` |       | `error \| snapshot` | `error` | Behavior when state file is absent. Only valid with `--incremental`. |

### Output

| Parameter                  | Alias | Type    | Default | Description                                                                    |
| -------------------------- | ----- | ------- | ------- | ------------------------------------------------------------------------------ |
| `--output-dir <path>`      | `-o`  | string  | `./`    | Directory for output `.jsonl` files. Must exist.                               |
| `--output-prefix <string>` |       | string  | derived | Filename prefix (derived from remote origin if omitted)                        |
| `--per-file`               |       | boolean | `false` | When set, emit one record per changed file per commit                          |
| `--rotate-lines <n>`       |       | number  | —       | Start new file after `n` lines                                                 |
| `--rotate-size <bytes>`    |       | string  | —       | Start new file after threshold (raw bytes or `K`/`M`/`G`, range `1M` to `64G`) |

### Control

| Parameter   | Alias | Type    | Default | Description                                                                                          |
| ----------- | ----- | ------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `--quiet`   | `-q`  | boolean | `false` | Suppress progress, summary, and profile output on stderr. Warnings and errors remain visible.        |
| `--profile` |       | boolean | `false` | Print per-stage timing information to stderr after a successful extraction. Suppressed by `--quiet`. |

### Profiling output

When `--profile` is set and the run succeeds, gitrail appends an aligned block to stderr after the
default completion summary:

```
Profile
  elapsed                      : wall=  18.40ms  work=  18.40ms
  elapsed/planning             : wall=   1.10ms  work=   1.10ms
  elapsed/traversal            : wall=   8.25ms  work=   8.25ms
  elapsed/projection           : wall=   3.75ms  work=   3.75ms
  elapsed/write                : wall=   2.10ms  work=   2.10ms
  elapsed/git/blob-read        : wall=   0.80ms  work=   0.80ms
  elapsed/git/diff             : wall=   1.45ms  work=   1.45ms
```

Each line represents one profiling entry from the per-run profiler tree.

| Entry path                 | What it measures                                                               |
| -------------------------- | ------------------------------------------------------------------------------ |
| `elapsed`                  | Total extraction wall/work duration captured by the root profiler              |
| `elapsed/planning`         | Branch-planning work before traversal begins                                   |
| `elapsed/traversal`        | Commit traversal and commit-fact materialization                               |
| `elapsed/projection`       | Fact-to-output-record mapping in the active projector                          |
| `elapsed/write`            | `OutputSink.write()` and `OutputSink.close()` only                             |
| `elapsed/git/blob-read`    | Blob reads inside `IsomorphicGitAdapter.getFileChanges()`                      |
| `elapsed/git/diff`         | Diff-stat computation inside `IsomorphicGitAdapter.getFileChanges()`           |
| `elapsed/git/...` children | Additional Git-internal sub-stages such as `resolve-ref`, `walk-commits`, etc. |

`wall` shows elapsed time for that scoped profiler. `work` shows additive measured work inside the
same scope. The root `elapsed` entry is always present on successful runs. Additional stage entries
are populated when profiling is enabled.

In commit-granularity mode (no `--per-file`), Git file-expansion sub-stages such as
`elapsed/git/blob-read` and `elapsed/git/diff` remain at `0.00ms` because `getFileChanges()` is
never called.

### Mutual exclusion rules

| Combination                               | Error                                       |
| ----------------------------------------- | ------------------------------------------- |
| `--since-ref` + `--since-date`            | Cannot be combined                          |
| `--since-ref` + `--incremental`           | `--since-ref` is snapshot mode only         |
| `--since-date` + `--incremental`          | `--since-date` is snapshot mode only        |
| `--missing-state` without `--incremental` | `--missing-state` requires incremental mode |
| `--incremental` without `--state`         | `--state` is required for incremental mode  |

### Exit codes

| Code | Meaning                                            |
| ---- | -------------------------------------------------- |
| `0`  | Success                                            |
| `1`  | User error (invalid arguments, validation failure) |
| `2`  | Runtime error (I/O failure, unexpected Git error)  |

---

## File-Level Output Mode

By default, each output record represents one commit.

With `--per-file`, each record represents one changed **file** within a commit, with commit metadata denormalized onto every record. This enables file-granularity analytics without a join: each row is self-contained.

```bash
gitrail -b main --per-file ./my-repo
```

### Output record shape (file mode)

Every record extends the commit-mode schema with a `file` object:

```json
{
  "oid": "a1b2c3d4...",
  "subject": "Fix null pointer in auth module",
  "body": "",
  "author": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "timestamp": "2024-01-15T09:00:00+09:00"
  },
  "committer": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "timestamp": "2024-01-15T09:05:00+09:00"
  },
  "parents": ["parenthash1"],
  "repository": { "name": "my-repo", "url": "https://github.com/org/my-repo" },
  "file": {
    "path": "src/auth/handler.ts",
    "status": "modified",
    "additions": 5,
    "deletions": 2
  }
}
```

| Field            | Type                                 | Notes                                             |
| ---------------- | ------------------------------------ | ------------------------------------------------- |
| `file.path`      | string                               | Relative path from repository root, `/`-separated |
| `file.status`    | `"added" \| "modified" \| "deleted"` | Rename detection is not performed                 |
| `file.additions` | number \| null                       | Lines added; `null` for binary files              |
| `file.deletions` | number \| null                       | Lines deleted; `null` for binary files            |

### Behavior notes

- **Empty commits** (no changed files) produce **no output records** in file mode.
- **Merge commits** diff against the first parent only.
- **Binary files** produce `"additions": null, "deletions": null`.
- **Root commits** (no parent) treat all files as `"added"`.
- **File rotation** (`--rotate-lines`, `--rotate-size`) applies per record; a single commit's file records may span rotation boundaries.
- Progress output reflects the number of file-level records written, not the number of commits processed.
