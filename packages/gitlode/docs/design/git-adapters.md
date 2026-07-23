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
- `git-cli` — adapter backed by the Git executable for repository access and object reads.

There is intentionally no CLI flag for adapter selection. The effective adapter is
`config runtime.gitAdapter OR "isomorphic-git"`.

Unknown adapter values are config validation errors. The generated JSON schema includes the default
value so editors and schema consumers can discover the unspecified behavior.

## Shared adapter contract

All adapter implementations must preserve these behavior-level contracts:

- `resolveRef()` resolves branches, tags, and raw commit OIDs to commit OIDs.
- `classifyRefType()` returns the runtime ref category used by traversal planning and state handling.
- `walkCommits(repoPath, start, exclude)` yields the set `reachable(start) - reachable(exclude)`.
- `getFileBlobChanges()` yields added/modified/deleted file-backed blob facts, including path, object
  ID, Git file mode, and byte content for each present side. Its iteration order is unspecified.
- `findMergeBase()` returns a lowest common ancestor or `null` when no common ancestor exists.
- Backend-specific failures are translated to `GitAdapterError` where callers depend on adapter-domain
  error codes.
- `GitAdapter` is a run-scoped `AsyncDisposable` resource. The runtime that constructs it owns
  disposal; orchestration stages that receive it do not dispose it.

Adapter-invariant correctness is based on result sets, not traversal order. Two adapters may yield
commits or file changes in different orders as long as the final commit set or file-change set is the
same for the same repository snapshot and extraction request.

`GitAdapter` does not compute line-diff statistics, classify binary content, enforce
`--max-diff-size`, or infer renames. `DefaultFileChangeExpander` composes a `GitAdapter` with a
`DiffAdapter`, applies the size guard before binary detection, applies the 8,000-byte NUL heuristic,
and invokes the diff strategy only for eligible text content. Keeping these derived decisions above
repository access gives both Git backends one file-level output policy.

## `isomorphic-git` adapter

`isomorphic-git` remains the default adapter because it does not require the Git executable at
runtime. This keeps the default gitlode runtime requirement smaller and preserves compatibility with
environments where invoking `git` is undesirable or unavailable.

The adapter performs commit traversal by reading commit objects and parent links through
isomorphic-git, then delegating to the internal DAG walker. With an exclusion boundary, the current
default strategy is the certified-lazy walker documented in `commit-traversal-internals.md`. Internal experiments may select `phase-certified-fifo` or `phase-certified-timestamp` with `GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL`; this is not CLI/config/public API. That
strategy can avoid reading older excluded ancestors in certified cases, but it falls back to full
reachable-set subtraction when its conservative certificate does not hold.

## `git-cli` adapter

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

The adapter uses Git CLI commands for repository and object operations:

| Adapter operation             | Git CLI mechanism                                                  |
| ----------------------------- | ------------------------------------------------------------------ |
| Git executable validation     | `git --version`                                                    |
| Ref resolution / tag peeling  | `git -C <repo> rev-parse --verify <ref>^{commit}`                  |
| Object format lookup          | `git -C <repo> config --get extensions.objectFormat`               |
| Remote URL lookup             | `git -C <repo> config --get remote.origin.url`                     |
| Commit range traversal        | `git -C <repo> rev-list --topo-order <start> --not <exclude>`      |
| Commit metadata batch reading | `git -C <repo> cat-file --batch` fed by streamed `rev-list` stdout |
| Merge base lookup             | `git -C <repo> merge-base <oid...>`                                |
| File-blob change discovery    | `git -C <repo> diff-tree --raw --no-abbrev -r -z --no-renames ...` |
| File-blob content reading     | Repository-scoped persistent `git -C <repo> cat-file --batch`      |

All commands are invoked with argv arrays rather than shell-interpolated command strings.

### File-blob acquisition

`diff-tree` output is parsed as NUL-delimited raw A/M/D/T entries with rename detection disabled.
Regular files (`100644`), executable files (`100755`), and symbolic links (`120000`) are
file-backed blobs. Gitlinks/submodules (`160000`) are not blobs; transitions between a blob and a
gitlink become an added or deleted blob fact as appropriate. A mode-only change remains a modified
blob fact even when both sides have the same blob OID.

Change discovery buffers only path/OID/mode descriptors. Blob content is then materialized one
change at a time as the `AsyncIterable` consumer advances. Modified changes require both sides, but
later changes are not read eagerly.

The adapter owns one reusable file-blob `cat-file --batch` session per repository path. Requests are
serialized because batch responses are ordered and have no request IDs. The session remains alive
for the adapter run and is closed through `GitAdapter` disposal. Commit traversal currently retains
a separate walk-scoped batch process fed directly by `rev-list`; its bulk-streaming and cancellation
model differs from the reusable random-object session.

Both Git adapters stop at the same blob-fact boundary. `DefaultFileChangeExpander` performs binary,
size, and line-diff processing independently of which adapter produced the blobs.

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
- `git.cli.diff_tree`
- `git.cli.file_blob_batch`
- `git.cli.merge_base`

Shared file-level spans include `git.file_blob_changes`, `git.blob_read`, `git.file_changes`, and
`git.diff`. The long-lived batch spans measure process/session lifetime, not exclusive Git CPU time;
use `git.blob_read` to inspect individual object-read work.

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
- File-granularity extraction, comparing change discovery, blob reads, and shared diff cost as
  separate profile rows.

## Current limitations and future work

- The CLI file-change path currently starts one `diff-tree` process per commit. A planned follow-up
  will investigate reading tree objects through persistent `cat-file --batch` transport and
  comparing tree structure in TypeScript. Process-management and cancellation guidance is recorded
  in [`../handoff/git-cli-adapter-plan.md`](../handoff/git-cli-adapter-plan.md).
- Adapter selection is config-only. A CLI override remains out of scope unless future user workflows
  justify it.
- gitlode still gates repository object formats through the supported object-format profile; this
  work does not expand supported OID formats.
