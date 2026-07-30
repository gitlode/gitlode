# Package Split Plan

## Status

Phase A infrastructure is implemented. The monolithic source layout is intentionally unchanged.
The repository now uses the root `tsconfig.json` project graph for development builds,
`packages/gitlode/tsdown.config.ts` for the public release bundle, root Vitest projects, Syncpack,
and explicit release and packed-artifact validation scripts. The release path invalidates only
`.cache/tsc/gitlode.tsbuildinfo`. Package metadata is embedded through
`src/package-metadata.ts` instead of being found relative to a generated chunk.

The planned private-package `noExternal` allowlist is not active because those packages do not yet
exist; Phase B must enable the four accepted package names when their workspaces are introduced.
No compatibility facade, paths alias, source export condition, or test-code typecheck was added.

The next implementation step is Phase B1's vertical slice. Test-code type checking remains a
separate deferred task.

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
  ├─ diagnostics
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

- `diagnostics`;
- `model`;
- `progress`;
- `extraction-api`;
- `git`;
- `line-diff`.

`diagnostics` belongs here because `extraction-api` uses the host-facing `DiagnosticReporter` in its
stage contracts. Leaving `diagnostics` in the `gitlode` package would create a package cycle:

```text
gitlode
  → @gitlode/internal-contracts
      → gitlode/diagnostics
```

`progress` no longer participates in `extraction-api` after diagnostics were separated from
progress reporting. It remains in `internal-contracts` because it is still
implementation-independent product vocabulary shared by extraction, execution, and presentation.
Keeping both host-facing reporting contracts in the contract package avoids making package
placement depend on their current set of consumers.

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

### Include `diagnostics` and `progress` in `internal-contracts`

`extraction-api` exposes the host-facing `DiagnosticReporter` in its stage contracts, so
`diagnostics` must be available without depending back on the `gitlode` application package.
`progress` is likewise implementation-independent product contract vocabulary even though it is no
longer referenced by `extraction-api`. Both belong in `internal-contracts`, not in the
product-neutral foundation package.

### Preserve domain boundaries with subpath exports

`internal-contracts` and `internal-foundation` must expose domain-specific subpaths. Intended usage
has this shape:

```typescript
import type { GitAdapter } from "@gitlode/internal-contracts/git";
import type { LineDiffCalculator } from "@gitlode/internal-contracts/line-diff";
import type { ExtractionCoordinator } from "@gitlode/internal-contracts/extraction";
import type { CommitOid } from "@gitlode/internal-contracts/model";
import type { DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
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

The host-facing `@gitlode/internal-contracts/diagnostics` contract is distinct from the public
plugin-author `DiagnosticReporter` exported by `gitlode/plugin-api`. The former reports structured
`Diagnostic` values through `report`; the latter exposes plugin-scoped `warn` and `error` methods.
Do not merge, alias, or substitute these contracts during the package split.

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

@gitlode/internal-contracts/diagnostics
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

## Accepted TypeScript Project Graph

Make every production workspace a TypeScript composite project. Project references follow the same
consumer-to-dependency direction as the accepted package graph:

```text
@gitlode/internal-foundation
  → no references

@gitlode/internal-contracts
  → @gitlode/internal-foundation

@gitlode/git-adapters
  → @gitlode/internal-foundation
  → @gitlode/internal-contracts

@gitlode/line-diff-adapters
  → @gitlode/internal-contracts

gitlode
  → all four private workspaces

each @gitlode/plugin-*
  → gitlode
