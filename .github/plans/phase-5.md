### Phase 5: CLI Parameter Model Redesign

_Replace `--mode snapshot|incremental` with boolean `--incremental`, `--output-mode commit|file`
with boolean `--per-file`, and `--on-missing-state error|snapshot` with
`--missing-state=error|snapshot`. Align `ExtractorConfig` field names with the new CLI model,
update `Extractor`'s translation logic to `CoordinatorRequest`, and preserve all current
extraction semantics while making the intentional pre-v1 breaking changes explicit in migration
documentation._

#### Status

- [x] Planned
- [x] In progress
- [x] Completed

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- [`../instructions/cli.instructions.md`](../instructions/cli.instructions.md) — updated during
  this planning session; the new Parameter Reference, Mutual Exclusion Rules, Validation Rules,
  and Usage Examples sections are now the authoritative Phase 5 implementation target
- [`../instructions/architecture.instructions.md`](../instructions/architecture.instructions.md)
  — Phase 4 coordinator/sink contracts; `ExtractorConfig` type definition (update required during
  Phase 5 implementation)
- [`phase-4.md`](phase-4.md) — `CoordinatorRequest` field names (`granularity`,
  `priorCheckpoint`) established as stable Core terminology; `Extractor` designated as the
  compatibility/translation layer
- Roadmap item: "CLI UX: Parameter model redesign for extraction and output grain"

---

#### Design Decisions

**New CLI parameter names (exact, authoritative)**

The three breaking changes introduced in this phase:

| Old parameter                        | New parameter             | Type                       | Notes                                                                                               |
| ------------------------------------ | ------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| `--mode snapshot\|incremental`       | `--incremental`           | boolean                    | Absent = snapshot (default); present = incremental                                                  |
| `--output-mode commit\|file`         | `--per-file`              | boolean                    | Absent = commit-granularity (default); present = file-granularity                                   |
| `--on-missing-state error\|snapshot` | `--missing-state <value>` | string (`error\|snapshot`) | Only valid with `--incremental`; default `error` when `--incremental` is present and flag is absent |

All other flags and aliases are unchanged. The `-m` alias (previously for `--mode`) is removed.
`-s` alias for `--state` is kept.

No new short-form aliases are introduced for `--incremental`, `--per-file`, or `--missing-state`.

**`ExtractorConfig` reshape (not rename)**

`ExtractorConfig` in `src/core/types.ts` keeps its name. Three fields are renamed:

```typescript
interface ExtractorConfig {
  // unchanged fields:
  readonly repositoryPath: string;
  readonly branches: readonly string[];
  readonly outputDir: string;
  readonly outputPrefix: string;
  readonly rotation: RotationConfig;
  readonly range?: ExtractionRange;
  readonly stateFilePath?: string;

  // renamed fields:
  readonly incremental: boolean; // was: mode: "snapshot" | "incremental"
  readonly missingState?: "error" | "snapshot"; // was: onMissingState?: "error" | "snapshot"
  readonly perFile: boolean; // was: outputMode: "commit" | "file"
}
```

`ExtractorConfig` is not renamed in Phase 5. Broad naming cleanup (including whether to rename
this type) is deferred to Phase 7.

`missingState` is `undefined` when `incremental` is `false`. `parseArgs` sets it to the resolved
value only when `incremental` is `true`.

**`ParsedArgs` alignment**

`ParsedArgs` in `src/cli/args.ts` extends `ExtractorConfig` (plus `quiet: boolean`). After Phase 5,
`ParsedArgs` automatically reflects the new `ExtractorConfig` fields. No separate `ParsedArgs`
reshape is required.

**`Extractor` translation from `ExtractorConfig` to `CoordinatorRequest`**

`Extractor.run()` translates the renamed `ExtractorConfig` fields to `CoordinatorRequest` fields.
The `CoordinatorRequest` type and its fields (`granularity`, `priorCheckpoint`, etc.) are unchanged
by Phase 5 — the coordinator boundary remains stable.

Affected translations inside `Extractor`:

| `ExtractorConfig` field (Phase 5) | `CoordinatorRequest` field | Translation                                                                                        |
| --------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `config.perFile`                  | `granularity`              | `config.perFile ? "file" : "commit"`                                                               |
| `config.incremental`              | (internal load path)       | drives whether `loadPriorCheckpoint()` reads from `CheckpointStore` or returns an empty checkpoint |
| `config.missingState`             | (internal load path)       | passed to `loadPriorCheckpoint()` for missing-state fallback handling                              |

