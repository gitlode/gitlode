### Phase 4: Configuration File Expansion Beyond Plugin Loading

_This phase expands the existing explicit `--config` JSON file from a plugin-only document into a general configuration surface for extraction defaults, output defaults, repository metadata overrides, and profiling defaults. The design preserves the existing `extensions` section contract, keeps precedence deterministic by setting class, and keeps config loading, validation, and conflict handling in the CLI layer._

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `.github/instructions/architecture.instructions.md` — ownership and boundary rules, runtime-edge responsibilities, and layer invariants
- `.github/instructions/cli.instructions.md` — CLI option contracts, validation ordering, mutual exclusion rules, and exit-code expectations
- `.github/instructions/development-workflow.instructions.md` — planning-branch scope and documentation-touchpoint obligations
- `.github/roadmap.md` — "Configuration File: General-purpose configuration file beyond plugin loading"
- `.github/plans/phase-1.md` — `extensions` contract boundary and `null` semantics that must remain unchanged
- `.github/plans/phase-2.md` — CLI ownership of config/plugin loading, warning routing, and termination behavior
- `.github/plans/phase-3.md` — CLI runtime helper layering that Phase 4 should extend rather than bypass

#### Design Decisions

- **Configuration file format and versioning**: Keep the existing explicit `--config <path>` JSON file model. The root object remains versioned by `version: 1`; Phase 4 is additive and does not introduce `version: 2`. Existing files that contain only `version` plus `extensions` remain valid without modification. Incompatible future config redesigns must use a new version number rather than changing `version: 1` semantics in place.
- **Top-level sections included in v0.8.0**: The supported root sections for `version: 1` after Phase 4 are `extraction`, `output`, `repository`, `runtime`, and `extensions`.
- **Top-level sections deferred from v0.8.0**: `extends`, environment-variable interpolation, styling/color policy, quiet-mode defaults, incremental/state defaults, per-file and diff defaults, config auto-discovery, alternate file formats (YAML/TOML), and any new plugin-contract fields are explicitly out of scope.
- **Root-object structural rules**: The root object is strict. Unknown top-level keys are user errors. Each included section is also strict. `extensions` is no longer required at the file level, but when present its internal schema remains unchanged and it must still contain at least one namespace entry.
- **Exact section naming and shapes**: Use the following configuration shape for `version: 1`:

```json
{
  "version": 1,
  "extraction": {
    "refs": ["main", "develop"],
    "range": { "sinceRef": "origin/main" }
  },
  "output": {
    "directory": "./out",
    "prefix": "gitlode",
    "rotation": {
      "lines": 100000,
      "size": "1G"
    }
  },
  "repository": {
    "name": "my-repo",
    "url": "https://example.com/org/my-repo.git"
  },
  "runtime": {
    "profile": true
  },
  "extensions": {
    "my-plugin": {
      "entrypoint": "./my-plugin.js",
      "config": { "threshold": 10 },
      "failurePolicy": "skip-fact"
    }
  }
}
```

