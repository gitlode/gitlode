### Phase 2: Commit OID Compatibility Contract

_Define and verify an OID compatibility contract that targets hash-algorithm-agnostic behavior (SHA-1 and SHA-256) for gitrail, then finalize the supported object-format scope based on verified isomorphic-git behavior in the exact operations gitrail uses._

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `.github/roadmap.md` — "Compatibility: Hash-algorithm-agnostic commit OID support"
- `.github/instructions/git-traversal.instructions.md` — traversal/state invariants and exclusion semantics
- `.github/instructions/architecture.instructions.md` — layer ownership and pipeline correctness guarantees
- `.github/instructions/schema.instructions.md` — output field contract (`oid`)
- `.github/instructions/cli.instructions.md` — CLI validation and diagnostic contract

#### Design Decisions

- **Contract term across code and docs**:
  - Canonical term is `commit object ID (OID)` at first mention in user-facing docs/specs.
  - Short form `commit OID` is used after first mention.
  - Internal identifiers/types should prefer `Oid`/`CommitOid` naming over `Hash`/`CommitHash` where API churn is manageable within this phase.
  - The term `hash` remains only where explicitly describing dependency constraints (for example, "SHA-1 hash algorithm").

- **Validation and branding policy**:
  - Replace SHA-1-length-branded validation as a global default with object-format-aware OID validation.
  - The existing 40-hex checks must not remain the global "Git commit ID" truth.
  - Introduce format-specific validators where needed:
    - `sha1` profile: 40-hex commit OID
    - `sha256` profile: 64-hex commit OID
  - Keep validation decoupled from fixed-length assumptions in traversal/state logic so additional formats can be introduced without semantic rewrites.
  - Current SHA-1-specific lock points to refactor in this phase:
    - `src/core/types.ts` `CommitHash` brand and `isCommitHash()` regex `{40}`
    - `src/index.ts` state-file `lastCommitHash` validation message/logic
    - tests and helpers generating hardcoded 40-length branded values (`test/core/types.test.ts`, `test/core/commit-traversal-extractor.test.ts`, `test/core/extraction-coordinator.test.ts`)
  - State-file schema field name `lastCommitHash` is kept for backward compatibility in v0.x; semantics are documented as "last extracted commit OID".

- **Verified dependency boundary (isomorphic-git)**:
  - Phase 2 must verify real behavior for non-SHA-1 repositories in gitrail-used operations: `resolveRef`, `readCommit`-based traversal, `findMergeBase`, and tree/file-change paths.
  - Compatibility support policy is evidence-driven and conditional:
    - If verification shows stable SHA-256 support in these operations, gitrail Phase 2 support scope includes both `sha1` and `sha256`.
    - If verification shows SHA-256 is unsupported or operationally broken in these operations, gitrail explicitly limits support to `sha1` and documents this as a dependency-bound constraint.
  - Do not claim hash-algorithm support without verification evidence captured in tests and documentation.
  - Verification must not require modifying the local Git installation.
  - If the local Git binary cannot create or operate on SHA-256 repositories, perform the verification in a separate sandbox/container environment that provides a SHA-256-capable Git.
  - Treat that environment-preparation step as part of the phase execution plan, not as a codebase change.

- **Fallback policy and user-facing diagnostics**:
  - Add explicit repository object-format detection before extraction planning (default `sha1` when unset, per Git behavior).
  - Unsupported-format behavior is determined by the verified support matrix:
    - Supported format: proceed normally.
    - Unsupported format: fail fast with user error (exit code `1`) before traversal/output writes.
  - Required diagnostic contract for unsupported formats:
    - `Unsupported repository object format: <format>. Supported formats: <supported-list>.`
  - No silent fallback to "best effort" traversal is allowed for unsupported formats.

- **Ownership and boundary split**:
  - Git adapter owns repository object-format detection and normalization.
  - Core/runtime edge owns compatibility gating decision and orchestration stop behavior.
  - CLI owns user-facing wording and help/docs consistency, but does not own repository format probing.

- **State-file and range semantics under non-40-char assumptions**:
  - Traversal correctness remains reachability-based and length-agnostic by semantics (`excludeHash`/boundary set membership), not string-length-based.
  - State read/write correctness invariants stay unchanged: state commit only after successful output close.
  - Compatibility check for object format must run before using prior state OIDs as traversal boundaries.
  - If repository format is unsupported, state content is not consumed for traversal; run fails with explicit unsupported-format diagnostic.

- **Phase 2 support-matrix decision rule (must be followed verbatim)**:
  - Step 1: verify isomorphic-git behavior for `sha256` repositories in all gitrail-used operations listed above.
  - Step 2: classify result as `supported` or `unsupported` using the verification criteria in this phase.
  - Step 3A (`supported`): implement/retain dual-format support (`sha1`, `sha256`) and update docs to remove SHA-1-only wording.
  - Step 3B (`unsupported`): keep runtime support limited to `sha1`, implement explicit guardrails/diagnostics for unsupported formats, and document the limitation as dependency-bound.

- **New runtime dependencies**: None.

#### Non-Goals

