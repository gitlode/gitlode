# gitrail — Feature Roadmap

This file records all planned improvements beyond the initial release: product features, CLI UX improvements, and development environment tasks.

Items are grouped by expected priority order within each section. Final ordering is subject to review.

This roadmap is intentionally organized by product priority and time horizon, not by release version. When an item is selected for a specific release, annotate it with lightweight metadata instead of moving it to a different section.

### Metadata Convention

Use the following field on selected items when needed:

- **Release target**: the intended version, such as `v0.1.4`

The intended document flow is:

- roadmap → future-facing backlog and release targeting
- plan → active implementation tracking
- changelog → released history

Execution status is intentionally not tracked in the roadmap for now. If that becomes necessary later, it should be redesigned based on an actual operational need rather than kept as a weak placeholder.

This keeps the roadmap stable for both humans and LLMs while still making release planning explicit.

---

## Product Improvements

### Near-term

#### CLI UX: Progress metrics quality and progress-display redesign

The current Phase 2 implementation reports progress using the number of written commits (`Processed N commits...`). This is better than having no runtime visibility, and it remains acceptable for v0.1.4, but it is not always a good proxy for actual elapsed work.

For example, runs that use a state file and ultimately write zero new commits can still spend substantial time traversing history or resolving repository state. In those situations, commit-count progress has only a weak relationship to elapsed time and user-perceived progress.

**Future improvement goals**:

- break the end-to-end extraction work into more meaningful phases and measure their durations separately
- analyze where time is actually spent during traversal, filtering, state handling, and output writing
- redesign progress reporting based on that evidence rather than using commit count alone
- keep the current Phase 2 behavior in v0.1.4 as a pragmatic baseline, but treat it as a first iteration rather than a final UX design

#### CLI UX: `--help` option grouping and discoverability

The `--help` output lists all options in a flat list with no grouping. The jump from "I want incremental extraction" to "I need `--state`" is non-obvious.

- Group options under section headers: **Output**, **Differential Extraction**, **File Rotation**
- Add a note to the `--state` description: "Primary mechanism for scheduled/incremental runs"
- Evaluate whether citty supports option grouping natively; if not, consider a custom help renderer

**Design resolution notes (v0.2.0 — deferred)**:

- citty does not support option grouping natively (confirmed at v0.2.0 design time). A custom help renderer would be required.
- Deferred on cost/value grounds: the option set (~10 options) is small enough to be readable without grouping, and gitrail usage patterns tend toward fixed, recurring invocations rather than exploratory CLI trial-and-error. The implementation cost of a custom renderer outweighs the discoverability benefit at this scale.
- `docs/usage.md` and README serve as the primary reference for workflow guidance in the interim.

---

#### Output: Prevent overwrite across extraction sessions

Current rotated output filenames such as `gitrail-000001.jsonl` restart from the same sequence on every invocation. If the tool writes to the same output directory repeatedly, previous results can be overwritten.

**Preferred direction for the first fix**: include the execution time or another session-specific identifier in the rotated filename so each run generates a unique series without requiring manual cleanup.

**Candidate approaches to evaluate during implementation**:

- **A)** Include the execution timestamp in the filename
- **B)** Continue the numeric sequence across sessions
- **C)** Refuse to overwrite an existing file unless an explicit overwrite flag is provided
- **D)** Consider other approaches if they provide a better balance of simplicity and safety

The current assumption is to start with **A** because it is the simplest way to prevent accidental overwrite. The exact naming scheme should still be reviewed at implementation time to balance readability, sort order, and operational safety.

---

### Medium-term

#### CLI spec: Explicit extraction mode and state ergonomics

**Release target**: v0.2.0

**Problem A — implicit intent**: A user who always intends full extraction but accidentally passes `--state` pointing to an existing file will silently get differential output. There is no explicit intent signal.

**Problem B — no force-full flag**: If a user has been using `--state` for incremental runs but wants a one-time full re-extraction (e.g. schema change upstream), they must manually delete the state file.

