### Phase 2: Runtime/Plugin Responsibility Boundary Consolidation

_This phase consolidates run-scoped authority boundaries by replacing helper-owned exits and mixed reporting paths with typed termination propagation, capability-scoped reporting, and a one-time plugin runtime context injected during required plugin initialization. The goal is to make `src/index.ts` the single owner of outcome classification and exit-code selection, while a run-scoped CLI presenter becomes the single owner of stderr rendering and progress-surface lifecycle after runtime services are initialized._

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `.github/instructions/architecture.instructions.md` — ownership and boundary rules, progress and profiling contracts, invariants, and error-handling conventions
- `.github/instructions/cli.instructions.md` — successful-run stderr contract, warning visibility under `--quiet`, validation rules, and exit-code expectations
- `.github/instructions/plugin-policy.instructions.md` — breaking plugin API implications for official plugin packages and peer-range policy
- `.github/roadmap.md` — "Architecture/CLI Runtime: Run-scoped responsibility boundaries and runtime service injection consistency"
- `.github/plans/phase-1.md` — plugin contract boundary and `null` semantics that must remain unchanged

#### Design Decisions

- **Fatal control-flow ownership**: Replace helper-owned `process.exit(...)` calls and fatal stderr writes in CLI argument parsing, plugin config loading, plugin resolution, plugin initialization, and equivalent runtime-edge helpers with typed termination propagation. `src/index.ts` remains the single owner of final outcome classification and exit-code selection, but once runtime services are initialized it must hand fatal rendering to the run-scoped CLI presenter rather than writing directly to `stderr`.
- **Typed termination model**: Use CLI-layer typed outcomes for all handled termination paths. User-correctable failures map to exit code `1`; unexpected runtime failures map to exit code `2`; intentional non-error termination such as `--help` maps to exit code `0`. Helper modules may classify the outcome, but they must not decide the final process exit or write the final fatal line themselves.
- **Process termination semantics**: On normal handled paths, `main` returns `CliTermination` (or equivalent) and the CLI entry boundary sets `process.exitCode` only after bootstrap-renderer or presenter cleanup is complete. Do not call `process.exit(...)` on expected help, validation, plugin-init, or runtime-failure paths once CLI rendering infrastructure exists, because immediate exit can bypass heartbeat disposal and terminal restoration. Immediate hard exit is reserved only for catastrophic bootstrap failures before even bootstrap rendering support is constructed, or similarly unrecoverable states where terminal cleanup cannot be guaranteed.
- **Error taxonomy boundary**: Keep the taxonomy narrow and runtime-edge oriented. A dedicated user-error type covers argument/config/package/initialization failures that should render a stable user-facing message. A dedicated runtime-error type covers unexpected failures. Aggregated plugin-init fatal messages use a dedicated typed user-error container so the presenter can render each message deterministically without reintroducing helper-owned output.
- **Bootstrap vs run boundary**: Keep bootstrap-stage control flow and run-stage control flow separate in implementation. `parseArgs` and equivalent pre-run setup paths may return typed termination before the run-scoped presenter exists. That execution boundary must not leak into the user-visible presentation contract.
- **Diagnostic-path unification**: All non-fatal runtime diagnostics must route through a single run-scoped diagnostic capability and the same CLI presenter once runtime services are initialized. This includes incremental missing-state fallback warnings, plugin compatibility warnings, package-metadata compatibility-check-skipped warnings, plugin-authored non-fatal `error(...)` diagnostics, plugin `skip` warnings, and plugin `fatal`-with-`skip-fact` warnings. There are no explicit direct-stderr exceptions for non-fatal diagnostics after presenter construction; if a path currently writes directly to stderr, Phase 2 must route a diagnostic capability into that path instead.
- **Diagnostic severity model**: Replace warning-only reporting with a severity-aware diagnostic contract that supports `warn(message: string)` and `error(message: string)`. `error(...)` is a message-level choice only: it does not itself terminate the run, alter exit-code mapping, or override plugin failure policy. A plugin may emit `error(...)` and still continue successfully, return `skip`, or return `fatal` later.
- **Diagnostic visibility policy**: Diagnostic rendering remains CLI-owned and behaviorally unchanged except for the added severity level. `--quiet` continues to suppress progress, summary, and profile blocks only; both warnings and error-level diagnostics remain visible in quiet and non-quiet modes. Diagnostic payloads remain semantic text only and must not embed presentation prefixes such as `[WARN]`, `[ERROR]`, or `Warning:` / `Error:`.
- **Unified presentation policy**: Bootstrap-stage diagnostics and run-stage diagnostics must share the same presentation policy: identical severity badges, TTY color/styling rules, multi-line splitting rules, prefixing, and message layout. Whether a diagnostic originated before or after `parseArgs` must not change its user-visible design.
- **Terminal rendering authority**: Introduce a run-scoped CLI presenter as the single owner of stderr rendering after runtime services are initialized. The presenter owns warning/error diagnostics, fatal messages, summary output, and profile output, and delegates live phase/progress display to `ProgressController` or an equivalent progress-surface helper.
- **Bootstrap rendering authority**: Introduce a bootstrap renderer for pre-presenter termination paths such as help, argument validation failures, and other pre-run typed terminations. The bootstrap renderer may be simpler than the run-scoped presenter because no active progress surface exists yet, but it must consume the same shared diagnostic formatting policy rather than inventing a separate UI.
- **Progress-surface lifecycle**: `ProgressController` must expose an explicit lifecycle transition for aborting or stabilizing an active TTY progress display before non-progress terminal output is rendered. Fatal rendering, final summary output, profile output, and any other non-progress stderr write during an active phase must transition through this hook so heartbeat timers are disposed and the terminal is left in a stable line state before the next write.
- **Reporter capability split**: Replace the broad cross-layer `ProgressReporter.emit(event)` dependency with three minimum runtime capabilities: `DiagnosticReporter`, `ExtractionPhaseReporter`, and `ExtractingProgressReporter`. Components receive only the capability they need. `EnrichingFactProjector` receives warning-only capability for host-owned `skip` / `fatal`-with-`skip-fact` messages, plugin runtime context receives full diagnostic capability (`warn` / `error`), CLI compatibility checks may use warning-only capability, `ExtractionCoordinator` receives phase-level and extracting-progress capability for phase transitions and write-loop progress, and `CommitTraversalExtractor` receives extracting-progress capability only. The CLI presenter may implement or adapt these capabilities, but core contracts should not depend on terminal-rendering concerns.
- **Event-union scope**: The current event-union model may remain only as an internal implementation detail of the CLI progress/presenter subsystem. It should no longer be the cross-layer reporting contract exported from core types. Phase 2 therefore narrows external dependencies to capability interfaces while allowing the CLI progress implementation to keep an internal event/state model, including warning/error diagnostic distinctions, if that reduces renderer churn.
- **Plugin runtime context model**: `ProjectorPlugin.init(runtime: PluginRuntimeContext)` becomes required and is called exactly once per plugin per run, after compatibility checks and before extraction begins. Plugin factory arguments remain config-only. `ProjectorPlugin.project(context)` remains fact-scoped and no longer receives profiler or other run-scoped services as method arguments.
- **Plugin runtime services**: `PluginRuntimeContext` exposes `warn(message: string)`, `error(message: string)`, and `profiler?: StageProfiler`. The diagnostic methods are plugin-scoped and renderer-agnostic: plugin authors supply only the semantic message body, and the host owns namespace labeling, severity formatting, multi-line rendering, quiet-policy handling, and any fact-id augmentation needed elsewhere. `profiler` remains optional and is present only when profiling is enabled.
- **Plugin result message role**: `PluginInitResult.message` and `PluginProjectionResult.message` remain concise summary strings used for control-flow results (`fatal` / `skip`). Richer diagnostic detail should be emitted through `runtime.warn(...)` and `runtime.error(...)` rather than widening those union payloads.
- **String payload model**: Keep diagnostic payloads as `message: string`, aligned with the JavaScript Console API model. Multi-line plugin diagnostics are represented as strings containing embedded newlines; the presenter is responsible for rendering them in a progress-safe way and applying severity formatting consistently across the resulting terminal lines.
- **Plugin failure-policy invariants**: Phase 2 does not change `skip-fact` vs `fatal` behavior. `skip` and `fatal` under `skip-fact` still produce `extensions.<namespace> = null` and a warning. `fatal` under `failurePolicy: "fatal"` still terminates the run. Phase 1 `null` semantics remain authoritative and must not be reopened.
- **Profiler injection consistency**: Run-created internal components use constructor/options injection of already scoped profilers. `IsomorphicGitAdapter` moves from mutable `setProfiler(...)` setup to constructor/options-based profiler injection. `PluginRuntimeContext` is the only plugin-facing profiler delivery path. Post-construction mutable profiler assignment on runtime objects or `PluginEntry` records is out of bounds for this phase.
- **GitAdapter interface rule**: `GitAdapter` remains a behavioral interface only. No profiling setup method, runtime service mutator, or other non-behavioral configuration method is added to the interface. Profiling configuration belongs to concrete implementation construction, not adapter behavior.
- **Official plugin compatibility floor**: Because the user approved a breaking plugin API change for this pre-1.0 minor release, official `@gitlode/*` plugins should move to the Phase 2 contract directly and update `peerDependencies.gitlode` to the `0.8.x` compatibility floor they actually implement. Phase 2 does not carry a backward-compatibility shim for the old optional-`init()` / `project(..., profiler?)` contract.
- **Owning layers**: CLI owns typed termination classification, terminal rendering, presenter/progress lifecycle, plugin config loading, compatibility checks, plugin initialization, and runtime-context construction. Core owns capability-shaped consumption at stage boundaries plus plugin projection semantics. Git owns internal profiler scoping details behind concrete adapter construction. Official plugin packages own adoption of the new public plugin contract and updated peer ranges.
- **Phase boundary with Phase 3**: Phase 2 may make only the minimum `src/index.ts` changes required to install the new authority and capability boundaries. Phase 3 owns broader orchestration decomposition, helper-module extraction motivated by readability/testability alone, and larger unit-test expansion around `main`. Phase 2 should add focused tests only where needed to lock the new boundary behavior.
- **Invariants that must remain unchanged**: extraction semantics, traversal behavior, output record shape, checkpoint safety, plugin failure-policy behavior, warning visibility under `--quiet`, successful-run stderr contract, and the existing CLI option surface all remain unchanged by intent in this phase.

