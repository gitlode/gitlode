### Phase 2: Runtime/Plugin Responsibility Boundary Consolidation

_This phase consolidates run-scoped authority boundaries by replacing helper-owned exits and mixed reporting paths with typed termination propagation, capability-scoped reporting, and a one-time plugin runtime context injected during required plugin initialization. The goal is to make `src/index.ts` the single owner of final rendering and exit-code selection while preserving extraction semantics, warning visibility policy, and the existing CLI surface._

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

- **Fatal control-flow ownership**: Replace helper-owned `process.exit(...)` calls and fatal stderr writes in CLI argument parsing, plugin config loading, plugin resolution, plugin initialization, and equivalent runtime-edge helpers with typed termination propagation. `src/index.ts` remains the single owner of final fatal rendering and exit-code selection.
- **Typed termination model**: Use CLI-layer typed outcomes for all early termination paths. User-correctable failures map to exit code `1`; unexpected runtime failures map to exit code `2`; intentional non-error termination such as `--help` maps to exit code `0`. Helper modules may classify the outcome, but they must not decide the final process exit or write the final fatal line themselves.
- **Error taxonomy boundary**: Keep the taxonomy narrow and runtime-edge oriented. A dedicated user-error type covers argument/config/package/initialization failures that should render a single user-facing message. A dedicated runtime-error type covers unexpected failures. Aggregated plugin-init fatal messages use a dedicated typed user-error container so `main` can render each message deterministically without reintroducing helper-owned output.
- **Warning-path unification**: All non-fatal runtime warnings must route through a single `WarningReporter` capability once `main` has created runtime services. This includes incremental missing-state fallback warnings, plugin compatibility warnings, package-metadata compatibility-check-skipped warnings, plugin `skip` warnings, and plugin `fatal`-with-`skip-fact` warnings. There are no explicit direct-stderr exceptions for non-fatal warnings in this phase; if a path currently writes directly to stderr, Phase 2 must route a warning capability into that path instead.
- **Warning visibility policy**: Warning rendering remains CLI-owned and behaviorally unchanged. `--quiet` continues to suppress progress, summary, and profile blocks only; warnings remain visible in both quiet and non-quiet modes. Warning payloads remain semantic text only and must not embed presentation prefixes such as `[WARN]` or `Warning:`.
- **Reporter capability split**: Replace the broad cross-layer `ProgressReporter.emit(event)` dependency with three minimum capabilities: `WarningReporter`, `ExtractionPhaseReporter`, and `ExtractingProgressReporter`. Components receive only the capability they need. `EnrichingFactProjector` and CLI compatibility checks receive warning-only capability. `ExtractionCoordinator` receives phase-level and extracting-progress capability for phase transitions and write-loop progress. `CommitTraversalExtractor` receives extracting-progress capability only.
- **Event-union scope**: The current event-union model may remain only as an internal implementation detail of the CLI progress controller. It should no longer be the cross-layer reporting contract exported from core types. Phase 2 therefore narrows external dependencies to capability interfaces while allowing the CLI progress implementation to keep an internal event/state model if that reduces renderer churn.
- **Plugin runtime context model**: `ProjectorPlugin.init(runtime: PluginRuntimeContext)` becomes required and is called exactly once per plugin per run, after compatibility checks and before extraction begins. Plugin factory arguments remain config-only. `ProjectorPlugin.project(context)` remains fact-scoped and no longer receives profiler or other run-scoped services as method arguments.
- **Plugin runtime services**: `PluginRuntimeContext` exposes `warn(message: string)` and `profiler?: StageProfiler`. The warning function is plugin-scoped and renderer-agnostic: plugin authors supply only the semantic message body, and the host owns namespace labeling, severity formatting, quiet-policy handling, and any fact-id augmentation needed elsewhere. `profiler` remains optional and is present only when profiling is enabled.
- **Plugin failure-policy invariants**: Phase 2 does not change `skip-fact` vs `fatal` behavior. `skip` and `fatal` under `skip-fact` still produce `extensions.<namespace> = null` and a warning. `fatal` under `failurePolicy: "fatal"` still terminates the run. Phase 1 `null` semantics remain authoritative and must not be reopened.
- **Profiler injection consistency**: Run-created internal components use constructor/options injection of already scoped profilers. `IsomorphicGitAdapter` moves from mutable `setProfiler(...)` setup to constructor/options-based profiler injection. `PluginRuntimeContext` is the only plugin-facing profiler delivery path. Post-construction mutable profiler assignment on runtime objects or `PluginEntry` records is out of bounds for this phase.
- **GitAdapter interface rule**: `GitAdapter` remains a behavioral interface only. No profiling setup method, runtime service mutator, or other non-behavioral configuration method is added to the interface. Profiling configuration belongs to concrete implementation construction, not adapter behavior.
- **Official plugin compatibility floor**: Because the user approved a breaking plugin API change for this pre-1.0 minor release, official `@gitlode/*` plugins should move to the Phase 2 contract directly and update `peerDependencies.gitlode` to the `0.8.x` compatibility floor they actually implement. Phase 2 does not carry a backward-compatibility shim for the old optional-`init()` / `project(..., profiler?)` contract.
- **Owning layers**: CLI owns typed termination classification, warning rendering, plugin config loading, compatibility checks, plugin initialization, and runtime-context construction. Core owns capability-shaped consumption at stage boundaries plus plugin projection semantics. Git owns internal profiler scoping details behind concrete adapter construction. Official plugin packages own adoption of the new public plugin contract and updated peer ranges.
- **Phase boundary with Phase 3**: Phase 2 may make only the minimum `src/index.ts` changes required to install the new authority and capability boundaries. Phase 3 owns broader orchestration decomposition, helper-module extraction motivated by readability/testability alone, and larger unit-test expansion around `main`. Phase 2 should add focused tests only where needed to lock the new boundary behavior.
- **Invariants that must remain unchanged**: extraction semantics, traversal behavior, output record shape, checkpoint safety, plugin failure-policy behavior, warning visibility under `--quiet`, successful-run stderr contract, and the existing CLI option surface all remain unchanged by intent in this phase.

