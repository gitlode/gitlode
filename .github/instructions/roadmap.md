# gitrail — Feature Roadmap

This file records all planned improvements beyond the initial release: product features, CLI UX improvements, and development environment tasks.

Items are grouped by expected priority order within each section. Final ordering is subject to review.

This roadmap is intentionally organized by product priority and time horizon, not by release version. When an item is selected for a specific release, annotate it with lightweight metadata instead of moving it to a different section.

### Metadata Convention

Use the following fields on selected items when needed:

- **Release target**: the intended version, such as `v0.1.4`
- **Status**: one of `planned`, `in progress`, or `deferred`

The intended document flow is:

- roadmap → future-facing backlog and release targeting
- plan → active implementation tracking
- changelog → released history

Because completed work should move into the changelog after release, the roadmap does not need a persistent `done` status.

This keeps the roadmap stable for both humans and LLMs while still making release planning explicit.

---

## Product Improvements

### Near-term

#### Bug: `--help` argument list not displaying

**Release target**: `v0.1.4`  
**Status**: `planned`

`node dist/index.js --help` shows only the command name and description — argument definitions are not displayed.

**Root cause**: `src/index.ts` defines `main` via `defineCommand({ meta, run() {...} })` without an `args` property. The `argsDef` / `cmdDefinition` object lives in `src/cli/args.ts` but is never wired into `main`.

**Fix**: Import `cmdDefinition` from `src/cli/index.js` and spread it into the `defineCommand` call in `src/index.ts`:

```ts
import { cmdDefinition } from "./cli/index.js";

const main = defineCommand({
  ...cmdDefinition,   // brings in meta + args
  async run() { ... },
});
```

**Verification**: `node dist/index.js --help` lists all 9 parameters with descriptions and defaults.

---

#### CLI UX: Progress reporting and post-run summary

**Release target**: `v0.1.4`  
**Status**: `planned`

**Progress reporting during extraction**

Currently the CLI is completely silent during extraction. For large repositories this gives no feedback to the user.

- Display periodic progress to stderr (e.g. `\rProcessed N commits...` updated in-place every ~100 commits, flushed with `\n` at end)
- Always write progress to **stderr** — must not corrupt JSONL output if stdout is piped
- Add `--quiet` flag to suppress progress output (for CI / cron usage)
- Design options to evaluate: simple counter vs lightweight library (`cli-progress`, `ora`) — evaluate bundle size impact first

**Post-run summary**

After extraction completes, print to stderr:

- Number of commits written
- Number of output files created
- Total bytes written
- Elapsed wall-clock time
- Which branches were processed

**Implementation note**: `Extractor.run()` currently returns `void`. To surface summary data, change the return type to an `ExtractionResult` object (e.g. `{ commitsWritten, filesCreated, bytesWritten, branches }`). The CLI layer in `src/index.ts` formats and prints it to stderr.

---

#### CLI UX: `--help` option grouping and discoverability

The `--help` output lists all options in a flat list with no grouping. The jump from "I want incremental extraction" to "I need `--state`" is non-obvious.

- Group options under section headers: **Output**, **Differential Extraction**, **File Rotation**
- Add a note to the `--state` description: "Primary mechanism for scheduled/incremental runs"
- Evaluate whether citty supports option grouping natively; if not, consider a custom help renderer

---

### Medium-term

#### CLI spec: Explicit extraction mode and state ergonomics

**Problem A — implicit intent**: A user who always intends full extraction but accidentally passes `--state` pointing to an existing file will silently get differential output. There is no explicit intent signal.

**Problem B — no force-full flag**: If a user has been using `--state` for incremental runs but wants a one-time full re-extraction (e.g. schema change upstream), they must manually delete the state file.

**Problem C — state file path always manual**: The user must pass `--state ./somewhere/state.json` on every invocation. A natural default would be co-locating it with the output files.

**Problem D — missing-state behavior not configurable**: If the state file is deleted or corrupted mid-series, the next run silently falls back to full extraction. Downstream DWH consumers may receive duplicate records.

**Candidate improvements**:

- `--mode full|incremental` flag to make intent explicit; `full` ignores state file content but still updates it after the run
- `--state-dir <dir>` option that auto-derives the state filename from `<output-prefix>` (e.g. `<dir>/<prefix>.state.json`), reducing per-invocation configuration
- `--on-missing-state error|warn|full` flag to control behavior when state file is expected but absent
- Document explicitly in README: state file does not survive ephemeral CI workspaces; recommend artifact caching strategies

