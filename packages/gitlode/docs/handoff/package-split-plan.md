# Package Split Plan

## Status

This document records the agreed direction and open implementation decisions for splitting selected
`packages/gitlode` source domains into private monorepo packages.

No package split has been implemented yet. The package topology and high-level build strategy in
this document are accepted as the planning baseline. The private package manifest policy and export
boundaries and dependency classification are also accepted. Detailed TypeScript project
configuration, bundling, testing, and migration steps remain to be decided.

This is a continuation document rather than a durable source of truth. As implementation decisions
become stable, migrate package and dependency contracts to `docs/design/`, update other affected
canonical documentation, and remove completed material from this document.

When continuing this work:

1. Preserve the accepted dependency direction and the contract-to-implementation boundary.
2. Record newly accepted decisions in this document when they are made.
3. Keep the remaining work visible as a section-level outline, but do not preserve every rejected
   alternative or the full discussion history.
4. Do not present candidates as accepted decisions.

Unless a path starts with `packages/`, it is relative to `packages/gitlode`.

## Documentation Policy

Use this handoff document to record:

- decisions accepted during package-split planning;
- constraints that future implementation must preserve;
- the section-level outline of remaining planning and implementation work;
- deferred tasks that still require continuation context.

Do not record every candidate, comparison, or intermediate argument from planning discussions.
Rejected alternatives belong in chat history unless they contain exceptional information needed to
resume the work safely.

Do not update durable documents under `docs/design/` merely because a future package design has been
accepted in planning. Those documents describe the current source tree and implemented behavior.
Update them together with the corresponding source and package changes during implementation.

When the package split is complete, all stable package and dependency design must live in the
appropriate durable design documents. Delete this handoff document unless unfinished or deferred
work still requires it.

## Motivation

The initial extraction candidates are `git-impl` and `line-diff-impl`.

They are suitable package boundaries because:

- each implements an explicit implementation-independent contract (`git` and `line-diff`);
- neither depends on the `extraction` implementation;
- `extraction` depends only on their contracts;
- only the `execution` composition domain selects and constructs the concrete implementations;
- each implementation domain owns a closed product capability rather than domain-neutral helper
  code;
- `git-impl` already contains multiple adapters, and additional line-diff implementations are
  plausible;
- independent package-level build and test boundaries can reduce unintended effects on the gitlode
  application while these implementations evolve.

The new packages will initially remain private monorepo packages. Their purpose is source,
dependency, build, and test isolation inside this repository, not independent publication. A future
need may justify publishing or further splitting them, but that is not part of the initial work.

## Accepted Package Topology

Adopt the following package layout:

```text
@gitlode/internal-foundation
  ├─ type-utils
  ├─ support
  ├─ instrumentation
  └─ dag

@gitlode/internal-contracts
  ├─ model
  ├─ progress
  ├─ extraction-api
  ├─ git
  └─ line-diff

@gitlode/git-adapters
  └─ git-impl

@gitlode/line-diff-adapters
  └─ line-diff-impl

gitlode
  ├─ extraction
  ├─ execution
  ├─ CLI / config / output / state / presentation
  └─ plugin API / plugin runtime
```

Package boundaries do not replace source-domain boundaries. Multiple domains may live in one
package while retaining separate charters, dependency allowlists, and supported barrels.

### `@gitlode/internal-foundation`

Purpose:

> Own product-neutral types, runtime utilities, instrumentation facilities, and generic graph
> algorithms shared across private packages.

It contains:

- `type-utils`;
- `support`;
- `instrumentation`;
- `dag`.

It must not become a general location for gitlode product policy. Existing domain charters continue
to govern what each subpath may contain.

### `@gitlode/internal-contracts`

Purpose:

> Own implementation-independent product vocabulary and ports shared between the gitlode
> application, extraction policy, adapters, persistence, output, and plugin-facing facades.

It contains:

- `model`;
- `progress`;
- `extraction-api`;
- `git`;
- `line-diff`.

`progress` belongs here because `extraction-api` uses `ProgressReporter` in its stage contracts.
Leaving `progress` in the `gitlode` package would create a package cycle:

```text
gitlode
  → @gitlode/internal-contracts
      → gitlode/progress
```

The package must not acquire extraction implementations, adapter implementations, persistence I/O,
output implementations, plugin hosting, CLI/configuration behavior, or product-neutral helpers.

### `@gitlode/git-adapters`

