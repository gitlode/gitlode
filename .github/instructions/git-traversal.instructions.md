---
description: Git DAG traversal, differential extraction, and state file management for gitrail
applyTo: "src/git/**,src/core/**"
---

# Git Traversal & Differential Extraction

## Fundamental Git Concepts (Required Context)

### Commits Have No Branch Information

A Git commit object contains only: `tree`, `parent[]`, `author`, `committer`, `message`. There is no `branch` field.

A branch is a named pointer (ref) stored in `.git/refs/heads/` that points to exactly one commit. This pointer is mutable — it moves forward as new commits are added.

**Implication for gitrail**: "Extracting commits for branch X" means "walk the commit graph starting from the commit that ref X currently points to." The extracted data represents a snapshot at the time of extraction. The same commit may be reachable from multiple branches.

### Commit Graph is a DAG

Commits form a Directed Acyclic Graph (DAG). Each commit points to one or more parent commits. Merge commits have two parents.

```
      1 - 2 - 3 - 4(merge) - 5    ← main (HEAD)
               \           /
                A - B - C          ← branchA (merged into main at commit 4)
```

### Reachability

A commit X is "reachable" from commit Y if X can be found by following parent links starting from Y.

## Stage Ownership During v0.4.0 Migration

- `CommitTraversalExtractor` is the Core stage that owns branch-head resolution, exclusion-boundary
  calculation, merge-base calculation for newly added branches, sequential branch traversal,
  cross-branch deduplication, `since-date` filtering, and `COMMIT_NOT_FOUND` fallback behavior.
- After Phase 4, `ExtractionCoordinator` owns `CheckpointStore` write timing and `OutputSink`
  lifecycle. The coordinator writes the checkpoint only after the pipeline completes without
  exception and `sink.close()` succeeds. `Extractor` (now a compatibility wrapper) owns checkpoint
  reading, missing-state fallback validation, and `CheckpointStore` injection into the coordinator.
- The traversal stage consumes previously loaded checkpoint data (passed via `CoordinatorRequest`
  from `Extractor`) and returns commit facts together with the candidate next checkpoint. This
  ownership split must not change any traversal semantics defined below.

---

## Traversal Algorithm

### Snapshot Mode (default)

Snapshot mode extracts commits independently of any prior state. The extraction range can be further controlled by `--since-ref` or `--since-date`.

#### No range filter (full snapshot)

For each specified `--branch`:

1. Resolve the ref to a commit hash via `GitAdapter.resolveRef()`
2. Walk all commits reachable from that hash via `GitAdapter.walkCommits(head, excludeHash: undefined)`
3. Write each commit to output

#### `--since-ref`

1. Resolve `--since-ref` to a commit hash via `GitAdapter.resolveRef()` (accepts commit hash, tag name, or branch name)
2. For each specified `--branch`:
   - Resolve the ref to HEAD hash
   - Use the resolved since-ref hash as `excludeHash` in `GitAdapter.walkCommits(head, excludeHash)`
   - The traversal yields only commits reachable from HEAD but **not** reachable from `excludeHash`

This is equivalent to `git log <since-ref>..<head>` and correctly handles merged branches. See "Merge Commit Handling" below.

#### `--since-date`

1. For each specified `--branch`:
   - Walk all commits reachable from HEAD (no `excludeHash`)
   - Filter: include only commits where `committer.timestamp` (as Unix seconds) is **after** the specified date
   - Use `committer.timestamp` (not `author.timestamp`) as the filter criterion
   - Use `continue` (not `break`) to skip old commits — do not abort the traversal when an old commit is encountered. BFS order across merge branches is not chronological: a newer commit from a merged branch may appear after an older one in BFS order, so early termination would silently drop commits.

### Incremental Mode

Incremental mode extracts only commits new since the last recorded state. Requires `--state`.

1. Read state file → build `stateMap: Map<branchName, lastCommitHash>`
2. For each specified `--branch`:
   - Resolve ref to current HEAD hash
   - If branch exists in stateMap: use `stateMap.get(branch)` as `excludeHash`
   - If branch not in stateMap: no `excludeHash` (full traversal for that branch)
   - Call `GitAdapter.walkCommits(head, excludeHash)`
3. Maintain global `visited: Set<string>` across all branches
4. On success: write state file with each branch's current HEAD hash

**Warning conditions**:

- Branch in stateMap does not exist in repository → warn, skip
- `lastCommitHash` from stateMap is unreachable (e.g. after force push) → warn, full traversal for that branch
- Branch not in stateMap → full traversal (may produce duplicates with prior runs; see Deduplication section)

