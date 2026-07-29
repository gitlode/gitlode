# Package Split Plan

## Status

This document records the agreed direction and open implementation decisions for splitting selected
`packages/gitlode` source domains into private monorepo packages.

No package split has been implemented yet. The package topology in this document is accepted as the
planning baseline. Build, bundling, testing, versioning, and migration details remain to be decided.

This is a continuation document rather than a durable source of truth. As implementation decisions
become stable, migrate package and dependency contracts to `docs/design/`, update other affected
canonical documentation, and remove completed material from this document.

When continuing this work:

1. Preserve the accepted dependency direction and the contract-to-implementation boundary.
2. Record newly accepted decisions in this document when they are made.
3. Keep unresolved alternatives explicitly marked as open; do not present candidates as decisions.
4. Do not begin source movement until the development-build and release-bundle strategy is agreed.

Unless a path starts with `packages/`, it is relative to `packages/gitlode`.

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

The exact build and bundling mechanism is not yet decided.

## Build Strategy Candidates

The following candidates have been evaluated. None is accepted yet.

### Candidate A: TypeScript project builds plus a gitlode release bundle

Development:

- model each workspace as a TypeScript composite project;
- connect package dependencies with project references;
- use a solution `tsconfig.json` and `tsc -b` for ordered incremental builds;
- emit unbundled ESM, declarations, declaration maps, and source maps per private package;
- use `tsc -b -w` when cross-package runtime output must remain current.

Release:

- run a separate tsdown build only for the public `gitlode` package;
- bundle the private workspace packages into the public JavaScript and declaration outputs;
- keep selected public third-party runtime dependencies external;
- validate the packed result independently of the development outputs.

Characteristics:

- TypeScript remains the authority for type checking, declarations, project ordering, and package
  boundaries during development.
- Project references provide incremental ordered builds and editor source redirects without
  requiring a custom hot-deployment layer.
- Each private package produces conventional output that can support future independent
  publication.
- The release-only bundler has one focused responsibility: turn the private package graph into the
  public `gitlode` artifact.
- Development output and release output differ, so both require explicit validation.
- The public package must intentionally classify private workspaces as build-time bundle inputs or
  produce a release-specific manifest that removes them from runtime dependencies.

This is the current provisional recommendation.

References:

- [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references)
- [tsdown dependency handling](https://tsdown.dev/options/dependencies)
- [tsdown declaration generation](https://tsdown.dev/options/dts)

### Candidate B: tsdown for both workspace development and release

Development:

- use tsdown workspace mode;
- use unbundle mode for private package development outputs;
- use watch mode for rebuilding;
- generate declarations and package exports through tsdown.

Release:

- use a bundled tsdown configuration for `gitlode`.

Characteristics:

- one tool can cover transpilation, declarations, bundling, workspace discovery, cleaning, package
  export generation, publint, and `attw`.
- unbundle mode can preserve a source-like module layout for private packages.
- it is the most unified and forward-looking option.
- tsdown workspace mode is currently marked experimental.
- tsdown development exports rely on publish-time manifest overrides that npm does not support, so
  this repository cannot depend on that mechanism while it uses npm workspaces.
- declaration generation and workspace build ordering move away from the TypeScript compiler's
  native project-build model.
- adopting tsdown for every workspace expands the migration and tool-specific configuration
  surface before gitlode has demonstrated a need for it.

This remains a viable future simplification if workspace mode stabilizes or if a focused spike
shows clear benefits.

References:

- [tsdown unbundle mode](https://tsdown.dev/options/unbundle)
- [tsdown package exports and development exports](https://tsdown.dev/options/package-exports)
- [tsdown package validation](https://tsdown.dev/options/lint)

### Candidate C: TypeScript builds plus npm bundled dependencies

Development and release:

- use project references and unbundled TypeScript output;
- declare private workspace packages as dependencies of `gitlode`;
- include them in the published tarball through npm `bundleDependencies`;
- do not introduce a JavaScript bundler.

Characteristics:

- this is the smallest change from the current build.
- development and release execute substantially the same module graph.
- worker paths, dynamic plugin imports, and declaration imports remain structurally unchanged.
- the public tarball contains nested internal packages and their metadata rather than one integrated
  gitlode artifact.
- public declaration files may expose private package specifiers.
- package contents, transitive dependencies, duplication, and workspace symlink packing require
  careful tarball verification.
- the result preserves the internal deployment topology even though those packages are not intended
  as public install-time units.

This is a valid fallback but does not best match the accepted goal of private source packages
combined into one public application artifact.

Reference:

- [npm `bundleDependencies`](https://docs.npmjs.com/cli/configuring-npm/package-json/#bundledependencies)

### Candidate D: Direct Rolldown integration

Development and release:

- configure Rolldown directly for workspace resolution, bundling, watch mode, code splitting,
  externals, and entrypoint output;
- combine it with TypeScript or another declaration-generation step.

Characteristics:

- this provides maximum control and earliest access to Rolldown capabilities.
- it avoids wrapper limitations when gitlode needs specialized worker or chunk behavior.
- it requires gitlode to own declaration generation, package validation, dependency policy, and
  release-manifest integration that tsdown already coordinates.
- direct handling of `new URL("./worker-entry.js", import.meta.url)` still requires care; Rolldown
  does not automatically compile and bundle referenced JavaScript or TypeScript worker files as a
  worker graph.

This is not recommended unless a tsdown spike identifies a concrete blocker that requires direct
Rolldown configuration.

References:

- [Rolldown configuration](https://rolldown.rs/reference/)
- [Rolldown `new URL` asset behavior](https://rolldown.rs/reference/Interface.RolldownOptions)

## Provisional Recommendation

Prefer Candidate A:

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

This recommendation reflects the current development profile:

- contract and implementation changes are now usually independent;
- simultaneous contract and adapter edits still occur but do not require zero-build source
  hot-deployment;
- `tsc -b -w` is sufficient when live cross-package output is useful;
- conventional private-package outputs retain a straightforward path to future publication;
- tsdown is adopted where its modern bundling and package-validation features provide direct value,
  without depending on its experimental workspace orchestration.

The first implementation step should still be a build spike rather than a full migration. It must
prove:

- project-reference builds and watch rebuilds across the accepted package graph;
- tests against workspace package exports;
- a three-entry gitlode bundle for CLI, public plugin API, and worker;
- stable worker resolution;
- preserved dynamic plugin loading;
- one `GitAdapterError` runtime identity;
- no private package imports in public JavaScript or declarations;
- an installable clean tarball.

## Open Decisions

### 1. Development build and module-resolution model

Decide how private packages are type-checked, built, watched, and resolved during repository
development.

Questions include:

- whether to use TypeScript project references and `tsc -b`;
- whether each private package emits unbundled `dist` output;
- whether tests resolve workspace source or built package exports;
- how watch mode rebuilds dependents;
- how npm workspace script order is made deterministic;
- whether development and production exports differ.

This decision should precede source movement because it determines package manifests, tsconfig
structure, imports, test execution, and build order.

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

`tsdown` backed by Rolldown is the current leading candidate, but it has not been adopted. A focused
build spike should validate the required entrypoints and runtime behaviors before committing to it.

### 3. External dependency policy

Decide whether `diff` and `isomorphic-git` remain external runtime dependencies of the published
`gitlode` package or are included in its bundle.

If they remain external, decide how the public manifest receives the complete external dependency
closure even though source ownership moves to adapter packages.

### 4. Private package versioning and Changesets

Decide:

- whether private package versions advance;
- whether Changesets should use `privatePackages.version`;
- which changes require a `gitlode` changeset;
- how a change in bundled private code is represented in the public changelog;
- whether internal dependency ranges use exact versions or another repository convention.

An implementation change in a private adapter changes the public `gitlode` artifact, so the release
workflow must not treat it as publication-neutral.

### 5. Test ownership and integration coverage

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

### 6. Migration sequence

Decide whether to:

- establish package infrastructure and build tooling first;
- move foundation and contract domains before adapters;
- perform the split in one coordinated change or in buildable phases;
- temporarily support compatibility facades at old source paths.

Each intermediate state should build, test, and satisfy architecture checks. Avoid a migration plan
that requires weakening dependency rules or leaving two authoritative copies of a contract.

### 7. Durable documentation updates

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

Discuss the development-build and final-release-build architecture next.

The package graph is now accepted, but source movement cannot be planned safely until the following
distinction is explicit:

- **development artifacts:** how private workspaces reference, build, watch, and test one another;
- **release artifact:** how those private packages become one installable public `gitlode` package.

The next discussion should compare a small number of concrete build models and select one before
deciding the detailed migration sequence.

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
