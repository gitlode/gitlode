### Phase 1: Release-Boundary Extraction Workflow

_Define a first-class, user-facing release-boundary extraction workflow using the existing CLI parameter model (`--ref`, `--since-ref`, `--state`, `--incremental`) and clarify boundary ref resolution, state semantics, and empty-result behavior without introducing a new range flag in this phase._

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `instructions/cli.instructions.md` — extraction mode, range filter, state management, validation/help contracts
- `instructions/git-traversal.instructions.md` — traversal boundary semantics, ref reachability, state commit semantics
- `instructions/architecture.instructions.md` — layer ownership, correctness guarantees, state/output invariants
- Roadmap item: "CLI UX: Release-boundary extraction workflow"

#### Design Decisions

- **User-facing model**: Phase 1 establishes a first-class documented workflow built on the existing parameter model, not a new `--until-ref`-style flag. The workflow is expressed as two explicit patterns:
  - release snapshot pattern (extract history included in release boundary once): run snapshot with `--ref <release-ref>` and optionally `--state`
  - post-release bootstrap + incremental pattern: run snapshot with `--ref <active-branch> --since-ref <release-ref> --state <path>`, then continue with `--incremental --ref <active-branch> --state <path>`
- **CLI surface policy for Phase 1**: `--branch` is replaced by `--ref`. The new parameter name is intentionally general because its accepted values are Git revision-style inputs, not only branch names. No separate branch-only entry point is retained in this phase.
- **Boundary semantics**:
  - `--ref` remains the traversal starting ref for inclusion set definition.
  - `--since-ref` remains the exclusion boundary for snapshot-mode range subtraction (`boundary..head` semantics).
  - `--state` remains the continuity anchor across runs; the persisted state continues to describe tracked branches, not arbitrary refs, and is written only after successful output close.
  - incremental bootstrap after release boundary is achieved through existing state + merge-base behavior for newly added branches.
- **Ref-resolution contract (applies to both `--ref` and `--since-ref`)**:
  1. Accept branch names, lightweight tag names, annotated tag names, and raw commit object IDs via repository ref resolution.
  2. Lightweight tags resolve directly to the tagged commit object ID.
  3. Annotated tags are peeled to the tagged commit object ID.
  4. Raw commit object IDs are valid direct inputs if they identify an existing commit object.
  5. Any non-resolvable or non-commit target fails validation as user error before extraction begins.
- **Empty-result behavior around release boundaries**:
  - If the computed range is empty because head equals boundary, or because head is already contained in boundary reachability, extraction succeeds with zero records; this is not an error.
  - In snapshot mode with `--since-ref` and `--state`, keep the existing warning contract for potentially misleading bootstrap combinations; zero-result success still applies.
  - Summary/profile output behavior remains unchanged; zero-record completion is rendered through the existing completion contract.
- **Scope limit for this phase**: Phase 1 is explicitly limited to a single-boundary workflow per invocation (one optional `--since-ref` boundary). Multi-boundary windows/ranges and "between two release refs" UX are out of scope and remain roadmap-level future work.
- **Owning layer**:
  - CLI layer owns argument contract, validation messaging, and user-facing help/workflow wording, including the distinction between the starting `--ref` and the branch-only state checkpoint.
  - Core/git layers own ref resolution behavior, traversal correctness, and state interaction semantics.
  - Architecture invariants (exactly-once per run, post-close state commit timing) remain unchanged.
- **New runtime dependencies**: None.

#### Non-Goals

- Introduce a new range parameter such as `--until-ref` in this release phase.
- Keep a branch-only `--branch` entry point alongside `--ref`.
- Support multi-boundary extraction (`--from-ref` + `--until-ref`, or multiple `--since-ref` values) in one invocation.
- Redesign state-file schema or alter existing state-write timing invariants.
- Expand output schema or add release attribution fields to emitted records.

#### Target Files

