### Phase 7: Progress Reporting Redesign and Obsolete-Path Cleanup

_Redesign the human-facing stderr contract around stable execution stages, enrich the default
successful-run summary with context that explains zero-record runs, and remove the remaining
migration-only compatibility paths so the runtime edge talks directly to the finalized
coordinator pipeline._

#### Status

- [x] Planned
- [ ] In progress
- [ ] Completed

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- [`../instructions/architecture.instructions.md`](../instructions/architecture.instructions.md) —
  Phase 4 coordinator ownership, Phase 6 profiling, and the Phase 7 final-target contract updated
  during this planning session
- [`../instructions/cli.instructions.md`](../instructions/cli.instructions.md) — stderr progress,
  summary, `--quiet`, and `--profile` contracts updated during this planning session
- [`../roadmap.md`](../roadmap.md) — "CLI UX: Progress metrics quality and
  progress-display redesign" and the architecture migration target
- [`phase-4.md`](phase-4.md) — coordinator/sink ownership boundaries and the deferred progress
  redesign scope
- [`phase-5.md`](phase-5.md) — CLI parameter redesign and the deferred checkpoint-vocabulary
  compatibility cleanup
- [`phase-6.md`](phase-6.md) — profiling buckets that Phase 7 must keep distinct from the default
  summary

#### Design Decisions

- **Primary UX goals**: Phase 7 defines progress output first as a human-facing UX contract, not
  as an incidental projection of internal counters. The progress display must satisfy five goals:
  show liveness even when quantitative counters are temporarily unchanged, orient the user to the
  current stage, avoid pretending to know percentages or ETAs that the tool cannot justify,
  respect a low-noise stderr budget, and remain suppressible via `--quiet` for scripted use.
- **Owning layer**: human-facing progress rendering remains a CLI/runtime-edge responsibility, but
  the Core no longer reports progress as a single scalar record count. Phase 7 replaces the old
  `Reporter.progress(recordsWritten)` / `Reporter.done(recordsWritten)` contract with a structured,
  phase-aware progress reporter so implementation does not make up display semantics ad hoc.
- **Stable stderr stage model**: successful non-quiet runs use three stable stage lines only:
  `Preparing extraction`, `Extracting history`, and `Finalizing output`. Completed stage lines stay
  visible in stderr history. Only the currently active stage line may update in place.
- **Terminal rendering contract**: TTY-aware progress rendering is a CLI-edge concern, not a Core
  concern. The exact line shapes, spacing, and non-TTY suppression rules are fixed in
  `../instructions/cli.instructions.md`; this file records only the ownership split: Core emits
  semantic progress facts, while the CLI edge owns spinner frames, in-place redraws, and the final
  stderr presentation.
- **Heartbeat requirement**: every active stage must emit a liveness signal even when no semantic
  counter changed recently. Phase 7 fixes the preferred liveness signal as `spinner + elapsed`,
  with a silence budget of at most `1s` between visible updates while a stage is actively running.
  This rule applies equally to `Preparing extraction`, `Extracting history`, and
  `Finalizing output`.
- **Preparation-stage semantics**: `Preparing extraction` covers repository validation, branch/ref
  resolution, output-prefix derivation, and checkpoint read/validation when applicable. While it is
  active, its stage line must update using the stage spinner and elapsed time even when no
  quantitative counters exist yet.
- **Main execution-stage semantics**: the primary semantic stage is `Extracting history`, not separate
  `Traversing history` and `Writing output` stages. Traversal, expansion, projection, and sink
  writes overlap in the streaming pipeline, so splitting them into separate user-facing stages would
- describe the implementation misleadingly. The active line renders both liveness and the best
  available cumulative progress so far.
- **Live extraction metrics**: the `Extracting history` line includes exactly these fields, in this
  order after the spinner and stage label: branch position (`branch <current>/<total>`), `commits
traversed`, `records written`, humanized `bytes written`, and `elapsed`. It does not include
  current branch names, files created, ETA, per-stage timings, or percentage estimates.
