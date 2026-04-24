### Phase 2: Commit Traversal Stage Extraction

_Extract a dedicated `CommitTraversalExtractor` boundary so sequential branch traversal, differential boundary selection, cross-branch deduplication, and checkpoint-candidate composition move out of `Extractor` without changing current CLI-visible behavior, output semantics, or checkpoint commit timing._

#### Status

- [x] Planned
- [x] In progress
- [ ] Completed

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- [`../instructions/architecture.instructions.md`](../instructions/architecture.instructions.md) — Core layer responsibilities, v0.4.0 migration contract, migration ownership rules
- [`../instructions/git-traversal.instructions.md`](../instructions/git-traversal.instructions.md) — traversal semantics, differential extraction rules, deduplication, warning/fallback behavior, checkpoint ordering
- [`phase-1.md`](phase-1.md) — stable Phase 1 vocabulary baseline and `Extractor` compatibility-facade constraints
- Roadmap item: "Architecture: Fact-based extraction pipeline and orchestration split"

#### Design Decisions

- **Preferred API / library / Node.js built-in**: Continue using the existing `GitAdapter`, `Reporter`, `OutputWriter`, and checkpoint-store implementation introduced in Phase 1. Add one new Core runtime module, `src/core/commit-traversal-extractor.ts`, with no new runtime dependencies.
- **Smallest real Phase 2 change set**: Introduce a single new traversal-stage boundary and move only traversal-owned logic behind it. `Extractor` remains the runtime facade, still owns checkpoint-store I/O, writer lifecycle, progress, output projection, file-change expansion, and the final `ExtractionResult`. No coordinator, sink, expander, or projector modules are introduced yet.
- **Abstraction choice**: `CommitTraversalExtractor` should be a Core interface plus one concrete implementation in this phase. The interface is justified because this is the first named stage boundary from the v0.4.0 migration contract, and later `ExtractionCoordinator` work should depend on a stable traversal contract rather than on `Extractor` internals or one concrete class. Keep the interface intentionally narrow: one extraction method and contract types only; no hierarchy of strategy interfaces.
- **Owning layer**: Core owns `CommitTraversalExtractor`, its request/result contract, and the internal traversal-state vocabulary used to keep branch traversal, differential boundary selection, and checkpoint-candidate composition together. The Git adapter still owns only Git-native repository access primitives and raw commit/file-change data. The output layer still owns only `OutputRecord` persistence and rotation.
- **Traversal-stage input contract**: `CommitTraversalExtractor` consumes a Core-owned request object containing the resolved repository path, repository identity needed for `CommitFact` construction, the ordered branch list, the configured extraction range, and the previously loaded `ExtractionCheckpoint` (or an equivalent validated branch-checkpoint map derived from it). The traversal stage must not read `CheckpointStore` directly and must not receive `OutputWriter` or output-record types.
- **Traversal-stage output contract**: `CommitTraversalExtractor` should not emit bare `CommitFact` alone. It should return a richer Core-owned result containing `commitFacts: AsyncIterable<CommitFact>` plus a candidate `ExtractionCheckpoint` built from the successfully resolved branch heads for this run. This keeps checkpoint-boundary calculation next to traversal while leaving checkpoint persistence timing outside the stage.
- **Why a richer traversal result is required**: Emitting only `AsyncIterable<CommitFact>` would force branch-head collection and checkpoint-candidate composition to remain in `Extractor` or leak through side channels. Returning commit facts together with the candidate checkpoint is the smallest change that creates a real traversal-stage boundary now and leaves a clean seam for the later coordinator phase.
- **Checkpoint-boundary ownership after the split**: Per-branch exclude-hash resolution, merge-base calculation for newly added branches, branch-head collection, and candidate checkpoint composition all move into `CommitTraversalExtractor`. `Extractor` still performs checkpoint-store read/validation before traversal starts and persists the returned candidate checkpoint only after successful output completion. This preserves current checkpoint commit ordering while removing traversal’s dependency on output persistence.
- **Branch-head collection scope**: `CommitTraversalExtractor` owns branch-head collection in Phase 2. Resolving branch heads, deciding which branches are skipped, and composing the candidate checkpoint are one responsibility slice and should not be split between `Extractor` and the new stage.
- **Traversal semantics owned by the new stage**: The new stage owns sequential branch traversal, non-interleaved branch emission order, cross-branch deduplication, `--since-date` skip-and-continue filtering, `COMMIT_NOT_FOUND` fallback to full extraction, missing-branch warning behavior, and new-branch merge-base deduplication. Those are traversal semantics and should move together.
- **Cross-branch deduplication representation**: Deduplication state remains internal to the traversal stage as one run-scoped `visited: Set<CommitHash>` owned by the concrete implementation, not caller-managed state. The public contract stays at full-run scope: ordered branches in, globally deduplicated `CommitFact` stream out.
- **Per-branch traversal context representation**: Represent per-branch context internally as a private traversal-plan structure containing at least the branch name, resolved head, selected `excludeHash`, and any fallback/warning state needed to preserve current behavior. Do not promote these plan types into the public Core contract in Phase 2; later phases can refine them if the coordinator needs visibility.
- **`Extractor` responsibilities that explicitly stay put**: `Extractor` keeps checkpoint-store loading and validation, `--on-missing-state snapshot` handling, repo-name/remote-URL resolution, commit/file output projection, file-change expansion for `outputMode === "file"`, output-writer lifecycle, progress updates after successful writes, final summary/result metric calculation, and checkpoint persistence only after successful writer close. These responsibilities must not move in Phase 2 so that Phase 3 and Phase 4 boundaries stay clear.
- **Helpers that move now**: Move the logic currently represented by `computeNewBranchExclude()`, `resolveExcludeHash()`, the branch-resolution and traversal portions of `processBranch()`, and the branch-head accumulation currently stored in `branchHeads` into `CommitTraversalExtractor`. The traversal stage should emit `CommitFact` values rather than writing output directly.
- **Helpers that stay for later phases**: Keep `deriveRepoName()`, `mapToOutputCommit()`, `mapToOutputFileRecord()`, file-change lookup/projection branching, writer creation/close handling, reporter progress/done calls, and checkpoint-store read/write helpers in `Extractor` for now. File-change expansion and projection are intentionally deferred to Phase 3; sink lifecycle and checkpoint commit timing stay in `Extractor` until Phase 4.
- **Constructor and wiring scope**: Keep the current CLI/runtime entrypoint unchanged. `Extractor` should construct or otherwise privately own the default `CommitTraversalExtractor` implementation in Phase 2 rather than forcing a new runtime-wiring surface through `src/index.ts`. Stage-specific tests should target the concrete traversal extractor directly.
- **Output stream**: No stderr/stdout contract changes are allowed. Warnings emitted for missing branches, missing commits, and missing state fallback must remain behaviorally identical, and progress continues to advance only after successful output writes.
- **Timing / measurement**: Keep wall-clock and monotonic timing ownership in `Extractor.run()`. Do not introduce stage profiling or new timing fields in Phase 2.
- **New runtime dependencies**: none.
- **Edge case behavior**: Preserve current behavior exactly: sequential branch traversal, non-interleaved branch output, cross-branch deduplication, `--since-date` skip-and-continue semantics, merge-base deduplication for newly added branches in incremental mode, `COMMIT_NOT_FOUND` fallback to full extraction, zero-record no-empty-file behavior, and checkpoint write ordering after successful output completion.
- **Intentionally untouched files in Phase 2**: `src/cli/**`, `src/output/**`, `src/git/**`, and `src/index.ts` remain unchanged unless a narrow import adjustment is required by the new Core module. This phase is not allowed to grow new wiring surfaces outside Core.

