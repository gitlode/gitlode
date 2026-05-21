---
description: Git DAG traversal, differential extraction, and state file management for gitlode
applyTo: "src/git/**,src/core/**"
---

# Git Traversal & Differential Extraction

## Fundamental Git Concepts (Required Context)

### Commits Have No Branch Information

A Git commit object contains only: `tree`, `parent[]`, `author`, `committer`, `message`. There is no `branch` field.

A branch is a named pointer (ref) stored in `.git/refs/heads/` that points to exactly one commit. This pointer is mutable — it moves forward as new commits are added.

**Implication for gitlode**: "Extracting commits for branch X" means "walk the commit graph starting from the commit that ref X currently points to." The extracted data represents a snapshot at the time of extraction. The same commit may be reachable from multiple branches.

### Commit Graph is a DAG

Commits form a Directed Acyclic Graph (DAG). Each commit points to one or more parent commits. Merge commits have two parents.

```
      1 - 2 - 3 - 4(merge) - 5    ← main (HEAD)
               \           /
                A - B - C          ← branchA (merged into main at commit 4)
```

### Reachability

A commit X is "reachable" from commit Y if X can be found by following parent links starting from Y.

## Stage Ownership Contract

### Module placement rule

Every Core stage interface (`BranchTraversalPlanner`, `CommitTraversalExtractor`, `ExtractionCoordinator`, `FileChangeExpander`, `FactProjector`, `StateStore`) must be declared in `src/core/types.ts`. The corresponding `Default*` implementation class belongs in its own module file and must not re-declare or shadow the interface. When a new stage is introduced in any future phase, this split must be applied from the start: define the contract in `types.ts` first, then add the implementation module. This keeps `types.ts` a readable and complete map of all Core contracts and prevents implementation files from accumulating interface declarations that are hard to discover later.

### Ownership by stage

- `BranchTraversalPlanner` is the Core stage that owns branch-head resolution,
  exclusion-boundary calculation, merge-base calculation for newly added branches, and
  missing-branch warning behavior. It returns ordered `BranchTraversalPlan[]` values.
- `CommitTraversalExtractor` is the Core stage that consumes those plans and owns sequential
  branch traversal, cross-branch deduplication, `since-date` filtering, and `COMMIT_NOT_FOUND`
  fallback behavior.
- `ExtractionCoordinator` owns `StateStore` write timing and `OutputSink` lifecycle. The
  coordinator writes state only after the pipeline completes without exception and
  `sink.close()` succeeds. The runtime edge owns state reading, missing-state fallback
  validation, and `StateStore` injection into the coordinator.
- The candidate `ExtractionState` is built inside `DefaultExtractionCoordinator` from the
  successfully resolved branch heads returned by the planner. This candidate state must not
  be persisted until output writing and writer close both succeed. This ownership split must not
  change any traversal semantics defined below.

---

## Traversal Algorithm

### `resolveRef()` Contract

`GitAdapter.resolveRef(repoPath, ref)` resolves a ref string to a commit OID. The implementation must handle all of the following input types:

- **Branch name** (e.g. `main`, `develop`) — resolved via the standard Git ref namespace
- **Lightweight tag** (e.g. `v1.0`) — resolves directly to the tagged commit OID
- **Annotated tag** (e.g. `v1.0-rc1`) — `git.resolveRef()` returns the tag object OID, not the commit OID; the implementation must peel the tag object recursively until a commit OID is reached. The peel uses `git.readObject()` and follows the `object` field of each tag object until a non-`tag` type is found.
- **Raw commit OID** — when ref resolution via the Git ref namespace fails, the implementation falls back to reading the commit object directly via `git.readCommit({ oid: ref })`. If the read succeeds, the OID is returned as-is.

If none of these resolve successfully, `REF_NOT_FOUND` is thrown.

Repository object-format support is runtime-gated. The current support matrix is `sha1` only. Unsupported formats must fail fast before traversal/state consumption with:

`Unsupported repository object format: <format>. Supported formats: <supported-list>.`

Snapshot mode extracts commits independently of any prior state. The extraction range can be further controlled by `--since-ref` or `--since-date`.

#### No range filter (full snapshot)

For each specified `--ref`:

1. Resolve the ref to a commit OID via `GitAdapter.resolveRef()` (accepts branch name, tag, or raw commit OID)
2. Walk all commits reachable from that OID via `GitAdapter.walkCommits(head, excludeHash: undefined)`
3. Write each commit to output

#### `--since-ref`

1. Resolve `--since-ref` to a commit OID via `GitAdapter.resolveRef()` (accepts commit OID, tag name, or branch name)
2. For each specified `--ref`:

- Resolve the ref to HEAD OID
- Use the resolved since-ref OID as `excludeHash` in `GitAdapter.walkCommits(head, excludeHash)`
- The traversal yields only commits reachable from HEAD but **not** reachable from `excludeHash`

This is equivalent to `git log <since-ref>..<head>` and correctly handles merged branches. See "Merge Commit Handling" below.

#### `--since-date`

1. For each specified `--ref`:
   - Walk all commits reachable from HEAD (no `excludeHash`)
   - Filter: include only commits where `committer.timestamp` (as Unix seconds) is **after** the specified date
   - Use `committer.timestamp` (not `author.timestamp`) as the filter criterion
   - Use `continue` (not `break`) to skip old commits — do not abort the traversal when an old commit is encountered. BFS order across merge branches is not chronological: a newer commit from a merged branch may appear after an older one in BFS order, so early termination would silently drop commits.

### Incremental Mode