| File                                         | Action | Notes                                                                                            |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `.github/plans/phase-1.md`                   | Create | Canonical Phase 1 design artifact for implementation handoff.                                    |
| `src/cli/args.ts`                            | Modify | Enforce finalized ref-input and empty-range validation/diagnostic contracts where needed.        |
| `src/cli/index.ts`                           | Modify | Ensure workflow-level warnings and successful zero-result behavior match design decisions.       |
| `src/core/types.ts`                          | Modify | Rename CLI-facing extraction inputs to `--ref` terminology while keeping branch state semantics. |
| `src/core/branch-traversal-planner.ts`       | Modify | Align ref-based traversal planning with single-boundary release workflow semantics.              |
| `src/core/extraction-coordinator.ts`         | Modify | Preserve state commit invariant and ensure zero-result success path remains explicit.            |
| `src/git/isomorphic-git-adapter.ts`          | Modify | Implement/verify ref resolution and annotated-tag peeling contract for branch/since boundaries.  |
| `test/cli/args.test.ts`                      | Modify | Add/adjust tests for release-boundary workflow validation and contracts.                         |
| `test/cli/cmd-definition.test.ts`            | Modify | Confirm CLI surface remains unchanged (no new Phase 1 range option).                             |
| `test/index.test.ts`                         | Modify | Update successful-run summary expectations if branch terminology changes in user-visible output. |
| `test/core/branch-traversal-planner.test.ts` | Modify | Cover boundary reachability and empty-result planning scenarios.                                 |
| `test/core/extraction-coordinator.test.ts`   | Modify | Cover zero-result success and state timing behavior.                                             |
| `test/git/isomorphic-git-adapter.test.ts`    | Modify | Cover branch/tag/annotated-tag/raw-commit ref resolution contract.                               |

#### Documentation Touchpoints

| File                                                 | Section                                                 | Action |
| ---------------------------------------------------- | ------------------------------------------------------- | ------ |
| `.github/instructions/cli.instructions.md`           | `Extraction Mode` / `Range Filter (snapshot mode only)` | Update |
| `.github/instructions/cli.instructions.md`           | `Usage Examples`                                        | Update |
| `.github/instructions/cli.instructions.md`           | `Validation Rules`                                      | Update |
| `.github/instructions/git-traversal.instructions.md` | `Traversal Algorithm`                                   | Update |
| `.github/instructions/git-traversal.instructions.md` | `State File Records HEAD, Not Filtered Range`           | Update |
| `.github/instructions/git-traversal.instructions.md` | `Warning Conditions`                                    | Update |
| `.github/instructions/architecture.instructions.md`  | `Product Context and Design Principles`                 | Update |
| `.github/instructions/architecture.instructions.md`  | `State File` / `Core layer`                             | Update |
| `docs/usage.md`                                      | `Differential extraction / state workflow sections`     | Update |
| `docs/design/git-traversal.md`                       | `Range and boundary semantics`                          | Update |

#### Implementation Notes

- Keep user-facing wording consistent around "release boundary" to avoid reintroducing the old workaround framing as the primary model.
- Treat `--ref` as the user-facing anchor term throughout CLI/docs; preserve `branches` only for state and branch-checkpoint terminology.
- Add behavioral tests first for ref-resolution and zero-result success paths, then implement the minimal code changes needed to satisfy those tests.
- Do not change successful-run stderr layout in this phase; only contract wording/conditions should shift.

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```bash
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- Run snapshot release-boundary extraction using a release tag as traversal start and confirm only history included in that release ref is emitted.
- Run snapshot bootstrap with `--ref <active-branch> --since-ref <release-ref> --state <path>`, then run incremental with the same state path and confirm only post-bootstrap new commits are emitted.
- Run boundary-equals-head and boundary-contains-head scenarios and confirm successful zero-record completion (not user error).
- Verify branch-name, lightweight-tag, annotated-tag, and raw-commit-object-ID inputs resolve according to the defined contract for both `--ref` and `--since-ref`.
- Verify no new CLI range option exists in this phase and help text documents the workflow using existing parameters.
