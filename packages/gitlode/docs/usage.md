# gitlode — User Guide

gitlode extracts Git commit history from a local repository and writes it as
[JSON Lines](https://jsonlines.org/) (`.jsonl`) files — one record per line — suitable for
ingestion into data warehouses, analytics platforms, or any system that consumes
newline-delimited JSON.

---

## Extraction Modes

gitlode has two extraction modes:

### Snapshot mode (default)

By default (no `--incremental` flag), gitlode extracts commits independently of any prior state. It always walks from the
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

> **Note:** State tracking now covers all supported ref types (branches, tags, and raw commit OIDs).
> For static refs (annotated tags and raw commit OIDs), checkpoints are still recorded, but future
> incremental runs usually produce zero new records unless the ref target changes.

---

## Typical Workflows

### 1. One-time analysis

Extract all commits reachable from a branch:

```bash
gitlode --ref main ./my-repo
# or with shorthand aliases
gitlode -r main ./my-repo
```

Output is written to `./my-repo-<timestamp>-000001.jsonl` (prefix derived from the remote origin
URL, or the directory name if no remote is configured).

---

### 2. Continuous incremental extraction

For pipelines that regularly load new commits into a data warehouse.

> gitlode reads only the local `.git` directory. To pick up newly pushed commits, run
> `git fetch` before each gitlode invocation. Note that `git fetch` updates **remote-tracking
> refs** (e.g. `origin/main`), not local branch refs (`main`). Use the remote-tracking ref
> name with `--ref` (e.g. `-r origin/main`) so that a plain `git fetch` is sufficient.
> Alternatively, use `git pull` to advance the local branch, or work with a **bare clone**
> where `git fetch` updates refs directly.

**Step 1 — initialize state (once):**

```bash
gitlode -r main -s ./gitlode-state.json ./my-repo
```

This extracts all commits and writes a state file recording the current HEAD of each branch.

**Step 2 — all subsequent runs:**

```bash
git -C ./my-repo fetch origin
gitlode --incremental -r origin/main -s ./gitlode-state.json ./my-repo
```

Only commits added since the last run are extracted. The state file is updated on success.

**Simplified: auto-initialize with `--missing-state snapshot`**

If you prefer a single command that handles both the first run and all subsequent runs:

```bash
gitlode --incremental -r main -s ./gitlode-state.json --missing-state snapshot ./my-repo
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
gitlode -r main --since-ref v1.0 ./my-repo
```

`--since-ref` accepts a tag name, branch name, or full commit object ID (OID).

**With state recording** (for subsequent incremental runs):

```bash
gitlode -r main -r develop --since-ref v1.0 -s ./gitlode-state.json ./my-repo
```

> **Note:** The state file records each branch's current HEAD OID — not the `--since-ref`
> boundary. A subsequent incremental run picks up commits since the HEAD recorded at this run,
> not since `v1.0`. If a branch's HEAD is reachable from the since-ref (meaning zero commits
> would be output for that branch), gitlode emits a warning to stderr.

> **Compatibility note:** Runtime support is currently limited to repositories using the `sha1`
> object format. Unsupported formats fail before traversal/output with:
> `Unsupported repository object format: <format>. Supported formats: sha1.`

---

### 4. CI and ephemeral environments

In CI pipelines where the environment is recreated on each run, choose the approach that fits
your setup:

**Option A — stateless snapshot (simplest)**

```bash
gitlode -r main ./my-repo
```

No state file required. Suitable when the downstream system handles deduplication
(e.g. upsert by `oid`).

**Option B — incremental with persistent state**

Store the state file on a persistent volume mounted into the container:

```bash
gitlode --incremental -r main \
  -s /mnt/state/gitlode-state.json \
  --missing-state snapshot \
  ./my-repo
```

`--missing-state snapshot` ensures the first run after a new deployment or volume recreation
succeeds without manual intervention.

---

## State File Management

### What the state file records

