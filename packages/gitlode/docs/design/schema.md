# Output Schema & File Format Design

## Purpose

This document explains the output format, field semantics, and serialization logic in the current implementation.

Normative rules remain in `.github/instructions/schema.instructions.md`.

## File format overview

- One JSON object per line (JSON Lines / JSONL)
- Line endings: `\n` (LF only — never `\r\n`)
- File extension: `.jsonl`
- Encoding: UTF-8

## Output file naming

Files are named `{prefix}-{timestamp}-{seq}.jsonl` where:

- `prefix` is derived from the repository (see below)
- `timestamp` is a session timestamp in `YYYYMMDDTHHmmssZ` format (UTC, second precision), captured once at the start of each run
- `seq` is a zero-padded 6-digit sequence number starting at `000001`

All files produced in a single session share the same timestamp segment, making it possible to identify which files belong to the same run. Files from different sessions have distinct timestamps and will not overwrite each other.

Example sequence for prefix `my-repo` and session timestamp `20260417T120000Z`:

```
my-repo-20260417T120000Z-000001.jsonl
my-repo-20260417T120000Z-000002.jsonl
my-repo-20260417T120000Z-000003.jsonl
```

Prefix derivation (in priority order):

1. `--output-prefix` if explicitly provided
2. Last path segment of remote origin URL, with `.git` suffix stripped
3. Directory name of `<repository-path>` if no remote origin is configured

## Record schema

Each line is a serialized `ProjectedCommit` object:

```typescript
interface ProjectedCommit {
  oid: string;
  subject: string;
  body: string;
  author: {
    name: string;
    email: string;
    timestamp: string; // ISO 8601
  };
  committer: {
    name: string;
    email: string;
    timestamp: string; // ISO 8601
  };
  parents: string[];
  repository: {
    name: string;
    url: string | null;
  };
  // Present only when --config is used and plugins are active.
  extensions?: Record<string, string | number | boolean | Readonly<Record<string, unknown>> | null>;
}
```

## Field definitions

### `oid`

Full commit object ID (OID). Sourced directly from the Git object database.

### `subject` and `body`

Split from the raw commit message:

- `subject`: first line of the message
- `body`: remaining lines after the first, joined with `\n` and trimmed. Empty string `""` if no body exists.

Example with subject and body:

```
Fix null pointer in auth module\n\nDetailed explanation.\n\nCloses #123
```

Produces:

```json
{
  "subject": "Fix null pointer in auth module",
  "body": "Detailed explanation.\n\nCloses #123"
}
```

Example with subject only:

```
Bump version to 1.2.0
```

Produces:

```json
{
  "subject": "Bump version to 1.2.0",
  "body": ""
}
```

### `author` and `committer`

Both follow the same structure: `name`, `email`, and `timestamp`.

The difference between `author` and `committer`:

- `author` is the person who originally wrote the change.
- `committer` is the person who applied the commit to the repository. For ordinary commits these are the same. For cherry-picks, patches applied by a maintainer, or rebases, they can differ.

### `author.timestamp` / `committer.timestamp`

ISO 8601 string built from the timezone offset embedded in the commit object, not the system timezone. This ensures timestamps faithfully reproduce the developer's local time even when extracted on a machine in a different timezone.

Conversion logic:

isomorphic-git exposes two raw values per person:

| Field            | Type                          | Example (JST)                 |
| ---------------- | ----------------------------- | ----------------------------- |
| `timestamp`      | Unix seconds                  | `1705312800`                  |
| `timezoneOffset` | Minutes from UTC, **negated** | `-540` (represents UTC+09:00) |

The negation is a quirk of isomorphic-git: JST (UTC+9) is stored as `-540`, not `+540`. The conversion function reverses this before building the offset string:

```
offsetMinutes = -timezoneOffset           // -(-540) = +540
offsetStr      = "+09:00"                 // 540 / 60 = 9 hours
localMs        = (timestamp + offsetMinutes * 60) * 1000
```

Worked example for `timestamp = 1705312800`, `timezoneOffset = -540` (JST):

```
offsetMinutes = 540
offsetStr     = "+09:00"
localMs       = (1705312800 + 540 * 60) * 1000
              = 1705345200000
UTC date      = 2024-01-15T18:00:00Z
Local date    = 2024-01-16T03:00:00+09:00  ← final output
```

### `parents`

Array of parent commit OIDs:

| Commit type     | `parents` length | Example                |
| --------------- | ---------------- | ---------------------- |
| Root commit     | `0`              | `[]`                   |
| Ordinary commit | `1`              | `["abc123"]`           |
| Merge commit    | `2`              | `["abc123", "def456"]` |

### `repository`

Carries repository metadata embedded in every record to make each line self-contained for downstream ingestion.