Normative interface sketches for the new responsibility boundary:

```ts
interface DiagnosticReporter {
  warn(message: string): void;
  error(message: string): void;
}

interface DiagnosticFormatter {
  formatDiagnostic(severity: "warn" | "error", message: string): readonly string[];
}

interface ExtractionPhaseReporter {
  startPhase(phase: "preparing" | "extracting" | "finalizing"): void;
  endPhase(phase: "preparing" | "extracting" | "finalizing"): void;
}

interface ExtractingProgressReporter {
  reportExtractingProgress(data: {
    refIndex: number;
    refCount: number;
    commitsTraversed: number;
    recordsWritten: number;
    bytesWritten: number;
  }): void;
}

interface ProgressSurface extends ExtractionPhaseReporter, ExtractingProgressReporter {
  abortActiveDisplay(): void;
}
```

```ts
interface CliRunPresenter
  extends DiagnosticReporter, ExtractionPhaseReporter, ExtractingProgressReporter {
  renderUserError(message: string): void;
  renderRuntimeError(error: Error): void;
  renderSummary(data: SummaryData): void;
  renderProfile(data: ProfileData): void;
  finish(): void;
}
```

```ts
interface BootstrapRenderer {
  renderUserError(message: string): void;
  renderRuntimeError(error: Error): void;
  renderTermination(result: Exclude<CliTermination, { kind: "success" }>): void;
}
```

