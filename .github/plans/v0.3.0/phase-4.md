# Phase 4: File-Level Output Mode (`--output-mode file`)

_Introduce the `--output-mode commit|file` CLI flag. When `file` mode is active, each output record represents a single changed file within a commit — carrying denormalized commit metadata plus file path, change status, and line-level diff statistics — wiring Phase 3's `getFileChanges()` adapter method into the CLI, Core, and Output layers._

## Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

## Design References

- [`instructions/schema.instructions.md`](../../instructions/schema.instructions.md) — "File-Level Output Schema" section
- [`instructions/architecture.instructions.md`](../../instructions/architecture.instructions.md) — layer responsibilities and component design
- [`instructions/cli.instructions.md`](../../instructions/cli.instructions.md) — CLI argument specification
- Roadmap item: "Output: File-level output mode"
- Phase 2 (`phase-2.md`) — `processBranch()` is the integration point for per-commit file diff calls
- Phase 3 (`phase-3.md`) — `GitAdapter.getFileChanges()` and `FileChange` type

## Design Decisions

- **CLI flag**:
  - Name: `--output-mode`
  - Values: `commit` (default) | `file`
  - No short alias (to avoid confusion with `-m` for `--mode`)
  - Description: `Output record granularity: "commit" (default) emits one record per commit; "file" emits one record per changed file within each commit`
  - No mutual exclusion with any existing flag — `--output-mode` is orthogonal to `--mode` (snapshot/incremental), `--state`, `--since-ref`, `--since-date`, and all rotation flags

- **ExtractorConfig extension**:

  ```typescript
  interface ExtractorConfig {
    // ... existing fields ...
    readonly outputMode: "commit" | "file";
  }
  ```

  Default value `"commit"` is set by CLI argument parsing, not by Core.

- **Output type** (`OutputFileRecord` in `output/types.ts`):

  ```typescript
  interface OutputFileRecord extends OutputCommit {
    readonly file: {
      readonly path: string;
      readonly status: "added" | "modified" | "deleted";
      readonly additions: number | null;
      readonly deletions: number | null;
    };
  }
  ```

  Extends `OutputCommit` to inherit all commit fields. The `file` object contains file-specific data. This uses structural extension rather than composition to keep the type hierarchy simple.

  Union type for the writer:

  ```typescript
  type OutputRecord = OutputCommit | OutputFileRecord;
  ```

- **Writer change**: `OutputWriter.write()` accepts `OutputRecord` instead of `OutputCommit`. Since the method body is `JSON.stringify(record) + "\n"`, no behavioral change occurs — only the type signature widens.

