# Terminal-aware styling: interactive design and prototype assignment

## Status and authority

Human terminal feedback requests changes before cosmetic fine tuning. This is a bounded extension
of M2 profile readability, not a new telemetry architecture workstream. The human starts a separate
interactive conversation. This packet supersedes the former design-only assignment: small production,
test and sample changes are authorized to make style decisions from real output. Do not require a
complete design document before trying a bounded candidate with the human.

## Branch and checkpoint boundary

Planning is on `feature/otel-redesign_M2_profile`, based on clean checkpoint
`f653688361b430045bbc5bfeb1a3cd7340de114f`; this packet advances that tip. At entry, verify the
planning commit containing this packet, ancestry, clean worktree and actual remote equality. Record
its full OID, then create `feature/otel-redesign_M2_styling` from that verified profile tip and normally
push with upstream tracking. If the styling branch already exists, inspect it and resume only when
its provenance matches; never reset or overwrite it. Trunk is a conversation role, not a Git ref.

Commit and normally push meaningful trials, including explicitly unfinished states, before handoff
or long pauses. Record which OID the human actually viewed and which choices were adopted. Do not
rewrite pushed checkpoints. Keep trial history on the styling child; the recommended return is a
human squash into `feature/otel-redesign_M2_profile` after final review/CI and human acceptance.
The profile child later enters M2 by human squash after cumulative acceptance. Preserve the styling
source ref until trunk accounts for post-squash content and evidence; only the human deletes branches.
No formal performance candidate is frozen here. Do not claim a squash OID was the tested source;
record the mapping and assess its delta before later validation/freezing.

Do not create a PR without explicit human approval naming source and base. Only the human merges.
Do not update profile/M2/integration/main refs, force push, or switch to main at completion.

## Confirmed context and principles

- The CI/duration correction at `d9e994cc28bc91b9ca86f3a3e6e798371ec85481` is independently
  accepted in `aab058e`. Its implementation and outcome CI passed. Do not reopen collector/schema work.
- The human used the standard Windows 11 terminal application (exact application/version and palette
  not yet recorded). On a light background `primaryValue: chalk.whiteBright` became unreadable.
  This is a readability defect, not merely a request for different visual emphasis.
- Prioritize useful, readable styling in representative environments. Universal compatibility must
  not become an excuse to render everything in the default foreground or remove useful colors.
- Preserve terminal palette abstraction. Basic ANSI colors, including white/brightWhite, select
  configurable palette entries; none guarantees automatic contrast against the background.
  Default foreground and a named white palette entry are different concepts.
- Distinguish decoration that becomes less noticeable from decoration that makes text unreadable.
  The former is acceptable when plain text retains meaning; the latter requires correction.
- `dim` is not prohibited for keys/units. Evaluate readability in the supported sample environments;
  weak or unsupported dim alone is not a failure. Dimming can also reduce contrast, so inspect it.
- Color-free text must retain meaning and structure. Use colors, bold and dim where useful;
  do not convey essential information through color alone.
- Do not impose blanket bans on bright colors or backgrounds. Evaluate justified roles and pairs.
  Default foreground with bold for primary values is a proposal, not a final palette decision.
- Keep semantic roles centralized in `src/presentation/styling.ts`; do not color by domain attributes.

## Investigation and trials, with the human

Read applicable AGENTS instructions, canonical CLI styling and profiling contracts, accepted profile
sections on styling, and the terminal-check packet. Inspect current shared role consumers, including
progress and application summaries. Do not restrict the impact inventory to Profile.

Use official terminal/Chalk documentation and inspect the repository's installed/locked Vitest
version and relevant formatter/color library source. Vitest is a concrete comparison, not proof of
universal contrast or a requirement to copy its palette. Record what was actually inspected and
separate facts from inferred design lessons. Do not install or upgrade tools just for comparison.

References already checked by trunk:

- https://learn.microsoft.com/en-us/windows/terminal/customize-settings/color-schemes
- https://learn.microsoft.com/en-us/windows/terminal/customize-settings/profile-appearance
- https://help.gnome.org/gnome-terminal/app-colors.html
- https://github.com/chalk/chalk

Propose a finite matrix: Windows Terminal and GNOME Terminal, each with named light/dark palettes,
plus plain output. This matrix is a recommendation to settle with the human, not an assertion that
Linux GUI access exists. Record unavailable environments and decide how evidence will be obtained.
WSL inside Windows Terminal does not test a separate terminal renderer. Distinguish window theme
from text-area palette. Do not auto-detect or query background colors unless a concrete need emerges;
a theme-detection subsystem is outside the proposed scope.

