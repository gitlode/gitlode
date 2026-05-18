### Phase 3: CLI Parser Hardening and Help Discoverability

_Harden the CLI parser by replacing the current `opts<T>()` trust boundary with a local runtime validator, and improve `--help` discoverability by grouping options with commander 14's native help-group support. This phase is planned against the post-Phase-1 CLI surface, so the validator and help text must use `--ref`, `--since-ref`, and the rest of the Phase 1 vocabulary rather than the pre-Phase-1 `--branch` model._

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `instructions/cli.instructions.md` — current CLI framework, option definitions, validation rules, and stderr/exit-code contract
- `instructions/architecture.instructions.md` — CLI layer ownership, parse boundary, and top-level error behavior
- `plans/phase-1.md` — finalized post-Phase-1 option surface (`--ref`, `--since-ref`, `--state`, `--incremental`)
- Roadmap item: "CLI: Schema validation for parsed CLI options"
- Roadmap item: "CLI UX: --help option grouping and discoverability"

#### Design Decisions

- **Preferred API / library / Node.js built-in**: Use **zod v4** (`zod@^4.0.0`) as the shape validator inside `src/cli/args.ts`. A hand-written validator was rejected because it still requires a manually-maintained type declaration alongside it — the drift risk moves rather than disappears. valibot was considered but zod v4 is more familiar in the ecosystem and offers no meaningful size advantage for a CLI tool distributed via npm. The primary reasons for choosing zod now rather than deferring are: (1) it eliminates the `opts<T>()` drift risk fully via `z.infer<>`, and (2) the plugin config file validation (JSON) planned for the plugin phase will reuse the same library — paying the dependency cost once. zod v4's bundle footprint (~7 KB gzipped) is not a material concern for a Node.js CLI.
- **Owning layer**: The CLI layer owns both the parser and the validator because this is the first boundary where raw argv becomes a structured configuration object. Core and Git layers must continue to receive only validated CLI data.
- **Validation scope**: Validate the parsed option object shape and normalized primitive types after commander parsing, but keep cross-field rules as explicit parser logic. In particular, mutual exclusion and required-combination checks remain in the parser's existing validation block instead of being absorbed into a schema abstraction. This phase does not add repository or Git-state validation.
- **Schema / type strategy**: Define a module-private `RawOptsSchema` (`z.object({...})`) inside `src/cli/args.ts`. Use `z.infer<typeof RawOptsSchema>` as the internal opts type within `parseArgs()`. This replaces the `opts<T>()` type assertion as the enforcement point. `ParsedArgs` remains the public return type of `parseArgs()` — it is not changed to a zod-derived type. The schema covers the shape and primitive-type constraints that commander cannot enforce natively (e.g., `z.array(z.string())` for repeatable options, `z.boolean()` for flags). Numeric and size validation for `--rotate-lines` and `--rotate-size` stays below the schema layer as explicit code, because those values arrive from commander as raw strings and require custom parsing logic.
- **Containment boundary**: `RawOptsSchema` must not be exported from `args.ts` or re-exported from `cli/index.ts`. `z.ZodError` must be caught inside `parseArgs()` and converted to `userError()` before it can escape. No zod import must be required in `src/index.ts` or any other consumer of the CLI layer. The zod dependency is an internal implementation detail of `src/cli/args.ts` only.
- **Validation call site**: Run validation inside `parseArgs()` immediately after `program.parse(process.argv)` succeeds and before any filesystem or Git adapter calls. `src/index.ts` should continue to see only validated arguments and should not gain a second parsing or validation gate.
- **Error contract**: Validation failures are user errors: write the message to `stderr`, exit with code `1`, and do not add an `error:` or `fatal:` prefix. Keep the first failure deterministic and single-line so the diagnostics stay stable in tests and shell scripts.
- **Help grouping API**: Use commander 14's native `.helpGroup()` support on each `Option`. Do not add a custom `formatHelp()` override or a synthetic `addOptionGroup()` helper. The built-in grouping is sufficient and preserves commander's default help rendering.
- **Help group names and assignments**: Use `General` for `--quiet` and `--profile`; `Output` for `--output-dir`, `--output-prefix`, and `--per-file`; `Differential Extraction` for `--incremental`, `--state`, `--missing-state`, `--since-ref`, and `--since-date`; and `File Rotation` for `--rotate-lines` and `--rotate-size`. The `<repository-path>` positional argument remains in the synopsis and is not forced into a separate option group.
- **Ambiguous options**: Assign each option by primary user intent only and do not duplicate it across groups. `--state` belongs with Differential Extraction because it primarily enables incremental bootstrap and scheduled runs; `--per-file` belongs with Output because it changes record granularity rather than traversal behavior.
- **Phase 2 separation**: Keep CLI schema validation independent from commit-OID and repository object-format checks. This phase must not add object-format probing or OID compatibility logic; that concern stays in Phase 2.
- **New runtime dependencies**: `zod@^4.0.0` added to `dependencies`.

