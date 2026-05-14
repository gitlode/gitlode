### Phase 1: Discriminated Fact Union and Unified Projector

_Introduce a `type` discriminant on `CommitFact` and `FileChangeFact`, define a `Fact = CommitFact | FileChangeFact` union, and replace the separate `CommitRecordProjector` / `FileChangeRecordProjector` interfaces and their default implementations with a single `FactProjector` interface and `DefaultFactProjector` class that dispatches internally by `fact.type`._

#### Status

- [ ] Planned
- [ ] In progress
- [x] Completed

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `.github/instructions/architecture.instructions.md` — "Canonical vocabulary", "Ownership and boundary rules"
- Roadmap item: "Pipeline: Discriminated Fact union and unified projector contract"

---

#### Design Decisions

**Discriminated union shape**

Add `readonly type: "commit"` to the existing `CommitFact` interface and `readonly type: "file-change"` to the existing `FileChangeFact` interface. Define the union at the bottom of the type declarations in `src/core/types.ts`:

```typescript
export type Fact = CommitFact | FileChangeFact;
```

Rationale for tag field name `type`: consistent with every other discriminated union in the codebase (`ExtractionRange`, `ProgressEvent`). Tag values `"commit"` and `"file-change"` match the established Core vocabulary and are distinct from all existing string literals in the project.

`FileChangeFact.commit` is typed as `CommitFact`, so once `CommitFact` carries `type: "commit"`, every embedded commit in a `FileChangeFact` automatically satisfies the narrowed type — no separate tagging step is needed for the nested field.

**Unified projector interface**

Define a single `FactProjector` interface in a new `src/core/fact-projector.ts` file:

```typescript
export interface FactProjector {
  project(facts: AsyncIterable<Fact>): AsyncIterable<OutputRecord>;
}
```

`DefaultFactProjector` in the same file implements this interface. Its constructor accepts `(repoName: string, remoteUrl: string | null, profiler?: StageProfiler)` — identical to the current two projectors so the call site in `src/index.ts` is a straightforward substitution.

The interface is also re-exported from `src/core/index.ts` via a named export alongside `DefaultFactProjector`.

**Migration strategy for existing projector slots**

`CoordinatorDependencies` in `src/core/types.ts` currently has two inline structural projector slots (`commitProjector`, `fileProjector`). Both are removed and replaced with a single inline structural slot:

```typescript
readonly projector: {
  project(facts: AsyncIterable<Fact>): AsyncIterable<OutputRecord>;
};
```

The `fileChangeExpander` dependency slot is retained unchanged — file-change expansion remains a distinct pipeline stage.

`DefaultCommitRecordProjector` and `DefaultFileChangeRecordProjector` (both class and interface) are deleted. Their projection logic is absorbed into `DefaultFactProjector`. `src/core/commit-record-projector.ts` and `src/core/file-change-record-projector.ts` are deleted.

`src/index.ts` replaces the two `new Default*Projector(...)` calls with one `new DefaultFactProjector(repoName, remoteUrl, projectionProfiler)`.

**Type-narrowing contract**

`DefaultFactProjector.project()` uses an exhaustive `switch` on `fact.type` with `assertNever` in the `default` branch:

```typescript
async *project(facts: AsyncIterable<Fact>): AsyncIterable<OutputRecord> {
  for await (const fact of facts) {
    switch (fact.type) {
      case "commit": {
        yield this.projectCommit(fact);
        break;
      }
      case "file-change": {
        yield this.projectFileChange(fact);
        break;
      }
      default:
        assertNever(fact);
    }
  }
}
```

Private methods `projectCommit(fact: CommitFact)` and `projectFileChange(fact: FileChangeFact)` contain the logic currently in `DefaultCommitRecordProjector` and `DefaultFileChangeRecordProjector` respectively. The `withProfiler` wrapping pattern is preserved around each projection call, as it is today.

**Coordinator write loop**

`DefaultExtractionCoordinator.run()` granularity branch changes from dual-projector dispatch to single-projector with stream selection:

```typescript
const factStream: AsyncIterable<Fact> = request.granularity === "file"
  ? fileChangeExpander.expand(countedStream, request.repositoryPath)
  : countedStream;

for await (const record of projector.project(factStream)) {
  await withProfilerAsync(profiler, () => sink.write(record));
  recordsWritten++;
  reporter.emit({ ... });
}
```

