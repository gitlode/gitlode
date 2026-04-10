# gitrail — Project Build-out Plan

## Overview

8 phases total. Each phase ends with a verification checkpoint — implementation pauses for review and sign-off before moving to the next phase.

Existing dependencies in `package.json` are provisional and can be reconsidered during implementation if there is good reason.

## Tooling Decisions

| Concern       | Choice                           |
| ------------- | -------------------------------- |
| CLI framework | citty (keep as-is)               |
| Git library   | isomorphic-git (fixed by design) |
| Testing       | Vitest (ESM-native)              |
| Linting       | ESLint v9 + typescript-eslint    |
| Formatting    | oxfmt (keep as-is)               |

---

## Phase 0: Project Tooling Setup ✅

_Configure all developer tooling. No source code changes._

### Status: Complete

- ✅ Vitest added (`devDependencies`), `test`/`test:watch` scripts added
- ✅ `.gitignore` — all needed entries present
- ✅ `eslint` (v10), `typescript-eslint` (v8) added to `devDependencies`
- ✅ `eslint.config.js` — flat config, `tseslint.configs.recommended`, applies to `src/**/*.ts`
- ✅ `vitest.config.ts` — Node environment, `tests/**/*.test.ts`
- ✅ `lint` / `lint:fix` scripts added to `package.json`

### Verification

- ✅ `npm run build` — no regressions
- ✅ `npm run lint` — passes on all files in `src/`
- ✅ `npm test` — 3/3 tests pass
- ✅ `npm run fmt:check` — passes (required one `npm run fmt` pass to fix a pre-existing issue in `src/core/index.ts`)

---

## Phase 1: Scaffold & Shared Types ✅

_All shared TypeScript interfaces and types. No logic._

### Status

Done (completed in previous session, ahead of schedule).

- ✅ `src/git/index.ts` — `GitAdapter`, `RawCommit`, `RawPerson extends PersonIdentity`
- ✅ `src/git/errors.ts` — `GitAdapterError`, `GitAdapterErrorCode`
- ✅ `src/core/index.ts` — `ExtractorConfig`, `ExtractionRange`, `RotationConfig`, `StateFile`, `StateBranchEntry`, `PersonIdentity`
- ✅ `src/output/index.ts` — `OutputCommit`, `OutputPerson`, `OutputRepository`
- ✅ `src/cli/index.ts` — empty placeholder
- ✅ `tests/git-adapter-error.test.ts` — 3 smoke tests for `GitAdapterError`; all pass

### Notable design decisions

- `PersonIdentity` lives in `core` as the shared base for `RawPerson` (git layer) and `OutputPerson` (output layer)
- All anonymous inline shapes were given explicit names (`ExtractionRange`, `StateBranchEntry`, `OutputRepository`, etc.)

---

## Phase 2: Git Adapter Layer (`src/git/`) ✅

_Concrete isomorphic-git adapter: ref resolution, remote URL, BFS commit walk with exclusion._

### Status: Complete

- ✅ `src/git/isomorphic-git-adapter.ts` — `resolveRef`, `getRemoteUrl`, `walkCommits` (BFS + `_collectReachable` exclusion); constructor accepts optional `FsClient` for DI (defaults to `node:fs`)
- ✅ `src/git/index.ts` — re-exports `IsomorphicGitAdapter`
- ✅ `test/git/isomorphic-git-adapter.test.ts` — 6 tests using fully in-memory repos via `memfs`; full traversal, exclusion boundary, merge DAG, remote URL cases
- ✅ `memfs` added as devDependency

### Refactoring performed (not originally in plan)

- **Type definitions separated**: all interfaces/types moved from `index.ts` to `types.ts` in each layer (`src/git/types.ts`, `src/core/types.ts`, `src/output/types.ts`); `index.ts` files are re-export-only
- **`FsClient` typed properly**: replaced `any` with `import type { FsClient } from "isomorphic-git"`; `node:fs` cast via `as FsClient`
- **Test directory restructured**: `tests/` renamed to `test/`; src-mirror layout (`test/git/`); `vitest.config.ts` `include` updated to `test/**/*.test.ts`
- **`tsconfig.json`**: added `"types": ["node"]` for `node:` protocol imports under TypeScript 6

### Verification

- ✅ `npm run build` — 0 errors
- ✅ `npm run lint` — 0 errors
- ✅ `npm test` — 9/9 pass (3 errors + 6 adapter tests)
- ✅ `npm run fmt:check` — clean

---

## Phase 3: Output Layer (`src/output/`) ✅

_JSONL serialization, ISO 8601 timestamp conversion, file rotation._

### Status: Complete

