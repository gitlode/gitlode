---
description: Architecture and component design for gitrail
applyTo: "src/**"
---

# Architecture & Component Design

## Layer Overview

```
┌─────────────────────────────────┐
│           CLI Layer             │  Argument parsing, validation, error display
├─────────────────────────────────┤
│         Core Logic Layer        │  Commit traversal orchestration, JSON mapping, file rotation
├─────────────────────────────────┤
│      Git Adapter Interface      │  Abstract interface — isolates isomorphic-git dependency
├─────────────────────────────────┤
│    isomorphic-git (external)    │  Actual Git object access
└─────────────────────────────────┘
```

Each layer must only depend on the layer directly below it. The Core Logic layer must never import from isomorphic-git directly.

---

## Component Responsibilities

### CLI Layer (`src/cli/`)

- Parse and validate CLI arguments (see `cli.instructions.md` for full parameter spec)
- Enforce mutual-exclusion rules between parameters
- Load and validate the state file if `--state` is provided
- Instantiate Core and pass resolved config
- Handle top-level errors and format user-facing error messages
- Exit with appropriate codes: `0` = success, `1` = user error, `2` = runtime error

### Core Logic Layer (`src/core/`)

Responsibilities:

- Orchestrate commit traversal by calling `GitAdapter`
- Map raw commit data to the output JSON schema
- Apply differential filtering (since-commit / since-date)
- Manage file rotation logic (line count / byte size thresholds)
- Update the state file atomically after successful output

Key types:

```typescript
interface ExtractorConfig {
  repositoryPath: string;
  branches: string[]; // At least one required
  outputDir: string;
  outputPrefix: string;
  rotation: RotationConfig;
  range?: { type: "commit"; hash: string } | { type: "date"; since: Date };
  stateFilePath?: string;
}

interface RotationConfig {
  maxLines?: number;
  maxBytes?: number;
}
```

### Git Adapter Interface (`src/git/`)

The interface abstracts all Git operations. Core Logic must program against this interface only.

```typescript
interface GitAdapter {
  /** Resolve a ref (branch name) to a commit hash */
  resolveRef(repoPath: string, ref: string): Promise<string>;

  /** Walk commits reachable from `head`, stopping before `excludeHash` if provided.
   *  Commit order is not guaranteed — consumers must not rely on line order for
   *  chronological sorting. Each commit carries a `committer.timestamp` for that purpose. */
  walkCommits(repoPath: string, head: string, excludeHash?: string): AsyncIterable<RawCommit>;

  /** Return the remote URL for `origin`, or null if not set */
  getRemoteUrl(repoPath: string): Promise<string | null>;
}

interface RawCommit {
  oid: string;
  message: string;
  author: {
    name: string;
    email: string;
    timestamp: number; // Unix seconds
    timezoneOffset: number; // minutes from UTC (e.g. +540 for JST)
  };
  committer: {
    name: string;
    email: string;
    timestamp: number;
    timezoneOffset: number;
  };
  parents: string[];
}
```

### isomorphic-git Adapter (`src/git/isomorphic-git-adapter.ts`)

The concrete implementation of `GitAdapter` using isomorphic-git.

- Uses `isomorphic-git`'s `log()` and `walk()` APIs
- Implements commit exclusion via reachability check (see `git-traversal.instructions.md`)
- Must not leak isomorphic-git types outside this file

### Output Layer (`src/output/`)

- Serialize `OutputCommit` objects to JSON Lines
- Track current file's line count and byte size
- Rotate to a new file when thresholds are exceeded
- Generate output filenames: `{prefix}-{sequenceNumber padded to 6 digits}.jsonl`
- Use `\n` (LF) as line endings — never `\r\n`

---

## State File

Managed by Core Logic. Written atomically (write to temp file, then rename).

Schema:

```typescript
interface StateFile {
  version: 1;
  generatedAt: string; // ISO 8601
  repositoryPath: string;
  branches: Array<{
    name: string;
    lastCommitHash: string;
  }>;
}
```

Rules:

- State file is written **only after all output files for that run are fully flushed and closed**
- If extraction fails mid-run, the previous state file must remain unchanged
- On next run, if a branch in the state file no longer exists in the repo, log a warning and skip that branch

---

## Error Handling Conventions

- All errors thrown from the Git Adapter must be wrapped in a `GitAdapterError` before propagating to Core
- User-facing errors (invalid args, missing repo, hash not found) must produce a clear single-line message without a stack trace
- Internal/unexpected errors should include the stack trace for debugging

### `GitAdapterError` Definition

```typescript
type GitAdapterErrorCode =
  | "REF_NOT_FOUND" // Specified branch/ref does not exist in the repository
  | "COMMIT_NOT_FOUND" // Specified commit hash does not exist or is not reachable
  | "NOT_A_REPOSITORY" // Target path is not a Git repository
  | "REMOTE_NOT_FOUND" // Remote origin is not configured (non-fatal; triggers fallback)
  | "UNKNOWN"; // Unexpected error from the underlying library

class GitAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: GitAdapterErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GitAdapterError";
  }
}
```

### Error Code Handling in Core Logic

Core Logic must inspect `code` to determine the appropriate response:

| Code               | Severity  | Core Behaviour                                               |
| ------------------ | --------- | ------------------------------------------------------------ |
| `REF_NOT_FOUND`    | Fatal     | Abort with user-facing error message                         |
| `COMMIT_NOT_FOUND` | Fatal     | Abort with user-facing error message                         |
| `NOT_A_REPOSITORY` | Fatal     | Abort with user-facing error message                         |
| `REMOTE_NOT_FOUND` | Non-fatal | Log a warning; fall back to directory name for output prefix |
| `UNKNOWN`          | Fatal     | Abort; include stack trace in output                         |
