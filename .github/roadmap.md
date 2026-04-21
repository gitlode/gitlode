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

#### CLI UX: Parameter model redesign for extraction and output grain

The current CLI parameter system mixes multiple conceptual axes in a way that is technically
usable but not clean from a user-experience perspective. In particular, the combination of
`--mode snapshot|incremental`, `--output-mode commit|file`, and `--on-missing-state` exposes an
inconsistent parameter model: one axis is expressed as a generic `mode`, another as a prefixed
`output-mode`, and the fallback behavior is named relative to the current implementation rather
than the underlying extraction model.

This should be treated as a **UX-level design bug**, not as a cosmetic naming issue. The problem
is not limited to `--output-mode`; the full parameter system around extraction intent, output
grain, and missing-state fallback should be redesigned together.

**Decision taken from design discussion**:

- replace `--mode snapshot|incremental` with boolean `--incremental`
- replace `--output-mode commit|file` with boolean `--per-file`
- replace `--on-missing-state error|snapshot` with `--missing-state=error|snapshot`
- keep `snapshot` as an execution-model term in documentation and fallback semantics, but remove
  it as a top-level CLI value

**Resulting parameter model**:

- default behavior: snapshot extraction
- `--incremental`: extract only commits newer than the last recorded state
- `--state <path>`: required with `--incremental`; without `--incremental`, acts as a write-only
  recording path on successful snapshot extraction
- `--missing-state=error|snapshot`: valid only with `--incremental`
- `--per-file`: emit one record per changed file; without it, emit one record per commit

**Important design rationale**:

- `--incremental` expresses user intent directly and removes the overly abstract `mode` parameter
- snapshot remains an important concept in gitrail because it communicates independent extraction
  from a mutable DAG-backed repository state; this meaning should remain in docs and behavior even
  if it is no longer exposed as a CLI enum value
- the core output grain should be treated as `commit|file`; finer-grained interpretation should be
  handled later, if needed, through enrichment or pipeline extensions rather than by expanding the
  default CLI grain model
- `--missing-state=error|snapshot` is preferred over alternatives such as `ignore` or `full`
  because it names the actual fallback behavior precisely

**Detailed design expectations**:

- treat this parameter model as the baseline for the detailed design phase rather than reopening
  the high-level direction from scratch
- verify the mutual-exclusion rules and help text against the new model
- update all user-facing documentation together so the new terminology is introduced consistently
- design migration messaging appropriate for a pre-v1 CLI, where breaking changes are acceptable
  but should still be explicit

#### CLI UX: Progress metrics quality and progress-display redesign

The current Phase 2 implementation reports progress using the number of written commits (`Processed N commits...`). This is better than having no runtime visibility, and it remains acceptable for v0.1.4, but it is not always a good proxy for actual elapsed work.

For example, runs that use a state file and ultimately write zero new commits can still spend substantial time traversing history or resolving repository state. In those situations, commit-count progress has only a weak relationship to elapsed time and user-perceived progress.

**Future improvement goals**:

- break the end-to-end extraction work into more meaningful phases and measure their durations separately
- analyze where time is actually spent during traversal, filtering, state handling, and output writing
- redesign progress reporting based on that evidence rather than using commit count alone
- keep the current Phase 2 behavior in v0.1.4 as a pragmatic baseline, but treat it as a first iteration rather than a final UX design

**Design dependency**: This redesign should be approached together with the "Granular performance profiling" item (see Medium-term section). Progress display redesign requires knowing what is measurable; performance profiling provides that evidence. Design both together in the same release.

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

#### CLI UX: `--rotate-size` human-readable size suffixes

`--rotate-size` currently accepts a raw byte count. In practice, users specify thresholds like 500 MB or 1 GB, making raw byte values impractical to type and error-prone to read.

Supporting suffixes such as `--rotate-size 500M` or `--rotate-size 1G` would align the option with the conventions used by popular CLI tools (e.g. GNU `split`, `logrotate`).

**Considerations to resolve at implementation time**:

- Which suffixes to accept (`K`, `M`, `G`; case-insensitive or not)
- Base convention: binary (1 K = 1024) vs. decimal (1 K = 1000) — survey popular CLI tools for the dominant convention at implementation time
- Whether to continue accepting a plain integer as a raw byte count for backward compatibility
- Error message wording for unrecognized suffix values

---

#### CLI UX: Warn on unknown CLI arguments

