# gitlode Profiling Guide

gitlode's profiling output is a local diagnostic view for troubleshooting slow runs and for
developing extraction and traversal logic. It is exposed through the public `--profile` flag, but it
is not intended to be part of normal day-to-day extraction workflows or a stable machine-readable
contract.

Use profiling when you need to answer questions such as:

- Which phase dominates this run?
- How much time is spent walking commits?
- Did file-level extraction spend time in blob reads, diff computation, or output writing?

Profiling is deterministic and local. It does not require an external telemetry collector.

## Enabling Profiling

Pass `--profile` on the command line:

```bash
gitlode --profile -r main ./my-repo
```

You can also enable it from a configuration file with `runtime.profile: true`. The effective value is
`CLI --profile OR config runtime.profile`.

When profiling is enabled and the run succeeds, gitlode appends the profile block to stderr after
the normal completion summary. `--quiet` suppresses the profile block together with progress and
summary output.

## Output Shape

Example:

```text
Profile
  span                       :   total  calls     avg     max  details
  gitlode.run                :  18.40ms      1  18.40ms  18.40ms  git.adapter=isomorphic-git gitlode.granularity=commit gitlode.profile gitlode.result=success commits=120 records=120
  git.walk_commits           :   8.25ms      1   8.25ms   8.25ms
  gitlode.projection         :   3.75ms    120   0.03ms   0.20ms
  gitlode.output.write       :   2.10ms    120   0.02ms   0.10ms
```

Each row is an aggregate summary for spans with the same name:

| Column    | Meaning                                          |
| --------- | ------------------------------------------------ |
| `span`    | Stable span name for the measured operation      |
| `total`   | Total elapsed duration across all matching spans |
| `calls`   | Number of observed spans with that name          |
| `avg`     | Average duration per call                        |
| `max`     | Slowest observed call                            |
| `details` | Low-cardinality attributes, counters, and errors |

Rows are shown in the order their span names first appeared during the run. The output is designed
for quick comparison between runs, not as a stable machine-readable export format.

## Span Names

Useful span names include:

| Span name                                       | What it measures                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `gitlode.run`                                   | Overall extraction request                                               |
| `gitlode.planning`                              | Branch-planning work before traversal begins                             |
| `gitlode.traversal`                             | Commit traversal and commit-fact materialization                         |
| `gitlode.projection`                            | Fact-to-output-record mapping in the active projector                    |
| `gitlode.output.write` / `gitlode.output.close` | `OutputSink.write()` and `OutputSink.close()`                            |
| `git.walk_commits`                              | Adapter-level commit walk operation                                      |
| `git.blob_read`                                 | Blob reads inside `IsomorphicGitAdapter.getFileChanges()`                |
| `git.diff`                                      | Diff-stat computation inside `IsomorphicGitAdapter.getFileChanges()`     |
| `git.*` children                                | Additional Git-internal operations such as ref resolution and merge-base |

Span names are intentionally compact and dot-separated. A deeper name usually represents a local
sub-operation that only exists as part of the parent operation.

## Details

The `details` column can contain three kinds of diagnostic data:

- attributes: low-cardinality decisions or execution modes, such as `git.adapter=isomorphic-git`;
- counters: accumulated operational counts, such as `records=120` or `skipped_diffs=2`;
- errors: `errors=<n>` reports how many spans with that name ended with an error.

Boolean attributes are printed as a bare key when `true`, for example `gitlode.profile`. A boolean
`false` value is printed only when the code intentionally records it as meaningful.

## Adapter Diagnostics

The run-level `gitlode.run` span records `git.adapter` so profiling output shows which Git
implementation was selected. The current default is `isomorphic-git`. When `runtime.gitAdapter` is
set to `git-cli`, the same run-level span also records `git.cli.version` after validating the Git
executable with `git --version`.

`git.walk_commits` is the adapter-level span for commit traversal. Stage 2 intentionally removed the
old internal DAG node-read spans and read/cache counters such as `include_reads`, `exclude_reads`,
`cache_hits`, and `fallback_reads`. Detailed DAG traversal diagnostics should be redesigned in a
separate telemetry-focused effort around the new generic DAG / Git adapter boundary.

For `runtime.gitAdapter: "git-cli"`, compare `git.cli.rev_list` and `git.cli.cat_file_batch`
instead. For cross-adapter benchmarks, keep the repository snapshot and extraction request identical
and compare final counts rather than JSONL line ordering. See
[`design/git-adapters.md`](design/git-adapters.md) for adapter-specific benchmarking guidance.

## File-Level Extraction

In commit-granularity mode, file-expansion spans such as `git.blob_read` and `git.diff` do not
appear because `getFileChanges()` is never called.

In file-level mode (`--per-file`), these spans can help separate Git blob-read cost from diff-stat
cost. The `skipped_diffs` counter on `gitlode.extract` reports how many file-level diffs were
emitted with `null` additions/deletions due to either binary content or the `--max-diff-size`
guardrail.
