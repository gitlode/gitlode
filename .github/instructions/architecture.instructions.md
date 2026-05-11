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

## v0.4.0 Migration Contract

The v0.4.0 release introduces a phased architecture redesign from the current mixed-responsibility
`Extractor` flow to an explicit fact-based pipeline. During this migration, planning and
implementation sessions must treat the following contract as binding.

### Target end-state vocabulary

- `CommitFact` and `FileChangeFact` are the stable Core-owned terms for intermediate extraction data.
- `CheckpointStore`, `ExtractionCheckpoint`, and `BranchCheckpoint` are the stable Core-owned terms
  for checkpoint persistence contracts.
- `ExtractionTimings` is the stable Core-owned term for stage-aligned extraction timing data.
- `ExtractionCoordinator`, `CommitTraversalExtractor`, `FileChangeExpander`,
  `CommitRecordProjector`, `FileChangeRecordProjector`, and `OutputSink` are the target named stage
  boundaries for the redesigned pipeline.

### Migration boundary rules

- The redesign is phased. Do not collapse the migration into a single rewrite.
- `Extractor` remains the compatibility facade until the dedicated coordinator/orchestration phase
  explicitly replaces its mixed responsibilities.
- The compatibility facade and remaining checkpoint-vocabulary aliases are removed in the final
  Phase 7 cleanup once progress redesign decisions are fixed.
- Phases 3 and 4 have completed their designated splits: file-granularity branching now lives in
  dedicated expander/projector modules, and checkpoint commit timing, sink lifecycle ownership, and
  progress ownership now live in `ExtractionCoordinator`.
- CLI-visible behavior, output schema semantics, and the current `ExtractionResult` shape must
  remain unchanged unless a later release phase explicitly redesigns those user-facing contracts.

### Ownership rules during migration

- Core owns the fact vocabulary, checkpoint vocabulary, traversal/extraction workflow, and the
  compatibility seams needed to preserve behavior while the pipeline is being split.
- The Git adapter continues to own Git-native raw commit/file-change data and repository access
  primitives; it must not be reshaped around the new fact vocabulary prematurely.
- The output layer continues to own `OutputRecord` serialization, rotation, and concrete file
  writing concerns.
- Domain-oriented stage boundaries are preferred over using `OutputRecord` as the final Core
  boundary. Projection remains distinct from traversal and from persistence in the target design.

### Phase 2 traversal-stage contract (implemented)

- Phase 2 now exposes two Core-owned stage boundaries: `BranchTraversalPlanner` in
  `src/core/branch-traversal-planner.ts` and `CommitTraversalExtractor` in
  `src/core/commit-traversal-extractor.ts`.
- `BranchTraversalPlanner` owns branch-head resolution and collection, per-branch
  exclusion-boundary calculation, merge-base calculation for newly added branches, and
  missing-branch warning behavior. It returns ordered `BranchTraversalPlan[]` values.
- `CommitTraversalExtractor` consumes those plans and owns sequential branch traversal,
  cross-branch deduplication, `since-date` filtering, and `COMMIT_NOT_FOUND` fallback behavior.
  It does not resolve refs or build checkpoints.
- Both stages consume already-loaded checkpoint data from `Extractor`; neither stage reads or
  writes `CheckpointStore`, and neither stage decides checkpoint commit timing.
- `Extractor` remains responsible for repository/checkpoint loading, candidate checkpoint
  composition from the planner output, output projection, file-change expansion,
  output-writer lifecycle, progress ownership, and persisting the checkpoint only after
  successful output completion.
- `Extractor` constructs `DefaultBranchTraversalPlanner` and
  `DefaultCommitTraversalExtractor` internally — no new runtime wiring surface is exposed
  through `src/index.ts`.

### Phase 3 expansion and projection stage contracts (implemented)

- `FileChangeExpander` is introduced to separate file-change expansion from traversal and projection.
- It owns the transformation of `CommitFact` into `FileChangeFact` by calling `GitAdapter.getFileChanges()`
  for each commit and expanding zero or more file changes per commit. Expander semantics remain unchanged
  from the original: root commits have all files as "added"; merge commits use first-parent file changes;
  binary files have `null` additions/deletions; empty commits produce zero output.
- It consumes an `AsyncIterable<CommitFact>` and produces an `AsyncIterable<FileChangeFact>`. It receives
  `repositoryPath` and a `GitAdapter` injected into its constructor.
- `CommitRecordProjector` and `FileChangeRecordProjector` are introduced to separate output schema
  projection from expansion and traversal.
- Each projector owns the transformation of facts into output schema: `CommitFact` → `OutputCommit` and
  `FileChangeFact` → `OutputFileRecord` respectively.
