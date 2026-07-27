# Domain Migration Plan

## Status

Steps 0–12 completed on 2026-07-27. Step 13 has not started.

This is a temporary continuation document. The durable domain charters and dependency rules live in
[`../design/domain-design.md`](../design/domain-design.md). Delete this file when the migration is
complete and all durable information has been integrated into the design documentation.
Behavior-changing cleanup candidates intentionally deferred by this migration are tracked in
[`domain-migration-follow-ups.md`](domain-migration-follow-ups.md).

## Scope and constraints

The migration reorganizes `packages/gitlode/src` according to the approved 21-domain design. It may
also update tests and documentation to follow source ownership.

It must not change:

- CLI behavior, output, stderr messages, or exit codes;
- JSONL schema or serialization behavior;
- checkpoint-state format or incremental extraction semantics;
- plugin behavior or published contract semantics;
- Git traversal result sets.

Every step is an independent review gate. Finish with a buildable and testable tree, address all
review feedback, and obtain approval before starting the next step. If implementation requires a
forbidden dependency, stop and revisit the domain design instead of bypassing the boundary with a
deep import or misplaced shared type.

## Verification

Run after every implementation step:

```text
npm run format:write --workspace gitlode
npm run format:check --workspace gitlode
npm run lint --workspace gitlode
npm run build --workspace gitlode
npm test --workspace gitlode
```

Also run:

- `npm run schema:check --workspace gitlode` after configuration changes;
- affected official plugin builds and tests after plugin API changes.

Update affected durable design documents in the same step so their paths and ownership descriptions
continue to match the implementation.

## Migration sequence

### Step 0: Establish the baseline

Work:

- Record build, lint, test, and schema-check results.
- Inventory every current module and its target domain.
- Confirm characterization coverage for CLI, state, plugin API, JSONL, and traversal behavior.
- Record any temporary legacy-domain exceptions required during migration.

Review:

- The external behavior baseline is adequately protected.
- Every source module has a planned owner.
- The worktree has no conflicting unrelated changes.

No product code changes occur in this step.

#### Step 0 results

The worktree was clean before verification. The baseline passed:

| Check                                      | Result                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `npm run format:check`                     | passed for all workspaces                                                   |
| `npm run lint`                             | passed for all workspaces                                                   |
| `npm run build`                            | passed for all workspaces                                                   |
| `npm test`                                 | passed: gitlode 577 tests in 41 files; official plugins 64 tests in 9 files |
| `npm run schema:check --workspace gitlode` | passed; generated config schema matches the tracked file                    |

The following inventory covers every current source module. A directory wildcard includes its
`index.ts` barrel. Rows that name individual modules override the directory-wide mapping.

| Current module or group                                                                      | Target owner                                                    | Migration step                             |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| `type-utils/*`                                                                               | `type-utils`                                                    | unchanged                                  |
| `support/*`                                                                                  | `support`                                                       | unchanged; module-size review in Step 11   |
| `model/*`                                                                                    | `model`                                                         | unchanged                                  |
| `instrumentation/*`                                                                          | `instrumentation`                                               | unchanged                                  |
| `dag/*`                                                                                      | `dag`                                                           | unchanged; module-size review in Step 11   |
| `git/*`, except `DiffAdapter`                                                                | `git`                                                           | unchanged                                  |
| `git/types.ts::DiffAdapter`                                                                  | `line-diff`                                                     | Step 1                                     |
| `git-impl/js-diff-adapter.ts`                                                                | `line-diff-impl`                                                | Step 1                                     |
| Remaining `git-impl/*`, including `commit-traversal/*`                                       | `git-impl`                                                      | unchanged; module-size review in Step 11   |
| `core/types.ts` fact, record, range, stage, sink, and extraction contracts                   | `extraction-api`                                                | Step 4                                     |
| `core/types.ts` progress contracts                                                           | `progress`                                                      | Step 3                                     |
| `core/types.ts` checkpoint models                                                            | `extraction-api`                                                | Step 4                                     |
| `core/types.ts::StateStore` and `core/constants.ts` state constants                          | `state`                                                         | Step 2                                     |
| `core/types.ts` plugin-author contracts                                                      | `plugin-api`                                                    | Step 5                                     |
| `core/types.ts::PluginEntry` and plugin-host outcome types                                   | `plugin-runtime`                                                | Step 6                                     |
| `core/types.ts::CoordinatorDependencies` and remaining implementation-construction contracts | `extraction`                                                    | Step 7                                     |
| `core/types.ts::RotationConfig`                                                              | remove shared extraction aggregate; review final boundary names | Step 4 and Step 8                          |
| Stale `core/types.ts` aggregates, including `ExtractorConfig` and `ExtractionResult`         | remove                                                          | Step 4                                     |
| `core/enriching-fact-projector.ts`                                                           | `plugin-runtime`                                                | Step 6                                     |
| Remaining `core/*` implementations and barrel                                                | `extraction`                                                    | Step 7                                     |
| `state/state-store.ts` pure factories and validation                                         | `state`                                                         | Step 2                                     |
| `state/state-store.ts` filesystem loading and `NodeStateStore`; `state/index.ts` exports     | `state-impl`                                                    | Step 2                                     |
| `plugins/*`                                                                                  | `plugin-runtime`                                                | Step 6                                     |
| `output/*`                                                                                   | `output`                                                        | unchanged; naming review in Step 10        |
| `config/*`                                                                                   | `config`                                                        | unchanged; dependency correction in Step 8 |
| `cli/*`                                                                                      | `cli`                                                           | unchanged; module split in Step 8          |
| `presentation/*`, except imported progress contracts                                         | `presentation`                                                  | unchanged                                  |
| Progress contracts currently imported by `presentation/*` from `core`                        | `progress`                                                      | Step 3                                     |
| `runtime/*`                                                                                  | `execution`                                                     | Step 9                                     |
| Root `plugin-api.ts`                                                                         | package-export facade over `plugin-api`                         | Step 5                                     |
| Root `index.ts`                                                                              | composition-root facade                                         | Step 10                                    |