## Interactive loop and scope

1. Inspect role consumers and the locked Vitest implementation; summarize a small number of concrete
   lessons and candidate role assignments. Confirm the finite terminal/palette matrix with the human.
2. Implement a small reversible styling candidate and a clearly labeled synthetic role sample where
   ordinary fixtures lack warnings, errors or unavailable values. Reuse the real styling factory and
   renderer; no second product renderer, permanent theme picker or product failure injection.
3. Provide exact commands, expected workload and what to compare. The human runs real terminals;
   do not claim automated ANSI snapshots establish readability. Record palette names separately from
   window themes, approximate widths, source OID and unobserved environments/roles.
4. Ask for feedback, adjust the candidate and repeat within this conversation. Ordinary bounded
   trials do not need a trunk round trip. Keep a short decision table: principle, trial, human result,
   adopted/rejected/pending. Do not mistake an unreviewed prototype for an accepted policy.
5. Once palette principles and shared roles are adopted, handle spacing/separators or other fine
   adjustments as a distinct pass with separate rationale. Do not mix an individual preference into
   a universal rule. Stop after agreed findings are resolved; do not exhaustively tune arbitrary themes.

Use the existing terminal-check helper for real commit/file/plugin output and check shared progress
and completion output too. A synthetic sample should cover all styling roles, clearly distinguished
from observed CLI behavior. Preserve plain/styled text parity except separately agreed textual/layout
changes. Respect existing color-support and non-TTY behavior; never force colors in the product.

Escalate to trunk if a fix requires telemetry/schema/aggregation changes, substantial output-structure
redesign, a new terminal capability/theme subsystem, or a material expansion of supported environments.
Do not silently broaden into performance, tests/system organization or release acceptance. If context
becomes too large or the same issue remains after two correction rounds, checkpoint exact state and
return a bounded diagnosis/continuation request rather than starting another unbounded patch cycle.

## Completion and verification

The goal is useful colored/weighted output that stays readable in the agreed light/dark matrix, not
identical appearance on every terminal. Weak/unsupported decoration is acceptable when text remains
readable; color-free output must retain meaning. Human approval is required for the selected visual
result. If Linux GUI evidence is unavailable, record the gap and return it to trunk; do not substitute
WSL inside Windows Terminal or silently waive it.

During trials run meaningful affected checks, not a full campaign for each color edit. Before return:

- Verify role use, target-local behavior and plain/styled text parity with affected tests, including
  collector-to-presentation tests if formatting behavior changes. Avoid tests that merely duplicate
  a color assignment without checking a contract.
- Run build, applicable strict tooling checks, lint, format:write, format:check and diff check.
- Run root source tests and verify final-source CI including release build, packed metadata and
  installed-package tests; distinguish skipped/unverified checks. Warn before long execution/waits.
- Update durable policy with the adopted implementation: `docs/design/cli.md`, `docs/profiling.md`
  and relevant profile-view catalog/tests as affected. Reconcile superseded styling statements in
  the profile design; do not keep conflicting dim/role rules. Update usage only if its contract changes.
- Record source OIDs, human environment/results, adopted role table, checks and residual issues here;
  keep this note compact instead of appending every transcript or duplicating canonical policy.

Return for independent focused review of the final diff, shared-consumer effects, tests and contracts.
Do not self-accept the implementation. Human trial approval may serve as visual evidence only for the
recorded content; later visible corrections require another targeted human check. Trunk assigns review
and, once accepted with green CI and human visual approval, prepares the source/base PR for permission.
After human squash, trunk verifies content correspondence before cumulative Windows/Linux/package
validation at a fixed profile candidate. CI does not replace that cumulative acceptance packet.

Existing accepted P1/P2 and unrelated P3 behavior remain accepted. M2 and release acceptance remain
open; the publish record stays blocked. Formal measurement, freeze, PR and merge are not authorized by
this packet. Finish on the styling child with committed, remotely preserved work and an explicit
complete-for-review or continuation-needed outcome.

## Styling session entry and first proposal

Entry source: `76486d25870172528ce9af086ace756388b6c8d8`. The worktree was clean,
`f653688361b430045bbc5bfeb1a3cd7340de114f` was an ancestor, and `git ls-remote`
confirmed actual profile remote equality. The styling child did not exist locally or remotely;
`feature/otel-redesign_M2_styling` was created at that source and normally pushed with upstream
tracking. No visual trial has been implemented or observed at this checkpoint.

