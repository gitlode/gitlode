# Profile real-terminal confirmation preparation

## Current routing: styling changes requested

The human performed terminal checks and reported unreadable bright-white primary values on a light
background. Readability is **changes requested**. Continue with the
[interactive styling design and trials](opentelemetry-m2-terminal-styling-design.md) on the dedicated
styling child. Its prototype authority supersedes the preparation-only restrictions below: real-output
feedback informs design in the same conversation. Fine cosmetic changes follow adoption of palette
principles as a distinct pass. Independent review and green CI still gate final acceptance.
The CI correction is accepted at `d9e994c`, recorded at `aab058e`; CI is no longer the hold reason.
Commands below remain reproduction tools; record each new trial source OID instead of the historical
template OIDs. The following preparation/result sections are historical context.

## Previous assignment: bounded preparation

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

## Preparation outcome

Status: **prepared; human real-terminal confirmation remains pending**. This outcome supplies the
operator workflow but does not claim that styled output, either theme, or wrapping was observed by a
human. No product implementation, renderer, collector, public CLI, test/system, acceptance record,
formal measurement, PR, merge or parent ref was changed.

### Provenance and helper behavior

- Entry was the requested clean `feature/otel-redesign_M2_profile` checkpoint
  `d654ebcbad97a4e25d217d6359c2eeb2782e7d12`. Local `HEAD`, the local remote-tracking ref and the
  actual `origin/feature/otel-redesign_M2_profile` ref all resolved to that OID. Accepted product/P3
  target `c694b69cc964226ccbf07325ee45ab32b6ff2e74` is unchanged.
- The bounded helper tip is `68364da260fad438c7b88da75f7c7ea2bbe618a1` (initial terminal mode
  checkpoint `ffdc98e4bb7ae66638df12dccca5dd59311e7412`). The only helper file is
  `packages/gitlode/scripts/capture-profile-evidence.ts`; this outcome also changes this handoff.
- With no arguments, the existing three-scenario excerpt capture remains intact. `--terminal` adds
  no product option: it selects one existing fixture, then starts the built CLI with inherited
  stdin/stdout/stderr. It refuses redirected or piped stdout/stderr, never forces ANSI, reports the
  detected stderr color level and relevant `FORCE_COLOR`, `TERM`, `CI`, `COLORTERM` and
  `TERM_PROGRAM` values, and warns when color support is unavailable.
- `--plain` runs one scenario with captured child streams, so the product takes its ordinary non-TTY
  path, then replays the complete plain stdout and stderr for comparison. It does not establish
  visual parity; existing deterministic style tests retain that automated responsibility.
- Every invocation creates a uniquely named `gitlode-p3-capture-*` directory directly under the OS
  temporary directory. The helper validates that ownership boundary before recursive cleanup. It
  reports the repository, config and JSONL output paths before an inherited run, removes the whole
  root after success or failure, aborts the child and cleans on SIGINT/SIGTERM as far as the Node
  process can guarantee, applies a 120-second child deadline, and surfaces nonzero exit/signal status.
  It never uses the historical `D:/gitlode_test` paths.

### Commands for the human operator

Run these exact PowerShell commands from the repository root after trunk has checked this handoff.
Do not pipe or redirect the three `--terminal` commands: doing so intentionally fails the TTY
precondition. First build the accepted source:

```powershell
npm run build:dev
```

Run each real-TTY scenario separately so it can be repeated after changing terminal theme or width:

```powershell
npx tsx packages/gitlode/scripts/capture-profile-evidence.ts --terminal commit
npx tsx packages/gitlode/scripts/capture-profile-evidence.ts --terminal file
npx tsx packages/gitlode/scripts/capture-profile-evidence.ts --terminal plugin
```

Use a normal non-TTY product run for a complete plain-text comparison; `commit` is the representative
comparison, and `file` or `plugin` may be substituted if a finding needs isolation:

```powershell
npx tsx packages/gitlode/scripts/capture-profile-evidence.ts --plain commit
```