- **Semantic updates vs heartbeat updates**: semantic updates are changes to branch position,
  traversed commits, written records, or written bytes. Heartbeat updates are spinner-frame and
  elapsed-time refreshes that show the process is still alive even when semantic counters are
  unchanged. The phase contract requires both concepts; semantic updates do not replace heartbeat
  updates.
- **Update cadence**: the active stage line updates at most once per second during steady-state
  work, plus immediate updates on stage transitions, warning recovery redraws, semantic progress
  changes, and final completion. Progress remains monotonic and only advances after successful Core
  work has actually completed.
- **Finalization-stage semantics**: `Finalizing output` covers sink close and checkpoint commit. It
  must emit the same heartbeat contract (`spinner + elapsed`, `<= 1s` silence budget) while the
  stage is active, even though it does not expose semantic counters.
- **Successful-run summary**: after the stage lines complete, the CLI prints the normal aligned
  summary block to stderr. Phase 7 fixes the default summary field order as: `Records written`,
  `Commits traversed`, `Files created`, `Bytes written`, `Elapsed time`, `Branches`. `Bytes
written` uses humanized units. `Commits traversed` is required specifically so zero-record runs
  still explain that real work occurred.
- **`--profile` ordering**: when `--profile` is requested and `--quiet` is not set, the aligned
  timing block is emitted after the default completion summary, separated by a single blank line.
  The summary remains the primary outcome report; profiling remains secondary diagnostic output.
- **`--quiet` and warnings**: `--quiet` suppresses the stage lines, the default completion summary,
  and the `--profile` block. It does not suppress warnings or errors, including meaningful
  extraction warnings such as incremental missing-state fallback notices.
- **Stage line layout (finalized)**: while a stage is active in a TTY, the runtime edge renders one
  line at a time using the following canonical layouts:

  ```text
  ⠋ Preparing extraction  0.3s
  ⠙ Extracting history  branch 2/3  commits 1542  records 3108  1.2 MB  8.5s
  ⠹ Finalizing output  0.8s
  ```

  The active line is the only line that updates in place. When a stage completes, the spinner is
  removed and the completed stage label is re-emitted in the same column with two leading spaces so
  the label column stays aligned:

  ```text
    Preparing extraction  0.3s
    Extracting history  branch 3/3  commits 1542  records 3108  1.2 MB  8.5s
    Finalizing output  0.8s
  ```

  `Preparing extraction` and `Finalizing output` show only spinner + elapsed while active.
  `Extracting history` shows spinner + branch position + `commits traversed` + `records written` +
  humanized `bytes written` + elapsed. No percentages, ETAs, filenames, or per-stage timing fields
  appear on the live lines.

- **Summary block layout (finalized)**: after the stage lines complete, the CLI emits exactly one
  aligned completion summary block using the following canonical layout:

  ```text
  Extraction complete
    Records written   : 3108
    Commits traversed : 1542
    Files created     : 524
    Bytes written     : 1.2 MB
    Elapsed time      : 8.5s
    Branches          : main, develop
  ```

  The same field order and alignment are used for zero-record successful runs. `Branches` always
  lists the resolved branch names comma-separated in traversal order; it is never abbreviated.

- **Heartbeat cadence (finalized)**: semantic updates redraw immediately whenever branch position,
  commit count, record count, or byte count changes. If no semantic change occurs, the CLI redraws
  the active TTY line at most once per second using the spinner frame and elapsed time. This keeps
  the silence budget within `1s` without turning the UI into a scrolling log.
- **Warning redraw behavior (finalized)**: if a warning interrupts an in-place progress line, the
  runtime edge first terminates the current line, prints the warning on its own stderr line, and
  then redraws the active stage line immediately when TTY rendering is enabled. Warnings are never
  embedded inside the progress line itself.
- **Non-TTY fallback (finalized)**: when `process.stderr.isTTY === false`, stage heartbeat lines are
  not rendered at all. The CLI still prints warnings and the final summary block, but it omits
  spinner frames, stage redraws, and in-place progress updates. This preserves log readability in
  redirected or CI output.
