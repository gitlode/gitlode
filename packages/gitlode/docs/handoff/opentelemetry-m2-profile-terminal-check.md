# Profile real-terminal confirmation preparation

## Current assignment: bounded preparation

P3 implementation is accepted at `c694b69cc964226ccbf07325ee45ab32b6ff2e74`, recorded by independent
review at `1a012d589604c6e570e155b3aa49a6d31a038f5d`. Human terminal confirmation and cumulative
Windows/Linux/package validation remain open. This packet assigns preparation only in a new
human-started branch conversation, not human approval or a validation campaign.

Continue `feature/otel-redesign_M2_profile`. Verify clean status, ancestry and actual remote equality;
record exact entry including this packet. Remain on the child; trunk is a conversation role. No parent
ref updates, PR, merge, formal measurement, freeze, tests/system move or acceptance-record update.
Read the accepted design's styling/composition rules, P3 acceptance, existing real-output evidence
and `scripts/capture-profile-evidence.ts`. Do not reopen accepted renderer/collector behavior here.

## Concrete preparation output

Provide a small reproducible operator command using the existing deterministic five-commit commit,
file and plugin fixtures. Prefer a narrow mode in the existing capture script or a small adjacent
helper that reuses fixtures; do not create a second product renderer or public CLI option. Keep the
existing non-TTY capture behavior intact. The real-terminal mode must inherit stdout/stderr directly
into the user's terminal rather than capture/pipe them; otherwise product TTY/color detection is not
being exercised. Do not force ANSI or launch a visible terminal on the user's behalf.

Allow each small scenario to run separately so the human can inspect output and repeat it after a
theme change. Own temporary repositories/config/plugin/output paths, validate cleanup targets, and
clean them on success/failure/interruption as far as the helper can guarantee. Use a finite execution
limit and surface nonzero child exits. Do not reuse D:/gitlode_test evidence paths or delete user data.
Keep meaningful progress/output available instead of waiting silently. Child cleanup belongs to the
helper; do not add supervision machinery or formal benchmark dependencies for this check.

Return exact PowerShell commands from the repository root: prerequisite build, each real-TTY scenario,
and normal no-color/non-TTY comparison using existing project behavior where useful. Note expected
output destinations and approximate workload (small fixture; build/child execution still takes time).
Report environment color settings that prevent exercising colors; do not override user settings or
claim ANSI/plain automated parity establishes human readability.

Use existing script/fixture patterns and test the bounded helper's normal completion and failure
reporting as appropriate. Explicitly typecheck modified tooling under strict checking, run affected
checks and format write/check plus diff check. No product changes or full package/OS campaign. If a
product defect appears during preparation, return it to trunk rather than repairing it in this task.

## Human confirmation to leave pending

Prepare a concise checklist and response template here, tied to accepted implementation and helper
OIDs. The human should run the commands in their ordinary terminal with a dark and light theme at
usual width, then a narrower width to inspect wrapping. Check:

- headings, values, keys/units and separators remain readable; unavailable markers and warnings, when
  present, are understandable without color;
- namespace indentation, attributes and plugin Scope are interpretable; wrapping does not obscure
  which row/attribute belongs to which target;
- ordinary progress/completion summary and Profile coexist without overwritten or lost lines;
- no-color/plain output retains the same information.

Ordinary fixtures may have no warnings/unavailable values. Do not claim those were visually observed.
If a small supplementary synthetic sample is useful for role visibility, use the existing renderer
and shared TTY-aware styling, clearly label it synthetic, and keep it separate from real CLI evidence.
Do not add production failure injection merely to show a warning. Record unobserved cases explicitly;
existing deterministic tests retain semantic coverage.

Human response should identify terminal/theme/width, commands and source, observed problems (or none),
and accepted / changes requested. No screenshot is mandatory. Leave human result pending until the
human explicitly supplies it; do not infer approval from helper success or elapsed time.

## Return and next gates

Append preparation outcome with changed files, exact commands, checked results, helper/product OIDs,
output/cleanup behavior and any limitations. Normally commit/push to the child, verify actual remote
OID and clean status. Human starts and completes visual confirmation after trunk checks the handoff.
Trunk then incorporates feedback and assigns cumulative Windows/Linux source/installed-package
validation at a concrete final candidate. Neither helper completion nor human appearance approval
completes M2/performance/release acceptance or authorizes PR/merge.
