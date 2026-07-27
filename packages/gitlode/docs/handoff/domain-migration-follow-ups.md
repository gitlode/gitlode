# Domain Migration Follow-ups

## Status

Deferred until the domain migration is complete. These are candidates for separate tasks that
change observable identifiers or require cross-boundary runtime refactoring, not part of the
current structure-preserving migration.

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

## State follow-ups

### Separate extraction checkpoint data from the state document schema

`ExtractionState` currently contains:

```text
version: 2
```

This version identifies the persisted state JSON schema. Extraction does not use it when planning or
performing a run, so including it in the Core-owned extraction contract leaks a persistence concern
into Core. Configuration already keeps the analogous document version in the config-owned
`ProjectConfigurationV1` model rather than in Core; state should be reviewed using the same
boundary.

Candidate follow-up:

- define a Core/extraction-api checkpoint model containing only information needed as extraction
  input or result;
- define a versioned state-document model in `state`, separate from the extraction checkpoint;
- make the state boundary validate and convert the persisted document into the extraction model on
  read;
- convert the extraction result into the current versioned document on write;
- keep version dispatch and unsupported-version diagnostics outside Core/extraction-api;
- decide whether any other persisted metadata belongs only to the state document while performing
  this review.

The change should preserve the current state JSON shape and user-facing behavior unless a separate
schema migration is explicitly approved. Review `StateStore` and `StateStoreValue`, state-file
loading and writing, composition-root mapping, incremental extraction tests, state design
documentation, and any future state JSON schema documentation together.

## Progress follow-ups

### Separate warnings from progress events

`ProgressEvent` currently includes:

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
  dependency-light contract outside `runtime`;
- keep progress limited to phases and quantitative progress if the separation is adopted;
- preserve warning ordering, quiet/TTY rendering, text, and failure behavior unless separately
  approved.

Review extraction warning producers, plugin-runtime warnings, worker messages, `RunPresenter`,
`ProgressController`, and their tests together. This is a protocol and presentation refactoring,
not part of the mechanical Step 3 domain move.

## Lifecycle

Add similar migration-deferred behavior or diagnostic changes here as they are discovered. Do not
mix ordinary domain-migration tasks into this document.

When every item has been evaluated, move any accepted stable profiling or diagnostic contracts to
their canonical documentation and delete this handoff document.