Purpose:

> Own concrete implementations of the Git repository access contract and their backend-specific
> resources, parsing, traversal selection, and dependencies.

It contains the current `git-impl` domain, including:

- `IsomorphicGitAdapter`;
- `GitCliAdapter`;
- Git CLI parsing and process protocols;
- Git-specific commit traversal strategy selection and scheduling policy.

It may depend on the Git and model contract subpaths and the explicitly allowed foundation
subpaths. It must not depend on `extraction-api` or any gitlode application implementation.

### `@gitlode/line-diff-adapters`

Purpose:

> Own concrete implementations of the line-diff calculation contract and their
> implementation-specific external dependencies.

It initially contains `JsLineDiffCalculator` and its dependency on `diff`. It may depend on the
line-diff contract subpath but must not depend on extraction policy or Git repository semantics.

### `gitlode`

The public `gitlode` package remains the application, composition, and publication boundary. It
keeps:

- extraction policy and coordination;
- execution and worker orchestration;
- CLI and configuration;
- state persistence;
- JSONL output;
- presentation;
- the public `gitlode/plugin-api` facade;
- plugin hosting.

`execution` remains the composition root that selects adapters and injects them into extraction.

## Accepted Dependency Direction

The intended package graph is acyclic:

```text
@gitlode/internal-foundation
              ↑
@gitlode/internal-contracts
              ↑
     ┌────────┴───────────┐
     │                    │
@gitlode/git-adapters  @gitlode/line-diff-adapters
     ↑                    ↑
     └──────── gitlode ───┘
```

The complete direct relationships are:

```text
@gitlode/internal-contracts
  → @gitlode/internal-foundation

@gitlode/git-adapters
  → @gitlode/internal-contracts/git
  → @gitlode/internal-contracts/model
  → @gitlode/internal-foundation/dag
  → @gitlode/internal-foundation/instrumentation
  → @gitlode/internal-foundation/support

@gitlode/line-diff-adapters
  → @gitlode/internal-contracts/line-diff

gitlode
  → @gitlode/internal-contracts
  → @gitlode/internal-foundation
  → @gitlode/git-adapters
  → @gitlode/line-diff-adapters
```

These lines summarize package-level reachability. Source-domain rules remain narrower. A package
dependency does not grant every domain in the consuming package access to every exported subpath.

## Accepted Boundary Conditions

The split must satisfy all of the following conditions.

### Include `progress` in `internal-contracts`

`extraction-api` currently exposes `ProgressReporter` in traversal and extraction stage ports.
`progress` is product-specific contract vocabulary, so it belongs in `internal-contracts`, not in
the product-neutral foundation package.

### Preserve domain boundaries with subpath exports

`internal-contracts` and `internal-foundation` must expose domain-specific subpaths. Intended usage
has this shape:

```typescript
import type { GitAdapter } from "@gitlode/internal-contracts/git";
import type { LineDiffCalculator } from "@gitlode/internal-contracts/line-diff";
import type { ExtractionCoordinator } from "@gitlode/internal-contracts/extraction";
import type { CommitOid } from "@gitlode/internal-contracts/model";
import type { ProgressReporter } from "@gitlode/internal-contracts/progress";
import type { Instrumentation } from "@gitlode/internal-foundation/instrumentation";
```

Do not provide a broad convenience barrel that allows consumers to bypass these domain-specific
dependency envelopes. Prefer omitting the package-root `"."` export unless a concrete consumer
requires a coherent root contract.

Rev-dep must continue to enforce source-domain allowlists across package boundaries, including:

- contract domains never depending on adapter packages;
- `git-adapters` not depending on `extraction-api`;
- `line-diff-adapters` not depending on Git or extraction domains;
- cross-domain imports using supported subpath barrels rather than internal modules.

### Avoid duplicated contract runtime code

Adapter development builds must refer to the shared contract package rather than bundling private
copies of contract runtime modules.

This is required in particular for `GitAdapterError`. The application and adapters must observe the
same constructor identity so checks such as the following remain reliable:

```typescript
error instanceof GitAdapterError;
```

The same rule protects shared runtime constants and guards. The final public `gitlode` artifact may
bundle the package graph once, but intermediate adapter builds must not each embed their own copy of
contract runtime code.

## Public API and Publication Constraints

The new workspace packages are private and are not new public gitlode APIs.

The final published `gitlode` package must:

- remain installable without access to unpublished `@gitlode/internal-*` or adapter packages;
- contain or otherwise resolve all runtime code required by the private packages;
- expose the existing CLI and `gitlode/plugin-api` entrypoints;
- preserve the worker entrypoint required by `new URL("./worker-entry.js", import.meta.url)`;
- preserve runtime plugin loading through dynamic `import()`;
- emit public declaration files that do not refer to unavailable private package specifiers;
- preserve one runtime identity for shared errors and other contract values.

`gitlode/plugin-api` currently exposes or refers to extraction facts and records, `CommitOid`,
instrumentation types, and generic branded types. Its declaration output therefore crosses both
new private foundation packages. The release build must bundle or rewrite these type dependencies
so plugin authors only need the public `gitlode` package.

## Accepted Build Strategy

Use TypeScript project references for development package builds and use tsdown only for the public
`gitlode` release bundle:

```text
Development package build
  TypeScript project references
  tsc -b / tsc -b -w
  unbundled ESM + declarations per workspace

Public release build
  tsdown applied to gitlode only
  private workspaces bundled
  approved public runtime dependencies externalized
  public declarations bundled
```

Development requirements:

- model each workspace as a TypeScript composite project;
- connect package dependencies with project references;
- provide a solution `tsconfig.json` and use `tsc -b` for ordered incremental builds;
- emit unbundled ESM, declarations, declaration maps, and source maps per private package;
- support `tsc -b -w` when cross-package runtime output must remain current;
- keep each private package's development output structurally suitable for future independent
  publication.

Release requirements:

- apply tsdown to the public `gitlode` package rather than using its workspace mode to build every
  package;
- bundle private workspace packages into the public JavaScript and declaration outputs;
- keep approved public third-party runtime dependencies external unless separately decided;
- preserve the CLI, public plugin API, and worker entrypoints;
- validate the packed release independently of development outputs.

The development and release artifacts intentionally differ and both require explicit validation.
The detailed output directories, dependency classification, project configuration, and tsdown
configuration remain open.

## Accepted Private Package Manifest Policy

Use the following package directories and names:

| Directory                      | Package name                   |
| ------------------------------ | ------------------------------ |
| `packages/internal-foundation` | `@gitlode/internal-foundation` |
| `packages/internal-contracts`  | `@gitlode/internal-contracts`  |
| `packages/git-adapters`        | `@gitlode/git-adapters`        |
| `packages/line-diff-adapters`  | `@gitlode/line-diff-adapters`  |

Add each directory explicitly to the root npm `workspaces` array rather than replacing the current
explicit list with a wildcard.

All four packages must:

- set `"private": true`;
- use the fixed private version `"0.0.0"`;
- set `"type": "module"`;
- require Node.js 22 or later;
- include only `dist` through the `files` field;
- set `"sideEffects": false`;
- use the repository's existing homepage, MIT license, and repository metadata;
- use the existing workspace script names for build, watch, format, lint, and test operations;
- omit `publishConfig` and publish scripts while private;
- omit discoverability keywords until publication is planned.

Use these descriptions:

| Package                        | Description                                                         |
| ------------------------------ | ------------------------------------------------------------------- |
| `@gitlode/internal-foundation` | `Private shared foundations for gitlode packages`                   |
| `@gitlode/internal-contracts`  | `Private implementation-independent contracts for gitlode packages` |
| `@gitlode/git-adapters`        | `Private Git adapter implementations for gitlode`                   |
| `@gitlode/line-diff-adapters`  | `Private line-diff adapter implementations for gitlode`             |

Each package must contain a short README even while private. It does not need to be a complete
public-package guide. It must:

- identify the package as a private implementation detail of the gitlode monorepo;
- direct readers to the main gitlode README or the most relevant durable design document;
- avoid presenting the package as independently supported or installable.

Configure Changesets not to version or tag private packages:

```json
{
  "privatePackages": {
    "version": false,
    "tag": false
  }
}
```

Changes to bundled private code use a `gitlode` changeset when they affect the public artifact or
observable behavior. Private package versions do not advance. If a package is published in the
future, remove `private`, choose its initial public version, add publication documentation and
metadata, and bring it into normal Changesets management at that time.

## Accepted Export Boundaries

`internal-foundation` and `internal-contracts` must not provide package-root `"."` exports. They
expose only these explicit domain subpaths:

```text
@gitlode/internal-foundation/type-utils
@gitlode/internal-foundation/support
@gitlode/internal-foundation/instrumentation
@gitlode/internal-foundation/dag

@gitlode/internal-contracts/model
@gitlode/internal-contracts/progress
@gitlode/internal-contracts/extraction
@gitlode/internal-contracts/git
@gitlode/internal-contracts/line-diff
```

The `extraction` package subpath maps to the existing `extraction-api` source domain. Package
exports must use explicit entries with the `types` condition before the `default` condition. Apply
the same form to type-only domains so all supported entrypoints have consistent ESM and declaration
resolution.

Both adapter packages provide cohesive package-root exports:

```text
@gitlode/git-adapters
@gitlode/line-diff-adapters
```

The Git adapter root exports the concrete adapter constructors and the dependency types required to
construct them. This includes making `GitCliAdapterDependencies` exportable alongside
`IsomorphicGitAdapterDependencies`.

Git commit-traversal selection is an explicitly unstable configuration surface and is exported
separately:

```text
@gitlode/git-adapters/experimental
```

This subpath contains the traversal environment constant, strategy creation and name-resolution
functions, and the related strategy types required by their declarations. The exact closure of
supporting types must be verified during migration.

Do not add implementation-specific Git adapter subpaths at this stage. Reconsider them if future
independent publication creates a concrete need to separate dependency or module-loading
boundaries.

All packages must follow these export rules:

- use explicit export-map entries rather than wildcard exports;
- export built ESM and declarations, never source files;
- do not export `package.json`, tests, or generic `internal` entrypoints;
- do not introduce development-only export conditions;
- require cross-package imports to use supported package exports;
- prohibit relative imports into another package's `src` or `dist`;
- allow same-package domains to use relative imports through the target domain barrel;
- allow package-owned unit tests to import their internal source modules relatively;
- require cross-package and integration tests to use supported package exports.

## Accepted Dependency Classification

Private workspace packages declare every direct package edge in `dependencies`, including edges
required only by emitted declarations:

- `@gitlode/internal-foundation`: no direct dependencies;
- `@gitlode/internal-contracts`: `@gitlode/internal-foundation`;
- `@gitlode/git-adapters`: `@gitlode/internal-contracts`, `@gitlode/internal-foundation`, and
  `isomorphic-git`;
- `@gitlode/line-diff-adapters`: `@gitlode/internal-contracts` and `diff`.

Use the exact `"0.0.0"` specifier for dependencies on private workspace packages. Do not use the
`workspace:`, `file:`, or wildcard protocols.

The `gitlode` workspace declares all four private packages in `devDependencies`. They are
development and release-build inputs because their code is bundled into the public artifact. Their
entries may remain in the published manifest's `devDependencies`; do not add a release-only
manifest rewrite merely to remove them. Validation must instead prove that private packages do not
appear in production, peer, optional, or npm bundle dependency fields and are not required by
published JavaScript or declarations.

Keep all current third-party runtime packages external to the public tsdown bundle:

```text
chalk
commander
diff
isomorphic-git
semver
zod
```

Consequently, `diff` and `isomorphic-git` remain direct `gitlode` production dependencies as well as
dependencies of their owning adapter workspaces. The duplicate manifest entries describe the
runtime closure of two different artifacts and must use the same version specifier. Node built-ins
are always external.

Do not introduce `peerDependencies`, `optionalDependencies`, or npm `bundleDependencies` for the
private packages at this stage. Reconsider contract peer dependencies only if an adapter package is
independently published. Reconsider bundling third-party packages only when measurements or a
concrete distribution requirement justify it.

### Development dependency ownership

Every workspace must declare:

- packages imported by its source, tests, and configuration;
- ambient type packages required by its TypeScript project;
- tools directly invoked by its scripts;
- package-specific build and test helpers.

Apply this policy to `gitlode`, every existing plugin, and every new private workspace. Shared
dependency versions do not imply root ownership. The root package owns only tools directly used by
root-level repository workflows. A tool may correctly appear in both root and workspace manifests
when both directly invoke it.

This policy includes:

- `vitest` in every workspace whose tests or Vitest configuration import it;
- `@vitest/coverage-v8` in every workspace that provides the coverage script;
- `typescript`, `oxlint`, and `oxfmt` in workspaces whose scripts invoke them;
- `@types/node` in projects that inherit the Node type requirement;
- `tsx` and tsdown in `gitlode` when its scripts invoke them;
- `memfs` in whichever workspace owns tests that import it after test migration.

