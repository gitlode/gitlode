# Git CLI Adapter Implementation Plan

## Status

Planning artifact. This document records decisions and open items for introducing a second Git
adapter implementation backed by the `git` command-line executable. It is not a discussion channel
and is not yet a durable design contract. Design discussion should happen in the chat/review thread;
this handoff document should be updated afterward to summarize settled decisions or explicit open
items. As decisions stabilize or implementation lands, migrate stable facts into the canonical docs:

- user-facing configuration and behavior: `packages/gitlode/docs/usage.md`;
- durable implementation contracts: `packages/gitlode/docs/design/`;
- profiling output behavior: `packages/gitlode/docs/profiling.md`.

## Decision Summary

- Add a second Git adapter implementation that uses Git CLI plumbing/porcelain commands where that
  gives gitlode access to Git's optimized revision machinery.
- Keep the existing isomorphic-git adapter as the default.
- Select the adapter through configuration only for this work. A CLI argument may be considered in a
  future design pass, but it is out of scope for this plan.
- Treat the current `GitAdapter` interface as adjustable. It was shaped around the first and only
  implementation, so the interface may be revised if that produces a better abstraction for multiple
  backends.
- Extend profiling/troubleshooting output so runs expose the selected adapter. When the Git CLI
  adapter is selected, include useful platform details such as the `git --version` result.

## Problem Statement

Current differential traversal is defined as `reachable(start) - reachable(exclude)`, matching a
mental model such as `v9..v10`. The isomorphic-git adapter can read commits and parent links, but it
cannot consume Git's commit-graph generation numbers through its public API. The current traversal
strategy therefore has cases where it must fall back to collecting the full excluded reachable set.
For a large repository, a small release delta such as `v9..v10` can still require walking a very
large `reachable(v9)` history.

The Git CLI adapter should make this path efficient by delegating range walking to Git itself, for
example with `git rev-list <include> --not <exclude>` or equivalent argv-safe forms. Git can use its
own revision machinery and commit-graph optimizations without gitlode reimplementing commit-graph
parsing.

## Non-goals for This Plan

- Do not make the Git CLI adapter the default.
- Do not add a command-line flag for adapter selection in the initial implementation.
- Do not remove the isomorphic-git adapter.
- Do not implement a custom commit-graph reader in the initial implementation.
- Do not fork isomorphic-git in the initial implementation.
- Do not promise identical output ordering across adapters unless a later implementation step
  explicitly makes that a contract.

## Configuration Direction

Add a config-only setting under `runtime` for selecting the Git implementation. Keeping this under
`runtime` is decided because the choice affects execution dependencies, profiling, and
troubleshooting rather than repository metadata. The field name is `runtime.gitAdapter`.

Preferred values:

- `"isomorphic-git"` — existing adapter and default;
- `"git-cli"` — new adapter backed by the `git` executable.

The values should stay explicit rather than being shortened to `"isomorphic"` or `"cli"`, because
those shorter names are too abstract for a user-facing config file.

The selected field name is `runtime.gitAdapter`. More user-facing names were considered, including
`runtime.gitBackend`, `runtime.gitProvider`, `runtime.gitEngine`, and
`runtime.gitImplementation`, but none was clearly better than `gitAdapter`.

Example:

```json
{
  "version": 1,
  "runtime": {
    "gitAdapter": "isomorphic-git"
  }
}
```

Precedence:

- There is no CLI override in this plan.
- Effective adapter is `config runtime.gitAdapter ?? "isomorphic-git"`.

Validation:

- Unknown adapter values are config validation errors.
- If `"git-cli"` is selected, validate that the Git command can be executed before traversal begins.
- Use `git --version` for this early validation and for capturing diagnostic version information.
- If Git command validation fails, report a user error rather than deferring to an avoidable runtime
  failure.

Documentation updates when implemented:

- `docs/design/configuration.md`: add the field, strict schema rules, and default.
- `docs/usage.md`: document when to choose `git-cli`, including the runtime dependency on Git.
- Generated config schema: update and verify through existing schema scripts.

