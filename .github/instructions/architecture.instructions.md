---
description: Architecture and component design for gitlode
applyTo: "src/**"
---

# Architecture & Component Design

## Layer Overview

```
┌───────────────────────────────────────────────────────────────┐
│ Process edge (`src/index.ts`)                                  │
│ Bootstrap, worker dispatch, final rendering, exit code         │
├───────────────────────────────────────────────────────────────┤
│ CLI / Presentation / Config / Runtime / State / Plugins        │
│ Input adaptation, terminal UI, execution wiring, Node I/O      │
├───────────────────────────────────────────────────────────────┤
│ Core Logic                                                     │
│ Extraction pipeline, traversal orchestration, projection       │
├───────────────────────────────────────────────────────────────┤
│ Profile                                                        │
│ Cross-domain profiling contracts and instrumentation utilities │
├───────────────────────────────────────────────────────────────┤
│ Git Adapter Interface / Output Sink Contract                   │
│ Ports consumed by Core                                         │
├───────────────────────────────────────────────────────────────┤
│ Git implementation / Output implementation                     │
│ isomorphic-git access, JSONL serialization, file rotation      │
├───────────────────────────────────────────────────────────────┤
│ Type-utils / Model / Support                                   │
│ Type-only utilities, shared vocabulary, and helper primitives  │
└───────────────────────────────────────────────────────────────┘
```

Dependency direction is a boundary rule, not a strict vertical stack. Higher-level domains may
depend on lower-level contracts and shared primitives, but low-level domains must not import from
runtime, CLI, presentation, or implementation-specific modules.

The Core Logic layer must never import from isomorphic-git directly. Core must depend on the Git
adapter interface and output sink contract, not on their concrete implementations.

`src/model/` is the shared Git extraction model: value types, branded strings, small predicates,
and vocabulary that is meaningful across multiple domains. `src/support/` is the shared
domain-free helper layer: generic collection, assertion, and parsing helpers that know nothing
about Git, extraction, CLI, output, plugins, or runtime execution.

`src/type-utils/` is the shared type-only utility layer: TypeScript utility types (for example
branding helpers) that may be imported across domains. `src/type-utils/` must not contain runtime
code.

`src/profile/` is the shared profiling layer: instrumentation contracts and helpers used by
multiple domains (for example Core and Git implementation) without creating reverse dependencies.

---

## Product Context and Design Principles

These principles govern design decisions across all layers. When a new feature or change creates
ambiguity about where logic belongs or what behavior is correct, use these as the deciding criteria.

- **gitlode is a faithful extractor, not an analytics engine.** Map Git object data exactly as
  stored. Do not infer, derive, or add attributes beyond what the spec explicitly defines. Leave
  interpretation to downstream systems.
- **The correctness guarantee is:** every commit reachable from the specified refs, within the
  specified range, appears exactly once in a single run's output. Any change that could violate
  this guarantee requires explicit justification.
- **Snapshot and incremental are user intent signals, not shortcuts.** Both modes must produce
  correct subsets of the DAG. `snapshot` = extract independently of prior state; `incremental` =
  extract only commits new since the last recorded state. Neither mode may silently produce a
  superset or a subset of the intended range.
- **Git's data model constraints are not gitlode limitations.** Commits carry no branch field;
  output order is not chronological; branch refs are mutable. These properties must be respected
  and documented, not worked around with fragile heuristics.
- **Interpretation belongs downstream.** gitlode outputs what Git stores. Derived attributes
  (e.g. branch membership per commit, authorship statistics, release attribution) are not gitlode
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
- `EnrichingFactProjector` is a Core-owned decorator that wraps `DefaultFactProjector` and
  invokes plugins declared in the configuration file.
- `PluginEntry`, `ProjectorPlugin`, `PluginFactory`, `ProjectionContext`, `PluginInitResult`,
  `PluginProjectionResult`, and `PluginFailurePolicy` are the stable plugin contract terms.

### Ownership and boundary rules

The following rules describe the target architecture. Existing files may temporarily violate them
while a migration is in progress, but new code should follow the target ownership unless a phase
document explicitly says otherwise.

