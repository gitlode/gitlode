# Phase 2: `Extractor.run()` Decomposition

_Decompose the monolithic `Extractor.run()` method into focused private helpers — `initializeStateMap()`, `computeNewBranchExclude()`, `buildExcludeHash()`, and `processBranch()` — reducing `run()` to orchestration only, and making per-branch logic independently readable in preparation for the file-diff features added in Phases 3 and 4._

## Status

- [x] Planned
- [x] In progress
- [x] Completed

## Design References

- Roadmap item: "Refactor: `Extractor.run()` decomposition and structural clarity"

## Design Decisions

- **No behavioral change**: all logic moves verbatim. Observable CLI output, state file content, and output JSONL content must be identical before and after. This is a pure structural refactor.

- **Private method boundaries** (final signatures):

  ```typescript
  private async initializeStateMap(repoPath: string): Promise<Map<string, CommitHash>>
  ```

  Reads `this.stateStore` and `this.config` (mode, onMissingState, stateFilePath). Handles the `onMissingState === "snapshot"` fallback warning via `this.reporter.warn()`. Returns an empty map when mode is snapshot, stateStore is absent, or state file is missing with fallback configured.

  ```typescript
  private async computeNewBranchExclude(
    newBranches: ReadonlySet<string>,
    stateMap: ReadonlyMap<string, CommitHash>,
    repoPath: string,
  ): Promise<CommitHash | undefined>
  ```

  Returns `undefined` immediately if `newBranches.size === 0` or `stateMap.size === 0`. Otherwise calls `this.adapter.findMergeBase(repoPath, Array.from(stateMap.values()))` and returns the result (or `undefined` if `null`).

  ```typescript
  private buildExcludeHash(
    branch: string,
    stateMap: ReadonlyMap<string, CommitHash>,
    newBranchExclude: CommitHash | undefined,
  ): CommitHash | undefined
  ```

  Reads `this.config.range`. When range is undefined: returns `stateMap.get(branch) ?? newBranchExclude` (existing branch uses its state hash; new branch falls back to the merge-base hash). When range is `"ref"`: returns `range.ref`. When range is `"date"`: returns `undefined`. Includes `assertNever` at the exhaustive end.

  ```typescript
  private async processBranch(branch: string, ctx: BranchRunContext): Promise<void>
  ```

  Resolves the branch ref, emits branch-not-found warning and returns early if absent. Calls `buildExcludeHash()` and walks commits. Contains the `writeCommit` inner closure (local arrow function). Handles the `COMMIT_NOT_FOUND` fallback. Mutates `ctx.branchHeads`, `ctx.visited`, and `ctx.commitsRef.count`.

- **`BranchRunContext` interface**: a private interface defined at the top of `extractor.ts` (not exported). Shape:

  ```typescript
  interface BranchRunContext {
    readonly repoPath: string;
    readonly repoName: string;
    readonly remoteUrl: string | null;
    readonly stateMap: ReadonlyMap<string, CommitHash>;
    readonly newBranchExclude: CommitHash | undefined;
    readonly writer: OutputWriter;
    readonly visited: Set<string>;
    readonly commitsRef: { count: number };
    readonly branchHeads: Map<string, CommitHash>;
  }
  ```

  `commitsRef` is a `{ count: number }` object (not a plain `number`) so that `processBranch` can increment it by reference across the loop. `run()` reads `commitsRef.count` for the final `reporter.done()` call and the `ExtractionResult`.

- **`writeCommit` stays as a closure inside `processBranch`**: it needs `ctx.writer`, `ctx.visited`, `ctx.commitsRef`, `ctx.repoName`, `ctx.remoteUrl`, and `this.config.range` — all of which are in scope as a method of `Extractor`. Extracting it further would add parameter noise without clarity benefit.

- **`newBranches` set computation stays in `run()`**: it is computed once before the loop and passed to `computeNewBranchExclude()`. It is not needed inside `processBranch` — the `buildExcludeHash()` logic uses `stateMap.get(branch) ?? newBranchExclude` which implicitly covers the new-branch case.

- **New runtime dependencies**: none.

## Non-Goals

- Any change to observable behavior: CLI output, state file schema, JSONL output.
- Adding new test cases — the existing behavioral tests cover the logic; they must continue to pass unchanged.
- Changing `deriveRepoName()` or `mapToOutputCommit()` — they are already well-scoped helpers.
- Any changes to other source files.

## Target Files

| File                    | Action | Notes                                                                                                                        |
| ----------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/core/extractor.ts` | Modify | Add `BranchRunContext` interface; extract four private methods; reduce `run()` to orchestration only. No other files change. |

## Documentation Touchpoints

_The roadmap entry for this item will be removed during Release Tasks. No instructions files describe `Extractor.run()` internals — no `*.instructions.md` update is needed._

## Implementation Notes

- Implement by extracting one method at a time and verifying `npm run build` + `npm test` passes after each extraction. Suggested order: `initializeStateMap` → `computeNewBranchExclude` → `buildExcludeHash` → `processBranch`.
- **Commit after each method extraction.** Each extraction is its own commit — e.g. "refactor: extract initializeStateMap()", "refactor: extract buildExcludeHash()". Do not batch multiple extractions into a single commit.
- The `finally` block (calling `reporter.done()` and `writer.close()`) stays in `run()`. The writer lifetime is owned by `run()`, not `processBranch`.
- State file write (after the loop, on success) also stays in `run()`.
- `branchHeads` is populated by `processBranch` mutating `ctx.branchHeads`. After the loop, `run()` reads it to write the state file and build `ExtractionResult.branches`.

## Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks:**

- Confirm all 94 existing tests pass without modification.
- Confirm `src/core/extractor.ts` contains no code block longer than ~25 lines inside any single method after the refactor.
- Confirm `run()` contains no direct calls to `reporter.warn()`, `adapter.findMergeBase()`, `adapter.walkCommits()`, or `stateStore.read()` — these must all be delegated to private methods.