Normative interface sketches for the new responsibility boundary:

```ts
interface WarningReporter {
	warn(message: string): void;
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
```

```ts
type CliTermination =
	| { kind: "success-exit"; exitCode: 0 }
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

These sketches are normative at the responsibility-boundary level: the implementation may rename local symbols or use adapters internally, but it must preserve the capability split, one-time plugin runtime injection, typed termination propagation, and constructor/options-based profiler injection described above.

#### Non-Goals

- Reorganizing `src/index.ts` for readability beyond the minimal wiring changes required to install typed termination and narrowed runtime capabilities
- Broad `main` orchestration helper extraction or large new unit-test suites for orchestration paths; that belongs to Phase 3
- Changing warning wording, summary/profile layout, spinner behavior, or other user-visible stderr presentation details beyond preserving the existing contract through a unified reporting path
- Expanding plugin features beyond the runtime-service boundary itself, including new projection result kinds or changes to Phase 1 scalar/null payload rules
- Introducing a `GitAdapter` factory abstraction or other extra indirection not required to remove mutable profiler setup in this release

#### Target Files

| File                                                          | Action | Notes                                                                                                                                                                    |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/gitlode/src/index.ts`                               | Modify | Make `main` the single owner of final fatal rendering and exit-code selection; create warning/progress capabilities, runtime contexts, and constructor-scoped profilers. |
| `packages/gitlode/src/cli/args.ts`                            | Modify | Replace direct exits with typed termination/user-error propagation while preserving current messages, help behavior, and validation rules.                               |
| `packages/gitlode/src/cli/plugins.ts`                         | Modify | Replace config/init exit paths with typed user errors; route compatibility warnings through warning capability; initialize plugins with `PluginRuntimeContext`.          |
| `packages/gitlode/src/cli/index.ts`                           | Modify | Re-export any new CLI error/result types needed by `src/index.ts` without widening unrelated surface area.                                                               |
| `packages/gitlode/src/cli/errors.ts`                          | Create | Define narrow CLI-layer typed termination/error shapes used by argument parsing, plugin loading, and `main`.                                                             |
| `packages/gitlode/src/cli/progress/types.ts`                  | Modify | Keep progress-controller event modeling internal and add any internal adapter types needed to bridge capability interfaces to the renderer.                              |
| `packages/gitlode/src/cli/progress/index.ts`                  | Modify | Re-export any capability-adapter helpers used by `src/index.ts`; avoid exposing the raw event union back to core.                                                        |
| `packages/gitlode/src/core/types.ts`                          | Modify | Introduce capability interfaces and `PluginRuntimeContext`; update `ProjectorPlugin`, `PluginEntry`, and related core contracts.                                         |
| `packages/gitlode/src/core/extraction-coordinator.ts`         | Modify | Consume phase/progress capabilities instead of the broad event-emitter contract.                                                                                         |
| `packages/gitlode/src/core/commit-traversal-extractor.ts`     | Modify | Consume extracting-progress capability only.                                                                                                                             |
| `packages/gitlode/src/core/traversal-planner.ts`              | Modify | Adjust any planner reporting dependency to the narrowed capability surface, if still required after contract changes.                                                    |
| `packages/gitlode/src/core/enriching-fact-projector.ts`       | Modify | Use warning-only capability and runtime-initialized plugin entries; preserve Phase 1 null/failure semantics and remove per-call profiler passing.                        |
| `packages/gitlode/src/plugin-api.ts`                          | Modify | Re-export the updated public plugin contract, including `PluginRuntimeContext`.                                                                                          |
| `packages/gitlode/src/git/isomorphic-git-adapter.ts`          | Modify | Replace mutable profiler setup with constructor/options-based injection while keeping `GitAdapter` behavior unchanged.                                                   |
| `packages/gitlode/test/index.test.ts`                         | Modify | Add focused coverage for main-owned exit-code selection and fatal rendering after typed termination propagation.                                                         |
| `packages/gitlode/test/cli/args.test.ts`                      | Modify | Lock unchanged user-visible parse/help/unknown-option behavior under the new typed termination path.                                                                     |
| `packages/gitlode/test/cli/plugins.test.ts`                   | Modify | Cover compatibility-warning routing, plugin-init fatal aggregation, and runtime-context initialization rules.                                                            |
| `packages/gitlode/test/core/enriching-fact-projector.test.ts` | Modify | Cover warning-only capability usage, required init contract assumptions, and unchanged `skip-fact` / `fatal` semantics.                                                  |
| `packages/gitlode/test/git/isomorphic-git-adapter.test.ts`    | Modify | Cover constructor/options-based profiling injection replacement for `setProfiler(...)`.                                                                                  |
| `packages/plugin-conventional-commits/src/index.ts`           | Modify | Adopt required `init(runtime)` contract and remove dependence on the old `project(..., profiler?)` signature.                                                            |
| `packages/plugin-conventional-commits/test/index.test.ts`     | Modify | Update contract tests for the new runtime-context lifecycle.                                                                                                             |
| `packages/plugin-conventional-commits/package.json`           | Modify | Update peer range to the Phase 2 compatibility floor actually implemented.                                                                                               |
| `packages/plugin-custom-field/src/index.ts`                   | Modify | Adopt required `init(runtime)` contract and remove dependence on the old `project(..., profiler?)` signature.                                                            |
| `packages/plugin-custom-field/test/index.test.ts`             | Modify | Update contract tests for the new runtime-context lifecycle.                                                                                                             |
| `packages/plugin-custom-field/package.json`                   | Modify | Update peer range to the Phase 2 compatibility floor actually implemented.                                                                                               |

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

