### Phase 3: Main Orchestration Refactor and Unit-Test Expansion

_This phase refactors the CLI entrypoint into a small set of CLI-layer runtime helpers so `src/index.ts` becomes a thin process boundary while preserving Phase 2 warning/termination/reporting behavior and the existing extraction semantics. It also expands behavior-focused tests around orchestration branches that are currently hard to cover without broad `process` and module-mock coupling._

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `.github/instructions/architecture.instructions.md` — ownership and boundary rules, progress/profiling contracts, invariants, and file-layout conventions
- `.github/instructions/cli.instructions.md` — successful-run stderr contract, `--quiet` / `--profile` behavior, TTY vs non-TTY rendering expectations, and exit-code requirements
- `.github/instructions/development-workflow.instructions.md` — planning-branch scope, phase-file contract, and documentation-touchpoint obligations
- `.github/plans/phase-2.md` — warning/termination/reporting boundaries and run-scoped injection rules that Phase 3 must preserve
- `.github/roadmap.md` — "Architecture/CLI Runtime: `main` orchestration refactoring and unit-test expansion"

#### Design Decisions

- **Owning layer**: The refactor remains entirely in the CLI layer. No orchestration responsibility moves into Core, Git, or Output. Helper extraction is permitted only under `packages/gitlode/src/cli/` so the runtime edge stays above the coordinator/stage pipeline instead of becoming a second orchestration layer inside Core.
- **Responsibilities that stay in `packages/gitlode/src/index.ts`**: `src/index.ts` remains the only process boundary. It keeps CLI bootstrap (`shouldRunAsCli()`), Node/process-backed default environment creation, invocation of one top-level run function, final fatal stderr rendering, and final exit-code selection. It must stop owning plugin bootstrap details, progress-controller setup, state-store/file wiring, and success-report rendering logic directly.
- **Responsibilities that move out of `packages/gitlode/src/index.ts`**: Move Node-backed state persistence/loading, progress-runtime creation, one-run orchestration/execution, and successful-run summary/profile rendering into focused CLI runtime helpers. The current test-only exports `assertSupportedRepositoryObjectFormat` and `loadPriorState` should move to their owning helper module rather than remaining exported from `src/index.ts`.
- **Target module decomposition**: Introduce a new internal CLI runtime folder with these boundaries:
  - `packages/gitlode/src/cli/runtime/types.ts` — CLI-runtime-local interfaces and result shapes used only by the runtime helpers and `src/index.ts`; do not widen public package exports.
  - `packages/gitlode/src/cli/runtime/state-store.ts` — `NodeStateStore`, repository object-format guard, and prior-state loading/validation/fallback logic.
  - `packages/gitlode/src/cli/runtime/progress-runtime.ts` — creation of the warning/progress runtime for `quiet`, `tty-interactive`, and `non-tty-summary` modes, including the stderr terminal sink bridge.
  - `packages/gitlode/src/cli/runtime/execution.ts` — the main per-invocation orchestration function that derives repo metadata, creates writer/sink/profilers/stages, performs plugin bootstrap, runs the coordinator, and returns a success payload for final rendering.
  - `packages/gitlode/src/cli/runtime/success-report.ts` — rendering of the aligned summary block and optional profile block from an already completed successful run.
  - `packages/gitlode/src/cli/runtime/index.ts` — barrel re-export for `src/index.ts` only.