```ts
type CliTermination =
  | { kind: "success"; exitCode: 0 }
  | { kind: "user-error"; message: string; exitCode: 1 }
  | { kind: "runtime-error"; error: Error; exitCode: 2 };

class PluginInitUserError extends Error {
  constructor(readonly messages: readonly string[]) {
    super("Plugin initialization failed");
  }
}
```

```ts
interface PluginRuntimeContext {
  warn(message: string): void;
  error(message: string): void;
  profiler?: StageProfiler;
}

interface ProjectorPlugin {
  init(runtime: PluginRuntimeContext): Promise<PluginInitResult>;
  project(context: ProjectionContext): Promise<PluginProjectionResult>;
}
```

```ts
interface IsomorphicGitAdapterOptions {
  profiling?: {
    resolveRef?: StageProfiler;
    getRepositoryObjectFormat?: StageProfiler;
    getRemoteUrl?: StageProfiler;
    walkCommits?: StageProfiler;
    mergeBase?: StageProfiler;
    fileChanges?: StageProfiler;
  };
}
```

These sketches are normative at the responsibility-boundary level: the implementation may rename local symbols or use adapters internally, but it must preserve the capability split, one-time plugin runtime injection, typed termination propagation, shared diagnostic presentation across bootstrap and run stages, presenter-owned stderr rendering after runtime initialization, progress-surface stabilization before non-progress output, warning/error diagnostic severity, string-based diagnostic payloads, and constructor/options-based profiler injection described above.