```

Turn the root `tsconfig.json` into a solution project with an empty `files` array and references to
the four private packages, `gitlode`, and every plugin package. It does not extend
`tsconfig.base.json`. Keep the references listed in topological order for readability, while relying
on `tsc -b` to determine the actual build order.

Set `composite: true` in the shared compiler options. Keep NodeNext ESM, declarations, declaration
maps, and source maps. Each package explicitly sets `rootDir` to `src`, `outDir` to `dist`, includes
only production source, and declares its direct project references. Do not introduce `baseUrl`,
`paths`, source aliases, custom development export conditions, `emitDeclarationOnly`,
`isolatedDeclarations`, or `disableSourceOfProjectReferenceRedirect` as part of this split.

Development builds emit unbundled ESM and declarations to each package's `dist` directory so
runtime and TypeScript resolution exercise the accepted package export maps. Store incremental
metadata outside publishable output:

```text
.cache/tsc/<workspace-name>.tsbuildinfo
```

Ignore `.cache/` in Git. Use a distinct `tsBuildInfoFile` for every workspace.

Provide these development commands at the root and in relevant workspaces:

```text
build:dev    → tsc -b
build:watch  → tsc -b -w
build:clean  → tsc -b --clean
```

The root commands operate on the solution graph. A workspace command builds or watches that project
and its references. Do not use `npm run build --workspaces` as the development build orchestrator.
Reserve `build` for the final artifact of each workspace: it may delegate to `build:dev` for private
packages and plugins, while public `gitlode` uses the release bundle decided separately.

### Development test resolution

Package-owned unit tests import their own source relatively, including non-exported implementation
modules. Cross-package tests import only supported package exports, which resolve built `dist`
output. Test, test-watch, and coverage commands must perform an initial `build:dev` so they work from
a clean checkout. Repeated builds are incremental.

For changes contained within one package, Vitest watches that package's source directly. When
contracts and consumers are edited together, run the root `build:watch` process alongside the
relevant package's `test:watch` process. Do not add source-resolution aliases merely to make
cross-package watch mode implicit.

Keep test source out of production composite projects and out of `dist`. Decide whether to add
separate non-emitting test typecheck projects only after test ownership and integration placement
are settled.

Existing gitlode tests that import plugin source must not create a production project-reference
cycle:

```text
gitlode → plugin → gitlode
```

Move such coverage to a root-level or dedicated integration-test context that runs after production
projects are built and imports plugin package exports. The exact placement belongs to the later test
ownership decision.

Run the development solution build before schema scripts and tests in CI because source scripts and
cross-package imports resolve private package output from `dist`.

### Development and release output coexistence

The gitlode development compiler and public release bundler both use `packages/gitlode/dist`.
Release builds must clean that directory before writing bundled output and invalidate gitlode's
development `.tsbuildinfo`. Otherwise a later `tsc -b` could treat release-bundled files as current
development output. Define the exact clean sequence as part of the public release bundle.

## Accepted Public Release Bundle

Use tsdown, backed by Rolldown, only for the public `gitlode` release artifact. Development builds
remain unbundled TypeScript project-reference builds.

### Build inputs and entrypoints

Run the TypeScript solution build before tsdown. The release bundle must resolve private packages
through their built `dist` output and official package exports, never through source aliases.

Use explicit entrypoint names:

- `index` from `src/index.ts`;
- `plugin-api` from `src/plugin-api.ts`;
- `worker-entry` from `src/execution/worker-entry.ts`.

Emit the stable runtime paths `dist/index.js`, `dist/plugin-api.js`, and `dist/worker-entry.js`.
`worker-entry` is a runtime asset and must not be exposed through the public package exports.

### JavaScript output

Produce ESM for Node.js, targeting the package's `engines.node` floor. Enable tree-shaking and
source maps, keep minification disabled, and do not produce CJS, IIFE, UMD, SEA, or compatibility
shims.

Keep automatic code splitting enabled. All entry files and shared chunks must remain directly under
`dist`, using entry names such as `[name].js` and chunk names such as `[name]-[hash].js`. This is
required because `new URL("./worker-entry.js", import.meta.url)` can execute from a shared chunk;
placing shared chunks in a nested directory would change that relative URL. The packed-artifact
integration test must launch the worker and therefore verify this invariant.

### Dependency bundling policy

Use explicit allowlists rather than relying only on package-manifest inference:

- always bundle and permit bundling only for `@gitlode/internal-foundation`,
  `@gitlode/internal-contracts`, `@gitlode/git-adapters`, and
  `@gitlode/line-diff-adapters`;
- keep `chalk`, `commander`, `diff`, `isomorphic-git`, `semver`, and `zod` as external runtime
  imports;
- permit Node.js built-ins as external imports;
- bundle private-package types into public declarations while keeping public dependency types
  external.

Dynamic user-plugin imports such as `import(resolvedSpecifier)` must remain runtime imports and must
be covered by the packed-artifact tests.

The private workspace packages remain in `gitlode`'s `devDependencies` in the published manifest.
No publish-time manifest rewrite is added solely to remove them.

### Bundle-safe package metadata

The current relative runtime lookup of `../../package.json` is not safe after bundling. During the
implementation, introduce a shared bundle-safe package-metadata module, based on a JSON import of
the package manifest, and have both the CLI and compatibility checker consume its exported version.

### Declaration output

Generate bundled declarations only for the public `index` and `plugin-api` entrypoints. Do not
publish declarations for `worker-entry`, and fail validation if a private package specifier remains
in public declaration output.

Use the TypeScript declaration resolver without a separate declaration build inside tsdown. A
release-specific TypeScript configuration may disable `composite`, `incremental`, and declaration
maps. Public declaration maps remain disabled because the published artifact does not contain the
corresponding source files; development declaration maps remain available in private workspace
output.

Keep the package's exports and bin mappings explicit in `package.json`; do not generate them from
the tsdown configuration. Preserve the existing root export, plugin API export, CLI bin, and CLI
shebang.

### Cleaning and cache invalidation

The release order is:

1. build the TypeScript project graph;
2. invalidate only `gitlode`'s `.cache/tsc/gitlode.tsbuildinfo`;
3. let tsdown clean and rebuild `packages/gitlode/dist`;
4. validate the output and packed artifact.

Keep private-package `dist` output and their build caches because they are release-bundle inputs.
Implement the targeted invalidation with a small cross-platform script or build hook, not a broad
cache deletion.

### Release validation

Add `publint` and `@arethetypeswrong/core` as `gitlode` development dependencies. Treat tsdown
configuration warnings as errors and run Are the Types Wrong in ESM-only mode.

Validate both emitted files and an actual `npm pack` tarball. Checks must cover:

- the three stable JavaScript entry files, their source maps, the expected declarations, and the
  absence of stale development output;
- the absence of private package imports from emitted JavaScript and declarations;
- allowed external runtime imports and successful resolution from a declaration consumer;
- installation of the tarball outside the monorepo;
- CLI help and version, the CLI shebang, both Git adapters, line-diff behavior, schemas, worker
  execution, dynamic plugin loading and compatibility checks, plugin API TypeScript consumption,
  and usable source maps;
- the absence of any runtime requirement for unpublished private packages.

Before migrating the full source tree, perform a focused build spike that proves private-package
bundling, public dependency externalization, declaration inlining, worker resolution from a common
chunk, dynamic plugin loading, bundle-safe version access, shebang and exports preservation, clean
output, and tarball installation.

## Accepted Test Ownership and Integration Coverage

Use three test layers:

1. workspace-owned tests for domain and package-local component behavior;
2. `gitlode` tests for application composition and integration behavior;
3. packed-artifact tests for the public release and bundle boundary.

### Workspace ownership

Move tests with the production code they verify:

- `support`, `instrumentation`, and `dag` tests move to `@gitlode/internal-foundation`;
- `model` runtime tests and Git contract error tests move to `@gitlode/internal-contracts`;
- all `git-impl` tests move to `@gitlode/git-adapters`;
- `@gitlode/line-diff-adapters` gains focused tests for `JsLineDiffCalculator`;
- extraction, execution, CLI, state, output, presentation, plugin runtime, plugin API, and
  application-entrypoint tests remain in `gitlode`.

Do not create nominal runtime tests for type-only contracts. Production compilation verifies those
contracts, including `diagnostics`; runtime guards and error classes continue to receive runtime
tests.

Tests may import their own workspace source through relative paths. Cross-workspace test imports
must use official package exports and must never reach into another workspace's `src`, `test`, or
unexported subpaths. Test helpers remain private to tests and must not be added to production export
maps. Rev-dep must check these rules for test code as well as production code.

Move `test/support/commit-dag.ts` to test support owned by `@gitlode/git-adapters`, because it uses
Git adapter dependencies and Git contract types. Make foundation DAG fixtures domain-neutral so
foundation tests do not introduce a reverse dependency on contracts. Do not create a shared
test-utility package unless stable cross-package fixture sharing later demonstrates a concrete need.

### Line-diff and application boundaries

Move line-diff algorithm semantics out of extraction tests and into focused
`@gitlode/line-diff-adapters` tests. Extraction tests should normally inject a fake
`LineDiffCalculator` and verify invocation policy and result handling. Verify the real adapter's
application wiring with a representative packed-artifact scenario rather than duplicating the
adapter's semantic test matrix.

Update CLI entrypoint tests to mock official package specifiers such as `@gitlode/git-adapters` and
`@gitlode/line-diff-adapters`, not their former source-relative modules. Do not require a broader
dependency-injection refactor solely for this split.

Worker-client behavior remains covered by source-level `gitlode` tests. Actual worker-thread startup
and its bundled relative path are verified by the packed-artifact suite.

Plugin lifecycle, dynamic loading, and plugin API type tests remain owned by `gitlode`. Existing
plugin workspace builds and tests continue to act as real consumers of `gitlode/plugin-api`.

### Vitest orchestration and coverage

Keep a `vitest.config.ts` and test scripts in every test-owning workspace, so each workspace remains
independently testable. Add a root Vitest configuration using Vitest 4 `projects` to run and watch
all workspace projects in one process. Give every project a unique package-based name and use
`defineProject` for project configurations.

Run normal root tests only after `build:dev`, because cross-workspace tests resolve official exports
from dependency `dist` output. Keep TypeScript build watch and root Vitest watch as separate
development processes.

Produce combined monorepo coverage from the root projects configuration. Include production source
from all workspaces, but do not add new uniform coverage thresholds as part of the package split.
Type-only contract packages and implementation packages do not have equivalent runtime coverage
profiles; package-specific thresholds may be introduced later if justified.

### Packed-artifact test ownership

Keep packed-artifact validation separate from normal source tests:

```text
test
  → build:dev
  → source tests for all Vitest projects