After this audit, set Rev-dep's `nodeModulesResolution.includeDevDepsFromRoot` to `false`.
`missingNodeModulesDetection` and `unresolvedImportsDetection` must then enforce that each workspace
declares its own imported development dependencies.

### Repository-wide version consistency

The same dependency must use the same version number and semver range in every workspace and
dependency field. No package-specific version exceptions are currently permitted.

Adopt Syncpack as a root-owned repository tool:

- use `syncpack lint` as a CI check for manifest version consistency;
- use `syncpack fix` to apply the accepted policy;
- use caret ranges for normal registry dependencies;
- use exact `"0.0.0"` for private workspace dependencies;
- keep `vitest` and `@vitest/coverage-v8` on the same version through a Syncpack dependency group;
- update shared dependencies repository-wide and regenerate the root lockfile.

Do not use npm `overrides` for normal direct-dependency synchronization. Reserve overrides for a
specific transitive compatibility or security constraint. If different direct versions ever become
necessary, add a documented Syncpack policy rather than an ad hoc ignore.

Manifest presence and source permission remain separate concerns. A dependency listed for final
release resolution does not grant every source domain permission to import it. Rev-dep must continue
to enforce the narrower domain ownership of `isomorphic-git`, `diff`, and private package subpaths.

## Open Decisions

### 1. TypeScript project graph

Decide:

- project-reference edges and the solution `tsconfig.json` structure;
- development output and `.tsbuildinfo` locations;
- package-level build, watch, and clean commands;
- whether gitlode tests resolve source or built workspace exports;
- how architecture checks map package imports back to domain allowlists.

### 2. Public release bundle

Decide how the public `gitlode` artifact incorporates private workspace packages.

The design must cover:

- the CLI entrypoint;
- the public plugin API entrypoint and declaration bundle;
- the worker entrypoint and its stable relative path;
- dynamic plugin imports;
- source maps and stack traces;
- externalization or bundling of `diff` and `isomorphic-git`;
- removal of unpublished private dependencies from the published manifest;
- clean output and tarball validation.

Use tsdown backed by Rolldown for this release bundle. A focused build spike must validate the
required entrypoints and runtime behaviors before the full source migration.

### 3. Test ownership and integration coverage

Decide which tests move with each domain and which remain application-level integration tests.

Known affected areas include:

- `test/git-impl`;
- line-diff implementation use in extraction tests;
- `test/support/commit-dag.ts`;
- CLI tests that mock source-relative adapter modules;
- worker tests;
- plugin loading and plugin API type tests.

The final validation strategy should include installing the packed `gitlode` tarball into a clean
temporary project and exercising the CLI, worker, both Git adapters, and plugin loading.

### 4. Migration sequence

Decide whether to:

- establish package infrastructure and build tooling first;
- move foundation and contract domains before adapters;
- perform the split in one coordinated change or in buildable phases;
- temporarily support compatibility facades at old source paths.

Each intermediate state should build, test, and satisfy architecture checks. Avoid a migration plan
that requires weakening dependency rules or leaving two authoritative copies of a contract.

### 5. Durable documentation updates

Implementation will require coordinated updates to at least:

- `docs/design/domain-design.md`;
- `docs/design/architecture.md`;
- Git traversal and adapter design documents;
- plugin design documentation where source/package locations are described;
- the root Rev-dep configuration;
- contributor or release documentation if build and Changesets workflows change.

User-facing documentation should change only if installation, packaging, CLI behavior, or plugin
author workflows change observably.

## Recommended Next Discussion

Define the TypeScript project-reference graph, development output layout, and workspace-level build
and watch commands. This must make the accepted package graph incrementally buildable without
source-path aliases or duplicated runtime modules.

## Completion Criteria

The package-split work is complete only when:

- the accepted packages exist and are private;
- the package and source-domain graphs are acyclic and enforced;
- private packages build and test independently;
- the `gitlode` application composes adapters only through contracts;
- no public artifact or declaration requires an unpublished private package;
- CLI, worker, both Git adapters, line-diff calculation, and plugin loading pass integration tests;
- a clean packed tarball installs and runs outside the monorepo;
- release and Changesets behavior is explicit and tested;
- stable package design is migrated to canonical design documentation;
- this handoff document contains no remaining unfinished work and is deleted.
