# gitlode Architecture

## Purpose

This document is the canonical architecture design for gitlode. Use it to understand durable
implementation boundaries, design intent, and trade-offs.

Agent-specific entrypoints such as `AGENTS.md` and `.github/instructions/*.instructions.md` may
summarize or route to this document, but they must not replace it as the durable architecture source
of truth.

## Product Context

### What gitlode is for

gitlode is an ETL bridge between Git repositories and analytical systems (data warehouses, BI
tools, metrics pipelines). It converts Git's graph-structured commit history into a flat,
streaming-friendly format that analytical systems can ingest without understanding Git internals.

The analytical value gitlode targets is **aggregation**: grouping and counting commit events
across dimensions such as author, time period, or changed file area. This kind of analysis
requires loading the full history into a queryable system and cannot be done efficiently with
standard git tooling.

Two broad categories of aggregation motivate extraction:

- **People dimension**: developer activity patterns, authorship, commit frequency, team velocity,
  review and collaboration signals.
- **Product dimension**: release cadence, codebase evolution, branch lifecycle, technical debt
  indicators, change velocity by area.

gitlode's responsibility is faithful extraction. Interpretation — deriving metrics, aggregations,
or insights from the data — belongs to the downstream system.

A useful design lens for output schema decisions: fields act as either **aggregation axes**
(dimensions — who, when, what area) or **quantitative targets** (measures — how many, how much).
A finer-grained axis is analytically useful only when the data also carries a measure that varies
meaningfully at that granularity.

Core output grains should therefore prefer entities that are both Git-native and analytically
stable across repositories and tooling choices. Finer-grained structures derived from diff
presentation may still be useful, but they are usually better treated as derived signals or
pipeline enrichments than as default first-class output records unless they establish a reusable
axis/measure pair with broad value.

This separation is also an extensibility principle: gitlode's core should expose canonical Git
facts, while organization-specific interpretation or enrichment should be attachable at the
pipeline boundary rather than embedded into the core extraction model.

### What gitlode is not for

Individual history inspection — "what commits touched this file?", "who last changed this
line?" — is handled well by git clients and IDEs. If an analysis can be answered efficiently
with `git log` or a standard git GUI, it is not a target use case for gitlode.

### When incremental extraction matters

Snapshot extraction (re-extracting all history on every run) is sufficient for one-time analyses
or small repositories. Incremental extraction becomes necessary when:

- The repository is continuously updated and the downstream system needs to stay in sync.
- Re-processing full history on every run is too slow or too costly.
- The downstream system uses an append-only or event-sourced ingestion model.

In these cases, `--incremental` with a state file provides a reliable checkpoint mechanism.

### Key implications of Git's data model

Several properties of Git's data model directly constrain what gitlode can and cannot guarantee.
These are not limitations of gitlode — they are fundamental properties of Git objects:

**Output order is not chronological or otherwise stable.** gitlode traverses the commit DAG by
walking parent links. Across merge branches, graph traversal order does not match commit timestamp
order. Downstream systems must sort by
`committer.timestamp` if chronological order is required; they must not rely on line order in
`.jsonl` output files.

**Commits carry no branch information.** A Git commit object stores only tree, parents, author,
committer, and message. There is no branch field. "Extracting branch X" means "walk the DAG from
the commit that ref X currently points to." The same commit can be reachable from multiple
branches simultaneously.

**Branch refs are mutable.** A branch pointer moves forward with new commits and can be rewritten
by a force-push. Extracted data represents a snapshot of the repository at extraction time. Branch
attribution inferred at extraction time may not hold after the repository changes.

**gitlode's correctness guarantee:** every commit reachable from the specified refs, within the
specified range, appears exactly once in a single run's output.

## System Overview

gitlode is a Node.js CLI that extracts commit history from a local Git repository and writes one
record per line as JSON Lines (commit-granularity by default, file-granularity with `--per-file`).

The architecture is layered:

1. CLI layer parses arguments and builds a validated configuration.
2. Core layer orchestrates traversal, filtering, mapping, deduplication, and checkpoint state production.
3. Git adapter layer isolates all repository access behind a small interface.
4. Output layer owns JSONL serialization and file rotation.

This layering keeps policy decisions in Core and implementation details in adapter/output modules.

`packages/gitlode/src/dag/` is an internal generic DAG subsystem used below the Git adapter boundary. It owns node-ID-based traversal algorithms and graph-work instrumentation, but it is not part of the package public API. Git-specific code implements a topology port and calls the DAG subsystem; the DAG subsystem must not depend on Git commit objects, adapter caches, isomorphic-git errors, or Git-specific scheduling hints.

