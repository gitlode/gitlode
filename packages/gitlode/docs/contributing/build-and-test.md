# Build and test workflows

Use `npm run build:dev` for an incremental project-reference build and `npm run build:watch` while
working across workspaces. `npm run build:clean` removes TypeScript outputs and build information.
These unbundled artifacts are development output, not release packages.

Run all Vitest projects with `npm test`, watch them with `npm run test:watch`, and collect repository
coverage with `npm run test:coverage`. A package can still run its own Vitest configuration from its
workspace.

`npm run build:release` first builds the TypeScript graph, invalidates only gitlode's build cache,
then creates and validates the public tsdown bundle. `npm run test:package` installs an `npm pack`
tarball in an operating-system temporary directory and tests the installed boundary. Maintainers
must run `npm run release:validate` before publishing. Dependency ranges are checked separately by
`npm run deps:check`.
