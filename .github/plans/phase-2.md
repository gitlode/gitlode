### Phase 2: Identifier Naming Audit

_Refine internal TypeScript identifier names so they match the actual domain concept (state lifecycle and ownership boundaries) while preserving all runtime behavior, CLI behavior, output schema, and on-disk state schema._

#### Status

- [x] Planned
- [ ] In progress
- [ ] Completed

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `.github/roadmap.md` — "Code hygiene: Identifier naming audit for semantic accuracy"
- `.github/instructions/architecture.instructions.md` — "Canonical vocabulary" and "Ownership and boundary rules"
- `.github/plan.md` — v0.4.1 phase ordering and scope
- `.github/instructions/phase-template.instructions.md` — required phase structure and completion criteria

---

#### Design Decisions

**Scope boundary confirmation (non-negotiable)**

This phase remains a strict internal rename refactor and explicitly includes all of the following constraints:

- No change to CLI flags, CLI behavior, or process exit behavior
- No change to output JSON schema or JSONL format
- No change to state file JSON structure on disk, including field names and version semantics
- No behavioral change of any kind
- Only internal TypeScript identifier renames (types, interfaces, aliases, symbols, imports/usages)

Any rename that requires changing CLI-facing text contracts, output fields, or persisted JSON keys is out of scope.

**Naming rules to apply consistently**

- Use `State` for in-memory/domain data structures representing persisted extraction progress.
- Use `Store` only for abstractions that perform persistence I/O.
- Avoid `Checkpoint` for this domain because it implies runtime recovery/checkpointing semantics not present in gitrail's state model.
- Keep file paths stable (no file rename/move) to minimize path churn; rename symbols and usages only.
- Keep existing state JSON keys (`version`, `generatedAt`, `repositoryPath`, `branches`, `name`, `lastCommitHash`) unchanged.

**Module/file organization rules**

- Keep `src/core/types.ts` as the single home for exported Core interfaces, type aliases, and structural dependency contracts.
- Keep implementation modules (`src/core/*.ts`) focused on runtime classes, generators, and helpers; do not leave exported interface declarations in those files when the interface is part of the Core contract.
- When a Core stage has both an interface and a default implementation, place the interface in `src/core/types.ts` and the default implementation in its own module file.
- Prefer structural dependency slots in `CoordinatorDependencies` when that avoids circular imports, but do not use that as a reason to keep a public stage interface in an implementation module.
- Preserve the existing file boundaries for git/output layers unless a similar split is required by a module-organization rule derived from the core cleanup.

**Final rename list**

The following identifiers are the finalized Phase 2 rename set:

- `CheckpointStore` -> `StateStore`
- `ExtractionCheckpoint` -> `ExtractionState`
- `BranchCheckpoint` -> `BranchState`
- `CoordinatorRequest.priorCheckpoint` -> `priorState`
- `CoordinatorDependencies.checkpointStore` -> `stateStore`
- `NodeCheckpointStore` -> `NodeStateStore`
- `emptyCheckpoint` -> `emptyState`
- `loadPriorCheckpoint` -> `loadPriorState`
- `candidateCheckpoint` -> `candidateState`
- `priorCheckpoint` local variable in `src/index.ts` -> `priorState`
- `makeCheckpointStore` test helper -> `makeStateStore`
- `emptyCheckpoint` test helper -> `emptyState`

These renames are internal symbol-level changes only. File names remain unchanged.

**Final target-file set**

- `src/core/types.ts`: rename the state/store type names and the coordinator request/dependency field names.
- `src/core/index.ts`: re-export the renamed core types.
- `src/core/fact-projector.ts`: move the exported `FactProjector` interface out of the implementation module and keep only `DefaultFactProjector` there.
- `src/core/branch-traversal-planner.ts`: move the exported `BranchTraversalPlanner` interface out of the implementation module and keep only `DefaultBranchTraversalPlanner` there.
- `src/core/commit-traversal-extractor.ts`: move the exported `CommitTraversalExtractor` interface out of the implementation module and keep only `DefaultCommitTraversalExtractor` there.
- `src/core/file-change-expander.ts`: move the exported `FileChangeExpander` interface out of the implementation module and keep only `DefaultFileChangeExpander` there.
- `src/core/extraction-coordinator.ts`: move the exported `ExtractionCoordinator` interface out of the implementation module, rename the imported type names, and rename the local `candidateCheckpoint` variable.
- `src/index.ts`: rename the Node-backed state store class and the local state-loading helper identifiers.
- `test/core/extraction-coordinator.test.ts`: rename the imported types plus helper/test symbols that construct or wire the renamed core request/dependency fields.