- **`extraction` section rules**: `extraction.refs` is a non-empty array of ref strings and provides config-backed defaults for `--ref`. `extraction.range` is optional and, when present, must be an object containing exactly one of `sinceRef` or `sinceDate`. `sinceDate` uses the same ISO 8601 validation rule as the CLI flag. The range object is snapshot-only and does not introduce a config-level incremental mode.
- **`output` section rules**: `output.directory` is a path string, `output.prefix` is a non-empty string, and `output.rotation.lines` / `output.rotation.size` map to the existing rotation concepts. `output.rotation.size` uses the same size grammar as `--rotate-size`. Relative path values inside the config file resolve from the config file directory, not from the invocation CWD. This path-resolution rule applies to all path-valued config fields introduced by Phase 4 and preserves the existing `extensions.*.entrypoint` relative-resolution model.
- **`repository` section rules**: `repository.name` and `repository.url` are exact config-backed defaults for `--repo-name` and `--repo-url`. They affect emitted record metadata only and must not affect state identity or traversal semantics.
- **`runtime` section rules**: `runtime.profile` is the only runtime section field in scope for v0.8.0. No quiet/styling/color defaults are added in this phase. `runtime.profile` enables the same successful-run profiling output as `--profile`; it does not alter warning/error visibility rules.
- **`extensions` compatibility guarantee**: The `extensions` section keeps its Phase 1 / Phase 2 contract unchanged: namespace key pattern, non-empty object requirement when present, plugin `entrypoint` resolution behavior, `failurePolicy` semantics, declaration-order preservation, and core-owned `null` meaning all remain intact. Phase 4 widens the file around `extensions`; it does not redefine plugin configuration semantics.
- **Relationship between existing CLI options and config-backed defaults**: Phase 4 gives config-backed defaults to `--ref`, `--since-ref`, `--since-date`, `--output-dir`, `--output-prefix`, `--rotate-lines`, `--rotate-size`, `--repo-name`, `--repo-url`, and `--profile`. The following remain CLI-only in v0.8.0: `--config`, `--incremental`, `--state`, `--missing-state`, `--quiet`, `--per-file`, `--max-diff-size`, and the positional `<repository-path>`. These remain CLI-only because they control run mode, process-local behavior, or file/discovery authority in ways that do not yet have a stable config override/unset model.
- **Precedence model for scalar/path settings**: For `output.directory`, `output.prefix`, `repository.name`, and `repository.url`, precedence is `CLI explicit value > config value > built-in default`.
- **Precedence model for refs**: Any presence of CLI `--ref` replaces the entire config `extraction.refs` list for that run. There is no CLI/config ref-list merge. If CLI `--ref` is absent, `extraction.refs` becomes the effective ref list. If neither source provides refs, validation fails with a user error before extraction starts.
- **Precedence model for snapshot range**: CLI `--since-ref` or `--since-date` replaces the config `extraction.range` object as a whole for that run. CLI `--since-ref` and `--since-date` remain mutually exclusive exactly as they are today.
- **Conflict rule for config snapshot range plus `--incremental`**: If the config file provides `extraction.range` and the CLI also passes `--incremental`, the run fails as a user error before Git I/O begins. This is a deliberate fail-fast rule chosen for v0.8.0 so snapshot-range defaults do not become silently ignored by an explicit incremental invocation.
- **Precedence model for rotation thresholds**: `lines` and `size` are resolved independently. `--rotate-lines` overrides only `output.rotation.lines`; `--rotate-size` overrides only `output.rotation.size`. A threshold omitted in both CLI and config remains disabled. If one threshold comes from CLI and the other from config, both are active and rotation still triggers when either threshold is reached.
- **Precedence model for profile**: Effective profiling is `CLI --profile OR config runtime.profile OR built-in false`. Because the current CLI exposes only an enable flag and no `--no-profile`, a config-enabled profile cannot be disabled ad hoc from the CLI in this release. This asymmetry is acceptable for v0.8.0 and is one reason `quiet` remains CLI-only.
- **Config loading and validation ownership**: The CLI layer owns config file reading, JSON parsing, schema validation, relative-path resolution, CLI/config precedence merging, and CLI/config incompatibility detection. Core, Git, and Output layers must receive fully resolved effective settings and remain unaware of whether a value came from CLI, config, or a built-in default.
- **Validation pipeline update**: Phase 4 inserts config resolution between pure CLI syntax checks and downstream filesystem/Git validation. The intended order is: (1) CLI-only parse and format validation that needs no file reads, (2) config file read/JSON/schema validation when `--config` is present, (3) CLI/config merge plus conflict checks, including the effective-ref requirement and the `extraction.range` plus `--incremental` fail-fast rule, (4) filesystem validation using effective path settings, and (5) Git validation using effective refs/range settings.
- **Typed validation location**: Typed config schemas and the effective-settings merge logic live in CLI-owned modules. Plugin-specific loading logic should consume the already validated `extensions` subsection rather than continue owning the whole config-file contract. Phase 4 should therefore separate generic config loading from plugin resolution responsibilities instead of growing `src/cli/plugins.ts` into the generic config authority.
- **Error classification and exit-code mapping**: Invalid config schema, unknown keys, missing required effective refs, incompatible CLI/config combinations, unreadable config files, and invalid config path/value shapes are user errors and must continue to map to exit code `1` through the Phase 2 typed-termination path. Unexpected internal failures while processing config after successful validation continue to map to runtime error exit code `2`. No lower-level helper regains direct `process.exit(...)` ownership.
- **Behavior when no `extensions` section is present**: A config file may be used for non-plugin defaults only. In that case plugin loading, compatibility checks, and plugin initialization are skipped, `DefaultFactProjector` remains in use, and output records omit `extensions` exactly as they do today when no plugins are configured.
- **`extends` stance for v0.8.0**: `extends` is explicitly excluded from this phase. Rationale: composition semantics, cycle handling, relative-path rebasing, and precedence across multiple files would expand the loading model substantially and would blur the goal of establishing one-file config defaults with deterministic CLI/config precedence first.
- **Environment-variable interpolation stance for v0.8.0**: Environment-variable interpolation is explicitly excluded from this phase. All string values are treated literally. Syntax such as `${NAME}` has no special meaning in `version: 1` and must not be partially interpreted. This avoids ambiguous security and portability rules during the initial config expansion.
- **JSON Schema publication stance**: Publish a versioned JSON Schema in v0.8.0 for the supported `version: 1` config surface, including the unchanged `extensions` section and the new Phase 4 sections only. The schema is a validation/documentation aid for the shipped surface, not a promise about deferred features such as `extends` or env interpolation. Precedence behavior and some cross-source conflicts remain documented normatively in prose because they are not fully expressible in JSON Schema alone.
- **Runtime/plugin boundary invariants**: Phase 4 must preserve Phase 2 ownership boundaries. CLI continues to own config loading, plugin resolution, compatibility warnings, and plugin initialization. Core continues to own extraction and projection semantics only. No config value may change plugin failure-policy semantics, warning visibility policy, traversal behavior, state commit timing, or output-record meaning beyond selecting existing CLI-controlled defaults.

