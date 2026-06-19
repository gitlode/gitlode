# gitlode — Feature Roadmap

This file records all planned improvements beyond the initial release: product features, CLI UX improvements, and development environment tasks.

Items are grouped by expected priority order within each section. Final ordering is subject to review.

This roadmap is intentionally organized by product priority and time horizon, not by release version. When an item is selected for a specific release, annotate it with lightweight metadata instead of moving it to a different section.

### Metadata Convention

Roadmap entries use the following standardized metadata labels, placed immediately below the entry title:

- **Release target**: `vX.Y.Z` — added when an item is selected for a release during planning
- **Depends on**: Entry title(s) — indicates dependencies on other roadmap items

## Product Improvements

### Near-term

#### Extraction/File Mode: Exact-content rename detection (limited scope)

gitlode currently emits file changes as `added` / `modified` / `deleted` based on path-level tree
comparison and does not detect rename/move relationships. As a result, a pure file move appears as
one full-path deletion plus one full-path addition, even when file content is unchanged.

This near-term item introduces an explicit, limited-scope rename detection mode for the most
deterministic case: pairing `deleted` and `added` records when blob identity is exactly equal.

**Design intent**:

- provide a practical first step for move-aware extraction without introducing heuristic ambiguity
- keep default behavior backward compatible unless explicitly enabled
- treat this as file-level rename detection; directory rename is represented as a set of file
  renames, not as a separate Git primitive

**Scope boundary (initial delivery)**:

- detect only exact-content moves (equivalent to `R100` style outcomes)
- do not infer rename when content has changed in the same commit
- keep merge behavior aligned with current first-parent comparison semantics

**Questions to resolve at design time**:

- whether rename output should be represented via a new status/value shape or by optional
  `oldPath`/`newPath` fields while preserving existing consumers
- whether the feature should be opt-in via CLI (preferred for compatibility) or enabled by default
- how to handle one-to-many and many-to-one exact matches deterministically
- what summary/profile counters should be emitted so users can audit rename pairing impact

#### CLI UX: User-controlled color policy for non-TTY and CI logs

For v0.6.0, color output is intentionally auto-disabled in non-TTY contexts and no user-facing
override option is introduced. That default keeps redirected output and scripted usage stable.

This item evaluates a future CLI color policy option surface that preserves the current safe
default while allowing explicit operator control when non-TTY color is desirable.

**Design intent**:

- keep default behavior as `auto` (TTY-aware enablement, non-TTY disablement)
- provide explicit overrides for advanced workflows (for example CI log viewers or pagers)
- maintain deterministic behavior and avoid surprising ANSI escape leakage in machine-oriented
  pipelines

**Options to evaluate**:

- CLI shape: `--color <auto|always|never>` vs boolean-style split flags
- environment-variable interoperability (`NO_COLOR`, `FORCE_COLOR`)
- precedence rules between CLI option, environment variables, and TTY detection
- documentation and troubleshooting guidance for Windows terminal/CI differences

**Non-goal for this item**:

- no redesign of JSON output contracts; this is terminal presentation policy only

### Medium-term

#### Extraction/File Mode: Similarity-based rename detection for edited moves

Exact-content pairing alone is insufficient for common real-world moves where files are renamed and
edited in the same commit. This item extends the limited near-term rename mode with
similarity-based matching between deleted and added candidates.

Unlike exact-content pairing, this is inherently heuristic. The design must therefore make
fidelity, runtime cost, and determinism explicit and user-controllable.

**Design intent**:

- support rename detection when content changes during the move
- keep matching behavior transparent and reproducible under fixed settings
- avoid silent extraction-policy shifts by exposing thresholds and guardrails

**Design/implementation considerations**:

- similarity threshold model (single threshold vs tiered behavior)
- candidate matching strategy and deterministic tie-breaking
- runtime guardrails for large candidate sets to prevent worst-case blowups
- compatibility with existing per-file metrics (`additions` / `deletions`) and profiling output

**Open policy questions**:

- whether copy detection should be out of scope initially and kept as a separate future item
- whether this mode should remain opt-in even after stabilization
- how explicitly the CLI/docs should label outputs as inferred relationships rather than stored Git
  facts

#### Architecture/Runtime: Worker supervision and operational hardening

After the Worker-based runtime boundary exists, this entry adds the operational behavior needed to
make worker execution resilient under cancellation, timeouts, and abnormal worker lifecycle events.

**Primary goals (core value)**:

- improve fault tolerance through clear failure boundaries and controlled shutdown semantics
- make failure reporting and exit behavior deterministic across normal errors and worker lifecycle
  failures
- provide an explicit foundation for future long-running extraction supervision

**Scope (this entry)**:

- add cancellation semantics for in-flight worker extraction
- add timeout policy and timeout reporting
- define graceful shutdown and forced termination behavior
- define deterministic handling for unexpected worker errors and exits

**Non-goals for this entry**:

- no changes to extraction semantics or output schemas
- no parallel extraction strategy rollout
- no weakening of checkpoint/state safety guarantees

#### Architecture/Runtime: Orchestration-ready expansion of the extraction runtime foundation

- **Depends on**: `Architecture/Runtime: Worker supervision and operational hardening`