## Adapter Interface Review

The current interface may remain sufficient for a first implementation, but it should be reviewed
before coding the adapter.

Questions to resolve in the design step:

1. Should `walkCommits()` continue to return full `RawCommit` objects, or should traversal become an
   OID stream plus a separate metadata reader?
   - Keeping `RawCommit` minimizes Core changes.
   - Splitting traversal from commit metadata may map better to `git rev-list` plus `git cat-file
--batch` and could avoid forcing every adapter to use the same internal shape.
2. Should `getFileChanges()` remain part of the same adapter?
   - Keeping it preserves the current simple boundary.
   - Splitting commit traversal from file-diff expansion may allow a hybrid implementation where Git
     CLI handles range walking while the existing isomorphic-git path handles tree diff expansion.
3. Should adapter capability metadata be exposed explicitly?
   - Example: adapter name, requires external Git, supported object formats, optional git version.
   - This could feed profiling and troubleshooting without duplicating detection logic elsewhere.

Initial implementation bias:

- Minimize Core churn.
- Preserve `GitAdapter` unless a concrete implementation obstacle appears.
- If hybrid delegation is used, document it clearly so `git-cli` does not imply every Git operation
  is CLI-backed.

## Git CLI Adapter Design Sketch

### Process Execution

Use argv-safe process spawning rather than shell interpolation.

Recommended helper responsibilities:

- spawn `git` with explicit argv;
- set `cwd` or use `-C <repoPath>` consistently;
- collect stdout/stderr when outputs are bounded;
- support streaming stdout for `rev-list` and batch metadata paths;
- map non-zero exits to `GitAdapterError` or user-facing configuration/runtime errors;
- run `git --version` during Git CLI adapter validation;
- report missing or non-executable Git as an early user error when `"git-cli"` is selected;
- expose the detected Git version for profiling.

### Ref Resolution

Use Git's own commit peeling semantics:

```text
git -C <repoPath> rev-parse --verify <ref>^{commit}
```

This should replace the isomorphic-git adapter's explicit annotated-tag peeling for the CLI backend.
Raw commit OID handling should keep the same user-visible semantics as the existing adapter.

### Repository Object Format

Use Git config plumbing, for example:

```text
git -C <repoPath> config --get extensions.objectFormat
```

or another Git-supported mechanism that correctly reports the repository object format. Preserve the
current default of `sha1` when unset. Do not expand gitlode's supported object formats in the first
adapter implementation unless the model/schema validation is also deliberately updated.

### Commit Traversal

Implement `reachable(start) - reachable(exclude)` using Git revision machinery:

```text
git -C <repoPath> rev-list --topo-order <start>
```

without exclude, and:

```text
git -C <repoPath> rev-list --topo-order <start> --not <exclude>
```

with exclude.

Notes:

- Use argv entries, not shell strings.
- The adapter-invariant contract is set equality, not traversal order: adapters must produce the
  same final commit set, and file-level extraction must produce the same final file-change set, but
  line/order differences between adapters are allowed.
- Start with `--topo-order` unless implementation tests show a stronger reason to choose Git's
  default order.

### Commit Metadata

Preferred approach:

- Stream OIDs from `rev-list`.
- Feed them to `git cat-file --batch` or an equivalent batch mode.
- Parse commit object payloads to produce `RawCommit`:
  - tree OID;
  - parent OIDs;
  - author identity, timestamp, timezone;
  - committer identity, timestamp, timezone;
  - message.

Avoid one Git process per commit.

### Merge Base

Use Git CLI's merge-base support:

```text
git -C <repoPath> merge-base <oid1> <oid2> ...
```

Map no merge base to `null` consistently with the current adapter contract.

### Remote URL

Use Git config:

```text
git -C <repoPath> config --get remote.origin.url
```

Treat missing config as `null`, not as a fatal error.

### File Changes

The first implementation must choose how far the Git CLI adapter goes beyond optimized traversal.
The options are below.

