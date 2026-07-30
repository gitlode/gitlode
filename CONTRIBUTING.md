# Contributing to gitlode

## Prerequisites

- Node.js ≥ 22.0.0
- npm

## Setup

```bash
git clone https://github.com/gitlode/gitlode.git
cd gitlode
npm install
```

The repository uses npm workspaces. `npm install` at the root installs and links all packages.

## Build

```bash
# Incremental, unbundled workspace output
npm run build:dev

# Public release artifact
npm run build:release
```

## Test

```bash
npm test
```

Run in watch mode during development:

```bash
npm run test:watch
```

Optionally generate the combined local source coverage report:

```bash
npm run test:coverage
```

Build and validate the public package with publint and the installed-package system test:

```bash
npm run test:package
```

## Lint and Format

```bash
# Check for lint errors
npm run lint

# Format all files
npm run format:write

# Verify formatting (what CI runs)
npm run format:check
```

All commands above run from the repository root. TypeScript and Vitest use their project graphs
rather than npm workspace execution order. To run a workspace test independently, use its package
name, for example `npm test -w gitlode`.

See
[`packages/gitlode/docs/contributing/build-test-release.md`](packages/gitlode/docs/contributing/build-test-release.md)
for development/release artifact boundaries, package validation, and the complete release gate.

## Submitting Changes

- Open pull requests against the `develop` branch — do **not** target `main` directly
- All CI checks must pass before merge, including dependency, architecture, development build,
  source test, release build, packed metadata, and installed-package system checks

## Code Style

- TypeScript strict mode is enforced
- All code comments and documentation must be written in **English**
- Run `npm run format:write` before committing to avoid CI failures on `format:check`
