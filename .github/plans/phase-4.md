### Phase 4: Coordinator, Output Sink, and Checkpoint Orchestration

_Introduce `ExtractionCoordinator` and `OutputSink` so pipeline construction, granularity branching,
sink lifecycle, progress integration, and checkpoint commit ordering move out of `Extractor` into
explicit orchestration boundaries, while `Extractor` becomes a compatibility wrapper that preserves
current CLI-visible behavior and output semantics without any change to `src/index.ts`._

#### Status

- [x] Planned
- [x] In progress
- [x] Completed

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- [`../instructions/architecture.instructions.md`](../instructions/architecture.instructions.md) — v0.4.0 Migration Contract, Phase 4 coordinator/sink contracts (added during this planning session)
- [`../instructions/git-traversal.instructions.md`](../instructions/git-traversal.instructions.md) — Stage Ownership section (updated during this planning session)
- [`phase-1.md`](phase-1.md) — `CommitFact`, `FileChangeFact`, `CheckpointStore`, `ExtractionCheckpoint`, `BranchCheckpoint` stable vocabulary baseline
- [`phase-2.md`](phase-2.md) — `CommitTraversalExtractor` contract and output: `CommitTraversalResult` with `commitFacts` and candidate `ExtractionCheckpoint`
- [`phase-3.md`](phase-3.md) — `FileChangeExpander`, `CommitRecordProjector`, `FileChangeRecordProjector` stage contracts
- Roadmap item: "Architecture: Fact-based extraction pipeline and orchestration split"

---

#### Design Decisions

**Coordinator abstraction: interface + one concrete implementation**

`ExtractionCoordinator` is defined as a Core-owned interface plus one concrete implementation
`DefaultExtractionCoordinator` in `src/core/extraction-coordinator.ts`. The interface is justified
because:

1. It is one of the six named target stage boundaries from the v0.4.0 migration contract.
2. Phase 6 needs to instrument the coordinator boundary for profiling without touching core
   orchestration logic (a profiling wrapper can implement the same interface).
3. Tests for the coordinator use mocked stage dependencies injected through the constructor; tests
   for `Extractor` verify that the compatibility wrapper produces the correct `ExtractionResult`.
   The interface is intentionally narrow: one `run(request)` method plus a fixed request/result
   contract. No strategy hierarchy.

**CoordinatorRequest: narrower Core-owned request type (not ExtractorConfig)**

`ExtractionCoordinator.run()` receives a `CoordinatorRequest` — a Core-owned request type whose
field names use Core-preferred terminology rather than CLI-facing names. `Extractor` translates
`ExtractorConfig` into `CoordinatorRequest` before calling the coordinator, making `Extractor` the
explicit compatibility/translation layer. Rationale:

- Phase 5 will rename CLI-facing config fields. If the coordinator consumed `ExtractorConfig`
  directly, Phase 5 would have to touch the coordinator as well as the CLI config.
- Keeping `CoordinatorRequest` free of CLI-facing names (`outputMode`, `mode`, `onMissingState`,
  `stateFilePath`) insulates the coordinator from the Phase 5 breaking change.
- `Extractor` is already the compatibility surface; consolidating translation there is correct.

`CoordinatorRequest` fields:

```typescript
interface CoordinatorRequest {
  readonly repositoryPath: string; // resolved absolute path
  readonly repoName: string; // derived by Extractor before coordinator call
  readonly remoteUrl: string | null; // fetched by Extractor before coordinator call
  readonly branches: readonly string[];
  readonly granularity: "commit" | "file"; // renamed from outputMode
  readonly range?: ExtractionRange;
  readonly priorCheckpoint: ExtractionCheckpoint; // loaded/validated by Extractor
  readonly sessionTimestamp: Date; // computed by Extractor; used for checkpoint generatedAt
}
```

`CoordinatorResult` fields:

```typescript
interface CoordinatorResult {
  readonly recordsWritten: number;
  readonly branches: readonly string[]; // branches that had at least one resolved head
}
```

Sink metrics (`filesCreated`, `bytesWritten`) are read from the injected `OutputSink` directly by
`Extractor` after the coordinator returns; they do not travel through `CoordinatorResult`.

**OutputSink: Core-owned interface; OutputWriterSink wraps the existing OutputWriter**

`OutputSink` is defined as a Core-owned interface in `src/core/types.ts`. It exposes the minimum
contract the coordinator needs:

```typescript
interface OutputSink {
  write(record: OutputRecord): Promise<void>;
  close(): Promise<void>;
  readonly filesCreated: number;
  readonly bytesWritten: number;
}
```