#### Option A: Hybrid adapter

Use Git CLI for operations that directly benefit from Git's optimized revision machinery, while
delegating file-change expansion to the existing isomorphic-git implementation.

Pros:

- Smallest first implementation.
- Directly addresses the `v9..v10` traversal bottleneck.
- Reuses existing binary detection, blob reading, and line-diff behavior.
- Reduces parity risk for file-granularity output in the first phase.

Cons:

- The `git-cli` value would not mean every Git operation is CLI-backed.
- Runtime would still depend on isomorphic-git code paths for file-level extraction.
- Troubleshooting must make the hybrid boundary clear.

Evaluation:

- Best first step if the priority is reducing traversal risk quickly while preserving current
  file-change behavior.
- Requires clear documentation and profiling so users understand which operations are CLI-backed.

#### Option B: Full CLI adapter

Implement traversal, commit metadata, ref operations, merge-base, and file-change expansion with Git
CLI commands such as `rev-list`, `cat-file`, `diff-tree`, and related plumbing.

Pros:

- Cleanest mental model for `"git-cli"`: all Git operations use the Git executable.
- Avoids mixing two Git implementations in one adapter.
- May unlock additional Git-native diff optimizations later.

Cons:

- Larger implementation surface.
- Higher parity risk for binary handling, byte sizes, rename/status interpretation, root commits, and
  line additions/deletions.
- More process orchestration and batch parsing work before the traversal improvement can ship.

Evaluation:

- Desirable long-term if Git CLI becomes a primary backend, but too broad for the first performance
  milestone unless file-level parity is prioritized over delivery speed.

#### Option C: Split adapter interfaces

Refactor the abstraction so traversal/commit metadata and file-change expansion are separate
capabilities. The runtime could then compose a Git CLI traversal provider with an isomorphic-git
file-change provider explicitly instead of hiding the hybrid inside one `GitAdapter`.

Pros:

- Most honest abstraction if different implementations are best for different Git operations.
- Avoids naming confusion in a hybrid adapter.
- Could make future adapters easier to compose and test.

Cons:

- Largest Core and runtime design change.
- Increases scope before proving the Git CLI traversal path.
- Requires broader documentation updates and more migration risk.

Evaluation:

- Worth revisiting if the current `GitAdapter` becomes awkward during implementation, but not the
  preferred first move.

Decision:

- Start with Option A, the hybrid adapter.
- Keep Option B as the target for a later full CLI backend if file-change performance or
  installation simplification becomes important.
- Defer Option C until there is concrete evidence that the current interface prevents a clean first
  implementation.

## Profiling and Troubleshooting Design

Add low-cardinality adapter information to profiling output.

Recommended profile details:

- on the run-level span, record `git.adapter=<adapter-name>`;
- on Git CLI adapter validation or traversal spans, record `git.cli.version=<version>` from
  `git --version`;
- for Git CLI commands, use stable span names such as:
  - `git.cli.version`;
  - `git.cli.resolve_ref`;
  - `git.cli.rev_list`;
  - `git.cli.cat_file_batch`;
  - `git.cli.merge_base`.

For the existing isomorphic-git adapter, record the selected adapter as `git.adapter=isomorphic-git`.
Avoid high-cardinality details such as raw repo paths, refs, or command stderr in profile details.
Errors can continue to surface through existing error reporting paths.

Documentation updates when implemented:

- `docs/profiling.md`: add adapter details and Git CLI version diagnostics.
- `docs/design/architecture.md`: note multiple Git adapter implementations and selection.

## Test Strategy

### Unit and Contract Tests

- Reuse existing `GitAdapter` contract expectations where possible.
- Add shared adapter contract tests if not already practical.
- Add Git CLI adapter tests for:
  - ref resolution;
  - annotated tag peeling;
  - raw commit OID validation;
  - `walkCommits()` without exclude;
  - `walkCommits()` with exclude, including merge cases;
  - merge-base null behavior;
  - missing or non-executable `git` reports an early user error when `"git-cli"` is selected;
  - profile attributes when profiling is enabled.