- The runtime edge (`src/index.ts`) is the process boundary only. It performs bootstrap,
  main-process state preflight/loading, worker dispatch orchestration, and final fatal rendering /
  exit-code selection.
- State ownership belongs in `src/state/`: `NodeStateStore`, repository object-format gating, and
  prior-state loading / validation helpers used by the runtime edge.
- Presentation ownership belongs in `src/presentation/`: UI-mode selection, terminal presenter
  wiring, diagnostics, progress rendering, summary/profile rendering, styling, and quiet / TTY /
  non-TTY behavior.
- `src/runtime/client.ts` owns worker lifecycle wiring and typed message dispatch handling for
  progress, diagnostics, and terminal results.
- `src/runtime/worker-entry.ts` owns worker-side message adaptation from `parentPort` to runtime
  execution and maps thrown errors to typed terminal results.
- `src/runtime/execution.ts` owns per-run extraction orchestration, including repository access
  validation, prepared plugin entry consumption, coordinator construction, and success payload
  assembly. It must not import from `src/cli/`.
- Core owns traversal/extraction orchestration, pipeline branching by granularity, write-loop
  progression, state commit timing, and structured progress events.
- Core owns `EnrichingFactProjector` and the plugin contract types. `EnrichingFactProjector`
  calls the pure `projectCommit` / `projectFileChange` functions directly.
- CLI owns argument parsing, CLI option validation, CLI/config precedence decisions, and producing
  a runtime input. CLI must not own terminal rendering internals, state persistence, plugin module
  loading, or extraction execution.
- Config ownership belongs in `src/config/`: reading/validating the strict versioned config file,
  normalizing config-relative paths, and exposing validated config data. CLI consumes config data
  when applying CLI/config precedence.
- Plugin setup ownership belongs in `src/plugins/`: consuming the already validated `extensions`
  subsection, resolving module entrypoints, invoking plugin factories, compatibility checks, and
  running parallel `init()`. Plugin `init()` is a runtime boundary responsibility;
  `EnrichingFactProjector` never calls it.
- Model ownership belongs in `src/model/`: shared Git extraction vocabulary such as commit OID
  brands, OID profiles, ref types, and person identity types. Model must not import from any other
  source domain.
- Support ownership belongs in `src/support/`: generic helpers such as `assertNever`, indexed
  array accessors, map lookups, and regex capture helpers. Support must not contain Git, CLI,
  output, runtime, plugin, or config vocabulary.
- Type-utils ownership belongs in `src/type-utils/`: reusable TypeScript type utilities such as
  `Brand<T, Name>`. This domain is special: it is type-only and must not contain runtime code,
  side effects, I/O, or executable helper functions.
- Profile ownership belongs in `src/profile/`: profiling contracts and helpers such as
  `ProfilingEntry`, `StageProfiler`, `DefaultStageProfiler`, `withProfiler()`, and
  `withProfilerAsync()`. Profile must not depend on Core, Git adapter contracts, runtime wiring,
  or CLI/presentation implementations.
- Git adapter owns Git-native repository access and raw commit/file-change retrieval. Core must
  remain insulated from isomorphic-git details.
- Output layer owns serialization and rotation mechanics. Core must not duplicate writer rotation
  policy.
- Plugins must not be invoked from within the Git adapter or Output layer.

### Dependency rules

Only the imports listed below are allowed between `src/*` domains. Any `src/*` import not listed
is forbidden.

- Shared foundational domains:
  - `src/type-utils/`: imports from no `src/*` domains. Type-only domain; runtime code is
    forbidden.
  - `src/model/`: imports from `src/type-utils/` only.
  - `src/support/`: imports from `src/type-utils/` only.
  - `src/profile/`: imports from `src/type-utils/` and `src/support/` only.
