### Phase 2: Large Text-Diff Guardrail

_Add an explicit, user-controlled opt-in mechanism to skip line-level diff computation when file size exceeds a threshold, reducing extraction stalls on machine-generated large files while preserving full-diff behavior by default. When a diff is skipped, the output records null counts for additions and deletions, matching the existing null-count convention for binary files._

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `instructions/cli.instructions.md` — CLI option parsing and help-text grouping; new option belongs in "Output" group
- `instructions/schema.instructions.md` — output JSON schema and null-count representation for skipped diffs (same mechanism as binary files)
- `instructions/architecture.instructions.md` — ownership: guardrail logic lives in `FileChangeExpander`, cost decision belongs in Core, not Git adapter
- Roadmap item: "Extraction/CLI: User-controlled guardrail for very large text diffs"

#### Design Decisions

**1. CLI Option Name and Help Grouping**

- **Option**: `--max-diff-size <value>` (repeatable: no; optional: yes; takes size argument)
- **Help Group**: "Output" (because it affects per-file extraction cost)
- **Input Format**: Numeric value with optional binary suffix (K, M, G); same parser as `--rotate-size`
  - Accepts: `1000` (bytes), `100K`, `1M`, `500M`, etc.
  - Minimum: 1 byte (no artificial floor; users may set very low thresholds for testing)
  - Rationale: Consistent with `--rotate-size` naming and parsing; aligns with Git CLI conventions (option names do not explicitly encode units)
- **Default**: Disabled (feature is opt-in; no threshold by default)
- **Suggested value when enabled**: `100K` or `1M` (user choice; not enforced by CLI)
- **Help text**: `"Skip line-level diff computation for files exceeding this size (e.g. 100K, 1M). Skipped diffs are emitted with null additions/deletions counts. Default: disabled (off). Only applies with --per-file extraction mode."`

**2. Scope: Per-File Mode Only**

- The guardrail applies **only when `--per-file` is set**.
- In per-commit mode (default): line-level diff computation does not happen, so the guardrail has no effect; the option is silently ignored.
- Rationale: Diff cost exists only in per-file granularity; applying guardrail in per-commit mode would be silent no-op.

**3. Threshold Basis: Per-File, Each Side Independently**

- **Before and after sizes are checked independently** against the threshold.
- If **either** `before_size` **or** `after_size` exceeds the threshold, skip line-diff computation for that file.
- This matches how diff computation is actually costed: each side must be read and processed.
- Simpler and more predictable than total-change-size thresholds.

**4. Output Contract: Null Counts for Skipped Diffs**

- When a diff is skipped, the output record contains: `"additions": null, "deletions": null`
- This is the **same contract as binary files** — downstream consumers already handle null counts.
- No new output type or schema extension needed.

**5. Profiling and Audit Trail**

- Add `skipped_diffs: number` to profiling output hierarchy (under a new "extraction" section or as a top-level metric).
- When `--profile` is set, the profile block includes `skipped_diffs` count.
- Rationale: Users need visibility into fidelity impact; profiling is already opt-in; no need for runtime warnings.
- No stderr warnings for normal operation (feature is user-configured, not an error).

**6. Implementation Location: Core Layer (FileChangeExpander)**

- **Guardrail logic belongs in `FileChangeExpander`**, not in the Git adapter.
- Rationale:
  - The threshold is a **policy decision** (user configuration), not a Git primitive.
  - Core owns extraction policy; Git adapter owns Git primitives only.
  - By moving the check to `FileChangeExpander`, we avoid coupling `GitAdapter.getFileChanges()` to user policy.
  - Future Git backend implementations (e.g. libgit2) can avoid knowing about this threshold.
- Implementation approach:
  - `FileChangeExpander` receives `maxDiffSize` from `ExtractorConfig` (already converted to bytes by CLI parser).
  - Before yielding a file change, check if file sizes meet the threshold.
  - If threshold exceeded: set `additions = null, deletions = null` and skip requesting line-diff from adapter.
  - Adapter still provides `additions` and `deletions` normally when threshold is not hit.

**7. No Interaction with Exact-Content Rename Detection (Phase 3)**

- Phase 2 (guardrail) is **independent** of Phase 3 (exact-content rename detection).
- Guardrail affects `additions` / `deletions` values (becomes null).
- Rename detection operates at file-pair level (`path`, `status`) and requires file content matching.
- No blocking dependency; implementations can proceed in either order.
- After Phase 3: exact-content matching still works; rename detection is applied to non-skipped diffs.

**8. Backward Compatibility and State**

- Phase 1 introduces per-ref state tracking; Phase 2 does not depend on state format.
- The guardrail is extraction-time policy only; it does not affect state schema or incremental logic.
- State format remains compatible with both snapshot and incremental modes.