#### Non-Goals

- Change the CLI option surface beyond the Phase 1 vocabulary.
- Add repository-format or commit-OID compatibility logic.
- Rework progress, summary, or extraction behavior outside parser validation and help output.

#### Target Files

| File                              | Action | Notes                                                                                                |
| --------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `package.json`                    | Modify | Add `zod@^4.0.0` to `dependencies`.                                                                  |
| `src/cli/args.ts`                 | Modify | Add `RawOptsSchema`, remove the `opts<T>()` trust boundary, catch `ZodError`, apply help-group tags. |
| `test/cli/args.test.ts`           | Modify | Cover parser-shape validation, preserved mutual-exclusion errors, and exit-code behavior.            |
| `test/cli/cmd-definition.test.ts` | Modify | Assert the grouped option layout and the post-Phase-1 option names exposed by `program`.             |

#### Documentation Touchpoints

| File                                       | Section                       | Action |
| ------------------------------------------ | ----------------------------- | ------ |
| `.github/instructions/cli.instructions.md` | CLI option/help documentation | Update |

Update the CLI instructions to document the help option groups introduced in this phase (`General`, `Output`, `Differential Extraction`, `File Rotation`) and their option assignments on the post-Phase-1 option surface.

#### Implementation Notes

- Keep the help-group registration order stable so the snapshot order in `--help` remains deterministic.
- `ZodError` surfaces at most one issue message per invocation (first failure); this matches the existing single-line `userError()` contract. Do not accumulate or format multiple zod issue messages.
- Do not move the existing cross-field checks into commander internals or into zod `.refine()` calls; they remain explicit code after `RawOptsSchema.parse()` succeeds.
- `rotateLines` and `rotateSize` are typed `z.string().optional()` in the schema because commander captures them as raw strings. The existing numeric and size-range validation for these two options runs as explicit code below the schema call, unchanged.

**Containment pattern** — the following structure must be followed in `src/cli/args.ts`:

```typescript
import { z } from "zod";

// Module-private — never exported from args.ts or cli/index.ts
const RawOptsSchema = z.object({
  ref: z.array(z.string()),          // --ref (post-Phase-1 name)
  incremental: z.boolean(),
  outputDir: z.string(),
  outputPrefix: z.string().optional(),
  state: z.string().optional(),
  missingState: z.string().optional(),
  sinceRef: z.string().optional(),
  sinceDate: z.string().optional(),
  rotateLines: z.string().optional(), // raw; numeric validation below
  rotateSize: z.string().optional(),  // raw; size validation below
  quiet: z.boolean(),
  profile: z.boolean(),
  perFile: z.boolean(),
});

export async function parseArgs(adapter: GitAdapter): Promise<ParsedArgs> {
  // ... commander parse and error handling (unchanged) ...

  // ZodError is caught here; no zod type escapes this function boundary
  let opts: z.infer<typeof RawOptsSchema>;
  try {
    opts = RawOptsSchema.parse(program.opts());
  } catch (err) {
    if (err instanceof z.ZodError) {
      userError(err.issues[0]?.message ?? "Invalid CLI options");
    }
    throw err;
  }

  // Cross-field mutual exclusion checks remain as explicit code below
  // ...

  // Return type is ParsedArgs — callers never see ZodError or z.infer<...>
  return { ... };
}
```

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```bash
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- Run `gitrail --help` and confirm the sections appear in the chosen group order with the Phase 1 option names.
- Run parser-failure cases and confirm validation errors still print to `stderr` with exit code `1` and no prefix.
- Confirm `--incremental` / `--state` / `--missing-state` mutual-exclusion behavior is unchanged apart from the new typed parser boundary.