After a successful run, gitlode writes a JSON file at the path given by `--state`. It records a
checkpoint entry for each processed ref at extraction time:

```json
{
  "version": 2,
  "generatedAt": "2024-06-01T12:00:00.000Z",
  "repositoryPath": "/absolute/path/to/my-repo",
  "refs": [
    {
      "ref": "main",
      "refType": "branch",
      "tipOid": "a1b2c3d4e5f6...",
      "updatedAt": "2024-06-01T12:00:00.000Z"
    },
    {
      "ref": "v1.0",
      "refType": "tag-lightweight",
      "tipOid": "d4e5f6a7b8c9...",
      "updatedAt": "2024-06-01T12:00:00.000Z"
    }
  ]
}
```

### Role of `--state` in each mode

| Mode          | State file read?     | State file written?                            |
| ------------- | -------------------- | ---------------------------------------------- |
| `snapshot`    | No (content ignored) | Yes (created or overwritten on success)        |
| `incremental` | Yes                  | Yes (updated with current HEAD OID on success) |

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

gitlode does not infer a default path. Specify `--state <path>` explicitly and choose a location
that persists across runs.

---

## Multi-Branch Extraction

Specify `--ref` (or `-r`) multiple times to extract from several branches in one run:

```bash
gitlode -r main -r develop -r release/1.x ./my-repo
```

**Deduplication:** commits shared between refs are written exactly once. gitlode maintains a
visited OID set across all refs within a single run.

**Output order:** all commits from the first ref are written before the second ref begins,
in the order `--ref` arguments were given.

### Adding a new branch to an existing incremental workflow

When a **branch** listed in `--ref` has no matching `(ref, refType)` entry in the state file,
gitlode automatically prevents cross-run duplicates. It computes the **merge base** of all tracked
branch checkpoints in state and uses that commit as the extraction boundary for the new branch,
excluding commits already output in prior runs.

**Fallback — no common ancestor:** if the new branch shares no history with any branch in the
state (e.g. an orphan branch created with `git checkout --orphan`), gitlode cannot find a merge
base and falls back to full traversal for that branch. Duplicate commits may appear in the output
in this case. If duplicates are unacceptable, discard prior output and re-run with
snapshot mode (without `--incremental`) across all branches to re-extract cleanly, then resume incremental extraction.