`OutputWriter` in `src/output/writer.ts` is **not renamed or repositioned** in this phase.
Instead, a new thin wrapper class `OutputWriterSink` is added in `src/output/output-writer-sink.ts`
that implements `OutputSink` by delegating to an injected `OutputWriter` instance. Rationale:

- Renaming `OutputWriter` would constitute an output-layer restructuring beyond what is minimally
  needed in this phase and would break existing tests.
- The adapter approach keeps the coordinator's dependency on a Core-defined interface without
  requiring any change to `src/output/writer.ts`.
- Phase 4 does not introduce stdout support, heterogeneous sinks, or stream-based redesign. A
  single-file adapter is the narrowest possible change that establishes the boundary.
  `OutputWriterSink` delegates `write()`, `close()`, `filesCreated`, and `bytesWritten` to the
  wrapped `OutputWriter` instance.

**Coordinator constructor dependencies**

`DefaultExtractionCoordinator` receives its stage dependencies and runtime collaborators through
its constructor. The constructor signature uses a named dependency bag for readability:

```typescript
interface CoordinatorDeps {
  readonly traversalExtractor: CommitTraversalExtractor;
  readonly fileChangeExpander: FileChangeExpander;
  readonly commitProjector: CommitRecordProjector;
  readonly fileProjector: FileChangeRecordProjector;
  readonly sink: OutputSink;
  readonly checkpointStore: CheckpointStore | undefined;
  readonly reporter: Reporter;
}
```

`Extractor.run()` constructs a `CoordinatorDeps` bag with concrete instances and passes it to
`new DefaultExtractionCoordinator(deps)`. No change to `src/index.ts` is required.

**Coordinator-owned responsibilities after Phase 4**

`DefaultExtractionCoordinator.run()` is solely responsible for:

1. Calling `traversalExtractor.extract(traversalRequest)` to obtain `commitFacts` and
   `candidateCheckpoint`.
2. Selecting the projection pipeline based on `request.granularity`:
   - `"commit"`: `commitFacts` → `commitProjector.project()` → `OutputRecord` stream
   - `"file"`: `commitFacts` → `fileChangeExpander.expand()` → `fileProjector.project()` →
     `OutputRecord` stream
3. Iterating the `OutputRecord` stream, calling `sink.write(record)` for each record, and calling
   `reporter.progress(count)` **immediately after** each successful write (preserving the
   "advance only after successful write" invariant).
4. Calling `reporter.done(count)` and `sink.close()` in a `finally` block so they execute even
   when the pipeline throws.
5. Writing the checkpoint after the try/finally completes without exception and only when
   `checkpointStore` is defined and `candidateCheckpoint.branches.size > 0`:
   ```
   // pipeline try/finally (done + close always execute)
   // checkpoint write is OUTSIDE the try/finally — only reached on success
   if (checkpointStore && candidateCheckpoint.branches.size > 0) {
     await checkpointStore.write(composedCheckpoint);
   }
   ```
   This preserves the current ordering: close always runs; checkpoint write only runs on success.
6. Composing the final `ExtractionCheckpoint` to write by combining `candidateCheckpoint` (from
   traversal stage) with `request.sessionTimestamp.toISOString()` as `generatedAt` and
   `request.repositoryPath` as `repositoryPath`.

**Responsibilities that remain in Extractor after Phase 4**

`Extractor` becomes a compatibility wrapper and is no longer the execution engine. After Phase 4
its `run()` method is responsible for:

1. Starting the monotonic timer.
2. Resolving `config.repositoryPath` to an absolute path.
3. Calling `adapter.getRemoteUrl()` and `deriveRepoName()`.
4. Loading and validating the prior checkpoint via `initializeStateMap()` (renamed to
   `loadPriorCheckpoint()` internally for clarity, but external behavior unchanged).
   This includes: reading `CheckpointStore`, validating version and repositoryPath, handling
   `--on-missing-state snapshot` fallback, and emitting the missing-state warning.
5. Computing `sessionTimestamp = this.wallNow()`.
6. Constructing `OutputWriter` and `OutputWriterSink` (using `sessionTimestamp` for the filename).
7. Constructing concrete stage instances (`CommitTraversalExtractorImpl`, `FileChangeExpander`
   impl, both projector impls) with the injected `GitAdapter`.
8. Constructing `DefaultExtractionCoordinator` with the `CoordinatorDeps` bag.
9. Calling `coordinator.run(coordinatorRequest)` with a `CoordinatorRequest` translated from
   `ExtractorConfig`.
