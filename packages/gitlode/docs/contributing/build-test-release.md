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

## Source tests and optional coverage

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

Test and coverage commands perform an incremental development build first. Coverage is an optional
local diagnostic and is not part of CI or the publish gate. For cross-workspace watching, run
`npm run build:watch` alongside the relevant test watch command.

## Release build

`npm run build:release` first builds the TypeScript solution, then bundles only the public
`gitlode` package with tsdown. Plugin packages retain their normal TypeScript output. Before tsdown
cleans `packages/gitlode/dist`, the release hook invalidates only
`.cache/tsc/gitlode.tsbuildinfo`.

tsdown is responsible only for producing the public release build. The release contains three ESM
runtime entries at stable paths:

- `dist/index.js`
- `dist/plugin-api.js`
- `dist/worker-entry.js`

Only `dist/index.d.ts` and `dist/plugin-api.d.ts` are public declarations. The four private
workspaces are bundled and their public-facing types are inlined; third-party runtime dependencies
stay external. Shared application code may be emitted as hashed chunks directly under `dist`.

Source maps remain enabled for the release build, but their contents and tsdown's internal output
layout are not custom release-validation contracts.

## Release package validation

```bash
npm run validate:publint -w gitlode
npm run test:system:package -w gitlode
npm run test:package
```

The standard `publint --strict --pack npm` command validates metadata from the package produced by
`npm pack`. The installed-package system test creates a tarball, installs it into a temporary
consumer outside the monorepo, and exercises the package from a user's perspective. It covers the
installed CLI, worker startup, both Git adapters, representative per-file line diff output, dynamic
plugin enrichment, the published configuration schema, and a NodeNext TypeScript consumer of
`gitlode/plugin-api`.

The system test treats successful CLI extraction as evidence that the runtime bundle and worker are
usable, and successful consumer compilation as evidence that public declarations have a valid
dependency closure. It does not inspect exact emitted file counts, chunk names, source-map contents,
or other tsdown-internal output structure.

## Dependency policy and complete validation

Every workspace owns the tools and packages used by its source, tests, configuration, and scripts.
Run Syncpack after manifest edits:

```bash
npm run syncpack:check
npm run syncpack:fix
```

`npm run validate:release` is the publish gate. Source validation checks dependency consistency,
formatting, lint, architecture, schema consistency, and source tests. Release validation then runs
the tsdown build, publint against `npm pack`, and the installed-package system test before Changesets
can publish. Coverage remains available through `npm run test:coverage`, but is not a CI or publish
gate.
