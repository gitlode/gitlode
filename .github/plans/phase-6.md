### Phase 6: Stage-Aligned Profiling Instrumentation

_Add monotonic, stage-aligned timing instrumentation across traversal, Git diff internals,
projection, and sink writes. Surface the resulting timings programmatically through an optional
`ExtractionResult.timings` field and optionally print them with `--profile`, without changing the
default stderr contract when profiling is not requested._

#### Status

- [x] Planned
- [ ] In progress
- [ ] Completed

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- [`../instructions/architecture.instructions.md`](../instructions/architecture.instructions.md) —
  Phase 4 coordinator/sink ownership boundaries and the Phase 6 profiling contract updated during
  this planning session
- [`../instructions/cli.instructions.md`](../instructions/cli.instructions.md) — `--profile`
  flag contract and `--quiet` interaction updated during this planning session
- [`../roadmap.md`](../roadmap.md) — "Development: Granular performance profiling"
- [`phase-4.md`](phase-4.md) — coordinator, traversal, projector, and sink stage boundaries that
  profiling must align with

#### Design Decisions

- **Preferred API / library / Node.js built-in**: use the existing injected monotonic clock
  pattern based on `performance.now()`; do not add an external profiling or tracing dependency.
  Profiling is implemented with explicit numeric accumulators and small helper methods, not a
  general-purpose instrumentation framework.
- **Owning layer**: stage timing is owned by the stage that directly performs the work.
  `CommitTraversalExtractor` owns traversal timing, the active projector owns projection timing,
  `ExtractionCoordinator` owns sink-write timing, and `IsomorphicGitAdapter` owns the blob-read and
  diff-computation sub-timings that occur inside `getFileChanges()`. The CLI layer owns only the
  `--profile` flag and stderr rendering.
- **`ExtractionResult` contract**: add `timings?: ExtractionTimings` to `ExtractionResult` in
  Phase 6. The field remains optional for compatibility, but successful extraction runs populate it
  unconditionally once this phase is implemented, regardless of whether `--profile` is set.
- **`ExtractionTimings` type**: define `ExtractionTimings` in `src/core/types.ts` as a Core-owned
  TypeScript `interface` with required, readonly numeric buckets only. Phase 6 fixes the type as:

  ```ts
  export interface ExtractionTimings {
    readonly traversalMs: number;
    readonly blobReadMs: number;
    readonly diffMs: number;
    readonly projectionMs: number;
    readonly writeMs: number;
  }
  ```

  The type does not include `elapsedMs`, nested stage objects, optional bucket properties, or a
  generic map/index signature. Total duration remains represented only by `ExtractionResult.elapsedMs`.

- **Timing shape**: the stable timing buckets are `traversalMs`, `blobReadMs`, `diffMs`,
  `projectionMs`, and `writeMs`. Existing `elapsedMs` remains the authoritative total wall-clock
  duration. `blobReadMs` and `diffMs` are present and set to `0` for commit-granularity runs.
  `writeMs` includes `OutputSink.write()` and `OutputSink.close()`, but excludes checkpoint-state
  file writes.
- **Double-counting rule**: timing buckets are intended to be additive at the category level.
  Phase 6 must not add a separate "expansion wall time" bucket on top of `blobReadMs` and `diffMs`,
  because the substantive file-expansion cost is already represented there.
- **Git adapter boundary**: keep the `GitAdapter` interface unchanged in Phase 6. Profiling must
  not change `getFileChanges()` return values or add profiling metadata to the adapter interface.
  The concrete `IsomorphicGitAdapter` may accept an optional profiler/accumulator dependency via
  construction or equivalent injected helper.
- **CLI flag**: add a new boolean `--profile` flag with no short alias. The flag does not alter
  extraction behavior or the returned timing data; it only requests successful-run stderr output.
- **Output stream**: `--profile` writes to stderr only, and only on successful completion. It is
  off by default so the current default stderr behavior remains unchanged. `--quiet` suppresses the
  normal progress output, the default completion summary, and any `--profile` output.
- **Failure-path behavior**: Phase 6 does not print partial or failure-path profile output. On
  extraction failure, current error-path behavior remains unchanged and no profile block is
  emitted.
- **New runtime dependencies**: none.
- **Edge case behavior**: zero-record successful runs still produce populated timing buckets with
  non-negative numeric values. Timing categories that were not exercised in a run remain `0`, not
  `undefined`.
