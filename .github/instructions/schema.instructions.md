---
description: Output JSON schema and file rotation specification for gitrail
applyTo: "src/output/**"
---

# Output JSON Schema & File Format

## Format Overview

- **Format**: JSON Lines (JSONL) — one JSON object per line
- **Line ending**: `\n` (LF only — never `\r\n`)
- **File extension**: `.jsonl`
- **Encoding**: UTF-8

---

## Initial Implementation Schema

Each line is a single JSON object representing one Git commit.

```typescript
interface OutputCommit {
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

The full 40-character commit hash.

### `subject` and `body`

Derived by splitting `commit.message`:

- `subject`: first line of the message
- `body`: remaining lines after the first, joined with `\n`. Empty string `""` if no body exists.

```typescript
function splitMessage(message: string): { subject: string; body: string } {
  const lines = message.split("\n");
  const subject = lines[0] ?? "";
  const body = lines.slice(1).join("\n").trim();
  return { subject, body };
}
```

### `author.timestamp` / `committer.timestamp`

Convert from isomorphic-git's raw values using the **offset embedded in the commit object itself** — do not use the system timezone.

isomorphic-git returns:

```typescript
{
  timestamp: number; // Unix seconds (e.g. 1705312800)
  timezoneOffset: number; // Minutes offset from UTC (e.g. -540 for JST = UTC+9)
}
```

Note: isomorphic-git's `timezoneOffset` is **negated** relative to convention (JST = `-540`, not `+540`). Account for this during conversion.

Conversion algorithm:

```typescript
function toISO8601(timestamp: number, timezoneOffset: number): string {
  // timezoneOffset from isomorphic-git is negated: JST = -540
  const offsetMinutes = -timezoneOffset;
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHH = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMM = String(absOffset % 60).padStart(2, "0");
  const offsetStr = `${offsetSign}${offsetHH}:${offsetMM}`;

  const localMs = (timestamp + offsetMinutes * 60) * 1000;
  const d = new Date(localMs);
  const YYYY = d.getUTCFullYear();
  const MM = String(d.getUTCMonth() + 1).padStart(2, "0");
  const DD = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}${offsetStr}`;
}
```

### `parents`

Array of full commit hashes of parent commits.

- Root commit: `[]`
- Normal commit: `["<parent-hash>"]`
- Merge commit: `["<parent1-hash>", "<parent2-hash>"]`

### `repository`

Populated once per run and applied to every output line.

- `name`: derived from remote origin URL (last path segment, `.git` stripped), or directory name as fallback
- `url`: raw remote origin URL string, or `null` if unavailable

---

## File Rotation

### Output Filename Pattern

```
{prefix}-{sequenceNumber}.jsonl
```

- `sequenceNumber` is zero-padded to 6 digits: `000001`, `000002`, ...
- Sequence resets to `000001` on each new run

Example with prefix `my-repo`:

```
my-repo-000001.jsonl
my-repo-000002.jsonl
```

### Rotation Triggers

A new file is opened when **either** condition is met after writing a line:

- Line count in current file reaches `--rotate-lines`
- Byte size of current file reaches `--rotate-size`

The check occurs **after** writing each line. The line that triggered the threshold is included in the current file; the next line opens a new file.

### Rotation Behaviour When Neither Flag Is Set

All output is written to a single file: `{prefix}-000001.jsonl`.

---

## Future Schema Extensions (Phase 2+)

These fields are **not implemented in the initial version** but are reserved and must not be used for other purposes:

```typescript
// Phase 2 — file-level diff stats per commit
interface OutputCommitWithFiles extends OutputCommit {
  files?: Array<{
    path: string;
    status: "added" | "modified" | "deleted" | "renamed";
    additions: number;
    deletions: number;
  }>;
}

// Phase 2 — per-run execution metadata (first line only)
interface MetaLine {
  _meta: {
    extractedAt: string; // ISO 8601
    extractorVersion: string;
  };
}

// Phase 2 — configurable field inclusion/exclusion
// Fields such as author.email are PII and may need to be excluded
// This will be controlled via a --fields or --exclude-fields CLI option
```