- Add support for algorithms beyond `sha1`/`sha256` in this phase.
- Change output JSON field name `oid` or state-file wire field name `lastCommitHash`.
- Introduce schema expansion unrelated to compatibility (metadata enrichment, extra analytics fields).
- Revisit release-boundary UX decisions from Phase 1.

#### Target Files

| File                                           | Action | Notes                                                                                                              |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `.github/plans/phase-2.md`                     | Create | Canonical design contract for Phase 2 implementation.                                                              |
| `src/core/types.ts`                            | Modify | Rename/reshape branded OID typing and validators away from unconditional SHA-1 naming.                             |
| `src/git/types.ts`                             | Modify | Align adapter signatures/comments to commit OID terminology and object-format compatibility boundary.              |
| `src/git/errors.ts`                            | Modify | Add explicit unsupported-object-format error code and diagnostics aligned to the verified support matrix.          |
| `src/git/isomorphic-git-adapter.ts`            | Modify | Add repository object-format probing and error mapping support.                                                    |
| `src/core/branch-traversal-planner.ts`         | Modify | Consume compatibility-gated OID semantics without SHA-1 naming assumptions.                                        |
| `src/index.ts`                                 | Modify | Apply fail-fast compatibility gate and revise state validation wording from hash-specific to OID-specific.         |
| `src/cli/args.ts`                              | Modify | Update user-facing validation/help messages to commit OID terminology where applicable.                            |
| `test/core/types.test.ts`                      | Modify | Replace SHA-1-global validator assumptions with profile-aware OID validation tests.                                |
| `test/core/commit-traversal-extractor.test.ts` | Modify | Remove length-branded helper assumptions from test data generation.                                                |
| `test/core/extraction-coordinator.test.ts`     | Modify | Remove 40-char branded fixture assumptions where not semantically required.                                        |
| `test/git/isomorphic-git-adapter.test.ts`      | Modify | Add object-format detection and capability-verification tests for sha1/sha256 operation paths.                     |
| `test/cli/args.test.ts`                        | Modify | Cover user-facing unsupported-format and OID terminology diagnostics (where parse/runtime boundary applies).       |
| `test/index.test.ts`                           | Modify | Validate top-level exit code and diagnostic contract for unsupported object format and supported-format pass path. |

#### Documentation Touchpoints

| File                                                 | Section                                                           | Action |
| ---------------------------------------------------- | ----------------------------------------------------------------- | ------ |
| `.github/instructions/architecture.instructions.md`  | `Git Adapter Interface`                                           | Update |
| `.github/instructions/architecture.instructions.md`  | `State File`                                                      | Update |
| `.github/instructions/git-traversal.instructions.md` | `Traversal Algorithm`                                             | Update |
| `.github/instructions/git-traversal.instructions.md` | `State File Management`                                           | Update |
| `.github/instructions/cli.instructions.md`           | `Range Filter (snapshot mode only)`                               | Update |
| `.github/instructions/cli.instructions.md`           | `Validation Rules`                                                | Update |
| `.github/instructions/schema.instructions.md`        | `Field Definitions` -> `oid`                                      | Update |
| `README.md`                                          | Output field table (`oid`, `parents`)                             | Update |
| `docs/usage.md`                                      | `Extract commits since a release tag` and `State File Management` | Update |
| `docs/design/schema.md`                              | `Field definitions` -> `oid`                                      | Update |
| `docs/design/git-traversal.md`                       | `Differential by commit hash or ref` and related terminology      | Update |
| `docs/design/architecture.md`                        | `Git adapter layer` responsibilities text                         | Update |

#### Implementation Notes

- Treat this phase as a contract-hardening step: terminology and diagnostics are first-class deliverables, not cosmetic cleanup.
- Execute dependency-behavior verification first, then apply the support-matrix decision rule in this file.
- Introduce object-format compatibility checks before traversal begins to preserve state/output invariants and avoid partial-output failures.
- Keep migration risk low by preserving wire-format field names (`oid`, `lastCommitHash`) while updating their normative wording.
- Record dependency-verification evidence in code comments/tests/docs only where needed to justify the compatibility boundary; avoid scattering version-specific implementation trivia.

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```bash
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- Run extraction against a standard SHA-1 repository and confirm successful behavior is unchanged except terminology updates in diagnostics/help/docs.
- Run extraction against a SHA-256 repository and verify all gitrail-used operations (`resolveRef`, traversal/readCommit, merge-base, file-change path) behave correctly.
- If SHA-256 verification fails, confirm fail-fast user error with the exact unsupported-format diagnostic and exit code `1`.
- Validate state file handling remains correct under supported format: prior-state differential extraction still honors traversal exclusion semantics and state write timing.
- Confirm no user-facing docs/spec sections continue to claim `oid` is inherently "40-character SHA-1" as product truth.

**Pass/fail criteria for compatibility claim closure:**

- `Pass`: gitrail contract language is OID-based across code/docs, SHA-256 verification outcome is reflected in runtime support/docs exactly per decision rule, unsupported formats fail with clear diagnostics, and all automated checks pass.
- `Fail`: compatibility support scope is declared without verification evidence, any silent SHA-1-only assumption remains undocumented, unsupported formats fail implicitly/non-deterministically, or tests/docs still encode unconditional 40-character claims as product truth.
