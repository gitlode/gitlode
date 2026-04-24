### Phase 3: File-Change Expansion and Projector Split

_Introduce `FileChangeExpander` and split output projection into `CommitRecordProjector` and `FileChangeRecordProjector` so output-granularity branching moves out of traversal and away from the mixed `Extractor` write loop, while preserving current CLI-visible behavior and output schema semantics._

#### Status

- [x] Planned
- [ ] In progress
- [ ] Completed

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- [`../instructions/architecture.instructions.md`](../instructions/architecture.instructions.md) — v0.4.0 Migration Contract, Core layer responsibilities, migration ownership rules
- [`../instructions/git-traversal.instructions.md`](../instructions/git-traversal.instructions.md) — expansion scope and file-change semantics
- [`../instructions/schema.instructions.md`](../instructions/schema.instructions.md) — output schema definitions for commit and file-granularity records
- [`phase-1.md`](phase-1.md) — stable `CommitFact` and `FileChangeFact` vocabulary baseline
- [`phase-2.md`](phase-2.md) — `CommitTraversalExtractor` contract and responsibilities
- Roadmap item: "Architecture: Fact-based extraction pipeline and orchestration split"

#### Design Decisions

- **Preferred API / library / Node.js built-in**: Continue using the existing `GitAdapter`, `OutputWriter`, `Reporter`, `WallClock`, `MonotonicClock`, and checkpoint-store implementation. Introduce three new Core runtime modules (`FileChangeExpander`, `CommitRecordProjector`, `FileChangeRecordProjector`) with no new runtime dependencies.

- **Owning layer and abstraction scope**: Core owns `FileChangeExpander`, `CommitRecordProjector`, and `FileChangeRecordProjector` as named stage boundaries. Each stage is defined as an interface plus one concrete implementation in this phase to establish a stable contract for later phases (particularly `ExtractionCoordinator` in Phase 4). The interfaces are justified because they are part of the named stage boundaries from the v0.4.0 migration contract and represent the boundary between traversal facts and output records. Each interface is intentionally narrow: one transformation method and a fixed request/response contract only.

- **FileChangeExpander ownership and contract**:
  - Consumes: `AsyncIterable<CommitFact>` and receives `repositoryPath` (for Git adapter calls).
  - Produces: `AsyncIterable<FileChangeFact>` where each input `CommitFact` maps to zero or more output `FileChangeFact` (one per file change from `GitAdapter.getFileChanges()`).
  - Dependencies: receives a `GitAdapter` instance injected into constructor; does not read `CheckpointStore`, `OutputWriter`, or receive any progress/state management responsibility.
  - File-change expansion follows the existing semantics: calls `GitAdapter.getFileChanges()` with the commit OID and the first parent (or undefined for root commits); merge commits use first parent only; binary files have `null` additions/deletions; empty commits produce zero `FileChangeFact` output.
  - Expander implementation is stateless; all state (visited set, progress, output metrics) remains in `Extractor`.

- **CommitRecordProjector ownership and contract**:
  - Consumes: `AsyncIterable<CommitFact>` and repository metadata (name, URL).
  - Produces: `AsyncIterable<OutputCommit>` via direct mapping of `CommitFact` fields to `OutputCommit` schema fields.
  - Dependencies: no Git adapter needed; uses only pure data transformation from the fact to output record.
  - Implementation receives repository metadata in constructor (or as method parameter) for immutability; performs no I/O and maintains no state.

- **FileChangeRecordProjector ownership and contract**:
  - Consumes: `AsyncIterable<FileChangeFact>` and repository metadata (name, URL).
  - Produces: `AsyncIterable<OutputFileRecord>` by combining the underlying `CommitFact` fields with the `FileChangeFact` file-specific fields.
  - Dependencies: no Git adapter needed; uses only pure data transformation.
  - Implementation follows the same immutable-metadata, stateless pattern as `CommitRecordProjector`.

- **Granularity branching location**:
  - Current state: granularity branching (`outputMode === "commit" | "file"`) is embedded in the write loop inside `Extractor`, mixing traversal/expansion/projection/output-writing concerns.
  - Phase 3 state: branching moves to the caller (still `Extractor` in this phase) before selecting which projector pipeline to use. The decision becomes: "if file mode, use expander then file projector; otherwise use commit projector." The write loop becomes simpler — it just consumes the projected `OutputRecord` stream without knowing whether it came from expansion or not.
  - Future (Phase 4): this branching decision will move to `ExtractionCoordinator` once it is introduced; `Extractor` will no longer make this choice.
  - This design preserves the current output behavior exactly while moving responsibility boundaries in a way that is compatible with later coordinator ownership.

