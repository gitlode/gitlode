# Git Adapter Implementations

## Purpose

This document is the durable design contract for gitlode's Git adapter implementations and adapter
selection behavior. It complements `git-traversal.md`, which defines the user-visible traversal
semantics, and `commit-traversal-internals.md`, which documents the isomorphic-git adapter's internal
DAG traversal strategies.

## Adapter selection

Git adapter selection is config-only:

```json
{
  "version": 1,
  "runtime": {
    "gitAdapter": "isomorphic-git"
  }
}
```

Supported values:

- `isomorphic-git` — default.
- `git-cli` — hybrid adapter backed by the Git executable for traversal-oriented operations.

There is intentionally no CLI flag for adapter selection. The effective adapter is
`config runtime.gitAdapter OR "isomorphic-git"`.

Unknown adapter values are config validation errors. The generated JSON schema includes the default
value so editors and schema consumers can discover the unspecified behavior.

## Shared adapter contract

All adapter implementations must preserve these behavior-level contracts:

- `resolveRef()` resolves branches, tags, and raw commit OIDs to commit OIDs.
- `classifyRefType()` returns the runtime ref category used by traversal planning and state handling.
- `walkCommits(repoPath, start, exclude)` yields the set `reachable(start) - reachable(exclude)`.
- `getFileChanges()` returns the file-change facts needed by file-granularity extraction.
- `findMergeBase()` returns a lowest common ancestor or `null` when no common ancestor exists.
- Backend-specific failures are translated to `GitAdapterError` where callers depend on adapter-domain
  error codes.

Adapter-invariant correctness is based on result sets, not traversal order. Two adapters may yield
commits or file changes in different orders as long as the final commit set or file-change set is the
same for the same repository snapshot and extraction request.

## `isomorphic-git` adapter

`isomorphic-git` remains the default adapter because it does not require the Git executable at
runtime. This keeps the default gitlode runtime requirement smaller and preserves compatibility with
environments where invoking `git` is undesirable or unavailable.

The adapter performs commit traversal by reading commit objects and parent links through
isomorphic-git, then delegating to the internal DAG walker. With an exclusion boundary, the current
production strategy is the certified-lazy walker documented in `commit-traversal-internals.md`. That
strategy can avoid reading older excluded ancestors in certified cases, but it falls back to full
reachable-set subtraction when its conservative certificate does not hold.

## `git-cli` hybrid adapter

The `git-cli` adapter is selected with `runtime.gitAdapter: "git-cli"`. It requires the `git`
executable to be available on `PATH`.

Before repository traversal, the runtime validates the executable with:

```text
git --version
```

The detected version is recorded in profiling output as `git.cli.version`. Missing or non-executable
Git is treated as a user error during adapter construction rather than as an avoidable runtime error
during traversal.

### CLI-backed operations

The hybrid adapter uses Git CLI commands for traversal-oriented repository operations:

| Adapter operation             | Git CLI mechanism                                                  |
| ----------------------------- | ------------------------------------------------------------------ |
| Git executable validation     | `git --version`                                                    |
| Ref resolution / tag peeling  | `git -C <repo> rev-parse --verify <ref>^{commit}`                  |
| Object format lookup          | `git -C <repo> config --get extensions.objectFormat`               |
| Remote URL lookup             | `git -C <repo> config --get remote.origin.url`                     |
| Commit range traversal        | `git -C <repo> rev-list --topo-order <start> --not <exclude>`      |
| Commit metadata batch reading | `git -C <repo> cat-file --batch` fed by streamed `rev-list` stdout |
| Merge base lookup             | `git -C <repo> merge-base <oid...>`                                |

All commands are invoked with argv arrays rather than shell-interpolated command strings.

### Hybrid file-change boundary

The first `git-cli` implementation is deliberately hybrid. It delegates `getFileChanges()` to the
existing isomorphic-git file-change implementation. This preserves current binary detection,
line-diff behavior, byte-size handling, and root/merge commit behavior while allowing `git-cli` to
solve the traversal bottleneck that motivated the second adapter.

This means `runtime.gitAdapter: "git-cli"` does not imply every Git operation is CLI-backed. The
stable boundary is:

- CLI-backed: ref/object-format/remote/traversal/commit-metadata/merge-base operations.
- isomorphic-git-backed: file-change expansion.

## Profiling and troubleshooting

The run-level `gitlode.run` span records `git.adapter` for every run. When `git-cli` is selected, the
same span also records `git.cli.version`.

Adapter-specific child spans are intentionally low-cardinality. Current `git-cli` spans include:

- `git.cli.version`
- `git.cli.resolve_ref`
- `git.cli.repository_object_format`
- `git.cli.classify_ref`
- `git.cli.get_remote_url`
- `git.cli.rev_list`
- `git.cli.cat_file_batch`
- `git.cli.merge_base`

When comparing adapters, focus on:

- `git.adapter` and `git.cli.version` on `gitlode.run`;
- `git.walk_commits` for the isomorphic-git adapter;
- `git.cli.rev_list` and `git.cli.cat_file_batch` for the Git CLI adapter;
- yielded commit counts and final output record counts.

## Benchmarking guidance

Use profiling to compare adapters on the same repository snapshot and extraction request.

Recommended comparison shape:

1. Choose a repository with a large historical baseline and a small release delta.
2. Run the same `--ref` / `--since-ref` extraction once with `runtime.gitAdapter: "isomorphic-git"`
   and once with `runtime.gitAdapter: "git-cli"`.
3. Keep output mode, refs, range, state, and plugin configuration identical.
4. Compare profile rows and final counts, not JSONL line ordering.

Useful scenarios:

- `v9..v10` style release ranges where `reachable(v9)` is large and the delta is small.
- Merge-heavy histories where the isomorphic-git certified-lazy walker falls back.
- Commit-granularity extraction, which isolates traversal and commit metadata cost.
- File-granularity extraction, which shows the hybrid boundary: traversal may improve, while file
  expansion remains on the isomorphic-git path.

## Current limitations and future work

- File-change expansion remains isomorphic-git-backed. A full CLI file-change implementation can be
  considered later if file-granularity performance becomes the next bottleneck.
- Adapter selection is config-only. A CLI override remains out of scope unless future user workflows
  justify it.
- gitlode still gates repository object formats through the supported object-format profile; this
  work does not expand supported OID formats.
