### Phase 1: Non-Branch Ref State Tracking

_Add reliable incremental-state tracking for non-branch refs by extending state persistence and traversal-planning rules so tag and commit OID refs are not re-extracted in full on every `--state` run._

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `instructions/git-traversal.instructions.md` — traversal lower-bound semantics, state-file update safety, and incremental extraction behavior
- `instructions/architecture.instructions.md` — layer ownership, state schema contract, and runtime boundary rules
- `instructions/development-workflow.instructions.md` — planning-branch completion and artifact rules
- Roadmap item: "State/Incremental: Track non-branch refs in state for reliable incremental extraction"

#### Design Decisions

- **State shape (contract redesign)**:
  - Replace the branch-only state model with a unified ref-checkpoint model in **state schema version 2**.
  - New top-level shape:
    - `version: 2`
    - `generatedAt`
    - `repositoryPath`
    - `refs[]`
  - `refs[]` entry shape:
    - `ref`: exact `--ref` token provided by the user
    - `refType`: `"branch" | "tag-lightweight" | "tag-annotated" | "commit-oid"`
    - `tipOid`: resolved ref tip commit OID at successful completion; used as the traversal lower bound on the next incremental run
    - `updatedAt`: ISO timestamp for per-entry refresh time
  - Remove `branches[]` from the canonical schema; do not carry dual structures in v2.
- **Wire field naming policy**:
  - Replace `lastCommitHash` with `tipOid` as the canonical field in v2.
  - `tipOid` serves dual purpose: what was the ref tip at last successful run, and what to use as `excludeHash` on the next incremental run. These are always the same value under the current spec.
  - No compatibility alias is kept in v2 state reads or writes.
- **Owning layer and responsibilities**:
  - Core owns ref classification, lower-bound selection, warning emission, and candidate state construction.
  - Runtime edge (`src/index.ts`) continues to own state-file read/write plumbing, repository-path validation, and OID-shape validation.
  - Git adapter remains responsible for ref resolution and branch/non-branch detection primitives; Core must not infer Git object internals directly.
- **Lower-bound resolution rules (v2-only planner contract)**:
  - Planner consumes only normalized v2 `refs[]` entries.
  - For each requested ref, resolve runtime `refType` and current tip, then choose boundary:
    1. Exact match on (`ref`, `refType`) in `refs[]`: use its `tipOid` as `excludeHash`.
    2. No match: treat as new ref.
  - New branch refs in incremental mode use merge-base fallback computed from existing **branch** refs' `tipOid` values.
  - New tag/commit-OID refs do not use merge-base fallback; they run full traversal unless a direct checkpoint exists.
  - State files with version other than `2` are rejected as unsupported in incremental mode.
- **Static ref warning policy after implementation**:
  - Remove the old warning text about non-branch refs being untracked.
  - Keep a focused warning for all non-branch refs (commit-oid, tag-annotated, and tag-lightweight) where incremental gain is inherently limited or variable.
  - The warning must explicitly state that tracking is active, but future deltas are usually empty unless the ref target changes.
- **State write normalization policy**:
  - On successful completion, write v2 `refs[]` entries for all resolved refs processed in the run.
  - Do not persist skipped/unresolved refs.
  - Preserve existing atomic write guarantees (`.tmp` then rename) and write timing (only after sink close succeeds).
- **Explicit edge-case behavior**:
  - Missing state file:
    - `--missing-state snapshot`: full traversal for requested refs; initialize v2 `refs[]` on success.
    - `--missing-state error`: existing error behavior remains unchanged.
  - Ref removed or renamed between runs:
    - If requested ref cannot be resolved at run start, warn and skip.
    - Prior `refs[]` entries not referenced by this run are dropped from rewritten state (state reflects current requested ref set only).
  - Ref type changes between runs (e.g., branch name later reused as tag):
    - Runtime `refType` is part of identity; a type change is treated as a new state entry.
    - Old entry with same `ref` but different `refType` is not reused.
  - Mixed ref sets in one execution (branches + tags + OIDs):
    - Traverse in CLI ref order with existing run-level dedup behavior.
    - Apply per-ref boundary rules above; state output is always a single v2 `refs[]` set.

#### Non-Goals

- Introduce similarity-based history inference or broader rename/move semantics
- Redesign unrelated output schema or reporting surfaces outside state/incremental behavior
- Change CLI option names or add new CLI flags in this phase
- Implement automatic migration from legacy state versions

#### Target Files

| File                                       | Action | Notes                                                              |
| ------------------------------------------ | ------ | ------------------------------------------------------------------ |
| `src/core/types.ts`                        | Modify | Replace state types with v2 unified refs state model               |
| `src/core/extraction-coordinator.ts`       | Modify | Build candidate state with v2 `refs[]`; adjust static-ref warnings |
| `src/core/traversal-planner.ts`            | Modify | Apply ref-type-specific lower-bound resolution rules               |
| `src/index.ts`                             | Modify | Enforce v2-only state read/write and validation                    |
| `src/core/index.ts`                        | Modify | Re-export any newly introduced core state types                    |
| `test/core/extraction-coordinator.test.ts` | Modify | Cover state write shape and static-ref warning policy              |
| `test/core/traversal-planner.test.ts`      | Modify | Cover v2 refs entry matching and per-type lower-bound precedence   |
| `test/index.test.ts`                       | Modify | Cover version rejection, v2 validation, and mixed-ref scenarios    |

#### Documentation Touchpoints

| File                                                 | Section                       | Action  |
| ---------------------------------------------------- | ----------------------------- | ------- |
| `docs/usage.md`                                      | "Incremental mode"            | Replace |
| `docs/usage.md`                                      | "State File Management"       | Replace |
| `docs/usage.md`                                      | "Multi-Branch Extraction"     | Update  |
| `docs/design/git-traversal.md`                       | "Differential by state file"  | Replace |
| `docs/design/git-traversal.md`                       | "State file lifecycle"        | Replace |
| `docs/design/git-traversal.md`                       | "Error and recovery behavior" | Update  |
| `docs/design/architecture.md`                        | "Core layer"                  | Update  |
| `docs/design/architecture.md`                        | "End-to-End Runtime Flow"     | Update  |
| `.github/instructions/git-traversal.instructions.md` | "Incremental Mode"            | Replace |
| `.github/instructions/git-traversal.instructions.md` | "State File Management"       | Replace |
| `.github/instructions/git-traversal.instructions.md` | "Warning Conditions"          | Replace |
| `.github/instructions/architecture.instructions.md`  | "State File"                  | Replace |

#### Implementation Notes

- Use exact ref input token for `refs[].ref`; avoid hidden normalization rules.
- Keep all warning strings actionable and type-specific so operators can decide when snapshot mode is preferable.
- Reject non-v2 state files with a clear actionable error message and remediation text.
- Keep state entry identity strict: (`ref`, `refType`) pair only.
- `tipOid` doubles as the next-run `excludeHash`; write it from the resolved ref head at successful run completion.

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```text
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- Incremental with mixed refs (`--ref main --ref v1.0 --ref <oid>` + `--state`) writes a v2 `refs[]` set with per-type entries and no blanket non-branch warning.
- Re-running with unchanged annotated tag and raw OID emits static-ref warning and outputs zero new records when boundary equals head.
- State file with `version: 1` is rejected in incremental mode with an explicit unsupported-version error.
- Ref-type change scenario (same name represented as branch in one run and tag in a later run) follows runtime type and updates state structure accordingly.