Incremental mode extracts only commits new since the last recorded state. Requires `--state`.

1. Read v2 state file and consume `refs[]` entries.
2. For each specified `--ref`:

- Resolve ref to current HEAD OID.
- Classify runtime `refType` (`branch`, `tag-lightweight`, `tag-annotated`, `commit-oid`).
- Match checkpoint by exact `(ref, refType)` identity.
- If matched: use checkpoint `tipOid` as `excludeHash`.
- If unmatched and `refType === "branch"`: optional merge-base fallback from existing branch checkpoints.
- If unmatched and non-branch: full traversal for that ref.
- Call `GitAdapter.walkCommits(head, excludeHash)`.

3. Maintain global `visited: Set<string>` across all refs.
4. On success: write state file with each resolved ref's current head as `tipOid`.

**Warning conditions**:

- Requested ref no longer exists in repository -> warn, skip.
- Stored boundary OID is unreachable (e.g. force-push) -> warn, full traversal for that ref.
- Static refs (`commit-oid`, `tag-annotated`) may emit informational warnings that incremental deltas are usually empty unless target changes.

### Incremental + `--missing-state snapshot` Fallback

When `--incremental` is specified with `--missing-state snapshot` and the state file does not
exist: behave as snapshot mode with no range filter (full traversal for all branches). Create
state file on success.

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

- **Snapshot mode**: State file content is **ignored** during extraction. On successful completion, the state file is written (created or overwritten) with each branch's current HEAD OID. This allows a snapshot run to initialize or reset state for subsequent incremental runs.
- **Incremental mode**: State file is **read** to determine the `excludeHash` per branch. On successful completion, the state file is updated with each branch's current HEAD OID.

### State File Records Tip OID, Not Filtered Range

When `--since-ref` or `--since-date` is used in snapshot mode with `--state`, each v2 `refs[]` entry records the ref's **current tip OID** (`tipOid`) — not the boundary of the filtered range. State reflects repository position at extraction time, independent of what was output.

**Warning condition**: If `--state` + `--since-ref` is used and a ref's HEAD is reachable from the since-ref (0 commits output), emit a warning to stderr: later incremental runs may include commits between that ref's `tipOid` and the since-ref boundary from this run.

### Read on Startup

If `--state` is provided and the file exists:

1. Parse and validate the JSON structure (check `version` field)
2. Resolve both the recorded `repositoryPath` and the provided `<repository-path>` to absolute paths using `path.resolve()` before comparing. Simple string equality on raw input will produce false mismatches when the same path is expressed differently (e.g. `./my-repo` vs `/home/user/my-repo`). If they do not match after resolution, abort with error:
   `State file was created for a different repository: <recorded-path>`
3. In incremental mode: for each requested ref, match v2 checkpoint by `(ref, refType)` and use `tipOid` as `excludeHash`
4. In snapshot mode: skip step 3 (state content is not used for extraction)

Compatibility rule: repository object format must be validated before step 3. If format is unsupported, abort before consuming `tipOid` values.

Note: the `repositoryPath` value written to the state file must also be the `path.resolve()`-ed absolute path, not the raw CLI input.

### Write on Completion

The state file is written **only after all output files are fully flushed and closed**.

Write atomically:

1. Write new content to `<statePath>.tmp`
2. Rename `<statePath>.tmp` → `<statePath>` (atomic on POSIX systems)

This ensures that a crash during output writing does not corrupt the state file.

### Ref Reconciliation

At the start of an incremental run using `--state`:

- Requested refs with no exact `(ref, refType)` checkpoint:
  - If runtime `refType === "branch"` and branch checkpoints exist in state, compute merge base from branch `tipOid` values and use it as `excludeHash`.
  - If runtime `refType` is non-branch (`tag-lightweight`, `tag-annotated`, `commit-oid`), do full traversal unless a direct checkpoint exists.
- State entries not referenced by this run are ignored and dropped on rewrite.
- Requested refs with exact checkpoint: differential extraction using stored `tipOid`.

After a successful run (in either mode), write v2 `refs[]` entries for all resolved refs processed in that run.

### Warning Conditions (non-fatal)

Log a warning (do not abort) when:

- A requested ref no longer exists in the repository.
- A stored checkpoint `tipOid` is no longer valid for traversal (e.g. force-push) -> fall back to full extraction for that ref.
- Runtime ref type is `commit-oid` or `tag-annotated` and state tracking is active: tracking works, but future incremental deltas are usually empty unless target changes.

A run that produces zero records (e.g. boundary equals head) is **not** a warning or error condition. The output sink is closed and the state file is written normally.

---

## Multi-Branch Traversal Order

When multiple `--ref` values are specified, each ref is traversed sequentially. Output lines from different refs are **not interleaved** — all commits from ref 1 are written before ref 2 begins.

The order of output follows the order of `--ref` arguments.

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

When a new branch is added to `--branch` in an incremental run, gitlode automatically deduplicates
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
Run 1: --ref main         → outputs [3, 2, 1]. state: { main: "3" }
Run 2: --ref main --ref develop
         main   → excludeHash = "3" (from state) → differential → no new commits in this example
         develop → new; existingHeads = ["3"]; findMergeBase → "3"
                   excludeHash = "3" → yields [5, 4] only ✅ (no duplicates)
```

**Fallback — no common ancestor:**

If `findMergeBase` returns `null` (e.g. an orphan branch with detached history), fall back to full
traversal for the new branch. Duplicate commits may appear in the output in this case.

Recovery: discard prior output and re-run in snapshot mode (no `--incremental` flag) across all
branches, then resume
incremental extraction.