The phase-certified prototype remains internal and production-unconnected. Its module ownership is split so `phase-certified.ts` owns facade orchestration, instrumentation boundaries, default FIFO/preserve frontier creation, and the difference/closure frontier loops; `certified-closure.ts` owns the closure state machine for split, branch, join, terminal, and closed-boundary resolution; `phase-certified-difference-state.ts` owns include-side graph state, certified exclude integration, certified-hit classification, and final drain; and `phase-certified-types.ts` owns shared generic contracts used by those modules. Telemetry counter names and meanings, scheduling semantics, and Git-specific timestamp policy ownership remain unchanged.

## Layer Responsibilities

### CLI layer

Files:

- `packages/gitlode/src/index.ts`
- `packages/gitlode/src/cli/args.ts`
- `packages/gitlode/src/cli/index.ts`
- `packages/gitlode/src/cli/runtime/*`
- `packages/gitlode/src/runtime/types.ts`
- `packages/gitlode/src/runtime/client.ts`
- `packages/gitlode/src/runtime/worker-entry.ts`
- `packages/gitlode/src/runtime/execution.ts`

Responsibilities:

- Parse and validate command arguments.
- Enforce mutual exclusion rules for differential options.
- Resolve effective settings from CLI/config precedence and derived defaults (for example output prefix).
- Resolve config-only Git adapter selection from `runtime.gitAdapter`.
- Convert validated args into worker-safe runtime extraction inputs.
- Own the runtime helpers that wire main-process prior-state loading, progress presentation,
  worker dispatch, plugin bootstrap, and successful-run rendering without widening
  `src/index.ts` beyond the process boundary.
- Handle top-level process exit behavior and user-facing errors.

In the current worker boundary design, state file reading and writing are main-process
responsibilities in the runtime edge (`src/index.ts`) using `src/cli/runtime/state-store.ts`
helpers.

### Core layer

Files:

- `packages/gitlode/src/core/extraction-coordinator.ts`
- `packages/gitlode/src/core/branch-traversal-planner.ts`
- `packages/gitlode/src/core/commit-traversal-extractor.ts`
- `packages/gitlode/src/core/file-change-expander.ts`
- `packages/gitlode/src/core/commit-record-projector.ts`
- `packages/gitlode/src/core/file-change-record-projector.ts`
- `packages/gitlode/src/core/types.ts`
- `packages/gitlode/src/core/index.ts`

Responsibilities:

- Coordinate ref traversal through the adapter.
- Apply differential behavior for `--state`, `--since-ref`, and `--since-date`.
- Deduplicate commits across refs in one run.
- Map raw commit data to output schema objects.
- Coordinate output writer lifecycle.
- Produce v2 checkpoint state only after successful output completion and sink close.

Important behavior: for date filtering, Core skips old commits and continues traversal. It does not terminate early, because graph traversal order is not chronological.

### Git adapter layer

Files:

- `packages/gitlode/src/git/isomorphic-git-adapter.ts`
- `packages/gitlode/src/git/diff-adapter.ts`
- `packages/gitlode/src/git/errors.ts`
- `packages/gitlode/src/git/types.ts`
- `packages/gitlode/src/git/index.ts`

Responsibilities:

- Resolve refs to commit object IDs (OIDs).
- Detect repository object format (defaulting to `sha1` when unset).
- Read origin URL when available.
- Traverse commits reachable from a head commit, optionally excluding history reachable from `excludeHash`.
- Implement the commit DAG topology port used by the internal `src/dag` traversal subsystem.
- Keep invocation-scoped commit object caching shared between topology reads and yielded-commit materialization.
- Record adapter-level commit read/cache/yield telemetry and translate library/runtime failures into `GitAdapterError` codes.
- Compute per-file line-level diff statistics via an internal `DiffAdapter` strategy.

The default adapter uses isomorphic-git internally and keeps those details from leaking upward. Commit traversal uses the generic `src/dag` certified-lazy strategy as the production default, with a Git adapter-injected LIFO/preserve frontier. Git child timestamp scheduling hints and the timestamp-priority frontier experiment are owned by `packages/gitlode/src/git-impl/commit-traversal/`; phase-certified traversal remains an internal prototype and is not connected to production commit walking. The
config-only `runtime.gitAdapter` setting selects the Git implementation. The default value is
`isomorphic-git`; `git-cli` uses the Git executable for traversal-oriented operations and delegates
file-change expansion to the existing isomorphic-git implementation. Durable adapter-selection and
implementation-boundary details live in `docs/design/git-adapters.md`.