- **Responsibilities explicitly preserved in Extractor**:
  - Orchestration of `CommitTraversalExtractor` (from Phase 2).
  - Decision about which projector pipeline to use based on `outputMode` (for now; moves to Coordinator in Phase 4).
  - Output writer lifecycle (creation, flushing, close, metrics collection).
  - Progress ownership: increments happen only after successful write, metrics advance from writer not from individual stages.
  - Checkpoint store I/O: reads state file at startup, validates checkpoint data, persists the checkpoint returned by traversal only after successful writer close.
  - Repository metadata derivation (`deriveRepoName()`).
  - `ExtractionResult` metric collection and final reporting.

- **Helpers that move**:
  - File-change expansion logic currently in `Extractor` (the `for await` loop that calls `GitAdapter.getFileChanges()` and yields expanded records) moves into `FileChangeExpander.expand()`.
  - Output mapping logic (`mapToOutputCommit()`, `mapToOutputFileRecord()`) moves into the projector implementations. These helper functions become methods of the concrete projectors or remain as module-level helpers if projectors are structured as functions.

- **Helpers that stay**:
  - `deriveRepoName()` stays in `Extractor` because it is called once per run to compute the metadata that is passed to projectors.
  - Repository metadata preparation stays in `Extractor` because it is used by both projectors.
  - `splitMessage()` and `toISO8601()` remain in the output layer (already there).
  - Writer creation, lifecycle, and metrics collection stay in `Extractor`.

- **Fact types used within Phase 3**: `CommitFact` and `FileChangeFact` are the internal Core vocabulary (from Phase 1). They are not exposed outside Core and are not used by `OutputWriter` or CLI layer. The output layer continues to consume only `OutputRecord` (`OutputCommit | OutputFileRecord`).

- **Output stream (stderr / progress reporting)**: No change. Progress warnings, per-branch warnings, and final done messages remain in `Extractor` and are emitted at the current points in time. The stage boundaries introduced in Phase 3 do not emit warnings or progress output directly.

- **Timing / measurement**: Keep wall-clock and monotonic timing ownership in `Extractor.run()`. Projectors and expander perform no timing. Do not introduce stage profiling or new timing fields in this phase.

- **New runtime dependencies**: none.

- **Edge case behavior**: Preserve all current semantics exactly. Empty commits (zero file changes in file mode) produce zero output records; the write loop does not advance progress; no empty output file is created. Commit mode always produces exactly one output record per commit. Merge commits use first-parent file changes only. Root commits have empty parent list. Snapshot and incremental modes use the same projection logic.

- **Intentionally untouched files in Phase 3**: `src/cli/**`, `src/git/**`, `src/index.ts`, `src/output/writer.ts`, and the `CheckpointStore`/`StateStore` implementation remain untouched. These boundaries stay as-is until Phase 4. The goal is to create clear expander/projector boundaries without disturbing the checkpoint or I/O layers.

#### Non-Goals

- Introducing `ExtractionCoordinator`, `OutputSink`, or any orchestration-layer abstractions; those belong to Phase 4.
- Moving checkpoint-store ownership, checkpoint commit timing, output-writer lifecycle, or overall progress ownership out of `Extractor`; that belongs to Phase 4.
- Splitting the writer lifecycle or introducing multiple concurrent output targets; that belongs to Phase 4 and beyond.
- Redesigning CLI flags, config field names, user-facing terminology, or the `ExtractionResult` shape; that belongs to Phase 5 or later work.
- Performing broad identifier cleanup beyond the expander/projector contract types needed to establish the new boundaries.
- Introducing stage-specific profiling or metrics; measurement architecture belongs to Phase 6.

#### Target Files

