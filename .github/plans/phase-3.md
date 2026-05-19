### Phase 3: CLI Readability and Metadata Override

_Improve terminal output readability through strategic formatting and color support, add CLI option grouping and help discoverability, and introduce `--repo-name` and `--repo-url` flags to override auto-derived repository metadata. These UX improvements complete the release-boundary workflow enhancements started in Phase 1 and cost guardrails introduced in Phase 2._

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `instructions/cli.instructions.md` — CLI option parsing, help grouping, and parameter reference standards
- `instructions/schema.instructions.md` — output JSON schema for repository metadata fields
- Roadmap item: "CLI UX: Terminal output styling and readability"
- Roadmap item: "Output: Repository metadata override"

#### Design Decisions

- **Preferred API / library**:
  - Adopt `chalk` for terminal styling in CLI runtime output (progress/status, summary/profile, warning/error lines).
  - Do not implement in-house ANSI management in this phase.
- **Color policy (TTY / non-TTY)**:
  - TTY (`process.stderr.isTTY === true`): enable styled output.
  - non-TTY: disable color automatically.
  - v0.6.0 does not add a user-facing color override option.
  - Future user-controlled color policy for non-TTY/CI is tracked as a separate roadmap item.
  - Color decisions in this phase are fixed design contracts and must not be reinterpreted during implementation.
  - Apply color only to runtime stderr output (progress/status, summary/profile, warning/error). Keep `--help` uncolored.
- **Detailed color mapping contract (TTY only)**:
  - Use a single shared styling map in CLI modules with the exact semantic-to-style assignments below:
    - active spinner glyph: `chalk.cyan`
    - done marker (`✓`): `chalk.green.bold`
    - stage labels (`Preparing extraction`, `Extracting history`, `Finalizing output`): `chalk.bold`
    - summary header (`Extraction complete`) and profile header (`Profile`): `chalk.green.bold`
    - warning badge token (`[WARN]`): `chalk.yellow.bold`
    - error badge token (`[ERROR]`): `chalk.red.bold`
    - field keys/labels (`Records written`, `commits`, `written`, `elapsed`, and similar): `chalk.dim`
    - primary values (numeric/value body): `chalk.whiteBright`
    - unit suffixes (`MB`, `s`, `ms`, `GB`, `KB`, `B`): `chalk.dim`
    - refs list value in summary (`main, develop`, etc.): `chalk.cyan`
  - When a rendered token has both category and strength semantics, prioritize readability semantics in this order:
    1. severity token (`[ERROR]`, `[WARN]`)
    2. completion token (`✓`, summary/profile header)
    3. value emphasis (value body over key/unit)
  - Non-TTY rendering must emit the same text content with no ANSI escape sequences.
- **Readability scope**:
  - In scope: completion summary block, profile block, warning/error lines, active/done progress lines, and plain-text `--help` discoverability improvements (group structure and phrasing).
  - Out of scope: `--help` color styling in v0.6.0.
- **Completion summary and profile formatting contract**:
  - Keep the existing summary field order and aligned multi-line block structure.
  - Apply thousands separators to integer counters where not already present.
  - Unify measured values as `number+unit` with no space (for example `1.2MB`, `8.5s`, `12.34ms`).
  - Within measured values, render number with stronger emphasis than unit.
  - Extend the same number/unit emphasis rule to the profile block.
  - Apply color at token granularity for measured values:
    - numeric part uses primary value style
    - unit part uses unit suffix style
- **Warning/error line contract**:
  - Standardize severity prefixes as `[WARN]` and `[ERROR]`.
  - TTY color hierarchy: warning badge and error badge follow the detailed color mapping contract; message body remains default foreground.
  - non-TTY remains plain text with the same prefix format.
  - Preserve existing behavior where warning lines interrupt/recover the active progress line; do not change exit code semantics.
- **Active/done extracting line contract**:
  - Preserve existing token order on extracting line (spinner, stage label, ref progress, commits, records, written bytes, elapsed).
  - Keep label wording `written` (do not rename to `bytes`).
  - Apply the unified no-space measured value rule (for example `941.9MB`, `1.5s`) with number-strong/unit-muted emphasis.
  - For done lines, replace spinner position with `✓` and render it using the done-marker style from the detailed color mapping contract.
  - Active spinner and done marker must remain visually distinguishable even without reading the label text.
- **Help grouping and discoverability contract**:
  - Reorganize `--help` into the following sections (in order):
    1. `Required Input`
    2. `Extraction Range (Snapshot Mode)`
    3. `Incremental Extraction`
    4. `Output and Repository Metadata`
    5. `File Rotation`
    6. `Runtime and Diagnostics`
  - Keep help text plain in v0.6.0 (no color styling).
  - Use concise two-part phrasing for option descriptions where applicable: what it does, then applicability constraints.
- **`--repo-name` and `--repo-url` semantics**:
  - Add both flags as independent optional options; neither requires the other.
  - `--repo-name` overrides only `repository.name` in output records.
  - `--repo-url` overrides only `repository.url` in output records.
  - If both are provided, both output fields are overridden.
  - If omitted, keep existing auto-derived behavior.
