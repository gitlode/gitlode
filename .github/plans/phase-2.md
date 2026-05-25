### Phase 2: Official Plugin Package Policy and Compatibility Contract

_Define the official `@gitlode/*` plugin distribution and compatibility policy, document it as a canonical specification, and implement a warning-only runtime compatibility check that compares the running `gitlode` core version against each plugin's declared `peerDependencies.gitlode` range during plugin initialization._

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `.github/roadmap.md` — "Distribution/Compatibility: Official plugin package policy and version contract"
- `.github/plugin-monorepo-strategy.md` — Axis A rows for "Official plugin naming", "Compatibility declaration", "Runtime compatibility behavior", "Compatibility CI matrix"
- `.github/plans/phase-1.md` — "Public API surface for Phase 2" (frozen surface that this phase depends on)
- `.github/instructions/architecture.instructions.md` — layer ownership and boundary rules
- `.github/instructions/cli.instructions.md` — CLI option and behavior contract rules
- `.github/instructions/development-workflow.instructions.md` — documentation touchpoint and release-task constraints

#### Design Decisions

##### Package naming policy

- **Official plugin package name**: `@gitlode/plugin-<name>`. The `plugin-` prefix is mandatory inside the `@gitlode` scope to keep the scope reserved for future non-plugin packages (helpers, shared types, etc.). Aligned with Babel / Rollup / Vite / Prettier conventions for scoped official plugins.
- **Core package**: remains `gitlode` (unscoped). No rename.
- **Third-party plugins**: not constrained by this policy. The community convention `gitlode-plugin-<name>` is suggested but not enforced.

##### Required `package.json` metadata for official plugins

- `"name": "@gitlode/plugin-<name>"` — required.
- `"type": "module"` — required. CJS dual-publish is explicitly not supported (Phase 1 ESM-only loader contract).
- `"exports"` — single entry shape: `{ ".": "./dist/index.js" }` (or equivalent path). The default export of that entry MUST be a `PluginFactory` per the Phase 1 contract. Named-export factories are not supported.
- `"peerDependencies": { "gitlode": "<range>" }` — required (see range policy below).
- `"engines": { "node": ">=<core-min>" }` — recommended to match the core `gitlode` minimum (currently `>=22.0.0`). Omission is permitted; not enforced.
- `"keywords"` — recommended to include `"gitlode-plugin"` for npm discoverability. Not required.
- License, README, and a short compatibility note in the README are recommended but not enforced by the runtime.

##### Compatibility range policy (`peerDependencies.gitlode`)

- **Recommended form**: caret notation `^X.Y.Z` (e.g. `^0.7.0`). This is the standard form across the npm ecosystem and pre-1.0 caret semantics (`^0.7.0` ≡ `>=0.7.0 <0.8.0`) provide minor-bounded compatibility automatically.
- **Equivalent explicit form**: `>=X.Y.Z <X.(Y+1).0` is acceptable for authors who prefer to avoid pre-1.0 caret ambiguity. The policy documentation explains the equivalence in one paragraph.
- **Lower bound**: the lowest `gitlode` version the plugin author has actually validated against. New plugins targeting the Phase 1 API floor declare at least `^0.7.0`.
- **Upper bound (pre-1.0)**: implicit at the next minor (caret behavior). Pre-1.0 core may make breaking changes on minor bumps; plugin authors are expected to re-validate and bump the peer range when needed.
- **Multi-range syntax** (e.g. `^0.7.0 || ^0.8.0`): permitted; the runtime relies on `semver.satisfies` and therefore supports any valid `node-semver` range.
- **Bump cadence** (documentation only): when the core API surface declared in Phase 1 changes in a backward-compatible way, plugin authors may widen their peer range; when it changes in a breaking way, plugin authors must release a new version with an updated peer range.

##### Namespace guidance (config-level `plugins.<ns>` key)

