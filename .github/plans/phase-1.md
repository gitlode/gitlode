### Phase 1: Fact Vocabulary and Compatibility Facade

_Introduce the new internal fact/checkpoint vocabulary inside Core and keep `Extractor` as a compatibility facade so later phases can split traversal, expansion, projection, and orchestration without changing current CLI-visible behavior or extraction results._

#### Status

- [x] Planned
- [ ] In progress
- [ ] Completed

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- [`../instructions/architecture.instructions.md`](../instructions/architecture.instructions.md) — Layer Overview, v0.4.0 migration contract, Core Logic layer
- [`../instructions/git-traversal.instructions.md`](../instructions/git-traversal.instructions.md) — snapshot/incremental semantics, deduplication, state file ordering, fallback rules
- Roadmap item: "Architecture: Fact-based extraction pipeline and orchestration split"

#### Design Decisions

- **Preferred API / library / Node.js built-in**: Continue using the existing `GitAdapter`, `OutputWriter`, `Reporter`, `WallClock`, `MonotonicClock`, and Node.js `fs/promises` checkpoint-store implementation. Introduce the new vocabulary as plain TypeScript interfaces and type aliases in `src/core/types.ts`; do not add classes or new runtime dependencies.
- **Owning layer**: Core owns `CommitFact`, `FileChangeFact`, `CheckpointStore`, `ExtractionCheckpoint`, `BranchCheckpoint`, and any compatibility-only translation helpers because they are the internal contracts between traversal, expansion, projection, and orchestration. The Git adapter continues to own only Git-native raw data (`RawCommit`, `FileChange`) and traversal primitives. The output layer continues to own only `OutputRecord` serialization and rotation.
- **Smallest Phase 1 change set**: Add the new type vocabulary and a thin compatibility seam only. `Extractor` remains the public class and runtime entrypoint. `Extractor.run()` may internally materialize `CommitFact` / `FileChangeFact` and project them back to the existing output schema, but branch traversal, differential boundary selection, file-change lookup, progress updates, writer lifecycle, and checkpoint timing all stay in the current control flow for this phase.
- **Compatibility facade meaning in this codebase**: `src/index.ts` continues to construct `Extractor` and call `run()`. `ExtractorConfig`, `ExtractionResult`, `outputMode`, `mode`, and `stateFilePath` remain in place. No new public CLI/runtime entrypoint is introduced. The new abstractions in Phase 1 are core-owned types plus private compatibility helpers inside the current extraction flow; standalone `ExtractionCoordinator`, `CommitTraversalExtractor`, `FileChangeExpander`, `CommitRecordProjector`, `FileChangeRecordProjector`, and `OutputSink` implementations are explicitly deferred.
- **Fact shapes**: `CommitFact` should be output-agnostic and should carry repository identity plus Git-native commit content: `oid`, full `message`, `author`/`committer` identities with Unix-second timestamps and timezone offsets, and parent hashes. `FileChangeFact` should pair exactly one `CommitFact` with exactly one expanded file change (`path`, `status`, `additions`, `deletions`). Neither fact type should depend on `OutputCommit`, `OutputFileRecord`, `RawCommit`, or `FileChange` types from other layers.
- **Checkpoint vocabulary**: Rename the core checkpoint types to `CheckpointStore`, `ExtractionCheckpoint`, and `BranchCheckpoint` in `src/core/types.ts`. Keep exported compatibility aliases for `StateStore`, `StateFile`, and `StateBranchEntry` during Phase 1 so existing imports and tests can migrate incrementally without forcing a broad cleanup. At the runtime edge, rename `NodeStateStore` to `NodeCheckpointStore` now because it sits exactly on the checkpoint terminology seam and is not a user-facing identifier.
- **Renames now vs deferred**: Rename now only the checkpoint terminology at the core/runtime seam and any private helper names needed to make fact/projector boundaries explicit. Defer renaming `Extractor`, `ExtractorConfig`, `ExtractionResult`, `outputMode`, `mode`, `stateFilePath`, CLI flags, module filenames, `OutputWriter`, and Git adapter method names until the dedicated later phases or the final cleanup phase.
- **Responsibilities explicitly preserved**: `Extractor` continues to decide traversal order, cross-branch deduplication, date filtering, `COMMIT_NOT_FOUND` fallback, per-branch checkpoint boundary calculation, progress increments after successful writes, writer close timing, and checkpoint writes after successful close. Phase 1 must not move sink lifecycle, checkpoint commit ordering, or granularity interpretation into a coordinator abstraction early.
- **Output stream**: No stderr/stdout contract changes are allowed in this phase. Reporter warnings, periodic progress output, and the final extraction summary must remain byte-for-byte compatible unless tests demonstrate an existing inconsistency unrelated to this phase.
- **Timing / measurement**: Keep current wall-clock and monotonic timing ownership in `Extractor.run()`. Do not introduce stage profiling, new timers, or coordinator-level measurement in this phase.
- **New runtime dependencies**: none.
- **Edge case behavior**: Preserve current extraction semantics, including sequential branch traversal, non-interleaved branch output, global per-run deduplication, `--since-date` skip-and-continue behavior, `--on-missing-state snapshot` warning fallback, repository-path validation for checkpoints, `COMMIT_NOT_FOUND` fallback to full extraction, zero-record no-empty-file behavior, and the current `ExtractionResult` shape.
- **Intentionally untouched files in Phase 1**: `src/git/isomorphic-git-adapter.ts`, `src/git/types.ts`, `src/output/writer.ts`, `src/output/types.ts`, `src/cli/**`, and the user-facing CLI argument model remain untouched so later phase boundaries stay explicit.