### Incremental + `--on-missing-state snapshot` Fallback

When `--mode incremental` is specified with `--on-missing-state snapshot` and the state file does not exist: behave as snapshot mode with no range filter (full traversal for all branches). Create state file on success.

---

## Merge Commit Handling

This is the critical correctness requirement for differential extraction.

### The Problem

```
      1 - 2 - 3 - 4(merge) - 5    ← main
               \           /
                A - B - C
```

Previous run recorded: `lastCommitHash = "3"` for `main`.

Next run: walk from HEAD (`5`) excluding commits reachable from `3`.

Without proper exclusion, walking would yield: `5`, `4`, `A`, `B`, `C`, `3`, `2`, `1` — including already-extracted commits.

With proper exclusion (reachability difference): yields only `5`, `4`, `A`, `B`, `C`. Traversal stops when it reaches `3` because `3` is reachable from `excludeHash`.

### Implementation in isomorphic-git

isomorphic-git's `log()` and `walk()` APIs do not natively support exclusion-based traversal. The implementation uses `readCommit()` in a manual BFS queue loop. `_collectReachable()` pre-computes the full set of commit hashes reachable from `excludeHash`; the main loop skips any hash found in that set.

Algorithm for `walkCommits(repoPath, head, excludeHash)`:

```typescript
async function* walkCommits(
  repoPath: string,
  head: string,
  excludeHash?: string,
): AsyncIterable<RawCommit> {
  // Pre-compute the set of commit hashes reachable from excludeHash.
  // These will be used as stop conditions during traversal.
  const excluded = excludeHash ? await collectReachable(repoPath, excludeHash) : new Set<string>();

  // BFS/DFS from head, skipping any commit in `excluded`
  const queue: string[] = [head];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const hash = queue.shift()!;
    if (visited.has(hash) || excluded.has(hash)) continue;
    visited.add(hash);

    const commit = await readCommit(repoPath, hash); // via isomorphic-git
    yield toRawCommit(commit);

    for (const parent of commit.parents) {
      if (!visited.has(parent) && !excluded.has(parent)) {
        queue.push(parent);
      }
    }
  }
}

async function collectReachable(repoPath: string, startHash: string): Promise<Set<string>> {
  const reachable = new Set<string>();
  const queue = [startHash];
  while (queue.length > 0) {
    const hash = queue.shift()!;
    if (reachable.has(hash)) continue;
    reachable.add(hash);
    const commit = await readCommit(repoPath, hash);
    queue.push(...commit.parents);
  }
  return reachable;
}
```

**Ordering note**: BFS traversal does not guarantee chronological or reverse-chronological order, particularly across merge branches. The output JSONL line order is therefore indeterminate. Consumers (e.g. Data Warehouse ingestion pipelines) must sort by `committer.timestamp` if ordering is required — they must not rely on line order in the output file.

**Performance note**: `collectReachable()` walks the full prior history. For repositories with very long histories, this may be slow on the first differential run. This is acceptable for the initial implementation. Future optimization could use commit timestamps as a heuristic to prune the walk early.

---

## State File Management

### Location and Naming

Specified by `--state <path>`. The path is fully user-controlled. No default location is assumed.

### Role of `--state` in Each Mode

- **Snapshot mode**: State file content is **ignored** during extraction. On successful completion, the state file is written (created or overwritten) with each branch's current HEAD hash. This allows a snapshot run to initialize or reset state for subsequent incremental runs.
- **Incremental mode**: State file is **read** to determine the `excludeHash` per branch. On successful completion, the state file is updated with each branch's current HEAD hash.

### State File Records HEAD, Not Filtered Range

When `--since-ref` or `--since-date` is used in snapshot mode with `--state`, the state file records each branch's **current HEAD hash** — not the boundary of the filtered range. This means the state reflects the repository state at extraction time, independent of what was actually output.

**Warning condition**: If `--state` + `--since-ref` is used and a branch's HEAD is reachable from the since-ref (resulting in 0 commits output for that branch), emit a warning to stderr: subsequent incremental runs may output commits between the branch HEAD and the since-ref that were excluded in this run.

### Read on Startup

If `--state` is provided and the file exists:

1. Parse and validate the JSON structure (check `version` field)
2. Resolve both the recorded `repositoryPath` and the provided `<repository-path>` to absolute paths using `path.resolve()` before comparing. Simple string equality on raw input will produce false mismatches when the same path is expressed differently (e.g. `./my-repo` vs `/home/user/my-repo`). If they do not match after resolution, abort with error:
   `State file was created for a different repository: <recorded-path>`