**Problem C — state file path always manual**: The user must pass `--state ./somewhere/state.json` on every invocation. A natural default would be co-locating it with the output files.

**Problem D — missing-state behavior not configurable**: If the state file is deleted or corrupted mid-series, the next run silently falls back to full extraction. Downstream DWH consumers may receive duplicate records.

**Candidate improvements**:

- `--mode full|incremental` flag to make intent explicit; `full` ignores state file content but still updates it after the run
- `--state-dir <dir>` option that auto-derives the state filename from `<output-prefix>` (e.g. `<dir>/<prefix>.state.json`), reducing per-invocation configuration
- `--on-missing-state error|warn|full` flag to control behavior when state file is expected but absent
- Document explicitly in README: state file does not survive ephemeral CI workspaces; recommend artifact caching strategies

**Design resolution notes (v0.2.0)**:

- Problems A, B, D addressed. Problem C (`--state-dir`) explicitly deferred beyond v0.2.0.
- `--mode` adopted values `snapshot|incremental` (not `full|incremental`). `snapshot` was chosen because it accurately describes "extract a cross-section of the DAG" regardless of whether a range filter is applied. `full` would be misleading when combined with `--since-ref` or `--since-date`.
- `--on-missing-state` adopted values `error|snapshot` (not `error|warn|full`). `warn` was not useful as a distinct value from `snapshot`. The fallback mode name `snapshot` was chosen for consistency with `--mode snapshot`.
- `--state` + `--since-ref` / `--since-date` is **permitted** in snapshot mode (state is a recording path only; range filter is independent). This reverses the prior mutual exclusion between `--state` and `--since-*`.
- `--since-commit` renamed to `--since-ref` to accept any Git ref (tag name, branch name, or commit hash). Resolved via `resolveRef()`.
- CI guidance documented in `docs/usage.md` (Typical Workflows § CI and ephemeral environments).

---

#### Correctness: Cross-run deduplication for newly added branches

When a branch is added to `--branch` in a subsequent run, its full traversal may output commits already extracted by a prior run via a different branch sharing history.

**Fix**: At run start, compute the merge base between the new branch and all branches already recorded in the state file. Use the merge base as `excludeHash` for the new branch's traversal.

- Requires `findMergeBase()` support in the Git Adapter
- Does not require storing all previously output hashes
- See `git-traversal.instructions.md` — "Future Work: Cross-Run Deduplication for New Branches"

---

#### Output: Configurable field inclusion/exclusion

- Add `--fields` or `--exclude-fields` CLI option
- Allows omitting PII fields such as `author.email`, `committer.email`
- Enables trimming output size for use cases that don't need all fields

---

### Long-term

#### Output: Branch reachability annotation per commit

Record which branch(es) each commit was reachable from at extraction time (e.g. `"branches": ["main", "develop"]` in the output JSON). This mirrors the view provided by IDEs such as IntelliJ IDEA's Git log, where each commit row shows the set of branches it belongs to.

**Why deferred**: Evaluated during the v0.2.0 CLI spec design session and explicitly scoped out due to the following implementation constraints:

- **Memory**: pre-computing the reachable set for every branch scales as O(commits × branches); for repositories with many long-lived branches this is prohibitive.
- **I/O cost**: `isomorphic-git` has no bulk object API — each `readCommit()` is a separate async call. Building per-branch reachability sets requires traversing the full history once per branch.
- **Streaming incompatibility**: the current architecture emits each commit immediately during BFS traversal. Branch attribution requires knowing all branch assignments before emitting, which requires holding the full result set in memory.

**Possible future directions**:

- Post-process an already-extracted snapshot: after all commits are written, re-traverse per-branch and annotate a secondary index file.
- Limit to a configurable set of branches (e.g. `--annotate-branches main,develop`) to bound the cost.
- Consider recording only the "most specific" branch (closest tip ancestor) as a heuristic.

---