Currently, citty parses arguments with `strict: false` (inherited from `node:util.parseArgs`), which means unrecognized options are silently ignored. A typo such as `--rotate-line` (instead of `--rotate-lines`) passes through without any diagnostic, and the option simply has no effect. This is indistinguishable from a bug in the program itself.

Most mainstream CLI frameworks treat unknown arguments as an error or at minimum a warning (e.g. `argparse` exits with code 2, `commander` errors by default, `yargs` with `strict()` mode). The current behavior is inconsistent with user expectations and can be considered a usability defect.

**Reference behavior: git**:

git is the primary CLI reference for gitrail's UX standards. Although many users interact with git through IDEs or GUI clients rather than the terminal directly, gitrail operates on local git repositories — making git's own CLI conventions the most relevant baseline. When users do invoke gitrail manually, the mental model they bring is shaped by git's behavior.

git treats unknown options as fatal errors and exits immediately without performing any work:

```
$ git log --unknown-option
fatal: unrecognized argument: --unknown-option
# exit code: 128
```

This means the expected behavior for gitrail is also **error on unknown arguments, exit non-zero, perform no extraction**. A `console.warn`-and-continue approach (warn but proceed) is inconsistent with this baseline and should be considered a fallback only if implementation constraints prevent a clean error path.

**Fix directions to evaluate at design time**:

- **`setup()` hook approach**: In the `defineCommand` `setup()` hook, compare `rawArgs` against the set of known option names (including aliases and kebab/camelCase variants) and emit a `console.warn` to stderr for each unrecognized option. Low implementation cost; no dependency changes.
- **citty issue / upstream fix**: File a feature request upstream to expose a `strict` mode option. Monitor for resolution before implementing locally.
- **Library migration**: `commander` and `yargs` have built-in strict modes, but migrating away from citty is a larger architectural change and is not warranted for this issue alone.

**Design considerations**:

- Warnings should go to stderr so they are not captured by output redirection.
- `--quiet` suppresses progress and summary output but should **not** suppress unknown-argument warnings — a silent typo with `--quiet` would be the hardest failure mode to diagnose.
- Positional arguments and `--` passthrough must be excluded from the unknown-option check.
- The warning message should suggest the closest known option name (edit-distance heuristic) if feasible.

---

### Medium-term

#### Development: Granular performance profiling

Add per-phase timing instrumentation to measure where time is actually spent during extraction. The target granularity is: DAG traversal, blob reads, diff computation (per-file), and output writing.

**Motivation**: File-level output mode (`--output-mode file`, introduced in v0.3.0) computes a tree diff for every commit, which increases processing time proportionally to the number of changed files. If performance is unacceptable on large repositories, the root cause needs to be identified precisely before any mitigation is considered — including the possibility of replacing isomorphic-git with a different Git backend.

**Design considerations**:

- Expose timing data in `ExtractionResult` (e.g. `timings: { traversalMs, blobReadMs, diffMs, writeMs }`) for programmatic access and test coverage
- Consider a `--profile` flag to print per-phase timing to stderr (off by default to avoid changing default output)
- Instrument `GitAdapter.getFileChanges()` separately from commit traversal, since diff cost scales with file count per commit
- Measure first on real repositories of varying sizes; optimize only where evidence shows a bottleneck

**Why deferred to v0.3.1**: The target of this measurement is v0.3.0's file-level output performance. v0.3.0 must be complete before meaningful baseline data exists. Implementing instrumentation before the feature exists would mean measuring against an incomplete workload.

---

#### Architecture: Diff algorithm abstraction within `IsomorphicGitAdapter`

Introduce a `DiffAdapter` interface as an internal strategy within `IsomorphicGitAdapter`,
injectable via its constructor. This makes the line diff algorithm swappable without changing the
`GitAdapter` interface that core depends on.

**Motivation**:

- **Performance**: The `diff` package used today is a pure-JS implementation. A native (e.g.
  WebAssembly-backed) diff algorithm could significantly reduce per-commit processing time in
  `--per-file` mode, where a tree diff and line diff are computed for every changed file. The
  diff abstraction makes it possible to benchmark and swap implementations without touching
  anything outside `IsomorphicGitAdapter`.
- **Algorithm interchangeability**: Different diff algorithms (Myers, patience, histogram) produce
  different `additions`/`deletions` counts for the same file pair. Making the algorithm explicit
  and swappable ensures that the implementation choice is a deliberate, testable decision rather
  than an implicit consequence of whichever library was installed.

**Key design constraint — `DiffAdapter` must not surface to core**:

If a future Git backend (e.g. a libgit2-based adapter) computes tree diff and line diff as a
single native operation, splitting them at the `GitAdapter` boundary would be counterproductive.
To avoid this, `DiffAdapter` is scoped strictly as an implementation detail of
`IsomorphicGitAdapter`:

- `GitAdapter` interface remains unchanged
- `IsomorphicGitAdapter` accepts a `DiffAdapter` via constructor injection
- A future `Libgit2Adapter` would implement `GitAdapter` independently and would not use
  `DiffAdapter` at all

**Sketch**:

```ts
interface DiffAdapter {
  computeLineDiff(
    before: Uint8Array,
    after: Uint8Array,
  ): { additions: number; deletions: number } | null; // null = binary
}

class IsomorphicGitAdapter implements GitAdapter {
  constructor(
    fsImpl?: FsClient,
    diff: DiffAdapter = new JsDiffAdapter(),
  ) { ... }
}
```

**Design dependency**: Implementing this before "Granular performance profiling" is low-risk
because the change is entirely internal to `IsomorphicGitAdapter`. However, profiling data would
help prioritize which alternative `DiffAdapter` implementations to pursue first.

---

#### Output: Configurable field inclusion/exclusion

- Add `--fields` or `--exclude-fields` CLI option
- Allows omitting PII fields such as `author.email`, `committer.email`
- Enables trimming output size for use cases that don't need all fields

---

### Long-term

#### Pipeline: Pluggable enrichment stage for organization-specific metadata

Allow users to attach custom processing stages to gitrail's extraction pipeline so that
organization-specific semantics can be derived without expanding the core schema for every use
case.

Example targets include parsing commit subjects that follow conventions such as Conventional
Commits, deriving custom classification fields from file paths, or attaching additional metadata
computed from diff content.

**Design intent**:

- keep gitrail core focused on canonical Git facts and broadly reusable output grains
- move organization-specific interpretation to a user-controlled extension boundary
- allow enrichment without forcing the project to standardize every downstream analytical need

**Open design questions**:

- whether the extension point should run in-process, as an external command, or via a streaming IPC boundary
- what record shape and lifecycle guarantees plugins can rely on
- how plugin failures should affect extraction success, state writing, and reproducibility

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

#### Code hygiene: Identifier naming audit for semantic accuracy

Several identifiers in the codebase carry names that imply a storage medium, lifecycle, or
structural pattern that the definition itself does not reflect. These are not bugs and do not
affect behavior, but they reduce the signal-to-noise ratio when reading the code and make type
names harder to reason about in isolation.

**Representative example**: `StateFile` is an interface describing a plain data structure
`{ version, generatedAt, repositoryPath, branches }`. The suffix `File` implies a storage medium,
but the interface carries no I/O semantics — that responsibility belongs to `StateStore`. A name
such as `State` or `ExtractionState` would be more accurate.

Other potential candidates (to be verified and decided at design time, not predetermined here):

- `StateBranchEntry` — "Entry" adds no meaning; `StateBranch` may be sufficient
- `PersonIdentity` — "Identity" is overloaded; `Person` or `PersonInfo` may be clearer

**Acceptable impact boundary**:

This item is scoped to changes that meet **all** of the following conditions simultaneously:

- No change to the CLI interface (flag names, behavior, exit codes)
- No change to the output JSON schema (field names, structure, `.jsonl` format)
- No change to the state file JSON format on disk (field names, `version` value)
- No behavioral change of any kind

Renames that touch only internal TypeScript identifiers — types, interfaces, type aliases, and
their import references — are within scope. Changes that require altering any of the above
boundaries must not be bundled into this item and should be tracked separately.

**At design time**: Re-examine all type and interface identifiers in `src/` for similar naming
issues before finalizing the change list. The examples above are illustrative, not exhaustive.

---

### Medium-term

#### Migrate to Node.js built-in TypeScript support

Node.js 22.6+ introduced `--experimental-strip-types` (stable in Node.js 23.6+ as `--strip-types`). This allows running `.ts` files directly without a separate `tsc` compile step.

**Current situation**: The project compiles with `tsc` → `dist/`; `package.json` `bin` points at compiled JS.

**Decision criteria**:

- Keep compiled-JS publishing for npm (broadest consumer compatibility)
- Add a `tsconfig.dev.json` for fast local iteration if needed
- Revisit seriously when Node.js ≥23 becomes the minimum LTS target
- Key changes when migrating: `"allowImportingTsExtensions": true`; remove `"js"` extensions from internal imports; separate `tsconfig.build.json` for publishing
