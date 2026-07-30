# Build, Test, and Release Validation

This document defines the contributor workflow for development builds, source tests, and release
artifact validation. Run commands from the repository root unless a workspace command is shown.

## Development build

All production workspaces are TypeScript composite projects. The root `tsconfig.json` is a solution
project, and TypeScript project references determine build order.

```bash
npm run build:dev
npm run build:watch
npm run build:clean
```

Development builds emit unbundled ESM, declarations, declaration maps, and source maps into each
workspace's `dist` directory. Incremental metadata is stored under `.cache/tsc/`. The output is for
repository development and is not the public `gitlode` release artifact.

The production graph builds in dependency order from the private foundation and contract
workspaces, through the private adapter workspaces, into `gitlode`, and finally the plugin
workspaces. Cross-workspace development imports resolve official package exports from built output.

## Source tests and coverage

The root Vitest configuration runs every workspace project in one process:

```bash
npm test
npm run test:watch
npm run test:coverage
```

Each test-owning workspace keeps a `vitest.config.ts` and can run independently, for example:

```bash
npm test -w gitlode
```

Test and coverage commands perform an incremental development build first. For cross-workspace
watching, run `npm run build:watch` alongside the relevant test watch command.

## Release build

`npm run build:release` first builds the TypeScript solution, then bundles only the public
`gitlode` package with tsdown. Plugin packages retain their normal TypeScript output. Before tsdown
cleans `packages/gitlode/dist`, the release hook invalidates only
`.cache/tsc/gitlode.tsbuildinfo`.

The release contains three ESM runtime entries at stable paths:

- `dist/index.js`
- `dist/plugin-api.js`
- `dist/worker-entry.js`

Only `dist/index.d.ts` and `dist/plugin-api.d.ts` are public declarations. The four private
workspaces are bundled and their public-facing types are inlined; third-party runtime dependencies
stay external. Shared application code may be emitted as hashed chunks directly under `dist`.

The `plugin-api.js` entry is intentionally runtime-empty because the current plugin API exports only
types. Rolldown therefore does not emit a meaningless source map for that empty file. Executable
entries and shared chunks have source maps.

## Package validation

```bash
npm run validate:package -w gitlode
npm run test:package
```

Package validation checks the emitted file set, imports, declarations, exports, bin mapping,
shebang, publint, and Are the Types Wrong in ESM-only mode. The packed-artifact test creates an npm
tarball, installs it under the operating system's temporary directory outside the monorepo, and
tests only the installed artifact. It covers CLI help/version, schemas, both Git adapters,
representative line diff extraction, worker startup, dynamic plugin loading, compatibility
diagnostics, source maps, and a TypeScript consumer of `gitlode/plugin-api`.

## Dependency policy and complete validation

Every workspace owns the tools and packages used by its source, tests, configuration, and scripts.
Run Syncpack after manifest edits:

```bash
npm run syncpack:check
npm run syncpack:fix
```

`npm run validate:release` is the publish gate. It checks dependency consistency, formatting, lint,
architecture, schema generation, source tests, coverage, the release bundle, package metadata, and
the installed tarball before Changesets can publish.