- **Progress event contract (finalized)**: Phase 7 adopts a single phase-aware progress contract in
  Core by replacing the old scalar `Reporter` (`warn/progress/done`) with a structured
  `ProgressReporter.emit(event)` interface. Core emits progress facts (`phase-start`,
  `extracting-progress`, `phase-end`, `warning`); CLI layer (`src/index.ts`) owns rendering policy,
  heartbeat timer, and terminal-specific redraw behavior. This keeps Core semantic and CLI
  presentation concerns separated while avoiding dual-progress pathways.
- **Heartbeat refresh strategy (finalized)**: Use a fixed `setInterval` heartbeat at `500ms`,
  supplemented by semantic updates when records are successfully written. On heartbeat ticks, redraw
  only when no recent semantic redraw has occurred; do not force redundant redraws. Feasibility is
  fully confirmed: Node.js processes timer callbacks between `for await` loop iterations in
  `DefaultExtractionCoordinator.run()` because each `await` (including inside `withProfilerAsync`)
  yields the event loop. Per-commit work (diff parsing, JSON serialization) is sub-millisecond and
  will not starve the timer. This hybrid satisfies the <= 1s silence budget with margin while
  keeping redraw noise bounded.
- **Event-loop blocking assessment (finalized)**: All pipeline stages are async-first. Assessment
  confirms no stage requires a fallback mechanism:
  `traversalPlanner.plan()` = one `await` per ref (not blocking),
  `traversalExtractor.extract()` = one `await` per commit (not blocking),
  `sink.write()` → `OutputWriter.write()` → `writeFile` = async (not blocking),
  `sink.close()` → `OutputWriter.close()` → `rename` = async (not blocking),
  per-commit work = sub-millisecond (not blocking).
  Timer will reliably fire during the write loop.
- **Coordinator responsibility for commit counting (finalized)**: `DefaultExtractionCoordinator`
  must track `commitsTraversed` by wrapping the `CommitFact` stream with a counter before it
  reaches the projector or expander, similar to how `recordsWritten` is tracked in the write loop.
  Coordinator exposes `commitsTraversed` in `CoordinatorResult` for use in the final summary and
  CLI-layer real-time progress tracking.
- **Branch index tracking (finalized)**: `DefaultExtractionCoordinator` tracks the current branch
  index and total branch count during traversal (already available from `plans` array). These are
  used by the CLI layer to render `branch <current>/<total>` on the active progress line.
- **Terminal interaction rules**: warnings and errors must remain readable. If a warning interrupts
  an in-place progress line, the CLI prints the warning on its own line and then redraws the active
  stage line so the liveness contract continues.
- **Feasibility boundary**: Phase 7 fixes the UX target first. Technical feasibility, including the
  possibility that a long synchronous operation blocks timer-driven spinner refreshes, is a
  subsequent implementation consideration. Any implementation compromise must be evaluated against
  this UX target rather than silently redefining the target around current constraints.
- **Metric ownership**: `commitsTraversed` is counted at the coordinator-owned pipeline boundary by
  wrapping the `CommitFact` stream before it reaches the projector or expander. `recordsWritten`
  and `bytesWritten` continue to advance only after successful `OutputSink.write()` calls.
- **Migration cleanup scope**: Phase 7 completes the architecture cleanup deferred from earlier
  phases. Remove the `Extractor` compatibility facade, remove the `StateStore` / `StateFile` /
  `StateBranchEntry` compatibility aliases in favor of checkpoint terms, and have `src/index.ts`
  construct the coordinator, stage instances, checkpoint store, sink, and progress reporter
  directly at the runtime edge.
- **New runtime dependencies**: none.

#### Deferred Design Controls

- **Why deferred**: Phase 7 now has a fixed UX contract, but some implementation choices depended
  on the real post-Phase-6 runtime shape rather than the planned architecture. Phase 6 is now
  complete, so those uncertainties are resolved; the remaining deferred items are implementation-
  design choices for the refinement session, not Phase 6 unknowns.
