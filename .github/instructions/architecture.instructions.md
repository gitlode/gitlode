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
│         Core Logic Layer        │  Commit traversal orchestration, JSON mapping, state file management
├─────────────────────────────────┤
│      Git Adapter Interface      │  Abstract interface — isolates isomorphic-git dependency
├─────────────────────────────────┤
│    isomorphic-git (external)    │  Actual Git object access
└─────────────────────────────────┘
```

Each layer must only depend on the layer directly below it. The Core Logic layer must never import from isomorphic-git directly.

---

## Product Context and Design Principles

These principles govern design decisions across all layers. When a new feature or change creates
ambiguity about where logic belongs or what behavior is correct, use these as the deciding criteria.

- **gitrail is a faithful extractor, not an analytics engine.** Map Git object data exactly as
  stored. Do not infer, derive, or add attributes beyond what the spec explicitly defines. Leave
  interpretation to downstream systems.
- **The correctness guarantee is:** every commit reachable from the specified refs, within the
  specified range, appears exactly once in a single run's output. Any change that could violate
  this guarantee requires explicit justification.
- **Snapshot and incremental are user intent signals, not shortcuts.** Both modes must produce
  correct subsets of the DAG. `snapshot` = extract independently of prior state; `incremental` =
  extract only commits new since the last recorded state. Neither mode may silently produce a
  superset or a subset of the intended range.
- **Git's data model constraints are not gitrail limitations.** Commits carry no branch field;
  output order is not chronological; branch refs are mutable. These properties must be respected
  and documented, not worked around with fragile heuristics.
- **Interpretation belongs downstream.** gitrail outputs what Git stores. Derived attributes
  (e.g. branch membership per commit, authorship statistics, release attribution) are not gitrail
  responsibilities and must not be added without a deliberate spec change.

---

## Current Architecture Contract

This file is a current-state contract, not a release history record. Historical implementation
details belong in `CHANGELOG.md`.

### Canonical vocabulary

- `CommitFact` and `FileChangeFact` are the stable Core-owned intermediate terms.
- `Fact = CommitFact | FileChangeFact` is the discriminated union over all pipeline fact types.
- `StateStore`, `ExtractionState`, and `BranchState` are the stable state persistence terms.
- `ProfilingEntry` (`ExtractionResult.profilingEntries`) is the stable profiling term.
- `ExtractionCoordinator`, `CommitTraversalExtractor`, `FileChangeExpander`,
  `FactProjector`, and `OutputSink` are the stable pipeline stage boundaries.

### Ownership and boundary rules

- The runtime edge (`src/index.ts`) constructs `DefaultExtractionCoordinator`, stage instances,
  optional `StateStore` (`--state`), `OutputSink`, and `ProgressReporter` directly.
  `DefaultFactProjector` is the single projector instance passed to `DefaultExtractionCoordinator`.
- Core owns traversal/extraction orchestration, pipeline branching by granularity, write-loop
  progression, state commit timing, and structured progress events.
- CLI owns rendering policy (TTY vs non-TTY, spinner/heartbeat, summary/profile layout, warning
  redraw behavior) and top-level process/error behavior.
- Git adapter owns Git-native repository access and raw commit/file-change retrieval. Core must
  remain insulated from isomorphic-git details.
- Output layer owns serialization and rotation mechanics. Core must not duplicate writer rotation
  policy.

### Progress and profiling contracts

- Progress signaling is phase-aware via `ProgressReporter.emit(event)`.
- Successful non-quiet runs use stage-oriented stderr output (`Preparing extraction`,
  `Extracting history`, `Finalizing output`), then completion summary, then optional profile block.
- `--quiet` suppresses progress-stage lines, completion summary, and profile block, but warnings
  and errors remain visible.
- `ExtractionResult.profilingEntries` is hierarchical and rooted at `elapsed`.
- Adapter-facing contracts must not be polluted with profiling metadata.

### Invariants

- State is committed only after successful output completion and sink close.
- `OutputSink.close()` must run on both success and failure paths.
- Progress counters must advance only after successful write operations.
- Filtering by date must continue traversal (`continue`, not `break`) because traversal order is
  not chronological.

---

## Component Responsibilities

### CLI Layer (`src/cli/`)

- Parse and validate CLI arguments (see `cli.instructions.md` for full parameter spec)
- Enforce mutual-exclusion rules between parameters
- Instantiate Core and pass resolved config (including `stateFilePath` as a string — state file I/O is performed by Core, not CLI)
- Handle top-level errors and format user-facing error messages
- Exit with appropriate codes: `0` = success, `1` = user error, `2` = runtime error

### Core Logic Layer (`src/core/`)

Responsibilities:

- Orchestrate commit traversal by calling `GitAdapter`
- Map raw commit data to the output JSON schema
- Apply differential filtering (`--since-ref` / `--since-date`); uses `continue` (not `break`) for `--since-date` because BFS order is not chronological
- Read the state file at startup; write it atomically (`.tmp` → rename) only after all output files are fully flushed and closed
- Instantiate `OutputWriter` with the rotation config — rotation thresholds are enforced inside `OutputWriter`, not in Core

After the Phase 7 cleanup, `ExtractionCoordinator` owns pipeline construction, granularity
branching, the write loop, structured progress integration, sink lifecycle (`OutputSink.close()`),
and state commit timing. The runtime edge constructs the coordinator, stage instances, state
store, sink, and progress reporter directly; `Extractor` no longer exists.
`CommitTraversalExtractor`, `FileChangeExpander`, and `FactProjector` own traversal, expansion,
and projection respectively. `FactProjector` receives a unified `AsyncIterable<Fact>` stream and
dispatches internally by `fact.type`. `OutputSink` (backed by `OutputWriterSink`) owns record
serialization and file rotation. `StateStore` reads and writes state but does not decide timing.

Key types:

```typescript
type ExtractionRange = { type: "commit"; hash: string } | { type: "date"; since: Date };