### Inspected implementation and lessons

- Locked and installed Vitest: **4.1.10**. Inspected installed
  `node_modules/vitest/dist/chunks/utils.BS4fH3nR.js` (`formatTestPath`, `getStateString`,
  `formatProjectName`, `withLabel`, `padSummaryTitle`) and
  `index.UpGiHP7g.js` (`reportTestSummary`). Labels/separators/details use dim; file basenames
  use default-foreground bold; pass/fail use green/red plus words or symbols; total duration
  uses default foreground. Project labels use black text with palette backgrounds.
- Its locked/installed color dependency is **tinyrainbow 3.1.0**, not Chalk. Inspected
  `node_modules/tinyrainbow/dist/index.js`: bold/dim are SGR 1/2; white/brightWhite are 37/97.
  Its color-support detection differs from gitlode's; do not copy it as product policy.
- gitlode's installed/locked Chalk is **6.0.0**. Inspected `source/index.js` and
  `source/vendor/ansi-styles/index.js`, plus [official Chalk documentation](https://github.com/chalk/chalk).
  The existing factory gates on stderr TTY but uses the default Chalk instance (stdout color
  capability); the terminal helper requires both streams to be TTY. Preserve this existing policy
  in the first role trial and record both stream conditions when checking output.
- Inspected shared consumers: progress active/done formatters, completion summary, Profile
  measurement/attribute/diagnostic formatters and application diagnostic badges. `primaryValue`
  affects progress counters/times, summary quantities, Profile numbers and scalar attributes.
  Unavailable values and diagnostic explanations already use default foreground.
- Inference for the trial: selective color and weight can retain useful hierarchy without fixing
  primary values to a named white palette entry. Vitest is an example, not contrast evidence or
  a mandate to copy its colors/backgrounds.

Official references inspected: [Windows Terminal schemes](https://learn.microsoft.com/en-us/windows/terminal/customize-settings/color-schemes),
[profile appearance](https://learn.microsoft.com/en-us/windows/terminal/customize-settings/profile-appearance)
and [GNOME Terminal colors](https://help.gnome.org/gnome-terminal/app-colors.html).
Default foreground and named ANSI colors are distinct settings. Bold rendering can depend on
terminal intensity settings; record those if weight/brightness is surprising. Window theme and
text-area scheme must be recorded separately.

### Trial 1 (superseded by Trial 2 after human feedback)

| Principle                                         | Trial                                                               | Human result                                                   | Decision              |
| ------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------- |
| Readable primary values on light/dark backgrounds | Change only `primaryValue` from `chalk.whiteBright` to `chalk.bold` | Weak and overused emphasis                                     | Superseded by Trial 2 |
| Useful semantic colors and secondary emphasis     | Observe existing colors and dim                                     | Cyan readable; yellow slightly weak on light; dim not reported | Continue evaluation   |

Trial 1 implemented the proposed bold `primaryValue`. The existing terminal-check helper supplies real
commit/file/plugin output and plain comparison. `scripts/preview-terminal-styling.ts` now supplies a
clearly labeled synthetic sample using the real factory and progress/summary/diagnostic/Profile
formatters, covering all 12 roles. Its active/done lines are static samples, not evidence of live
progress behavior. Warning/error badges, `—`, `unavailable` and ordinary `error`/boolean attributes
are included without product failure injection. The sample creates no files or extraction workload
and never forces color. `--terminal` requires direct TTY stdout/stderr; `--plain` selects the real
plain factory. Check number-heavy Profile rows for excessive bold as well as legibility.
Spacing/separator changes follow role adoption.

Before judging Trial 1, the human requested direct Chalk samples because bold appeared
indistinguishable from unstyled text in the current Windows Terminal environment. This is a
preliminary observation, later refined in the feedback below. The preview prints a separate compact Chalk
primitive section: identical text with no style, bold, dim, bold+dim, italic, underline, inverse,
cyan/cyan+bold/brightCyan, white/white+bold/brightWhite, and black on yellow. Labels remain unstyled.
Compare stroke weight independently from brightness and record the font and `intenseTextStyle`;
do not infer that an emitted bold sequence necessarily produces a visible weight difference.
Plain mode removes decoration from these samples too. This addition changes the helper only, not
the product styling candidate.

Human-confirmed working matrix: **Windows Terminal 1.24.11911.0**, **Campbell / Tango Light**,
plus plain text. The human has no GNOME Terminal installation and authorized proceeding with Windows
and plain checks first; preparing a VM is not part of this trial. GNOME **Tango dark / Tango light**
remain unobserved and an explicit return gap, not waived acceptance. WSL inside Windows Terminal
does not supply GNOME evidence. Start at the usual width (approximately 120 columns if no preference),
then about 80 columns; actual widths and window theme remain to be recorded with results.

From the repository root, build once, then run the sample and real scenarios without piping or
redirection. Repeat terminal commands in both agreed text-area schemes. Build and child startup
take time; each real scenario uses only the existing five-commit fixture and a 120-second child limit.
The existing helper prints and cleans its owned temporary repository/config/JSONL output paths.

```powershell
git rev-parse HEAD
npm run build:dev
npx tsx packages/gitlode/scripts/preview-terminal-styling.ts --terminal
npx tsx packages/gitlode/scripts/capture-profile-evidence.ts --terminal commit
npx tsx packages/gitlode/scripts/capture-profile-evidence.ts --terminal file
npx tsx packages/gitlode/scripts/capture-profile-evidence.ts --terminal plugin
npx tsx packages/gitlode/scripts/preview-terminal-styling.ts --plain
npx tsx packages/gitlode/scripts/capture-profile-evidence.ts --plain commit
```

Record source OID, scheme, window theme, width, primary-value readability/emphasis, dim key/unit
readability, cyan/green/yellow/red readability, unavailable markers and progress/summary/Profile
coexistence. If the five-commit fixture finishes before the active spinner is observed, record that
gap; the static sample establishes glyph appearance only. Plain mode intentionally suppresses live
progress, so compare equivalent rendered text and report content, not identical run transcripts or
wall-clock numbers. Neither automated parity nor this environment agreement is visual approval.

Trial checks: `npm run build:dev` and explicit strict standalone TypeScript checking of the new
script passed. Presentation tests passed **10 files / 55 tests**, including role mappings,
target-local rendering, styled/plain parity, progress and presenter coverage. Focused oxlint passed.
Synthetic `--plain` and real `--plain commit` completed. An isolated in-memory check simulated TTY
capabilities and Chalk level 1, verified that styled sample output contained ANSI, plain output
contained none, and their sample bodies matched exactly after stripping ANSI. This is not real-TTY
or contrast evidence. Invalid arguments and terminal mode without TTY both correctly exited 1.

### Human feedback and Trial 2

Trial 1 product source: `ccd9589e6e283bf79505acfd2a965ee8d51b5704`; direct Chalk sample source:
`70e9e0dee8274d646c9f3872ee7a4eb385e317fd`. The human explicitly confirmed viewing `70e9e0d`.
Font, intensity setting and widths remain unrecorded.

Windows Terminal 1.24.11911.0 / Campbell and Tango Light observations:

- Bold changed brightness, not font weight; the light scheme sometimes showed little or no change.
  Bold is not prohibited, but cannot be the sole expected source of strong emphasis. The dense use
  of bold across values also diluted differentiation, independently of terminal support.
- Italic and underline worked; italic was a relatively weak effect. Foreground/background pairs
  produced clear emphasis and are candidates for compact labels/headings, not broad body areas.
- White/brightWhite were readable on dark but very difficult on light. Cyan was distinguishable
  from background and normal text on both schemes; yellow on light had a minor readability issue.
- Respect these findings without optimizing exclusively for Windows Terminal. No GNOME evidence
  has been obtained. Dim and real progress coexistence have not received an explicit result yet.

Interpretation: named cyan and white both select configurable ANSI palette entries. The observed
cyan success is evidence for these schemes, not automatic semantic contrast adjustment or a
guarantee for other palettes. Windows Terminal's documented `intenseTextStyle` can select brightness
without weight; the reported appearance is consistent with that option, but the actual setting
has not been established. See the official references above.

| Principle                                                           | Trial 2 candidate                                                                      | Human result                                                      | Decision                              |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| Values serve as body text                                           | `primaryValue`: default foreground, no decoration                                      | Appropriate removal of ineffective decoration                     | Adopted                               |
| Strong emphasis occupies compact structural tokens                  | `sectionHeading`: black on cyan for Profile, Scope and namespace headings              | Readable and appropriately placed; needs semantic differentiation | Refine in Trial 3                     |
| Application success remains distinct from neutral Profile structure | `summaryHeader`: black on green                                                        | Human proposes sharing top-level heading treatment with Profile   | Replace with structural h1 in Trial 3 |
| Bold is optional support, not essential meaning                     | Existing stage/marker bold retained; value and heading emphasis no longer relies on it | Pending                                                           | No blanket prohibition                |

Trial 2 changes only these three shared role assignments. Backgrounds cover the existing heading
tokens, not indentation, row padding or measurement fields; a namespace that also has measurements
keeps those values on the ordinary background. Because Profile, Scope and namespace share a role,
all receive the cyan treatment for this trial. Assess whether repeated namespace badges occupy too
much attention; narrowing the role mapping can be a subsequent bounded trial if needed. No spacing,
text, severity interpretation, detection policy or palette autodetection changes are included.
Keep the small light-scheme yellow finding open while judging this candidate.

Use the same commands above after rebuilding. Focus on body readability, heading/body separation,
the amount of background color in a real Profile and the cyan/green distinction in both schemes.
The direct Chalk primitive section remains unchanged as a comparison reference.

Trial 2 checks: development build, presentation tests (**10 files / 55 tests**) and focused oxlint
passed. An isolated check with simulated TTY/Chalk level 1 verified complete preview styled/plain
text parity and confirmed that a measured namespace heading closes its background before the
measurement fields. These checks establish text/composition behavior, not human readability.

### Trial 3: structural heading levels and separate padding comparison

Human explicitly viewed `5f1aa77e0c2dc25814c7c61143a638d3c2b2b88f` in Windows Terminal 1.24.11911.0,
Campbell / Tango Light, **Cascadia Mono**. Background heading emphasis and its placement were judged
readable and appropriate. Undecorated primary values were accepted as removal of ineffective
decoration, not a claim of dramatically improved contrast. Exact widths/intensity settings remain
unrecorded. This result does not establish GNOME readability or resolve the earlier yellow issue.

The human requested generic structural names and distinct heading semantics, then explicitly selected
separate `h3` / `h4` for namespace depth. Trial 3 replaces `summaryHeader` / `sectionHeading` with:

| Role | Meaning / consumers                              | Candidate foreground + background | Status                  |
| ---- | ------------------------------------------------ | --------------------------------- | ----------------------- |
| `h1` | Top-level title: application summary and Profile | black + green                     | Visual feedback pending |
| `h2` | Section: Scope                                   | white + blue                      | Visual feedback pending |
| `h3` | First namespace level                            | black + cyan                      | Visual feedback pending |
| `h4` | Second namespace level                           | black + white                     | Visual feedback pending |

These are structural roles, not domain names or severity colors. Sharing `h1` removes the previous
success-specific meaning from the summary heading; completion text and done markers retain that
meaning. The catalog and role-contract tests now distinguish title, Scope and both namespace levels.
Group-node measurements and issue-only namespace rows use the same level rules. Backgrounds end
before measurement fields, and indentation remains outside decoration. Product text is unchanged.
Adopted primary-value treatment is reflected in CLI/profiling guidance; superseded bright-white and
uniform-bold statements in the profile design are reconciled with the active trial.

Padding is a **separate preview-only comparison**: each real heading role renders `Heading` and
`Heading`, with one space on each side in the latter. The product renderer does not add padding
yet, and both sample variants preserve styled/plain text parity. This isolates palette/hierarchy
feedback from a future intentional layout change. Installed Vitest 4.1.10's `formatProjectName`
and `withLabel` in `utils.BS4fH3nR.js` do put one space on each side inside background decoration;
that is an inspected implementation fact, not a requirement to copy its complete formatting.

Use the existing preview and real commit/file/plugin commands after rebuilding. Compare the
semantic levels, the new white-on-blue and black-on-white pairs, padding alternatives and both
namespace depths. The direct Chalk section is unchanged. Record the next viewed source OID.

Trial 3 checks: development build, explicit strict preview-script typecheck and **11 files / 103
tests** passed (presentation plus collector-to-presentation coverage). The added regression checks
structural heading routing, measured/issue-only namespace cases, exclusion of values/notices from
heading decoration and text parity. Automated checks do not establish visual acceptance.

Status: **continuation needed; awaiting Trial 3 visual feedback**. Primary values are adopted;
heading palette and padding remain pending. Full root/release/package/CI validation and independent
final review remain for return, not claimed by these bounded trial checks.