- **Phase 6 profiling shape (for reference)**: Phase 6 implemented a hierarchical
  `StageProfiler` / `DefaultStageProfiler` / `ProfilingEntry` system — not the flat
  `ExtractionTimings` bucket approach originally planned. `ExtractionResult.profilingEntries`
  (type: `readonly ProfilingEntry[]`) returns a preorder traversal of the profiler tree with
  path-based names (`elapsed`, `elapsed/planning`, `elapsed/traversal`, `elapsed/git`,
  `elapsed/git/walk-commits`, etc.). The root entry (`profilingEntries[0]`, name `"elapsed"`)
  holds the total wall time for the run. Phase 7 must use this `profilingEntries[0].wallMs` when
  it needs the run-level elapsed time from the Core result, rather than referencing any flat timing
  field. The profiling tree is always produced by the Core (root profiler starts on every run),
  but child stage profilers are only created when `ExtractorConfig.enableProfiling === true`;
  the summary's `Elapsed time` should use the runtime edge's own clock for consistency whether
  `--profile` is set or not.
- **Depends on**: Phases 4, 5, and 6 — all completed. Phase 6 is the direct refinement
  prerequisite because it introduces the hierarchical `StageProfiler` / `profilingEntries` runtime
  shape and the latest stderr/output behavior that Phase 7 extends. All predecessor phases have
  been implemented and reviewed.
- **Fixed before refinement**: the human-facing UX contract is already locked. The phase keeps the
  three-stage stderr model (`Preparing extraction`, `Extracting history`, `Finalizing output`), the
  liveness requirement for every active stage, `spinner + elapsed` as the preferred heartbeat
  signal, the `<= 1s` silence budget, the distinction between heartbeat updates and semantic
  updates, the default summary field order, `--profile` ordering after the summary, `--quiet`
  suppression rules, and the requirement that warnings/errors remain readable. The phase also keeps
  the release intent that obsolete migration-only paths should be cleaned up once the final runtime
  shape is known.
- **To be finalized in refinement**: ~~the concrete implementation strategy for heartbeat refresh;
  whether timer-driven spinner redraw can be guaranteed on the actual post-Phase-6 runtime path;
  whether any event-loop-blocked code paths require a bounded fallback behavior; the exact Core
  progress event types and ownership split needed to realize the UX contract; and the final list of
  target files/tests once predecessor implementation evidence is available.~~ **RESOLVED** during
  refinement. See Design Decisions section for finalized heartbeat strategy, event-loop assessment,
  commit counting responsibility, branch tracking, and ownership split. Target files confirmed below.
- **Refinement trigger**: **Met.** Phase 6 implementation and review completed. The repository is
  in the post-Phase-6 state. The trunk session is ready to run a dedicated design refinement
  session for Phase 7.
- **Required inputs**: the current `PLAN.md`; this phase file; Phase 4, 5, and 6 branch-session
  summaries; the implemented repository state after Phase 6; relevant stderr/profiling code paths;
  and the current versions of `architecture.instructions.md` and `cli.instructions.md`.

#### Non-Goals

- Changing JSON output schema or file-rotation semantics.
- Changing CLI parameters introduced in Phase 5.
- Promoting per-stage profiling entries (`ProfilingEntry` tree) into the default summary; that
  remains exclusive to `--profile`.
- Adding color, ETA estimation, percentages, or per-branch/per-file log lines.
- Emitting progress or summaries on stdout.
- Revisiting diff-backend abstraction or broader naming-audit work beyond the explicitly deferred
  migration compatibility paths.

#### Target Files