The coordinator itself (`DefaultExtractionCoordinator`) and `CoordinatorRequest` receive no changes
in Phase 5. The only change in `Extractor` is reading `config.incremental` / `config.missingState`
/ `config.perFile` instead of `config.mode` / `config.onMissingState` / `config.outputMode`.

**`src/index.ts` is unchanged**

`src/index.ts` constructs `Extractor(parsed, ...)` where `parsed: ParsedArgs extends ExtractorConfig`.
It accesses only `parsed.quiet` and `parsed.stateFilePath` directly. Neither field name changes.
The pass-through from `ParsedArgs` to `Extractor`'s `ExtractorConfig` constructor parameter
remains valid after the field renames. No changes to `src/index.ts` are needed.

**New mutual-exclusion and validation rules**

_These replace the current rules built around `--mode`, `--output-mode`, and `--on-missing-state`._

Phase 1 (format / mutual exclusion — no I/O):

| Condition                                                     | Error message                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `--missing-state` value is not `error` or `snapshot`          | `--missing-state must be "error" or "snapshot"`                                       |
| `--since-ref` + `--since-date` together                       | `--since-ref and --since-date cannot be used together`                                |
| `--incremental` + `--since-ref`                               | `--since-ref cannot be used with --incremental`                                       |
| `--incremental` + `--since-date`                              | `--since-date cannot be used with --incremental`                                      |
| `--missing-state` provided without `--incremental`            | `--missing-state is only valid with --incremental`                                    |
| `--incremental` + no `--state`                                | `--state is required when using --incremental`                                        |
| `--rotate-lines` or `--rotate-size` is not a positive integer | `<param> must be a positive integer`                                                  |
| `--since-date` is not valid ISO 8601                          | `Invalid date format for --since-date. Expected ISO 8601 (e.g. 2024-01-01T00:00:00Z)` |
| No `--branch` specified                                       | `At least one --branch must be specified`                                             |

Phase 2 (file system — same as current, adjusted for `--incremental`):

| Condition                                                                             | Phase | Error                                              |
| ------------------------------------------------------------------------------------- | ----- | -------------------------------------------------- |
| `<repository-path>` does not exist                                                    | 2     | `Repository not found: <path>`                     |
| `--output-dir` does not exist                                                         | 2     | `Output directory not found: <path>`               |
| `--state` parent directory does not exist                                             | 2     | `Parent directory for state file not found: <dir>` |
| `--incremental` + `--state` file does not exist + `--missing-state error` (or absent) | 2     | `State file not found: <path>`                     |

Phase 3 (Git — unchanged):

| Condition                                   | Phase | Error                                                                |
| ------------------------------------------- | ----- | -------------------------------------------------------------------- |
| `<repository-path>` is not a Git repository | 3     | `Not a Git repository: <path>`                                       |
| `--since-ref` ref not found                 | 3     | `Ref not found: <ref>`                                               |
| State file `repositoryPath` mismatch        | 3     | `State file was created for a different repository: <recorded-path>` |

**`--missing-state` default behavior**

When `--incremental` is present and `--missing-state` is not specified, the effective behavior is
`error` (exit code 1 if the state file does not exist). This matches the current `--on-missing-state`
default. The citty argsDef for `--missing-state` has **no default value**; the `"error"` default is
applied in `parseArgs` logic only when `incremental` is `true` and `missingStateRaw` is `undefined`.
This approach allows the mutual-exclusion check (`--missing-state without --incremental`) to
distinguish "user explicitly provided" from "defaulted".

**`--state` in snapshot mode: unchanged semantics**

`--state` remains valid without `--incremental`. In snapshot mode, state content is ignored but the
file is written on success. This is identical to the current behavior. The `--state` flag's
description is updated to reference `--incremental` instead of `--mode incremental`, but the
behavior is unchanged.

**Snapshot concept preserved as documentation/runtime term**

`snapshot` continues to be used as the term for the default extraction mode in `--help` descriptions,
documentation, internal code comments, and as the value name in `--missing-state=snapshot`. It is
removed only as a CLI enum value (it was a value for `--mode`, which is removed). All existing
behavioral semantics of snapshot mode are preserved exactly.

**`--since-ref` and `--since-date` scope is unchanged**

