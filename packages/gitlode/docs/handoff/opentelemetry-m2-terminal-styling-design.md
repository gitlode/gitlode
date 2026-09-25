# Terminal-aware styling: interactive design assignment

## Status and authority

Human terminal feedback requests changes before cosmetic fine tuning. This is a bounded extension
of M2 profile readability, not a new telemetry architecture workstream. The human starts a separate
interactive design conversation; do not implement before the design returns to trunk.

Continue on `feature/otel-redesign_M2_profile`. Entry known to trunk is
`aab058e0b0507fc599a2aae7b2cd4474ea3043ce`; verify the current clean tip, ancestry and remote before
work. This planning packet will advance that tip. Preserve checkpoints through normal commit/push.
Do not switch to main, update parent refs, create PRs, merge, or rewrite preserved history.
The child still targets a human-approved squash into M2 after cumulative acceptance.

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

## Design work, with the human

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

Produce, in this document:

1. Accepted principles, explicit tradeoffs and the finite environment matrix.
2. A role-to-style table, including primaryValue, keys, units, separators, notices and headers.
3. Shared-consumer impact and exact canonical documentation changes required.
4. Bounded implementation/review checks: correct role use, plain/styled text parity, CI, and real
   light/dark visibility. ANSI snapshots do not prove contrast. Cover every role in a clearly labeled
   synthetic style sample when ordinary fixtures do not exercise notices/unavailable values; do not
   add product failure injection merely to demonstrate colors.
5. Open questions, human decisions, and an implementation handoff with finite completion criteria.

Ask the human about material choices interactively. Do not reopen namespace, numeric availability,
aggregation, schema, performance, system-test organization, or spacing/alignment fine tuning.
No production/test changes, formal measurement, acceptance-record changes or candidate freeze.
Design documents only; run format:write, format:check and diff check, commit and normally push.
Return exact OIDs, clean/remote status and decisions for trunk integration review. Design approval
is not implementation approval or human approval of the resulting terminal output.

## Sequence after design

1. Trunk reviews fit with M2 and assigns a bounded implementation session.
2. Implementation updates shared styles and affected canonical docs/tests together; preserve OIDs.
3. Independent review and green CI precede renewed human light/dark confirmation.
4. Only then handle spacing or other cosmetic feedback in a separate bounded pass.
5. Freeze the resulting functional candidate for cumulative Windows/Linux/package validation.

Existing accepted P1/P2 and unrelated P3 behavior remain accepted. M2, human readability and release
acceptance remain open; the publish record stays blocked. This adds no new permanent Git branch.