- **Interaction with auto-derived metadata and state**:
  - Metadata overrides apply only at output-record projection time.
  - Overrides do not affect state-file repository identity checks, traversal planning, ref resolution, or incremental extraction behavior.
- **Owning layer**:
  - CLI layer owns terminal presentation, help grouping/text, and metadata override argument parsing.
  - Core/output projection path owns application of resolved metadata override values onto output records.
  - State/traversal logic remains unchanged in this phase.
- **New runtime dependencies**:
  - One dependency addition is allowed in this phase: `chalk`.

#### Non-Goals

- Introduce a new config file or configuration-file redesign (deferred to future roadmap item)
- Add color customization or theme selection (strategic placement only)
- Add `--color`/`--no-color` style override options in v0.6.0
- Colorize commander-generated `--help` output in v0.6.0
- Change extraction/state behavior, state schema, or JSON line structure beyond repository metadata field values

#### Target Files

| File                                   | Action | Notes                                                                                            |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `src/cli/args.ts`                      | Modify | Add `--repo-name` / `--repo-url`; apply new help groups and revised option descriptions          |
| `src/cli/index.ts`                     | Modify | Export updated parsed argument shape if needed for new metadata overrides                        |
| `src/cli/progress/formatters.ts`       | Modify | Apply extracting/done line wording decisions and value/unit formatting                           |
| `src/cli/progress/controller.ts`       | Modify | Render done-line check mark token (`✓`) and preserve warning interrupt/redraw behavior           |
| `src/cli/reporting/formatters.ts`      | Modify | Apply summary/profile readability contract including unit emphasis and no-space unit formatting  |
| `src/index.ts`                         | Modify | Wire parsed metadata overrides and terminal styling dependency usage                             |
| `src/output/types.ts`                  | Review | Confirm no schema shape change is needed; only value source changes                              |
| `src/core/fact-projector.ts`           | Modify | Apply resolved metadata override values when projecting output records                           |
| `test/cli/cmd-definition.test.ts`      | Modify | Update expected help groups and option registration assertions                                   |
| `test/cli/args.test.ts`                | Modify | Add parsing/validation tests for `--repo-name` and `--repo-url`                                  |
| `test/cli/progress/formatters.test.ts` | Modify | Update extracting/done line expectations including no-space units and done marker semantics      |
| `test/index.test.ts`                   | Modify | Update summary/profile format expectations and line emphasis assumptions as text-level contracts |
| `test/core/fact-projector.test.ts`     | Modify | Add override precedence tests for repository metadata projection                                 |

#### Documentation Touchpoints

| File                                          | Section                             | Action  |
| --------------------------------------------- | ----------------------------------- | ------- |
| `README.md`                                   | CLI usage overview                  | Review  |
| `docs/usage.md`                               | CLI options                         | Update  |
| `docs/usage.md`                               | Terminal output and examples        | Update  |
| `docs/design/schema.md`                       | Repository metadata fields          | Update  |
| `.github/instructions/cli.instructions.md`    | Help option groups                  | Replace |
| `.github/instructions/cli.instructions.md`    | Successful-run stderr contract      | Replace |
| `.github/instructions/schema.instructions.md` | `repository` field derivation rules | Update  |

#### Implementation Notes

- Prefer a small internal styling abstraction in CLI modules so tests can assert stable text contracts without coupling to ANSI escape details.
- Keep non-TTY output deterministic and color-free by centralizing `isTTY`-gated styling decisions.
- Keep the detailed color mapping contract as constants in one module and import from all CLI presentation formatters/controllers.
- Do not introduce per-call ad-hoc colors outside the centralized mapping in this phase.
- Implementation-phase acceptance includes a human visual review of TTY color output.
- If the human review finds readability issues after implementation, same-session color tuning is allowed before marking the phase as pass, while preserving the agreed semantic hierarchy and non-TTY no-color policy.
- Apply repository metadata overrides at projection/output boundary; avoid threading override concerns into traversal or state logic.
- Ensure updated help descriptions preserve existing validation semantics and mutual-exclusion behavior from earlier phases.

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```text
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- `gitrail --help` shows the new six-group order and includes `--repo-name` / `--repo-url` under `Output and Repository Metadata`.
- TTY run (`--profile`, non-quiet) shows styled summary/profile/warning/error/progress output with readable hierarchy.
- TTY run (`--profile`, non-quiet) uses the exact detailed color mapping contract (spinner, done marker, badges, keys, values, units, refs).
- non-TTY run (pipe or redirect stderr) emits equivalent plain-text output with no ANSI color escapes.
- Human visual review confirms TTY color readability on the implementation environment; if needed, color intensity/hue is adjusted in-session and re-validated before pass.
- Completion summary and profile both render measured values as no-space `number+unit` tokens (for example `1.2MB`, `8.5s`, `12.34ms`).
- Extracting done lines show `✓` in spinner position with success emphasis, while active lines retain spinner behavior.
- `--repo-name` alone changes only output `repository.name`; `--repo-url` alone changes only output `repository.url`; both together override both fields.
- Metadata override flags do not affect state-file repository identity checks or incremental traversal behavior.