Characterization coverage is adequate to begin the migration:

| Protected behavior      | Existing coverage                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI behavior and output | CLI argument, command-definition, entrypoint, bootstrap-renderer, diagnostics, presenter, and root-entrypoint tests cover validation, help, messages, exit-code orchestration, state-write ordering, and import side effects. |
| Checkpoint state        | State-store tests cover creation, schema/path/OID/ref validation, missing files, and atomic replacement; CLI and runtime tests cover incremental-mode integration.                                                            |
| Plugin API and runtime  | Plugin loader/compatibility/initialization tests, enriching-projector tests, runtime tests, and official plugin builds/tests cover public contracts, ordering, projection, warnings, and failure policies.                    |
| JSONL records           | Fact-projector and output writer/sink tests cover record shape, serialization, counters, rotation, and close behavior; runtime tests cover end-to-end file records.                                                           |
| Traversal result sets   | Planner/extractor, DAG, both Git adapters, and commit-traversal strategy tests cover boundaries, deduplication, merge histories, adapter parity, and reachable-difference invariants.                                         |

No new characterization test is required before Step 1. Each later step must still add or adjust
tests when its review shows that an affected invariant is only indirectly covered.

Until the owning migration step completes, the following are explicit temporary exceptions to the
target architecture:

| Temporary exception                                                                                        | Expires |
| ---------------------------------------------------------------------------------------------------------- | ------- |
| The dependency allowlist and `type-utils` charter are reviewed manually rather than mechanically enforced. | Step 13 |

These exceptions permit only preservation of existing dependencies. They do not authorize new uses
or expansion of a legacy domain. If a step needs an exception not listed here, stop and review the
domain design before changing code.

### Step 1: Migrate line-diff boundaries

Move the line-diff contract from `git/types.ts` and the implementation from
`git-impl/js-diff-adapter.ts` into:

```text
line-diff/
line-diff-impl/
```

Rename:

```text
DiffAdapter   -> LineDiffCalculator
JsDiffAdapter -> JsLineDiffCalculator
```

Keep size limits, binary detection, and null-result policy in extraction.

Review:

- `line-diff` has no Git or repository semantics.
- Only `line-diff-impl` uses the external `diff` package.
- Addition and deletion results are unchanged.

#### Step 1 results

- Added the dependency-free `line-diff` contract domain and the `line-diff-impl` implementation
  domain.
- Renamed `DiffAdapter` to `LineDiffCalculator` and `JsDiffAdapter` to
  `JsLineDiffCalculator`.
- Removed the line-diff contract from `git` and the implementation from `git-impl`.
- Kept size limits, binary detection, null-result policy, and result validation in the extraction
  implementation.