- **Module naming convention**: Use role-based names under `src/cli/runtime/` with one primary export per file (`create*`, `load*`, `run*`, `render*`). Do not introduce a generic `utils.ts` or `helpers.ts` dumping ground. Small private helpers such as repo-name derivation may stay local to their owning module when they do not represent a reusable seam.
- **Dependency-injection strategy**: Prefer function-oriented orchestration helpers with explicit dependency bags over new service classes. Each extracted helper should accept the smallest dependency interface that lets tests supply fakes directly, without `vi.mock(...)`-heavy module substitution or deep inspection of `process` globals.
- **Constructor/options injection vs function-argument injection**: Use constructor/options injection only for run-scoped concrete collaborators that already have stable identity and lifetime for the full invocation (for example `IsomorphicGitAdapter`, `OutputWriter`, `DefaultStageProfiler`, `ProgressController`, and `NodeStateStore`). Use function-argument injection for per-call data and branch-specific values (`ParsedArgs`, resolved repo path, session timestamp, prior state, quiet/profile flags, resolved remote URL, and already-built reporter/runtime handles).
- **Top-level termination contract**: Phase 2's typed termination boundary remains authoritative. Extracted runtime helpers may return typed success / user-error / runtime-error outcomes, but only `src/index.ts` may decide the final stderr fatal rendering and process exit code.
- **Warning/reporting contract**: Phase 2 warning-capability rules remain unchanged. All non-fatal warnings still flow through the unified warning path, `--quiet` continues to suppress progress/summary/profile but not warnings, and TTY vs non-TTY behavior must remain exactly as specified in `cli.instructions.md`.
- **Success-report contract**: The successful-run summary block and optional profile block keep the current text content, field order, blank-line behavior, and suppression rules. Refactoring may move the rendering code, but it must not change the observable stderr contract.
- **Plugin-bootstrap contract**: Plugin config loading, entry resolution, compatibility checks, initialization ordering, failure aggregation, and the `initializing-plugins` phase remain behaviorally unchanged. Phase 3 may only relocate the orchestration call path so those branches become easier to test.
- **Extraction semantics**: The coordinator request shape, state commit timing, record projection semantics, traversal semantics, diff behavior, and repo/output metadata semantics remain unchanged. This phase is explicitly a structural refactor plus test expansion, not a semantic extraction change.
- **Testing strategy boundary**: The new tests should target extracted orchestration units directly with small fakes and narrow temp-directory fixtures. Do not add child-process-spawn CLI end-to-end tests in this phase. The goal is to improve branch coverage and reviewability without introducing a second, slower black-box test harness.
- **Coverage targets by branch**: Phase 3 should explicitly cover all top-level orchestration branches that are still weak today: successful run, typed user error, unexpected runtime error, plugin-init fatal aggregation, no-config vs config projector selection, summary/profile suppression under `--quiet`, and TTY vs non-TTY progress/runtime selection. Because `src/index.ts` becomes thin, its own remaining branches should be driven to near-complete direct branch coverage through unit tests.
- **Phase scope guard**: Do not use Phase 3 to redesign CLI option parsing, plugin contracts, progress-controller internals, or future worker/runtime abstractions. If a refactor idea requires changing CLI behavior, adding new option surface, or reopening Phase 2 capability boundaries, defer it.
- **Deferred concerns that remain in `src/index.ts` after Phase 3**: Keep the Node-specific bootstrap guard, process-backed environment selection, and final exit/error rendering in `src/index.ts`. Defer any broader host-abstraction work (for example worker hosts, spawned CLI harnesses, or alternate runtime hosts) to follow-up runtime phases instead of widening this phase.

#### Non-Goals

- Changing CLI options, defaults, validation wording, warning wording, exit codes, summary/profile text, or TTY/non-TTY behavior
- Moving orchestration logic into Core or introducing new Core abstractions solely to make the CLI entrypoint smaller
- Redesigning plugin config loading, plugin contracts, or progress-controller internals beyond the minimum extraction needed for testable orchestration seams
- Adding child-process black-box CLI tests or a new end-to-end fixture harness
- Reopening Phase 2 authority boundaries for warnings, termination, or run-scoped service injection

#### Target Files

