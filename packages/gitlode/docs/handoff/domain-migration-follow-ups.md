# Domain Migration Follow-ups

## Status

Deferred until the domain migration is complete. These are candidates for separate behavior-changing
tasks, not part of the current structure-preserving migration.

The migration intentionally preserves externally observable strings and profiling identifiers even
when they retain vocabulary from the former ownership model. Evaluate each item independently after
the new domain structure has stabilized.

## Line-diff follow-ups

### Invalid-result error text

Current text:

```text
DiffAdapter returned invalid values: additions=..., deletions=...
```

The implementation contract is now named `LineDiffCalculator`, but this error can propagate to CLI
diagnostics. Step 1 therefore retained the old text.

Candidate follow-up:

- rename the subject to `LineDiffCalculator`;
- explicitly review the resulting CLI diagnostic change;
- update the assertion in `test/core/file-change-expander.test.ts`.

### Profiling span names

Current spans:

```text
git.file_changes
git.diff
```

`git.diff` now measures `LineDiffCalculator` work and is no longer owned by the `git` or `git-impl`
domains. `git.file_changes` measures extraction-side file-change expansion, although it includes
calls into Git repository access. Their `git.*` prefix therefore no longer accurately communicates
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
- `docs/handoff/instrumentation-opentelemetry-migration.md`, if that work is still active;
- tests that assert span names;
- any known external profiling consumers.

## Lifecycle

Add similar migration-deferred behavior or diagnostic changes here as they are discovered. Do not
mix ordinary domain-migration tasks into this document.

When every item has been evaluated, move any accepted stable profiling or diagnostic contracts to
their canonical documentation and delete this handoff document.