| Field  | Source                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `name` | Derived from remote origin URL (last path segment, `.git` stripped), or directory name if no remote. Override with `--repo-name`. |
| `url`  | Remote origin URL as-is, or `null` if not configured. Override with `--repo-url`.                                                 |

When `--repo-name` or `--repo-url` is provided, the override value replaces the auto-derived value in all output records. These overrides do not affect state-file identity or incremental extraction behavior.

### `extensions`

Present only when `--config` is provided and at least one plugin is active.

Each key is a plugin namespace declared in the configuration file. A value of `null` means the
plugin skipped that fact (due to a `skip` result or a `fatal` result with `failurePolicy:
"skip-fact"`). Non-null values are whatever `success.data` returned: a plain object, a string, a
number, or a boolean. Key order matches plugin declaration order.

When no plugins are configured, `extensions` is omitted from output records entirely.

gitlode guarantees the outer contract of `extensions` only: namespace key placement, omission when
no plugins are active, declaration-order preservation, and the meaning of `null`. The inner shape
of a plugin's non-null payload is owned jointly by the plugin author and the user's chosen
namespace/config pairing.

## Complete example record (no plugins)

```json
{
  "oid": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "subject": "Fix null pointer in auth module",
  "body": "Detailed explanation of the fix.\n\nCloses #123",
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
  "parents": ["b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
  "repository": {
    "name": "my-repo",
    "url": "https://github.com/org/my-repo"
  }
}
```

## Complete example record (with plugins)

When `--config` is used with two plugins (`my-plugin` and `other-plugin`), and `other-plugin`
skipped the fact:

```json
{
  "oid": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "subject": "Fix null pointer in auth module",
  "body": "Detailed explanation of the fix.\n\nCloses #123",
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
  "parents": ["b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
  "repository": {
    "name": "my-repo",
    "url": "https://github.com/org/my-repo"
  },
  "extensions": {
    "my-plugin": { "score": 42 },
    "other-plugin": null
  }
}
```

## File rotation

Rotation splits output across multiple numbered files rather than producing one unbounded file.

Thresholds (both optional, can be combined):

| Option             | Trigger condition                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `--rotate-lines N` | After writing the Nth line, the next record opens a new file                                                                |
| `--rotate-size N`  | After the file reaches N bytes, the next record opens a new file (`N` can be raw bytes or `K`/`M`/`G`, range `1M` to `64G`) |

When both are configured, rotation triggers when **either** threshold is reached.

Rotation check happens **after** each write. The threshold is not crossed mid-record.

Byte counting: uses `Buffer.byteLength(line, "utf8")` — counts encoded bytes, not character count. This matters for multibyte Unicode content.

## Ordering note

JSONL line order reflects BFS traversal order across the Git DAG, not chronological commit order. Downstream consumers that need chronological ordering must sort by `committer.timestamp`.

---

## File-Level Output Schema

When `--per-file` is used, each output line represents one changed file within a commit. Commits with multiple changed files produce multiple lines. Empty commits (no file changes) produce no lines.

Each line carries all commit fields from `ProjectedCommit` (denormalized) plus a `file` object:

```typescript
interface ProjectedFileChange extends ProjectedCommit {
  file: {
    path: string;
    status: "added" | "modified" | "deleted";
    additions: number | null; // null for binary files
    deletions: number | null; // null for binary files
  };
}
```

### `file.path`

Relative path from the repository root. Uses `/` as the separator regardless of OS.

### `file.status`

- `"added"`: file exists in this commit but not in the parent
- `"modified"`: file exists in both commits with different content
- `"deleted"`: file exists in the parent but not in this commit

Rename detection is not performed. A renamed file appears as a `"deleted"` entry for the old path and an `"added"` entry for the new path.

### `file.additions` / `file.deletions`

Line-level diff statistics. `null` when the file is binary (contains NUL bytes in the first 8000 bytes).

Diff computation is delegated to an internal `DiffAdapter` strategy inside `IsomorphicGitAdapter`.
The default implementation uses the `diff` package's `diffLines` function with UTF-8 decoding,
producing behavior identical to previous versions. Binary detection and the `null` result for
binary files are owned by `IsomorphicGitAdapter` and do not involve the `DiffAdapter` strategy.

For `"added"` files: `deletions` is `0`, `additions` is the total line count.
For `"deleted"` files: `additions` is `0`, `deletions` is the total line count.

### Merge commits

Changes are computed against the **first parent only**.

### Example file-mode record

```json
{
  "oid": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
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
  "parents": ["b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
  "repository": {
    "name": "my-repo",
    "url": "https://github.com/org/my-repo"
  },
  "file": { "path": "src/auth/handler.ts", "status": "modified", "additions": 5, "deletions": 2 }
}
```

## References

- `.github/instructions/schema.instructions.md`
- `src/output/utils.ts`
- `src/output/writer.ts`
- `src/core/types.ts`
