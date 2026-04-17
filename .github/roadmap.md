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

### Medium-term

#### Refactor: `Extractor.run()` decomposition and structural clarity

`Extractor.run()` has grown incrementally as features were added across releases. The method currently handles five distinct concerns in sequence: session initialization, state file reading and validation, merge-base computation for new branches, per-branch traversal with fallback, and state file writing. Each concern is currently expressed as a flat block of imperative code within a single method body.

**Goals**:

- Extract each concern into a focused private method (e.g. `initializeStateMap()`, `computeNewBranchExclude()`, `processBranch()`, `buildExcludeHash()`)
- Reduce the cognitive load of `run()` to orchestration only: calling helpers in sequence, managing the writer lifetime, and propagating results
- Make future feature additions localized: a change to state-reading logic should touch only the state-reading helper, not the entire method

**On the "declarative" direction**:

Per-branch processing is naturally expressed as a `for...of` loop over `config.branches`. The architecture specification requires sequential, non-interleaved output (all commits from branch N before branch N+1 begins). Converting this to an `async forEach` or `Promise.all` pattern would risk violating this ordering guarantee and is explicitly out of scope. The intended "declarative" improvement is to extract the loop body into a named `processBranch(branch, context)` function — making the per-branch unit independently readable and testable — while keeping the loop itself as a sequential `for...of`.

**Candidate private method boundaries** (to be refined at implementation time):

- `initializeStateMap(): Promise<Map<string, CommitHash>>` — reads, validates, and populates the state map
- `computeNewBranchExclude(newBranches: Set<string>, stateMap: Map<string, CommitHash>): Promise<CommitHash | undefined>` — merge-base computation for cross-run deduplication
- `buildExcludeHash(branch: string, stateMap: Map, newBranchExclude: CommitHash | undefined): CommitHash | undefined` — `excludeHash` selection logic per branch
- `processBranch(branch, context): Promise<void>` — ref resolution, commit walk, fallback, and write loop for a single branch

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

#### Output: stdout support and stream-based OutputWriter

Add `--output -` to write to stdout, enabling output to be piped into other tools directly.

At this point, `OutputWriter` should be redesigned around Node.js `Writable` streams rather than the current `FileHandle`-based implementation. Rewriting to a stream-based model is not warranted today — the CLI-only, batch-run use case does not benefit from it — but stdout output introduces the need to write to heterogeneous sinks (file vs. stdout), which is where the `Writable` abstraction pays off.

**Key design notes**:

- When writing to stdout, file rotation has no meaning and must be disabled or ignored gracefully.
- The `OutputWriter` abstraction could accept a `Writable` (or `AsyncIterable` sink) rather than owning file I/O directly. This removes the need for `OutputWriter` to implement rotation internally for the stdout path.
- Consider whether third-party rotation libraries (e.g. `rotating-file-stream`) become worthwhile once the file-writing path is expressed as a `Writable` pipeline. Currently the rotation logic is ~5 lines and an external dependency is not justified; evaluate at implementation time.

**Why deferred**: No current user need for stdout output. Refactoring `OutputWriter` solely for stream architecture hygiene would be over-engineering without a concrete requirement.

---

#### Other future considerations

- **Additional rotation strategies**: by commit date (one file per month/year), by branch (one file per branch)
- **Ref pattern matching**: `--branch 'feature/*'` glob support (note: temporary branches introduce risk of capturing transient data — document trade-offs)
- **Windows line endings**: `--line-ending crlf` flag (LF-only today; architecturally trivial to add)

---

## Development Environment Improvements

### Near-term

#### Preparation: Introduce `erasableSyntaxOnly` and refactor non-erasable syntax

**Background and purpose**:

The roadmap item "Migrate to Node.js built-in TypeScript support" (see Long-term section) requires that source code avoid TypeScript syntax that cannot be stripped at runtime — specifically syntax that has runtime semantics and cannot be removed by a simple type-erasing transform. The `erasableSyntaxOnly` compiler flag enforces this constraint statically.

Introducing this flag well before the actual migration serves two purposes:

1. **Prevent regression**: any future code addition that introduces non-erasable syntax (e.g. parameter properties, `const enum`, legacy decorators, `namespace`) will be caught by `tsc` and CI immediately, rather than discovered at migration time.
2. **Prove readiness**: once the flag compiles cleanly, the codebase is structurally ready for `--strip-types`-based execution, independent of when the migration actually happens.

**Work items**:

- Add `"erasableSyntaxOnly": true` to `tsconfig.json`
- Refactor all non-erasable syntax to comply. Based on the current codebase, the only known instance is the parameter property in `NodeStateStore` (`src/index.ts`); expand the field declaration explicitly

**Why now**: The required refactoring is minimal (one site) and mechanically straightforward. The cost of introducing the flag early is low; the cost of discovering violations late — after more code has been written — grows over time.

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
