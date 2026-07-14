# `--max-diff-size` Diff-Skip Handoff

## Purpose

This handoff records a mismatch between the documented purpose of `--max-diff-size` and the current
execution order. It is continuation context for a future implementation session; it does not define
the final design.

## Status

Investigation only. No fix has been implemented or selected.

## Observed behavior

The CLI and usage documentation describe `--max-diff-size` as skipping line-level diff computation
when either side of a file change exceeds the configured byte threshold. The output behavior is
correct in that such records contain `additions: null` and `deletions: null`, but the expensive diff
has already been computed before the size check runs.

The current call path is:

1. `FileChangeExpander.expand()` calls `GitAdapter.getFileChanges()`.
2. `IsomorphicGitAdapter.getFileChanges()` reads the relevant blob contents.
3. `_buildFileChange()` invokes `DiffAdapter.computeLineDiff()` for non-binary content.
4. `getFileChanges()` returns a `FileChange` containing byte sizes and computed counts.
5. Only then does `FileChangeExpander.shouldSkipDiff()` compare `beforeSize` and `afterSize` with
   `maxDiffSize` and replace the already-computed counts with `null`.

Relevant files:

- `src/core/file-change-expander.ts`
- `src/git/types.ts`
- `src/git-impl/isomorphic-git-adapter.ts`
- `src/git-impl/git-cli-adapter.ts`
- `src/runtime/execution.ts`
- `docs/design/cli.md`
- `docs/usage.md`
- `docs/profiling.md`

## Why this matters

- The option currently protects the output contract but does not provide the advertised diff-CPU
  guardrail.
- Large text blobs can still dominate `git.diff` time even when their counts are ultimately emitted
  as `null`.
- The `skipped_diffs` diagnostic can therefore be misread as work avoided rather than results
  discarded after computation.
- This boundary becomes more important if future diff statistics, such as token- or
  replacement-based measures, make computation more expensive.

Blob content is still needed by the current isomorphic-git path for binary detection, and the
existing implementation obtains byte sizes from the loaded content. A future fix should distinguish
"skip diff computation" from "skip blob reading" rather than assuming both can be avoided.

## Candidate directions to investigate

The final design should be chosen during the fixing session. Plausible directions include:

1. Pass a diff-size policy or threshold into the file-change implementation so it can check sizes
   after reading content but before calling `DiffAdapter`.
2. Add a request/options object to `GitAdapter.getFileChanges()` so Core can request bounded diff
   computation without making the adapter depend directly on CLI concepts.
3. Split file metadata/content discovery from diff-stat computation, allowing Core or an
   orchestration layer to decide whether statistics should be computed.
4. For a future Git CLI-backed file-change implementation, use repository-aware size metadata or a
   batched command path to avoid transferring oversized blob contents when practical.

Avoid adding `maxDiffSize` directly to `DiffAdapter.computeLineDiff()` without first deciding which
layer owns skip policy. `DiffAdapter` currently receives only raw text content and is intended to
compute statistics, while the decision to emit unavailable statistics is a broader extraction
policy.

## Questions for the fixing session

- Should the threshold be part of the `GitAdapter.getFileChanges()` request, a separate
  file-change service, or adapter construction dependencies?
- Must all `GitAdapter` implementations enforce identical skip behavior, including the hybrid
  `GitCliAdapter` delegation path?
- Should an oversized file and a binary file remain indistinguishable as
  `additions: null`/`deletions: null`, or is an internal unavailable-reason useful for diagnostics?
- Should `skipped_diffs` count only size-based skips, or continue combining binary and size-based
  unavailable results?
- Can blob size be obtained without materializing content in each supported backend, and is that
  optimization worth the additional complexity?
- How should the threshold interact with any future additional diff statistics?

## Suggested tests and evidence

- Inject a counting `DiffAdapter` and verify that it is not invoked when either side exceeds the
  configured threshold.
- Verify that it is invoked at and below the threshold; current behavior uses a strict `>` check.
- Cover added, modified, deleted, root-commit, binary, and zero-length files.
- Cover both runtime adapter selections so the hybrid delegation does not bypass the policy.
- Preserve the current output behavior: oversized files are emitted with null counts rather than
  omitted.
- Use profiling to confirm that oversized text files no longer contribute diff computation work;
  separately record or inspect any remaining blob-read cost.
- Update `docs/design/cli.md`, `docs/usage.md`, `docs/profiling.md`, and durable architecture/design
  documentation if the ownership boundary or diagnostics change.

## Suggested starting prompt

```text
Continue the `--max-diff-size` work recorded in
packages/gitlode/docs/handoff/max-diff-size-skip.md.

Confirm the current execution order, decide the durable ownership boundary for the size policy,
then implement a fix so oversized text files do not invoke the line-diff engine. Preserve the
existing output contract and cover both Git adapter selections. Update canonical design/user
documentation and profiling semantics as affected, then run the required tests and formatting
checks.
```

## Handoff lifecycle

Once fixed, migrate durable behavior and ownership decisions to the appropriate documents under
`docs/design/`, `docs/usage.md`, and `docs/profiling.md`, then remove or shorten this handoff so it
cannot be mistaken for the current contract.