- **Core integration point**: Inside `processBranch()` (from Phase 2's decomposition). The per-commit loop becomes:

  ```
  for each commit from walkCommits():
    if outputMode === "commit":
      write commit record (existing behavior)
    else if outputMode === "file":
      call adapter.getFileChanges(repoPath, commit.oid, commit.parents[0])
      for each FileChange:
        map to OutputFileRecord and write
  ```

  Empty commits (no file changes) produce zero file records. This is correct — no changed files means no file-level output.

- **Mapping function**: Add `mapToOutputFileRecord(commit: RawCommit, fileChange: FileChange, repoName: string, remoteUrl: string | null): OutputFileRecord` alongside the existing `mapToOutputCommit()`. This reuses the same commit field mapping logic and adds the `file` object.

- **`commitsWritten` counter semantics**: In `file` mode, the counter tracks **records written** (one per file change), not commits processed. The `reporter.progress()` and `reporter.done()` calls reflect this count. The `ExtractionResult.commitsWritten` field name becomes misleading in file mode — rename to `recordsWritten` for clarity across both modes.

  **Breaking change note**: `ExtractionResult.commitsWritten` → `recordsWritten`. This is an internal type (not serialized to output), so no external compatibility concern. Rename consistently in all references.

- **File rotation**: Rotation thresholds apply per-record, same as today. In file mode, a single commit's file records may span rotation boundaries. This is correct — each record is self-contained.

- **Progress reporting**: `reporter.progress(recordsWritten)` reports the count of output records, not commits. In file mode, this increases faster than in commit mode (multiple records per commit). No special formatting change — the number still represents "lines written to output."

- **Owning layers**:
  - CLI: parse `--output-mode`, set `ExtractorConfig.outputMode`
  - Core: branch on `outputMode` inside `processBranch()`, call adapter, map records
  - Output: accept widened type
  - Git adapter: no changes (Phase 3 already added `getFileChanges()`)

- **New runtime dependencies**: none (Phase 3 already added `diff`).

## Non-Goals

- `--include-files` flag (embedded file array in commit records) — deferred beyond v0.3.0.
- Changing the default output mode from `commit` to `file`.
- Adding new rotation strategies specific to file mode.
- Performance optimization of the file diff pipeline — measure with real repositories first.
- Rename detection in the output schema.
- Filtering file records by path pattern (e.g., `--file-filter`).

## Target Files

| File                          | Action | Notes                                                                                                                        |
| ----------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/args.ts`             | Modify | Add `--output-mode` argument definition; pass `outputMode` into `ExtractorConfig`                                            |
| `src/core/types.ts`           | Modify | Add `outputMode: "commit" \| "file"` to `ExtractorConfig`; rename `commitsWritten` to `recordsWritten` in `ExtractionResult` |
| `src/core/extractor.ts`       | Modify | Branch on `outputMode` in `processBranch()`; add `mapToOutputFileRecord()`; update counter references                        |
| `src/output/types.ts`         | Modify | Add `OutputFileRecord` interface and `OutputRecord` union type                                                               |
| `src/output/writer.ts`        | Modify | Change `write()` parameter type from `OutputCommit` to `OutputRecord`                                                        |
| `src/output/index.ts`         | Modify | Re-export new types                                                                                                          |
| `test/core/extractor.test.ts` | Modify | Add test cases for `--output-mode file`: file records produced, empty commits, merge commits, counter semantics              |
| `test/cli/args.test.ts`       | Modify | Add test cases for `--output-mode` parsing and default value                                                                 |
| `test/output/writer.test.ts`  | Modify | Verify writer accepts `OutputFileRecord` (may just need type adjustment in existing tests)                                   |

## Documentation Touchpoints

| File                                                | Section                                         | Action                                                                               |
| --------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `.github/instructions/schema.instructions.md`       | "File-Level Output Schema"                      | Verify section matches implementation (added by this planning session)               |
| `.github/instructions/schema.instructions.md`       | "Future Schema Extensions"                      | Remove "file-level diff stats per commit" entry (replaced by file-level output mode) |
| `.github/instructions/architecture.instructions.md` | "Component Responsibilities — Core Logic Layer" | Update to mention output mode branching                                              |
| `.github/instructions/cli.instructions.md`          | CLI parameter table                             | Add `--output-mode` entry                                                            |

## Implementation Notes

- **`commit.parents[0]` for parentOid**: `RawCommit.parents` is `readonly string[]`. For root commits, `parents[0]` is `undefined`. The adapter's `getFileChanges()` accepts `parentOid?: CommitHash`, so passing `undefined` is correct. For the type cast: `commit.parents[0]` is `string | undefined`; cast to `CommitHash | undefined` using a type guard or assertion (the values come from `readCommit` and are valid 40-hex hashes).

- **`BranchRunContext` changes** (from Phase 2): The context already carries `writer` and `commitsRef` (renamed to `recordsRef`). No structural change to the context shape — just the field rename and the output-mode-dependent logic inside `processBranch()`.

- **Fake adapter for Core tests**: The existing test fakes for `GitAdapter` need a `getFileChanges()` stub. Return a configurable array of `FileChange[]` per commit OID to test Core's mapping and branching logic without real Git objects.

- **`ExtractionResult.commitsWritten` rename**: Search all references (tests, CLI output formatting) and update consistently. The CLI currently prints a summary using this field — update the message to say "records" instead of "commits" (or keep it context-aware: "commits" in commit mode, "file records" in file mode).

## Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks:**

- Run `gitrail <repo> --branch main --output-mode file` and confirm:
  - Output is valid JSONL with one record per changed file
  - Each record contains full commit metadata plus `file` object
  - `file.path`, `file.status`, `file.additions`, `file.deletions` are present and correctly typed
  - Root commit produces `"added"` entries for all files
  - Empty commits produce no output records
- Run `gitrail <repo> --branch main` (default mode) and confirm:
  - Output is identical to pre-Phase-4 behavior (commit-level records, no `file` field)
- Run `gitrail <repo> --branch main --output-mode file --mode incremental --state state.json` and confirm:
  - Incremental extraction works correctly with file-level output
  - State file is written on success
- Confirm file rotation works in file mode:
  - `--rotate-lines 10` with file mode triggers rotation at 10 file records
