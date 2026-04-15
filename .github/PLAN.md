# gitrail — v0.2.0 Release Plan

## Overview

This plan covers the release following v0.1.4.
The target version is **v0.2.0**.

v0.2.0 is the first release with a deliberate minor-version increment. As this project is still pre-1.0.0, this release may introduce breaking changes to the CLI interface. All such changes will be documented in the changelog.

The primary focus is on stabilizing the CLI contract early — particularly around how users specify extraction intent and manage state files — and on cleaning up the architecture before the codebase grows further.

## Release Goals

- Establish a stable, explicit CLI interface for extraction modes and state management
- Prevent accidental data overwrites caused by repeated runs in the same output directory
- Improve cross-session correctness when users add new branches over time
- Reduce architecture coupling in the core layer to improve testability and future feature velocity
- Improve help discoverability for new users

## Scope Summary

### Included in v0.2.0

- Refactor the extractor boundary to move runtime concerns (stderr, timing, state I/O) behind explicit abstractions
- Apply `readonly` modifiers across all pure data interfaces and types
- Add execution-time uniqueness to rotated output filenames to prevent overwrite across sessions
- Introduce explicit extraction mode (`--mode snapshot|incremental`), rename `--since-commit` to `--since-ref`, add `--on-missing-state`, and add shorthand aliases for all major flags
- Add merge-base-based cross-run deduplication when new branches are added across sessions
- Group `--help` output by category for better discoverability
- Update all human-oriented documentation (`docs/`, README, changelog, and migration notes) to reflect the complete v0.2.0 changes

### Explicitly excluded from v0.2.0

- Progress metrics redesign and phase-level observability
- Configurable field inclusion or exclusion
- All long-term output, schema, and streaming features

---

## Phase 1: Explicit Extraction Mode and State Ergonomics

_Replace implicit extraction mode detection with an explicit `--mode snapshot|incremental` flag, rename `--since-commit` to `--since-ref` to accept any Git ref (commit hash, tag, or branch name), introduce `--on-missing-state` to control behavior when the expected state file is absent, and add shorthand aliases (`-m`, `-b`, `-o`, `-s`, `-q`) for all major flags._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

### Design References

- [`instructions/cli.instructions.md`](instructions/cli.instructions.md) — full parameter reference, mutual exclusion rules, validation phases, usage examples
- [`instructions/git-traversal.instructions.md`](instructions/git-traversal.instructions.md) — Traversal Algorithm (Snapshot Mode / Incremental Mode), State File Management (role per mode, HEAD recording semantics)
- Roadmap item: "CLI spec: Explicit extraction mode and state ergonomics"

### Design Decisions

- **`--mode snapshot|incremental`**: default is `snapshot`. `snapshot` extracts independently of prior state; `incremental` reads state to determine the commit boundary. The presence of `--state` alone no longer implies incremental mode — this is a breaking change from v0.1.x behavior.
- **`--since-commit` renamed to `--since-ref`**: accepts commit hash, tag name, or branch name. Resolved via `resolveRef()`. The internal `ExtractionRange` type field changes from `type: "commit"` to `type: "ref"`. This is a breaking CLI change.
- **`--on-missing-state error|snapshot`**: default is `error`. Only valid with `--mode incremental`. `snapshot` emits a warning to stderr and falls back to full extraction, then creates the state file on success.
- **`--state` + `--since-ref` is permitted in snapshot mode**: `--state` serves only as a recording path for the current HEAD; `--since-ref` controls the extraction range independently. This deliberately reverses the prior mutual exclusion between `--state` and `--since-*`.
- **Shorthand aliases via citty `alias` property**: `-m` (--mode), `-o` (--output-dir), `-s` (--state), `-q` (--quiet). The `-b` alias for `--branch` must be handled in the existing `process.argv` manual scan loop, not via citty, because citty does not preserve repeated occurrences.
- **Validation is 3-phase**: (1) format/mutual-exclusion — no I/O; (2) filesystem — repository path, output dir, and state parent directory (new check); (3) Git — ref resolution for each `--branch` and `--since-ref`. All phases complete before any extraction begins.
- **`ExtractorConfig` gains `mode` and `onMissingState` fields**: `mode: "snapshot" | "incremental"`. `onMissingState?: "error" | "snapshot"` (relevant only in incremental mode). `Extractor.run()` uses `mode` to decide whether to read state content.
- **New runtime dependencies**: none.

