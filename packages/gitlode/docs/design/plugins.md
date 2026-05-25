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
interface ProjectorPlugin {
  /** Optional. Called once before extraction starts. */
  init?(): Promise<PluginInitResult>;

  /** Called once per output record. Must be fast and non-blocking.  */
  project(ctx: ProjectionContext, profiler?: Profiler): Promise<PluginProjectionResult>;
}
```

### `PluginInitResult`

```typescript
type PluginInitResult = { type: "ready" } | { type: "fatal"; message: string };
```

`init()` is optional. If absent, the plugin is treated as always ready. If `init()` returns
`{ type: "fatal" }` or throws, the run aborts with exit code 1 before any extraction begins.
Multiple plugin failures are all reported before exiting.

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
type PluginProjectionResult =
  | { type: "success"; data: Record<string, unknown> }
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
    "other-plugin": null
  }
}
```

- Each key is a plugin namespace declared in the configuration file.
- A value of `null` means the plugin skipped or encountered an error on this fact.
- Key order in `extensions` matches plugin declaration order in the configuration file.
- If no plugins are configured, the `extensions` field is omitted from output records entirely.

---

## Lifecycle

1. **Config load** — `--config` path is read and validated against the JSON schema.
2. **Entrypoint resolution** — Each plugin's module is resolved and imported. Factory functions are invoked with the declared `config` value.
3. **Init** — All `init()` methods are called in parallel. If any return `fatal` or throw, the run aborts.
4. **Extraction** — `EnrichingFactProjector` wraps the core projector and calls each plugin's `project()` for every fact, in declaration order.
5. **Profiling** — When `--profile` is active, each plugin gets a sub-profiler under `elapsed/plugins/<namespace>`.

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
- **Enrichment projection is a Core boundary concern.** `EnrichingFactProjector` (in `src/core/`) wraps the default projector and orchestrates per-fact plugin calls.
- **Core types define the plugin contract.** `ProjectorPlugin`, `PluginEntry`, `PluginFactory`, `PluginInitResult`, `PluginProjectionResult`, `ProjectionContext`, `PluginFailurePolicy` are all in `src/core/types.ts`.
- **Plugins must not be called from inside the Git adapter or Output layer.** Cross-layer calls violate the architecture boundary.
- **The `extensions` field is a Core projection concern.** `ProjectedExtensions` is defined in `src/core/types.ts` as `Record<string, Record<string, unknown> | null>`.

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