| File                                       | Action  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                             | Modify  | Add phase state machine (preparing → extracting → finalizing), fixed 500ms spinner/elapsed heartbeat timer with redraw suppression on recent semantic updates, real-time progress tracking (branch index, commit count, record count, bytes), stage line rendering, final summary block rendering, warning interruption handling. Wire coordinator directly instead of using Extractor facade.                                                             |
| `src/cli/args.ts`                          | Modify  | Verify `--quiet` / `--profile` help text is aligned with finalized stderr contract. No flag changes needed.                                                                                                                                                                                                                                                                                                                                                |
| `src/core/types.ts`                        | Modify  | (1) Replace old `Reporter` with phase-aware `ProgressReporter` and typed `ProgressEvent` union. (2) Add `commitsTraversed` field to `CoordinatorResult`. (3) Remove checkpoint compatibility aliases (`StateStore`, `StateFile`, `StateBranchEntry`).                                                                                                                                                                                                      |
| `src/core/extraction-coordinator.ts`       | Modify  | (1) Emit structured progress events (`phase-start`, `extracting-progress`, `phase-end`, `warning`) via `ProgressReporter`. (2) Count `commitsTraversed` by wrapping the `CommitFact` stream with a counter before expansion/projection. (3) Track `branchIndex` and `branchCount` during traversal loop. (4) Expose summary fields in `CoordinatorResult`. Preserve checkpoint write ordering and write-after-success semantics.                           |
| `src/core/commit-traversal-extractor.ts`   | Inspect | No changes needed. Coordinator will wrap the output stream; counting happens at coordinator boundary, not in extractor.                                                                                                                                                                                                                                                                                                                                    |
| `src/core/extractor.ts`                    | Delete  | Remove the migration-only `Extractor` compatibility facade. Index.ts will construct coordinator, stages, sink, and checkpoint store directly.                                                                                                                                                                                                                                                                                                              |
| `src/core/index.ts`                        | Modify  | Remove `Extractor` export. Update exports to include `DefaultExtractionCoordinator`, `CoordinatorRequest`, `CoordinatorResult`, and other stage types needed at the runtime edge.                                                                                                                                                                                                                                                                          |
| `test/cli/args.test.ts`                    | Modify  | Verify `--quiet` / `--profile` help text. No new test cases needed unless help text changes.                                                                                                                                                                                                                                                                                                                                                               |
| `test/core/extraction-coordinator.test.ts` | Modify  | Assert deterministic progress event sequence and payload (`phase-start`/`extracting-progress`/`phase-end`/`warning`) plus `CoordinatorResult.commitsTraversed` and branch tracking correctness across multi-branch extractions.                                                                                                                                                                                                                            |
| `test/core/extractor.test.ts`              | Delete  | Extractor facade is removed; tests targeting it are no longer needed.                                                                                                                                                                                                                                                                                                                                                                                      |
| `test/index.test.ts`                       | Add     | **NEW** — Cover top-level stderr contract: (1) Three stable stage lines appear in order. (2) Spinner + elapsed refresh every ~1s while stage is active. (3) Semantic updates on record/metric changes. (4) Summary block with correct field order and humanized bytes. (5) Profile block ordering after summary. (6) `--quiet` suppression. (7) Warning visibility under `--quiet`. Use fake clocks and captured stderr buffers for deterministic testing. |

#### Documentation Touchpoints

| File                                                | Section                                              | Action |
| --------------------------------------------------- | ---------------------------------------------------- | ------ |
| `README.md`                                         | "CLI" and "Output"                                   | Update |
| `docs/usage.md`                                     | "CLI reference" and examples                         | Update |
| `docs/design/architecture.md`                       | "Core Pipeline" and runtime wiring                   | Update |
| `.github/instructions/architecture.instructions.md` | "Phase 7 final contract" and migration cleanup scope | Update |
| `.github/instructions/cli.instructions.md`          | "Control" section and stderr success contract        | Update |
| `.github/roadmap.md`                                | Remove resolved v0.4.0 architecture/progress items   | Remove |

#### Implementation Notes

- Keep the stage labels exactly as planned: `Preparing extraction`, `Extracting history`, and
  `Finalizing output`.
- This phase must not enter a development branch session until a dedicated design refinement
  session resolves the deferred implementation-feasibility items and updates this file to
  implementation-ready.
- Preserve the "only the active stage line updates" rule even when extraction is fast; do not fall
  back to a scrolling progress log.
- The active stage line must continue to refresh at least once per second while work is ongoing,
  even if semantic counters have not changed. Spinner-frame advancement plus elapsed-time refresh is
  the preferred mechanism.
- Prefer deterministic tests with fake clocks and captured stderr buffers over timing-sensitive
  assertions against real terminal output.
- The default summary block should still be printed for zero-record successful runs when
  `--quiet` is absent.
- Warnings remain immediate stderr messages even under `--quiet`; quiet mode only suppresses the
  incidental progress/profiling/success-reporting contract.
