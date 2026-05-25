### Phase 3: Internal DiffAdapter Abstraction in IsomorphicGitAdapter

_Refactor line-diff computation behind an internal `DiffAdapter` strategy in `IsomorphicGitAdapter` without changing the external `GitAdapter` interface contract used by core._

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `.github/roadmap.md` — "Architecture: Diff algorithm abstraction within IsomorphicGitAdapter"
- `.github/plans/phase-1.md` — plugin architecture boundary decisions (no leakage into `GitAdapter` contract)
- `.github/plans/phase-2.md` — compatibility/runtime checks are CLI-owned and independent from git adapter internals
- `.github/instructions/architecture.instructions.md` — adapter/layer ownership constraints
- `.github/instructions/git-traversal.instructions.md` — traversal and fact extraction invariants
- `.github/instructions/phase-template.instructions.md` — implementation-ready phase completeness requirements

#### Design Decisions

##### Internal DiffAdapter contract and binary semantics

- **Visibility/ownership**: `DiffAdapter` is an internal strategy owned by `IsomorphicGitAdapter`. It is not exported from `src/git/index.ts`, and not referenced by core-layer contracts.
- **Contract shape**: define an internal interface that computes text line deltas from byte inputs.

  ```ts
  interface DiffAdapter {
    computeLineDiff(
      before: Uint8Array,
      after: Uint8Array,
    ): {
      additions: number;
      deletions: number;
    };
  }
  ```

- **Binary handling semantics (fixed behavior)**:
  - Binary detection remains owned by `IsomorphicGitAdapter` using the existing NUL-byte heuristic (`_isBinary`, first 8000 bytes).
  - If either side is binary, `DiffAdapter` is not called.
  - Binary outputs remain `additions: null` and `deletions: null` exactly as today.
- **Text decoding semantics**:
  - Default adapter behavior remains UTF-8 based, line-oriented diff counting equivalent to current `diffLines` behavior.
  - Added/deleted-file semantics remain unchanged because callers pass empty content on the absent side.

##### Constructor injection and default/fallback policy

- **Injection seam**: `IsomorphicGitAdapter` constructor accepts an optional internal `DiffAdapter` dependency alongside `FsClient`.
- **Default implementation**: when no adapter is injected, instantiate and use a `JsDiffAdapter` backed by the existing `diff` package (`diffLines`).
- **Fallback behavior**:
  - No silent algorithm fallback is performed after construction. If the injected adapter throws during diff computation, extraction fails via existing error propagation (`GitAdapterError`) rather than swapping algorithms at runtime.
  - This preserves determinism and debuggability.

##### Boundary guarantees

- **Core isolation guarantee**:
  - Core modules (`src/core/**`) must not import, reference, or branch on any `DiffAdapter` detail.
  - Core continues to consume only `GitAdapter.getFileChanges(...)` output.
- **Phase isolation guarantee**: no Phase 1 plugin contract changes and no Phase 2 compatibility-policy behavior changes are introduced by this phase.

##### Algorithm interchangeability constraints

- **Extension path**: adding an alternative line-diff algorithm in the future requires only:
  - implementing internal `DiffAdapter`
  - passing it into `IsomorphicGitAdapter` construction
  - adding adapter-specific tests
    No core contract changes are permitted.
- **Deterministic output requirements for any adapter implementation**:
  - For identical byte inputs, `computeLineDiff` must return identical `additions/deletions` values.
  - `additions` and `deletions` must be finite non-negative integers.
  - `FileChange.status` mapping (`added` / `modified` / `deleted`) remains tree-diff-owned and must not be changed by adapter choice.
  - Binary-file outputs must stay `null/null` regardless of adapter implementation, because binary gating is outside `DiffAdapter`.

##### Test strategy (implementation-ready)

- **Regression coverage**:
  - Preserve existing `IsomorphicGitAdapter.getFileChanges` behavior under default adapter for modified/added/deleted text files and binary files.
  - Ensure no observable change in extraction-facing `FileChange` shape or semantics.
- **Substitution seam coverage**:
  - Add focused unit tests that inject a deterministic test adapter and assert its counts are reflected in `getFileChanges` outputs for text files.
  - Add a binary test asserting injected adapter is not invoked when either blob is binary.
- **Boundary coverage**:
  - Keep core tests green with no required core test rewrites, validating that core remains unaware of the internal abstraction.

#### Non-Goals

- Do not change `GitAdapter` public interface used by core.
- Do not introduce additional Git backend implementations in this phase.
- Do not change traversal order, exclusion semantics, or merge-base behavior.
- Do not change binary detection heuristic in this phase.
- Do not add CLI flags for selecting diff algorithms.
- Do not add runtime compatibility checks for diff adapters.
- Do not optimize performance beyond introducing the abstraction seam itself.

#### Target Files

| File                                                       | Action      | Notes                                                                                                                                                  |
| ---------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/gitlode/src/git/isomorphic-git-adapter.ts`       | Modify      | Add internal `DiffAdapter` interface usage, constructor injection seam, and default adapter wiring while preserving existing `getFileChanges` behavior |
| `packages/gitlode/src/git/diff-adapter.ts`                 | Create      | Internal-only `DiffAdapter` and `JsDiffAdapter` implementation (not exported through `src/git/index.ts`)                                               |
| `packages/gitlode/test/git/isomorphic-git-adapter.test.ts` | Modify      | Add regression tests plus injected-adapter seam tests, including binary bypass assertions                                                              |
| `packages/gitlode/test/core/file-change-expander.test.ts`  | Verify-only | No expected code changes; keep as regression signal that core remains contract-stable                                                                  |

#### Documentation Touchpoints

| File                                                | Section                                                   | Action |
| --------------------------------------------------- | --------------------------------------------------------- | ------ |
| `packages/gitlode/docs/design/architecture.md`      | Git adapter internals / file-change computation notes     | Update |
| `packages/gitlode/docs/design/schema.md`            | `file.additions` / `file.deletions` semantics             | Update |
| `.github/instructions/architecture.instructions.md` | Git adapter boundary notes and internal strategy guidance | Update |

#### Implementation Notes

- Keep the new abstraction internal to the git adapter implementation layer. Avoid adding any new export from `src/git/index.ts` unless a hard technical constraint emerges.
- Preserve existing profiler topology under `file-changes` and `diff`; abstraction should be behavior-preserving for profiling labels unless an explicit migration is planned.
- Preferred implementation order:
  1.  Extract/create internal diff adapter module and default implementation.
  2.  Wire constructor injection in `IsomorphicGitAdapter`.
  3.  Add substitution seam tests.
  4.  Run regression verification and documentation updates.
- If an injected adapter returns invalid values (negative, non-integer, non-finite), treat as adapter contract violation and fail fast (do not coerce silently).

#### Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- For representative repositories, output records produced by default adapter remain backward compatible before vs after refactor (no schema or field-behavior drift).
- Binary files still emit `additions: null` and `deletions: null`.
- Injected test adapter changes text diff counts only for text-file cases and does not affect status classification.
- Core pipeline behavior (commit-only and per-file flows) remains unchanged because `GitAdapter` contract is unchanged.