10. Building and returning `ExtractionResult` from the coordinator result, sink metrics, and elapsed
    time.

**No change to `src/index.ts`**

`Extractor` still accepts the same constructor arguments and exposes the same `run()` returning
`ExtractionResult`. `src/index.ts` constructs `Extractor` exactly as before. The change is
entirely internal to `Extractor.run()`.

**Progress integration invariant**

The coordinator advances progress by calling `reporter.progress(count)` immediately after each
successful `sink.write()` returns. `reporter.done(count)` is called in the `finally` block after
all branches are processed. This preserves the current invariant: progress advances only on
successful write; `done()` always executes.

**Checkpoint write ordering**

The coordinator's try/finally structure mirrors the current `Extractor.run()` structure:

```
try {
  // run pipeline: traversal → pipeline → write loop
} finally {
  reporter.done(recordsWritten);
  await sink.close();
}
// Only reached without exception:
if (checkpointStore && candidateCheckpoint.branches.size > 0) {
  await checkpointStore.write(composedCheckpoint);
}
```

`sink.close()` always runs (no empty-file risk because `OutputWriter` only opens a file on the
first write call). The checkpoint write is placed after the try/finally so it executes only on full
success. This preserves the current ordering exactly.

**Granularity branching location**

After Phase 3, the branching decision (`if outputMode === "file"`) lives in `Extractor` just
before selecting the projector pipeline. In Phase 4 this decision moves into
`DefaultExtractionCoordinator.run()` based on `request.granularity`. `Extractor` translates
`config.outputMode` to `request.granularity` and no longer contains pipeline-selection logic.

**Traversal stage request composition in coordinator**

`DefaultExtractionCoordinator` builds the `CommitTraversalRequest` from `CoordinatorRequest` by
mapping field names directly. This is a thin translation; no traversal semantics are changed. The
traversal stage continues to own sequential branch traversal, deduplication, differential range
application, and `COMMIT_NOT_FOUND` fallback.

**New runtime dependencies**

None. All stages and dependencies are constructed from existing code. The only new runtime code is
the thin `DefaultExtractionCoordinator` and `OutputWriterSink`.

**Output schema semantics**

No change. The exact same `OutputCommit` and `OutputFileRecord` schemas are emitted. The same
rotation policy applies. Phase 4 changes ownership of the write loop, not the serialization or
schema.

**ExtractionResult shape**

No change. `ExtractionResult` fields (`recordsWritten`, `filesCreated`, `bytesWritten`,
`elapsedMs`, `branches`) are assembled identically by `Extractor.run()` after the coordinator
returns.

**Edge cases preserved exactly**

- Zero-record runs: `sink.close()` is a no-op if `write()` was never called; no empty file.
- `--since-date`: skip-and-continue semantics remain in the traversal stage.
- `COMMIT_NOT_FOUND` fallback: remains in the traversal stage.
- Multi-branch: sequential, non-interleaved output is preserved by the traversal stage.
- `--on-missing-state snapshot` warning: emitted by `Extractor.loadPriorCheckpoint()` before the
  coordinator is called; coordinator is unaware of the mode/fallback logic.

---

#### Non-Goals

- Redesigning CLI flags, config field names, user-facing terminology, or the `ExtractorConfig`
  public surface; that belongs to Phase 5.
- Introducing stage-aligned profiling, timing fields, or profiling wrappers; that belongs to
  Phase 6. Phase 4 establishes the coordinator boundary so Phase 6 can instrument it; it does not
  add any timing measurement.
- Redesigning progress metrics quality or user-facing progress strategy; that belongs to Phase 7.
  Phase 4 preserves the current reporter contract exactly and establishes the ownership boundary
  that Phase 7 will later update.
- Introducing stdout support, heterogeneous sinks (`MultiSink`, `TeeSink`), or stream-based
  `OutputWriter` redesign; those belong to future work. `OutputSink` as a single-output-file-backed
  interface is the only sink scope for Phase 4.
- Renaming or repositioning `OutputWriter` itself; it stays in `src/output/writer.ts` unchanged.
- Removing `Extractor` or changing its constructor signature or the public `ExtractionResult` type;
  `Extractor` survives as the compatibility wrapper until Phase 5 or 7 explicitly removes it.
- Removing the `StateStore`/`StateFile` compatibility aliases introduced in Phase 1; those stay
  until the final cleanup phase.
- Broad identifier or module rename cleanup beyond the coordinator/sink boundary being introduced.
- Touching `src/cli/**`, `src/git/**`, or `src/output/writer.ts`.

