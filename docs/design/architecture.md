# gitrail Architecture

## Purpose

This document explains the implemented architecture in human-oriented terms.

Normative implementation rules remain in:

- `.github/instructions/architecture.instructions.md`
- `.github/instructions/cli.instructions.md`
- `.github/instructions/git-traversal.instructions.md`
- `.github/instructions/schema.instructions.md`

Use this document to understand design intent, boundaries, and trade-offs.

## Product Context

### What gitrail is for

gitrail is an ETL bridge between Git repositories and analytical systems (data warehouses, BI
tools, metrics pipelines). It converts Git's graph-structured commit history into a flat,
streaming-friendly format that analytical systems can ingest without understanding Git internals.

The analytical value gitrail targets is **aggregation**: grouping and counting commit events
across dimensions such as author, time period, or changed file area. This kind of analysis
requires loading the full history into a queryable system and cannot be done efficiently with
standard git tooling.

Two broad categories of aggregation motivate extraction:

- **People dimension**: developer activity patterns, authorship, commit frequency, team velocity,
  review and collaboration signals.
- **Product dimension**: release cadence, codebase evolution, branch lifecycle, technical debt
  indicators, change velocity by area.

gitrail's responsibility is faithful extraction. Interpretation — deriving metrics, aggregations,
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

This separation is also an extensibility principle: gitrail's core should expose canonical Git
facts, while organization-specific interpretation or enrichment should be attachable at the
pipeline boundary rather than embedded into the core extraction model.

### What gitrail is not for

Individual history inspection — "what commits touched this file?", "who last changed this
line?" — is handled well by git clients and IDEs. If an analysis can be answered efficiently
with `git log` or a standard git GUI, it is not a target use case for gitrail.

### When incremental extraction matters

Snapshot extraction (re-extracting all history on every run) is sufficient for one-time analyses
or small repositories. Incremental extraction becomes necessary when:

- The repository is continuously updated and the downstream system needs to stay in sync.
- Re-processing full history on every run is too slow or too costly.
- The downstream system uses an append-only or event-sourced ingestion model.

In these cases, `--incremental` with a state file provides a reliable checkpoint mechanism.

### Key implications of Git's data model

Several properties of Git's data model directly constrain what gitrail can and cannot guarantee.
These are not limitations of gitrail — they are fundamental properties of Git objects:

**Output order is not chronological.** gitrail traverses the commit DAG using BFS. Across merge
branches, BFS order does not match commit timestamp order. Downstream systems must sort by
`committer.timestamp` if chronological order is required; they must not rely on line order in
`.jsonl` output files.

**Commits carry no branch information.** A Git commit object stores only tree, parents, author,
committer, and message. There is no branch field. "Extracting branch X" means "walk the DAG from
the commit that ref X currently points to." The same commit can be reachable from multiple
branches simultaneously.

**Branch refs are mutable.** A branch pointer moves forward with new commits and can be rewritten
by a force-push. Extracted data represents a snapshot of the repository at extraction time. Branch
attribution inferred at extraction time may not hold after the repository changes.

**gitrail's correctness guarantee:** every commit reachable from the specified refs, within the
specified range, appears exactly once in a single run's output.

## System Overview

gitrail is a Node.js CLI that extracts commit history from a local Git repository and writes one
record per line as JSON Lines (commit-granularity by default, file-granularity with `--per-file`).

The architecture is layered:

1. CLI layer parses arguments and builds a validated configuration.
2. Core layer orchestrates traversal, filtering, mapping, deduplication, and state updates.
3. Git adapter layer isolates all repository access behind a small interface.
4. Output layer owns JSONL serialization and file rotation.

This layering keeps policy decisions in Core and implementation details in adapter/output modules.

## Layer Responsibilities

### CLI layer

Files:

- `src/index.ts`
- `src/cli/args.ts`
- `src/cli/index.ts`

Responsibilities:

- Parse and validate command arguments.
- Enforce mutual exclusion rules for differential options.
- Resolve derived defaults (for example output prefix).
- Convert validated args into runtime extraction inputs for coordinator execution.
- Handle top-level process exit behavior and user-facing errors.

Notably, state file reading and writing are not CLI responsibilities.

### Core layer

Files:

- `src/core/extraction-coordinator.ts`
- `src/core/branch-traversal-planner.ts`
- `src/core/commit-traversal-extractor.ts`
- `src/core/file-change-expander.ts`
- `src/core/commit-record-projector.ts`
- `src/core/file-change-record-projector.ts`
- `src/core/types.ts`
- `src/core/index.ts`

Responsibilities:

- Coordinate branch traversal through the adapter.
- Apply differential behavior for `--state`, `--since-ref`, and `--since-date`.
- Deduplicate commits across branches in one run.
- Map raw commit data to output schema objects.
- Coordinate output writer lifecycle.
- Read state at startup and write state atomically after successful completion.

Important behavior: for date filtering, Core skips old commits and continues traversal. It does not terminate early, because BFS graph traversal order is not chronological.

### Git adapter layer

Files:

- `src/git/isomorphic-git-adapter.ts`
- `src/git/errors.ts`
- `src/git/types.ts`
- `src/git/index.ts`

Responsibilities:

- Resolve refs to commit object IDs (OIDs).
- Detect repository object format (defaulting to `sha1` when unset).
- Read origin URL when available.
- Traverse commits reachable from a head commit, optionally excluding history reachable from `excludeHash`.
- Translate library/runtime failures into `GitAdapterError` codes.

The adapter uses isomorphic-git internally and keeps those details from leaking upward.

### Output layer

Files:

- `src/output/writer.ts`
- `src/output/utils.ts`
- `src/output/types.ts`
- `src/output/index.ts`

Responsibilities:

- Convert structured commits to JSONL lines.
- Track line and byte thresholds.
- Rotate output files when either threshold is reached.
- Guarantee LF line endings.

Core provides rotation settings, but Writer owns enforcement.

## End-to-End Runtime Flow

1. CLI parses args, validates rules, and resolves runtime extraction inputs.
2. CLI creates `IsomorphicGitAdapter`, `ProgressController`, and stage instances; calls `DefaultExtractionCoordinator.run()` directly.
3. Runtime edge loads state/checkpoint context if configured and passes it in `CoordinatorRequest`.
4. For each branch:
   - Resolve branch head.
   - Determine exclusion boundary.
   - Traverse commits from adapter.
   - Deduplicate within this run.
   - Apply optional date filter.
   - Map and write output.
5. Writer closes in `finally`.
6. If successful, Core writes new state atomically.

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

## Profiling Instrumentation

When `--profile` is set and extraction succeeds, gitrail emits per-stage timing to stderr:

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

| Entry path                 | Owning stage                                          | What is measured                                                       |
| -------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `elapsed`                  | `src/index.ts` root profiler                          | Total extraction wall/work duration                                    |
| `elapsed/planning`         | `BranchTraversalPlanner`                              | Branch-head resolution and exclude-hash planning                       |
| `elapsed/traversal`        | `CommitTraversalExtractor`                            | Commit traversal and commit-fact materialization                       |
| `elapsed/projection`       | `CommitRecordProjector` / `FileChangeRecordProjector` | Fact-to-output-record mapping                                          |
| `elapsed/write`            | `ExtractionCoordinator`                               | `sink.write()` and `sink.close()` only (not checkpoint write)          |
| `elapsed/git/blob-read`    | `IsomorphicGitAdapter`                                | Time reading file content blobs from the Git object store              |
| `elapsed/git/diff`         | `IsomorphicGitAdapter`                                | Time computing line-level diff statistics per file                     |
| `elapsed/git/...` children | `IsomorphicGitAdapter`                                | Additional Git-internal sub-stages such as `resolve-ref` and traversal |

A `StageProfiler` object is created per run at the runtime edge (`src/index.ts`) and passed to each stage
constructor. `IsomorphicGitAdapter` exposes a `setProfiler()` method (not on the `GitAdapter`
interface) that `src/index.ts` calls via duck-typing. This keeps the `GitAdapter` contract stable
while enabling profiling of adapter internals.

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

## Non-goals in current design

- Chronological ordering guarantees in output line sequence.
- Global deduplication across independent runs.
- Branch metadata embedded into commit objects.

## References

- `README.md`
- `.github/instructions/architecture.instructions.md`
- `.github/instructions/cli.instructions.md`
- `.github/instructions/git-traversal.instructions.md`
- `.github/instructions/schema.instructions.md`