interface ExtractorConfig {
  repositoryPath: string;
  branches: string[]; // At least one required
  outputDir: string;
  outputPrefix: string;
  rotation: RotationConfig;
  incremental: boolean;
  missingState?: "error" | "snapshot";
  perFile: boolean;
  range?: ExtractionRange;
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
  /** Resolve a ref (branch name, tag, or raw 40-hex commit OID) to a commit hash.
   *  Annotated tags are peeled to the target commit OID automatically. */
  resolveRef(repoPath: string, ref: string): Promise<string>;

  /** Walk commits reachable from `head`, stopping before `excludeHash` if provided.
   *  Commit order is not guaranteed — consumers must not rely on line order for
   *  chronological sorting. Each commit carries a `committer.timestamp` for that purpose. */
  walkCommits(repoPath: string, head: string, excludeHash?: string): AsyncIterable<RawCommit>;

  /** Return the remote URL for `origin`, or null if not set */
  getRemoteUrl(repoPath: string): Promise<string | null>;

  /** Return per-file change info between `commitOid` and `parentOid`.
   *  If `parentOid` is omitted (root commit), all files in the commit tree are "added".
   *  Binary files have `additions: null` and `deletions: null`. */
  getFileChanges(
    repoPath: string,
    commitOid: string,
    parentOid?: string,
  ): Promise<readonly FileChange[]>;

  /** Find the common ancestor (merge base) commit hash among all provided commit hashes.
   *  Returns null if no common ancestor exists (e.g. orphan branches). */
  findMergeBase(repoPath: string, commitHashes: string[]): Promise<string | null>;
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

interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number | null; // null for binary files
  deletions: number | null; // null for binary files
}
```

### isomorphic-git Adapter (`src/git/isomorphic-git-adapter.ts`)

The concrete implementation of `GitAdapter` using isomorphic-git.

- Uses `isomorphic-git`'s `readCommit()` (BFS traversal), `resolveRef()`, `getConfig()`, and `walk()` + `TREE()` (file diff) APIs
- Does **not** use isomorphic-git's `log()` API; BFS is implemented manually using `readCommit()` in a queue loop
- Implements commit exclusion via reachability pre-computation (see `git-traversal.instructions.md`)
- Must not leak isomorphic-git types outside this file
- Accepts an optional `FsClient` in its constructor for dependency injection (defaults to `node:fs`)

### Output Layer (`src/output/`)

- Serialize `OutputRecord` objects (`OutputCommit | OutputFileRecord`) to JSON Lines
- Track current file's line count and byte size
- Rotate to a new file when thresholds are exceeded
- Generate output filenames: `{prefix}-{timestamp}-{sequenceNumber padded to 6 digits}.jsonl`
- Use `\n` (LF) as line endings — never `\r\n`

---

## File Layout Convention

### Philosophy

The goal is to minimize the blast radius of change. When a new domain, stage, or feature is added, modifications should be localized: the contract definition goes in one place and the runtime implementation goes in another. This makes it possible to read `types.ts` as a complete map of what the layer does without opening implementation files, and to change an implementation without inadvertently affecting other consumers of the contract.

Dependency direction is the core discipline:

- `types.ts` must not depend on implementation modules.
- Implementation modules depend on `types.ts`, never on each other's exported contracts.
- When a new stage is introduced, add its interface to `types.ts` first; this makes the contract visible and reviewable before any runtime code is written.

Violating this separation leads to circular imports, naming drift (interfaces accumulating in implementation files and becoming hard to discover), and changes propagating across module boundaries unexpectedly.

### Rules for the Core layer (`src/core/`)

- **`src/core/types.ts`** is the single home for all exported Core interfaces, type aliases, and structural dependency contracts. No runtime code (no classes, generators, or function implementations).
- **`src/core/index.ts`** is a re-export barrel only. No type definitions or logic.
- **Each implementation module** (`src/core/*.ts` other than `types.ts` and `index.ts`) holds only the concrete class(es) and helpers needed to satisfy one contract from `types.ts`. Exported interface declarations must not live in these files.
- When a Core stage has both a public interface and a default implementation, the interface belongs in `src/core/types.ts` and the default implementation belongs in its own module file.
- This rule applies to all current and future stage boundaries: `ExtractionCoordinator`, `BranchTraversalPlanner`, `CommitTraversalExtractor`, `FileChangeExpander`, `FactProjector`, `StateStore`, and any stage introduced by future phases.

### Rules for other layers

- **`types.ts`** in each layer — all TypeScript interfaces and type aliases for that layer. No runtime code.
- **`index.ts`** in each layer — re-export barrel only. No type definitions or logic.
- The same dependency-direction principle applies: type files must not depend on implementation files within the same layer.

This separation keeps type definitions discoverable and helps prevent circular imports between layers.

---

## State File

Managed by Core Logic. Written atomically (write to temp file, then rename).

Schema:

```typescript
interface ExtractionState {
  version: 1;
  generatedAt: string; // ISO 8601
  repositoryPath: string;
  branches: readonly Array<{
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
