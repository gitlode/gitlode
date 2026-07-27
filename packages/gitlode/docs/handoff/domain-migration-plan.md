# Domain Migration Plan

## Status

Steps 0–5 completed on 2026-07-27. Step 6 has not started.

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

| Temporary exception                                                                                                                | Expires                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `core` owns the plugin host registry and extraction implementation.                                                                | Steps 6–7, according to the inventory |
| `plugins` is the plugin host domain and depends directly on config document types.                                                 | Step 6                                |
| `config` imports CLI constants and termination types.                                                                              | Step 8                                |
| `runtime` mixes execution composition, worker transport, config types, presentation types, and direct state implementation access. | Step 9                                |
| Existing cross-domain deep imports may remain until their owning step. No new cross-domain deep import may be introduced.          | Steps 2–10                            |
| The dependency allowlist and `type-utils` charter are reviewed manually rather than mechanically enforced.                         | Step 12                               |

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

### Step 7: Rename core to extraction

Move the remaining product-policy implementations:

```text
traversal-planner.ts
commit-traversal-extractor.ts
file-change-expander.ts
fact-projector.ts
extraction-coordinator.ts
```

Prioritize mechanical domain movement. Defer broad class and function renames to Step 11.

Review:

- The domain contains extraction policy, not Git backends, output I/O, plugin hosting, or state I/O.
- Date filtering, fallback traversal, and cross-ref deduplication are unchanged.
- Retry-local and cross-ref deduplication responsibilities remain distinct.

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

### Step 12: Enforce architecture and finalize documentation

Add checks for:

- the closed domain allowlist;
- contract-to-implementation reverse dependencies;
- domain cycles;
- cross-domain deep imports;
- type-only versus runtime edges where practical;
- the strict `type-utils` charter and its status as the only global domain.

Finalize documentation:

- integrate accepted architecture into `architecture.md`;
- add `domain-design.md` to the design index;
- update paths in related design documents;
- remove the working-draft status;
- delete this handoff document when no migration work remains.

Review:

- Implementation, dependency checks, and documentation agree.
- No transitional allowlist exceptions remain.
- Checks protect the architecture without preventing legitimate future changes.

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
  -> enforcement and final documentation
```

The sequence establishes low-level contracts before their consumers and delays composition-root
changes until the underlying domains are stable.