- **Scope boundary**: Phase 6 measures extraction-stage work only. It does not time CLI argument
  parsing, output-prefix derivation, checkpoint-state read/write, or top-level process startup.

#### Non-Goals

- Redesigning progress-display semantics, cadence, or units; that belongs to Phase 7.
- Changing the default stderr output when `--profile` is absent.
- Printing partial timings on failure or interruption.
- Adding per-branch, per-commit, or per-file timing breakdowns.
- Replacing or abstracting the diff backend based on profiling data; Phase 6 collects evidence but
  does not optimize the algorithm.
- Introducing a generic tracing/event system for the whole process.

#### Target Files

| File                                       | Action | Notes                                                                                                                         |
| ------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/args.ts`                          | Modify | Add `--profile` as a boolean flag and update help text to describe its stderr behavior.                                       |
| `src/index.ts`                             | Modify | Render the successful-run profiling output to stderr when `profile === true` and `quiet === false`.                           |
| `src/core/types.ts`                        | Modify | Add `ExtractionTimings` and the optional `timings` field on `ExtractionResult`.                                               |
| `src/core/extractor.ts`                    | Modify | Create/reset the per-run profiler, thread it through extraction wiring, and copy the timing snapshot into `ExtractionResult`. |
| `src/core/extraction-coordinator.ts`       | Modify | Time `OutputSink.write()` and `OutputSink.close()` without changing checkpoint ordering.                                      |
| `src/core/commit-traversal-extractor.ts`   | Modify | Accumulate traversal timing around traversal-stage work only.                                                                 |
| `src/core/commit-record-projector.ts`      | Modify | Accumulate commit-projection timing into the shared `projectionMs` bucket.                                                    |
| `src/core/file-change-record-projector.ts` | Modify | Accumulate file-projection timing into the shared `projectionMs` bucket.                                                      |
| `src/git/isomorphic-git-adapter.ts`        | Modify | Accumulate `blobReadMs` and `diffMs` internally while keeping the `GitAdapter` interface unchanged.                           |
| `test/cli/args.test.ts`                    | Modify | Cover `--profile` parsing and the new help/validation expectations.                                                           |
| `test/core/extractor.test.ts`              | Modify | Assert the populated `timings` field and compatibility with the existing `ExtractionResult` fields.                           |
| `test/core/extraction-coordinator.test.ts` | Modify | Assert sink-write timing boundaries and that checkpoint ordering is unchanged.                                                |
| `test/git/isomorphic-git-adapter.test.ts`  | Modify | Assert adapter profiling buckets for blob reads and diff computation without changing file-change semantics.                  |

#### Documentation Touchpoints

| File                                                | Section                                       | Action |
| --------------------------------------------------- | --------------------------------------------- | ------ |
| `README.md`                                         | "CLI" and "Output"                            | Update |
| `docs/usage.md`                                     | "CLI reference"                               | Update |
| `docs/design/architecture.md`                       | "Extensibility Notes"                         | Update |
| `.github/instructions/architecture.instructions.md` | "v0.4.0 Migration Contract"                   | Update |
| `.github/instructions/cli.instructions.md`          | "Control" and "Usage Examples"                | Update |
| `.github/roadmap.md`                                | "Development: Granular performance profiling" | Remove |

#### Implementation Notes

- Use one fresh profiler instance per extraction run. Do not reuse accumulated timing state across
  multiple runs on the same process or adapter instance.
- `writeMs` must wrap only sink persistence work (`write` and `close`). It must not absorb
  projection, progress-reporting, or checkpoint-write time.
- Favor deterministic unit tests with injected fake monotonic clocks over assertions that depend on
  real elapsed time or wall-clock thresholds.
  - Emit successful-run profiling output as an aligned multi-line block on stderr when `--profile` is
    requested and `--quiet` is not present.

#### Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- Run `gitrail -b <ref> --profile <repository-path>` and confirm that the normal successful-run
  stderr output is preserved and an additional profiling section is emitted only when profiling is
  requested.
- Run `gitrail -b <ref> --profile --quiet <repository-path>` and confirm that progress, default
  summary, and profile output are all suppressed.
- In unit tests using an injected fake monotonic clock, confirm that a successful run returns a
  populated `timings` object with non-negative numbers in every bucket and that commit-mode runs
  report `blobReadMs === 0` and `diffMs === 0`.