#### Non-Goals

- Introducing `ExtractionCoordinator`, `OutputSink`, `FileChangeExpander`, `CommitRecordProjector`, or `FileChangeRecordProjector`; those belong to later phases.
- Moving checkpoint-store ownership, checkpoint commit timing, sink lifecycle, or overall progress ownership out of `Extractor`; that belongs to Phase 4.
- Splitting file-change expansion or output projection into standalone modules; that belongs to Phase 3.
- Redesigning CLI flags, config field names, user-facing terminology, or the `ExtractionResult` shape; that belongs to Phase 5 or later release work.
- Performing broad naming cleanup beyond the traversal-stage contract types needed to establish the new boundary.

#### Target Files

| File                                           | Action | Notes                                                                                                                                                                   |
| ---------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/commit-traversal-extractor.ts`       | Add    | Add the concrete traversal-stage implementation and keep traversal-owned private helper/context types local to this module.                                             |
| `src/core/types.ts`                            | Modify | Add the `CommitTraversalExtractor` request/result contract types and any supporting Core-owned traversal-stage interfaces.                                              |
| `src/core/index.ts`                            | Modify | Re-export the traversal-stage contract and implementation for internal Core consumption and tests.                                                                      |
| `src/core/extractor.ts`                        | Modify | Replace in-file traversal/boundary logic with delegation to `CommitTraversalExtractor` while keeping projection, writer lifecycle, and checkpoint persistence in place. |
| `test/core/commit-traversal-extractor.test.ts` | Add    | Add stage-focused coverage for branch ordering, deduplication, range handling, merge-base exclusion, and fallback/warning semantics.                                    |
| `test/core/extractor.test.ts`                  | Modify | Keep integration coverage proving output behavior, writer/progress semantics, and checkpoint persistence ordering remain unchanged.                                     |

#### Documentation Touchpoints

| File                                                 | Section                                                 | Action |
| ---------------------------------------------------- | ------------------------------------------------------- | ------ |
| `.github/instructions/architecture.instructions.md`  | "v0.4.0 Migration Contract" and Core ownership guidance | Update |
| `.github/instructions/git-traversal.instructions.md` | traversal/boundary ownership guidance                   | Update |

Human-oriented design docs in `docs/design/architecture.md` and `docs/design/git-traversal.md` are intentionally deferred to the release documentation task. Phase 2 creates an intermediate internal stage boundary, and documenting the partially migrated architecture now would create avoidable churn before Phases 3 and 4 land.

#### Implementation Notes

- Keep the traversal-stage contract run-scoped. The returned `AsyncIterable<CommitFact>` must preserve branch order and non-interleaving by iterating branches sequentially inside the traversal stage rather than by exposing per-branch nested iterables.
- Treat the returned `ExtractionCheckpoint` as a candidate checkpoint only. `Extractor` may use it for final `branches` reporting immediately, but it must not persist it until output writing and writer close both succeed.
- Preserve the current missing-state fallback split: `Extractor` decides whether a missing checkpoint file is an error or a snapshot fallback, while `CommitTraversalExtractor` handles only the traversal semantics once it receives a validated prior checkpoint or an empty one.
- Keep output projection and file-change expansion physically close to the existing `Extractor` write loop in this phase so Phase 3 can split those concerns next without mixing that work into traversal extraction.

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- Snapshot commit-mode extraction still produces the same JSONL schema and the same `ExtractionResult` shape as before the split.
- Snapshot file-mode extraction still expands one output record per file change, advances progress only after each successful write, and still creates no empty output file on zero-record runs.
- Incremental extraction with an unchanged checkpoint still produces `recordsWritten = 0`, `filesCreated = 0`, and no output file.
- A merge-shaped `--since-date` history still skips older commits with `continue` semantics and does not terminate traversal early.
- Multi-branch runs still preserve CLI branch order, non-interleaved branch output, and cross-branch deduplication within one run.
- Incremental runs with a newly added branch still use merge-base exclusion to avoid cross-run duplicates, and orphan/no-common-ancestor cases still fall back to full traversal.
- A stale checkpoint hash that triggers `COMMIT_NOT_FOUND` still emits the warning and falls back to full extraction for that branch.
- A simulated output-write or writer-close failure still leaves the previously persisted checkpoint unchanged, proving that Phase 2 did not move checkpoint commit timing earlier.