- Projectors are stateless; they receive repository metadata (name, URL) in the constructor and perform
  pure transformations. They do not read `GitAdapter`, `CheckpointStore`, or `OutputWriter`.
- `Extractor` makes the decision about which projector pipeline to use (`if outputMode === "file" then
expander → file projector, else commit projector`) before consuming the projection output. This moves
  granularity branching out of the write loop but keeps the orchestration decision in `Extractor` for now.
  In Phase 4, this decision moves to `ExtractionCoordinator`.
- `Extractor` remains responsible for: checkpoint store I/O, writer lifecycle, progress ownership, metrics
  aggregation, and persisting the traversal stage's candidate checkpoint only after successful writer close.

### Phase 4 coordinator and sink contracts (implemented)

- `ExtractionCoordinator` is introduced as the orchestration stage that replaces `Extractor`'s execution
  engine role. It is defined as a Core-owned interface plus one concrete implementation
  `DefaultExtractionCoordinator`.
- `ExtractionCoordinator` owns: pipeline construction (selecting traversal → commit projector or
  traversal → expander → file projector based on `CoordinatorRequest.granularity`), the write loop
  (iterating the projected `OutputRecord` stream and calling `OutputSink.write()`), progress
  integration (`reporter.progress()` immediately after each successful write), `reporter.done()`
  and `sink.close()` in a `finally` block, and writing the final `ExtractionCheckpoint` only after
  successful pipeline completion and sink close.
- `ExtractionCoordinator` receives a `CoordinatorRequest` (Core-owned narrower request type, not
  `ExtractorConfig`) and returns a `CoordinatorResult`. `CoordinatorRequest` uses Core-preferred
  field names: `granularity` (not `outputMode`), `priorCheckpoint` (not the stateMap), etc.
- `OutputSink` is introduced as a Core-owned interface (`write`, `close`, `filesCreated`,
  `bytesWritten`). The concrete implementation `OutputWriterSink` in `src/output/` wraps the
  existing `OutputWriter` without modifying it.
- `Extractor` becomes a compatibility wrapper: it loads the prior checkpoint (including
  missing-state fallback logic and validation), derives repository metadata, constructs all stage
  instances and the coordinator, calls `coordinator.run()`, and builds `ExtractionResult` from the
  result and sink metrics. `src/index.ts` is unchanged.
- Checkpoint write ordering: `sink.close()` always executes in the coordinator's `finally` block.
  The checkpoint write is placed after the `try/finally` and executes only when the pipeline
  completes without exception and `close()` succeeds. This preserves the current invariant exactly.
- The `CheckpointStore` dependency in the coordinator is optional (`CheckpointStore | undefined`);
  when absent (snapshot mode without `--state`), the coordinator skips the checkpoint write.
- `ExtractionResult` shape and `src/index.ts` runtime wiring remain unchanged in Phase 4.

### Phase 6 profiling contract (implemented)

- Phase 6 introduces stage-aligned performance instrumentation without changing default extraction
  semantics.
- `ExtractionResult` now carries `profilingEntries: readonly ProfilingEntry[]` rather than a flat
  `timings` object.
- `ProfilingEntry` is a Core-owned record with `name`, `wallMs`, and `workMs`. Entry names are
  slash-separated paths rooted at `elapsed`, for example `elapsed/traversal` or
  `elapsed/git/blob-read`.
- `StageProfiler` is the Core-owned abstraction that accumulates hierarchical timing entries.
  Profilers are scoped per run and may create child profilers via `createScopedProfiler(name)`.
- Timing ownership follows the existing stage boundaries, but is represented as profiler paths
  instead of fixed scalar buckets:
  - `elapsed/planning` for `BranchTraversalPlanner`
  - `elapsed/traversal` for `CommitTraversalExtractor`
  - `elapsed/projection` for the active projector
  - `elapsed/write` for `ExtractionCoordinator` around `OutputSink.write()` and `OutputSink.close()`
  - `elapsed/git/blob-read` and `elapsed/git/diff` for `IsomorphicGitAdapter.getFileChanges()` internals
  - additional `elapsed/git/...` children for adapter sub-stages such as `resolve-ref` and commit walking
- The root `elapsed` entry remains the authoritative total duration within the profiling tree.
- The `GitAdapter` interface remains unchanged in Phase 6. Profiling must not alter
  `getFileChanges()` return values or add profiling metadata to Core-facing adapter contracts.
- The CLI adds a boolean `--profile` flag that prints successful-run timing output as an aligned
  multi-line block to stderr. `--quiet` suppresses profile output together with the normal
  progress/summary stderr output.
- The current CLI wiring enables detailed stage profilers only when `--profile` is requested,
  while still returning the root `elapsed` entry on successful runs.