Line-diff computation is delegated to an internal `DiffAdapter` strategy interface defined in
`diff-adapter.ts`. The default implementation (`JsDiffAdapter`) reproduces the original behavior
using the `diff` package's `diffLines` function with UTF-8 decoding. Binary detection (NUL-byte
heuristic on the first 8000 bytes) is owned by `IsomorphicGitAdapter` and bypasses `DiffAdapter`
entirely — binary files always produce `additions: null` and `deletions: null`. The `DiffAdapter`
interface is internal to the git adapter layer and is not exported through `src/git/index.ts`.

### Output layer

Files:

- `packages/gitlode/src/output/writer.ts`
- `packages/gitlode/src/output/utils.ts`
- `packages/gitlode/src/output/types.ts`
- `packages/gitlode/src/output/index.ts`

Responsibilities:

- Convert structured commits to JSONL lines.
- Track line and byte thresholds.
- Rotate output files when either threshold is reached.
- Guarantee LF line endings.

Core provides rotation settings, but Writer owns enforcement.

## End-to-End Runtime Flow

1. CLI parses args, validates rules, and resolves runtime extraction inputs.
2. Runtime edge (`src/index.ts`) creates progress/presenter runtime and validates repository object format.
3. Runtime edge loads prior state/checkpoint context when configured.
4. Runtime edge dispatches one `WorkerRunRequest` to `src/runtime/worker-entry.ts` via `src/runtime/client.ts`.
5. Worker-side runtime execution (`src/runtime/execution.ts`) builds stage instances and calls `DefaultExtractionCoordinator.run()`.
6. For each requested ref in the worker:
   - Resolve ref head.
   - Classify runtime ref type.
   - Determine exclusion boundary (exact checkpoint match, or branch merge-base fallback for newly added branches).
   - Traverse commits from adapter.
   - Deduplicate within this run.
   - Apply optional date filter.
   - Map and write output.
7. Worker posts typed progress/diagnostic/result messages back to main.
8. On success, main process writes new v2 state (`refs[]`) atomically, then renders summary/profile.

## Design Decisions and Trade-offs

### Adapter boundary over direct library calls

Why:

- Keeps Core testable with fakes.
- Limits dependency blast radius if Git backend changes later.

Trade-off:

- Requires explicit error mapping and adapter maintenance.

### Streaming traversal and writing

Why:

- Supports repositories with large history.
- Avoids loading all commits into memory.

Trade-off:

- Output ordering is graph traversal order, not chronological order.

### State write after successful output only

Why:

- Prevents advancing checkpoints on partial failures.

Trade-off:

- Failed runs may redo already-traversed work on retry.

### Session-level deduplication

Why:

- Avoids duplicates when branches share history in one execution.

Trade-off:

- Does not solve cross-run duplicates when new branches are introduced later.

## File Layout Convention

Each layer follows:

- `types.ts` for interfaces/type aliases only.
- `index.ts` as a re-export barrel.

This improves type discoverability and keeps runtime modules focused.

Source domains expose their supported in-repository import boundary through `index.ts`. Cross-domain
imports must use the target domain barrel, while direct module imports are allowed within the same
domain for implementation details that are not part of the supported boundary. Tests should mirror
source ownership where practical; cross-domain integration tests live with the primary subject under
test, and same-domain implementation tests may import the specific internal module they inspect.

## Profiling Instrumentation

When `--profile` is set and extraction succeeds, gitlode emits per-stage timing to stderr:

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

Profiling entries are accumulated by the stage that owns each operation:

| Entry path                 | Owning stage                                              | What is measured                                                       |
| -------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `elapsed`                  | `packages/gitlode/src/runtime/execution.ts` root profiler | Total extraction wall/work duration                                    |
| `elapsed/planning`         | `BranchTraversalPlanner`                                  | Branch-head resolution and exclude-hash planning                       |
| `elapsed/traversal`        | `CommitTraversalExtractor`                                | Commit traversal and commit-fact materialization                       |
| `elapsed/projection`       | `CommitRecordProjector` / `FileChangeRecordProjector`     | Fact-to-output-record mapping                                          |
| `elapsed/write`            | `ExtractionCoordinator`                                   | `sink.write()` and `sink.close()` only (not checkpoint write)          |
| `elapsed/git/blob-read`    | `IsomorphicGitAdapter`                                    | Time reading file content blobs from the Git object store              |
| `elapsed/git/diff`         | `IsomorphicGitAdapter`                                    | Time computing line-level diff statistics per file                     |
| `elapsed/git/...` children | `IsomorphicGitAdapter`                                    | Additional Git-internal sub-stages such as `resolve-ref` and traversal |