---

#### Target Files

| File                                       | Action | Notes                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/core/extraction-coordinator.ts`       | Add    | `ExtractionCoordinator` interface plus `DefaultExtractionCoordinator` concrete class; owns pipeline construction, granularity branching, write loop, progress calls, `sink.close()`, and checkpoint write timing.                                                                                |
| `src/core/types.ts`                        | Modify | Add `OutputSink` interface; add `CoordinatorRequest`, `CoordinatorResult`, `CoordinatorDeps` types; no removals or renames.                                                                                                                                                                      |
| `src/core/index.ts`                        | Modify | Re-export `ExtractionCoordinator`, `DefaultExtractionCoordinator`, `OutputSink`, `CoordinatorRequest`, `CoordinatorResult`, `CoordinatorDeps`.                                                                                                                                                   |
| `src/core/extractor.ts`                    | Modify | Becomes compatibility wrapper: rename `initializeStateMap` to `loadPriorCheckpoint` internally; add stage construction logic; add coordinator construction and delegation; remove write loop, granularity branching, progress calls, sink lifecycle, checkpoint write (all move to coordinator). |
| `src/output/output-writer-sink.ts`         | Add    | `OutputWriterSink` class implementing `OutputSink`; wraps an injected `OutputWriter`; delegates `write()`, `close()`, `filesCreated`, `bytesWritten`.                                                                                                                                            |
| `src/output/index.ts`                      | Modify | Re-export `OutputWriterSink`.                                                                                                                                                                                                                                                                    |
| `test/core/extraction-coordinator.test.ts` | Add    | Unit tests with mock stages: commit-mode pipeline, file-mode pipeline, progress-after-write invariant, checkpoint-after-close invariant, checkpoint-skipped-on-failure, `done()` always called, `close()` always called, zero-record run, no-branch-head case.                                   |
| `test/core/extractor.test.ts`              | Modify | Keep all integration-level behavioral coverage; verify `ExtractionResult` shape, output behavior, and checkpoint ordering remain unchanged after the delegation refactor.                                                                                                                        |
| `test/output/output-writer-sink.test.ts`   | Add    | Unit tests for the `OutputWriterSink` wrapper: delegates `write()` calls, delegates `close()`, exposes `filesCreated` and `bytesWritten` from the wrapped writer.                                                                                                                                |

**Explicitly untouched files in Phase 4:**

| File                                       | Reason                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `src/index.ts`                             | CLI/runtime entrypoint surface must remain unchanged this phase.                 |
| `src/output/writer.ts`                     | `OutputWriter` is untouched; only wrapped by the new `OutputWriterSink` adapter. |
| `src/output/types.ts`                      | `OutputRecord` schema unchanged.                                                 |
| `src/output/utils.ts`                      | Serialization helpers unchanged.                                                 |
| `src/cli/**`                               | CLI parameter model belongs to Phase 5.                                          |
| `src/git/**`                               | Git adapter unchanged.                                                           |
| `src/core/commit-traversal-extractor.ts`   | Traversal stage contract unchanged; coordinator calls it as-is.                  |
| `src/core/file-change-expander.ts`         | Expander stage contract unchanged.                                               |
| `src/core/commit-record-projector.ts`      | Projector stage contracts unchanged.                                             |
| `src/core/file-change-record-projector.ts` | Projector stage contracts unchanged.                                             |

---

#### Documentation Touchpoints

| File                                                 | Section                                                                                                          | Action |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| `.github/instructions/architecture.instructions.md`  | "v0.4.0 Migration Contract" — add Phase 4 coordinator/sink contract block                                        | Update |
| `.github/instructions/architecture.instructions.md`  | Core Logic Layer "Component Responsibilities" — update the Phase 3/Phase 4 migration note                        | Update |
| `.github/instructions/git-traversal.instructions.md` | "Stage Ownership During v0.4.0 Migration" — update to reflect coordinator now owns sink/checkpoint after Phase 4 | Update |

Human-oriented design docs (`docs/design/architecture.md`, `docs/design/git-traversal.md`) are
intentionally deferred to the release documentation task. Phase 4 creates an intermediate
coordinator boundary; documenting the partially migrated architecture now would create churn before
Phase 5 finalizes the coordinator's public-facing config model.

---

#### Implementation Notes

- `DefaultExtractionCoordinator.run()` should internally call `traversalExtractor.extract()` first
  to get the `CommitTraversalResult` (containing `commitFacts` and `candidateCheckpoint`). The
  `commitFacts` iterable is then handed to the selected pipeline. The `candidateCheckpoint` is
  stored before the pipeline loop starts — it is available regardless of whether any records are
  written.

- The granularity branch must be resolved before entering the pipeline loop. Avoid checking
  `request.granularity` inside the per-record iteration; resolve the pipeline shape once at the top
  of `run()` and iterate a single unified `AsyncIterable<OutputRecord>` in the write loop.

- Repository metadata (`repoName`, `remoteUrl`) must be passed to both `CommitRecordProjector` and
  `FileChangeRecordProjector` from `CoordinatorRequest`. Both projectors are constructed by
  `Extractor` with repository metadata in their constructors (Phase 3 decision); the coordinator
  does not need to pass metadata at call time.

- The `CheckpointStore` dependency in `DefaultExtractionCoordinator` is typed `CheckpointStore |
undefined`. When `undefined`, the coordinator must skip the checkpoint write entirely (snapshot
  mode without `--state`). This is exactly the current behavior.

- The composed `ExtractionCheckpoint` written by the coordinator should be built from:
  - `candidateCheckpoint.branches` entries (branch name → last commit hash map, from traversal)
  - `generatedAt = request.sessionTimestamp.toISOString()`
  - `repositoryPath = request.repositoryPath`
  - `version = 1`
    The coordinator is responsible for this composition. The traversal stage returns only the
    branch-head map portion.

- `Extractor`'s internal method formerly named `initializeStateMap()` may be renamed
  `loadPriorCheckpoint()` for conceptual clarity; this is an internal rename only and has no
  observable effect.

- `Extractor` constructs all stage concrete implementations privately inside `run()`. This keeps
  `src/index.ts` unchanged. Stage instances are created with the injected `GitAdapter` and
  repository metadata. If a stage requires repository metadata (projectors do), `Extractor`
  resolves it first, then constructs the projector with that metadata, then constructs the
  coordinator.

- `OutputWriterSink` wraps an `OutputWriter` that is constructed by `Extractor` exactly as today
  (same `outputDir`, `filenameFor`, and `rotation` args). `Extractor` constructs `OutputWriter`,
  wraps it in `OutputWriterSink`, and passes the sink to the `CoordinatorDeps` bag.

- The `ExtractionCoordinator` interface should use `run(request: CoordinatorRequest): Promise<CoordinatorResult>`. Keep the interface minimal; do not add lifecycle methods or factory methods. The coordinator is a run-once object constructed per extraction.

- The `branches` field in `CoordinatorResult` must contain the set of branches for which the
  traversal stage successfully resolved a branch head. Branches that were skipped (e.g.,
  `REF_NOT_FOUND`) are not included. This matches the current `branchHeads.keys()` behavior.

- In `test/core/extraction-coordinator.test.ts`, use async generator stubs for `commitFacts` to
  simulate realistic pipeline behavior. Test the "progress only after write" invariant by verifying
  that `reporter.progress` call count equals `sink.write` call count and that the progression
  sequence matches.

---

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- Snapshot commit-mode extraction produces the same JSONL schema (`OutputCommit` field order and
  values) and the same `ExtractionResult` shape as before Phase 4. No new lines in stderr; no
  changed record count.
- Snapshot file-mode extraction still expands one output record per file change; empty commits
  produce zero records; the run completes with `filesCreated = 0` and no empty output file on
  zero-record input.
- Incremental extraction with an unchanged checkpoint produces `recordsWritten = 0`,
  `filesCreated = 0`, `bytesWritten = 0`, and no output file. Checkpoint is not re-written.
- Incremental extraction with a new commit produces the expected new records, then updates the
  checkpoint file to the new HEAD hashes.
- Multi-branch run still emits branches in CLI-specified order, non-interleaved; cross-branch
  deduplication still suppresses duplicate commits; `ExtractionResult.branches` lists resolved
  branches only.
- A simulated output-write failure (mocked `sink.write()` rejection in a unit test) leaves the
  checkpoint unchanged and still calls `reporter.done()` and `sink.close()`.
- A simulated `sink.close()` failure leaves the checkpoint unchanged (checkpoint write is after
  close; if close throws, the checkpoint write is not reached).
- `--on-missing-state snapshot` warning is still emitted to stderr before any output records are
  written (i.e., the warning is emitted in `Extractor.loadPriorCheckpoint()` before the
  coordinator is called; this ordering is unchanged).
- Progress output cadence on stderr is unchanged: `\rProcessed N records...` every 100 records,
  and the final newline after `done()`.