- Failure-path partial timing output is out of scope for Phase 6; extraction errors preserve the
  current error-path behavior.

### Phase 7 progress and cleanup contract (implemented)

- Phase 7 design refinement is complete. The UX contract and implementation design are finalized
  and ready for implementation session.
- Phase 7 replaces the old scalar `Reporter` (`warn/progress/done`) with a single phase-aware
  `ProgressReporter.emit(event)` pathway. Core emits structured progress facts; CLI owns terminal
  rendering policy.
- CLI layer owns phase state machine (`preparing` → `extracting` → `finalizing`), phase-aware
  progress tracking (branch index, commit count, record count, bytes written), fixed `500ms`
  heartbeat checks for spinner + elapsed refresh, stage line rendering, final summary rendering,
  and warning interruption handling. Core's coordinator is stateless with respect to rendering
  policy.
- `DefaultExtractionCoordinator` tracks `commitsTraversed` by wrapping the `CommitFact` stream
  with a counter before expansion/projection. It also tracks branch index/count during traversal.
  Both are exposed in `CoordinatorResult` for use by the CLI layer's real-time progress tracking.
- Liveness is a first-class UX requirement. Every active stage must remain visibly alive even when
  semantic counters are temporarily unchanged. The liveness signal is `spinner + elapsed`, with a
  silence budget of at most `1s` between visible refreshes while a stage is active. Node.js timer
  callbacks fire reliably between `for await` iterations in the coordinator's write loop, so
  `setInterval` with fixed `500ms` checks is fully feasible and requires no fallback; all pipeline
  stages are async-first with no blocking work. Heartbeat checks must suppress redundant redraws
  when a recent semantic redraw already occurred.
- The CLI-visible stderr contract for successful non-quiet runs is fixed as:
  - a `Preparing extraction` stage line
  - an `Extracting history` stage line whose active line updates in place
  - a `Finalizing output` stage line
  - an aligned completion summary block with the field order `Records written`,
    `Commits traversed`, `Files created`, `Bytes written`, `Elapsed time`, `Branches`
  - an aligned `--profile` block after a single blank line when profiling is requested
- Preparing/finalizing stage lines show spinner and elapsed time while active. The extracting
  stage line shows spinner, branch position, `commitsTraversed`, `recordsWritten`, humanized
  `bytesWritten`, and elapsed time.
- Heartbeat updates and semantic updates are distinct. Spinner-frame + elapsed refreshes are
  required every ~1s even when branch position or write counters have not advanced recently.
- The active stage line updates at most once per second during steady-state work, plus immediate
  updates on stage transitions, semantic progress changes, warning recovery redraws, and final
  completion.
- If a warning interrupts an in-place progress line, the runtime edge prints the warning on its
  own line and redraws the active stage line afterward.
- `--quiet` suppresses progress-stage lines, the default completion summary, and the profile block,
  but it does not suppress warnings or errors.
- Migration cleanup (Phase 7 scope): remove the `Extractor` compatibility facade entirely. The
  runtime edge (`src/index.ts`) constructs `DefaultExtractionCoordinator`, stage instances,
  `CheckpointStore` (when `--state` is set), `OutputSink`, and the `ProgressReporter` directly.
  Remove checkpoint vocabulary compatibility aliases (`StateStore`, `StateFile`,
  `StateBranchEntry`) from `src/core/types.ts` everywhere in the codebase.

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
- Apply differential filtering (since-commit / since-date); uses `continue` (not `break`) for `--since-date` because BFS order is not chronological
- Read the state file at startup; write it atomically (`.tmp` → rename) only after all output files are fully flushed and closed
- Instantiate `OutputWriter` with the rotation config — rotation thresholds are enforced inside `OutputWriter`, not in Core

After the Phase 7 cleanup, `ExtractionCoordinator` owns pipeline construction, granularity
branching, the write loop, structured progress integration, sink lifecycle (`OutputSink.close()`),
and checkpoint commit timing. The runtime edge constructs the coordinator, stage instances,
checkpoint store, sink, and progress reporter directly; `Extractor` no longer exists.
`CommitTraversalExtractor`, `FileChangeExpander`, `CommitRecordProjector`, and
`FileChangeRecordProjector` own traversal, expansion, and projection respectively. `OutputSink`
(backed by `OutputWriterSink`) owns record serialization and file rotation. `CheckpointStore`
reads and writes checkpoints but does not decide timing.

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
  /** Resolve a ref (branch name) to a commit hash */
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

Every layer follows a consistent two-file pattern:

- **`types.ts`** — all TypeScript interfaces and type aliases for that layer. No runtime code.
- **`index.ts`** — re-export barrel only. No type definitions or logic.

This separation was introduced in Phase 2 to keep type definitions discoverable and to prevent circular imports between layers.

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
