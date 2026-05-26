---
description: Official @gitlode/* plugin package policy — naming, required metadata, peer range form, and namespace guidance
applyTo: "packages/plugin-*/package.json,packages/plugin-*/README.md,packages/plugin-*/**"
---

# Official Plugin Package Policy

This file contains normative rules for authoring official `@gitlode/*` plugin packages.
Follow these rules when creating or modifying plugin package metadata, documentation, or any
authoring context that targets an official plugin under the `@gitlode` scope.

---

## Package Naming

- **Scope**: all official plugins use the `@gitlode` npm scope.
- **Required prefix**: the package name must follow the pattern `@gitlode/plugin-<name>`.
  The `plugin-` prefix is mandatory to keep the scope available for future non-plugin packages
  (shared types, helpers, etc.).
- **Examples**: `@gitlode/plugin-conventional-commits`, `@gitlode/plugin-custom-field`.
- **Core package**: the `gitlode` core package remains unscoped. Do not rename it.
- **Third-party plugins**: not constrained by this policy. The community convention
  `gitlode-plugin-<name>` is suggested but not enforced by the runtime.

---

## Required `package.json` Metadata

Every official `@gitlode/plugin-*` package must include the following fields:

| Field                           | Required | Value / constraint                                              |
| ------------------------------- | -------- | --------------------------------------------------------------- |
| `"name"`                        | ✅       | `"@gitlode/plugin-<name>"`                                      |
| `"type"`                        | ✅       | `"module"` — CJS dual-publish is not supported                  |
| `"exports"`                     | ✅       | `{ ".": "./dist/index.js" }` or equivalent single-entry shape   |
| `"peerDependencies.gitlode"`    | ✅       | Semver range; see Peer Range Policy below                       |
| `"engines.node"`                |          | Recommended `">=22.0.0"` to match core minimum; omission is OK |
| `"keywords"` including `"gitlode-plugin"` |  | Recommended for npm discoverability; not required               |

The `exports` default export must be a `PluginFactory` as defined by the Phase 1 plugin contract.
Named-export factories are not supported.

---

## Peer Range Policy (`peerDependencies.gitlode`)

### Recommended form

Use caret notation:

```json
"peerDependencies": {
  "gitlode": "^0.7.0"
}
```

Pre-1.0 caret semantics: `^0.7.0` is equivalent to `>=0.7.0 <0.8.0`. Each minor bump in the
pre-1.0 series may include breaking API changes, so the implicit upper bound at the next minor
version is the right default.

### Equivalent explicit form

`>=0.7.0 <0.8.0` is acceptable for authors who prefer to avoid pre-1.0 caret ambiguity.

### Lower bound

Set the lower bound to the lowest `gitlode` version the plugin author has actually validated
against. New plugins targeting the Phase 1 API floor declare at least `^0.7.0`.

### Multi-range syntax

Multi-range peer ranges (e.g. `^0.7.0 || ^0.8.0`) are permitted. The runtime uses
`semver.satisfies` and therefore supports any valid `node-semver` range.

### Bump cadence

- **Backward-compatible core API change**: plugin authors may widen their peer range.
- **Breaking core API change**: plugin authors must release a new version with an updated peer range.

---

## Runtime Compatibility Check

At startup, when `--config` is provided, `gitlode` reads the `peerDependencies.gitlode` range
from the nearest `package.json` of each plugin and compares it against the running core version:

| Condition                                         | Behavior                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Range satisfied                                   | No output; extraction proceeds normally.                                              |
| Range declared but not satisfied                  | Warning on stderr; extraction continues. Exit code remains `0`.                       |
| `peerDependencies.gitlode` absent                 | "Compatibility unknown" warning on stderr; extraction continues.                      |
| `package.json` missing, unreadable, or unparsable | "Compatibility check skipped" warning on stderr; extraction continues.                |

These warnings are always written to stderr and are **not suppressed by `--quiet`**.

The compatibility check is **warning-only**. There is no flag to escalate mismatches to errors.

---

## Namespace Guidance

The namespace key under `extensions` in the gitlode config file becomes the key in each output
record's `extensions` object. It identifies the plugin's output slot, not the plugin itself.

If you have no specific preference, using the plugin package's short name (the portion after
`@gitlode/plugin-`) as the namespace works well — for example,
`@gitlode/plugin-conventional-commits` → `conventional-commits`.

Choose a different name when:

- you register the same plugin under multiple namespaces with different `config` values, or
- you prefer a shorter or more domain-specific label in output records.

There is no functional advantage to one namespace choice over another.

---

## Module Contract

The exported default must be a `PluginFactory`:

```typescript
export default async function factory(config: unknown): Promise<ProjectorPlugin>;
```

The returned `ProjectorPlugin` must implement the contract defined in
`packages/gitlode/docs/design/plugins.md`. See that file for the full specification.

---

## Documentation Requirement

Each official plugin package must include:

- A `README.md` with a short description, installation instructions, configuration options,
  and a compatibility note referencing the `peerDependencies` range.
- A `CHANGELOG.md` following the project's release-history convention.

For the full normative specification, see
[`packages/gitlode/docs/design/plugins.md`](../../packages/gitlode/docs/design/plugins.md).
