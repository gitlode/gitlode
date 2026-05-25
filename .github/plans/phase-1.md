### Phase 1: Plugin Runtime and Enrichment Pipeline Integration

_Introduce a projector-decorator plugin execution boundary in the extraction pipeline. This phase defines plugin contract types in core, adds a `--config <path>` JSON config file for declaring plugins, implements per-fact sequential plugin orchestration via `EnrichingFactProjector` decorating `DefaultFactProjector`, and adds an optional `extensions` field to output records keyed by plugin namespace._

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `.github/roadmap.md` — "Pipeline: Pluggable enrichment stage for organization-specific metadata"
- `.github/plugin-monorepo-strategy.md` — plugin and package strategy constraints
- `.github/instructions/architecture.instructions.md` — layer ownership and boundary rules
- `.github/instructions/cli.instructions.md` — CLI option and behavior contract rules
- `.github/instructions/schema.instructions.md` — output JSON schema and rotation specification

#### Design Decisions

##### Plugin contract (core/types.ts)

- **`ProjectorPlugin` interface** — `init?(): Promise<PluginInitResult>` and `project(context: ProjectionContext, profiler?: StageProfiler): Promise<PluginProjectionResult>`.
- **`PluginInitResult`** — `{ type: "ready" } | { type: "fatal"; message: string }`.
- **`PluginProjectionResult`** — `{ type: "success"; data: Record<string, unknown> } | { type: "skip"; reason: string } | { type: "fatal"; message: string }`.
- **`ProjectionContext`** — `{ fact: Fact; baseRecord: Readonly<OutputRecord> }`. The original `Fact` (not the projected record) is the source of truth for plugins; `baseRecord` is provided for convenience and must not be mutated. Plugins cannot see other plugins' outputs.
- **`PluginFactory`** — module default export of signature `(config: unknown) => ProjectorPlugin | Promise<ProjectorPlugin>`. ESM only.
- **`PluginEntry`** — runtime registry record `{ namespace: string; plugin: ProjectorPlugin; failurePolicy: PluginFailurePolicy; profiler?: StageProfiler }`.
- **`PluginFailurePolicy`** — string literal type `"skip-fact" | "fatal"`. Default `"skip-fact"`.

##### CLI / config file (cli/plugins.ts, cli/args.ts)

- **CLI option**: `--config <path>` (alias `-c`). New help group "Configuration File". Path resolved relative to CWD.
- **Config file format**: JSON only. No YAML/TOML, no environment-variable interpolation, no `extends`.
- **Schema** (Phase 1 surface):
  ```json
  {
    "version": 1,
    "extensions": {
      "<namespace>": {
        "entrypoint": "<local path or bare specifier>",
        "config": { /* arbitrary */ },
        "failurePolicy": "skip-fact" | "fatal"
      }
    }
  }
  ```
  The config section name (`extensions`) intentionally matches the output record field name. Each key under `extensions` defines a namespace that appears in the output's `extensions.<namespace>`; the value declares which plugin populates that namespace and how. The same plugin module may be registered under multiple namespaces with different `config` values.
