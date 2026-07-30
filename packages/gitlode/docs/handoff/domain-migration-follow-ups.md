# Domain Migration Follow-ups

## Status

The domain migration is complete. Each follow-up remaining in this document is a candidate for a
separate task because it changes observable identifiers or requires cross-boundary runtime
refactoring.

The migration intentionally preserved externally observable strings and profiling identifiers even
when they retained vocabulary from the former ownership model. The descriptions below record the
resulting repository state, not a sequence of migration steps. Unless a path starts with
`packages/`, it is relative to `packages/gitlode`.

When resuming this work in another session:

1. Treat each top-level follow-up as an independent task and confirm that its described current
   state still matches the referenced source.
2. Read the linked canonical design documentation before choosing a replacement contract.
3. Obtain approval for any observable diagnostic, profiling, protocol, or file-format change.
4. Update source, tests, and canonical documentation together; do not use this handoff document as
   the final source of truth for an accepted contract.

## Line-diff follow-ups

### Profiling span names

Current spans:

```text
git.file_changes
git.diff
```

`src/extraction/file-change-fact-expander.ts` creates both spans. `git.diff` measures
`LineDiffCalculator` work and is not owned by the `git` or `git-impl` domains.
`git.file_changes` measures extraction-side file-change expansion, although it includes calls into
Git repository access. Their `git.*` prefix therefore does not accurately communicate current
ownership.

Candidate follow-up:

- choose names based on the stable responsibility being measured, such as extraction-side
  file-change expansion and line-diff calculation, rather than the former directory;
- decide whether both spans should share one namespace or retain separate extraction and line-diff
  namespaces;
- review the existing `changes`, `diffs`, `skipped_size`, and `skipped_binary` counters at the same
  time, without changing their meaning accidentally;
- keep Git-adapter-owned spans such as `git.file_blob_changes` and `git.blob_read` separate unless
  their ownership also changes.

Renaming spans affects profiling output rather than extraction results. Update all references and
examples in:

- `docs/profiling.md`;
- `docs/design/architecture.md`;
- `docs/design/git-adapters.md`;
- `docs/handoff/instrumentation-opentelemetry-redesign-plan.md`, if that work is still active;
- tests that assert span names;
- any known external profiling consumers.

## Progress follow-ups

### Separate warnings from progress events

`src/progress/types.ts` currently includes:

```text
{ type: "warning"; message: string }
```

A warning is a diagnostic rather than a description of run progress. The worker protocol also has a
separate diagnostic channel, so retaining warnings in `ProgressEvent` leaves two paths for similar
messages and weakens the otherwise presentation-independent progress charter.

Candidate follow-up:

- define one host-facing diagnostic contract and ownership model;
- route extraction and plugin warnings through that contract rather than through `ProgressEvent`;
- decide whether the existing worker diagnostic channel can serve this role or needs a
  dependency-light contract outside `execution`;
- keep progress limited to phases and quantitative progress if the separation is adopted;
- preserve warning ordering, quiet/TTY rendering, text, and failure behavior unless separately
  approved.

Review extraction warning producers, plugin-runtime warnings, worker messages, `RunPresenter`,
`ProgressController`, and their tests together. This is a protocol and presentation refactoring,
not a directory-only cleanup. Current producers can be found by searching for
`type: "warning"` in `src/extraction`, `src/plugin-runtime`, and `src/execution`; the separate worker
diagnostic message is defined in `src/execution/types.ts`.

## Lifecycle

Add similar migration-deferred behavior or diagnostic changes here only when they need continuation
context that does not yet belong in canonical documentation. Do not add ordinary maintenance tasks
or completed migration history.

When every item has been evaluated, move any accepted stable profiling or diagnostic contracts to
their canonical documentation and delete this handoff document.
