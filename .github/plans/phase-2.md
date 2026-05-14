### Phase 2: Identifier Naming Audit

_Refine internal TypeScript identifier names so they match the actual domain concept (state lifecycle and ownership boundaries) while preserving all runtime behavior, CLI behavior, output schema, and on-disk state schema._

#### Status

- [x] Planned
- [ ] In progress
- [ ] Completed

#### Design Maturity

- [ ] Implementation-ready
- [x] Deferred design

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

The finalized rename execution list is intentionally deferred until a post-Phase-1 refinement checkpoint (see Deferred Design Controls), but all constraints above are already fixed and non-negotiable.

**Naming rules to apply consistently**

- Use `State` for in-memory/domain data structures representing persisted extraction progress.
- Use `Store` only for abstractions that perform persistence I/O.
- Avoid `Checkpoint` for this domain because it implies runtime recovery/checkpointing semantics not present in gitrail's state model.
- Keep file paths stable (no file rename/move) to minimize path churn; rename symbols and usages only.
- Keep existing state JSON keys (`version`, `generatedAt`, `repositoryPath`, `branches`, `name`, `lastCommitHash`) unchanged.

**Current candidate rename list (to be revalidated before implementation)**

The following identifiers are the current preferred mappings and must be revalidated against the implemented Phase 1 code before Phase 2 execution:

- `CheckpointStore` -> `StateStore`
- `BranchCheckpoint` -> `BranchState`
- `ExtractionCheckpoint` -> `ExtractionState`
- `NodeCheckpointStore` -> `NodeStateStore`
- `emptyCheckpoint` -> `emptyState`
- `loadPriorCheckpoint` -> `loadPriorState`
- `priorCheckpoint` -> `priorState`
- `candidateCheckpoint` -> `candidateState`

These renames are internal symbol-level changes only. File names remain unchanged.

**Intentionally not renamed in Phase 2 (current decision, revalidated at refinement)**

- `PersonIdentity` (kept): semantically acceptable for `{name,email}` and not part of the state/checkpoint naming drift targeted by this phase. Renaming would expand churn into output/git type contracts with low clarity gain.
- `stateFilePath` (kept): reflects filesystem location semantics and is used in CLI parsing/runtime edge. Renaming to `statePath` would not materially improve clarity.
- `Fact`, `FactProjector`, `DefaultFactProjector` (kept): introduced in Phase 1 and aligned with canonical vocabulary.
- `perFile` (kept): known naming debt but tied to larger CLI terminology evolution; outside this internal-audit phase boundary.

**Import/path churn control**

- Do not move or rename files.
- Perform all exported-type rename updates in `src/core/types.ts` and `src/core/index.ts` first, then update dependent imports in consumers.
- Keep barrel exports in `src/core/index.ts` synchronized in the same change to avoid transient unresolved symbol chains.
- Limit rename scope to affected symbols only; avoid opportunistic cleanup.

**Migration order to avoid temporary type errors (locked approach)**

1. Rename canonical state symbols in `src/core/types.ts`.
2. Update re-exports in `src/core/index.ts`.
3. Update coordinator/runtime usage sites (`src/core/extraction-coordinator.ts`, `src/index.ts`).
4. Update tests that import or construct renamed symbols (`test/core/extraction-coordinator.test.ts`).
5. Run build/tests/format checks and ensure no residual old identifiers remain via grep.

**Owning layers**

- Core owns type vocabulary (`StateStore`, `ExtractionState`, `BranchState`) and coordinator-level variable naming.
- Runtime edge (`src/index.ts`) owns Node-backed implementation class naming (`NodeStateStore`) and loader/helper symbol names.
- No ownership changes across CLI/Git/Output layers.

**New runtime dependencies**

- None.

---

#### Deferred Design Controls