**Final exclusion list with rationale**

- `stateFilePath` is kept: it denotes a filesystem location and is already the clearest runtime-edge term.
- `PersonIdentity` is kept: it is semantically correct for `{name,email}` and does not belong to the state/store naming drift this phase addresses.
- `Fact` remains a union type in `src/core/types.ts`.
- `FactProjector` remains a Core concept, but the interface itself moves to `src/core/types.ts` so the implementation module stays runtime-only.
- `DefaultFactProjector` remains the concrete projection implementation in `src/core/fact-projector.ts`.
- `perFile` is kept: it is a broader CLI terminology concern and is outside this internal audit boundary.
- `src/git/**` and `test/git/**` remain unchanged: no identifier in those areas is part of the finalized state/store rename surface.

**Import/path churn control**

- Do not move or rename files.
- Perform all exported-type rename updates in `src/core/types.ts` and `src/core/index.ts` first, then update dependent imports in consumers.
- Keep barrel exports in `src/core/index.ts` synchronized in the same change to avoid transient unresolved symbol chains.
- Limit rename scope to affected symbols only; avoid opportunistic cleanup.

**Migration order to avoid temporary type errors**

1. Rename canonical state symbols in `src/core/types.ts`.
2. Update re-exports in `src/core/index.ts`.
3. Update coordinator/runtime usage sites (`src/core/extraction-coordinator.ts`, `src/index.ts`).
4. Update tests that import or construct renamed symbols (`test/core/extraction-coordinator.test.ts`).
5. Run build/tests/format checks and ensure no residual old identifiers remain via grep.

**Owning layers**

- Core owns type vocabulary (`StateStore`, `ExtractionState`, `BranchState`) and coordinator-level variable naming.
- Runtime edge (`src/index.ts`) owns the Node-backed implementation class naming (`NodeStateStore`) and the local state-loading helper names.
- No ownership changes across CLI/Git/Output layers.

**New runtime dependencies**

- None.

---

#### Non-Goals

- Renaming CLI option names, aliases, or parser/result fields.
- Renaming persisted state JSON keys or versioning semantics.
- Refactoring state read/write behavior, warning behavior, or incremental traversal behavior.
- Renaming unrelated symbols in git/output layers unless required by direct type propagation from this phase's finalized mapping.
- Any architecture changes introduced in Phase 1 (already completed design scope).

---

#### Target Files