#### Non-Goals

- Introduce heuristic similarity-based diff algorithms (reserved for Phase 3+)
- Add automatic cost-based guardrail decisions without user control
- Apply guardrails to binary files (already handled with null counts; no special treatment needed)
- Modify state file schema or incremental extraction semantics
- Change default behavior (feature is opt-in only)

#### Target Files

| File                                       | Action | Notes                                                                                                                                                               |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/args.ts`                          | Modify | Parse `--max-diff-size` option; add to "Output" help group; validate size argument with binary suffixes (same parser as `--rotate-size`); handle optional/none case |
| `src/core/types.ts`                        | Modify | Add `maxDiffSize?: number` field to `ExtractorConfig` interface; add `skipped_diffs` to profiling entry hierarchy                                                   |
| `src/core/file-change-expander.ts`         | Modify | Implement threshold check before yielding file changes; set `additions = null, deletions = null` when skipped                                                       |
| `src/core/profiler.ts` (or profiler utils) | Modify | Track `skipped_diffs` count during extraction; include in profiling output                                                                                          |
| `test/cli/args.test.ts`                    | Modify | Add test cases for `--max-diff-size` parsing with various suffix formats (K, M, G), validation, and help grouping                                                   |
| `test/core/file-change-expander.test.ts`   | Modify | Add test cases for threshold logic, null-count output, and interaction with per-file/per-commit modes                                                               |
| `test/core/profiler.test.ts` (if exists)   | Modify | Verify `skipped_diffs` is correctly tracked and included in profile output                                                                                          |

#### Documentation Touchpoints

| File                                       | Section                             | Action | Notes                                                                                                                  |
| ------------------------------------------ | ----------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| `docs/usage.md`                            | "Large-file diff guardrail" (new)   | Add    | Describe `--max-diff-size`, default behavior, suggested values, suffix format (K, M, G), interaction with `--per-file` |
| `README.md`                                | CLI option reference or usage intro | Review | Likely no change needed; primary docs are in `docs/usage.md`                                                           |
| `.github/instructions/cli.instructions.md` | "Parameter Reference" table         | Update | Add `--max-diff-size` row to clarify option group, size format, and behavior                                           |

#### Implementation Notes

- **Size Parser Reuse**: The existing `parseRotateSizeBytes()` function in `src/cli/args.ts` handles binary suffix parsing (K, M, G). Consider extracting this into a generic `parseBinarySize()` helper function so both `--rotate-size` and `--max-diff-size` can share the same parsing logic and benefit from consistent validation and error messages. Alternatively, call `parseRotateSizeBytes()` directly from the `--max-diff-size` parsing path if extraction is not warranted. Either approach is acceptable; the key is to maintain a single source of truth for size parsing.
- **Size Determination**: File size (before and after blob sizes) should be obtained from the blob objects before diff computation. The Git adapter already has blob data; leverage that for size checks rather than re-reading.
- **Efficiency**: The threshold check is zero-cost when no `--max-diff-size` option is provided (no per-file overhead).
- **Profiling counter increments**: Increment `skipped_diffs` counter in `FileChangeExpander` each time a diff is skipped, regardless of the reason (large file or binary).
- **Testing strategy**:
  - Unit test: `FileChangeExpander` with mocked adapter and file changes of various sizes
  - Integration test: Run CLI with a repository containing files at/near/above threshold; verify output contains expected null counts and profile shows correct `skipped_diffs` count. Test with various suffix formats (e.g. `--max-diff-size 100K`, `--max-diff-size 1M`)
  - Regression test: Verify that `--max-diff-size` with `--per-file` not set produces the same behavior as before (no effect)

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```bash
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- [ ] Run `gitrail --help` and verify `--max-diff-size` appears in the "Output" section with correct help text mentioning suffix format (K, M, G)
- [ ] Extract a repository with `--per-file --max-diff-size 100K` and verify that large files have `null` counts in output while small files have numeric counts
- [ ] Extract the same repository with `--max-diff-size 1M` and verify different threshold behavior than 100K
- [ ] Extract with `--max-diff-size` using plain numeric value (e.g. `--max-diff-size 1000000`) and verify it works identically to `--max-diff-size 1M`
- [ ] Extract the same repository without `--max-diff-size` and verify numeric counts for all files (baseline)
- [ ] Extract with `--max-diff-size 100K` **without** `--per-file` flag and verify behavior is unchanged (no null counts, no effect)
- [ ] Run with `--profile` and verify `skipped_diffs` appears in profiling output with the correct count
- [ ] Verify backward compatibility: existing repositories and state files remain compatible