#### Non-Goals

- Adding `extends`, multi-file config composition, or cycle detection
- Adding environment-variable interpolation or secret-loading semantics
- Introducing config auto-discovery, implicit repo-root lookup, or any behavior that uses a config file without explicit `--config`
- Adding config-backed defaults for `--incremental`, `--state`, `--missing-state`, `--quiet`, `--per-file`, or `--max-diff-size`
- Redesigning the `extensions` section schema, plugin runtime contract, or plugin failure-policy behavior
- Adding alternate config formats such as YAML or TOML

#### Target Files

| File                                                  | Action | Notes                                                                                                                                      |
| ----------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/gitlode/src/cli/args.ts`                    | Modify | Accept config-backed refs/range/defaults in validation flow while preserving existing CLI-only mutual exclusions and error taxonomy.       |
| `packages/gitlode/src/cli/plugins.ts`                 | Modify | Narrow to plugin-resolution responsibilities over the validated `extensions` subsection only.                                              |
| `packages/gitlode/src/cli/config/types.ts`            | Create | Define generic config-file types and resolved effective-settings types for the CLI layer.                                                  |
| `packages/gitlode/src/cli/config/loader.ts`           | Create | Implement JSON read/parse/schema validation, relative-path normalization, and CLI/config merge helpers.                                    |
| `packages/gitlode/src/cli/config/index.ts`            | Create | Barrel for generic config-loading helpers used by CLI runtime modules.                                                                     |
| `packages/gitlode/src/cli/runtime/types.ts`           | Modify | Carry effective config-derived defaults and any runtime-local types needed after merge resolution.                                         |
| `packages/gitlode/src/cli/runtime/execution.ts`       | Modify | Use resolved effective settings, support config-without-plugins runs, and keep plugin initialization conditional on `extensions` presence. |
| `packages/gitlode/src/index.ts`                       | Modify | Wire the new CLI config-loading path into the existing runtime boundary without reclaiming helper-owned exit behavior.                     |
| `packages/gitlode/test/cli/args.test.ts`              | Modify | Cover config-backed refs, range precedence, missing-effective-ref errors, and `extraction.range` plus `--incremental` conflict behavior.   |
| `packages/gitlode/test/cli/plugins.test.ts`           | Modify | Cover plugin loading from the validated `extensions` subsection and config-without-plugins behavior.                                       |
| `packages/gitlode/test/cli/runtime/execution.test.ts` | Modify | Cover config-only defaults, CLI-over-config precedence, and projector selection with and without `extensions`.                             |
| `packages/gitlode/test/cli/config/loader.test.ts`     | Create | Cover schema validation, strict unknown-key handling, path rebasing, and effective-setting merge rules.                                    |
| `packages/gitlode/schemas/config-v1.schema.json`      | Create | Publish the shipped JSON Schema for the supported `version: 1` config surface.                                                             |
| `packages/gitlode/package.json`                       | Modify | Ensure the published package includes the config schema artifact.                                                                          |
| `packages/gitlode/docs/design/configuration.md`       | Create | Add an authoritative design document for the general configuration-file model and precedence rules.                                        |

#### Documentation Touchpoints

| File                                                | Section                                         | Action  |
| --------------------------------------------------- | ----------------------------------------------- | ------- |
| `.github/instructions/cli.instructions.md`          | "Extraction Mode"                               | Update  |
| `.github/instructions/cli.instructions.md`          | "Range Filter (snapshot mode only)"             | Update  |
| `.github/instructions/cli.instructions.md`          | "Output and Repository Metadata"                | Update  |
| `.github/instructions/cli.instructions.md`          | "Control"                                       | Update  |
| `.github/instructions/cli.instructions.md`          | "Configuration File"                            | Replace |
| `.github/instructions/cli.instructions.md`          | "Mutual Exclusion Rules"                        | Update  |
| `.github/instructions/cli.instructions.md`          | "Validation Rules"                              | Replace |
| `.github/instructions/architecture.instructions.md` | "Ownership and boundary rules"                  | Update  |
| `.github/instructions/architecture.instructions.md` | "CLI Layer (`src/cli/`)"                        | Update  |
| `packages/gitlode/README.md`                        | feature list / options table for `--config`     | Update  |
| `packages/gitlode/docs/usage.md`                    | "Configuration File"                            | Replace |
| `packages/gitlode/docs/usage.md`                    | "Plugin Enrichment"                             | Update  |
| `packages/gitlode/docs/design/plugins.md`           | "Plugin Configuration File"                     | Replace |
| `packages/gitlode/docs/design/plugins.md`           | "Lifecycle"                                     | Update  |
| `packages/gitlode/docs/design/architecture.md`      | config-loading flow when `--config` is provided | Update  |

#### Implementation Notes

- Build the generic config loader before changing plugin resolution so the `extensions` subsection can become a consumer of an already validated generic config object rather than staying the top-level authority.
- Keep precedence resolution centralized in one CLI-owned merge step that produces an effective settings object. Avoid scattering `cliValue ?? configValue ?? defaultValue` logic across `args.ts`, runtime helpers, and plugin bootstrap.
- Preserve the existing explicit-opt-in model: no code path should attempt to discover or read a config file unless `--config` was passed.
- When publishing the JSON Schema, keep the prose docs authoritative for cross-source precedence and conflict rules that schema alone cannot encode.

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

- Run `gitlode --config ./gitlode.config.json ./repo` with `extraction.refs` defined and no CLI `--ref`; confirm extraction succeeds using config-backed refs.
- Run the same config with CLI `--ref release` and confirm the CLI ref list fully replaces config refs for that run.
- Run with config `extraction.range.sinceRef` plus CLI `--incremental`; confirm the run fails with a user error before Git traversal begins.
- Run with config `output.rotation.size` only and CLI `--rotate-lines`; confirm both thresholds are active and rotation occurs when either threshold is reached.
- Run with config `runtime.profile: true` and no CLI `--profile`; confirm the normal successful-run profile block is emitted. Run with a config file that omits `extensions`; confirm plugin initialization is skipped and output records still omit `extensions`.
