---
description: Output JSON schema and file rotation specification for gitlode
applyTo: "src/core/types.ts,src/output/**"
---

# Output JSON Schema & File Format

## Format Overview

- **Format**: JSON Lines (JSONL) — one JSON object per line
- **Line ending**: `\n` (LF only — never `\r\n`)
- **File extension**: `.jsonl`
- **Encoding**: UTF-8

---

## Commit-Granularity Schema

Each line is a single JSON object representing one Git commit.

```typescript
interface ProjectedCommit {
  oid: string;
  subject: string;
  body: string;
  author: {
    name: string;
    email: string;
    timestamp: string; // ISO 8601 with commit's own timezone offset
  };
  committer: {
    name: string;
    email: string;
    timestamp: string; // ISO 8601 with commit's own timezone offset
  };
  parents: string[]; // Array of parent commit hashes. Empty for root commit. Two entries for merge commits.
  repository: {
    name: string; // Derived from remote origin URL or directory name
    url: string | null; // Remote origin URL, or null if not available
  };
  // Present only when --config is provided and plugins are active.
  extensions?: Record<string, string | number | boolean | Readonly<Record<string, unknown>> | null>;
}
```

### Example Output Line

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
  "parents": ["parenthash1"],
  "repository": { "name": "my-repo", "url": "https://github.com/org/my-repo" }
}
```

---

## Field Definitions

### `oid`

The full commit object ID (OID) string for the repository object format.

### `subject` and `body`

Derived by splitting `commit.message`:

- `subject`: first line of the message
- `body`: remaining lines after the first, joined with `\n`. Empty string `""` if no body exists.

### `author.timestamp` / `committer.timestamp`

ISO 8601 formatted timestamp with the commit's own timezone offset preserved. Example: `2024-01-15T09:00:00+09:00`.

### `parents`

Array of full commit hashes of parent commits.

- Root commit: `[]`
- Normal commit: `["<parent-hash>"]`
- Merge commit: `["<parent1-hash>", "<parent2-hash>"]`

### `repository`

Populated once per run and applied to every output line.

- `name`: derived from remote origin URL (last path segment, `.git` stripped), or directory name as fallback; overrideable with `--repo-name`
- `url`: raw remote origin URL string, or `null` if unavailable; overrideable with `--repo-url`

When `--repo-name` or `--repo-url` is provided, the override value replaces the auto-derived value in all output records. These overrides do not affect state-file identity or incremental extraction behavior.

### `extensions`

Present only when `--config` is provided and at least one plugin is active.

```typescript
/** Value written under an extension namespace. null is core-reserved (skip/fatal-skip-fact). */
type ProjectedExtensionValue = string | number | boolean | Readonly<Record<string, unknown>> | null;

type ProjectedExtensions = Record<string, ProjectedExtensionValue>;
```

Each key is a plugin namespace declared in the configuration file. A value of `null` means the
plugin skipped that fact (due to a `skip` result or a `fatal` result with `failurePolicy:
"skip-fact"`). Non-null values are whatever `success.data` returned: a plain object, a string, a
number, or a boolean. Key order in the serialized object matches plugin declaration order. When no
plugins are configured, the field is omitted from output records entirely.

The `extensions` field is also present on `ProjectedFileChange` (via `ProjectedCommit` inheritance)
when plugins are active in `--per-file` mode.

---

## File Rotation

### Output Filename Pattern

```
{prefix}-{timestamp}-{sequenceNumber}.jsonl
```

- `timestamp` is captured once per run (`YYYYMMDDTHHmmssZ`) and shared by all files in that run
- `sequenceNumber` is zero-padded to 6 digits: `000001`, `000002`, ...
- Sequence resets to `000001` on each new run

Example with prefix `my-repo`:

```
my-repo-20260513T120000Z-000001.jsonl
my-repo-20260513T120000Z-000002.jsonl
```

### Rotation Triggers

A new file is opened when **either** condition is met after writing a line:

- Line count in current file reaches `--rotate-lines`
- Byte size of current file reaches `--rotate-size`

The check occurs **after** writing each line. The line that triggered the threshold is included in the current file; the next line opens a new file.

### Rotation Behavior When Neither Flag Is Set

All output is written to a single file: `{prefix}-{timestamp}-000001.jsonl`.

---

## File-Level Output Schema

When `--per-file` is specified, each output line represents a single changed file within a commit.
Commits with multiple changed files produce multiple output lines. Commits with no changed files
(empty commits) produce no output lines.

Each line carries the full commit metadata (denormalized) plus file-specific fields:

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

### File-Specific Field Definitions

#### `file.path`

Relative path from the repository root. Uses `/` as the separator regardless of OS.

#### `file.status`

- `"added"`: file exists in this commit but not in the parent
- `"modified"`: file exists in both commits with different content
- `"deleted"`: file exists in the parent but not in this commit

Rename detection is not performed. A renamed file appears as a `"deleted"` entry for the old path and an `"added"` entry for the new path.

#### `file.additions` / `file.deletions`

Line-level diff statistics:

- `additions`: number of lines present in the new version but not in the old version
- `deletions`: number of lines present in the old version but not in the new version
- `null`: file is binary (contains NUL bytes in the first 8000 bytes); line-level statistics are not meaningful

For `"added"` files: `deletions` is `0`, `additions` is the total line count.
For `"deleted"` files: `additions` is `0`, `deletions` is the total line count.

### Merge Commit Handling

For merge commits (commits with multiple parents), file changes are computed against the **first parent only**. This represents "what the merge introduced relative to the mainline."

### Example Output Line (file mode)

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
  "parents": ["parenthash1"],
  "repository": { "name": "my-repo", "url": "https://github.com/org/my-repo" },
  "file": { "path": "src/auth/handler.ts", "status": "modified", "additions": 5, "deletions": 2 }
}
```

---

## Future Schema Extensions

These fields are **not yet implemented** but are reserved and must not be used for other purposes:

```typescript
// Commit-level embedded file array (--include-files flag)
// File-level output mode (--per-file) already provides equivalent analytical capability.
// This remains a convenience feature for users who prefer a single denormalized commit
// record with an embedded files array.
interface ProjectedCommitWithFiles extends ProjectedCommit {
  files?: Array<{
    path: string;
    status: "added" | "modified" | "deleted" | "renamed";
    additions: number;
    deletions: number;
  }>;
}

// Per-run execution metadata (first line only)
interface MetaLine {
  _meta: {
    extractedAt: string; // ISO 8601
    extractorVersion: string;
  };
}

// Configurable field inclusion/exclusion
// Fields such as author.email are PII and may need to be excluded
// This will be controlled via a --fields or --exclude-fields CLI option
```
