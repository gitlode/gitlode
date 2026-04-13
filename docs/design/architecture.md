# gitrail Architecture

## Purpose

This document explains the implemented architecture in human-oriented terms.

Normative implementation rules remain in:

- `.github/instructions/architecture.instructions.md`
- `.github/instructions/cli.instructions.md`
- `.github/instructions/git-traversal.instructions.md`
- `.github/instructions/schema.instructions.md`

Use this document to understand design intent, boundaries, and trade-offs.

## System Overview

gitrail is a Node.js CLI that extracts commit history from a local Git repository and writes one commit per line as JSON Lines.

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
- Convert validated args into `ExtractorConfig`.
- Handle top-level process exit behavior and user-facing errors.

Notably, state file reading and writing are not CLI responsibilities.

### Core layer

Files:

- `src/core/extractor.ts`
- `src/core/types.ts`
- `src/core/index.ts`

Responsibilities:

- Coordinate branch traversal through the adapter.
- Apply differential behavior for `--state`, `--since-commit`, and `--since-date`.
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

- Resolve refs to commit hashes.
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

1. CLI parses args, validates rules, and builds `ExtractorConfig`.
2. CLI creates `IsomorphicGitAdapter` and `Extractor`.
3. Core loads state if configured.
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

## Error Model

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