### Non-Goals

- `--state-dir` (automatic state file path derivation) — deferred to a future release
- Help output grouping — Phase 6
- Cross-run deduplication for newly added branches — Phase 5
- Changes to output format, JSON schema, or `OutputWriter`

### Target Files

| File                              | Action | Notes                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/cli/args.ts`                 | Modify | Rename `since-commit` → `since-ref` in `argsDef`; add `mode` arg with alias `-m`; add `on-missing-state` arg; add aliases `-o`, `-s`, `-q`; extend `-b` manual scan; rewrite mutual exclusion (5 rules replacing 2); add state parent directory existence check (filesystem validation step); replace `--since-commit` walkCommits validation with `resolveRef()` for `--since-ref`; update `ExtractorConfig` population |
| `src/core/types.ts`               | Modify | `ExtractionRange`: rename `type: "commit"` → `type: "ref"`; add `mode: "snapshot" \| "incremental"` to `ExtractorConfig`; add `onMissingState?: "error" \| "snapshot"` to `ExtractorConfig`                                                                                                                                                                                                                              |
| `src/core/extractor.ts`           | Modify | Guard state-reading block with `this.config.mode === "incremental"`; implement `--on-missing-state snapshot` fallback (warn + full traversal) and `error` (exit 1) when state file is absent in incremental mode; update `ExtractionRange` type check from `"commit"` → `"ref"`                                                                                                                                          |
| `test/cli/args.test.ts`           | Modify | Add tests for `--mode`, `--since-ref`, `--on-missing-state`, aliases `-m`/`-b`/`-o`/`-s`/`-q`; update mutual exclusion tests (5 new, remove 2 old); add state parent dir filesystem validation test; update `--since-commit` test to expect unknown-flag error                                                                                                                                                           |
| `test/cli/cmd-definition.test.ts` | Modify | Reflect renamed arg `since-ref` and new args `mode`, `on-missing-state` in command definition assertions                                                                                                                                                                                                                                                                                                                 |
| `test/core/extractor.test.ts`     | Modify | Add tests: snapshot mode ignores state content; incremental mode reads state; `--on-missing-state snapshot` fallback emits warning and performs full traversal; `--on-missing-state error` (enforced in `args.ts`, not `Extractor`) — confirm `Extractor` does not need to re-validate                                                                                                                                   |

### Implementation Notes

- The existing `process.argv` manual scan loop collects `--branch` and `--branch=`; it must also collect `-b` followed by a non-flag value. Add that case alongside the existing `--branch` cases.
- The prior state-reading block in `Extractor.run()` silently skips to full extraction on `ENOENT`. With the new design, this behavior moves to `args.ts` (for the `--on-missing-state` decision) and the `ENOENT` path in `Extractor` should become unreachable in incremental mode. The snapshot-mode path should skip state-reading entirely.
- The old `--since-commit` validation called `walkCommits()` to verify the hash existed. Replace this with a single `resolveRef()` call for `--since-ref` — if it throws `REF_NOT_FOUND`, emit `Ref not found: <ref>` and exit 1.
- The old mutual exclusion `--state && (sinceCommit || sinceDate)` → error must be removed. Review `args.test.ts` for tests that assert this behavior and update them to assert the opposite (permitted in snapshot mode).

### Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks:**

- `gitrail -b main ./repo` — snapshot mode (default), no state, exits 0
- `gitrail --mode snapshot -b main -s ./state.json ./repo` — snapshot; creates/overwrites state file; prior state content is not used
- `gitrail --mode incremental -b main -s ./state.json ./repo` (state exists) — reads state, differential extraction, exits 0
- `gitrail --mode incremental -b main -s ./state.json ./repo` (state missing, default `--on-missing-state error`) — exits 1 with message `State file not found: <path>`
- `gitrail -m incremental -b main -s ./state.json --on-missing-state snapshot ./repo` (state missing) — emits warning to stderr, performs full extraction, creates state file, exits 0
- `gitrail -b main --since-ref v1.0 ./repo` — snapshot from tag boundary, exits 0
- `gitrail -b main --since-ref v1.0 -s ./state.json ./repo` — snapshot from tag, records HEAD in state file (not tag hash)
- `gitrail -m incremental -b main -s ./state.json --since-ref v1.0 ./repo` — exits 1: `--since-ref cannot be used with --mode incremental`
- `gitrail --mode incremental -b main ./repo` (no `--state`) — exits 1: `--state is required when using --mode incremental`
- `gitrail --since-commit abc123 ./repo` — citty unknown-arg error (confirm `--since-commit` is no longer recognized)

---

## Phase 2: Output Filename Uniqueness Across Sessions

_Replace the `prefix` parameter in `OutputWriter` with a `filenameFor: (seq: number) => string` callback, and generate that callback in `Extractor.run()` using an execution timestamp, so each session writes to a unique filename series and cannot overwrite prior results._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

### Design References

- Roadmap item: "Output: Prevent overwrite across extraction sessions"

### Design Decisions

- **Filename format**: `{prefix}-{timestamp}-{seq}.jsonl` — session groups are contiguous in lexicographic sort order, and the timestamp serves as a secondary operational record of when the output was produced.
- **Timestamp format**: `YYYYMMDDTHHmmssZ` (UTC, second precision, filesystem-safe). Millisecond precision provides no meaningful benefit for the operational accident-prevention goal, and is intentionally excluded.
- **Collision tolerance**: Same-second double-execution collisions are accepted. The goal is to prevent operational accidents across separate invocations, not cryptographic uniqueness.
- **`filenameFor` callback replaces the `prefix` constructor parameter**: `OutputWriter` receives `filenameFor: (seq: number) => string` instead of `prefix: string`. It returns a filename only (not a path). Path construction remains `join(outputDir, filenameFor(seq))` inside `OutputWriter`, keeping `outputDir` as the sole authority over the output directory. This prevents path traversal vulnerabilities that would arise if the callback could return an absolute or relative path.
- **Timestamp is captured once in `Extractor.run()`** before the write loop starts, then closed over in the `filenameFor` lambda. `OutputWriter` itself has no knowledge of timestamps.
- **`formatSessionTimestamp(date: Date): string`** is a pure helper function added to `src/output/utils.ts`. It produces the `YYYYMMDDTHHmmssZ` string and is independently testable.
- **Phase 3 compatibility**: because `OutputWriter` is unaware of how the timestamp is obtained, Phase 3's Clock abstraction only needs to change where `new Date()` is called in `Extractor.run()` — `OutputWriter` requires no further changes.
- **New runtime dependencies**: none.

### Non-Goals

- Millisecond or UUID-based uniqueness — second precision is sufficient for the operational goal
- Allowing `filenameFor` to return a full path — filename only, path joining stays in `OutputWriter`
- Changing the `.jsonl` extension or the zero-padded sequence format
- Any changes to the output JSON schema or rotation logic

### Target Files

| File                         | Action | Notes                                                                                                                                                                                                                                                                                    |
| ---------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/output/writer.ts`       | Modify | Replace `prefix: string` constructor parameter with `filenameFor: (seq: number) => string`; update `openNext()` to call `filenameFor(this.seq)` instead of constructing the filename internally                                                                                          |
| `src/output/utils.ts`        | Modify | Add `formatSessionTimestamp(date: Date): string` — formats a `Date` as `YYYYMMDDTHHmmssZ` (UTC, second precision)                                                                                                                                                                        |
| `src/output/index.ts`        | Modify | Re-export `formatSessionTimestamp`                                                                                                                                                                                                                                                       |
| `src/core/extractor.ts`      | Modify | Replace `new OutputWriter(outputDir, prefix, rotation)` with `new OutputWriter(outputDir, (seq) => \`${prefix}-${tsStr}-${String(seq).padStart(6, "0")}.jsonl\`, rotation)`; capture `new Date()`as`sessionTs`before the write loop; derive`tsStr`via`formatSessionTimestamp(sessionTs)` |
| `test/output/writer.test.ts` | Modify | Replace `prefix`-based constructor calls with explicit `filenameFor` callbacks; update all `readFile` calls that reference hardcoded filenames (e.g. `repo-000001.jsonl`) to use the filename produced by the test's own callback                                                        |
| `test/output/utils.test.ts`  | Modify | Add tests for `formatSessionTimestamp`: UTC output, second truncation, known input/output pair                                                                                                                                                                                           |

### Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks:**

- Run `gitrail -b main ./repo -o ./out` twice in quick succession; confirm two distinct timestamp segments appear in `./out/` filenames and no file from the first run is overwritten
- Run with `--max-lines 1` across multiple commits; confirm all files in the session share the same timestamp segment and sequence numbers are `000001`, `000002`, etc.
- Confirm filename format matches `{prefix}-YYYYMMDDTHHmmssZ-{6-digit-seq}.jsonl` exactly

---

## Phase 3: Extractor Boundary Cleanup for Runtime and I/O Concerns

_Introduce `Reporter`, `StateStore`, and two clock function types into the core layer, and inject them into `Extractor` via constructor arguments, removing all direct runtime coupling (`process.stderr`, `performance`, `Date`, `fs`) from `extractor.ts`._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

### Design References

- [`instructions/architecture.instructions.md`](instructions/architecture.instructions.md) — "Stable core, volatile edges" principle; component responsibilities
- Roadmap item: "Refactor: Extractor boundary cleanup for runtime and I/O concerns"

### Design Decisions

- **`Reporter` interface** — split by meaning into three methods:

  ```typescript
  interface Reporter {
    warn(message: string): void; // branch-not-found, fallback warnings
    progress(commitsWritten: number): void; // called after each commit write
    done(commitsWritten: number): void; // called once in the finally block
  }
  ```

  The `\r`/`\n` rendering, 100-commit throttling, and final flush logic all move into the concrete implementation. `Extractor` calls `progress()` on every commit and `done()` in `finally` — it has no knowledge of display format.