- **Why deferred**: Phase 2 explicitly includes naming targets introduced/changed by Phase 1. Until Phase 1 implementation is complete and reviewed on branch, the exact rename surface cannot be finalized without risking stale or incorrect symbol mappings.
- **Depends on**: Completed Phase 1 implementation state (including final exported names and file layout), plus latest `src/**` and `test/**` references on the Phase 2 implementation start point.
- **Fixed before refinement**: Scope boundary constraints, naming rules (`State` vs `Store`, avoid `Checkpoint`), no file-path renames, no behavior change policy, and current candidate mappings as the baseline proposal.
- **To be finalized in refinement**: Final rename list (exact before/after), final target-file set, final exclusion list, and any newly introduced Phase 1 symbols that must be included in rename propagation.
- **Refinement trigger**: Start of Phase 2 implementation session after Phase 1 merge/rebase state is available in the working branch.
- **Required inputs**: Latest `src/core/**`, `src/git/**`, `test/core/**`, `test/git/**`, `src/index.ts`, and updated instruction vocabulary references.

---

#### Non-Goals

- Renaming CLI option names, aliases, or parser/result fields.
- Renaming persisted state JSON keys or versioning semantics.
- Refactoring state read/write behavior, warning behavior, or incremental traversal behavior.
- Renaming unrelated symbols in git/output layers unless required by direct type propagation from this phase's final mapping.
- Any architecture changes introduced in Phase 1 (already completed design scope).

---

#### Target Files

| File                                       | Action | Notes                                                                                                                                                   |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/types.ts`                        | Modify | Rename state/checkpoint interfaces and store interface: `CheckpointStore`, `ExtractionCheckpoint`, `BranchCheckpoint`, `priorCheckpoint` reference type |
| `src/core/index.ts`                        | Modify | Rename corresponding re-exported type names                                                                                                             |
| `src/core/extraction-coordinator.ts`       | Modify | Rename imported types and local symbol `candidateCheckpoint` -> `candidateState`; preserve logic                                                        |
| `src/index.ts`                             | Modify | Rename store class and state helper/function/variable identifiers (`NodeStateStore`, `emptyState`, `loadPriorState`, `priorState`)                      |
| `test/core/extraction-coordinator.test.ts` | Modify | Rename imported types and helper/test symbols affected by state-related type name propagation                                                           |

Audited and intentionally no-change in this phase:

- `src/git/types.ts`
- `src/git/index.ts`
- `test/git/**`

Reason: no identifier in these files currently violates the selected state/checkpoint naming rules strongly enough to justify additional churn in v0.4.1.

Provisional status note:

- The table above is a provisional baseline and must be revalidated during the deferred-design refinement checkpoint before implementation begins.

---

#### Documentation Touchpoints

| File                                                 | Section                        | Action                                                                                                                              |
| ---------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `.github/instructions/architecture.instructions.md`  | "Canonical vocabulary"         | Replace `CheckpointStore` / `ExtractionCheckpoint` / `BranchCheckpoint` terms with `StateStore` / `ExtractionState` / `BranchState` |
| `.github/instructions/architecture.instructions.md`  | "Ownership and boundary rules" | Update the runtime-edge bullet that names the injected store abstraction                                                            |
| `.github/instructions/git-traversal.instructions.md` | "Stage Ownership Contract"     | Update coordinator/runtime ownership wording to use renamed state/store identifiers                                                 |

No user-facing docs are expected to change because behavior and external contracts are unchanged.

---

#### Implementation Notes

- Apply symbol renames as a single coherent refactor pass to keep CI green and avoid partial-type states.
- Preserve existing comments unless they contain renamed identifiers; update only terminology, not behavioral wording.
- Do not change function signatures or return shapes beyond identifier names in type positions.

**Required question resolutions**

- Which identifiers are definitely renamed? Deferred until refinement; current candidate mapping is defined and must be confirmed against post-Phase-1 code.
- Which plausible candidates are intentionally not renamed now, and why? Currently resolved by the explicit keep-list and rationale; must be revalidated at refinement.
- How is import/path churn controlled? Resolved: symbol-only rename, stable file paths, synchronized barrel updates.
- What migration order avoids temporary type errors? Resolved by the five-step order above.
- What test updates are required? Current baseline is rename-propagation updates in `test/core/extraction-coordinator.test.ts`; final set is confirmed at refinement.
- What evidence confirms behavior is unchanged? Defined in Verification below.

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
- Grep for legacy symbols (`CheckpointStore|ExtractionCheckpoint|BranchCheckpoint|NodeCheckpointStore|priorCheckpoint|candidateCheckpoint`) and confirm they no longer appear in `src/**` and relevant `test/**` code after implementation.