`countedStream` is `AsyncIterable<CommitFact>`, which satisfies `AsyncIterable<Fact>` after the `type` field is added. `fileChangeExpander.expand()` returns `AsyncIterable<FileChangeFact>`, which also satisfies `AsyncIterable<Fact>`. No new wrapper generator is needed.

The `commitsTraversed` counter, deduplication, and progress event fields are unchanged.

**Return type contract**

`FactProjector.project()` returns `AsyncIterable<OutputRecord>` (same union type already used for the `OutputSink.write()` parameter). The coordinator's write loop, record counting, and progress reporting are structurally identical to today — the change is purely which projector object is called and how the input stream is formed.

**Creation-point updates for the `type` field**

- `src/core/commit-traversal-extractor.ts`: add `type: "commit"` to the object literal in `toCommitFact()`.
- `src/core/file-change-expander.ts`: add `type: "file-change"` to the object literal yielded in `DefaultFileChangeExpander.expand()`.

These are the only two creation points for `CommitFact` and `FileChangeFact` objects in the production codebase.

**Test fixture updates**

Every `makeCommitFact()` / `makeFileChangeFact()` helper in test files must include `type: "commit"` / `type: "file-change"` in the returned literal. Files affected: `test/core/commit-traversal-extractor.test.ts`, `test/core/extraction-coordinator.test.ts`, and any other test helper that constructs these types. Because TypeScript strict mode is enabled, the compiler will surface all creation-point omissions at build time; no manual audit of every fixture is required.

**Test file consolidation**

`test/core/commit-record-projector.test.ts` and `test/core/file-change-record-projector.test.ts` are deleted. A new `test/core/fact-projector.test.ts` consolidates all projector tests for `DefaultFactProjector`. The test suite must cover:

- commit-mode projection: all `OutputCommit` fields mapped correctly from `CommitFact`
- file-mode projection: all `OutputFileRecord` fields mapped correctly from `FileChangeFact`
- message splitting (subject/body), null body, multi-parent, null remoteUrl — preserved from existing test cases
- exhaustive dispatch: passing a stream of mixed `CommitFact` and `FileChangeFact` items (in separate `project()` calls since the coordinator never mixes them) produces the correct output type per item

The `test/core/extraction-coordinator.test.ts` stub definitions for `commitProjector` and `fileProjector` are replaced with a single `projector` stub conforming to the new `CoordinatorDependencies` shape.

**Backward-compatibility scope (confirmed)**

- No change to CLI flags, argument semantics, or exit behavior.
- No change to output JSON schema or `.jsonl` file format.
- No change to state file format or checkpoint field names.
- No test fixture JSON files on disk are affected; only TypeScript source-level test helpers change.

**New runtime dependencies**: none.

---

#### Non-Goals

- Do not change `FileChangeExpander`'s interface or split/merge the expansion stage.
- Do not rename `CommitFact`, `FileChangeFact`, or any other existing type beyond adding the `type` field — identifier renames are scoped to Phase 2.
- Do not add any new CLI option or change any output field.
- Do not unify `CommitFact` and `FileChangeFact` into a single flat type; the two separate interfaces are retained as the two variants of the `Fact` union.
- Do not change how `granularity` is expressed in `CoordinatorRequest`; the `"commit" | "file"` value is unchanged.

---

#### Target Files