Both flags remain valid in snapshot mode (no `--incremental` flag). Their behavior is identical to
the current behavior. The mutual exclusion rules that reference `--mode incremental` are reworded to
reference `--incremental`.

**Unknown old flags are silently ignored**

Because unknown-argument diagnostics is a deferred roadmap item, the citty parser silently ignores
`--mode`, `--output-mode`, and `--on-missing-state` if a user provides the old flags after upgrading.
The CHANGELOG migration section must make this explicit so users know their scripts will not error
but will also not behave as expected.

**`--missing-state` in citty argsDef**

`--missing-state` is defined as a `string` type option in argsDef (same as `--on-missing-state`
today). No citty default is set. The citty parsing will return `undefined` if the flag is absent,
allowing `parseArgs` to distinguish "not provided" from "provided as empty string."

**Migration messaging is a first-class Phase 5 deliverable**

A CHANGELOG migration draft section is written during Phase 5 implementation. The draft must
include:

- A `### Migration` subsection under the v0.4.0 Changed section
- A before/after table for each of the three renamed parameters
- An explicit note that the old flag names are silently ignored (not errored) due to how citty
  handles unknown arguments
- Brief rationale for each change (why the new name better expresses intent)

The final CHANGELOG.md format is completed during the release Documentation Update task. The Phase 5
implementation session is responsible for drafting the migration text and placing it in the correct
CHANGELOG location.

**Smallest Phase 5 change set**

Phase 5 is scoped to:

- CLI argument definitions and parsing in `src/cli/args.ts`
- `ExtractorConfig` field renames in `src/core/types.ts`
- `Extractor` internal field-name references in `src/core/extractor.ts`
- All test files that construct `ExtractorConfig` or exercise the CLI parameter model
- `cli.instructions.md` spec update (done during planning)
- `architecture.instructions.md` `ExtractorConfig` type definition update (done during implementation)
- `docs/usage.md` and `README.md` parameter reference updates (done during implementation)
- CHANGELOG migration draft (done during implementation)

The following are explicitly excluded: help-output grouping, unknown-argument diagnostics, rotate-size
suffixes, `--until-ref` / release-boundary workflow, progress reporting redesign, profiling,
traversal semantics, coordinator internals, output schema, `ExtractionResult` shape, and any sink
or projector changes.

---

#### Non-Goals

- Redesigning `--help` grouping/discoverability beyond updating the descriptions for the three renamed parameters.
- Adding unknown-argument diagnostics (warn on unrecognized flags); deferred roadmap item.
- Adding `--until-ref` or any release-boundary extraction workflow flag; explicitly excluded from v0.4.0.
- Adding `--rotate-size` human-readable suffixes; deferred roadmap item.
- Redesigning progress reporting or profiling interfaces; those belong to Phases 6 and 7.
- Reopening traversal semantics, checkpoint timing, `OutputSink` lifecycle, or output schema structure.
- Renaming `ExtractorConfig` itself or performing broad identifier cleanup beyond the three field renames.
- Modifying `ExtractionCoordinator`, `CoordinatorRequest`, or any stage beyond `Extractor`'s translation logic.
- Changing `ExtractionResult` shape or `src/index.ts` runtime wiring.
- Removing the `StateStore`/`StateFile` compatibility aliases introduced in Phase 1 (deferred to Phase 7 cleanup).
- Touching `src/git/**`, `src/output/**`, or any core stage file other than `extractor.ts` and `types.ts`.

---

#### Target Files