- Treat timer-driven liveness refresh as a design requirement to attempt, not as an optional nice
  to have. If event-loop blocking makes the exact spinner behavior unattainable in some code path,
  implementation must document the gap explicitly instead of quietly dropping the liveness goal.

#### Design Hand-off Contract

This phase is implemented in a separate session. The implementation session must treat this file as
the source of truth for Phase 7 design decisions and must not infer behavior from prior chat
history. If implementation discovers a blocker against these rules, update this file first, then
proceed.

##### Implementation Readiness Checklist (Finalized)

1. **Progress contract**: replace old scalar `Reporter` with a single phase-aware
   `ProgressReporter.emit(ProgressEvent)` pathway.
2. **Heartbeat**: fixed `500ms` heartbeat checks with immediate semantic redraws; heartbeat ticks
   skip redundant redraws when a recent semantic redraw already occurred.
3. **Branch position semantics**: `branch <current>/<total>` uses resolved traversal plans only
   (`total = resolved plan count`, `current = 1-based index of active resolved plan`).
4. **Migration execution shape**: complete migration in one implementation phase with fixed order:
   type/event contract updates -> runtime wiring migration -> core export updates ->
   `src/core/extractor.ts` removal -> compatibility alias removal.
5. **Non-TTY behavior**: no heartbeat/spinner/in-place redraw output; warnings and final summary
   remain visible; `--profile` block remains after summary when not quiet.
6. **Instruction sync**: keep
   `.github/instructions/architecture.instructions.md` and
   `.github/instructions/cli.instructions.md` aligned with implemented behavior in the same
   implementation phase before completion.

#### Code-Level Implementation Guide

The following code-level guidance is normative for Phase 7 implementation. It exists to reduce
design drift at implementation time while keeping the architecture boundaries explicit.

##### 1. Runtime-edge progress responsibilities

Keep CLI presentation concerns out of Core. At minimum, split progress logic in `src/index.ts` into
controller/state, formatting, and terminal I/O responsibilities.

```ts
interface ProgressRenderer {
  renderActive(
    stage: "preparing" | "extracting" | "finalizing",
    snapshot: ProgressSnapshot,
  ): string;
  renderDone(stage: "preparing" | "extracting" | "finalizing", snapshot: ProgressSnapshot): string;
  renderSummary(result: SummarySnapshot): readonly string[];
}

interface TerminalSink {
  readonly isTTY: boolean;
  writeLine(line: string): void;
  rewriteLine(line: string): void; // no-op in non-TTY mode
  newline(): void;
}
```

##### 2. Core progress contract (single path)

Replace the old scalar `Reporter` with a phase-aware `ProgressReporter` and event union. Do not
keep a dual pathway (`Reporter` + side-channel sink).

Core progress events must remain wall-clock independent. Elapsed-time calculation for UI rendering
belongs to the runtime edge (CLI) using injected clocks.

```ts
type ProgressPhase = "preparing" | "extracting" | "finalizing";

type ProgressEvent =
  | { type: "phase-start"; phase: ProgressPhase }
  | {
      type: "extracting-progress";
      phase: "extracting";
      branchIndex: number; // 1-based among resolved branches
      branchCount: number;
      commitsTraversed: number;
      recordsWritten: number;
      bytesWritten: number;
    }
  | { type: "phase-end"; phase: ProgressPhase }
  | { type: "warning"; message: string };

interface ProgressReporter {
  emit(event: ProgressEvent): void;
}
```

##### 3. Core result contract needed by summary

`CoordinatorResult` must expose fields required by finalized summary semantics.

```ts
interface CoordinatorResult {
  readonly recordsWritten: number;
  readonly commitsTraversed: number;
  readonly branches: readonly string[]; // resolved branches in traversal order
}
```

##### 4. Branch-position semantics (prevent off-by-one drift)

`branch <current>/<total>` is computed from resolved traversal plans only (not requested branches).
Define this explicitly in coordinator tests.

```ts
// In coordinator execution loop:
// total = plans.length after planning
// current = index of currently traversed plan + 1
```

##### 5. Heartbeat scheduler lifecycle

Centralize timer start/stop/dispose. Never let rendering timers outlive the active stage.

