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

---

## Traversal Algorithm

### Full Extraction (no `--since-*` / no `--state`)

For each specified `--branch`:

1. Resolve the ref to a commit hash via `GitAdapter.resolveRef()`
2. Walk all commits reachable from that hash via `GitAdapter.walkCommits(head, excludeHash: undefined)`
3. Write each commit to output

### Differential Extraction via `--state`

For each branch recorded in the state file:

1. Resolve the current HEAD hash for that branch
2. Use the recorded `lastCommitHash` as `excludeHash`
3. Call `GitAdapter.walkCommits(currentHead, excludeHash)`
4. The traversal yields only commits reachable from `currentHead` but **not** reachable from `excludeHash`

This is equivalent to `git log <excludeHash>..<currentHead>` and correctly handles merged branches. See "Merge Commit Handling" below.

### Differential Extraction via `--since-commit`

1. Validate that the specified hash exists and is reachable from each specified `--branch`
   - If not reachable: abort with error `Commit <hash> not found in branch <name>`
2. Use the hash as `excludeHash` in `GitAdapter.walkCommits()`

### Differential Extraction via `--since-date`

1. Walk all commits reachable from HEAD (no `excludeHash`)
2. Filter: include only commits where `committer.timestamp` (as Unix seconds) is **after** the specified date
3. Use `committer.timestamp` (not `author.timestamp`) as the filter criterion
4. Stop walking when a commit's `committer.timestamp` is older than the specified date — do not continue walking older history

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

isomorphic-git's `log()` API does not natively support exclusion. Use `walk()` with a custom visitor that tracks visited commits and stops when the `excludeHash` commit (or any of its ancestors) is reached.

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

### Read on Startup

If `--state` is provided and the file exists:

1. Parse and validate the JSON structure (check `version` field)
2. Resolve both the recorded `repositoryPath` and the provided `<repository-path>` to absolute paths using `path.resolve()` before comparing. Simple string equality on raw input will produce false mismatches when the same path is expressed differently (e.g. `./my-repo` vs `/home/user/my-repo`). If they do not match after resolution, abort with error:
   `State file was created for a different repository: <recorded-path>`
3. For each branch in the state file, use `lastCommitHash` as the `excludeHash` for that branch's traversal

Note: the `repositoryPath` value written to the state file must also be the `path.resolve()`-ed absolute path, not the raw CLI input.

### Write on Completion

The state file is written **only after all output files are fully flushed and closed**.

Write atomically:

1. Write new content to `<statePath>.tmp`
2. Rename `<statePath>.tmp` → `<statePath>` (atomic on POSIX systems)

This ensures that a crash during output writing does not corrupt the state file.

### Branch Reconciliation

At the start of a run using `--state`:

- Branches in `--branch` args but **not in state file**: treated as full extraction for that branch. ⚠️ This may produce duplicate output if the new branch shares history with already-extracted branches. See "Cross-Run Deduplication for New Branches" in the Deduplication section.
- Branches in state file but **not in `--branch` args**: ignored (not re-extracted, not removed from state)
- Branches in both: differential extraction using recorded `lastCommitHash`

After a successful run, the state file is updated to reflect the new `lastCommitHash` for each processed branch.

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

Memory note: the `visited` set holds one hash per unique commit traversed. At approximately 100–150 bytes per entry (string + Set overhead), a repository with 1 million commits consumes roughly 100–150 MB. This is acceptable for the initial implementation. For repositories significantly larger than this, range-limiting options (`--since-commit`, `--since-date`) reduce the traversal scope proportionally.

### Across Runs (known limitation)

Session-level deduplication does not protect against cross-run duplicates when a **new branch is added mid-operation**. Consider the following scenario:

```
Run 1: --branch main         → outputs commits 1, 2, 3. state: { main: "3" }
Run 2: --branch main --branch develop
         main   → differential from "3" ✅ (no duplicates)
         develop → no prior state → full traversal → outputs 5, 4, 3, 2, 1 ❌ (1,2,3 already output)
```

**This is a known limitation of the initial implementation.**

Design rationale: the primary use case is continuously extracting stable, long-lived branches (e.g. `main`, `develop`). Adding a new branch mid-operation is an atypical scenario. When it occurs, the recommended recovery is to discard prior output and re-run from scratch (full extraction).

### Future Work: Cross-Run Deduplication for New Branches

A future implementation may resolve this by computing the merge base between a newly added branch and all existing branches at the start of a run, and using that merge base as the `excludeHash` for the new branch's traversal. This would require:

1. Detecting branches present in `--branch` args but absent from the state file (already done in Branch Reconciliation)
2. Computing `mergeBase(newBranch, existingBranch1, existingBranch2, ...)` via isomorphic-git
3. Using the merge base hash as `excludeHash` for the new branch
4. Recording the merge base in the state file for subsequent runs

This approach does not require storing all previously output hashes and has bounded impact on the overall processing flow. It is a candidate for Phase 2 implementation.