For the detailed algorithm and worked examples see
[Git Traversal design](design/git-traversal.md#across-runs).

---

## Git DAG Constraints

These properties of Git's data model affect how gitlode output should be interpreted.

### Output order is not chronological

gitlode traverses the commit graph using breadth-first search (BFS). Across merge branches, BFS
order does not match commit timestamp order. **Do not rely on line order in `.jsonl` files for
chronological ordering.** Sort by `committer.timestamp` in your downstream system.

### Commits carry no branch information

A Git commit object contains no branch field. "Extracting branch X" means "walk from the commit
that ref X currently points to." The same commit OID may be reachable from multiple branches;
gitlode deduplicates by OID within each run but does not record which branch a commit was reached
through.

### Branch refs are mutable

A branch pointer moves forward with new commits. A force-push can rewrite history so that
previously recorded commits are no longer reachable from the branch. If this occurs between runs,
the recorded `lastCommitHash` in the state file may no longer be in the branch's history. gitlode
detects this and falls back to full extraction for that branch, emitting a warning to stderr.

---

## File Rotation

By default, all output goes to a single `.jsonl` file. Use rotation to split across multiple
files:

```bash
# New file every 10,000 lines
gitlode -r main --rotate-lines 10000 ./my-repo

# New file every 500 MiB
gitlode -r main --rotate-size 500M ./my-repo

# Both — rotation triggers on whichever threshold is reached first
gitlode -r main --rotate-lines 10000 --rotate-size 1G ./my-repo
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

This section summarizes user-facing CLI options. For the developer-facing CLI contract, validation
rules, stderr behavior, and implementation notes, see [CLI Interface Design](design/cli.md).

```
gitlode [options] <repository-path>
```

### Positional

| Parameter           | Required | Description                      |
| ------------------- | -------- | -------------------------------- |
| `<repository-path>` | ✅       | Local path to the Git repository |

### Extraction mode

| Parameter       | Alias | Type                | Default | Description                                                                                                                                                                            |
| --------------- | ----- | ------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--incremental` |       | boolean             | `false` | When set, reads state to extract only new commits. When absent, performs a full snapshot extraction.                                                                                   |
| `--ref <ref>`   | `-r`  | string (repeatable) | —       | Ref to traverse from. Accepts branch name, tag, or raw commit OID. At least one required. In incremental workflows (`--state`), checkpoints are tracked per `(ref, refType)` identity. |

### Range filter (snapshot mode only)

| Parameter                | Type   | Description                                                                                   |
| ------------------------ | ------ | --------------------------------------------------------------------------------------------- |
| `--since-ref <ref>`      | string | Exclude commits reachable from this ref. Accepts tag, branch name, or commit object ID (OID). |
| `--since-date <ISO8601>` | string | Include only commits with committer timestamp after this datetime.                            |

### State management

| Parameter         | Alias | Type                | Default | Description                                                          |
| ----------------- | ----- | ------------------- | ------- | -------------------------------------------------------------------- |
| `--state <path>`  | `-s`  | string              | —       | State file path. Required with `--incremental`.                      |
| `--missing-state` |       | `error \| snapshot` | `error` | Behavior when state file is absent. Only valid with `--incremental`. |

### Output and Repository Metadata

| Parameter                  | Alias | Type    | Default | Description                                                                                                                                                                   |
| -------------------------- | ----- | ------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--output-dir <path>`      | `-o`  | string  | `./`    | Directory for output `.jsonl` files. Must exist.                                                                                                                              |
| `--output-prefix <string>` |       | string  | derived | Filename prefix (derived from remote origin if omitted)                                                                                                                       |
| `--per-file`               |       | boolean | `false` | When set, emit one record per changed file per commit                                                                                                                         |
| `--max-diff-size <value>`  |       | string  | —       | Skip line-level diff computation for files above this size (bytes or `K`/`M`/`G` suffix). Emits `null` additions/deletions for skipped files. Applies only with `--per-file`. |
| `--rotate-lines <n>`       |       | number  | —       | Start new file after `n` lines                                                                                                                                                |
| `--rotate-size <bytes>`    |       | string  | —       | Start new file after threshold (raw bytes or `K`/`M`/`G`, range `1M` to `64G`)                                                                                                |
| `--repo-name <string>`     |       | string  | —       | Override `repository.name` in all output records. Does not affect state-file identity or incremental behavior.                                                                |
| `--repo-url <string>`      |       | string  | —       | Override `repository.url` in all output records. Does not affect state-file identity or incremental behavior.                                                                 |

### Control

| Parameter   | Alias | Type    | Default | Description                                                                                          |
| ----------- | ----- | ------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `--quiet`   | `-q`  | boolean | `false` | Suppress progress, summary, and profile output on stderr. Warnings and errors remain visible.        |
| `--profile` |       | boolean | `false` | Print per-stage timing information to stderr after a successful extraction. Suppressed by `--quiet`. |

### Configuration File

| Parameter         | Alias | Type   | Default | Description                                                                                                                        |
| ----------------- | ----- | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `--config <path>` | `-c`  | string | —       | Path to the gitlode configuration file. Provides defaults for refs/range/output/repository/profile and optional plugin enrichment. |

The config file is explicit opt-in: gitlode reads it only when `--config` is passed.

Supported top-level sections in `version: 1`:

- `extraction`
- `output`
- `repository`
- `runtime`
- `extensions`

Precedence rules:

- `--ref` replaces `extraction.refs` (no merge)
- `--since-ref` / `--since-date` replace `extraction.range`
- Scalar/path defaults use `CLI explicit > config > built-in`
- `--rotate-lines` and `--rotate-size` override their own thresholds independently
- effective profile is `--profile OR runtime.profile`
- effective Git adapter is `runtime.gitAdapter OR "isomorphic-git"`; there is no CLI override

Conflict rule:

- `extraction.range` in config cannot be used with `--incremental`.

### Profiling

`--profile` appends a local timing and diagnostic summary to stderr after a successful run:

```bash
gitlode --profile -r main ./my-repo
```

This output is intended for troubleshooting unexpectedly slow runs, operational investigation, and
development work on extraction and traversal logic. It is not needed for normal extraction
workflows and is suppressed by `--quiet`.

For the output format, span names, and `walk_commits` diagnostic details, see
[Profiling Guide](profiling.md).

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
gitlode -r main --per-file ./my-repo
```

### Output record shape (file mode)

Every record extends the commit-mode schema with a `file` object:

```json
{
  "oid": "a1b2c3d4...",
  "message": "Fix null pointer in auth module",
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
- **Large text diffs**: with `--max-diff-size`, if either the before or after blob size exceeds the threshold, gitlode emits `"additions": null, "deletions": null` for that file.
- **Root commits** (no parent) treat all files as `"added"`.
- **File rotation** (`--rotate-lines`, `--rotate-size`) applies per record; a single commit's file records may span rotation boundaries.
- Progress output reflects the number of file-level records written, not the number of commits processed.

### Large-file diff guardrail

Use `--max-diff-size` to avoid line-level diff cost on very large files when running in file mode:

```bash
# Skip diff counts for files larger than 100 KiB
gitlode -r main --per-file --max-diff-size 100K ./my-repo

# Same option with plain bytes
gitlode -r main --per-file --max-diff-size 100000 ./my-repo
```

Details:

- The option is disabled by default.
- It only affects `--per-file` mode.
- Accepted values: raw bytes (`100000`) or binary suffixes `K`, `M`, `G` (for example `100K`, `1M`).
- A file is considered over threshold when either its before-blob size or after-blob size exceeds the configured value.
- Over-threshold files are still emitted as file records, but with `additions` and `deletions` set to `null`.

Suggested starting values are `100K` or `1M`, depending on repository characteristics.

---

## Plugin Enrichment

When `--config` is passed, gitlode loads an external configuration file that declares plugins.
Each plugin attaches custom data to output records under its own namespace key inside the
`extensions` object.

```bash
gitlode -r main --config ./gitlode.config.json ./my-repo
```

### Configuration file format

```json
{
  "version": 1,
  "extraction": {
    "refs": ["main"],
    "range": { "sinceRef": "v1.0" }
  },
  "output": {
    "directory": "./out",
    "prefix": "gitlode"
  },
  "repository": {
    "name": "repo-override"
  },
  "runtime": {
    "profile": true,
    "gitAdapter": "isomorphic-git"
  },
  "extensions": {
    "my-plugin": {
      "entrypoint": "./my-plugin.js",
      "config": { "threshold": 10 },
      "failurePolicy": "skip-fact"
    }
  }
}
```

| Field           | Required | Description                                                                               |
| --------------- | -------- | ----------------------------------------------------------------------------------------- |
| `version`       | ✅       | Must be `1`.                                                                              |
| `extraction`    |          | Defaults for `--ref` and snapshot range.                                                  |
| `output`        |          | Defaults for output directory/prefix and rotation thresholds.                             |
| `repository`    |          | Defaults for `--repo-name` / `--repo-url`.                                                |
| `runtime`       |          | Defaults for runtime behavior such as `profile` and `gitAdapter`.                         |
| `extensions`    |          | Map from namespace to plugin entry. When present, must have at least one entry.           |
| `entrypoint`    | ✅       | Module path or specifier. Relative paths resolve from the config file directory.          |
| `config`        |          | Passed to the plugin factory. Any JSON value.                                             |
| `failurePolicy` |          | `"skip-fact"` (default) or `"fatal"`. Controls behavior when the plugin errors on a fact. |

`runtime.gitAdapter` defaults to `"isomorphic-git"`. The `"git-cli"` value is reserved for the
in-progress Git CLI adapter and currently returns a user error until that adapter implementation
lands.

For complete schema and precedence details, see [Configuration File Design](design/configuration.md).

### Plugin output in records

Each output record gains an `extensions` object with one key per plugin:

```json
{
  "oid": "a1b2c3d4...",
  "message": "Add caching layer",
  "extensions": {
    "my-plugin": { "score": 88 },
    "label-plugin": "v1.0",
    "flag-plugin": true,
    "other-plugin": null
  }
}
```

A non-null value is whatever the plugin returned as `success.data`: a plain object, a string, a
number, or a boolean. A value of `null` means the plugin skipped that fact.

### Plugin failure policies

| Policy      | Behavior on error                                                                 |
| ----------- | --------------------------------------------------------------------------------- |
| `skip-fact` | Namespace is set to `null`; a warning is printed to stderr; extraction continues. |
| `fatal`     | The run aborts immediately with an error message.                                 |

### Writing a plugin

A plugin module must export a default factory function:

```javascript
// my-plugin.js
export default async function factory(config) {
  return {
    async init() {
      // Optional: validate config, open connections, etc.
      return { type: "ready" };
    },

    async project({ fact, baseRecord }) {
      if (fact.type !== "commit") {
        return { type: "skip", message: "file-change facts not supported" };
      }
      return { type: "success", data: { score: computeScore(fact) } };
    },
  };
}
```

For the full plugin contract specification, see [Plugin System Design](design/plugins.md).

### Installing a plugin package

Install the plugin as a regular npm dependency in the repository where you run gitlode:

```bash
npm install -g @gitlode/plugin-conventional-commits
```

Then reference the package name in your config:

```json
{
  "version": 1,
  "extensions": {
    "conventional-commits": {
      "entrypoint": "@gitlode/plugin-conventional-commits"
    }
  }
}
```

### Example: identity normalization and profile enrichment

`@gitlode/plugin-identity-profile` rewrites emitted `author` and `committer` identities from an
inline mapping table and can attach optional custom attributes.

```bash
npm install -g @gitlode/plugin-identity-profile
```

```json
{
  "version": 1,
  "extensions": {
    "identity-profile": {
      "entrypoint": "@gitlode/plugin-identity-profile",
      "config": {
        "attributeFields": ["team"],
        "profileMappings": [
          {
            "matchEmail": "dev@example.com",
            "name": "Developer Canonical",
            "email": "developer.canonical@example.com",
            "team": "platform"
          }
        ]
      }
    }
  }
}
```

This plugin performs raw exact matching, checks `matchEmail` first, falls back to `matchName`
only when email does not match, and passes unmatched sides through unchanged.

#### Compatibility warnings

When gitlode starts, it compares the running core version against the
`peerDependencies.gitlode` range declared in each plugin's `package.json`.
If the running version is outside the declared range, a warning is printed
to stderr before extraction begins:

```
Plugin "conventional-commits" declares peer gitlode ^0.6.0, but running gitlode is 0.7.0. Continuing; behavior may be incompatible.
```

If a plugin does not declare `peerDependencies.gitlode`, a different warning is printed:

```
Plugin "conventional-commits" does not declare peerDependencies.gitlode. Compatibility unknown; continuing.
```

These warnings are always shown even when `--quiet` is passed. They do not cause a non-zero
exit code; extraction continues regardless. To resolve a mismatch, update the plugin to a
version compatible with the running gitlode core, or pin gitlode to a version within the
plugin's declared range.

For the plugin packaging rules and peer range policy, see the
[Plugin Package Policy](design/plugins.md#plugin-package-policy) section of the design docs.