#### Non-Goals

- Reorganizing `src/index.ts` for readability beyond the minimal wiring changes required to install typed termination and narrowed runtime capabilities
- Broad `main` orchestration helper extraction or large new unit-test suites for orchestration paths; that belongs to Phase 3
- Changing warning wording, summary/profile layout, spinner behavior, or other user-visible stderr presentation details beyond preserving the existing contract through a unified reporting path
- Expanding plugin features beyond the runtime-service boundary itself, including new projection result kinds or changes to Phase 1 scalar/null payload rules
- Introducing a `GitAdapter` factory abstraction or other extra indirection not required to remove mutable profiler setup in this release

#### Target Files

| File                                                          | Action | Notes                                                                                                                                                                                                    |
| ------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/gitlode/src/index.ts`                               | Modify | Make `main` the single owner of final fatal rendering and exit-code selection; create warning/progress capabilities, runtime contexts, and constructor-scoped profilers.                                 |
| `packages/gitlode/src/cli/bootstrap-renderer.ts`              | Create | Define the pre-presenter renderer for help and pre-run typed terminations, using the same shared diagnostic presentation policy as the run-scoped presenter.                                             |
| `packages/gitlode/src/cli/diagnostics.ts`                     | Create | Define shared diagnostic formatting/rendering primitives used by both bootstrap rendering and the run-scoped presenter.                                                                                  |
| `packages/gitlode/src/cli/presenter.ts`                       | Create | Define the run-scoped CLI presenter that owns warning/error diagnostics, fatal rendering, summary/profile output, multi-line diagnostic rendering, and progress-surface cleanup-aware terminal writes.   |
| `packages/gitlode/src/cli/args.ts`                            | Modify | Replace direct exits with typed termination/user-error propagation while preserving current messages, help behavior, and validation rules.                                                               |
| `packages/gitlode/src/cli/plugins.ts`                         | Modify | Replace config/init exit paths with typed user errors; route compatibility warnings through warning capability; initialize plugins with `PluginRuntimeContext`.                                          |
| `packages/gitlode/src/cli/index.ts`                           | Modify | Re-export any new CLI error/result types and shared rendering helpers needed by `src/index.ts` without widening unrelated surface area.                                                                  |
| `packages/gitlode/src/cli/errors.ts`                          | Create | Define narrow CLI-layer typed termination/error shapes used by argument parsing, plugin loading, and `main`.                                                                                             |
| `packages/gitlode/src/cli/progress/controller.ts`             | Modify | Add explicit progress-surface abort/stabilization lifecycle so active TTY progress can transition safely to fatal, warning, summary, or profile output.                                                  |
| `packages/gitlode/src/cli/progress/types.ts`                  | Modify | Keep progress-controller event modeling internal and add any internal adapter types needed to bridge capability interfaces to the renderer.                                                              |
| `packages/gitlode/src/cli/progress/index.ts`                  | Modify | Re-export any capability-adapter helpers used by `src/index.ts`; avoid exposing the raw event union back to core.                                                                                        |
| `packages/gitlode/src/core/types.ts`                          | Modify | Introduce diagnostic capability interfaces and `PluginRuntimeContext`; update `ProjectorPlugin`, `PluginEntry`, `PluginInitResult`, and related core contracts.                                          |
| `packages/gitlode/src/core/extraction-coordinator.ts`         | Modify | Consume phase/progress capabilities instead of the broad event-emitter contract.                                                                                                                         |
| `packages/gitlode/src/core/commit-traversal-extractor.ts`     | Modify | Consume extracting-progress capability only.                                                                                                                                                             |
| `packages/gitlode/src/core/traversal-planner.ts`              | Modify | Adjust any planner reporting dependency to the narrowed capability surface, if still required after contract changes.                                                                                    |
| `packages/gitlode/src/core/enriching-fact-projector.ts`       | Modify | Use warning-only capability and runtime-initialized plugin entries; preserve Phase 1 null/failure semantics and remove per-call profiler passing.                                                        |
| `packages/gitlode/src/plugin-api.ts`                          | Modify | Re-export the updated public plugin contract, including `PluginRuntimeContext`.                                                                                                                          |
| `packages/gitlode/src/git/isomorphic-git-adapter.ts`          | Modify | Replace mutable profiler setup with constructor/options-based injection while keeping `GitAdapter` behavior unchanged.                                                                                   |
| `packages/gitlode/test/index.test.ts`                         | Modify | Add focused coverage for main-owned exit-code selection and fatal rendering after typed termination propagation.                                                                                         |
| `packages/gitlode/test/cli/args.test.ts`                      | Modify | Lock unchanged user-visible parse/help/unknown-option behavior under the new typed termination path.                                                                                                     |
| `packages/gitlode/test/cli/bootstrap-renderer.test.ts`        | Create | Cover help and pre-run user/runtime termination rendering, and assert that bootstrap formatting matches the shared diagnostic presentation policy.                                                       |
| `packages/gitlode/test/cli/diagnostics.test.ts`               | Create | Cover shared badge, color, and multi-line formatting rules used by both bootstrap rendering and the run-scoped presenter.                                                                                |
| `packages/gitlode/test/cli/plugins.test.ts`                   | Modify | Cover compatibility-warning routing, plugin-init fatal aggregation, runtime-context initialization rules, and plugin-emitted non-fatal error diagnostics.                                                |
| `packages/gitlode/test/cli/presenter.test.ts`                 | Create | Cover presenter-owned stderr rendering, warning/error severity formatting, multi-line diagnostic rendering, fatal rendering during active progress, and summary/profile ordering after progress cleanup. |
| `packages/gitlode/test/cli/progress/controller.test.ts`       | Create | Cover `abortActiveDisplay()` or equivalent lifecycle behavior, including heartbeat disposal and stable-line transition in TTY mode.                                                                      |
| `packages/gitlode/test/core/enriching-fact-projector.test.ts` | Modify | Cover warning-only capability usage, required init contract assumptions, and unchanged `skip-fact` / `fatal` semantics.                                                                                  |
| `packages/gitlode/test/git/isomorphic-git-adapter.test.ts`    | Modify | Cover constructor/options-based profiling injection replacement for `setProfiler(...)`.                                                                                                                  |
| `packages/plugin-conventional-commits/src/index.ts`           | Modify | Adopt required `init(runtime)` contract and remove dependence on the old `project(..., profiler?)` signature.                                                                                            |
| `packages/plugin-conventional-commits/test/index.test.ts`     | Modify | Update contract tests for the new runtime-context lifecycle.                                                                                                                                             |
| `packages/plugin-conventional-commits/package.json`           | Modify | Update peer range to the Phase 2 compatibility floor actually implemented.                                                                                                                               |
| `packages/plugin-custom-field/src/index.ts`                   | Modify | Adopt required `init(runtime)` contract and remove dependence on the old `project(..., profiler?)` signature.                                                                                            |
| `packages/plugin-custom-field/test/index.test.ts`             | Modify | Update contract tests for the new runtime-context lifecycle.                                                                                                                                             |
| `packages/plugin-custom-field/package.json`                   | Modify | Update peer range to the Phase 2 compatibility floor actually implemented.                                                                                                                               |

#### Documentation Touchpoints

| File                                                 | Section                                                        | Action  |
| ---------------------------------------------------- | -------------------------------------------------------------- | ------- |
| `packages/gitlode/docs/design/architecture.md`       | "Layer Responsibilities"                                       | Update  |
| `packages/gitlode/docs/design/architecture.md`       | "Profiling Instrumentation"                                    | Update  |
| `packages/gitlode/docs/design/architecture.md`       | "Plugin Runtime"                                               | Replace |
| `packages/gitlode/docs/design/plugins.md`            | "Plugin Module Contract"                                       | Replace |
| `packages/gitlode/docs/design/plugins.md`            | "Lifecycle"                                                    | Replace |
| `packages/gitlode/docs/design/plugins.md`            | "Ownership and Boundaries"                                     | Update  |
| `packages/gitlode/docs/design/plugins.md`            | "Runtime Compatibility Check"                                  | Update  |
| `packages/gitlode/docs/design/plugins.md`            | "Example Plugin"                                               | Replace |
| `packages/gitlode/docs/usage.md`                     | "Control"                                                      | Update  |
| `packages/gitlode/docs/usage.md`                     | "Profiling output"                                             | Update  |
| `packages/gitlode/docs/usage.md`                     | "Plugin failure policies"                                      | Update  |
| `packages/gitlode/docs/usage.md`                     | "Writing a plugin"                                             | Replace |
| `packages/gitlode/docs/usage.md`                     | "Compatibility warnings"                                       | Update  |
| `.github/instructions/architecture.instructions.md`  | "Ownership and boundary rules"                                 | Update  |
| `.github/instructions/architecture.instructions.md`  | "Progress and profiling contracts"                             | Update  |
| `.github/instructions/architecture.instructions.md`  | "CLI Layer (`src/cli/`)"                                       | Update  |
| `.github/instructions/architecture.instructions.md`  | "Core Logic Layer (`src/core/`)"                               | Update  |
| `.github/instructions/architecture.instructions.md`  | "isomorphic-git Adapter (`src/git/isomorphic-git-adapter.ts`)" | Update  |
| `.github/instructions/cli.instructions.md`           | "Successful-Run Stderr Contract"                               | Update  |
| `.github/instructions/cli.instructions.md`           | "Validation Rules"                                             | Update  |
| `.github/instructions/cli.instructions.md`           | "Exit Codes"                                                   | Update  |
| `.github/instructions/cli.instructions.md`           | "Interaction with `--quiet`"                                   | Update  |
| `.github/instructions/plugin-policy.instructions.md` | "Peer Range Policy (`peerDependencies.gitlode`)"               | Update  |
| `.github/instructions/plugin-policy.instructions.md` | "Runtime Compatibility Check"                                  | Update  |
| `.github/instructions/plugin-policy.instructions.md` | "Module Contract"                                              | Update  |
| `packages/plugin-conventional-commits/README.md`     | "Compatibility"                                                | Update  |
| `packages/plugin-custom-field/README.md`             | "Compatibility"                                                | Update  |

#### Implementation Notes

- Prefer one small CLI-side adapter layer that turns narrowed capability calls into presenter/progress operations, rather than threading the progress controller or a raw event union back through core contracts.
- After bootstrap-renderer construction, treat ad hoc `process.stderr.write(...)` calls as a design violation. Bootstrap and run stages may use different execution-time adapters, but both must flow through shared diagnostic rendering helpers rather than handwritten output.
- Model fatal rendering as a transition from active progress to stable terminal state, not as a special case of direct stderr output from `main`.
- Keep plugin diagnostic payloads string-based, semantic, and plugin-authored prefix-free. Namespace labels, severity badges such as `[WARN]` / `[ERROR]`, multi-line splitting, quiet-mode behavior, and line-redraw handling stay host responsibilities.
- Build shared styling and diagnostic formatting from TTY detection before `parseArgs` so bootstrap rendering and run-stage rendering naturally share the same visual policy.
- Migrate official plugins and their peer ranges in the same phase as the core contract change so docs, examples, and compatibility warnings all reflect the same public API floor.
- If commander help handling still requires interception via `exitOverride()`, normalize that path into the same typed termination model rather than preserving a hidden `process.exit(0)` branch in `args.ts`.
- Prefer `process.exitCode` over `process.exit(...)` on all handled termination paths so presenter cleanup and pending terminal writes can complete before process termination.

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

- Run `gitlode --help` and an invalid option such as `gitlode --bad-option`; confirm exit codes remain `0` and `1` respectively, handled termination uses the typed termination path, and no normal help/validation path depends on immediate `process.exit(...)`.
- Compare parse-stage diagnostics (for example `--help`, unknown option, missing required `--ref`) with run-stage warning/error diagnostics in both TTY and non-TTY modes; confirm badges, color policy, and multi-line formatting are visually consistent across the bootstrap/run boundary.
- Run incremental extraction with `--missing-state snapshot --quiet`; confirm the fallback warning is still visible while progress, summary, and profile output remain suppressed.
- Run extraction with a config that triggers plugin compatibility warnings (missing peer range, incompatible range, and unreadable package metadata); confirm each warning remains warning-only, is visible under `--quiet`, and no direct helper-owned stderr path remains.
- Run extraction with a plugin that emits `runtime.error("line 1\nline 2")` but still returns success; confirm the run still exits successfully, both lines are rendered as error-level diagnostics through the presenter, and active progress output remains visually stable.
- Run extraction with a plugin that returns `skip`, and with a plugin that returns `fatal` under both `skip-fact` and `fatal` policies; confirm `skip-fact` still writes `null` plus a warning and `fatal` still aborts the run with the existing failure semantics.
- Run a TTY extraction that fails while an active progress line is visible (for example a plugin init failure or fatal plugin result during extraction); confirm the active line is stabilized/aborted before the fatal message, heartbeat activity stops, and the terminal output is not visually corrupted.
- Run a profiled extraction with plugins enabled; confirm profile output still appears only on successful non-quiet runs and that plugin timing is sourced from the run-scoped runtime context rather than per-call mutable setup.