#### Output: Repository metadata override

- Add `--repo-name` and `--repo-url` flags
- Override the auto-derived `repository.name` and `repository.url` fields in output
- Useful when remote origin is not set or when a canonical name is preferred

---

#### Output: Execution metadata line

- Optionally prepend a metadata line as the first record in each output file:
  ```json
  { "_meta": { "extractedAt": "2024-01-15T00:00:00Z", "extractorVersion": "1.2.0" } }
  ```
- Controlled by a `--meta` flag (off by default)

---

#### Output: Commit file diff stats

- For each commit, include an array of changed files with `path`, `status`, `additions`, `deletions`
- Made opt-in via `--include-files` flag (more expensive — requires tree comparison per commit)
- Implementation: requires `isomorphic-git`'s `walk()` API with tree diff

---

#### Output: File-level output mode

- New mode where each output record represents a single changed **file** within a commit (rather than the commit itself)
- Controlled by `--output-mode file` (default: `commit`)
- Depends on commit file diff stats being implemented first

---

#### Other future considerations

- **Additional rotation strategies**: by commit date (one file per month/year), by branch (one file per branch)
- **Ref pattern matching**: `--branch 'feature/*'` glob support (note: temporary branches introduce risk of capturing transient data — document trade-offs)
- **Streaming to stdout**: `--output -` to write to stdout for piping into other tools
- **Windows line endings**: `--line-ending crlf` flag (LF-only today; architecturally trivial to add)

---

## Development Environment Improvements

### Near-term

#### Refactor: Extractor boundary cleanup for runtime and I/O concerns

`src/core/extractor.ts` currently owns some runtime-specific mechanisms directly, including stderr progress/warning output, Node.js timing APIs, state-file I/O, and direct coupling to output metrics.

This works functionally, but it weakens the architectural boundary between stable core policy and volatile runtime concerns.

**Goal**:

- keep orchestration and extraction policy in the core layer
- move runtime and side-effect concerns behind explicit abstractions owned by the outer layers

**Candidate refactoring directions**:

- introduce a small reporting/progress interface instead of direct stderr writes
- introduce a clock abstraction instead of calling Node timing APIs directly in the core
- evaluate whether state persistence should move behind a dedicated state-store abstraction
- keep CLI presentation concerns in the CLI layer rather than the extractor itself

**Why this matters**:

- improves testability
- reduces infrastructure coupling in the core layer
- makes future feature work require fewer architecture decisions
- better aligns with the principle: **stable core, volatile edges**

#### Refactor: TypeScript `readonly` audit

All current interfaces and types (`RawCommit`, `GitAdapter`, `ExtractorConfig`, `RotationConfig`, `StateFile`, `OutputCommit`, etc.) are defined without `readonly` modifiers.

**Approach**:

1. Start with pure data/value types (interfaces used only as data carriers)
2. Mark all fields `readonly`
3. Work inward to classes/logic that construct or mutate them
4. Leave fields mutable only where there is a deliberate reason

Particularly: `RawCommit`, `OutputCommit`, `StateFile`, `ExtractorConfig` should be fully readonly. Collections used as read-only input (e.g. `branches: string[]`) should be `readonly string[]`.

---

### Long-term

#### Migrate to Node.js built-in TypeScript support

Node.js 22.6+ introduced `--experimental-strip-types` (stable in Node.js 23.6+ as `--strip-types`). This allows running `.ts` files directly without a separate `tsc` compile step.

**Current situation**: The project compiles with `tsc` → `dist/`; `package.json` `bin` points at compiled JS.

**Decision criteria**:

- Keep compiled-JS publishing for npm (broadest consumer compatibility)
- Add a `tsconfig.dev.json` for fast local iteration if needed
- Revisit seriously when Node.js ≥23 becomes the minimum LTS target
- Key changes when migrating: `"allowImportingTsExtensions": true`; remove `"js"` extensions from internal imports; separate `tsconfig.build.json` for publishing