- Preserved the existing invalid-result error text because it can reach CLI output.
- Recorded that error text and the legacy profiling span names as separate post-migration follow-up
  candidates.
- Updated affected tests and design documentation.
- Passed format, lint, build, and all 577 gitlode tests.

### Step 2: Migrate state boundaries

Keep checkpoint models in `core` as part of its request/result vocabulary until Step 4 moves them
to `extraction-api`. Move persistence ports, state constants, factories, and pure validation into
`state`. Move filesystem persistence into `state-impl`.

Target shape:

```text
state/
  types.ts
  constants.ts
  validation.ts
  factories.ts
  index.ts

state-impl/
  node-state-store.ts
  state-file-loader.ts
  index.ts
```

Review:

- `core` owns the checkpoint model used by its request and result and does not depend on `state`.
- `state` adapts persisted information to that model rather than defining extraction vocabulary.
- Checkpoint semantics are separate from filesystem persistence.
- State JSON and missing-state behavior are unchanged.
- Atomic replacement remains intact.
- `state` contains no filesystem implementation.

Resolve the current validation aliases into names that distinguish pure prior-state validation from
state-file boundary validation.

#### Step 2 results

- Kept `ExtractionState` and `RefCheckpoint` in `core` as part of its request/result contract.
- Moved `StateStore`, missing-state policy, factories, and pure validation into `state`.
- Added `state-impl` for `NodeStateStore` and the state-file loading boundary.
- Replaced the ambiguous `validateExtractionState` / `validateLoadedState` names with
  `validatePriorState` and `validateStateFileContents`; the I/O boundary is named `loadStateFile`.
- Removed the unused `PriorStateLoadOptions` type.
- Kept state JSON, validation order and messages, missing-file behavior, and temporary-file rename
  behavior unchanged.
- Updated consumers, tests, and architecture documentation to use the new owners.
- Recorded the temporary `state -> core` dependency; Step 4 replaces it with
  `state -> extraction-api`.
- Passed format, lint, build, and all 577 gitlode tests.

### Step 3: Migrate the progress contract

Move `ProgressPhase`, `ProgressEvent`, and `ProgressReporter` from `core` into the new top-level
`progress` domain. Keep terminal progress modules under `presentation/progress`.

Review:

- Progress meaning is independent of rendering.
- Extraction and plugin initialization phases remain expressible.
- Reconsider warning/diagnostic ownership if the implementation reveals that it does not belong in
  the progress contract.

#### Step 3 results

- Added the dependency-free top-level `progress` domain.
- Moved `ProgressPhase`, `ProgressEvent`, and `ProgressReporter` out of `core`.
- Updated extraction, plugin enrichment, worker transport, runtime, presentation, and tests to
  depend on `progress` directly.
- Kept terminal controller state, formatting, scheduling, TTY behavior, and rendering under
  `presentation/progress`.
- Preserved all event shapes and warning behavior.
- Recorded the overlap between progress warnings and the worker diagnostic channel as a separate
  follow-up rather than changing the protocol in this migration.
- Passed format, lint, build, and all 577 gitlode tests.

### Step 4: Establish extraction-api

Move the dependency-light extraction vocabulary out of `core/types.ts`:

- canonical facts and projected records;
- fact/record pairing;
- extraction ranges;
- extraction checkpoint state and ref checkpoints;
- stage, projector, and sink ports;
- extraction request and result contracts.

Target shape:

```text
extraction-api/
  facts.ts
  records.ts
  range.ts
  stages.ts
  extraction.ts
  index.ts
```

Remove or relocate stale aggregate types such as `ExtractorConfig`, `ExtractionResult`, and shared
rotation configuration. Keep implementation-construction types out of the API.

Review:

- Output and plugin consumers receive only the contracts they need.
- No plugin API reverse dependency exists.
- Record schema and declaration output remain compatible with the accepted design.

#### Step 4 results

- Added the six-module `extraction-api` domain for facts, projected records, ranges, stage ports,
  checkpoints, and extraction request/result contracts.
- Changed `core`, `state`, `output`, runtime composition, the root facade, and affected tests to
  depend on `extraction-api` directly.
- Kept implementation-construction dependencies and the transitional plugin-author contracts in
  `core`; they move in Steps 5–7.
- Defined serialized extension values in `extraction-api` and derived the transitional non-null
  plugin value from that contract, preserving `plugin-api -> extraction-api` direction.