test:package
  → build:release
  → npm pack
  → install and test outside the monorepo
```

`test:package` is owned by `gitlode` and is required by CI and release validation, but it need not
run on every local unit-test invocation. It verifies representative cross-boundary paths rather than
repeating detailed domain test matrices. Its accepted scenarios are defined in the public release
bundle section above.

### Deferred test-code type checking

Do not make test-code type checking part of the package-split implementation or completion
criteria. Vitest continues to transpile and execute TypeScript tests, while production composite
projects continue to exclude tests.

After the package split is complete and stable, handle the following as a separate deferred task:

- add a `tsconfig.test.json` and `typecheck:test` script to each test-owning workspace;
- inventory and fix existing test-code type errors;
- orchestrate test type checking from the root;
- make the check mandatory in CI only after every workspace passes.

This deferred work does not relax the package import, dependency ownership, Rev-dep, or runtime test
requirements accepted for the split.

## Accepted Migration Sequence

Use two coordinated review units:

1. a prerequisite build, release, and test-infrastructure change that does not move source domains;
2. one coordinated package-split change, organized into reviewable and verifiable commits.

Do not merge a long sequence of partially split product architectures into the main branch. The
source-migration commits should remain independently buildable where practical, but the coordinated
split is merged only after the final package graph, release artifact, tests, enforcement, and
durable documentation are complete.

### Phase A: build and release infrastructure

Before moving any domain, establish and validate:

- TypeScript project-reference infrastructure, root solution orchestration, development build
  scripts, `.cache/tsc`, and targeted cache invalidation;
- the tsdown release bundle over the current monolithic source tree, including the accepted
  entrypoints, output layout, source maps, shebang, package metadata access, exports, and worker
  path;
- `publint`, Are the Types Wrong, emitted-output checks, `npm pack`, and installation outside the
  monorepo;
- root Vitest 4 `projects` orchestration;
- workspace-owned development dependencies, Syncpack enforcement, and the Rev-dep transition to
  `includeDevDepsFromRoot: false`;
- Changesets configuration capable of excluding private packages from versioning and tagging.

This phase resolves release risks that do not require private packages. Because it changes how the
published `gitlode` artifact is built, include a patch changeset for `gitlode`.

### Phase B1: private-package vertical slice

Begin the coordinated source migration with:

```text
type-utils
  → @gitlode/internal-foundation/type-utils