### Integration/Performance Tests

Add or document a reproducible benchmark repository shape:

- large historical chain up to `v9`;
- small delta to `v10`;
- merge-heavy release branch cases;
- cases where the current certified-lazy strategy falls back.

Compare:

- isomorphic-git adapter read counters and wall time;
- Git CLI adapter `rev-list`/batch metadata time;
- yielded commit count equality.

## Incremental Work Plan and Approval Gates

Each phase must stop for human review before proceeding to the next phase.

### Phase 1: Design Finalization

Deliverables:

- use `runtime.gitAdapter` as the config field name;
- keep accepted values as `"isomorphic-git"` and `"git-cli"`;
- decide whether to keep or adjust `GitAdapter` for the first implementation;
- implement the documented hybrid file-change strategy unless a concrete implementation blocker is
  found;
- update this handoff artifact or migrate stable decisions into design docs.

Review gate:

- Ask the maintainer to approve the finalized design before coding.

### Phase 2: Config and Runtime Wiring

Deliverables:

- config schema/type support for adapter selection;
- runtime construction selects the adapter from config;
- default remains isomorphic-git;
- docs updated for configuration and usage;
- no CLI argument added.

Review gate:

- Demonstrate that existing behavior is unchanged without config and that invalid adapter values fail
  validation.

### Phase 3: Git CLI Adapter Traversal

Deliverables:

- process helper;
- Git version detection via `git --version`;
- ref resolution;
- object format detection;
- `walkCommits()` via `rev-list` plus batch metadata;
- `findMergeBase()`;
- profile attributes for selected adapter and Git CLI version.

Review gate:

- Demonstrate adapter contract tests and representative `v9..v10` traversal behavior.

### Phase 4: File Changes Strategy

Deliverables:

- implement the selected file-change path;
- if hybrid, document which operations remain isomorphic-git backed;
- if full CLI, add binary handling and byte-size parity tests.

Review gate:

- Demonstrate commit-granularity and file-granularity extraction parity with existing adapter on
  representative fixtures.

### Phase 5: Profiling, Benchmarking, and Documentation Hardening

Deliverables:

- update profiling docs and examples;
- add benchmark notes or scripts if useful;
- migrate stable design content from handoff to durable docs;
- record remaining limitations and future CLI argument consideration.

Review gate:

- Maintainer confirms the adapter is ready for normal development use or remains experimental.

## Resolved Maintainer Decisions

- The adapter selection setting belongs under `runtime`.
- The config field name is `runtime.gitAdapter`.
- Adapter values are `"isomorphic-git"` and `"git-cli"`.
- The first implementation should use the hybrid adapter pattern: Git CLI for traversal-oriented
  operations and existing isomorphic-git behavior for file-change expansion.
- Adapter-invariant output correctness is based on the final commit or file-change set, not output
  ordering.
- When `"git-cli"` is selected, gitlode should validate Git command execution before traversal.
- Use `git --version` for early Git CLI validation and diagnostic version capture.
- Validation failures that can be classified, such as a missing Git command, should be reported as
  user errors rather than avoidable runtime errors.
- Do not set or validate a minimum Git version in this plan. Minimum-version policy can be revisited
  later if implementation discovers specific Git feature requirements.

## Phase 2 Status

Phase 2 wires `runtime.gitAdapter` through config parsing and worker input. The default remains
`isomorphic-git`, and `gitlode.run` profiling records the selected adapter.

## Phase 3 Status

Phase 3 adds the hybrid `git-cli` adapter. It validates the Git executable with `git --version`,
uses Git CLI commands for ref resolution, object-format lookup, range traversal, commit metadata,
remote URL lookup, and merge-base computation, and delegates file-change expansion to the existing
isomorphic-git adapter.

## Remaining Questions for Maintainer Review

No remaining design questions are currently open for this planning phase. New questions should be
raised in chat/review first, then summarized here after a decision is made or explicitly deferred.