- Removed the unused `ExtractionResult` and the composition-only `ExtractorConfig`.
- Removed the shared extraction-level `RotationConfig`; CLI, worker transport, and output mechanics
  now describe only the structural values they consume. Step 8 will review their final names and
  ownership while correcting CLI/config boundaries.
- Preserved extraction behavior, checkpoint shape, projected record shape, and plugin declaration
  surface.
- Passed format, lint, all-workspace builds, all 577 gitlode tests, and all 64 official plugin
  tests.

### Step 5: Establish plugin-api

Move plugin-author contracts out of `core/types.ts` into `plugin-api/`. Keep root
`src/plugin-api.ts` as a thin package-export facade.

The serialized extension-value shape belongs to `extraction-api`; `plugin-api` defines the non-null
values a plugin may produce.

Review:

- Dependency direction is `plugin-api -> extraction-api`.
- Runtime loading and host implementation are absent from the public API.
- Official plugin packages build and test successfully.

#### Step 5 results

- Added `plugin-api/types.ts` and its domain barrel for plugin-author contracts.
- Moved plugin interfaces and factories, initialization and projection results, projection context,
  runtime context, failure policy, diagnostics, and namespace out of `core`.
- Kept the host-only `PluginEntry` registry in `core` until the Step 6 `plugin-runtime` migration.
- Changed config and host-side consumers to depend on `plugin-api` directly.
- Reduced root `src/plugin-api.ts` to a package-export facade over the owning domain and supporting
  extraction, instrumentation, model, and type-utility contracts.
- Moved the plugin contract type test from `test/core` to `test/plugin-api`.
- Passed format, lint, all-workspace builds, all 577 gitlode tests, and all 64 official plugin
  tests.

### Step 6: Migrate plugin-runtime

Replace the current `plugins` domain and move `core/enriching-fact-projector.ts` into:

```text
plugin-runtime/
  module-loader.ts
  compatibility-checker.ts
  initializer.ts
  plugin-enriching-projector.ts
  types.ts
  index.ts
```

Change the enriching projector into a decorator that receives the base projector through
constructor injection.

Review:

- `plugin-runtime` depends on `extraction-api`, not extraction implementation.
- Base projection is not duplicated.
- Plugin order, initialization, compatibility warnings, and failure policies are unchanged.

#### Step 6 results

- Replaced the former `plugins` domain with the approved six-module `plugin-runtime` domain.
- Split module loading, compatibility checks, initialization, host types, and enrichment
  orchestration by responsibility.
- Moved `PluginEntry` and host outcomes out of `core`.
- Changed `EnrichingFactProjector` into a decorator over an injected `FactProjector`; it executes
  the base stream once and enriches the corresponding records without duplicating base projection.
- Kept `plugin-runtime` independent of config document types by accepting its own structural plugin
  declarations at the execution boundary.
- Moved lifecycle and enriching-projector tests under `test/plugin-runtime`.
- Preserved plugin declaration order, initialization concurrency and diagnostics, compatibility
  warnings, projection values, failure policies, warning text, and fatal behavior.
- Preserved the existing plugin-enabled profiling shape with no-op base-projection instrumentation;
  recorded normalization of that behavior as a separate follow-up.
- Passed format, lint, all-workspace builds, all 578 gitlode tests, and all 64 official plugin
  tests.

### Step 7: Rename core to extraction

Move the remaining product-policy implementations:

```text
repository-traversal-planner.ts
commit-fact-extractor.ts
file-change-fact-expander.ts
built-in-fact-projector.ts
extraction-pipeline.ts
```

Prioritize mechanical domain movement. Defer broad class and function renames to Step 11.

Review:

- The domain contains extraction policy, not Git backends, output I/O, plugin hosting, or state I/O.
- Date filtering, fallback traversal, and cross-ref deduplication are unchanged.
- Retry-local and cross-ref deduplication responsibilities remain distinct.

#### Step 7 results

- Renamed the remaining `core` source domain to `extraction` without renaming or repartitioning its
  implementation modules.
- Moved the five implementation tests from `test/core` to `test/extraction` and updated runtime and
  plugin-runtime consumers to the new owner.
- Confirmed that `extraction` directly imports only the domains allowed by the approved dependency
  table and does not contain Git backends, output I/O, plugin hosting, or state I/O.
- Preserved the separate deduplication scopes: traversal-local state protects fallback retries, while
  coordinator state deduplicates across refs.
