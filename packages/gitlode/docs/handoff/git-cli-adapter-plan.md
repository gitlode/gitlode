# Git CLI Adapter Implementation Plan

## Status

Planning artifact. This document records the agreed direction for introducing a second Git adapter
implementation backed by the `git` command-line executable. It is not yet a durable design contract.
As decisions stabilize or implementation lands, migrate stable facts into the canonical docs:

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

Add a config-only runtime setting for adapter selection. The exact field name is still open, but the
preferred shape is:

```json
{
  "version": 1,
  "runtime": {
    "gitAdapter": "isomorphic-git"
  }
}
```

Candidate values:

- `"isomorphic-git"` — existing adapter and default;
- `"git-cli"` — new adapter backed by the `git` executable.

Open naming decision:

- `runtime.gitAdapter` is explicit and keeps backend choice near other execution controls.
- `repository.gitAdapter` is possible, but adapter choice affects runtime dependencies and
  diagnostics more than repository metadata.

Precedence:

- There is no CLI override in this plan.
- Effective adapter is `config runtime.gitAdapter ?? "isomorphic-git"`.

Validation:

- Unknown adapter values are config validation errors.
- If `"git-cli"` is selected and `git` cannot be executed, fail fast with a user-facing error before
  traversal begins.

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
- Output ordering should be treated carefully. The current durable contract emphasizes membership,
  while downstream users may still notice ordering changes. Add tests and documentation for the
  chosen behavior.
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

Two viable implementation paths:

1. Full CLI implementation using commands such as `diff-tree`, `cat-file -s`, and blob reads.
2. Hybrid implementation where the CLI adapter delegates file changes to existing isomorphic-git
   logic while using Git CLI for traversal/ref/range operations.

Initial recommendation:

- Prefer the hybrid path if it keeps the first Git CLI adapter small and focused on the traversal
  bottleneck.
- Revisit full CLI file-change support after traversal performance and adapter selection are stable.

## Profiling and Troubleshooting Design

Add low-cardinality adapter information to profiling output.

Recommended profile details:

- on the run-level span, record `git.adapter=<adapter-name>`;
- on Git CLI adapter initialization or traversal spans, record `git.cli.version=<version>` when
  available;
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
  - missing `git` executable / command failure mapping;
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

- finalize config field name and accepted values;
- decide whether to keep or adjust `GitAdapter` for the first implementation;
- decide full CLI vs hybrid file-change strategy for the first implementation;
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
- Git version detection;
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

## Open Questions for Maintainer Review

1. Config field name: is `runtime.gitAdapter` acceptable, or would you prefer another name such as
   `runtime.gitBackend`?
2. Config value names: should the values be `"isomorphic-git"` and `"git-cli"`, or shorter names
   such as `"isomorphic"` and `"cli"`?
3. For the first implementation, do you prefer a hybrid adapter that uses Git CLI for traversal but
   keeps existing isomorphic-git file-change logic, or should the new adapter be fully CLI-backed
   from the start?
4. Is it acceptable for the Git CLI adapter's output ordering to differ from the current adapter as
   long as the yielded commit set is correct, or should the first implementation attempt to preserve
   a specific order?
5. Should Git CLI adapter selection fail immediately if `git --version` cannot be collected, or only
   when the first required Git operation fails?