| File                                       | Action | Notes                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/types.ts`                        | Modify | Rename `CheckpointStore`/`ExtractionCheckpoint`/`BranchCheckpoint`; rename `CoordinatorRequest.priorCheckpoint` to `priorState`; rename `CoordinatorDependencies.checkpointStore` to `stateStore`; add moved stage interfaces (`FactProjector`, `BranchTraversalPlanner`, `CommitTraversalExtractor`, `FileChangeExpander`, `ExtractionCoordinator`) |
| `src/core/index.ts`                        | Modify | Re-export the renamed core state types                                                                                                                                                                                                                                                                                                               |
| `src/core/fact-projector.ts`               | Modify | Remove `export interface FactProjector` (moved to `types.ts`); keep `DefaultFactProjector` class unchanged                                                                                                                                                                                                                                           |
| `src/core/branch-traversal-planner.ts`     | Modify | Remove `export interface BranchTraversalPlanner` (moved to `types.ts`); keep `DefaultBranchTraversalPlanner` class unchanged                                                                                                                                                                                                                         |
| `src/core/commit-traversal-extractor.ts`   | Modify | Remove `export interface CommitTraversalExtractor` (moved to `types.ts`); keep `DefaultCommitTraversalExtractor` class unchanged                                                                                                                                                                                                                     |
| `src/core/file-change-expander.ts`         | Modify | Remove `export interface FileChangeExpander` (moved to `types.ts`); keep `DefaultFileChangeExpander` class unchanged                                                                                                                                                                                                                                 |
| `src/core/extraction-coordinator.ts`       | Modify | Remove `export interface ExtractionCoordinator` (moved to `types.ts`); rename imported types and local `candidateCheckpoint` to `candidateState`; preserve logic                                                                                                                                                                                     |
| `src/index.ts`                             | Modify | Rename `NodeCheckpointStore` to `NodeStateStore`; rename `emptyCheckpoint` to `emptyState`, `loadPriorCheckpoint` to `loadPriorState`, and the local `priorCheckpoint` variable to `priorState`                                                                                                                                                      |
| `test/core/extraction-coordinator.test.ts` | Modify | Rename imported types and helper/test symbols affected by state-related type name propagation, including `makeCheckpointStore` -> `makeStateStore` and `emptyCheckpoint` -> `emptyState`                                                                                                                                                             |

Audited and intentionally no-change in this phase:

- `src/git/types.ts`
- `src/git/index.ts`
- `test/git/**`

Reason: no identifier in these files is part of the finalized state/store rename surface.

---

#### Documentation Touchpoints

| File                                                 | Section                        | Action                                                                                                                              |
| ---------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `.github/instructions/architecture.instructions.md`  | "Canonical vocabulary"         | Replace `CheckpointStore` / `ExtractionCheckpoint` / `BranchCheckpoint` terms with `StateStore` / `ExtractionState` / `BranchState` |
| `.github/instructions/architecture.instructions.md`  | "File Layout Convention"       | Add the rule that public Core interfaces live in `src/core/types.ts` and implementation modules stay runtime-only                   |
| `.github/instructions/architecture.instructions.md`  | "Ownership and boundary rules" | Update the runtime-edge bullet and coordinator ownership wording to use `StateStore` and `ExtractionState`                          |
| `.github/instructions/architecture.instructions.md`  | "State File"                   | Rename the state-file schema example type from `ExtractionCheckpoint` to `ExtractionState`                                          |
| `.github/instructions/git-traversal.instructions.md` | "Stage Ownership Contract"     | Update coordinator/runtime ownership wording to use `StateStore`, `ExtractionState`, and `candidateState`                           |
| `.github/instructions/git-traversal.instructions.md` | "State File Management"        | Keep the external state-file behavior unchanged while aligning the internal terminology with the refined state vocabulary           |

No user-facing docs are expected to change because behavior and external contracts are unchanged.

---

#### Implementation Notes

- Apply symbol renames as a single coherent refactor pass to keep CI green and avoid partial-type states.
- Preserve existing comments unless they contain renamed identifiers; update only terminology, not behavioral wording.
- Do not change function signatures or return shapes beyond identifier names in type positions.

---

#### Verification

_The phase is not complete until all items below pass._

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks (zero-behavior-change evidence):**

- Run one commit-granularity extraction before and after the refactor on the same repository and args; confirm output JSONL records are byte-equivalent except for timestamp-dependent filename/session metadata.
- Run one file-granularity extraction (`--per-file`) before and after the refactor on the same repository and args; confirm record content parity.
- Run one incremental extraction with `--state` where prior state exists; confirm state file JSON keys/shape/version are unchanged and only expected commit-hash/head values differ by repository state.
- Grep for legacy symbols (`CheckpointStore|ExtractionCheckpoint|BranchCheckpoint|NodeCheckpointStore|priorCheckpoint|candidateCheckpoint|makeCheckpointStore`) and confirm they no longer appear in `src/**` and relevant `test/**` code after implementation.
- Grep for `export interface` in `src/core/fact-projector.ts`, `src/core/branch-traversal-planner.ts`, `src/core/commit-traversal-extractor.ts`, `src/core/file-change-expander.ts`, and `src/core/extraction-coordinator.ts`, and confirm none appear (all stage interfaces have been moved to `types.ts`).
