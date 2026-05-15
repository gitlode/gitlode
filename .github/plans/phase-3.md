### Phase 3: Unknown CLI Arguments Error

_Migrate the CLI parsing layer from `citty` to `commander`, gaining native unknown-option detection, native repeatable-option support, and a clean path to future `--help` grouping. Unknown CLI arguments become a hard error (exit 1) before any extraction begins._

#### Status

- [ ] Planned
- [ ] In progress
- [x] Completed

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `.github/instructions/cli.instructions.md` — Command signature, parameter reference, mutual exclusion rules, validation rules, successful-run stderr contract
- `.github/roadmap.md` — Entry: "CLI UX: Warn on unknown CLI arguments"
- `.github/roadmap.md` — Entry: "CLI UX: `--help` option grouping and discoverability" (deferred; commander unblocks future implementation)
- `.github/plan.md` — v0.4.1 overview, scope summary, phase ordering

#### Design Decisions

- **Library migration: `citty` → `commander`**
  Remove `citty` from `dependencies`. Add `commander` (latest stable v13.x at implementation time).
  Rationale: `citty` does not support unknown-option strict mode and silently accepts unrecognized flags. Commander's default behavior treats unknown options as errors, supports natively repeatable options (eliminating the manual `--branch` collection workaround), and supports `--help` option grouping natively — directly unblocking a deferred roadmap item without introducing additional tooling complexity.

- **Unknown option detection: commander's native parse error via `.exitOverride()`**
  Call `program.exitOverride()` before `program.parse()`. Catch the thrown `CommanderError` in a `try/catch` block inside `parseArgs()`. Re-emit via `userError()` for uniform stderr handling and exit code control.
  Commander throws `CommanderError` with `code === 'commander.unknownOption'` when an unrecognized flag is encountered during parse.
  The check runs before any validation, filesystem I/O, or Git operations — guaranteed by the fact that `program.parse()` is called before any extraction logic in `parseArgs()`.

- **Error message format for unknown option**

  ```
  Unknown option: --foo
  ```

  No prefix (no `"error:"`, no `"fatal:"`). Consistent with existing `userError()` message style in `args.ts`.

- **Exit code for unknown option: 1**
  All user-input errors in gitrail use exit code 1 (via `userError()`). Unknown option is the same category. The roadmap references git's `fatal:` style as motivation for making unknown arguments an error (not a warning), not as a requirement to match git's exit code 128.

- **`--help` handling with `.exitOverride()`**
  When `CommanderError.code === 'commander.helpDisplayed'`, call `process.exit(0)`. This restores the natural `--help` exit behavior that `.exitOverride()` intercepts.

- **`--branch` workaround deletion**
  The manual loop that collects repeated `--branch` / `-b` values from `rawArgv` (lines ~115–130 in current `args.ts`) is deleted entirely. Commander handles repeatable options natively via the accumulator pattern:

  ```typescript
  .option('-b, --branch <ref>', 'description', (val, prev: string[]) => [...prev, val], [])
  ```

  The resulting value is `string[]`, with the same semantics as the current implementation.