- Prefer one small CLI-side adapter layer that turns narrowed capability calls into progress-controller events, rather than threading the progress controller or a raw event union back through core contracts.
- Keep plugin warning payloads semantic and plugin-authored messages prefix-free. Namespace labels, `[WARN]`, quiet-mode behavior, and line-redraw handling stay host responsibilities.
- Migrate official plugins and their peer ranges in the same phase as the core contract change so docs, examples, and compatibility warnings all reflect the same public API floor.
- If commander help handling still requires interception via `exitOverride()`, normalize that path into the same typed termination model rather than preserving a hidden `process.exit(0)` branch in `args.ts`.

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

- Run `gitlode --help` and an invalid option such as `gitlode --bad-option`; confirm exit codes remain `0` and `1` respectively and that final stderr/stdout rendering is still owned by `main` with unchanged user-visible text.
- Run incremental extraction with `--missing-state snapshot --quiet`; confirm the fallback warning is still visible while progress, summary, and profile output remain suppressed.
- Run extraction with a config that triggers plugin compatibility warnings (missing peer range, incompatible range, and unreadable package metadata); confirm each warning remains warning-only, is visible under `--quiet`, and no direct helper-owned stderr path remains.
- Run extraction with a plugin that returns `skip`, and with a plugin that returns `fatal` under both `skip-fact` and `fatal` policies; confirm `skip-fact` still writes `null` plus a warning and `fatal` still aborts the run with the existing failure semantics.
- Run a profiled extraction with plugins enabled; confirm profile output still appears only on successful non-quiet runs and that plugin timing is sourced from the run-scoped runtime context rather than per-call mutable setup.
