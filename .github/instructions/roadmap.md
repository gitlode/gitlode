# gitrail — Feature Roadmap

This file records planned extensions beyond the initial implementation. Items here are **out of scope for Phase 1** but should be kept in mind during architecture decisions to avoid painting into a corner.

---

## Phase 1 — Initial Implementation (current scope)

- Commit-level extraction with fixed schema
- JSON Lines output with `\n` line endings
- Branch-based traversal (one or more refs as starting points)
- Full and differential extraction (`--state`, `--since-commit`, `--since-date`)
- File rotation by line count and byte size
- Output filename prefix derived from remote origin
- State file for incremental run management

---

## Phase 2 — Schema & Output Extensions

### Cross-Run Deduplication for Newly Added Branches

- When a branch is added to `--branch` mid-operation, its full traversal may output commits already extracted by a prior run via a different branch
- Fix: compute the merge base between the new branch and all existing branches at run start, use it as `excludeHash` for the new branch's traversal
- Requires `findMergeBase()` support in the Git Adapter; does not require storing all previously output hashes
- See `git-traversal.instructions.md` — "Future Work: Cross-Run Deduplication for New Branches"

### Configurable Field Inclusion/Exclusion

- Add `--fields` or `--exclude-fields` CLI option
- Allows omitting PII fields such as `author.email`, `committer.email`
- Enables trimming output size for use cases that don't need all fields

### Repository Metadata Override via CLI

- Add `--repo-name` and `--repo-url` flags
- Override the auto-derived `repository.name` and `repository.url` fields
- Useful when remote origin is not set or when a canonical name is preferred

### Execution Metadata Line

- Optionally prepend a metadata line as the first record in each output file
- Schema:
  ```json
  {
    "_meta": {
      "extractedAt": "2024-01-15T00:00:00Z",
      "extractorVersion": "1.2.0"
    }
  }
  ```
- Controlled by a `--meta` flag (off by default)

### Commit File Diff Stats (Phase 2 priority)

- For each commit, include an array of changed files with:
  - `path`: file path
  - `status`: `added` | `modified` | `deleted` | `renamed`
  - `additions`: number of added lines
  - `deletions`: number of deleted lines
- Implementation note: requires `isomorphic-git`'s `walk()` API with tree comparison; more expensive than commit-only traversal — consider making it opt-in via `--include-files`

---

## Phase 3 — File-Level Output Mode

- New output mode where each output record represents a single changed **file** within a commit (rather than the commit as a whole)
- Each line would contain both commit metadata and file-specific fields
- Controlled by a `--mode` flag: `--mode commit` (default) vs `--mode file`
- Depends on Phase 2 file diff stats being implemented first

---

## Future Considerations (no timeline)

### Additional Rotation Strategies

- Rotation by commit date (e.g. one file per month, one file per year)
- Rotation by branch (one file per branch)

### Windows Line Ending Option

- Add `--line-ending crlf` flag
- Initial implementation is LF-only; this can be added without architectural changes

### Ref Pattern Matching for `--branch`

- Support glob patterns: `--branch 'feature/*'`
- Note: temporary branches introduce risk of capturing transient data; document this trade-off

### Streaming Output to stdout

- Allow `--output -` to write to stdout instead of files
- Useful for piping into other tools

### Progress Reporting

- Add `--progress` flag to emit progress to stderr during large extractions
