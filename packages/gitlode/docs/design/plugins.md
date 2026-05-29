# Plugin System Design

## Purpose

This document describes the plugin runtime introduced in v0.7.0: the contract between gitlode and
external plugins, the configuration file format, the lifecycle model, and the enrichment pipeline.

---

## Motivation

gitlode is a faithful extractor of Git facts. Interpretation, enrichment, and custom annotation of
those facts belong in the downstream pipeline. The plugin system provides a structured boundary at
which custom logic can attach to the extraction process and add optional fields to output records
without modifying gitlode core.

A plugin receives each output record along with its source `Fact` and returns a
domain-specific payload to be written under a reserved namespace key in the `extensions` object.

---

## Plugin Configuration File

Plugins are declared in a JSON configuration file passed via `--config` (alias `-c`):

```bash
gitlode -r main --config ./gitlode.config.json ./my-repo
```

The configuration file schema:

```json
{
  "version": 1,
  "extensions": {
    "<namespace>": {
      "entrypoint": "<path or specifier>",
      "config": { ... },
      "failurePolicy": "skip-fact" | "fatal"
    }
  }
}
```

### Fields

| Field           | Type                       | Required | Description                                                                                                                                                                        |
| --------------- | -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`       | `1`                        | ✅       | Schema version. Must be `1`.                                                                                                                                                       |
| `extensions`    | object                     | ✅       | Map from namespace key to plugin entry. Must contain at least one entry.                                                                                                           |
| `<namespace>`   | string                     | ✅       | Namespace key for this plugin's data. Must match `[a-z0-9-]+`. Written as a key under `extensions` in output.                                                                      |
| `entrypoint`    | string                     | ✅       | Module specifier. Relative paths (starting with `.`) resolve from the config file directory. Bare specifiers resolve via Node.js module resolution from the config file directory. |
| `config`        | any JSON value             |          | Passed as-is to the plugin factory. Omit or set to `null` if unused.                                                                                                               |
| `failurePolicy` | `"skip-fact"` \| `"fatal"` |          | Default: `"skip-fact"`. Controls behavior when the plugin returns a `fatal` result or throws.                                                                                      |

---

## Plugin Module Contract

A plugin module must export a **default factory function**:

```typescript
// Factory signature
export default async function factory(config: unknown): Promise<ProjectorPlugin>;
```

The returned object must implement `ProjectorPlugin`:

```typescript
interface PluginRuntimeContext extends DiagnosticReporter {
  readonly profiler?: StageProfiler;
}

interface ProjectorPlugin {
  /** Called once before extraction starts. */
  init(runtime: PluginRuntimeContext): Promise<PluginInitResult>;

  /** Called once per output record. Must be fast and non-blocking. */
  project(ctx: ProjectionContext): Promise<PluginProjectionResult>;
}
```

### `PluginInitResult`

```typescript
type PluginInitResult = { type: "ready" } | { type: "fatal"; message: string };
```

`init(runtime)` is required. The runtime context carries plugin-scoped diagnostics (`warn`,
`error`) and, when `--profile` is active, an optional plugin-scoped profiler. If `init(runtime)`
returns `{ type: "fatal" }` or throws, the run aborts with exit code 1 before any extraction
begins. Multiple plugin failures are all reported before exiting.

### `ProjectionContext`

```typescript
interface ProjectionContext {
  /** The raw fact (CommitFact or FileChangeFact) being projected. */
  readonly fact: Fact;
  /** The base projected record produced by gitlode's core projector. Frozen (read-only at runtime). */
  readonly baseRecord: ProjectedRecord;
}
```

### `PluginProjectionResult`

```typescript
/**
 * Scalar or object value a plugin may return as `success.data`.
 * `null` is excluded — return `{ type: "skip" }` to signal no data.
 */
type PluginProjectionValue = string | number | boolean | Readonly<Record<string, unknown>>;

type PluginProjectionResult =
  | { type: "success"; data: PluginProjectionValue }
  | { type: "skip"; message: string }
  | { type: "fatal"; message: string };
