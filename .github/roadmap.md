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

#### CLI UX: Release-boundary extraction workflow

The current gitrail CLI can express "extract commits after a given ref" via `--since-ref`, but it
does not provide an explicit, user-facing way to express the complementary release-oriented
workflow that naturally appears in repositories using release tags: snapshot the history included
in a release once, then continuously ingest only the post-release range as new commits accumulate.

This should not be treated as a simple request for the inverse of `--since-ref`. The user intent is
not "the complement of commits after X" but "the commit set included in release ref X" as a stable
extraction boundary. Conceptually, this is closer to treating a release ref as a traversal
starting point or boundary than to subtracting one reachability set from another.

**Target workflow**:

- history at or before the latest stable release is assumed to be stable and can be extracted once as a snapshot
- commits after that release continue to grow toward the next release
- therefore, the post-release range should be bootstrapped once via `--since-ref` and then maintained through daily incremental extraction with a state file

**Current workaround and its limitations**:

- in Git terms, users may be able to approximate "extract up to release X" by creating a temporary ref fixed at that release and passing it to `--branch`
- if `--branch <ref>` is treated as a true general ref traversal entry point, users may also be able to use the release tag itself directly rather than creating a temporary branch
- however, neither approach is an intuitive CLI expression of the user's intent, and both require the user to translate a release-boundary question into lower-level ref manipulation
- in addition, the ref-resolution behavior for lightweight tags, annotated tags, branch names, and raw commit hashes should be made explicit if release refs are to become part of the supported workflow model

This item should therefore be treated as a **UX and extraction-model design problem**, not merely
as a request for one additional flag.

**Questions to resolve at design time**:

- whether to add an explicit `--until-ref` style parameter, or instead make release-ref traversal a first-class documented workflow without introducing a new range flag
- whether this capability should be defined as "snapshot the history included in the specified ref" rather than as the complement of `--since-ref`
- how `--branch`, `--since-ref`, `--state`, and incremental bootstrap should fit together as one coherent release-boundary workflow
- how ref resolution should be specified for tag names, branch names, commit hashes, and annotated-tag peeling behavior
- whether this model should be limited to single-boundary release workflows, or whether a multi-branch interpretation is desirable and sufficiently clear

**Design priority**:

- users should be able to understand "extract up to the latest release once" and "bootstrap from the latest release, then switch to incremental" without having to reason in terms of temporary refs or Git-internal setup steps
- the resulting UX should form a conceptually paired explanation with the existing `--since-ref` + state-file workflow for post-release ingestion
- even if an internal workaround uses an auxiliary ref, that workaround should not become the primary user-facing workflow

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

#### Extraction/File Mode: Exact-content rename detection (limited scope)

gitrail currently emits file changes as `added` / `modified` / `deleted` based on path-level tree
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

---

### Medium-term

---

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

---

#### Extraction/CLI: User-controlled guardrail for very large text diffs

In per-file extraction mode, line-level diff computation can become a dominant cost for a small
subset of files that are structurally valid text but operationally "machine-generated large text"
(for example large lockfiles). Recent profiling and debug investigation showed that these files can
produce multi-second to tens-of-seconds `diffLines` stalls in a single commit, which degrades both
total throughput and interactive progress responsiveness.

At the same time, gitrail should not silently reduce extracted information by default. Even when a
file looks like an outlier, treating its diff as always meaningless is a policy decision that must
remain in user control.

**Design intent**:

- keep current behavior as the default (no implicit data reduction)
- provide an explicit opt-in mechanism to skip line-diff computation when file size exceeds a
  user-defined threshold
- represent skipped text diffs with the same null-count convention already used for binary files
  (`additions: null`, `deletions: null`) so downstream contracts remain stable

**CLI direction to evaluate at implementation time**:

- add a dedicated option such as `--max-diff-bytes` (or equivalent naming)
- default: disabled (full diff behavior)
- when enabled: if either side of a text diff exceeds threshold, skip line diff and emit null
  counts
- evaluate whether an explicit mode flag is also needed (for example: `off|size-threshold`)

**Operational considerations**:

- document clearly that this is an extraction-fidelity vs. runtime trade-off selected by the user
- include a summary/profile indicator for skipped large-text diffs so users can audit impact
- ensure behavior is deterministic and reproducible under the same threshold settings

---

#### Pipeline: Discriminated Fact union and unified projector contract