- **`quiet` removal from `ExtractorConfig`** — `Extractor` no longer reads `quiet`. Instead, the CLI passes a no-op `Reporter` when `--quiet` is set. `parseArgs()` return type changes from `Promise<ExtractorConfig>` to `Promise<{ config: ExtractorConfig; quiet: boolean }>`. `src/index.ts` destructures the result, selects the Reporter, and retains `quiet` locally for the post-run summary guard.

- **Clock functions — injected separately by purpose**:
  - `wallNow: () => Date` — replaces `new Date()` calls: state file `generatedAt` field and the Phase 2 session timestamp for `filenameFor`
  - `monotonicNow: () => number` — replaces `performance.now()` calls: elapsed time measurement
    Defined as type aliases in `src/core/types.ts`. Injected as constructor parameters. This ensures that after Phase 2, `Extractor` has zero direct timer/Date calls.

- **`StateStore` interface**:

  ```typescript
  interface StateStore {
    read(): Promise<StateFile | null>; // null when file does not exist
    write(state: StateFile): Promise<void>;
  }
  ```

  The atomic write implementation (`writeFile(tmp)` → `rename`) moves into the concrete `NodeStateStore` class. Validation logic (version check, repository path check) stays in `Extractor` — it is domain policy, not I/O.

- **Constructor signature**:

  ```typescript
  constructor(
    config: ExtractorConfig,
    adapter: GitAdapter,
    reporter: Reporter,
    wallNow: () => Date,
    monotonicNow: () => number,
    stateStore?: StateStore,   // provided iff config.stateFilePath is defined
  )
  ```

  Separating config data from dependency objects follows the standard Dependency Inversion principle: config describes _what_ to do; injected objects provide _how_ to do runtime-specific work.