- Runtime domains:
  - `src/git/`: imports from `src/type-utils/`, `src/model/`, and `src/support/`.
  - `src/git-impl/`: imports from `src/type-utils/`, `src/model/`, `src/support/`, `src/profile/`,
    and `src/git/`.
  - `src/core/`: imports from `src/type-utils/`, `src/model/`, `src/support/`, `src/profile/`,
    and `src/git/`.
  - `src/output/`: imports from `src/type-utils/`, `src/model/`, `src/support/`, and `src/core/`.
  - `src/config/`: imports from `src/type-utils/`, `src/model/`, and `src/support/`.
  - `src/plugins/`: imports from `src/type-utils/`, `src/model/`, `src/support/`, `src/config/`,
    and `src/core/`.
  - `src/state/`: imports from `src/type-utils/`, `src/model/`, `src/support/`, `src/profile/`,
    `src/git/`, and `src/core/`.
  - `src/runtime/`: imports from `src/type-utils/`, `src/model/`, `src/support/`, `src/profile/`,
    `src/config/`, `src/plugins/`, `src/state/`, `src/core/`, `src/git/`, `src/git-impl/`, and
    `src/output/`.
  - `src/cli/`: imports from `src/type-utils/`, `src/model/`, `src/support/`, and `src/config/`,
    plus public runtime input types.
  - `src/presentation/`: imports from `src/type-utils/`, `src/model/`, `src/support/`,
    progress contracts from `src/core/`, and profile contracts from `src/profile/`.

Additional constraints:

- `src/git-impl/` must not import from `src/core/` except for temporary migration shims.
- `src/core/` must not import from `src/cli/`, `src/presentation/`, `src/runtime/`,
  `src/git-impl/`, or concrete output writer modules.
- `src/runtime/` must not import from `src/cli/` or `src/presentation/`.
- `src/cli/` must not import from `src/git-impl/`, `src/output/`, or concrete runtime execution
  modules.

### Progress and profiling contracts

- Progress signaling is phase-aware via `ProgressReporter.emit(event)`.
- Successful non-quiet runs use stage-oriented stderr output (`Preparing extraction`,
  `Extracting history`, `Finalizing output`), then completion summary, then optional profile block.
- `--quiet` suppresses progress-stage lines, completion summary, and profile block, but warnings
  and errors remain visible.
- Success-report rendering is presentation-owned; it must not change the summary or profile text
  contract while moving between files.
- `ExtractionResult.profilingEntries` is hierarchical and rooted at `elapsed`.
- Profiling contracts are profile-domain owned and may be consumed by Core, Git implementation,
  runtime, and presentation without introducing reverse Core dependencies.

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
- Request config loading when `--config` is passed, merge CLI/config defaults, and pass effective
  settings to runtime execution
- Handle top-level errors and format user-facing error messages
- Exit with appropriate codes: `0` = success, `1` = user error, `2` = runtime error
- CLI does not own terminal UI rendering, state persistence, plugin module loading, or extraction
  execution internals.

### Model Layer (`src/model/`)

Responsibilities:

- Define shared Git extraction vocabulary used across domains.
- Own pure value types, branded string types, and domain predicates such as commit OID validation.
- Remain side-effect free and independent from all other `src/*` domains.

Examples of model-owned vocabulary:

- `CommitOid`
- `OidProfile`
- `PersonIdentity`
- `RefType`
- `isCommitOid()` / `isCommitOidForProfile()`

Model may import shared type-only utilities from `src/type-utils/`.

### Type Utilities Layer (`src/type-utils/`)

Responsibilities:

- Define reusable type-level utilities consumed across multiple domains.
- Provide shared branded-type helpers such as `Brand<T, Name>`.
- Remain type-only: no runtime values, no executable functions, no side effects.

Examples of type-utils-owned exports:

- `Brand<T, Name>`
- (optional) `Opaque<T, Name>` aliases when equivalent branding semantics are desired

### Support Layer (`src/support/`)

Responsibilities:

- Define tiny runtime helper functions shared across implementation modules.
- Keep generic helpers out of Core so importing a helper does not imply importing extraction logic.

Examples of support-owned helpers:

- `assertNever()`
- `atOrThrow()` / `firstOrThrow()` / `shiftOrThrow()` / `cyclicAtOrThrow()`
- `getOrThrow()`
- `captureGroupOrThrow()`

Do not place Git, extraction, output, CLI, config, runtime, presentation, or plugin vocabulary in
`src/support/`.

### Profile Layer (`src/profile/`)

Responsibilities:

- Define profiling contracts shared by multiple domains.
- Provide instrumentation helpers for sync and async stage profiling.
- Remain independent from Core extraction contracts and Git adapter contracts.