---

#### Correctness: Cross-run deduplication for newly added branches

When a branch is added to `--branch` in a subsequent run, its full traversal may output commits already extracted by a prior run via a different branch sharing history.

**Fix**: At run start, compute the merge base between the new branch and all branches already recorded in the state file. Use the merge base as `excludeHash` for the new branch's traversal.

- Requires `findMergeBase()` support in the Git Adapter
- Does not require storing all previously output hashes
- See `git-traversal.instructions.md` — "Future Work: Cross-Run Deduplication for New Branches"

---

#### Output: Configurable field inclusion/exclusion

- Add `--fields` or `--exclude-fields` CLI option
- Allows omitting PII fields such as `author.email`, `committer.email`
- Enables trimming output size for use cases that don't need all fields

---

### Long-term

#### Output: Repository metadata override

- Add `--repo-name` and `--repo-url` flags
- Override the auto-derived `repository.name` and `repository.url` fields in output
- Useful when remote origin is not set or when a canonical name is preferred

---

#### Output: Execution metadata line

- Optionally prepend a metadata line as the first record in each output file:
  ```json
  { "_meta": { "extractedAt": "2024-01-15T00:00:00Z", "extractorVersion": "1.2.0" } }
  ```
- Controlled by a `--meta` flag (off by default)

---

#### Output: Commit file diff stats

- For each commit, include an array of changed files with `path`, `status`, `additions`, `deletions`
- Made opt-in via `--include-files` flag (more expensive — requires tree comparison per commit)
- Implementation: requires `isomorphic-git`'s `walk()` API with tree diff

---

#### Output: File-level output mode

- New mode where each output record represents a single changed **file** within a commit (rather than the commit itself)
- Controlled by `--output-mode file` (default: `commit`)
- Depends on commit file diff stats being implemented first

---

#### Other future considerations

- **Additional rotation strategies**: by commit date (one file per month/year), by branch (one file per branch)
- **Ref pattern matching**: `--branch 'feature/*'` glob support (note: temporary branches introduce risk of capturing transient data — document trade-offs)
- **Streaming to stdout**: `--output -` to write to stdout for piping into other tools
- **Windows line endings**: `--line-ending crlf` flag (LF-only today; architecturally trivial to add)

---

## Development Environment Improvements

### Near-term

#### Fix: `eslint.config.js` deprecated config syntax

**Release target**: `v0.1.4`  
**Status**: `planned`

Current `eslint.config.js` uses a spread of `tseslint.configs.recommended` into `tseslint.config()`, which is marked as deprecated. Update to the current recommended flat config pattern when revisiting.

Check the `typescript-eslint` docs for the current idiomatic approach at that time.

---

#### Refactor: TypeScript `readonly` audit

All current interfaces and types (`RawCommit`, `GitAdapter`, `ExtractorConfig`, `RotationConfig`, `StateFile`, `OutputCommit`, etc.) are defined without `readonly` modifiers.

**Approach**:

1. Start with pure data/value types (interfaces used only as data carriers)
2. Mark all fields `readonly`
3. Work inward to classes/logic that construct or mutate them
4. Leave fields mutable only where there is a deliberate reason

Particularly: `RawCommit`, `OutputCommit`, `StateFile`, `ExtractorConfig` should be fully readonly. Collections used as read-only input (e.g. `branches: string[]`) should be `readonly string[]`.

---

### Long-term

#### Migrate to Node.js built-in TypeScript support

Node.js 22.6+ introduced `--experimental-strip-types` (stable in Node.js 23.6+ as `--strip-types`). This allows running `.ts` files directly without a separate `tsc` compile step.

**Current situation**: The project compiles with `tsc` → `dist/`; `package.json` `bin` points at compiled JS.

**Decision criteria**:

- Keep compiled-JS publishing for npm (broadest consumer compatibility)
- Add a `tsconfig.dev.json` for fast local iteration if needed
- Revisit seriously when Node.js ≥23 becomes the minimum LTS target
- Key changes when migrating: `"allowImportingTsExtensions": true`; remove `"js"` extensions from internal imports; separate `tsconfig.build.json` for publishing