A `StageProfiler` object is created per run inside `packages/gitlode/src/runtime/execution.ts`
and passed to each stage constructor. `IsomorphicGitAdapter` accepts profiling through its concrete
dependency object (not on the `GitAdapter` interface). This keeps the `GitAdapter` contract stable
while enabling profiling of adapter internals without mutable post-construction wiring.

`ExtractionResult.profilingEntries` is populated on every successful run. The root `elapsed` entry
is always present. The `--profile` flag controls stderr rendering of the aligned profile block and,
via the current CLI wiring, enables the detailed stage profilers beneath the root entry.

In commit-granularity mode (no `--per-file`), `elapsed/git/blob-read` and `elapsed/git/diff`
remain at `0` because `getFileChanges()` is never called.

`--quiet` suppresses the profile block together with the normal progress and summary output.

- User input and validation errors are surfaced with clear single-line messages.
- Adapter operational failures are represented as typed `GitAdapterError` values.
- Runtime failures preserve debugging detail at the top level.

## Extensibility Notes

Areas that can evolve with low coupling impact:

- Additional output formats by adding new writers behind Core mapping.
- Progress reporting and post-run summaries in CLI and/or Core return shape.
- Cross-run deduplication strategies using merge-base heuristics.

## Plugin Runtime

The plugin system (introduced in v0.7.0) provides a structured boundary at which custom logic can
attach to the extraction process and add optional fields to output records.

### Layer responsibilities

- **`src/cli/plugins.ts`** — config file loading and validation, module resolution, factory
  invocation, and parallel `init()` orchestration. All file I/O and dynamic imports happen here.
- **`src/runtime/execution.ts`** — run-scoped plugin bootstrap orchestration and projector
  selection.
- **`src/cli/runtime/progress-runtime.ts`** — UI-mode selection and presenter wiring for the
  stderr progress/success pipeline.
- **`src/cli/runtime/success-report.ts`** — successful-run summary and profile rendering.
- **`src/cli/runtime/state-store.ts`** — state persistence helpers and repository object-format
  gating.
- **`src/core/enriching-fact-projector.ts`** — `EnrichingFactProjector` wraps the default
  projector and calls each configured plugin's `project()` per fact in declaration order.
- **`src/core/types.ts`** — all plugin contract types: `ProjectorPlugin`, `PluginEntry`,
  `PluginFactory`, `PluginInitResult`, `PluginProjectionResult`, `PluginProjectionValue`,
  `ProjectionContext`, `PluginFailurePolicy`. Also defines the projection record shapes consumed
  downstream: `ProjectedCommit`, `ProjectedFileChange`, `ProjectedRecord`, the
  `ProjectedExtensionValue` type (`PluginProjectionValue | null`), and the `ProjectedExtensions`
  type alias used for the optional `extensions` field on every projected record.

### Wiring at the runtime edge (`src/index.ts`)

`src/index.ts` is now the process boundary only. It parses CLI input, validates state preconditions,
delegates one-run extraction execution to a worker through `src/runtime/client.ts`, and performs
the final state write, stderr rendering, and exit-code selection.

When `--config` is provided:

1. Config is loaded and validated by the generic loader (`src/cli/config/loader.ts`).
2. Effective settings are merged (refs/range/output/repository/profile) using CLI-over-config precedence.
3. Plugin entries are resolved and instantiated from the validated `extensions` subsection (`resolvePluginEntries`).
4. Per-entry profilers are attached if effective profiling is enabled.
5. `init()` is called in parallel on all entries (`initializePlugins`). Any fatal result aborts.
6. `EnrichingFactProjector` is used in place of `DefaultFactProjector`.
7. Progress phase `"initializing-plugins"` runs before `"preparing"` only when `extensions` is present.

When no `extensions` section is present, plugin loading and initialization are skipped,
`DefaultFactProjector` is used directly, and `extensions` is omitted from output.

### Boundary rules

- Plugins must not be invoked from within the Git adapter or Output layer.
- `EnrichingFactProjector` calls the pure `projectCommit` / `projectFileChange` functions directly
  rather than delegating to the wrapped inner projector. This keeps the decorator self-contained.
- Plugin `init()` is the CLI layer's responsibility; `EnrichingFactProjector` never calls it.

For the full plugin contract and example, see [docs/design/plugins.md](plugins.md).

## Non-goals in current design

- Chronological ordering guarantees in output line sequence.
- Global deduplication across independent runs.
- Branch metadata embedded into commit objects.

## References

- `README.md`
- `packages/gitlode/docs/design/cli.md`
- `packages/gitlode/docs/design/git-traversal.md`
- `packages/gitlode/docs/design/schema.md`
- `packages/gitlode/docs/design/plugins.md`