3. In incremental mode: for each branch in the state file, use `lastCommitHash` as the `excludeHash` for that branch's traversal
4. In snapshot mode: skip step 3 (state content is not used for extraction)

Note: the `repositoryPath` value written to the state file must also be the `path.resolve()`-ed absolute path, not the raw CLI input.

### Write on Completion

The state file is written **only after all output files are fully flushed and closed**.

Write atomically:

1. Write new content to `<statePath>.tmp`
2. Rename `<statePath>.tmp` → `<statePath>` (atomic on POSIX systems)

This ensures that a crash during output writing does not corrupt the state file.

### Branch Reconciliation

At the start of an incremental run using `--state`:

- Branches in `--branch` args but **not in state file**: if `stateMap.size > 0`, gitrail computes the merge base between all existing state-file HEADs (`lastCommitHash` values) and uses the result as `excludeHash` for the new branch, preventing cross-run duplicates. If no common ancestor exists (`null` result from `findMergeBase`), falls back to full traversal. If `stateMap.size === 0` (no existing branches in state), all branches are fully extracted (expected for the first incremental run). See "Across Runs (merge base deduplication)" in the Deduplication section.
- Branches in state file but **not in `--branch` args**: ignored (not re-extracted, not removed from state)
- Branches in both: differential extraction using recorded `lastCommitHash`

After a successful run (in either mode), the state file is updated to reflect the current HEAD hash for each processed branch.

### Warning Conditions (non-fatal)

Log a warning (do not abort) when:

- A branch recorded in the state file no longer exists in the repository
- The recorded `lastCommitHash` for a branch no longer exists in the repository (e.g. after a force push) — fall back to full extraction for that branch

---

## Multi-Branch Traversal Order

When multiple `--branch` values are specified, each branch is traversed sequentially. Output lines from different branches are **not interleaved** — all commits from branch 1 are written before branch 2 begins.

The order of output follows the order of `--branch` arguments.

---

## Deduplication

### Within a Single Run (session-level deduplication)

When multiple branches share common history, the same commit OID would appear multiple times without deduplication. A global `visited` set is maintained across all branch traversals within a single run.

```typescript
const visited = new Set<string>(); // shared across all branches in this run

for (const branch of branches) {
  const head = await adapter.resolveRef(repoPath, branch);
  for await (const commit of adapter.walkCommits(repoPath, head, excludeHash)) {
    if (visited.has(commit.oid)) continue;
    visited.add(commit.oid);
    yield commit;
  }
}
```

Memory note: the `visited` set holds one hash per unique commit traversed. At approximately 100–150 bytes per entry (string + Set overhead), a repository with 1 million commits consumes roughly 100–150 MB. This is acceptable for the initial implementation. For repositories significantly larger than this, range-limiting options (`--since-ref`, `--since-date`) reduce the traversal scope proportionally.

### Across Runs (merge base deduplication)

When a new branch is added to `--branch` in an incremental run, gitrail automatically deduplicates
against prior runs by computing the merge base between the new branch and all branches already
recorded in the state file, then using that merge base as `excludeHash` for the new branch's
traversal.

**Algorithm (pre-loop step, incremental mode only):**

1. Identify new branches: present in `config.branches` but absent from `stateMap`.
2. If any new branches exist and `stateMap.size > 0`:
   - Collect `existingHeads`: the `lastCommitHash` values from `stateMap` (the prior-run HEADs —
     consistent with how existing branches use state values; avoids extra `resolveRef()` calls).
   - Call `adapter.findMergeBase(repoPath, existingHeads)`.
   - If result is non-null: use as `excludeHash` for all new branches in this run.
   - If result is `null` (no common ancestor): fall back to full traversal for those branches.
3. If `stateMap.size === 0`: no existing HEADs to compute against; all branches are fully
   extracted. This is the expected behavior on the first incremental run.

**Example:**

```
Run 1: --branch main         → outputs [3, 2, 1]. state: { main: "3" }
Run 2: --branch main --branch develop
         main   → excludeHash = "3" (from state) → differential → no new commits in this example
         develop → new; existingHeads = ["3"]; findMergeBase → "3"
                   excludeHash = "3" → yields [5, 4] only ✅ (no duplicates)
```

**Fallback — no common ancestor:**

If `findMergeBase` returns `null` (e.g. an orphan branch with detached history), fall back to full
traversal for the new branch. Duplicate commits may appear in the output in this case.

Recovery: discard prior output and re-run with `--mode snapshot` across all branches, then resume
incremental extraction.