- Updated architecture, traversal, and follow-up documentation to use the new domain name and paths.
- Passed format, lint, the gitlode build, and all 578 gitlode tests.

### Step 8: Correct config and CLI boundaries

Remove the `config -> cli` dependency. Give config loading its own result and diagnostic types, then
translate them at the CLI boundary.

Split `cli/args.ts` where responsibility boundaries are confirmed, with these candidate modules:

```text
command-definition.ts
option-schema.ts
parse-options.ts
resolve-invocation.ts
filesystem-preflight.ts
```

Review:

- CLI/config precedence, path rebasing, help, validation messages, and exit codes are unchanged.
- Config does not know Commander or CLI termination.
- Shared size grammar and rotation limits have a clear owner.

Run the generated-schema check.

#### Step 8 results

- Replaced the former `cli/args.ts` aggregate with modules for command definition, option schema,
  Commander parsing, invocation resolution, and filesystem preflight.
- Gave config loading its own success/failure result and typed diagnostic codes; the CLI invocation
  boundary now translates config failures into the unchanged bootstrap user-error result.
- Removed all `config -> cli` imports.
- Made config the owner of the shared byte-size grammar and rotation-size limits, which CLI option
  validation consumes through the config barrel.
- Moved the invocation-resolution test to match its source owner and added direct coverage for
  config-owned missing-file and invalid-JSON diagnostics.
- Preserved CLI/config precedence, config-relative path rebasing, help metadata, validation
  messages, and exit codes.
- Passed format, lint, the gitlode build, all 580 gitlode tests, and the generated-schema check.

### Step 9: Rename runtime to execution

Move worker transport and one-run composition into `execution/`, then separate confirmed module
responsibilities:

```text
types.ts
worker-client.ts
worker-entry.ts
execute-run.ts
git-adapter-factory.ts
repository-context.ts
plugin-bootstrap.ts
index.ts
```

Remove dependencies on config-document and presentation types. Move state persistence orchestration
behind the execution boundary.

Review:

- Execution composes policies but does not reimplement them.
- Worker protocol, error classification, resource disposal, and profiling snapshot order are
  unchanged.
- Execution has no presentation dependency.

The mechanical directory move and the large-module split may use separate review commits.

#### Step 9 results

- Replaced the `runtime` domain with the approved eight-module `execution` domain and moved its
  three test modules to `test/execution`.
- Split Git adapter construction, repository context resolution, plugin bootstrap, worker
  transport, protocol types, worker entry, and run composition by responsibility.
- Introduced execution-owned run input, result, Git-adapter selection, plugin declaration, and
  success payload types; execution no longer imports config-document or presentation types.
- Moved prior-state loading, missing-state fallback orchestration, worker dispatch, and successful
  state persistence behind `executeRun()`.
- Kept state persistence in the main process and added direct tests for load/dispatch/write ordering
  and the existing fallback warning.
- Preserved worker messages and error classification, run-scoped Git disposal before profiling
  snapshot, plugin behavior, and extraction composition.
- Passed format, lint, the gitlode build, and all 582 gitlode tests.

### Step 10: Thin entrypoints and align presentation/output

Limit `src/index.ts` to connecting CLI, execution, and presentation. Map CLI input to execution
input and execution result to presentation input at this boundary.

Remove cross-domain deep imports and resolve duplicate run-success payloads. Review these identifier
candidates:

```text
OutputWriter     -> JsonlFileWriter
OutputWriterSink -> JsonlOutputSink
```

Review:

- Root entrypoints contain no product policy.
- Presentation and execution do not depend on one another.
- Output owns mechanics, not record semantics.
- CLI output, stderr, and exit codes are unchanged.

Result:

- Kept `src/index.ts` as the composition boundary, with explicit mappings from CLI input to
  `ExecutionRunRequest` and from `ExecutionSuccessPayload` to presentation-owned
  `SuccessReportData`.
- Removed the duplicate success-payload identity and kept execution and presentation independent.
- Renamed `OutputWriter` to `JsonlFileWriter` and `OutputWriterSink` to `JsonlOutputSink` so the
  identifiers state the owned serialization and adaptation mechanics.
- Replaced the remaining cross-domain deep imports with domain-barrel imports and moved
  presentation tests out of the CLI test directory.
- Updated architecture and schema references to the aligned output modules.
- Passed format, lint, the gitlode build, and all gitlode tests.

### Step 11: Perform domain-local naming and module cleanup

