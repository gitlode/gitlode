# Phase 3: File Diff Computation in Git Adapter

_Extend the `GitAdapter` interface with a `getFileChanges()` method that computes per-file change information (path, status, additions, deletions) between a commit and its parent, implemented in `IsomorphicGitAdapter` using isomorphic-git's `walk()` API for tree comparison and the `diff` npm package for line-level diff statistics._

## Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

## Design References

- [`instructions/architecture.instructions.md`](../../instructions/architecture.instructions.md) — Git adapter layer responsibilities
- [`instructions/schema.instructions.md`](../../instructions/schema.instructions.md) — "File-Level Output Schema" section (to be added by this planning session)
- Roadmap item: "Output: Commit file diff stats" (partial — adapter infrastructure only)

## Design Decisions

- **New adapter method**:

  ```typescript
  getFileChanges(
    repoPath: string,
    commitOid: CommitHash,
    parentOid?: CommitHash,
  ): Promise<readonly FileChange[]>
  ```

  Caller passes the first parent OID explicitly (or omits it for root commits). The adapter does not read the commit object itself — it receives the parent OID from Core, which already has the `RawCommit.parents` array from `walkCommits()`. This avoids a redundant `readCommit()` call.

- **New type in `git/types.ts`**:

  ```typescript
  interface FileChange {
    readonly path: string;
    readonly status: "added" | "modified" | "deleted";
    readonly additions: number | null;
    readonly deletions: number | null;
  }
  ```

  `additions` / `deletions` are `null` when the file is binary (line-level statistics are not meaningful).

- **isomorphic-git API**: Use `walk()` with `TREE()` walkers for tree comparison. This is distinct from the commit-walking decision (which uses manual BFS via `readCommit()`). `walk()` is the correct API for tree-level comparison because:
  - It walks two tree structures in parallel, visiting each path that exists in either tree
  - Entries are `null` when a path does not exist in a tree, naturally indicating additions/deletions
  - `oid()` comparison on blob entries detects modifications without reading content (fast path for unchanged files)
  - `content()` is lazy — blob bytes are only read when the method is called, so unchanged files incur no I/O
  - Unchanged subtrees (matching tree OIDs) are not descended into

- **Tree comparison approach**:
  - **Normal commits** (parentOid provided): `walk()` with `trees: [TREE({ ref: parentOid }), TREE({ ref: commitOid })]`. Each changed file is detected by comparing blob OIDs.
  - **Root commits** (no parentOid): `walk()` with `trees: [TREE({ ref: commitOid })]` as a single walker. Every blob is treated as `"added"`.

- **Diff library**: `diff` npm package (BSD-3-Clause, ~77KB unpacked, widely used, built-in TypeScript types in v7+). Use `diffLines(oldString, newString)` to compute line-level additions/deletions. This was chosen over `diff-sequences` (lower-level, would require a manual line-splitting wrapper) for API directness and reduced maintenance surface.

- **Binary detection**: NUL-byte heuristic on the first 8000 bytes of file content (matches Git's convention). Binary files return `additions: null, deletions: null`.

- **No rename detection**: Status values are `"added" | "modified" | "deleted"` only. A renamed file appears as a delete + add pair. isomorphic-git has no built-in rename detection, and heuristic rename matching (content similarity) is out of scope.

- **Merge commits**: The caller (Core) passes `parents[0]` as `parentOid`. The adapter compares against this single parent. Multi-parent diff is not the adapter's responsibility — "diff against first parent" is the Core's policy decision, enforced by the argument it passes.

- **File path format**: `walk()` returns paths relative to repository root using `/` as separator, regardless of OS. These are passed through as-is.

- **Edge case — type change at same path** (e.g., blob → tree or tree → blob at the same path): When one side is a blob and the other is a tree, emit a change for the blob side (deleted or added) and let `walk()` descend into the tree side's children. This naturally produces correct add/delete entries for individual files.

- **Owning layer**: Git adapter. Diff computation requires reading Git objects (trees, blobs), which is repository access. Core does not need to understand Git's internal object model.

- **New runtime dependency**: `diff` (npm). No other new dependencies.

## Non-Goals

- Wiring file changes into CLI output — that belongs to Phase 4.
- Output schema changes — Phase 4 adds `OutputFileRecord`.
- `--include-files` flag (embedded file array in commit-level records) — deferred beyond v0.3.0.
- Rename detection (`"renamed"` status).
- Submodule change detection (`"commit"` type entries in trees) — skip silently.
- Performance optimization beyond what `walk()` provides natively (e.g., parallelized blob reads, caching across commits). Measure first, optimize later.

## Target Files

| File                                      | Action | Notes                                                                        |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| `src/git/types.ts`                        | Modify | Add `FileChange` interface; add `getFileChanges()` to `GitAdapter` interface |
| `src/git/isomorphic-git-adapter.ts`       | Modify | Implement `getFileChanges()` using `walk()` + `TREE()` + `diff`              |
| `src/git/index.ts`                        | Modify | Re-export `FileChange` if not already covered by barrel                      |
| `test/git/isomorphic-git-adapter.test.ts` | Modify | Add test cases for `getFileChanges()`                                        |
| `package.json`                            | Modify | Add `diff` as a runtime dependency                                           |

## Documentation Touchpoints

| File                                                | Section                 | Action                                                   |
| --------------------------------------------------- | ----------------------- | -------------------------------------------------------- |
| `.github/instructions/architecture.instructions.md` | "Git Adapter Interface" | Add `getFileChanges()` to the interface definition block |

## Implementation Notes

- **`walk()` callback structure**: The `map` callback receives `(filepath, entries)` where `entries` is an array matching the `trees` order. For two-tree comparison, `entries[0]` is the parent side and `entries[1]` is the child side. Either can be `null`.

- **Skip conditions in the map callback**:
  - `filepath === '.'` → return `undefined` (skip root)
  - Both entries are trees → return `undefined` (descend)
  - Both entries are blobs with equal OIDs → return `undefined` (unchanged)
  - Entry type is `"commit"` (submodule) → return `undefined` (skip)

- **Content decoding**: `WalkerEntry.content()` returns `Uint8Array`. Decode to string via `new TextDecoder('utf-8').decode(content)` before passing to `diffLines()`.

- **Binary detection before diff**: Check for NUL bytes before attempting `diffLines()`. If binary, return `{ additions: null, deletions: null }` without running the diff.

- **For "added" files** (parent entry is null or root commit): diff `""` against the file's content string. `diffLines("", content)` returns one `{ added: true, count: N }` change. Deletions = 0.

- **For "deleted" files** (child entry is null): diff the file's content string against `""`. Additions = 0.

- **Test repository**: The existing adapter tests use `isomorphic-git.init()` + programmatic commits. Extend this to create test scenarios with file additions, modifications, deletions, binary files, and root commits. Verify exact addition/deletion counts against known content.

## Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks:**

- Confirm `getFileChanges()` returns correct `FileChange[]` for:
  - A commit that adds a new file (status `"added"`, correct addition count, deletions = 0)
  - A commit that modifies an existing file (status `"modified"`, correct addition and deletion counts)
  - A commit that deletes a file (status `"deleted"`, additions = 0, correct deletion count)
  - A root commit (all files `"added"`)
  - A binary file change (`additions: null, deletions: null`)
  - An empty commit (no file changes → empty array)
- Confirm no regression in existing adapter tests (walkCommits, resolveRef, etc.)