| File                                             | Action | Notes                                                                                                                                                                                                                                                                   |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/types.ts`                              | Modify | Add `readonly type: "commit"` to `CommitFact`; add `readonly type: "file-change"` to `FileChangeFact`; add `export type Fact = CommitFact \| FileChangeFact`; replace `commitProjector`/`fileProjector` slots in `CoordinatorDependencies` with single `projector` slot |
| `src/core/fact-projector.ts`                     | Create | `FactProjector` interface; `DefaultFactProjector` class with exhaustive `switch` dispatch                                                                                                                                                                               |
| `src/core/commit-record-projector.ts`            | Delete | Superseded by `DefaultFactProjector`                                                                                                                                                                                                                                    |
| `src/core/file-change-record-projector.ts`       | Delete | Superseded by `DefaultFactProjector`                                                                                                                                                                                                                                    |
| `src/core/extraction-coordinator.ts`             | Modify | Replace dual-projector dispatch with single `projector.project(factStream)` call; remove unused `CommitFact`/`FileChangeFact` imports if any become unreferenced                                                                                                        |
| `src/core/commit-traversal-extractor.ts`         | Modify | Add `type: "commit"` field to `toCommitFact()` return literal                                                                                                                                                                                                           |
| `src/core/file-change-expander.ts`               | Modify | Add `type: "file-change"` field to the object literal yielded by `DefaultFileChangeExpander.expand()`                                                                                                                                                                   |
| `src/core/index.ts`                              | Modify | Export `Fact`, `FactProjector`, `DefaultFactProjector`; remove exports for `CommitRecordProjector`, `DefaultCommitRecordProjector`, `FileChangeRecordProjector`, `DefaultFileChangeRecordProjector`                                                                     |
| `src/index.ts`                                   | Modify | Replace `new DefaultCommitRecordProjector(...)` and `new DefaultFileChangeRecordProjector(...)` with `new DefaultFactProjector(...)`; update imports                                                                                                                    |
| `test/core/fact-projector.test.ts`               | Create | Consolidated projector tests covering commit mode, file-change mode, message splitting, multi-parent, null remoteUrl                                                                                                                                                    |
| `test/core/commit-record-projector.test.ts`      | Delete | Superseded by `test/core/fact-projector.test.ts`                                                                                                                                                                                                                        |
| `test/core/file-change-record-projector.test.ts` | Delete | Superseded by `test/core/fact-projector.test.ts`                                                                                                                                                                                                                        |
| `test/core/extraction-coordinator.test.ts`       | Modify | Replace `commitProjector`/`fileProjector` stubs with single `projector` stub; update `makeCommitFact` fixture to include `type: "commit"`                                                                                                                               |
| `test/core/commit-traversal-extractor.test.ts`   | Modify | Add `type: "commit"` to `makeCommitFact()` fixture; verify extractor output includes `type` field                                                                                                                                                                       |
| `test/core/file-change-expander.test.ts`         | Modify | Add `type: "file-change"` to expected `FileChangeFact` assertions; add `type: "commit"` to any `CommitFact` fixtures                                                                                                                                                    |

---

#### Documentation Touchpoints

| File                                                | Section                        | Action                                                                                                                          |
| --------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `.github/instructions/architecture.instructions.md` | "Canonical vocabulary"         | Replace `CommitRecordProjector` and `FileChangeRecordProjector` with `FactProjector`; add `Fact` as a canonical vocabulary term |
| `.github/instructions/architecture.instructions.md` | "Ownership and boundary rules" | Update the sentence describing `DefaultExtractionCoordinator` construction to reference `DefaultFactProjector`                  |

---

#### Implementation Notes

- The `Fact` type alias should be placed in `src/core/types.ts` immediately after the `FileChangeFact` interface declaration so that both constituent types are fully defined before the alias.
- `FactProjector` interface in `src/core/fact-projector.ts` imports `Fact` from `./types.js` and `OutputRecord` from `../output/types.js`. This mirrors the existing import pattern in `commit-record-projector.ts` and `file-change-record-projector.ts` and does not introduce any new circular-import risk.
- `CoordinatorDependencies` must keep its `projector` slot as an inline structural type (not importing `FactProjector` by name from `fact-projector.ts`) to preserve the existing circular-import avoidance pattern documented in the `types.ts` comment. The inline type is structurally identical to `FactProjector`.
- When deleting `commit-record-projector.ts` and `file-change-record-projector.ts`, verify no remaining source file outside `core/index.ts` imports from them directly. The grep target is `commit-record-projector` and `file-change-record-projector` across `src/` and `test/`.

---

#### Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks:**

- Run `node dist/index.js --repo . --branch main --output-dir /tmp/out` (commit-mode) and confirm `.jsonl` output is structurally unchanged from the current release.
- Run `node dist/index.js --repo . --branch main --output-dir /tmp/out --per-file` (file-mode) and confirm `.jsonl` output is structurally unchanged.
- Confirm `CommitRecordProjector`, `DefaultCommitRecordProjector`, `FileChangeRecordProjector`, `DefaultFileChangeRecordProjector` are no longer exported from `src/core/index.ts` after the phase (grep test).
- Confirm `Fact`, `FactProjector`, `DefaultFactProjector` are exported from `src/core/index.ts` after the phase (grep test).
