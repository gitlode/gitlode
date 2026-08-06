# Build, Test, and Release Validation

## Purpose and scope

This document is the canonical contributor guide for TypeScript projects, development builds,
source tests, release bundling, package validation, and publish gates. Run commands from the
repository root unless a workspace command is shown.

The logical software architecture is defined in
[`../design/architecture.md`](../design/architecture.md). Domain ownership, package dependencies,
and official package exports are defined in
[`../design/domain-design.md`](../design/domain-design.md). This document explains how those
packages are built and assembled; it does not grant source dependencies or redefine their domain
boundaries.

## Build model overview

The monorepo deliberately has two build forms:

| Build form  | Purpose                    | Shape                                                                           |
| ----------- | -------------------------- | ------------------------------------------------------------------------------- |
| Development | Repository development     | Every workspace emits independently consumable, unbundled TypeScript output.    |
| Release     | Public `gitlode` packaging | Private workspaces are bundled into `gitlode`; plugin packages remain separate. |

This distinction lets repository packages enforce ownership during development without making the
private packages consumer dependencies or public compatibility contracts.

## Development build

All production workspaces are TypeScript composite projects. The root `tsconfig.json` is a solution
project, and project references determine build order:

1. private foundation and contract workspaces;
2. private adapter workspaces;
3. the public `gitlode` workspace; and
4. plugin workspaces.

```bash
npm run build:dev
npm run build:watch
npm run build:clean
```

Development builds emit unbundled NodeNext ESM, declarations, declaration maps, and source maps
into each workspace's `dist` directory. Incremental metadata is stored under `.cache/tsc/` rather
than published output. Cross-workspace imports use official package specifiers and resolve the
referenced workspace's built exports, so a clean solution build must start at the root and allow
TypeScript project references to build dependencies first.

`npm run build:watch` watches the complete solution. Use it alongside a test watch command when a
change crosses workspace boundaries.

### Tooling and editor TypeScript project

The root solution also references `packages/gitlode/tsconfig.tooling.json`. This non-emitting
project owns gitlode's tests, scripts, and package-level TypeScript configuration files. It ensures
that editors use the repository's Node.js types and compiler settings instead of assigning those
files to an inferred project.

The tooling project currently uses `noCheck`. Repository-wide test-code type checking remains a
separately deferred migration because existing test fixtures require additional typing work.
Production projects continue to perform full type checking. `noCheck` is therefore an explicit
scope boundary for tooling code, not a relaxation of production compilation.

## Source tests

The root Vitest configuration runs every workspace project in one process:

```bash
npm test
npm run test:watch
```

Each test-owning workspace keeps a `vitest.config.ts` and can run independently, for example:

```bash
npm test -w gitlode
```

Normal test commands perform an incremental development build first. The root watch command does
not rebuild cross-workspace output continuously; run `npm run build:watch` alongside it when the
code under test spans workspace boundaries.

### Optional coverage

```bash
npm run test:coverage
```

Coverage is a local diagnostic. It is not collected by CI and is not part of the publish gate.
Coverage configuration and dependencies remain available so targeted measurement can be performed
when it is useful.

## Release build and bundling

```bash
npm run build:release
```

The release command first completes the TypeScript solution, then runs tsdown for the public
`gitlode` package. Plugin packages retain their normal TypeScript output. tsdown bundles
`@gitlode/internal-foundation`, `@gitlode/internal-contracts`, `@gitlode/git-adapters`, and
`@gitlode/line-diff-adapters`, including public-facing types from those packages. Third-party
runtime dependencies such as `diff` and `isomorphic-git` remain external and are declared by the
public package.

The public release contains three ESM runtime entries at stable paths:

- `dist/index.js`
- `dist/plugin-api.js`
- `dist/worker-entry.js`

Only `dist/index.d.ts` and `dist/plugin-api.d.ts` are public declarations. The worker entry is a
runtime asset located relative to the release bundle, not a package export. Shared application code
may be emitted as hashed chunks directly under `dist`.

Development TypeScript and tsdown both write `packages/gitlode/dist`, but the output represents
different build forms. Before tsdown cleans that directory, the release hook invalidates only
`.cache/tsc/gitlode.tsbuildinfo`. A later `tsc -b` must therefore rebuild gitlode's unbundled
development output rather than mistake the release bundle for current TypeScript output, while
unrelated workspace build caches remain valid.

Source maps remain enabled for release builds. Their embedded content, exact file count, chunk
names, and other tsdown-internal layout details are not custom release contracts.

## Installed-package validation

```bash
npm run validate:publint -w gitlode
npm run test:system:package -w gitlode
npm run test:package
```

Release validation deliberately separates responsibilities:

- tsdown produces the runtime and declaration bundle;
- `publint --strict --pack npm` validates metadata from the package produced by `npm pack`; and
- the installed-package system test validates representative product behavior from a consumer's
  perspective.

The system test creates an npm tarball, installs it into a temporary consumer outside the
monorepo, and exercises the installed CLI and worker. It covers both Git adapters, representative
per-file line-diff output, dynamic plugin enrichment, the published configuration schema, and a
NodeNext TypeScript consumer of `gitlode/plugin-api`.

Successful installed extraction is evidence that the runtime bundle and worker can operate, and
successful consumer compilation is evidence that public declarations have a valid dependency
closure. The test does not duplicate tsdown's own tests by asserting exact chunks, source-map
contents, or other incidental output structure.

`npm run test:package` builds the release before running both metadata and installed-package
validation. The individual commands are useful when the release output has already been built.

## Architecture, schemas, and dependency maintenance

Architecture checks operate on built private-package exports as well as source domains, so the root
command performs a development build first:

```bash
npm run architecture:check
npm run schema:check -w gitlode
```

Every workspace declares the production and development dependencies used by its source, tests,
configuration, and scripts. Common dependency versions should remain aligned unless a deliberate,
documented incompatibility requires otherwise. The four private packages remain pinned to
`0.0.0`. Syncpack checks these repository conventions:

```bash
npm run syncpack:check
npm run syncpack:fix
```

Package manifests define dependency ownership. The Rev-dep configuration verifies that imports do
not rely on undeclared root development dependencies, while the domain rules documented in
`domain-design.md` constrain which declared dependencies may actually be used.

## CI and publish gate

CI runs source validation and then exercises the release pipeline as explicit steps: development
build, generated-artifact checks, source tests, release build, packed metadata validation, and the
installed-package system test. Coverage is intentionally absent.

```bash
npm run validate:release
```

`validate:release` is the complete local and publish gate. It checks dependency consistency,
formatting, lint, architecture, generated schema consistency, and source tests before building the
release and running publint and the installed-package system test. The release workflow runs this
gate before Changesets publishes packages.

Use the narrower commands while developing, but use `validate:release` when assessing whether the
repository is ready to publish.