- **`version` field**: required, must equal `1`. Any other value → hard error.
- **Unknown top-level sections**: hard error (forward-compatible structure but Phase 1 implements only `extensions`).
- **`extensions` section**: must contain at least one entry when `--config` is supplied. Therefore `extensions: {}` cannot appear in output (documented invariant).
- **Namespace pattern**: `[a-z0-9-]+`. Validated at config parse time. Uniqueness within the object is enforced by JSON object semantics; declaration order is preserved (JSON object insertion order).
- **Entrypoint resolution** (performed from the config file's directory):
  - Strings starting with `.` or `/` → local path relative to the config file directory.
  - Other strings → bare specifier, resolved with Node.js ESM resolution from the config file location.
- **Validation phase**: fs read + schema validation runs as part of CLI argument validation (CLI phase 2), before any extraction work begins. Errors exit with code 1 and a single-line message; `--quiet` does not suppress.
- **Default `failurePolicy`**: `"skip-fact"` when omitted.
- **Positional auto-detection**: not supported. `--config` is the only entry point.

##### Plugin lifecycle (cli/plugins.ts, index.ts)

- **Loader pipeline** (single file `cli/plugins.ts`):
  - `loadPluginConfig(configPath): Promise<PluginConfigFile>` — fs read + schema validation.
  - `resolvePluginEntries(config, configPath): Promise<PluginEntry[]>` — entrypoint resolution, dynamic `await import()`, `PluginFactory` invocation, `ProjectorPlugin` instantiation.
  - `initializePlugins(entries): Promise<void>` — invokes `init()` on each entry in parallel via `Promise.all`. All `fatal` results are collected and emitted as single-line errors; any fatal aborts with exit code 1.
- **Phase placement**: a new progress phase `initializing-plugins` runs between existing `preparing` and the start of extraction. Existing phases are untouched in name, order, and semantics.
- **`init()` failure handling**: always halts (exit 1) regardless of per-plugin `failurePolicy`. Per-plugin policy applies only to `project()`.
- **No timeout**: neither `init()` nor `project()` has a runtime timeout. (See Non-Goals.)

##### Orchestration (core/enriching-fact-projector.ts, core/fact-projector.ts)

- **Pattern**: decorator. `EnrichingFactProjector implements FactProjector` wraps an inner `FactProjector` (always `DefaultFactProjector` in Phase 1) plus `readonly PluginEntry[]` and a `ProgressReporter`.
- **Refactor**: extract module-level pure functions `projectCommit(fact: CommitFact, repoName: string, repoUrl: string | null): OutputRecord` and `projectFileChange(fact: FileChangeFact, repoName: string, repoUrl: string | null): OutputRecord` from `DefaultFactProjector`'s existing private methods. `DefaultFactProjector` becomes a thin wrapper that resolves repo-override values and dispatches by `fact.type`.
- **Per-fact flow inside `EnrichingFactProjector.project(facts)`**:
  1. Build `baseRecord` by calling the corresponding pure projection function (without going through `inner.project()` — the inner projector is held only for type compatibility and possible non-default future inner projectors; in Phase 1 the pure-function call path is taken directly to keep the decorator self-contained).
  2. For each `PluginEntry` in declaration order, build `ProjectionContext = { fact, baseRecord }` and call `plugin.project(context, entry.profiler)`.
  3. Plugin throws are caught and converted to `{ type: "fatal", message: <Error.message> }` before failure policy is applied.
  4. Apply failure policy per outcome:
     - `success` → `extensions[ns] = data`.
     - `skip` → `extensions[ns] = null`, emit warning, continue.
     - `fatal` + policy `"skip-fact"` → `extensions[ns] = null`, emit warning, continue.
     - `fatal` + policy `"fatal"` → throw; coordinator's existing finally semantics close the sink without writing state.
  5. Yield `{ ...baseRecord, extensions }`.
- **Warning format**: `Plugin "<ns>" skipped fact <oid>[/<path>]: <reason>`. One warning per failure; no aggregation.
- **`JSON.stringify(data)` failure**: treated as plugin fatal (the orchestrator does not pre-validate `data`, but a non-serializable value surfaces at sink write; this is recorded as Implementation Note guidance — the loader cannot detect it ahead of time).
- **Plugin execution order**: config declaration order, deterministic.
- **Empty-plugins bypass**: when `pluginEntries.length === 0`, the edge layer passes `DefaultFactProjector` directly to the coordinator. `EnrichingFactProjector` is not constructed. Zero overhead, zero risk of regression when `--config` is not provided.
- **Coordinator**: `ExtractionCoordinator` is untouched. Plugin presence is invisible to it; both `DefaultFactProjector` and `EnrichingFactProjector` satisfy the same `FactProjector` interface.

##### Output (output/types.ts)

- **New optional field**: `extensions?: OutputRecordExtensions` added to `OutputCommit` (inherited by `OutputFileRecord`).
- **Type alias**: `export type OutputRecordExtensions = { [namespace: string]: Record<string, unknown> | null };` declared in `output/types.ts`. Kept under the `Output*` naming family for consistency with `OutputCommit` / `OutputFileRecord`.
- **Presence rule**: `extensions` is present iff at least one plugin is configured. Absent when no `--config` is supplied → full backward compatibility for existing consumers.
- **Per-plugin key**: always emitted when plugins are configured. Value is either the `data` object (success) or `null` (skip / skip-fact-on-fatal).
- **Key order**: config declaration order, via insertion order. Plugin-internal key order inside `data` is the plugin's responsibility.
- **`extensions: {}` invariant**: cannot occur because the loader rejects an empty `extensions` section in the config file. Documented in `schema.md`.
- **Output writer / sink / state schema**: unchanged. Serializer treats `extensions` as a normal optional field.

##### Layer ownership

| Concern                                                                  | Layer  | File                                          |
| ------------------------------------------------------------------------ | ------ | --------------------------------------------- |
| Plugin contract types                                                    | Core   | `src/core/types.ts`                           |
| `EnrichingFactProjector`                                                 | Core   | `src/core/enriching-fact-projector.ts` (new)  |
| Pure `projectCommit` / `projectFileChange`                               | Core   | `src/core/fact-projector.ts`                  |
| `OutputRecordExtensions` type                                            | Output | `src/output/types.ts`                         |
| Config parse, entrypoint resolution, factory invocation, `init()` driver | CLI    | `src/cli/plugins.ts` (new, single file)       |
| `--config` option definition                                             | CLI    | `src/cli/args.ts`                             |
| Edge wiring (build `PluginEntry[]`, choose projector, integrate phase)   | Edge   | `src/index.ts`                                |
| `GitAdapter`                                                             | —      | unchanged                                     |
| `ExtractionCoordinator`                                                  | —      | unchanged                                     |
| `OutputWriter` / `OutputSink`                                            | —      | unchanged (passive `extensions` pass-through) |
| `StateStore` / state file schema                                         | —      | unchanged                                     |

##### Boundary anti-patterns (rejected)

- Core invoking `await import()` of plugin entrypoints.
- `EnrichingFactProjector` reading config file paths or resolving entrypoint strings.
- Plugins referencing `GitAdapter` (plugins see only `ProjectionContext`).
- Plugins reading other plugins' outputs.
- CLI plugin loader touching `OutputSink` directly.

##### Profiling

- When `--profile` is set, each plugin receives a scoped profiler at `elapsed/projection/plugins/<namespace>`.
- Profiler hierarchy is otherwise unchanged.

##### Public API surface for Phase 2

Phase 1 fixes the following as the stable surface that `@gitlode/*` plugins (Phase 2) will depend on via `peerDependencies`:

- `ProjectorPlugin`, `PluginFactory`
- `PluginInitResult`, `ProjectionContext`, `PluginProjectionResult`
- `PluginFailurePolicy`
- `OutputRecordExtensions` and the `extensions` output field
- Config file schema (`version: 1`, `extensions.<ns>.{entrypoint,config?,failurePolicy?}`)

Phase 2 may add to this surface but must not change or remove existing entries.

#### Non-Goals

Plugin runtime mechanism:

- No plugin sandboxing or capability restriction (no worker thread, vm context, or child process isolation). Same-process, same-event-loop execution.
- No plugin execution timeout (neither `init()` nor `project()`).
- No parallel execution of plugins per fact (sequential in declaration order).
- No inter-plugin data passing (`ProjectionContext` exposes only `fact` and `baseRecord`).
- No schema validation of plugin-returned `data` (only `JSON.stringify` capability is required at sink time).
- No warning aggregation or rate limiting.

Config / CLI:

- No `extends` (hierarchical config composition).
- No CLI-flag override merging into config for plugin-related settings.
- No published JSON Schema for the config file.
- No positional auto-detection of config files.
- No YAML / TOML support.
- No environment-variable interpolation in config values.

Plugin distribution / ecosystem:

- No official `@gitlode/*` plugin implementations (Phase 2 scope).
- No `ScriptInjectProjector` or similar helper plugin.
- No plugin registry / discovery mechanism.
- No runtime `peerDependencies` version-compatibility enforcement (Phase 2 scope).
- No plugin marketplace or plugin-listing CLI.

Architecture invariants (intentionally unchanged in this phase):

- `GitAdapter` interface — no change (preserves independence from Phase 3 `DiffAdapter` work).
- `ExtractionCoordinator` code — no change.
- `OutputWriter` / `OutputSink` logic — no change.
- `StateStore` / state file schema — no change.
- Existing progress phases — no change in name, order, or semantics (the new `initializing-plugins` phase is added before `preparing` without altering existing phases).

Output schema:

- No change to existing top-level fields (`oid`, `parents`, `tree`, `message`, `author`, `committer`, `repository`, `files`, etc.).
- No new fields besides `extensions`.
- Plugins cannot write fields outside `extensions` (top-level collision prevention).
- No version bump of the existing output schema (`extensions` is an optional additive field).

Documentation:

- No full plugin-author developer guide (Phase 2, alongside `@gitlode/*` development).
- No plugin example repository.

#### Target Files

**New files:**

| File                                                          | Action | Notes                                                                                                                          |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `packages/gitlode/src/core/enriching-fact-projector.ts`       | Create | `EnrichingFactProjector` decorator implementing `FactProjector`                                                                |
| `packages/gitlode/src/cli/plugins.ts`                         | Create | `loadPluginConfig`, `resolvePluginEntries`, `initializePlugins`, related types                                                 |
| `packages/gitlode/test/core/enriching-fact-projector.test.ts` | Create | Per-fact plugin orchestration, declaration order, failure policy, throw-handling, empty-plugins bypass                         |
| `packages/gitlode/test/cli/plugins.test.ts`                   | Create | Config parse, schema validation errors, entrypoint resolution (local + bare), factory invocation, `init()` failure aggregation |
| `packages/gitlode/docs/design/plugins.md`                     | Create | Plugin contract, lifecycle, failure policy, `extensions` output format, config schema                                          |

**Modified files:**

| File                                                | Action | Notes                                                                                                                                                          |
| --------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/gitlode/src/core/types.ts`                | Modify | Add `ProjectorPlugin`, `PluginFactory`, `PluginInitResult`, `ProjectionContext`, `PluginProjectionResult`, `PluginEntry`, `PluginFailurePolicy`                |
| `packages/gitlode/src/core/fact-projector.ts`       | Modify | Extract pure `projectCommit` / `projectFileChange`; thin `DefaultFactProjector` wrapper                                                                        |
| `packages/gitlode/src/core/index.ts`                | Modify | Barrel exports for new plugin types and `EnrichingFactProjector`                                                                                               |
| `packages/gitlode/src/output/types.ts`              | Modify | Add optional `extensions?: OutputRecordExtensions` to `OutputCommit`; new type alias                                                                           |
| `packages/gitlode/src/cli/args.ts`                  | Modify | Add `--config` / `-c` option, "Configuration File" help group, validation entry                                                                                |
| `packages/gitlode/src/index.ts`                     | Modify | Call loader pipeline before `preparing`; choose `EnrichingFactProjector` vs `DefaultFactProjector` based on plugin count; emit `initializing-plugins` progress |
| `packages/gitlode/test/core/fact-projector.test.ts` | Modify | Add tests for pure functions; keep existing wrapper behavior covered                                                                                           |
| `packages/gitlode/test/cli/args.test.ts`            | Modify | `--config` parsing tests                                                                                                                                       |
| `packages/gitlode/test/cli/cmd-definition.test.ts`  | Modify | Help-group / option-definition surface tests                                                                                                                   |
| `packages/gitlode/test/output/*.test.ts`            | Modify | Adjust schema assertions to allow optional `extensions` field                                                                                                  |

#### Documentation Touchpoints

| File                                                | Section                                                           | Action                                                                                                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/gitlode/docs/design/plugins.md`           | (entire file, new)                                                | Create — plugin contract, lifecycle, failure policy, config schema, `extensions` output format                                                       |
| `packages/gitlode/docs/design/architecture.md`      | Pipeline / projector architecture                                 | Update — add Plugin runtime subsection; link to `plugins.md` for details                                                                             |
| `packages/gitlode/docs/design/schema.md`            | Output record field definitions                                   | Update — add "Plugin Extensions" section; document `extensions` shape, presence rule, empty-extensions invariant                                     |
| `packages/gitlode/docs/usage.md`                    | CLI options and examples                                          | Update — document `--config` and a minimal plugin config example                                                                                     |
| `packages/gitlode/README.md`                        | Features / Usage                                                  | Update — short mention of plugin support and link to `docs/design/plugins.md`                                                                        |
| `.github/instructions/cli.instructions.md`          | Options surface                                                   | Update — add `--config` to the option contract                                                                                                       |
| `.github/instructions/architecture.instructions.md` | Canonical vocabulary; boundary rules; CLI / Core responsibilities | Update — add `ProjectorPlugin`, `PluginEntry`, `EnrichingFactProjector` as stable terms; add plugin layer-ownership rules and boundary anti-patterns |
| `.github/instructions/schema.instructions.md`       | Output record fields                                              | Update — reflect optional `extensions` field at the spec level                                                                                       |

#### Implementation Notes

- **Order of work**: (1) types in `core/types.ts`; (2) pure-function refactor in `fact-projector.ts` and its tests; (3) `output/types.ts` extension; (4) `cli/plugins.ts` with unit tests; (5) `EnrichingFactProjector` with unit tests; (6) `--config` wiring in `cli/args.ts`; (7) edge wiring in `index.ts` including the `initializing-plugins` progress phase; (8) docs.
- **`main()` in `src/index.ts`**: already large. Phase 1 adds the plugin lifecycle as a small block guarded by `parsed.configPath`. Further extraction of `main()` into a CLI runtime-edge module is out of scope for this phase and tracked separately.
- **`JSON.stringify(data)` failure**: not preventable at load time. Behavior is governed by the plugin's `failurePolicy` (a stringify-time error surfaces at sink write; the orchestrator path treats it equivalently to a `project()` throw → `fatal`).
- **Coordinator parity**: do not modify `ExtractionCoordinator`. If a test fails because plugin behavior leaks into coordinator code paths, the fix belongs in `EnrichingFactProjector`, not the coordinator.
- **No regression for the no-plugins path**: the empty-plugins bypass must be verified by tests; the coordinator should receive `DefaultFactProjector` (not `EnrichingFactProjector` wrapping it) when no `--config` is given.

#### Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- Without `--config`: output is byte-identical to pre-Phase-1 baseline for the same inputs (no `extensions` field present anywhere).
- With `--config` listing one passing plugin: every record contains `extensions.<ns>` with the plugin's data; key order matches config declaration order.
- With `--config` listing two plugins where one returns `skip`: the skipped plugin's namespace key is present with value `null`; one warning per skip.
- `failurePolicy: "skip-fact"` on a plugin throwing inside `project()`: extraction completes; the affected fact's `extensions.<ns>` is `null`; warning emitted; state file is updated.
- `failurePolicy: "fatal"` on a plugin throwing inside `project()`: extraction halts; state file is NOT updated; process exits non-zero.
- `init()` returning `fatal` on any plugin: process exits 1 before any extraction work; all fatal messages are printed one per line.
- Invalid config (missing `version`, unknown top-level section, empty `extensions`, invalid namespace pattern, unresolvable entrypoint): exit 1 with a single-line error during CLI validation phase, before extraction starts. `--quiet` does not suppress these errors.
- `--profile` with plugins configured: profile output includes `elapsed/projection/plugins/<namespace>` entries.
- Public API surface review: confirm the exported types listed under "Public API surface for Phase 2" match the implemented `core/index.ts` barrel; this review is a Phase 1 Definition-of-Done item to prevent Phase 2 churn.