- **Concrete implementations live in `src/index.ts`** — `stderrReporter`, `noopReporter`, and `NodeStateStore` are defined inline in the CLI entry point. No new source files are created. This mirrors how `IsomorphicGitAdapter` is the concrete Git implementation at the system boundary.

- **`stateStore` is optional** — when `config.stateFilePath` is undefined, `stateStore` is not passed and `Extractor` skips state operations (same guard condition as current `if (this.config.stateFilePath)`).

- **New runtime dependencies**: none.

### Non-Goals

- Changing state file schema, atomic write strategy, or validation rules
- Abstracting `OutputWriter` — it is already constructed by `Extractor` and tested separately
- Clock abstraction in layers other than Core (CLI layer uses `Date`/`performance` directly)
- Any observable change in CLI output format or behavior

### Target Files

| File                          | Action | Notes                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/types.ts`           | Modify | Add `Reporter` and `StateStore` interfaces; add `WallClock` and `MonotonicClock` type aliases (`() => Date` and `() => number`); remove `quiet` from `ExtractorConfig`                                                                                                                                      |
| `src/core/index.ts`           | Modify | Re-export `Reporter`, `StateStore`, `WallClock`, `MonotonicClock`                                                                                                                                                                                                                                           |
| `src/core/extractor.ts`       | Modify | Add `reporter`, `wallNow`, `monotonicNow`, `stateStore?` constructor parameters; replace all `process.stderr.write` with `reporter.warn/progress/done`; replace `performance.now()` with `monotonicNow()`; replace `new Date()` with `wallNow()`; replace inline state I/O with `stateStore.read()/write()` |
| `src/cli/args.ts`             | Modify | Remove `quiet` from `ExtractorConfig` construction; change return type to `Promise<{ config: ExtractorConfig; quiet: boolean }>`                                                                                                                                                                            |
| `src/index.ts`                | Modify | Destructure `{ config, quiet }` from `parseArgs()`; define `stderrReporter`, `noopReporter`, `NodeStateStore` inline; pass appropriate Reporter and optional StateStore to `new Extractor(...)`; retain `quiet` local variable for the post-run summary guard                                               |
| `test/core/extractor.test.ts` | Modify | Add `reporter`, `wallNow`, `monotonicNow`, and `stateStore` mocks/stubs to all `Extractor` instantiations; add tests verifying `reporter.warn` is called on branch-not-found and fallback; verify `reporter.done` is called in finally                                                                      |

### Implementation Notes

- In `src/index.ts`, `stderrReporter` should maintain internal state (`lastDisplayed: number`) to throttle `progress()` display to every 100 commits, and emit the final `\n` flush in `done()`.
- `NodeStateStore.write()` receives the complete `StateFile` object (including `generatedAt`). The `generatedAt` value is set by Extractor using `wallNow()` before calling `stateStore.write()`.
- After Phase 2, `Extractor.run()` already calls `wallNow()` once for the session timestamp (`filenameFor`). After Phase 3, the same `wallNow()` call serves double duty — session timestamp and `generatedAt`. Capture it as a single `const sessionTs = wallNow()` at the start of `run()`.
- `stderrReporter` and `noopReporter` can be plain object literals in `src/index.ts`; a class is not required.

### Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks:**

- `gitrail -b main ./repo` — stderr shows progress and summary as before; exits 0
- `gitrail -b main --quiet ./repo` — no stderr output except errors; exits 0
- Confirm `src/core/extractor.ts` has zero imports from `node:fs/promises`, `node:perf_hooks`, and no direct references to `process.stderr` or `Date`

---

## Phase 4: TypeScript Type Strengthening

_Strengthen the type system across all layers by applying `readonly` modifiers, `readonly` array types, `never`-based exhaustiveness checks, and a branded `CommitHash` type — keeping changes to the type layer only, with one deliberate exception: a runtime `isCommitHash()` guard at the user-controlled state file boundary._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

### Design Decisions

- **`readonly` on all pure data fields**: apply to every field in `RawPerson`, `RawCommit`, `PersonIdentity`, `OutputPerson`, `OutputRepository`, `OutputCommit`, `RotationConfig`, `ExtractorConfig`, `StateBranchEntry`, `StateFile`, `ExtractionResult`, `GitAdapter` method signatures. Fields are mutable only where there is an explicit documented reason.
- **`readonly` array types**: `branches: string[]` → `readonly string[]` in `ExtractorConfig`; `parents: string[]` → `readonly string[]` in `RawCommit` and `OutputCommit`; `branches: StateBranchEntry[]` → `readonly StateBranchEntry[]` in `StateFile`. The distinction matters: a `readonly` field holding a mutable array still allows `.push()`; `readonly T[]` prohibits mutation of the array itself.
- **`never`-based exhaustiveness check on `ExtractionRange`**: add a helper `assertNever(x: never): never` in `src/core/types.ts`. Apply it in `extractor.ts` at the end of any `if/else` chain that handles all `ExtractionRange` variants. When a new variant is added to `ExtractionRange`, the compiler will report an error at every unhandled branch, not just at the type definition. This is a zero-runtime annotation — `assertNever` throws but is unreachable in correct code.
- **Branded `CommitHash` type**:
  ```typescript
  declare const _commitHashBrand: unique symbol;
  export type CommitHash = string & { readonly [_commitHashBrand]: "CommitHash" };
  ```
  Applied to: `RawCommit.oid`, `RawPerson`-adjacent usages, `StateBranchEntry.lastCommitHash`, `ExtractionRange` (`type: "ref"`) hash field, `GitAdapter.resolveRef()` return type, `walkCommits()` `excludeHash` parameter and `commit.oid`.
- **`as CommitHash` at isomorphic-git boundaries**: values that originate from `resolveRef()` and `readCommit()` inside `isomorphic-git-adapter.ts` are cast with `as CommitHash`. These are library outputs with a known-safe format.
- **`isCommitHash()` Type Guard at the state file boundary**: the one location where a `string` from `JSON.parse` is promoted to `CommitHash`. This is a user-controlled file and `as CommitHash` would be unsafe. The guard validates 40-character lowercase hex (SHA-1), which is the only hash format isomorphic-git produces. Defined in `src/core/types.ts` alongside the brand definition; exported and used in `src/core/extractor.ts` (or Phase 3's `NodeStateStore.read()` after Phase 3 is applied).
  ```typescript
  export function isCommitHash(v: unknown): v is CommitHash {
    return typeof v === "string" && /^[0-9a-f]{40}$/.test(v);
  }
  ```
- **Execution code impact**: limited to `isCommitHash()` function definition and its call site in state file parsing. All other changes are type-only.
- **New runtime dependencies**: none.

### Non-Goals

- SHA-256 (64-char) support — isomorphic-git does not produce it; defer if ever needed
- Branded types for repo paths, branch names, or remote URLs — the safety gain does not justify the annotation noise at this stage
- Changing `interface` to `type` or vice versa — current usage is already idiomatic
- Any changes to runtime logic, output format, or CLI behavior

### Target Files

| File                                      | Action | Notes                                                                                                                                                                                                   |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/types.ts`                       | Modify | Add `CommitHash` branded type; add `isCommitHash()` guard; add `assertNever()`; apply `readonly` to all fields and collections; update `ExtractionRange` to use `CommitHash`                            |
| `src/core/index.ts`                       | Modify | Re-export `CommitHash`, `isCommitHash`, `assertNever`                                                                                                                                                   |
| `src/core/extractor.ts`                   | Modify | Add `assertNever` call at end of `ExtractionRange` handling; use `isCommitHash()` in state file parse; add `as CommitHash` where resolveRef result is used as excludeHash                               |
| `src/git/types.ts`                        | Modify | Apply `readonly` to all fields of `RawPerson`, `RawCommit`, `GitAdapter`; update `resolveRef()` return type to `Promise<CommitHash>`; update `walkCommits()` `excludeHash` to `CommitHash \| undefined` |
| `src/git/isomorphic-git-adapter.ts`       | Modify | Add `as CommitHash` at the two points where isomorphic-git OIDs are returned: `resolveRef()` return and `commit.oid` in the walk loop                                                                   |
| `src/output/types.ts`                     | Modify | Apply `readonly` to all fields of `OutputPerson`, `OutputRepository`, `OutputCommit`                                                                                                                    |
| `test/core/extractor.test.ts`             | Modify | Update state file fixtures to use valid 40-char hex hashes (any that are already valid remain unchanged); add test asserting `isCommitHash` rejects an invalid hash in state file                       |
| `test/git/isomorphic-git-adapter.test.ts` | Modify | No logic changes expected; confirm type-level changes compile cleanly                                                                                                                                   |