- ✅ `src/output/utils.ts` — `toISO8601()` (negated-offset algorithm), `splitMessage()`
- ✅ `src/output/writer.ts` — `OutputWriter` class; `{prefix}-000001.jsonl`; post-write rotation on `maxLines`/`maxBytes`; LF-only; byte counting via `Buffer.byteLength`
- ✅ `src/output/index.ts` — re-exports from `utils.ts` and `writer.ts`
- ✅ `test/output/utils.test.ts` — 8 tests (JST, UTC, negative offset, `splitMessage` cases)
- ✅ `test/output/writer.test.ts` — 6 tests (no rotation, line rotation, byte rotation, both thresholds, valid JSONL, LF-only)

### Verification

- ✅ `npm run build` — 0 errors
- ✅ `npm run lint` — 0 errors
- ✅ `npm test` — 23/23 pass (3 + 6 git + 8 utils + 6 writer)
- ✅ `npm run fmt:check` — clean

---

## Phase 4: Core Logic Layer (`src/core/`) ✅

_Orchestration, differential filtering, output mapping, atomic state file management._

### Status: Complete

- ✅ `src/core/extractor.ts` — `Extractor` class with full implementation
- ✅ `src/core/index.ts` — re-exports `Extractor`
- ✅ `test/core/extractor.test.ts` — 7 tests covering all required scenarios

### Implementation notes

- State file `ENOENT` → silent full extraction; any other read/parse error → rethrow
- `excludeHash` logic: `range.type === "commit"` → use hash; `range.type === "date"` → no excludeHash (filter per-commit); state map → use `lastCommitHash`; none → full extraction
- `--since-date` uses `continue` (not `break`) — correct for BFS across non-chronological merge branches
- `COMMIT_NOT_FOUND` on stale `lastCommitHash` → `stderr` warning + fallback to full extraction, preserving `visited` set
- `writer.close()` in `finally` — always runs; state file written only in success path
- Atomic state write: `.tmp` → `rename`; `path.resolve()` applied to both paths before comparison

### Verification

- ✅ `npm run build` — 0 errors
- ✅ `npm run lint` — 0 errors
- ✅ `npm test` — 30/30 pass (23 prior + 7 extractor)
- ✅ `npm run fmt:check` — clean

---

## Phase 5: CLI Layer + End-to-End Wiring (`src/cli/`) 🔲

_Wire all layers through citty, implement all validation, complete `src/index.ts`._

### Steps

1. `src/cli/args.ts`:
   - Parse all 9 parameters
   - Enforce 3 mutual-exclusion rules
   - All validation rules from `cli.instructions.md`
   - `--output-prefix` derivation via `getRemoteUrl()` fallback chain
   - Build and return `ExtractorConfig`
2. `src/cli/index.ts` — barrel export
3. Update `src/index.ts` — replace citty stub with full CLI → `Extractor` delegation; exit codes 0/1/2
4. Integration test: full run + incremental run against a real repo

### Verification

- [ ] `node dist/index.js --help` — usage displayed correctly
- [ ] Smoke tests: full, incremental, rotation

---

## Phase 6: GitHub Actions CI/CD 🔲

_Automate quality checks on every PR; publish to npm on release tag._

### Status

- ✅ `.github/workflows/ci.yml` — triggers on push/PR; jobs: build, test, fmt:check; Node 22
- ❌ Lint step missing from CI (ESLint not yet set up — will be added after Phase 0 completes)
- ❌ `.github/workflows/release.yml` — not yet created

### Remaining Steps

1. Add `lint` step to `ci.yml` after Phase 0 ESLint setup is done
2. `.github/workflows/release.yml`:
   - Trigger: push of `v*` tag
   - Jobs: build → `npm publish` (uses `NODE_AUTH_TOKEN` secret)

### Verification

- [ ] Test PR: all CI jobs (including lint) pass on GitHub

---

## Phase 7: OSS Documentation 🔲

_Minimum viable documentation for a public CLI project._

### Steps

1. `README.md` — description, install, quick-start, full CLI reference, output schema overview, incremental extraction example
2. `CONTRIBUTING.md` — local build, run tests, submit PRs
3. `CHANGELOG.md` — initial v0.1.0 entry (or GitHub Releases only — decide at writing time)
4. `.github/ISSUE_TEMPLATE/` (optional) — bug report, feature request templates
5. Verify `LICENSE` is correct (already present)

### Verification

- [ ] README renders correctly on GitHub
- [ ] All command examples match actual CLI output

---

## Final End-to-End Checklist

- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm run lint` — zero ESLint warnings/errors
- [ ] `npm test` — all unit tests pass
- [ ] `node dist/index.js --branch main ./` — full extraction; produces `gitrail-000001.jsonl`
- [ ] Re-run with `--state state.json` — no new output; state file updated
- [ ] New commit → re-run with `--state` — only new commit in output
- [ ] `--rotate-lines 2` — produces `gitrail-000001.jsonl`, `gitrail-000002.jsonl`, …
- [ ] CI workflow passes on GitHub PR