Each command creates a deterministic five-commit repository. The file and plugin scenarios use
per-file extraction with two requested fixture files, and the plugin scenario has two deterministic
registrations. This is a small functional workload, not a performance measurement, although fixture
creation, the prerequisite build and child startup still take time. Current ordinary fixtures write
JSONL below the printed temporary `*-output` path, print the completion summary and Profile to
stderr, and normally leave product stdout empty. All temporary paths are removed when the helper
finishes, so they are destinations for the run rather than retained evidence.

Before treating a run as color evidence, read the helper's `stderr color support` line. In particular,
`FORCE_COLOR=0`/`false`, `TERM=dumb`, or CI/terminal capability detection can suppress color. The
helper reports rather than changes those settings. If it says color support is unavailable, record
that run as plain/readability evidence only and correct the ordinary terminal environment before a
color check; do not add flags that force ANSI.

### Human checklist

Use an ordinary terminal at the usual width with both a dark theme and a light theme, then narrow the
terminal enough to exercise natural wrapping. Record the terminal, theme, approximate width, exact
commands and the source/helper OIDs. For each applicable view, check that:

- `Profile`, Scope and namespace headings, ordinary names, values, keys, units and separators remain
  distinguishable and readable; unavailable markers and notifications, if present, make sense
  without depending on color;
- namespace indentation, attributes and the plugin Scope remain interpretable, and natural wrapping
  does not obscure which observation or attribute belongs to which target;
- ordinary progress/completion output and the Profile coexist without overwritten, joined or lost
  lines; and
- the complete `--plain` output retains the same information even though styling is absent.

The ordinary deterministic runs are not expected to contain unavailable values or collection/lifecycle
notifications. Do not mark those roles visually observed when absent. No synthetic warning sample was
added, and no product failure injection is authorized; existing formatter tests retain semantic and
styled/plain coverage for those cases.

### Human response template

```text
Human real-terminal confirmation: accepted | changes requested
Product/P3 source: c694b69cc964226ccbf07325ee45ab32b6ff2e74
Terminal helper: 68364da260fad438c7b88da75f7c7ea2bbe618a1
OS and terminal/version:
Theme(s): dark=..., light=...
Approximate widths: usual=..., narrow=...
Commands run: commit=..., file=..., plugin=..., plain=...

Readability and semantic roles:
Namespace/attribute/plugin association and wrapping:
Progress/completion/Profile coexistence:
Plain information comparison:
Observed problems: none | ...
Unobserved ordinary-fixture roles: unavailable marker; info/warning notification (adjust if observed)
Additional notes:
```

Human result: **PENDING**. Helper success, non-TTY output, automated parity, or elapsed time must not
be interpreted as acceptance.

### Preparation checks and limits

- `npm run build:dev`: passed before helper execution.
- Existing no-argument capture: commit, file and plugin fixtures all completed; stdout was empty and
  each expected Scope excerpt was found. Complete `--plain commit` also completed through the normal
  non-TTY product path.
- Failure reporting: `--terminal commit` under the non-TTY automation environment exited 1 with the
  direct-TTY requirement, and an invalid scenario exited 1 with usage. No owned capture directory
  remained after the rejected terminal run. Actual inherited-TTY execution was deliberately not
  attempted or claimed by automation.
- Explicit tooling check passed:
  `npx tsc --ignoreConfig --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck packages/gitlode/scripts/capture-profile-evidence.ts`.
- `npx oxlint packages/gitlode/scripts/capture-profile-evidence.ts`, `npm run format:write`,
  `npm run format:check` and `git diff --check` passed. No product suite, package/OS campaign or formal
  telemetry command was run because the change is confined to the bounded operator helper and handoff.

## CI correction status

The generic renderer's collector-to-presentation regression expectations and its contradictory
mixed-duration notice were corrected at
`d9e994cc28bc91b9ca86f3a3e6e798371ec85481`. Detailed evidence is kept in the implementation handoff.
This changes the source the human should eventually inspect, but does not constitute a real-terminal
observation or approval. Human light/dark, normal/narrow-width and plain-output confirmation remains
**changes requested** after the subsequent human light-background check. The correction is accepted;
the active styling packet governs the next trial and renewed visual confirmation.