Examples of profile-owned exports:

- `ProfilingEntry`
- `StageProfiler`
- `DefaultStageProfiler`
- `withProfiler()` / `withProfilerAsync()`

`src/profile/` may depend on `src/type-utils/` and `src/support/` for shared helpers, but must not
depend on any domain-specific source module.

### Config Layer (`src/config/`)

Responsibilities:

- Read and validate the generic `version: 1` config file.
- Enforce strict unknown-key handling.
- Normalize config-relative paths.
- Expose validated config data to CLI/runtime/plugin setup without importing CLI implementation
  modules.

CLI remains responsible for CLI/config precedence and conflict rules because those rules depend on
which values were explicitly provided by command-line flags.

### Presentation Layer (`src/presentation/`)

Responsibilities:

- Render diagnostics, progress, summaries, and profile output.
- Own TTY vs non-TTY behavior, spinner/heartbeat handling, warning redraw behavior, styling, and
  quiet-mode output suppression.
- Accept structured progress/profile data from Core/runtime-facing contracts; do not call runtime
  execution or mutate extraction state.

### Plugin Setup Layer (`src/plugins/`)

Responsibilities:

- Resolve configured plugin entrypoints.
- Invoke plugin factories.
- Check package compatibility against `peerDependencies.gitlode`.
- Run plugin `init()` in parallel and normalize initialization failures.

Plugin compatibility checking must not be implemented in Core. `EnrichingFactProjector` consumes
prepared plugin entries and never resolves modules or calls `init()`.

### State Layer (`src/state/`)

Responsibilities:

- Implement Node-backed state file persistence.
- Validate loaded state against repository path, state schema version, ref type, and repository OID
  profile.
- Gate unsupported repository object formats before state boundaries are consumed.

State production timing remains Core-owned: successful extraction produces the next state only
after output completion. State file I/O remains a runtime/process-edge concern.

### Core Logic Layer (`src/core/`)

Responsibilities:

- Orchestrate commit traversal by calling `GitAdapter`
- Map raw commit data to the output JSON schema
- Apply differential filtering (`--since-ref` / `--since-date`); uses `continue` (not `break`) for `--since-date` because BFS order is not chronological
- Produce checkpoint state only after all output files are fully flushed and closed
- Write projected records through the `OutputSink` contract. Runtime wires the concrete
  `OutputWriterSink` / `OutputWriter`; rotation thresholds are enforced inside `OutputWriter`, not
  in Core.
- `src/core/enriching-fact-projector.ts` — `EnrichingFactProjector` decorator; wraps the default projector's pure functions and calls plugins in declaration order per fact

After the Phase 7 cleanup, `ExtractionCoordinator` owns pipeline construction, granularity
branching, the write loop, structured progress integration, sink lifecycle (`OutputSink.close()`),
and checkpoint state production timing. Runtime execution (`src/runtime/execution.ts`) constructs
the coordinator, stage instances, concrete sink, and progress reporter wiring for one run.
The runtime edge (`src/index.ts`) owns prior-state loading and final state-file writes in the main
process until the state layer migration is completed; `Extractor` no longer exists.
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
  /** Resolve a ref (branch name, tag, or raw commit OID) to a commit OID.
   *  Annotated tags are peeled to the target commit OID automatically. */
  resolveRef(repoPath: string, ref: string): Promise<string>;

  /** Detect repository object format. Defaults to "sha1" when unset. */
  getRepositoryObjectFormat(repoPath: string): Promise<string>;

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

  /** Find the common ancestor (merge base) commit OID among all provided commit OIDs.
   *  Returns null if no common ancestor exists (e.g. orphan branches). */
  findMergeBase(repoPath: string, commitOids: string[]): Promise<string | null>;
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
- Accepts an optional internal `DiffAdapter` in its constructor for line-diff strategy injection (defaults to `JsDiffAdapter`)
- Delegates line-diff computation to the injected `DiffAdapter`; binary detection (NUL-byte heuristic, first 8000 bytes) and the resulting `null/null` output for binary files remain owned by `IsomorphicGitAdapter` and bypass `DiffAdapter` entirely
- `DiffAdapter` and `JsDiffAdapter` are defined in `src/git/diff-adapter.ts` and are internal to the git adapter layer — not exported through `src/git/index.ts` or referenced by Core
- Must normalize `timezoneOffset` values when mapping isomorphic-git raw commit data to `RawPerson`:
  isomorphic-git stores UTC offsets with inverted sign (e.g., JST `+09:00` is stored as `-540`).
  This is because isomorphic-git follows JavaScript Date API semantics (`Date.getTimezoneOffset()`),
  which defines the value as minutes from local time to UTC and therefore uses the opposite sign of
  the common "UTC offset" representation.
  `RawPerson.timezoneOffset` in the `GitAdapter` contract is standard UTC offset minutes (positive
  east, negative west; JST = `+540`, PST = `-480`). Core must not compensate for this convention;
  the normalization responsibility belongs entirely in the adapter implementation.