| File                              | Action      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/args.ts`                 | Modify      | Replace `--mode`/`--output-mode`/`--on-missing-state` argsDef entries with `--incremental`/`--per-file`/`--missing-state`; remove `-m` alias; update all parsing, validation, and mutual-exclusion logic; update `ParsedArgs` if it explicitly declares old fields (it extends `ExtractorConfig`, so only explicit additions need updating); update the `parseArgs` return to set `incremental`, `perFile`, `missingState`. |
| `src/core/types.ts`               | Modify      | Rename three fields in `ExtractorConfig`: `mode` → `incremental` (type `boolean`), `onMissingState` → `missingState` (type `"error" \| "snapshot" \| undefined`), `outputMode` → `perFile` (type `boolean`). No other type changes.                                                                                                                                                                                         |
| `src/core/extractor.ts`           | Modify      | Update field name references in `Extractor.run()` and `loadPriorCheckpoint()` (or its Phase 4 equivalent): `config.mode` → `config.incremental`, `config.onMissingState` → `config.missingState`, `config.outputMode` → `config.perFile`. No behavioral changes.                                                                                                                                                            |
| `src/core/index.ts`               | Verify only | No new exports; confirm that `ExtractorConfig` export is still present and the rename does not require re-export changes.                                                                                                                                                                                                                                                                                                   |
| `test/cli/args.test.ts`           | Modify      | Update all test cases to use `--incremental`, `--per-file`, `--missing-state`. Add test cases for new mutual-exclusion rules referencing the new flag names. Remove or replace test cases referencing `--mode`, `--output-mode`, `--on-missing-state`.                                                                                                                                                                      |
| `test/cli/cmd-definition.test.ts` | Modify      | Update expected arg definition names if the test asserts on specific argsDef keys.                                                                                                                                                                                                                                                                                                                                          |
| `test/core/extractor.test.ts`     | Modify      | Update all `ExtractorConfig` literal constructions: `mode: "incremental"` → `incremental: true`, `mode: "snapshot"` → `incremental: false`, `outputMode: "file"` → `perFile: true`, `outputMode: "commit"` → `perFile: false`, `onMissingState: "snapshot"` → `missingState: "snapshot"`.                                                                                                                                   |

**Explicitly untouched files in Phase 5:**

| File                                       | Reason                                                                                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                             | Pass-through from `ParsedArgs` to `Extractor` constructor does not reference renamed field names directly; `quiet` and `stateFilePath` are unchanged. |
| `src/core/extraction-coordinator.ts`       | `CoordinatorRequest` uses `granularity` (not `outputMode`/`perFile`); coordinator is not affected by the `ExtractorConfig` rename.                    |
| `src/core/commit-traversal-extractor.ts`   | Traversal stage contract is unchanged.                                                                                                                |
| `src/core/file-change-expander.ts`         | Expander stage contract is unchanged.                                                                                                                 |
| `src/core/commit-record-projector.ts`      | Projector stage contracts are unchanged.                                                                                                              |
| `src/core/file-change-record-projector.ts` | Projector stage contracts are unchanged.                                                                                                              |
| `src/output/**`                            | Output layer is unchanged.                                                                                                                            |
| `src/git/**`                               | Git adapter is unchanged.                                                                                                                             |
| `test/core/extraction-coordinator.test.ts` | Tests for the coordinator do not depend on `ExtractorConfig`.                                                                                         |

---

#### Documentation Touchpoints

| File                                                | Section                                                                                           | Action                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/instructions/cli.instructions.md`          | Entire Parameter Reference, Mutual Exclusion Rules, Validation Rules, and Usage Examples sections | **Replaced during planning session** (Phase 5 changes the CLI spec; the updated spec is the authoritative implementation contract for this phase) |
| `.github/instructions/architecture.instructions.md` | "Core Logic Layer" — `ExtractorConfig` type definition                                            | Update the type block to show renamed fields (`incremental`, `missingState`, `perFile`); update during Phase 5 implementation                     |
| `docs/usage.md`                                     | All sections referencing `--mode`, `--output-mode`, `--on-missing-state`                          | Replace with `--incremental`, `--per-file`, `--missing-state`; update during Phase 5 implementation                                               |
| `README.md`                                         | Any section that describes CLI parameter usage                                                    | Review and update if `--mode`, `--output-mode`, or `--on-missing-state` appear; update during Phase 5 implementation                              |
| `CHANGELOG.md`                                      | (new) v0.4.0 section, `### Migration` subsection                                                  | Draft during Phase 5 implementation; finalize during release Documentation Update task                                                            |

---

#### Implementation Notes

- In `parseArgs`, the `--missing-state` validation check for "provided without `--incremental`"
  must fire on any non-`undefined` user-provided value, not on the default. Since no citty default
  is set for `--missing-state`, `missingStateRaw` is `undefined` when the user does not provide
  the flag. The check is therefore:

  ```typescript
  if (missingStateRaw !== undefined && !incremental) {
    userError("--missing-state is only valid with --incremental");
  }
  ```

  Then apply the `"error"` default only after that check passes:

  ```typescript
  const missingState = incremental
    ? ((missingStateRaw ?? "error") as "error" | "snapshot")
    : undefined;
  ```

- In `parseArgs`, `incremental` is a boolean: `const incremental = Boolean(parsed["incremental"])`.
  `perFile` is likewise: `const perFile = Boolean(parsed["per-file"])`.

- The state-file existence check in Phase 2 validation changes its condition from
  `mode === "incremental"` to `incremental`:

  ```typescript
  if (
    state &&
    incremental &&
    (missingStateRaw ?? "error") === "error" &&
    !existsSync(resolvedStatePath)
  ) {
    userError(`State file not found: ${resolvedStatePath}`);
  }
  ```

  Note: `missingStateRaw` before the default is applied is the right reference here, since we
  want to check what the user explicitly passed, not the post-default value. However, because the
  mutual-exclusion validation in Phase 1 already confirmed that `missingStateRaw` is either
  `"error"` or `"snapshot"` when provided, and `undefined` when absent, using
  `(missingStateRaw ?? "error") === "error"` is equivalent to checking "is the effective value
  `error`" which is the correct condition for this error.

- `Extractor.run()` (or `loadPriorCheckpoint()`) currently checks `config.mode === "incremental"`.
  After Phase 5 this becomes `config.incremental`. All other conditional logic referencing the old
  field names gets the same mechanical rename. No behavioral change.

- The CHANGELOG migration draft should include a before/after code block, e.g.:

  ```
  # Before (v0.3.x and earlier):
  gitrail --mode incremental --on-missing-state snapshot --output-mode file --branch main ./repo

  # After (v0.4.0):
  gitrail --incremental --missing-state snapshot --per-file --branch main ./repo
  ```

  Plus a note: "The old flag names (`--mode`, `--output-mode`, `--on-missing-state`) are not
  recognized by v0.4.0. Because the CLI parser does not error on unknown arguments, passing old
  flags will silently have no effect. Update all scripts and invocations before upgrading."

- The `cmdDefinition` descriptor in `src/cli/args.ts` is spread into `src/index.ts`'s
  `defineCommand` call. Citty generates `--help` output from the argsDef. After Phase 5, `--help`
  output will automatically reflect the new flag names. No separate changes to `src/index.ts` are
  needed for `--help` to be correct.

- `src/core/index.ts` re-exports `ExtractorConfig`. Since only internal field names change (not the
  type name itself), this re-export requires no change. Verify by confirming the export statement
  still compiles cleanly after the type reshape.

---

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks — new CLI contract:**

- `gitrail --incremental --branch main --state ./state.json ./repo` performs incremental extraction.
- `gitrail --branch main ./repo` performs snapshot extraction (default; no `--incremental` needed).
- `gitrail --per-file --branch main ./repo` produces file-granularity output records.
- `gitrail --incremental --branch main ./repo` (no `--state`) exits with code 1 and message `--state is required when using --incremental`.
- `gitrail --missing-state snapshot --branch main ./repo` (no `--incremental`) exits with code 1 and message `--missing-state is only valid with --incremental`.
- `gitrail --incremental --since-ref v1.0 --branch main --state ./state.json ./repo` exits with code 1 and message `--since-ref cannot be used with --incremental`.
- `gitrail --incremental --since-date 2024-01-01T00:00:00Z --branch main --state ./state.json ./repo` exits with code 1 and message `--since-date cannot be used with --incremental`.
- `gitrail --since-ref v1.0 --since-date 2024-01-01T00:00:00Z --branch main ./repo` exits with code 1 and message `--since-ref and --since-date cannot be used together`.
- `gitrail --missing-state unknown --incremental --branch main --state ./state.json ./repo` exits with code 1 and message `--missing-state must be "error" or "snapshot"`.

**Behavioral checks — preserved runtime behavior:**

- Snapshot extraction with `--state ./state.json` still writes the state file on success (same behavior as before, now invoked without `--incremental`).
- `--incremental --missing-state snapshot` with a missing state file emits the existing warning and performs full traversal (behavior unchanged; only flag name changed).
- `--incremental --state <existing>` still extracts only commits newer than the state file's recorded heads (incremental semantics unchanged).
- `--per-file` run produces the same output schema as `--output-mode file` did (only flag name changed; projection pipeline is unchanged).
- `--since-ref` and `--since-date` still work in snapshot mode (no `--incremental`); range filter behavior is unchanged.
- A multi-branch `--incremental` run with a state file that records one branch but not a new one still performs full traversal for the new branch (incremental semantics for unknown branches unchanged).
- `--quiet` flag still suppresses progress and summary output; behavior unchanged.