gitrail currently treats commit-grain and file-grain facts through separate projector contracts,
which duplicates projection logic and requires extension-oriented changes to be considered in two
parallel pathways. Before v1.0.0, this is an appropriate point to consolidate internal pipeline
contracts while preserving user-visible behavior.

This item introduces a discriminated Fact union (for example via a `type` tag) and replaces
separate commit/file projector interfaces with one unified projector contract that branches
internally by Fact type.

**Design intent**:

- remove duplicated projection logic between commit and file pathways
- simplify coordinator dependency shape and projection-stage composition
- establish a single extension-facing contract for future plugin/enrichment stage design
- complete this internal contract consolidation during the pre-v1.0 architecture-change window

**Non-goals**:

- no change to CLI flags, argument semantics, or exit behavior
- no change to output JSON schema or JSONL file format
- no change to traversal/filtering/checkpoint semantics

**Design considerations**:

- retain deterministic output ordering and current write/progress accounting guarantees
- keep file-change expansion as a distinct stage even if projection is unified
- define clear type-narrowing guarantees for plugin and projector implementations
- decide migration strategy for internal interfaces currently split across commit/file projector slots

**Design dependency and sequencing**:

- should be delivered before, or as part of, plugin-stage implementation planning so plugin API
  contracts do not inherit duplicated commit/file projector pathways

---

#### Architecture/Runtime: Worker-based extraction runtime for resilience and orchestration

The current extraction pipeline runs in a single Node.js execution context. This keeps the
implementation straightforward, but it also couples heavy extraction work with CLI lifecycle and
interactive rendering. For long-running or computationally heavy workloads, this coupling makes
stability, supervision, and execution strategy evolution harder than necessary.

This item introduces a Worker-based runtime boundary: extraction executes in an isolated worker,
while the main process remains responsible for CLI lifecycle, supervision, and user interaction.

**Primary goals (core value)**:

- improve long-run extraction stability via execution isolation
- improve fault tolerance through clear failure boundaries and controlled shutdown semantics
- establish a foundation for future orchestration flexibility (parallelism, scheduling, retry)
- improve extensibility by formalizing runtime and messaging boundaries

**Secondary outcomes (expected but non-primary)**:

- smoother progress behavior under heavy extraction load
- cleaner profiling/telemetry boundaries between extraction work and CLI supervision

**Scope strategy (single entry, phased delivery)**:

- **Phase A: runtime boundary only**
  - run the existing extraction pipeline in one worker
  - define a typed message protocol for progress, warning, result, and error events
  - keep extraction semantics and output behavior unchanged
- **Phase B: operational hardening**
  - add cancellation, timeout, and supervision semantics
  - make failure reporting and exit behavior deterministic
- **Phase C: orchestration-ready foundation**
  - prepare interfaces for future parallel strategies (branch-level or stage-level)
  - do not require immediate parallel execution in this item

**Non-goals for initial implementation**:

- no guaranteed throughput improvement in the first delivery
- no implicit data reduction or extraction-fidelity trade-off
- no simultaneous rollout of broad parallel execution and plugin architecture

**Design constraints**:

- preserve current extraction correctness and checkpoint safety guarantees
- maintain deterministic behavior under equivalent inputs and configuration
- keep CLI UX backward compatible unless explicitly documented otherwise

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

**Design dependency**: This remains low-risk because the change is entirely internal to
`IsomorphicGitAdapter`. Profiling data from the implemented `--profile` baseline can guide which
alternative `DiffAdapter` implementations to prioritize first.

---

#### Output: Configurable field inclusion/exclusion

- Add `--fields` or `--exclude-fields` CLI option
- Allows omitting PII fields such as `author.email`, `committer.email`
- Enables trimming output size for use cases that don't need all fields

---

### Long-term

#### Output/UX: Directory-move inference from file-rename clusters

Git tracks file-level changes; directory rename is generally inferred from sets of path-level file
moves. Once file-level rename detection is mature, gitrail can provide an optional higher-level
view that groups compatible rename sets into inferred directory moves.

This should be treated as an interpretation layer for usability, not as a replacement for
file-grain facts.

**Design intent**:

- improve readability for refactors that mostly move files across path prefixes
- preserve canonical file-level output as the primary factual grain
- make inferred directory-level summaries clearly distinguishable from file-level facts

**Design questions to resolve at implementation time**:

- criteria for grouping rename pairs into a directory-level move inference
- handling partial migrations and mixed commits (move + edit + add/delete)
- whether directory inference belongs in primary output, sidecar metadata, or reporting-only views
- how to expose confidence/coverage so downstream users can evaluate interpretation quality

---

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