For Phase 7, use a fixed `500ms` heartbeat interval. Heartbeat ticks are eligibility checks, not
forced redraws: skip redraw when a semantic update was rendered recently.

```ts
interface HeartbeatScheduler {
  start(intervalMs: number, onTick: () => void): void;
  stop(): void;
  dispose(): void;
}

function shouldRedrawOnHeartbeat(lastSemanticRedrawAtMs: number, nowMs: number): boolean {
  return nowMs - lastSemanticRedrawAtMs >= 500;
}
```

##### 6. Warning interruption sequence

Enforce the exact warning write order in one helper so behavior is consistent across call sites.

```ts
function interruptWithWarning(
  activeLine: string | null,
  warning: string,
  sink: TerminalSink,
): void {
  if (activeLine !== null && sink.isTTY) {
    sink.newline();
  }
  sink.writeLine(warning);
  if (activeLine !== null && sink.isTTY) {
    sink.rewriteLine(activeLine);
  }
}
```

##### 7. UI mode gating in one place

Avoid scattered `isTTY` / `quiet` branching by normalizing mode once at runtime edge.

```ts
type UiMode = "quiet" | "tty-interactive" | "non-tty-summary";

function resolveUiMode(quiet: boolean, isTTY: boolean): UiMode {
  if (quiet) return "quiet";
  return isTTY ? "tty-interactive" : "non-tty-summary";
}
```

##### 8. Formatting must be pure

Keep string formatting functions free of side effects so snapshot tests remain deterministic.

```ts
function formatExtractingLine(snapshot: ProgressSnapshot): string;
function formatDoneLine(
  stage: "preparing" | "extracting" | "finalizing",
  snapshot: ProgressSnapshot,
): string;
function formatSummary(snapshot: SummarySnapshot): readonly string[];
```

##### 9. Runtime composition after Extractor removal

After removing `Extractor`, avoid turning `index.ts` into a monolith. Use a composition function
that constructs coordinator/stages/sink/store/reporting in one place.

```ts
interface RuntimeDependencies {
  coordinator: ExtractionCoordinator;
  checkpointStore?: CheckpointStore;
  sink: OutputSink;
  progress: ProgressReporter;
}

function buildRuntimeDependencies(parsed: ParsedArgs, adapter: GitAdapter): RuntimeDependencies;
```

##### 10. Deterministic test seams

Inject clock/scheduler/sink abstractions; do not rely on real timers in tests.

```ts
interface Clock {
  nowMs(): number;
}

interface Scheduler {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}
```

##### 11. Migration cleanup order (compile-safe)

To avoid transient breakage in the same branch session:

1. Extend coordinator result/events and tests.
2. Move runtime wiring in `src/index.ts` from `Extractor` to direct coordinator composition.
3. Update exports in `src/core/index.ts`.
4. Remove `src/core/extractor.ts`.
5. Remove compatibility aliases (`StateStore`, `StateFile`, `StateBranchEntry`) and fix imports.

##### 12. Profiling/progress boundary

Keep profiling data and live progress data separate:

- Progress line updates must use progress facts and runtime-edge clocks.
- `profilingEntries` remain completion-time diagnostics (`--profile` block only).
- Never derive progress heartbeat cadence from profiler measurements.

#### Verification

**Automated:**

```bash
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- Run `gitrail -b <ref> <repository-path>` and confirm stderr shows exactly three stable stage
  lines (`Preparing extraction`, `Extracting history`, `Finalizing output`), with only the active
  line updating in place and with visible liveness refresh at least once per second while a stage
  remains active.
- Run a zero-record successful incremental extraction and confirm the default summary still shows
  `Commits traversed` so the run explains completed work even when `Records written` is `0`.
- Force or simulate a long preparation/finalization path in tests and confirm those stages still
  show heartbeat updates via spinner/elapsed refresh rather than going silent until completion.
- Run `gitrail --profile -b <ref> <repository-path>` and confirm the default summary appears first
  and the aligned profile block appears after a single blank line.
- Run `gitrail --quiet --profile -b <ref> <repository-path>` and confirm progress, summary, and
  profile output are suppressed while warnings/errors still remain visible when applicable.