- The `<namespace>` key in the user-supplied config is free-form per Phase 1 and remains so.
- Policy documentation notes neutrally: _"If you have no specific preference, using the package's short name (the portion after `@gitlode/plugin-`) as the namespace works well — for example, `@gitlode/plugin-conventional-commits` → `conventional-commits`."_ No "recommended" / "required" framing is used because alternative choices have no functional drawback.

##### Runtime compatibility check (CLI layer)

- **Ownership**: implemented in `packages/gitlode/src/cli/plugins.ts`. Core layer is not touched. Aligns with the Phase 1 layer-ownership rule that plugin lifecycle management belongs in the CLI layer.
- **New loader step**: `checkPluginCompatibility(entries: PluginEntry[]): Promise<void>`. Invoked from the loader pipeline immediately before `initializePlugins(entries)` inside the existing Phase 1 `initializing-plugins` progress phase. No new progress phase is added.
- **Behavior**: warning-only. Never causes a non-zero exit. No flag is provided to escalate warnings to errors (explicit Non-Goal).
- **Per-plugin algorithm**:
  1. Resolve the plugin entrypoint via `import.meta.resolve(entrypoint, configFileUrl)` to obtain an absolute URL.
  2. Walk parent directories of the resolved file to locate the nearest `package.json` (best-effort; bounded search, stop at filesystem root or after a small maximum step count).
  3. Read `peerDependencies.gitlode` from that `package.json`.
  4. Compare it with the running core version (read once at process startup from the `gitlode` package's own `package.json` and cached).
  5. Emit a warning (or skip) according to the cases below.
- **Cases and messages** (each is exactly one stderr line; no prefix, consistent with Phase 1 plugin warning style):
  - Range satisfied → no output.
  - Range declared but not satisfied:
    `Plugin "<ns>" declares peer gitlode <range>, but running gitlode is <version>. Continuing; behavior may be incompatible.`
  - `peerDependencies.gitlode` absent (or no `peerDependencies` block):
    `Plugin "<ns>" does not declare peerDependencies.gitlode. Compatibility unknown; continuing.`
  - `package.json` unreachable / unreadable / unparsable, or `peerDependencies.gitlode` value is not a valid semver range:
    `Plugin "<ns>" compatibility check skipped: unable to read package metadata at <path>.`
- **Quiet flag interaction**: `--quiet` does NOT suppress these warnings. Same rationale as Phase 1 plugin `init()` errors that `--quiet` also does not suppress.
- **Empty-plugins bypass**: the entire compatibility check is skipped when no `--config` is supplied (consistent with the Phase 1 empty-plugins bypass).
- **Differentiated handling by scope** (e.g. stricter behavior for `@gitlode/*` plugins): explicitly rejected. The runtime treats all plugins uniformly. Policy obligations on official plugins live in documentation only.

##### Runtime dependency addition

- Add `semver` to `packages/gitlode/package.json` `dependencies`. Used for `satisfies(version, range)` and basic range validation.
- Add `@types/semver` to `devDependencies` if the TypeScript build requires it (verify during implementation).
- Rejected alternative: hand-rolled minor-range parser. Adds maintenance burden disproportionate to the benefit; the ecosystem-standard `semver` package is small and stable.

##### Canonical documentation location

- **Canonical policy document**: `packages/gitlode/docs/design/plugins.md` (created in Phase 1). Phase 2 adds a "Plugin Package Policy" chapter covering naming, required metadata, peer range policy (with the pre-1.0 caret note), runtime check semantics, and namespace guidance.
- **LLM-facing rules**: a new `.github/instructions/plugin-policy.instructions.md` summarizes the policy in a normative tone so that LLM-driven authoring of plugin `package.json` files follows the contract. The exact `applyTo` glob is finalized at drafting time; the intent is to cover `package.json` files of plugin packages (e.g. `packages/plugin-*/package.json`) and authoring touchpoints in plugin documentation.
- `.github/plugin-monorepo-strategy.md` continues to act as the cross-version execution-strategy document and delegates to `docs/design/plugins.md` for normative policy details.

#### Non-Goals

- No `--strict-plugins` (or equivalent) flag to escalate compatibility warnings to errors. Warning-only is the entire Phase 2 contract.
- No scope-based differentiated runtime behavior (e.g. hard-error when `@gitlode/*` plugins lack a peer declaration). Scope obligations are documentation-level only.
- No scaffold or publication of any actual `@gitlode/plugin-*` package. Phase 2 establishes the contract and verification mechanism only.
- No automated CI matrix (lower-bound + latest core) for plugin packages. Tracked for the first official plugin's introduction.
- No changesets migration or package-oriented CI/CD split (deferred per `plugin-monorepo-strategy.md`).
- No change to any Phase 1 contract: `ProjectorPlugin`, `PluginFactory`, `PluginInitResult`, `ProjectionContext`, `PluginProjectionResult`, `PluginFailurePolicy`, `OutputRecordExtensions`, the config schema (`version: 1` and `plugins.<ns>.{entrypoint,config?,failurePolicy?}`), and the `initializing-plugins` progress phase all remain untouched.
- No CJS dual-publish support for plugins.
- No bundling of plugins into the core `gitlode` package.
- No new CLI option in Phase 2.
- No change to output schema, state file schema, `GitAdapter`, `ExtractionCoordinator`, `OutputWriter`, or `OutputSink`.

#### Target Files

**New files:**

| File                                                 | Action | Notes                                                                                                                                                                                                          |
| ---------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/instructions/plugin-policy.instructions.md` | Create | LLM-facing normative summary of the official plugin policy: naming, required metadata, peer range form, namespace guidance. `applyTo` glob targets plugin-package `package.json` and authoring docs; exact glob finalized at drafting. |

**Modified files (implementation):**

| File                                        | Action | Notes                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/gitlode/src/cli/plugins.ts`       | Modify | Add `checkPluginCompatibility(entries)`. Add a small helper to resolve the nearest `package.json` from a plugin entrypoint URL via `import.meta.resolve` + parent-directory walk. Cache the running core version (read once from the `gitlode` package's own `package.json`). Wire into the loader pipeline immediately before `initializePlugins`.                                |
| `packages/gitlode/package.json`             | Modify | Add `semver` to `dependencies`. Add `@types/semver` to `devDependencies` if required by the TypeScript build.                                                                                                                                                                                                                                                                       |
| `packages/gitlode/test/cli/plugins.test.ts` | Modify | Add cases: (a) range satisfied → silent; (b) range declared and not satisfied → warning text; (c) `peerDependencies.gitlode` missing → warning text; (d) `package.json` unreachable → warning text; (e) multi-range (`^0.7.0 \|\| ^0.8.0`) satisfied; (f) `--quiet` does not suppress warnings; (g) no `--config` → check path not entered.                                          |

**Modified files (documentation):**

| File                                                | Action | Notes                                                                                                                                                                                                            |
| --------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/gitlode/docs/design/plugins.md`           | Modify | Add "Plugin Package Policy" chapter (naming, required `package.json` metadata, peer range form with pre-1.0 caret note, runtime check semantics, namespace guidance).                                            |
| `packages/gitlode/docs/usage.md`                    | Modify | Add a plugin install example showing the expected `peerDependencies` shape and a sample of the compatibility warning output.                                                                                      |
| `packages/gitlode/README.md`                        | Modify | One-line pointer: "For the official plugin package policy and compatibility contract, see `docs/design/plugins.md`."                                                                                              |
| `.github/plugin-monorepo-strategy.md`               | Modify | In Axis A, append a short delegation note on the "Compatibility declaration" and "Runtime compatibility behavior" rows pointing to `docs/design/plugins.md` as the canonical policy document.                    |
| `.github/roadmap.md`                                | Modify | Update the "Distribution/Compatibility: Official plugin package policy and version contract" entry to reflect that the contract has been implemented in v0.7.0 and link to `docs/design/plugins.md`.              |
| `.github/instructions/architecture.instructions.md` | Modify | In the plugin runtime subsection (added by Phase 1), add a sentence stating that plugin compatibility checking is the CLI layer's responsibility and must not be implemented in the core layer.                  |

#### Documentation Touchpoints

| File                                                 | Section                                                                                 | Action |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- | ------ |
| `packages/gitlode/docs/design/plugins.md`            | "Plugin Package Policy" (new chapter)                                                   | Update |
| `packages/gitlode/docs/usage.md`                     | Plugin install / compatibility warning example                                          | Update |
| `packages/gitlode/README.md`                         | Plugin pointer line                                                                     | Update |
| `.github/plugin-monorepo-strategy.md`                | Axis A — Compatibility declaration / Runtime compatibility behavior rows                | Update |
| `.github/roadmap.md`                                 | "Distribution/Compatibility: Official plugin package policy and version contract" entry | Update |
| `.github/instructions/architecture.instructions.md`  | Plugin runtime subsection — layer ownership note                                        | Update |
| `.github/instructions/plugin-policy.instructions.md` | (entire file, new)                                                                      | Create |

#### Implementation Notes

- **Core version source of truth**: read once at process startup from the `gitlode` package's own `package.json`. Choose the simplest approach that survives both `npm link` and published-install layouts during implementation (e.g. resolve the file via a path computed from the CLI entrypoint, or inject the value at build time).
- **`import.meta.resolve` availability**: Node `>=22.0.0` is the current `engines.node`, so `import.meta.resolve` is a stable synchronous API. No flag and no fallback path required.
- **`package.json` walk bound**: stop at filesystem root or after a small bounded number of parent steps (e.g. 20) to avoid pathological loops. Treat any I/O or parse failure as the "compatibility check skipped" case rather than propagating.
- **Order of work**: (1) add `semver` dependency (and `@types/semver` if needed); (2) implement `checkPluginCompatibility` and the package-json resolver helper with unit tests; (3) wire into loader pipeline and confirm the empty-plugins bypass remains intact; (4) author the `docs/design/plugins.md` "Plugin Package Policy" chapter; (5) author `.github/instructions/plugin-policy.instructions.md`; (6) update `README.md`, `usage.md`, `plugin-monorepo-strategy.md`, `roadmap.md`, and `architecture.instructions.md` to point at the canonical doc.
- **Phase 1 dependency**: Phase 2 implementation must not begin until Phase 1's plugin loader pipeline (`loadPluginConfig` → `resolvePluginEntries` → `initializePlugins`) is in place. The new `checkPluginCompatibility` step is inserted between `resolvePluginEntries` and `initializePlugins`.
- **`applyTo` for the new instructions file**: finalize the exact glob during implementation. The intent is plugin-package `package.json` files plus authoring touchpoints. If no plugin packages exist in the monorepo yet, the glob may target prospective paths (e.g. `packages/plugin-*/package.json`) and still serve LLM authoring sessions correctly.

#### Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- With `--config` listing a plugin whose `peerDependencies.gitlode` is satisfied: no compatibility warning is emitted; extraction proceeds as in Phase 1.
- With `--config` listing a plugin whose declared range is not satisfied: a single stderr line matching the "Range declared and not satisfied" message is emitted; exit code is 0 (warning-only); extraction proceeds.
- With `--config` listing a plugin that does not declare `peerDependencies.gitlode`: the corresponding "Compatibility unknown" message is emitted on stderr; extraction proceeds.
- With `--config` listing a plugin whose `package.json` cannot be located or parsed: the corresponding "compatibility check skipped" message is emitted on stderr; extraction proceeds.
- `--quiet` + any of the warning cases above: warnings remain visible on stderr.
- Without `--config`: no compatibility-check-related code path is exercised; output is identical to the no-plugins Phase 1 baseline.
- Multi-range peer (e.g. `^0.7.0 || ^0.8.0`) is correctly accepted when the running core is in either supported branch.
- Documentation consistency: `README.md`, `docs/design/plugins.md`, `docs/usage.md`, `plugin-monorepo-strategy.md`, `roadmap.md`, and `architecture.instructions.md` reference the same canonical policy without contradiction.