### Implementation Notes

- Apply changes layer by layer outward: `src/core/types.ts` first, then `src/git/types.ts`, then `src/output/types.ts`, then the concrete files (`extractor.ts`, `isomorphic-git-adapter.ts`). This order ensures TypeScript surfaces all cascade errors in one pass rather than iteratively.
- `assertNever` is intentionally defined in `src/core/types.ts` rather than a utility file — it is tightly coupled to the discriminated union definitions in that file, and placing it there makes the exhaustiveness contract visible at its point of definition.

### Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks:**

- Confirm `npm run build` produces zero type errors
- Tamper a state file's `lastCommitHash` to an invalid string (e.g. `"not-a-hash"`); confirm `isCommitHash()` rejects it and extraction fails with a clear error
- Confirm no change to any observable CLI output or file content

---

## Phase 5: Cross-Run Deduplication for Newly Added Branches

_When a new branch is added to `--branch` in an incremental run, compute the merge base between that branch and all branches already recorded in the state file, and use the deepest common ancestor as `excludeHash` for the new branch's traversal, preventing commits already extracted in prior runs from appearing in the output again._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

### Design References

- [`instructions/git-traversal.instructions.md`](instructions/git-traversal.instructions.md) — "Deduplication: Across Runs (known limitation)" and "Future Work: Cross-Run Deduplication for New Branches"
- Roadmap item: "Correctness: Cross-run deduplication for newly added branches"