| File                                                         | Action | Notes                                                                                                                                          |
| ------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/gitlode/src/index.ts`                              | Modify | Reduce to process bootstrap, default environment wiring, and final exit/error handling only.                                                   |
| `packages/gitlode/src/cli/runtime/index.ts`                  | Create | Internal barrel for the extracted runtime helpers used by `src/index.ts`.                                                                      |
| `packages/gitlode/src/cli/runtime/types.ts`                  | Create | Runtime-local interfaces and run-result types; keep them internal to the CLI layer.                                                            |
| `packages/gitlode/src/cli/runtime/state-store.ts`            | Create | Move `NodeStateStore`, repository-object-format guard, and prior-state loading/validation here.                                                |
| `packages/gitlode/src/cli/runtime/progress-runtime.ts`       | Create | Build the progress/warning runtime and terminal sink bridge for quiet, TTY, and non-TTY modes.                                                 |
| `packages/gitlode/src/cli/runtime/execution.ts`              | Create | Own one-run orchestration from validated args through coordinator result.                                                                      |
| `packages/gitlode/src/cli/runtime/success-report.ts`         | Create | Render summary/profile output from completed-run data without owning process exit behavior.                                                    |
| `packages/gitlode/test/index.test.ts`                        | Modify | Narrow to entrypoint/process-boundary behavior instead of owning state/progress helper tests.                                                  |
| `packages/gitlode/test/cli/runtime/state-store.test.ts`      | Create | Cover prior-state validation, missing-state snapshot fallback, and object-format gating.                                                       |
| `packages/gitlode/test/cli/runtime/progress-runtime.test.ts` | Create | Cover quiet / TTY / non-TTY runtime selection and warning/progress bridging.                                                                   |
| `packages/gitlode/test/cli/runtime/execution.test.ts`        | Create | Cover success, user-error propagation, runtime-error propagation, config/no-config branching, and plugin-init failure aggregation using fakes. |
| `packages/gitlode/test/cli/runtime/success-report.test.ts`   | Create | Cover summary/profile suppression and rendering behavior without process-global mocks.                                                         |
| `packages/gitlode/test/cli/plugins.test.ts`                  | Modify | Keep plugin-loader specifics covered where helper extraction changes call boundaries or aggregation shapes.                                    |

#### Documentation Touchpoints

| File                                                | Section                                       | Action  |
| --------------------------------------------------- | --------------------------------------------- | ------- |
| `.github/instructions/architecture.instructions.md` | "Ownership and boundary rules"                | Update  |
| `.github/instructions/architecture.instructions.md` | "Progress and profiling contracts"            | Update  |
| `.github/instructions/architecture.instructions.md` | "CLI Layer (`src/cli/`)"                      | Update  |
| `packages/gitlode/docs/design/architecture.md`      | "Layer Responsibilities"                      | Update  |
| `packages/gitlode/docs/design/architecture.md`      | "Profiling Instrumentation"                   | Update  |
| `packages/gitlode/docs/design/architecture.md`      | "Plugin Runtime"                              | Update  |
| `packages/gitlode/docs/design/architecture.md`      | "Wiring at the runtime edge (`src/index.ts`)" | Replace |

#### Implementation Notes

- Implement the helper extraction from the leaves inward: first move state/progress/report helpers with their new tests, then extract the execution orchestrator, and thin `src/index.ts` last. This sequencing minimizes simultaneous breakage in the entrypoint while keeping focused validation available after each move.
- Prefer fakes over spies in the new orchestration tests. The extracted helper APIs should make it possible to supply in-memory reporters, sinks, profilers, plugin bootstrap functions, and coordinator stubs directly.
- After the refactor, `src/index.ts` should no longer serve as an internal helper-export module just to support tests. Tests should import the owning helper module instead.
- Keep new runtime helper types internal to the package. Phase 3 does not add a public runtime API surface alongside `./plugin-api`.

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```text
npm run build
npm test
npm run lint
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- Run a successful extraction in normal mode and confirm the summary block text, field order, and blank-line separation from optional profile output are unchanged from pre-refactor behavior.
- Run the same extraction with `--quiet` and confirm progress, summary, and profile output are suppressed while warnings remain visible.
- Run a successful extraction in both TTY and redirected non-TTY contexts and confirm TTY mode still shows live stage updates while non-TTY mode still suppresses heartbeat output and emits only warnings plus the final summary.
- Run with `--profile` and confirm the aligned profile block still appears only on successful non-quiet runs.
- Run with a config that causes plugin initialization to fail and confirm the aggregated fatal messages, exit code, and top-level rendering remain unchanged.