#### Non-Goals

- Extracting `CommitTraversalExtractor` or moving traversal/differential logic out of `Extractor`; that belongs to Phase 2.
- Introducing standalone `FileChangeExpander`, `CommitRecordProjector`, or `FileChangeRecordProjector`; that belongs to Phase 3.
- Moving sink lifecycle, checkpoint commit ordering, or progress ownership into `ExtractionCoordinator`; that belongs to Phase 4.
- Redesigning CLI flags, config field names, or user-facing parameter terminology; that belongs to Phase 5.
- Performing broad identifier cleanup beyond the narrow checkpoint-terminology seam established here.

#### Target Files

| File                          | Action | Notes                                                                                                                                                               |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/types.ts`           | Modify | Add `CommitFact`, `FileChangeFact`, `CheckpointStore`, `ExtractionCheckpoint`, `BranchCheckpoint`, and exported compatibility aliases for the existing state types. |
| `src/core/extractor.ts`       | Modify | Keep `Extractor` as the compatibility facade, add local fact/projector helper boundaries, and adopt checkpoint terminology internally without changing behavior.    |
| `src/core/index.ts`           | Modify | Re-export the new fact/checkpoint types and compatibility aliases.                                                                                                  |
| `src/index.ts`                | Modify | Rename the runtime checkpoint-store implementation and continue wiring `Extractor` with the unchanged CLI-visible configuration surface.                            |
| `test/core/extractor.test.ts` | Modify | Add or adjust regression coverage that proves the fact/checkpoint seam preserves existing output and result behavior.                                               |

#### Documentation Touchpoints

- `.github/instructions/architecture.instructions.md` is updated during planning for this phase so the new vocabulary and compatibility boundary become part of the binding design contract before implementation starts.
- Human-oriented design docs (`docs/design/architecture.md` and `docs/design/git-traversal.md`) are intentionally deferred to the release documentation task. Phase 1 introduces an internal seam only, and documenting the intermediate compatibility shape would create churn before Phases 2 through 4 land.
- No terminology change is required in `.github/instructions/git-traversal.instructions.md` during Phase 1 because traversal semantics and checkpoint timing remain unchanged in this phase.

#### Implementation Notes

- Prefer adding private helpers in `src/core/extractor.ts` with names that expose the intended later split, such as commit-fact creation and projection helpers. Later phases can move those helpers into dedicated modules without changing behavior.
- If an internal `RecordGranularity` alias is introduced for readability, keep it private to Core in Phase 1. Do not replace `ExtractorConfig.outputMode` or the CLI parser with it yet.
- Keep compatibility aliases exported until at least Phase 4 is complete; removing them in Phase 1 would force unnecessary cross-phase churn.

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- Snapshot commit-mode run still produces the same JSONL schema and final `ExtractionResult` metrics as before Phase 1.
- Snapshot file-mode run still counts records and progress per written file record, and empty commits still produce zero output records.
- Incremental run with an unchanged state file still produces `recordsWritten = 0`, `filesCreated = 0`, and no empty output file.
- Incremental run with `--on-missing-state snapshot` still emits the existing warning and performs a full traversal.
- Incremental run with a stale checkpoint hash that triggers `COMMIT_NOT_FOUND` still emits the warning and falls back to full extraction.
- A `--since-date` run over a merge-shaped history still skips older commits without terminating traversal early, and shared-history multi-branch runs still preserve cross-branch deduplication and branch-order output.