| File                                             | Action | Notes                                                                                                                                                          |
| ------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/file-change-expander.ts`               | Add    | New module with `FileChangeExpander` interface and concrete implementation; stateless async iterable transformer that expands commits to file changes.         |
| `src/core/commit-record-projector.ts`            | Add    | New module with `CommitRecordProjector` interface and concrete implementation; stateless async iterable transformer that projects `CommitFact` to output.      |
| `src/core/file-change-record-projector.ts`       | Add    | New module with `FileChangeRecordProjector` interface and concrete implementation; stateless async iterable transformer that projects `FileChangeFact` output. |
| `src/core/types.ts`                              | Modify | Add interfaces for `FileChangeExpander`, `CommitRecordProjector`, `FileChangeRecordProjector`; update any Core-owned types if needed for the new stages.       |
| `src/core/index.ts`                              | Modify | Re-export new stage interfaces and concrete implementations.                                                                                                   |
| `src/core/extractor.ts`                          | Modify | Remove file-change expansion and output projection logic; delegate to expander and projectors; move granularity branching decision before projector selection. |
| `test/core/file-change-expander.test.ts`         | Add    | Stage-focused unit tests with synthetic `CommitFact` fixtures and mock `GitAdapter`.                                                                           |
| `test/core/commit-record-projector.test.ts`      | Add    | Stage-focused unit tests with synthetic `CommitFact` fixtures and repository metadata fixtures.                                                                |
| `test/core/file-change-record-projector.test.ts` | Add    | Stage-focused unit tests with synthetic `FileChangeFact` fixtures and repository metadata fixtures.                                                            |
| `test/core/extractor.test.ts`                    | Modify | Keep integration coverage; verify output behavior, writer semantics, and checkpoint persistence remain unchanged. May require fixture updates for new stages.  |

#### Documentation Touchpoints

| File                                                | Section                                          | Action |
| --------------------------------------------------- | ------------------------------------------------ | ------ |
| `.github/instructions/architecture.instructions.md` | "v0.4.0 Migration Contract" and Phase 3 guidance | Update |
| `.github/instructions/schema.instructions.md`       | "Future Schema Extensions" (if stale notes)      | Review |

The `architecture.instructions.md` file must be updated during planning to document the Phase 3 stage boundaries, ownership rules, and the contract of each new stage. This ensures the implementation contract is explicit before the session starts.

Human-oriented design docs (`docs/design/architecture.md` and `docs/design/git-traversal.md`) are intentionally deferred to the release documentation task. Phase 3 creates intermediate internal stage boundaries, and documenting them now would create churn before Phase 4 lands.

#### Implementation Notes

- Projectors should be structured as stateless transforms. Consider whether they need to be classes at all; a module exporting async generator functions might be simpler and equally clear. The key requirement is that the interface contract is explicit (for dependency injection in `Extractor` and for Phase 4 coordinator wiring), not that they are class instances. However, classes are acceptable if they improve clarity and keep repository metadata together with the transformation logic.

- `FileChangeExpander.expand()` should iterate the input `CommitFact` stream sequentially, call `GitAdapter.getFileChanges()` for each commit, and yield each resulting `FileChangeFact`. No buffering or reordering is needed; the output stream follows the input stream order.

- Repository metadata (name, URL) should be computed once in `Extractor` before constructing projectors. Both projectors receive the same metadata; they do not recompute it.

- The write loop in `Extractor` consumes the projected `OutputRecord` stream. The loop structure remains approximately the same, but instead of `if (outputMode === "file") expand and project else just project`, it becomes a single loop over `recordStream` that already contains the right output records in the right order.

- Preserve the exact order of operations for checkpoint and progress: advance progress only after successful write, commit checkpoint only after successful writer close. The stage boundaries introduced in this phase must not change this timing.

- Preserve the exact semantics for empty commits: if a commit expands to zero file changes, zero output records are produced; the write loop does not write anything; progress does not advance; no empty file is created. This behavior should be tested explicitly to ensure no regression.

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- Snapshot commit-mode extraction still produces the same JSONL schema (`OutputCommit` fields in the same order) and the same `ExtractionResult` shape as before Phase 3.
- Snapshot file-mode extraction still expands one output record per file change, preserves the exact file order per commit, and still creates no empty output file on zero-record runs.
- Incremental extraction with an unchanged checkpoint still produces `recordsWritten = 0`, `filesCreated = 0`, and no output file.
- A multi-file commit in file mode still produces multiple output records (one per file), all with the same commit metadata and different file fields.
- An empty commit (zero file changes) in file mode still produces zero output records, and the extraction still completes successfully with the expected final metrics.
- A commit with a binary file in file mode still outputs the binary file record with `additions: null` and `deletions: null`.
- A merge commit in file mode still computes file changes relative to the first parent only.
- A root commit in file mode still expands correctly to changed files (all files in the commit tree marked as "added").
- The final `ExtractionResult` metrics (`recordsWritten`, `filesCreated`, `bytesWritten`, `branches`) remain exactly the same as the prior implementation for the same inputs.
