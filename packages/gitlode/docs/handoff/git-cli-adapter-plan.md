# Git CLI Tree-Object Follow-up Handoff

## Purpose

This temporary handoff contains only continuation context for the unimplemented tree-object and
`cat-file --batch` process-management follow-up. Current behavior and implemented contracts are
defined in the durable documentation:

- [`../design/git-adapters.md`](../design/git-adapters.md)
- [`../design/architecture.md`](../design/architecture.md)
- [`../design/schema.md`](../design/schema.md)
- [`../profiling.md`](../profiling.md)

Update the affected durable documents during the follow-up. Delete this handoff after that work is
complete; do not retain it as implementation history.

## Goal

Replace per-commit CLI change discovery with persistent commit/tree object reads and structural tree
comparison while preserving the repository-fact boundary defined in the durable adapter design.

### Motivation

The current CLI file-change path discovers changes by starting one `git diff-tree` process per
commit, while file contents are read through one repository-scoped persistent
`git cat-file --batch` process. In one Windows profile covering 670 commits and 3,492 file changes,
the 670 `diff-tree` calls consumed about 35 seconds. The persistent CLI batch read 6,459 blob
objects faster than the isomorphic-git implementation, but the per-commit process startup cost
outweighed that gain.

The intended performance follow-up is therefore to read commit/tree objects through persistent
`cat-file --batch` transport and compare tree structure in TypeScript. This removes the
per-commit `diff-tree` process without moving line-diff or rename inference into `GitAdapter`.

### Two distinct batch usage models

The adapter currently has two uses of `cat-file --batch` with different ownership and flow-control
requirements:

1. **Random object requests**: file-blob reads issue a request for one OID and await its matching
   response. This session is reusable, serialized, and scoped to a repository. Future tree-object
   reads belong to this model.
2. **Commit streaming**: `walkCommits` pipes `git rev-list` output directly into a dedicated
   `cat-file --batch` process and yields the resulting commit objects. This process is scoped to a
   single walk and can be killed together with `rev-list` when the consumer stops or an error
   occurs.

The parser and process-close primitives are already shared. The remaining differences—process
spawn, stderr ownership, stdin ownership, cancellation, and response consumption—are the parts
most affected by the two usage models.

### Design decision

Unify low-level process management, but do not make the random-request and commit-stream paths
share one physical `cat-file --batch` process by default.

The target shape is conceptually:

```text
GitCatFileBatchProcess
  owns spawn, stdin/stdout, response parsing, stderr, close, and disposal

  ├─ GitCatFileBatchRequestSession
  │    one persistent instance per repository
  │    serialized readObject requests
  │    typed blob/tree wrappers
  │
  └─ GitCatFileBatchPipelineSession
       one dedicated instance per walkCommits invocation
       rev-list pipeline input
       commit-object stream output
```

The names are provisional; the important contract is the separation between a reusable
request/response lane and an isolated bulk-streaming lane.

### Why one physical process should not be shared yet

`cat-file --batch` is an ordered protocol without request IDs. The rev-list pipeline may submit
many commit OIDs before the consumer asks for a blob or tree. A blob request inserted into the same
process would be queued behind those commit responses, so a shared implementation would need a
central request dispatcher, FIFO response routing, draining rules, and head-of-line blocking
management.

Cancellation is the stronger concern. A dedicated commit-stream process can be killed when its
walk ends early. A repository-wide shared process cannot be killed while blob/tree consumers still
depend on it; already-submitted commit responses would instead have to be drained and discarded.
Sharing would also require explicit concurrency rules for multiple walks.

The expected process-startup saving is small in the common case: commit reads are already batched
within each walk, so combining the commit and random-request lanes usually removes only one process
per walk. This does not justify adding a multiplexing scheduler without benchmark evidence.

### Timing and implementation constraints

Perform the process-management refactor together with the direct tree-object follow-up. Doing it
earlier would risk restructuring the same boundary twice while affecting the already-fast commit
traversal path for little immediate performance gain.

The future implementation must preserve:

- raw added/modified/deleted blob facts without rename inference;
- regular-file, executable, symlink, and submodule transition semantics;
- file mode and object OID retention;
- consumer-paced blob materialization;
- repository-scoped disposal through `GitAdapter`'s `AsyncDisposable` contract;
- walk-local cancellation and error isolation for the rev-list pipeline; and
- separate instrumentation for process lifetime and individual object-read work.

Physical process sharing may be reconsidered only if later profiling shows a material benefit and
the request scheduling, response routing, and cancellation contracts are designed explicitly.
