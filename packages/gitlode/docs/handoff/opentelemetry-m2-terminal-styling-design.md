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