### Design Decisions

- **Trigger condition**: a branch is "new" when it appears in `--branch` args but is **absent from the state file's `branches` array**. Only applies in `--mode incremental`. Snapshot mode does not read state and requires no deduplication.
- **Merge base computation**: use `isomorphic-git`'s `findMergeBase({ fs, dir, oids })` API. `oids` is the list of HEAD hashes for all **existing** branches from the state file (not the new branch). The function returns `string[]`; use the first element as the merge base hash. If it returns an empty array (no common ancestor — detached histories), skip the deduplication and fall back to full traversal for that branch.
- **`findMergeBase` is added to `GitAdapter`**:
  ```typescript
  findMergeBase(repoPath: string, oids: readonly CommitHash[]): Promise<CommitHash | null>;
  ```
  Returns `null` when no common ancestor exists. The concrete implementation in `IsomorphicGitAdapter` calls `git.findMergeBase()` and returns the first result, or `null` if the result array is empty.
- **`excludeHash` selection for a new branch**: use the merge base hash as `excludeHash` in `walkCommits()`. This is the same mechanism already used for incremental extraction — no new traversal primitive is required.
- **Only one merge base per new branch**: compute the merge base between the new branch HEAD and all existing branch HEADs together (passing all `oids` at once to `findMergeBase`). Do not compute pairwise merge bases; the single multi-ancestor call is correct and sufficient.
- **Existing branches are unaffected**: branches already in the state file continue to use `stateMap.get(branch)` as `excludeHash`, exactly as in the current incremental logic.
- **State file write is unchanged**: after a successful run, the state file records the current HEAD hash for each processed branch (including newly added branches). No new field is needed in the state file.
- **`MERGE_BASE_NOT_FOUND` error code**: add to `GitAdapterErrorCode`. Used when `findMergeBase` itself throws an unexpected error (not for the empty-result case — that is the `null` return).
- **New runtime dependencies**: none (`findMergeBase` is already in isomorphic-git).