```

| Result type | Effect                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `success`   | `data` is written under the plugin's namespace in `extensions`.                                                                  |
| `skip`      | Namespace is set to `null` in `extensions`. A warning is emitted with `message`.                                                 |
| `fatal`     | Behavior depends on `failurePolicy`: `skip-fact` → namespace set to `null`, warning emitted; `fatal` → run aborts with an error. |

If `project()` throws, the exception is treated as a `fatal` result.

---

## Output Record: `extensions` Field

When at least one plugin is active, each output record gains an `extensions` object:

```json
{
  "oid": "...",
  "subject": "...",
  "extensions": {
    "my-plugin": { "score": 42 },
    "label-plugin": "v1.0",
    "flag-plugin": true,
    "other-plugin": null
  }
}
```

- Each key is a plugin namespace declared in the configuration file.
- A value of `null` means the plugin skipped or encountered an error on this fact (core-reserved sentinel).
- Non-null values are whatever `success.data` returned: a plain object, a string, a number, or a boolean.
- Key order in `extensions` matches plugin declaration order in the configuration file.
- If no plugins are configured, the `extensions` field is omitted from output records entirely.

---

## Lifecycle

1. **Config load** — `--config` path is read and validated against the JSON schema.
2. **Entrypoint resolution** — Each plugin's module is resolved and imported. Factory functions are invoked with the declared `config` value.
3. **Init** — All `init()` methods are called in parallel. If any return `fatal` or throw, the run aborts.
4. **Extraction** — `EnrichingFactProjector` wraps the core projector and calls each plugin's `project()` for every fact, in declaration order.
5. **Profiling** — When `--profile` is active, each plugin receives an optional profiler in
   `init(runtime)`. gitlode creates plugin profilers under
   `elapsed/projection/plugins/<namespace>`, but the plugin decides whether to use that profiler
   for whole-project timing, finer internal steps, or not at all.

---

## Failure Policy Details

### `skip-fact` (default)

When a plugin returns `fatal` or throws on a given fact:

- The namespace value in `extensions` is set to `null`.
- A warning is emitted to stderr: `Plugin "<namespace>" skipped fact <oid>[/<path>]: <message>`
- Extraction continues.

### `fatal`

When a plugin returns `fatal` or throws on a given fact:

- The run aborts immediately with an error message.
- Exit code 2.

---

## Ownership and Boundaries

- **Plugin runtime is a CLI boundary concern.** Config loading, module resolution, and factory invocation happen in `src/cli/plugins.ts`.
- **Plugin initialization is a CLI boundary concern.** `src/cli/plugins.ts` constructs the runtime context, runs all `init(runtime)` calls in parallel, and aggregates init failures before extraction starts.
- **Enrichment projection is a Core boundary concern.** `EnrichingFactProjector` (in `src/core/`) wraps the default projector and orchestrates per-fact plugin calls.
- **Core types define the plugin contract.** `ProjectorPlugin`, `PluginEntry`, `PluginFactory`, `PluginInitResult`, `PluginProjectionResult`, `PluginProjectionValue`, `ProjectionContext`, `PluginFailurePolicy` are all in `src/core/types.ts`.
- **Per-fact plugin profiling is plugin-controlled.** `EnrichingFactProjector` no longer wraps every `project()` call in host-owned timing. If a plugin wants projection profiling, it uses the optional profiler received during `init(runtime)`.
- **Plugins must not be called from inside the Git adapter or Output layer.** Cross-layer calls violate the architecture boundary.
- **The `extensions` field is a Core projection concern.** `ProjectedExtensions` is defined in `src/core/types.ts` as `Record<string, ProjectedExtensionValue>` where `ProjectedExtensionValue = PluginProjectionValue | null`. The `null` sentinel is core-reserved: plugins produce it only indirectly via `skip` or `fatal`-with-`skip-fact` results, never by returning `null` directly in `success.data`.
- **gitlode guarantees the outer `extensions` contract only:** namespace key placement, omission when no plugins are active, declaration-order preservation, and the meaning of `null`. The inner shape of a plugin's non-null payload is owned jointly by the plugin author and the user's chosen namespace/config pairing.

---

## Plugin Package Policy

This section defines the official policy for distributing and versioning plugins under the
`@gitlode` scope. It applies to all first-party `@gitlode/plugin-*` packages. Third-party
plugin authors are encouraged to follow the same conventions but are not required to.

### Package Naming

Official plugins are published as `@gitlode/plugin-<name>`. The `plugin-` prefix inside the
`@gitlode` scope is mandatory to keep the scope available for future non-plugin packages
(shared types, helpers, etc.). The core `gitlode` package remains unscoped.

Community plugins may use the convention `gitlode-plugin-<name>` for npm discoverability, but
the runtime imposes no naming requirements on third-party plugins.

### Required `package.json` Metadata

Every `@gitlode/plugin-*` package must include:

| Field                        | Constraint                                                |
| ---------------------------- | --------------------------------------------------------- |
| `"name"`                     | `"@gitlode/plugin-<name>"`                                |
| `"type"`                     | `"module"` — CJS dual-publish is not supported            |
| `"exports"`                  | Single entry `{ ".": "./dist/index.js" }` (or equivalent) |
| `"peerDependencies.gitlode"` | Semver range — see below                                  |

`"engines.node": ">=22.0.0"` is recommended but not required. `"keywords"` should include
`"gitlode-plugin"` for npm discoverability.

### Peer Range Policy

**Recommended form**: caret notation, e.g. `"gitlode": "^0.7.0"`.

Pre-1.0 caret semantics: `^0.7.0` ≡ `>=0.7.0 <0.8.0`. Each minor bump in the pre-1.0 series
may include breaking API changes; the implicit upper bound at the next minor is the right default.

An explicit equivalent form (`>=0.7.0 <0.8.0`) is also acceptable for authors who prefer to
avoid pre-1.0 caret ambiguity.

**Lower bound**: the lowest `gitlode` version the plugin author has validated against. New
plugins targeting the v0.7.0 API floor declare at least `^0.7.0`.

**Multi-range syntax** (e.g. `^0.7.0 || ^0.8.0`) is permitted; the runtime uses
`semver.satisfies` and accepts any valid `node-semver` range.

**Bump cadence**: when the core API surface changes in a backward-compatible way, plugin authors
may widen their peer range. When it changes in a breaking way, plugin authors must release a new
version with an updated peer range.

### Runtime Compatibility Check

When `--config` is provided, gitlode performs a warning-only compatibility check before
initializing plugins. It reads the `peerDependencies.gitlode` range from the nearest
`package.json` of each plugin entrypoint and compares it against the running core version:

| Condition                                          | Message (stderr)                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Range satisfied                                    | _(no output)_                                                                                                              |
| Range declared but not satisfied                   | `Plugin "<ns>" declares peer gitlode <range>, but running gitlode is <version>. Continuing; behavior may be incompatible.` |
| `peerDependencies.gitlode` absent                  | `Plugin "<ns>" does not declare peerDependencies.gitlode. Compatibility unknown; continuing.`                              |
| `package.json` unreachable, unreadable, or invalid | `Plugin "<ns>" compatibility check skipped: unable to read package metadata at <path>.`                                    |

These warnings are always written to stderr and are **not suppressed by `--quiet`**. The check is
warning-only; mismatches never cause a non-zero exit.

The check is skipped entirely when no `--config` is supplied.

### Namespace Guidance

The namespace key in the config file's `extensions` section becomes the key in each output
record's `extensions` object. It identifies the plugin's output slot, not the plugin itself.

If you have no specific preference, using the plugin's short name (the portion after
`@gitlode/plugin-`) works well — for example, `@gitlode/plugin-conventional-commits` →
`conventional-commits`. Choose a different name when you register the same plugin under multiple
namespaces with different configs, or when you prefer a shorter label in output records.

---

## Example Plugin

```typescript
// my-plugin.ts
import type { PluginFactory } from "gitlode";

interface MyConfig {
  threshold: number;
}

const factory: PluginFactory = async (rawConfig) => {
  const config = rawConfig as MyConfig;

  return {
    async init() {
      if (config.threshold < 0) {
        return { type: "fatal", message: "threshold must be non-negative" };
      }
      return { type: "ready" };
    },

    async project({ fact }) {
      if (fact.type !== "commit") {
        return { type: "skip", message: "file-change facts are not supported" };
      }
      const score = computeScore(fact, config.threshold);
      return { type: "success", data: { score } };
    },
  };
};

export default factory;

function computeScore(fact: unknown, threshold: number): number {
  // Custom logic here
  return threshold;
}
```

Configuration file:

```json
{
  "version": 1,
  "extensions": {
    "my-plugin": {
      "entrypoint": "./my-plugin.js",
      "config": { "threshold": 10 },
      "failurePolicy": "skip-fact"
    }
  }
}
```