After the worker runtime boundary and supervision hardening entries are complete, this entry
prepares the runtime interfaces for future orchestration strategies while keeping execution
behavior conservative.

**Scope (this entry)**:

- define and stabilize interfaces needed for future parallel strategies (branch-level or stage-level)
- refine worker/main-process coordination contracts so scheduling strategies can be added safely
- improve extension points for runtime-level orchestration without changing extraction semantics

**Non-goals for this entry**:

- no requirement to ship immediate parallel execution
- no simultaneous rollout of broad parallel execution and plugin architecture
- no changes that weaken current checkpoint/state safety guarantees

#### Output: Configurable field inclusion/exclusion

This is an output-surface convenience feature rather than a core extraction requirement. In many
pipelines, downstream warehouses can drop or mask columns after ingest, so the feature's value is
strongest when users need to minimize exposure or payload size at extraction time instead of in a
later projection step.

- Add `--fields` or `--exclude-fields` CLI option
- Allows omitting PII fields such as `author.email`, `committer.email` when source-side control is
  desirable
- Enables trimming output size for use cases that do not need all fields, while keeping the
  default extraction contract fully populated

### Long-term

#### Development: Profiling interpretation model and usability

The current profiling implementation is already sufficient as a measurement foundation, but its
output still requires internal code knowledge to interpret confidently. This is not an urgent
performance bottleneck item; it is a long-term quality improvement for profiling readability,
operational diagnostics, and future optimization planning.

**Current pain points observed after Phase 6**:

- The relationship between pipeline phases (planning/traversal/projection/write) and git-internal
  stages (`git/*`) is difficult to understand without knowing the program structure.
- Nested scoped timings in the git stage can express containment, but are still hard to read in
  day-to-day diagnostics.

**Long-term improvement goals**:

- Add a stable phase-to-git stage mapping model and document it explicitly.
- Add self-time style visibility in addition to inclusive stage timings so local bottlenecks are
  easier to identify.
- Add count metrics alongside timing metrics (for example: read-commit calls, visited commits,
  excluded commits, blob reads, diff invocations) to distinguish expensive-per-call from many-call
  workloads.
- Provide multiple profile views for different audiences (hierarchical detailed view, phase-level
  summary, and top-contributor summary).
- Add machine-readable profile export (for example JSON) for cross-run comparison and CI trend
  analysis.
- Clarify profiling interpretation guidance in docs, including nested timing semantics and overlap
  behavior.
- Evaluate and document profiling overhead characteristics to reduce over-interpretation of tiny
  runs.

**Design intent**:

- Keep the existing profiling behavior as the stable baseline.
- Treat these items as interpretation and observability UX improvements, not as mandatory
  preconditions for current extraction correctness.

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

#### Output: Execution metadata line

- Optionally prepend a metadata line as the first record in each output file:
  ```json
  { "_meta": { "extractedAt": "2024-01-15T00:00:00Z", "extractorVersion": "1.2.0" } }
  ```
- Controlled by a `--meta` flag (off by default)

#### Output: stdout support and stream-based OutputWriter

Add `--output -` to write to stdout, enabling output to be piped into other tools directly.

At this point, `OutputWriter` should be redesigned around Node.js `Writable` streams rather than the current `FileHandle`-based implementation. Rewriting to a stream-based model is not warranted today — the CLI-only, batch-run use case does not benefit from it — but stdout output introduces the need to write to heterogeneous sinks (file vs. stdout), which is where the `Writable` abstraction pays off.

**Key design notes**:

- When writing to stdout, file rotation has no meaning and must be disabled or ignored gracefully.
- The `OutputWriter` abstraction could accept a `Writable` (or `AsyncIterable` sink) rather than owning file I/O directly. This removes the need for `OutputWriter` to implement rotation internally for the stdout path.
- Consider whether third-party rotation libraries (e.g. `rotating-file-stream`) become worthwhile once the file-writing path is expressed as a `Writable` pipeline. Currently the rotation logic is ~5 lines and an external dependency is not justified; evaluate at implementation time.

**Why deferred**: No current user need for stdout output. Refactoring `OutputWriter` solely for stream architecture hygiene would be over-engineering without a concrete requirement.

#### Other future considerations

- **Additional rotation strategies**: by commit date (one file per month/year), by branch (one file per branch)
- **Ref pattern matching**: `--branch 'feature/*'` glob support (note: temporary branches introduce risk of capturing transient data — document trade-offs)
- **Windows line endings**: `--line-ending crlf` flag (LF-only today; architecturally trivial to add)

## Development Environment Improvements

### Medium-term

#### Migrate to Node.js built-in TypeScript support

Node.js 22.6+ introduced `--experimental-strip-types` (stable in Node.js 23.6+ as `--strip-types`). This allows running `.ts` files directly without a separate `tsc` compile step.

**Current situation**: The project compiles with `tsc` → `dist/`; `package.json` `bin` points at compiled JS.

**Decision criteria**:

- Keep compiled-JS publishing for npm (broadest consumer compatibility)
- Add a `tsconfig.dev.json` for fast local iteration if needed
- Revisit seriously when Node.js ≥23 becomes the minimum LTS target
- Key changes when migrating: `"allowImportingTsExtensions": true`; remove `"js"` extensions from internal imports; separate `tsconfig.build.json` for publishing