### Non-Goals

- Deduplication for snapshot mode — state is not read, so there is no prior-run context
- Deduplication when no branches exist in the state file (first run) — no existing HEADs to compute merge base against
- Storing per-commit output history to enable arbitrary deduplication — the merge-base approach is sufficient and bounded
- Changes to state file schema

### Target Files

| File                                      | Action | Notes                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/git/types.ts`                        | Modify | Add `findMergeBase(repoPath: string, oids: readonly CommitHash[]): Promise<CommitHash \| null>` to `GitAdapter`                                                                                                                                                                                                              |
| `src/git/errors.ts`                       | Modify | Add `"MERGE_BASE_NOT_FOUND"` to `GitAdapterErrorCode`                                                                                                                                                                                                                                                                        |
| `src/git/isomorphic-git-adapter.ts`       | Modify | Implement `findMergeBase()`: call `git.findMergeBase({ fs, dir, oids })`; return first result as `CommitHash` or `null` if empty; wrap unexpected errors in `GitAdapterError` with code `"MERGE_BASE_NOT_FOUND"`                                                                                                             |
| `src/core/extractor.ts`                   | Modify | In incremental mode, before the per-branch loop: identify new branches (in `config.branches` but absent from `stateMap`); if any exist and `stateMap.size > 0`, call `adapter.findMergeBase()` with existing branch HEADs; use the result as `excludeHash` for new branches; fall back to full traversal if result is `null` |
| `test/git/isomorphic-git-adapter.test.ts` | Modify | Add tests: `findMergeBase` returns the correct common ancestor for a forked history; returns `null` for detached histories; wraps unexpected errors as `MERGE_BASE_NOT_FOUND`                                                                                                                                                |
| `test/core/extractor.test.ts`             | Modify | Add tests: new branch in incremental mode uses merge base as `excludeHash`; new branch with no common ancestor falls back to full traversal; existing branches are unaffected by merge base logic                                                                                                                            |

### Implementation Notes

- The merge base computation must happen **before** the per-branch traversal loop, using the HEAD hashes of the branches already in `stateMap`. These can be resolved via `adapter.resolveRef()` for each existing branch name at that point — or, if Phase 1 has already been applied, the state file's `lastCommitHash` values (already in `stateMap`) can be used directly as the `oids` list, avoiding extra `resolveRef()` calls.
- Using `stateMap` values (prior run's HEAD hashes) rather than current HEAD hashes for `oids` is acceptable and slightly preferred: it avoids an extra async call per existing branch and is consistent with what the existing incremental logic already uses as `excludeHash`.
- `findMergeBase` with a single existing branch (`stateMap.size === 1`) degenerates to a two-ancestor merge base call, which is the common case and is correct.

### Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks:**

- Run 1: `gitrail --mode incremental -b main -s ./state.json ./repo` — extracts commits on `main`, records state
- Run 2: `gitrail --mode incremental -b main -b feature -s ./state.json ./repo` — `feature` is new; confirm commits shared with `main` (below merge base) do not appear in output; `feature`-only commits above merge base do appear
- Run 2 with detached history (no common ancestor): confirm `feature` is fully extracted without error
- Confirm `main` differential output in Run 2 is identical to what it would be without the `feature` branch added

---

## Phase 6: Help Option Grouping and Discoverability

_Group CLI options under labelled sections in the `--help` output and add descriptive notes to guide users toward the incremental extraction workflow._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

---

## Phase 7: Documentation Update

_Update all human-oriented documentation — `docs/`, README, changelog, and migration notes — to reflect the complete set of changes introduced in this release._

### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

---

## Final Verification Checklist

_To be filled in when phase implementation detail is finalized._

---

## Release Intent Summary

v0.2.0 is a **CLI stability and architecture release**.
It establishes the intended CLI contract for extraction modes and state management, prevents operational hazards in repeated runs, and cleans up core architecture before the codebase grows further.
Breaking changes to the CLI interface are intentional and will be documented in the changelog.