model
  → @gitlode/internal-contracts/model
```

This slice must prove the final private-package mechanism before the wider move:

- private runtime code is bundled into `gitlode`;
- private types are inlined into public plugin API declarations;
- development resolution uses built package exports and project references;
- public runtime dependencies remain external;
- worker and common-chunk placement remains valid;
- the packed tarball installs and runs without private packages being available.

Stop the wider source migration if this spike does not validate all required behaviors.

### Phase B2: complete foundation

Move `support`, `instrumentation`, and `dag` into `@gitlode/internal-foundation`. Move their tests at
the same time, make foundation DAG fixtures domain-neutral, update every consumer to official
foundation subpaths, update Rev-dep, and delete the old source directories.

### Phase B3: complete contracts

After foundation is complete, move `diagnostics`, `progress`, `extraction-api`, `git`, and
`line-diff` into `@gitlode/internal-contracts`. Map the source `extraction-api` domain to the package
export `@gitlode/internal-contracts/extraction`.

Update all application and plugin API imports, move contract runtime tests, update dependency
enforcement, and revalidate the bundled public declarations before moving implementations. The
declaration check must reject private diagnostics specifiers while preserving the distinct public
plugin API diagnostic reporter contract.

### Phase B4: move adapters

Move the smaller line-diff implementation first:

```text
line-diff-impl
  → @gitlode/line-diff-adapters
