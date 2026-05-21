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

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

Run in watch mode during development:

```bash
npm run test:watch
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

## Submitting Changes

- Open pull requests against the `develop` branch — do **not** target `main` directly
- All CI checks must pass before merge: build, lint, format:check, and all unit tests

## Code Style

- TypeScript strict mode is enforced
- All code comments and documentation must be written in **English**
- Run `npm run format:write` before committing to avoid CI failures on `format:check`