- **`program` replaces `cmdDefinition` as the exported CLI descriptor**
  `args.ts` exports a module-level `Command` instance named `program` (instead of citty's `cmdDefinition`). This object defines all option and argument metadata and is used in two places: `parseArgs()` (calling `program.parse()`) and `cmd-definition.test.ts` (inspecting registered options and arguments).
  `cli/index.ts` re-export is updated accordingly: export `program` instead of `cmdDefinition`.

- **`index.ts` entrypoint restructuring**
  Remove citty imports (`defineCommand`, `runMain`) and the `const main = defineCommand({ ...cmdDefinition, async run() {...} })` pattern. Move the extraction body into a named async function `main()`. Replace `runMain(main)` with a direct top-level call:

  ```typescript
  main().catch((e) => {
    process.stderr.write((e instanceof Error ? (e.stack ?? e.message) : String(e)) + "\n");
    process.exit(2);
  });
  ```

  This is idiomatic Node.js CLI without a framework dependency.

- **Scope of unknown-option checking — what is excluded**
  Commander natively excludes all of the following from unknown-option checks:
  - `--` (terminates option parsing; tokens after are positional)
  - The positional `<repository-path>` argument
  - Values for recognized options (e.g. the `main` in `--branch main`)
  - Repeated recognized options (e.g. `--branch main --branch develop`)
  - Short alias forms (`-b`, `-o`, `-s`, `-q`) — all aliases remain registered

- **Interaction with existing validation rules**
  Unknown-option detection runs at `program.parse()` time, which is the very first thing `parseArgs()` does. All existing mutual exclusion and format validation rules (incremental vs. since-ref, missing-state constraints, branch requirement, etc.) run afterward and are unchanged. No validation logic is removed or reordered.

- **No typo suggestion (edit-distance heuristic)**
  The roadmap entry includes "if feasible" for typo suggestions. This is intentionally deferred — it is not required for the unknown-argument error behavior and adds implementation complexity. Leave as a follow-up roadmap item.

- **No external behavior changes**
  All CLI flag names, their aliases, default values, output schema, state file format, and extraction semantics are unchanged. The only visible change is that previously-silently-ignored unknown options now terminate with an error message and exit code 1.

- **`ParsedArgs` type: unchanged**
  The return type of `parseArgs()` is identical. Callers (`index.ts`) require no changes to consume the result.

- **`process.argv` parsing in tests**
  Current tests use `setArgv(...args)` which sets `process.argv = ['node', 'gitrail', ...args]`. Commander's default `program.parse()` call uses `process.argv` with the `node` convention (slicing from index 2). This is compatible with the existing test helper without modification.

#### Non-Goals

- Typo / edit-distance suggestion for unknown option names — deferred as a follow-up roadmap item.
- `--help` option grouping — roadmap item remains deferred; commander unblocks it, but implementation is not part of this phase.
- Any change to output JSON schema, state file format, or extraction semantics.
- Any change to validation rules beyond the addition of unknown-option detection.
- Changing exit codes for any existing error paths.
- Adding `--version` flag support.

#### Target Files

| File                              | Action | Notes                                                                                                                                                                                                                                                                             |
| --------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/args.ts`                 | Modify | Replace citty imports with commander. Delete manual `--branch` collection loop. Build a module-level `program: Command`. Wrap `program.parse()` in `exitOverride` try/catch. Export `program` instead of `cmdDefinition`. Keep `parseArgs()` signature and return type unchanged. |
| `src/cli/index.ts`                | Modify | Replace `export { cmdDefinition, parseArgs }` with `export { program, parseArgs }`. Keep `ParsedArgs` re-export.                                                                                                                                                                  |
| `src/index.ts`                    | Modify | Remove `defineCommand`, `runMain` imports from citty. Remove `cmdDefinition` import. Remove `const main = defineCommand(...)` pattern. Move extraction body into named `async function main()`. Replace `runMain(main)` with `main().catch(...)`.                                 |
| `package.json`                    | Modify | Remove `"citty"` from `dependencies`. Add `"commander": "^13.x"` (pin to latest stable at implementation time).                                                                                                                                                                   |
| `test/cli/cmd-definition.test.ts` | Modify | Rewrite all three `it` blocks to use commander's `Command` API: `program.name()`, `program.description()`, `program.options` (array of `Option` objects), `program.registeredArguments`. See Implementation Notes for expected assertion shapes.                                  |
| `test/cli/args.test.ts`           | Modify | Add test cases for unknown option rejection. Existing test cases should pass without modification if `ParsedArgs` interface and `setArgv` helper are unchanged — verify during implementation.                                                                                    |

#### Documentation Touchpoints

| File                                       | Section                                                                                                | Action                                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github/roadmap.md`                       | "CLI UX: Warn on unknown CLI arguments"                                                                | Remove — implemented in this phase                                                                                                                                                         |
| `.github/roadmap.md`                       | "CLI UX: `--help` option grouping and discoverability" — "Design resolution notes (v0.2.0 — deferred)" | Update — replace the citty limitation note with a note that commander supports option grouping natively; the blocker is resolved but implementation remains deferred on cost/value grounds |
| `.github/instructions/cli.instructions.md` | (no existing section for unknown-arg policy)                                                           | Add a subsection under "Validation Rules" (or similar) documenting the unknown-option error behavior, exit code, and message format                                                        |

#### Implementation Notes

- **`cmd-definition.test.ts` replacement shape**: The three existing `it` blocks map to commander as follows:
  - `"has a meta object with name and description"` → assert `program.name() === 'gitrail'` and `program.description()` is a non-empty string.
  - `"exposes all expected argument definitions"` → assert the `repository-path` positional argument is registered: `program.registeredArguments[0]?.name() === 'repository-path'`. For options, assert that `program.options.map(o => o.long)` includes all expected long flag names (e.g. `'--branch'`, `'--incremental'`, `'--output-dir'`, etc.).
  - `"each arg definition has a description string"` → assert each `Option` in `program.options` and each `Argument` in `program.registeredArguments` has a non-empty `.description`.

- **`exitOverride` catch shape** in `parseArgs()`:

  ```typescript
  import { Command, CommanderError } from "commander";
  // ...
  program.exitOverride();
  try {
    program.parse(process.argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      if (err.code === "commander.helpDisplayed") process.exit(0);
      userError(
        err.code === "commander.unknownOption"
          ? `Unknown option: ${err.message.replace(/^error: /, "")}`
          : err.message,
      );
    }
    throw err;
  }
  ```

  Note: `err.message` from commander for unknown option is `"error: unknown option '--foo'"`. Strip the `"error: "` prefix so the final output matches `userError` style.

- **`program.parse()` call convention**: Use `program.parse(process.argv)` (commander's default `node` convention, equivalent to `program.parse(process.argv, { from: 'node' })`). Commander slices from index 2 internally.

- **Option value extraction after parse**: Replace `parsed["foo"]` keyed access on citty's result object with `program.opts()["foo"]` (or destructured `const { foo } = program.opts()`). Positional arg is `program.args[0]`.

- **`--branch` initial value**: Use `[]` as the default initial accumulator, not `undefined`. This matches the existing behavior where `branches.length === 0` triggers a `userError`.

- **Module-level `program` construction**: Build the `Command` object at module load time (not inside `parseArgs()`). This allows tests to import `program` and inspect its structure without calling `parseArgs()`.

#### Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations):

- `gitrail --unknown-flag ./repo --branch main` → stderr: `Unknown option: --unknown-flag`, exits 1, no extraction begins.
- `gitrail --rotaet-lines 100 ./repo --branch main` (typo) → stderr: `Unknown option: --rotaet-lines`, exits 1.
- `gitrail --branch main ./repo` (valid invocation against a real repo) → extraction proceeds normally; no regression.
- `gitrail --help` → help text is printed to stdout, exits 0.
- `gitrail --branch main --branch develop ./repo` → both branches are used (repeatable option works without workaround).
- `gitrail ./repo --branch main -- --ignored` → `--ignored` after `--` is treated as a positional, not flagged as unknown.
- Confirm `citty` is no longer listed in `node_modules/.package-lock.json` or `package.json` dependencies after `npm install`.