```

Add focused `JsLineDiffCalculator` tests, replace its direct use in extraction tests with a fake,
update execution composition, and validate the packed integration path.

Then move the more complex Git implementation:

```text
git-impl
  → @gitlode/git-adapters
```

Move both adapters, commit-traversal code, adapter tests, `commit-dag.ts`, and `memfs` ownership
together. Update execution composition, CLI package mocks, the experimental subpath export, and the
packed tests for both Git implementations.

### No compatibility facades or duplicate ownership

Do not leave re-export facades at old `packages/gitlode/src` paths. For each domain, move its source
and tests, update every consumer, and delete its old directory in the same logical commit.

At every intermediate step:

- a domain has exactly one authoritative location;
- contracts are never copied or declared twice;
- only already-migrated package subpaths may be exported;
- TypeScript `paths`, development-only export conditions, and source aliases remain forbidden;
- tests cannot reach across a workspace boundary into source or test internals.

Use file moves where practical to preserve history, and separate mechanical moves from later
content edits when that materially improves reviewability.

### Manifest and enforcement updates

When a workspace or subpath first becomes real, update its complete supporting graph in the same
logical commit:

- root workspaces and TypeScript references;
- package manifests, dependencies, exports, scripts, README, and Vitest project;
- the root lockfile;
- Syncpack and Changesets configuration;
- Rev-dep package and domain rules.

Private packages remain at `0.0.0` and outside Changesets versioning. Later private implementation
changes require a `gitlode` changeset only when they alter the public artifact or observable
behavior.

### Validation gates

Every migration stage must pass:

- formatting and linting;
- architecture checks;
- the development build;
- schema validation;
- all source tests.

From the first private-package vertical slice onward, every stage must also pass:

- the release build;
- `publint` and Are the Types Wrong;
- emitted-output and private-specifier checks;
- the packed-artifact suite and installation outside the monorepo.

The final validation must start from clean generated output and cover dependency installation, the
complete development graph, all workspace tests and coverage, the release bundle, tarball
installation, CLI, worker, both Git adapters, line-diff, plugin loading, and Changesets status.
Deferred test-code type checking is not part of these migration gates.

### Durable documentation and handoff cleanup

Phase A updates only durable build, release, and contributor documentation affected by its actual
tooling changes. The coordinated source-migration change updates the durable design documents to
the final package layout, including:

- `docs/design/domain-design.md`;
- `docs/design/architecture.md`;
- Git adapter and traversal design documents;
- plugin documentation that describes source or package locations;
- contributor build, test, and release documentation.

Do not document transient vertical-slice states as durable design. Update user-facing documentation
only if installation, packaging, CLI behavior, or plugin-author workflows change observably.

At completion, move the deferred test-code type-checking task into a focused follow-up handoff or
issue. Once every stable package-split decision exists in durable documentation and no other split
work remains, delete this package-split handoff.

## Recommended Next Step

The planning baseline is complete. The next step, when implementation is authorized, is Phase A:
establish and validate the build, release, and test infrastructure without moving source domains.

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