### Output Layer (`src/output/`)

- Serialize `ProjectedRecord` objects (`ProjectedCommit | ProjectedFileChange`, defined in `src/core/types.ts`) to JSON Lines
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

### Rules for shared layers

- **`src/type-utils/index.ts`**, **`src/model/index.ts`**, and **`src/support/index.ts`** are
  re-export barrels only.
- `src/type-utils/` files are type-only modules. Runtime code is forbidden.
- `src/model/` files may contain exported type aliases, interfaces, constants, and pure predicates
  for shared Git extraction vocabulary. They must not contain Node I/O, runtime orchestration,
  terminal rendering, JSONL writer mechanics, or plugin loading.
- `src/support/` files may contain exported runtime helper functions only. They must not import
  from any source domain.
- When a helper needs domain vocabulary to be understood, it is not a support helper. Put it in the
  owning domain or in `src/model/` if the vocabulary is shared.
- When a helper is purely type-level and reusable across domains, place it in `src/type-utils/`.

This separation keeps type definitions discoverable and helps prevent circular imports between layers.

---

## State File

State production timing is managed by Core Logic. State file I/O is managed by the runtime/process
edge through the State layer and must be written atomically (write to temp file, then rename).

Schema:

```typescript
interface ExtractionState {
  version: 2;
  generatedAt: string; // ISO 8601
  repositoryPath: string;
  refs: readonly Array<{
    ref: string; // exact --ref token
    refType: "branch" | "tag-lightweight" | "tag-annotated" | "commit-oid";
    tipOid: string; // last successful tip used as the next incremental exclude boundary
    updatedAt: string; // ISO 8601
  }>;
}
```

Rules:

- State file is written **only after all output files for that run are fully flushed and closed**
- If extraction fails mid-run, the previous state file must remain unchanged
- In incremental mode, only version `2` state is accepted (no automatic migration from legacy schema)
- Checkpoint identity is strict by `(ref, refType)`
- Runtime must gate unsupported repository object formats before consuming state boundaries

---

## Error Handling Conventions

- All errors thrown from the Git Adapter must be wrapped in a `GitAdapterError` before propagating to Core
- User-facing errors (invalid args, missing repo, hash not found) must produce a clear single-line message without a stack trace
- Internal/unexpected errors should include the stack trace for debugging

### `GitAdapterError` Definition

```typescript
type GitAdapterErrorCode =
  | "REF_NOT_FOUND" // Specified branch/ref does not exist in the repository
  | "COMMIT_NOT_FOUND" // Specified commit OID does not exist or is not reachable
  | "NOT_A_REPOSITORY" // Target path is not a Git repository
  | "UNSUPPORTED_OBJECT_FORMAT" // Repository object format is outside runtime support
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

| Code               | Severity  | Core Behavior                                                |
| ------------------ | --------- | ------------------------------------------------------------ |
| `REF_NOT_FOUND`    | Fatal     | Abort with user-facing error message                         |
| `COMMIT_NOT_FOUND` | Fatal     | Abort with user-facing error message                         |
| `NOT_A_REPOSITORY` | Fatal     | Abort with user-facing error message                         |
| `REMOTE_NOT_FOUND` | Non-fatal | Log a warning; fall back to directory name for output prefix |
| `UNKNOWN`          | Fatal     | Abort; include stack trace in output                         |