After domain ownership is stable, review identifiers and module size separately from file movement.

Priority candidates:

- extraction classes with `Default` prefixes;
- Git adapter facades versus parsing, tree-change, and process-protocol modules;
- eager-exclude, certified-lazy, and frontier responsibilities in `dag/traversal.ts`;
- `PriorityQueue` and `OrderedQueue` module separation within `support`.

Do not split DAG state machines or domains merely because of code volume. Every module split must
have an independent responsibility or reason to change.

Review:

- Names express actual ownership and behavior.
- State machines remain understandable.
- Public surfaces do not expand accidentally.
- Obsolete comments and APIs from the former structure are removed.

Result:

- Replaced extraction implementation names based on `Default` with responsibility-bearing names:
  `RepositoryTraversalPlanner`, `CommitFactExtractor`, `FileChangeFactExpander`,
  `BuiltInFactProjector`, and `ExtractionPipeline`.
- Renamed the presentation heartbeat implementation to `IntervalHeartbeatScheduler`. DAG traversal
  now distinguishes the default-frontier selection policy from the concrete FIFO-frontier factory.
- Split `support/work-queue.ts` into the `WorkQueue` contract, `priority-queue.ts`, and
  `ordered-queue.ts`, while preserving the domain barrel.
- Extracted Git commit-object parsing from `GitCliAdapter` into `git-cli-commit-parser.ts`. Existing
  raw-diff and cat-file protocol modules already provide the other clear Git CLI helper boundaries.
- Retained each DAG state machine as a complete unit in `dag/traversal.ts`: splitting the strategies
  would introduce a new internal traversal protocol without giving any state an independent owner
  or reason to change.
- Retained the Git adapter facades and isomorphic-git tree-change implementation as cohesive
  backend-specific units; code volume alone did not justify additional modules.
- Updated source-aligned tests and durable design references.
- Passed format, lint, the gitlode build, and all 582 gitlode tests.

### Step 12: Finalize documentation

Finalize documentation:

- keep `architecture.md` and `domain-design.md` independent, with explicit ownership and
  cross-references;
- add `domain-design.md` to the design index;
- update paths in related design documents;
- remove the working-draft status;
- keep this handoff document until the separately scoped enforcement work is complete.

Review:

- `architecture.md` provides the system view without duplicating the normative domain rules.
- `domain-design.md` is clearly the canonical domain design.
- The design index routes readers to both documents.

Result:

- Made `domain-design.md` the canonical source for domain principles, charters, dependency rules,
  and source import boundaries.
- Kept `architecture.md` as the canonical system view and replaced duplicated source-layout rules
  with a reference to `domain-design.md`.
- Added the independent domain design document to the design index.
- Removed the working-draft status.
- Deferred library selection and mechanical enforcement to Step 13 after the initial
  dependency-cruiser integration attempt exposed TypeScript 7 compatibility limitations.

### Step 13: Add mechanical architecture enforcement

Select and configure an architecture-checking approach for:

- the closed domain allowlist;
- contract-to-implementation reverse dependencies;
- domain cycles;
- cross-domain deep imports;
- type-only versus runtime edges where practical;
- the strict `type-utils` charter and its status as the only global domain; and
- equality between registered domains and top-level directories under `src/`.

The evaluation must account for the current TypeScript toolchain and syntax. In the Step 12
investigation, dependency-cruiser 18.1 did not accept TypeScript 7 as its TypeScript parser, while
its SWC parser failed on the `await using` declaration in `execution/execute-run.ts`. Re-evaluate a
later dependency-cruiser release, Rev-dep, or a narrowly scoped alternative rather than accepting a
check that silently analyzes no modules.

Review:

- The check analyzes every source module and fails rather than silently succeeding when parsing is
  incomplete.
- Implementation, dependency checks, and documentation agree.
- No transitional allowlist exceptions remain.
- Checks protect the architecture without preventing legitimate future changes.
- Delete this handoff document when the migration and enforcement work are both complete.

## Dependency order

```text
line-diff
  -> state
  -> progress
  -> extraction-api
  -> plugin-api
  -> plugin-runtime
  -> extraction
  -> config / cli
  -> execution
  -> entrypoints / presentation / output
  -> local naming and module cleanup
  -> final documentation
  -> mechanical enforcement
```

The sequence establishes low-level contracts before their consumers and delays composition-root
changes until the underlying domains are stable.
