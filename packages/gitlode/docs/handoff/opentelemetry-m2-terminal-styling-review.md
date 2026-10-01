# M2 terminal styling: independent review

## Trunk R1 closure and next assignment ? 2026-10-01

R1 is **accepted** at `0256c71bc3e429c13e0dc0aa938514d87858fd1b`. Trunk inspected the entire
correction: only the two summary-test stubs changed to inherit plainStyling; callback overrides and
assertions remain intact, with no production changes. The delta to outcome checkpoint
`1e7d05215de678f7a8a9e0badd6f4008f0ff94a8` is documentation only. Trunk independently ran strict
TypeScript for summary-formatters/styling tests and those two Vitest files: 8/8 passed. The reported
first-attempt successful correction/outcome CI runs were not independently fetched during this closure.
The earlier independent review remains historical evidence; its sole required correction is closed.
Implementation review is accepted, not visual-environment, instability, cumulative M2 or release acceptance.

Next assign a human-started **bounded supervisor diagnosis**, not a repair session. Stay on
`feature/otel-redesign_M2_styling` for documentation delivery; use isolated Linux checkouts for probes.
Compare entry `76486d25870172528ce9af086ace756388b6c8d8` and observed failure source
`f0558856f018f24b5766d6ed8b5d241f9cb02747`. Begin from the saved attempt-2 failure and the detailed
hypothesis below. Record available Node/Git/kernel versions and differences from CI; do not provision
an exact historical environment without a demonstrated need.

Run only the named grandchild test, at most three attempts per source (six total), with a finite
outer deadline for each diagnostic invocation. Preserve the existing supervisor deadlines. Stop when
useful evidence is obtained; do not rerun until green. Capture PID/PPID/PGID and process-start identity,
TERM/KILL errors and timestamps, worker close, supervisor return and bounded post-return state history
(up to one second). Preserve raw logs and instrumentation patches under a new unique evidence directory
in D:/gitlode_test and/or the existing Linux evidence workspace; never overwrite previous archives.
Temporary probes must be identified separately from product source and restored. Own and clean only
processes/paths created for the probe. Do not run formal performance measurements or broad stress loads.

Distinguish delayed signal observation from a surviving owned descendant, wrong PID/group, or failed
signaling. Explain the consequence for the documented cleanup contract, not merely test timing.
Return supported cause or inconclusive, evidence paths/hashes, actual attempt counts, recommended
minimal correction and regression checks. No production/test fix, timeout relaxation, assertion
weakening, PR or parent-ref update is authorized. Append a concise outcome here, commit/normal push,
and return to trunk for a correction decision. Warn before Linux preparation/execution takes time.

Linux ENOTEMPTY, Windows timeout/EBUSY, the entry-existing Attributes typing issue, GNOME and shared
consumer visual gaps remain open separately. Do not infer harmlessness or closure from passing CI.
After supervisor triage, trunk assigns fixture-lifecycle diagnosis; the PR remains pending their
explicit disposition and the visual follow-up decisions. No new full-suite campaign is assigned here.

## Bounded supervisor diagnosis returned to trunk — 2026-10-01

**Inconclusive for the saved CI failure; no instability closure.** Started at
`c6aa33e2a63b5fc072aaef07b63de25e72aad111` on `feature/otel-redesign_M2_styling`, initially clean.
Compared isolated, detached Linux clones of entry `76486d25870172528ce9af086ace756388b6c8d8`
and failure source `f0558856f018f24b5766d6ed8b5d241f9cb02747`. Ran only
`kills an owned grandchild that ignores TERM when the worker exits first`, **one attempt per
source, two total**. Both passed (one selected test, 21 skipped per invocation); neither reproduced
post-return `R`. Stopped after obtaining the paired ownership/signal/termination traces, without
using the remaining allowance or retrying until green. This is diagnostic evidence, not formal
measurement, full-suite validation, or M2 acceptance.

### Environment and observation method

Re-fetched the saved attempt-2 job `110189713245` through the GitHub connector. Its decoded log
confirms the failure source, the named test's 395 ms failure, and expected `missing`/`Z` versus
observed `R`. It contains no PID identity or later state. CI used Ubuntu 24.04.5, Node 22.23.3,
Git 2.55.0; the actual CI kernel was not printed. Local probes used Ubuntu 26.04 LTS on WSL2,
kernel `6.18.33.1-microsoft-standard-WSL2`, Linux Node 22.23.1, npm 10.9.8, Git 2.53.0,
Vitest 4.1.10 and Linux-native checkout/temp storage. These were isolated tests, unlike the CI
suite's concurrent workload. No historical environment or extra workload was provisioned.
Dependencies were copied from the existing Linux `m1-corrected-20260914T061714Z-6fd46d3/source`
installation after byte-comparing its lockfile with both sources; no dependency install was run.
The supervisor, test, atomic-JSON helper, lockfile, and root/package Vitest configurations have
identical source hashes across the two pinned revisions. This establishes shared code, not that
the CI symptom was already observed at entry or that scheduling is unaffected by other changes.

Each invocation had a Python-enforced **20-second outer deadline**, with owned-process identity
checks for emergency cleanup; neither deadline fired. Existing preparation/execution/processing,
grace and cleanup deadlines remained 3000/150/150/80/500 ms. The temporary probe captured
monotonic/wall timestamps, raw `/proc/<pid>/stat`, PID/PPID/PGID/start ticks, IPC, signal success
or error, worker close, stop, supervisor return, and the original one-read assertion value.
It retained that value unchanged for the assertion and added an approximately one-second history
afterward (5 ms scheduled sampling; final timer wakeup can overshoot slightly). Fixture snapshots,
worker script and diagnostic logs were copied before the existing teardown removed the fixture.
The probe's synchronous reads and identity-log writes perturb scheduling and may mask a narrow
race; these instrumented passes do not exonerate the uninstrumented test.

### Evidence and cause confidence

Times below are milliseconds relative to the probe event immediately before group SIGKILL;
they bracket observations, not exact kernel signal-delivery times.

| Observation                             | Entry attempt 1               | Failure-source attempt 1      |
| --------------------------------------- | ----------------------------- | ----------------------------- |
| Worker / child PID; owned PGID          | 39349 / 39356; 39349          | 39439 / 39446; 39439          |
| Worker / child start ticks              | 131670852 / 131670855         | 131671968 / 131671971         |
| TERM call event; worker close (SIGTERM) | -80.838; -75.410              | -80.243; -75.964              |
| Child immediately before KILL           | S, original PGID/start        | S, original PGID/start        |
| KILL-success event; observed child      | +0.375; Z                     | +0.347; Z                     |
| Supervisor-return event; observed child | +1.845; Z                     | +1.643; Z                     |
| Original assertion observation          | +3.405; missing               | +3.236; missing               |
| Additional history samples              | 192, all ENOENT for both PIDs | 193, all ENOENT for both PIDs |

- **Delayed termination observation:** the missing descendant-completion barrier is supported with
  high confidence by shared source: the grace callback sends KILL and calls `stop()` when worker
  exit is already known; the close handler after forced termination likewise observes only the
  worker. Final persistence adds incidental time, not a descendant barrier. Both local traces
  exercised the worker-first path, but neither caught post-KILL/post-return `R`; explaining the
  historical `R` as a transient terminating process remains a plausible, unproven hypothesis.
- **Surviving owned descendant:** the child survived TERM and worker close as intended, was Z at
  return, then absent throughout the sampled history. Final `/proc` group scans found no members
  of either owned PGID. No extra cleanup signal was necessary. There is no observed local survivor;
  the saved CI log cannot exclude one or establish its duration.
- **Wrong PID/group or PID reuse:** initial PPID equaled the worker, child PGID equaled the detached
  worker PID, and child start ticks/PGID stayed constant through KILL and Z. Reparenting after worker
  close changed PPID to 39265/39368, not PGID. The assertion selected that same child PID. These
  explanations are excluded for the two local traces, not for the unidentified historical CI PID.
- **Failed signaling:** both TERM and KILL calls returned without error, including KILL after the
  group leader had disappeared; both terminal snapshots have empty `cleanupErrors`. No ESRCH or
  other signal error was observed. Successful sending alone is not proof of descendant completion;
  the following Z/missing observations supply that evidence locally. CI signal results are unknown.

The [cleanup contract](../design/telemetry-performance.md#execution-supervision) includes owned
descendants after worker exit and places terminal persistence after cleanup. The implementation
does not establish their quiescence before returning. Therefore a transient `R`, if later confirmed,
would still expose a completion-contract gap; passing after a delay would not by itself make the
cleanup contract satisfied. This return does not reclassify the CI failure as harmless test timing.

### Proposed correction and regression checks for trunk's decision

Smallest supported correction direction: use the **existing** bounded cleanup budget after KILL
to observe both worker close and absence of live owned group members, including the worker-first
and normal-completion paths. Distinguish Z from running/sleeping members, retain PID/start/group
identity against reuse, and report inaccessible observation, signal errors, or deadline exhaustion
as cleanup uncertainty/failure in the terminal evidence. Child PIDs from IPC must remain diagnostic,
never arbitrary kill targets. Group `kill(..., 0)` alone cannot distinguish zombies. Do not repair
this solely by polling longer in the test, increasing deadlines, or accepting R in the assertion.
This is a proposal, not an implemented or proven fix for the saved failure.

Before accepting a correction, require deterministic tests of successful KILL followed by delayed
descendant quiescence, worker-first and worker-last close, a member live through the existing bound,
signal/observation failure, PID identity mismatch and zombies. Retain a bounded real-Linux test
with a TERM-ready grandchild, asserting no live owned descendant at supervisor return, unchanged
stage deadlines/exit classification, final cleanup evidence, and no signaling of unrelated groups.
Normal-completion descendant cleanup also needs coverage. None of those new tests or fixes was
introduced here; fixture-lifecycle diagnosis and all other open gates remain separate assignments.

### Preserved artifacts and delivery scope

Evidence root: `D:/gitlode_test/m2-supervisor-20261001-c6aa33e-7f3b`, mirrored under
`/home/t-wakabayashi/gitlode-performance/m2-supervisor-20261001-c6aa33e-7f3b`.
The Linux root additionally retains both restored, clean, detached checkouts. `entry-attempt-1/`
and `failure-attempt-1/` contain raw trace, identity ledger, exact command/outer deadline, Vitest
log, result/process audit, and copied fixture supervision JSON/diagnostic log. Root files contain
environment, source/restoration audit, instrumentation patches/helpers, preparation/run/analysis
scripts, decoded CI log, and the timeline summary. No previous archive was overwritten.

SHA-256 anchors (the manifest covers all delivered evidence files except itself and the checkouts):

- `SHA256SUMS`: `3ac167ef89ee65ca5540ebc3ee578982521a19114fbc6d1df87ca8572f22ad8e`
- `ci-attempt-2.log`: `6b28c11ef4374da428cfb5fd0e6bc0398cf533be7c543ccc689b9a613b736660`
- `entry-attempt-1/trace.json`: `fc580fa15ce313f1ca576ab88aa471023e86fe6254ca766dfa55647506d3c72f`
- `failure-attempt-1/trace.json`: `46f1f858e2618559269e358213d6829bc89bb39ba60a933e8d3f6221649b53b3`

Temporary instrumentation was restored and the helper removed in each isolated checkout; both
`git status --porcelain` outputs are empty. The return changes only this document. No permanent
production/test change, timeout/assertion change, formal measurement, PR, merge or parent-ref
update was performed. Documentation formatting/diff checks and the normal-push checkpoint are
reported in the final handoff; trunk retains the correction and acceptance decision.

## Independent result returned to trunk — 2026-10-01

**Corrections required.** One new validation blocker was independently reproduced (R1 below).
No additional production regression was found in the reviewed range and bounded checks. This is
not M2 acceptance, release acceptance, or approval of every terminal/shared consumer. No implementation
was changed. The original assignment is retained below as historical review context.

### Fixed source and checkout evidence

- Source: `feature/otel-redesign_M2_styling`; intended base: `feature/otel-redesign_M2_profile`.
- Entry and local/tracking/actual remote base: `76486d25870172528ce9af086ace756388b6c8d8`.
- Reviewed implementation: `f0558856f018f24b5766d6ed8b5d241f9cb02747`.
- Starting HEAD, local/tracking/actual remote source, and request checkpoint:
  `72a2b43eb10f36f83c03276ef4e735865235b2bf`.
- `merge-base(base, implementation)` equals entry; `merge-base(implementation, checkpoint)` equals
  implementation. The full entry→implementation diff contains 32 files; the subsequent checkpoint
  changes only this review document and the styling return packet (2 files, 99 insertions/2 deletions).
- One worktree, `C:/Users/t-wakabayashi/source/gitlode`, on the source branch, initially clean.
  No checkout, parent-ref update, PR, merge, branch deletion, or formal measurement was performed.
  Actual remote refs were read using `git ls-remote`, not inferred from tracking refs.
- Read root `AGENTS.md` (the only discovered AGENTS.md), both styling packets, CLI, telemetry,
  telemetry-verification, architecture/domain-design, profiling, relevant usage/build guidance, and
  the profile-view catalog. Reviewed the complete renderer extraction and consumer/test/doc delta,
  not just the cleanup commit.

### Required correction

**R1 — P2: update both summary-test Styling stubs for the new required role.**

Locations: `test/presentation/reporting/summary-formatters.test.ts:33` and `:82` (arguments built at
lines 8 and 57); contract: `src/presentation/styling.ts:14`.
Both changed object literals omit `attributeName`. Passing either to `formatSummaryLines` produces
TS2741 because the new `Styling` interface requires that method. This is introduced by the role
migration: the entry interface did not require `attributeName`. Runtime tests pass because summary
formatting never calls the missing method; the tooling project has `noCheck`, so ordinary build/CI
does not prove these modified tests typecheck. This is a validation blocker, not evidence of a
production summary-rendering crash.

Suggested correction: start each stub with `...plainStyling`, overriding only the roles under test,
or supply the missing identity method explicitly. Run strict checking of the changed presentation
tests and the summary/styling focused tests after correction. Do not weaken the required interface
or enable `noCheck` for the focused check. No correction was applied during this review.

The same broad strict invocation also reports TS2322 at `test/telemetry/local-collection.test.ts:69`:
the fixture supplies `Record<string, unknown>` where OTel metric `Attributes` is required. The entry
version of that file was temporarily materialized and independently typechecked against the same
installed dependencies; it produces the same error at line 69. This is a separately evidenced
entry-existing fixture typing issue, not R1 or proof about either intermittent CI failure. Trunk
should track it separately; the broad strict command is not green.

### Production review and optional improvements

- Shared consumers inspected: progress active/done lines and controller/runtime, completion summary,
  diagnostic warning/error lines and bootstrap/presenter paths, Profile, and success-report routing.
  Values and attribute names use separate undecorated roles; heading padding is shared by styled/plain
  factories; diagnostic severity and values do not select heading colors. No live old role calls remain.
- `renderProfile` and its collecting adapter share rendering. First-write interception closes active
  progress once, adds separation once, and leaves empty reports untouched. Synchronous renderer/sink
  failures propagate without replay; already written lines may remain. Tests and code agree with that
  contract. Preparation still allocates data; no measured performance claim is made.
- Flat depth 0 and optional depths 1/2/3/4/8 are covered. Name/kind/typed-point matching and diagnostic-only
  entries remain separate; scope grouping preserves null versus empty versions. Escaping happens before
  decoration, grouping uses raw identities, attributes precede namespace descendants, and sorting uses
  code-unit/complete-target comparisons. Same-name shared notices remain single notices, while point
  notices are matched to their typed point. No new loss, duplication, or ordering regression was found.
- Mixed valid/invalid durations in both orders, all-invalid duration, retained genuine zero, compacted
  diagnostic detail, lifecycle-only evidence, masks, and fixed fallback remain covered by the actual
  collector→builder→presentation/tooling tests and worker fallback transport. Average suppression and
  retained total/maximum behavior remain intact. These findings do not claim untested inputs are proven.
- Catalog default/constraint validation, depth roles, compact units, and canonical audience docs agree
  on the adopted behavior. Removed capture/preview helpers have no live source/script/package/CI
  references; remaining capture commands are in handoffs explicitly marked historical.
- Optional maintainability: `profile-data.ts:44,53` declares readonly properties containing mutable
  arrays (`IssueOnlyTarget.diagnostics`, `ScopeContext.rows`). Renderers currently do not mutate them,
  but `readonly ProfileDiagnostic[]` / `readonly ProfileMeasurement[]` would express the documented
  read-only rendering boundary more completely. This is not a demonstrated runtime defect.
- Optional coverage: most detailed identity/collision/diagnostic assertions deliberately use the
  retained depth-2 wrapper. Parameterizing selected identity and missing-target cases over depth 0
  and 2 would protect the new default directly. Existing flat/default/collector tests and independent
  probes passed; this suggestion is not a second blocker.

### Independent validation versus other evidence

All independent checks used the checkpoint worktree, whose production/test/configuration content
was verified identical to the implementation OID. This does not relabel implementation CI as
checkpoint CI.

| Evidence                                 | Result and scope                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Independent `npm run build:dev`          | Passed.                                                                                                                                                                                                                                                                                                                                          |
| Independent focused Vitest               | 14 files / 146 tests passed: all `test/presentation`, catalog-contract, local-collection, and worker-profile-fallback-transport. The invocation also named nonexistent `test/telemetry/runtime.test.ts`; it selected no file and provides no runtime-test evidence.                                                                              |
| Independent additional consumer checks   | worker-telemetry-session, profile-report-primitives, success-report: 3 files / 60 tests passed. Success-report overlaps the first selection; totals must not be summed as distinct coverage.                                                                                                                                                     |
| Independent architecture check           | Passed; Rev-dep reported 0 config errors and 1 config warning. No configuration was changed.                                                                                                                                                                                                                                                     |
| Independent focused oxlint               | Passed for presentation source/tests and changed catalog/collector tests/support.                                                                                                                                                                                                                                                                |
| Independent strict TypeScript            | Broad changed-test selection failed with R1 twice and the entry-existing collector fixture error. The remaining selection excluding those two files passed.                                                                                                                                                                                      |
| Independent finite differential probe    | Temporary copy of the 34-test formatter suite compared every invocation of its depth-2 helper with the entry renderer, adapting only old role names and the adopted number/unit spacing. All 34 tests passed. This is grouped plain-text correspondence, not proof of old/new color or default-layout equality.                                  |
| Independent finite shared-consumer probe | 1 test passed with Chalk level 1: ANSI-stripped active/done progress for all phases, multiline warn/error diagnostics, and Profile depths 0/1/2/4 preserve plain-factory text. Profile probe retained five measured rows/attributes including short, colliding, malformed and escaped names; depth-0 sink output equaled the collecting adapter. |
| Probe restoration                        | All temporary source/test files removed in `finally`; no implementation/test delta retained. No harness probe or repeated full-suite run.                                                                                                                                                                                                        |
| Saved Linux CI logs                      | All 3 job logs independently retrieved and inspected; exact checkout OID and results match the table below. Latest-attempt job metadata confirms successful release build, strict publint and installed-package steps.                                                                                                                           |
| Reported Windows full/package results    | The packet's 95 files / 1277 tests / 17 skipped and package results were not independently rerun. Earlier timeout/EBUSY remains packet-reported; no original Windows failure log was available in the checkout.                                                                                                                                  |

Strict reproduction from the repository root (the first file alone reproduces R1):

```powershell
npx tsc --ignoreConfig --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck packages/gitlode/test/presentation/reporting/summary-formatters.test.ts
```

The broad command used the same flags with `test/support/js-yaml.d.ts`, `test/support/telemetry-catalog.ts`,
`test/telemetry/{catalog-contract,local-collection}.test.ts`, and
`test/presentation/{styling,diagnostics,presenter,reporting/formatters,reporting/profile-view-drift,reporting/summary-formatters}.test.ts`
(paths expanded explicitly under `packages/gitlode`; braces here abbreviate the recorded file list).
Production build does full checking; tooling `noCheck` is explicitly documented in build-test-release.
No full suite, package verification, CI rerun, formal performance workflow or release gate execution
was added merely to repeat already saved evidence.

### Unresolved instability and bounded diagnosis for trunk

The two Linux failures below are independently verified from their saved job logs, not just the
request's descriptions. Each checked out `f0558856f018f24b5766d6ed8b5d241f9cb02747`; attempts 1/2
ended with 94 passed files, 1 failed file, 1293 passed tests and 1 failed test. Attempt 3 passed
95 files / 1294 tests and its package steps. All used Ubuntu 24.04.5 and Git 2.55.0; Node was
22.23.2 in attempt 1 and 22.23.3 in attempts 2/3. Thus the fixed source does not imply identical
runtime environments. Preserve that distinction in ENOTEMPTY reproduction; the log alone does not
establish a Node-version cause. Successful retry is confirmation of a successful run, not resolution
or causal exoneration.

1. **Attempt 1 / ENOTEMPTY:** the saved failure is removal of
   `/tmp/gitlode-release-acceptance-DNM8KB/.git/objects/pack` in the unknown/wrong-scope-check test.
   The fixture awaits `execFile` Git commands, creates several commits, then `afterEach` uses recursive
   `rm` without retry (`release-acceptance.test.ts:275-318,506`). The validator imports Node and the
   performance target inventory, not presentation; this test does not invoke the styled CLI. The
   changed renderer therefore has no identified direct execution path into this failure. Concurrent
   file creation by Git maintenance/descendants after a parent command completes, or a different
   fixture-lifecycle/filesystem race, are hypotheses consistent with ENOTEMPTY; the log does not
   identify the writer. Small fixture size and awaited commands do not themselves prove maintenance
   occurred. Changed tests/import work can alter parallel-suite scheduling and expose a race.
   **Bounded next assignment:** on Linux with the recorded versions, at most 3 attempts each at entry
   and implementation for this one test, first isolated and then under a fixed, recorded small
   concurrent workload if needed. Stop on first useful trace or the cap. Capture Git Trace2, effective
   maintenance/gc config, command/child close times, pack-directory mutations and writer PIDs; preserve
   failed fixture evidence before cleanup. Distinguish outstanding owned work from a filesystem race.
   Do not adopt an `rm` retry or blame styling before locating the writer; no harness fix is authorized here.
2. **Attempt 2 / grandchild state R:** `performance-supervisor.test.ts:202-228` reads `/proc/<pid>/stat`
   once after supervision returns. In `performance-supervisor.ts:203-216`, the grace callback sends
   group SIGKILL and immediately stops when worker exit was already seen; it does not wait for the
   grandchild to become absent/zombie. The close handler at lines 304-318 similarly observes worker
   close, not descendant completion. A signal-delivery/termination observation race is a concrete
   code-supported hypothesis, not yet a proven explanation for this PID. Wrong PID selection, process
   group ownership, or failed signaling also require exclusion. This test launches a synthetic Node
   worker, uses its own plain `[performance]` messages, and imports no styling renderer. Indirect
   scheduler/load effects remain possible. **Bounded next assignment:** at most 3 isolated runs per
   fixed entry/implementation on Linux; capture PID/PPID/PGID and process start identity, stage IPC,
   TERM/KILL/worker-close/return timestamps, signal errors, saved supervision JSON/diagnostic log, and
   a bounded post-return state trace (for example 1 second). Distinguish transient R→Z/missing from a
   surviving owned descendant or wrong PID. If no evidence within the cap, return inconclusive rather
   than rerunning the entire suite. Do not lengthen timeouts or change cleanup during this review.
3. **Earlier Windows timeout/EBUSY:** separate observation at the catalog-fix stage, known here only
   through the packet. The preceding failure's precise test/OID/process evidence must be recovered
   before attribution. Do not combine it with the fixed catalog validator bug, Linux ENOTEMPTY, or
   Linux R. A separate bounded Windows fixture-lifecycle diagnosis should capture the timed-out owner,
   cancellation/disposal sequence, pending child/worker work and file-handle owner. Its later successful
   full rerun is not a fix.

No process tree, pack-writer trace, or post-return state history is present in the retrieved CI logs;
these are the missing evidence, not a reason to assert the failures are pre-existing or harmless.
Trunk must retain both Linux observations and decide the follow-up gate before acceptance.

### Visual limits and remaining gates

Human approval remains limited to the recorded Profile trials in Windows Terminal 1.24.11911.0,
Campbell/Tango Light, Cascadia Mono. Independent ANSI/text checks are not visual contrast approval.
GNOME Tango dark/light are unobserved; WSL inside Windows Terminal does not fill that gap. Final
shared progress/done/warning/error/completion contrast, the earlier weak light-background yellow,
and exact terminal width/intensity settings remain unconfirmed. No VM or real repository was prepared.

Return gates: fix R1 and recheck the exact correction source; separately track the known collector
fixture type issue and unresolved lifecycle observations; obtain exact-source final CI and the
required human shared-consumer/terminal decisions. PR approval must explicitly name source/base;
human merge, post-squash correspondence and cumulative M2/release acceptance remain separate gates.
The adopted palette, flat layout and compact units are not reopened by this review.

This return changes only this document. Root `npm run format:write` and `npm run format:check`
both passed; `git diff --check` passed and the final delta remained documentation-only. Normal
checkpoint delivery and final local/tracking/actual-remote equality are recorded in the final handoff;
the checkpoint's own OID cannot be embedded in its own content.

## Original request: assignment and pinned scope

The following preserves the request at `72a2b43`; the independent result above supersedes its pending
review status, without granting M2 acceptance. Read the repository AGENTS.md and the
[return packet](opentelemetry-m2-terminal-styling-design.md) first.

- Source branch: `feature/otel-redesign_M2_styling`
- Intended return base: `feature/otel-redesign_M2_profile`
- Entry/base OID: `76486d25870172528ce9af086ace756388b6c8d8`
- Implementation review OID: `f0558856f018f24b5766d6ed8b5d241f9cb02747`
- Review the full entry-to-implementation diff, not just the final cleanup commit.
- This request and its return-packet update are a subsequent documentation-only delta. Record the
  actual documentation tip and verify that it introduces no production/test/configuration changes.
  Do not attribute the implementation OID's test results to a later OID without checking its delta.

Use an isolated checkout if necessary; preserve the human's worktree and all source refs. Review is
read-only: return findings and proposed corrections rather than silently changing the implementation.
No PR creation, publishing, merge, force push, base-ref update or branch deletion is authorized here.
Only the human merges; PR creation requires separate approval naming source and base.

## Review focus

Review against the adopted contracts, not against a new preferred palette. Start with
[CLI styling](../design/cli.md), [telemetry](../design/telemetry.md),
[verification](../design/telemetry-verification.md), [profiling](../profiling.md), and the
[profile view catalog](../design/telemetry-catalog/profile-view.yaml).

1. Shared styling and all consumers: role renames, independent attributeName, undecorated values,
   heading padding, ANSI-free output, completion/progress/diagnostics and Profile consistency.
2. `reporting/profile-*.ts` and presenter integration: streaming order, empty output, progress
   interruption, error propagation and collecting-adapter equivalence. Check for dropped, duplicated
   or misassociated measurements and diagnostics during preparation/rendering.
3. Flat default (`namespaceDepth: 0`) and retained optional grouping: depth bounds, short names,
   namespace/entry collisions, ordering and styles selected solely by display depth. h3/h4 apply to
   the first two levels below Scope; deeper levels are undecorated. Do not remove grouping.
4. Maintainability refactor: observation identity brand versus display strings, readonly inputs,
   helper responsibilities and comments. Verify the intended behavior preservation independently.
5. Tests/catalog/docs: coverage of flat and grouped output, catalog default/constraint validation,
   compact number-unit tokens, stale role references, and consistency of durable contracts.
6. Cleanup: deleted preview/capture helpers have no live consumers; historical commands are clearly
   archival. Maintained production parameters and regression tests must remain.

Human visual approval covers Profile in Windows Terminal 1.24.11911.0, Campbell/Tango Light,
Cascadia Mono. See the return packet for source checkpoints. It is not evidence for every shared
consumer or terminal. GNOME Tango dark/light remain unobserved; do not prepare a VM or reinterpret
WSL in Windows Terminal as a second renderer. Real repository selection belongs to the human.

## Validation evidence and instability to report to trunk

At the implementation review OID, Windows root tests passed 95 files / 1277 tests with 17 skipped.
Format, dependency consistency, lint, architecture, schema, release build, strict publint and the
installed-package tests passed. Initial package validation required a permissions retry after
sandbox npm-cache EPERM; that was not a package assertion failure.

[GitHub Actions run 36805528460](https://github.com/gitlode/gitlode/actions/runs/36805528460)
tested the same implementation OID on all three attempts:

| Attempt | Job                                                                                          | Result                                                                                                                                                                         |
| ------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1       | [110188893375](https://github.com/gitlode/gitlode/actions/runs/36805528460/job/110188893375) | `release-acceptance.test.ts`, `rejects unknown and wrong-scope checks`: `ENOTEMPTY` removing `/tmp/gitlode-release-acceptance-DNM8KB/.git/objects/pack` during fixture cleanup |
| 2       | [110189713245](https://github.com/gitlode/gitlode/actions/runs/36805528460/job/110189713245) | `performance-supervisor.test.ts`, `kills an owned grandchild that ignores TERM when the worker exits first`: expected process state `missing` or `Z`, observed `R` at line 228 |
| 3       | [110190206529](https://github.com/gitlode/gitlode/actions/runs/36805528460/job/110190206529) | All 95 files / 1294 tests passed; release build, strict publint and installed-package tests passed                                                                             |

**Trunk must retain these two failures as unresolved observations discovered in this styling
session. Whether this session's changes caused or contributed to them is unknown.** The two test
files were not changed in the entry-to-implementation diff, but that alone does not establish absence
of an indirect regression. Unchanged-source retries passed; neither a root cause nor a fix has been
established. Do not describe these as resolved, proven pre-existing, or harmless.

The earlier Windows run at the catalog-fix stage also encountered a repository-fixture timeout
and EBUSY cleanup before a full rerun passed, as recorded in the return packet. This is separate
from the catalog validator defect, which was fixed and confirmed by the human.

Trunk should track the instability and decide whether focused Linux reproduction and process/fixture
lifecycle investigation is needed before acceptance. The reviewer should assess possible coupling to
this diff and flag concrete evidence; do not silently broaden the styling review into performance
harness or release-acceptance redesign. A successful retry does not replace this follow-up.

## Expected review response and next steps

Return the exact reviewed OIDs, checks actually run, and findings ordered by severity with file/line,
trigger, impact and a concrete suggested correction. Distinguish correctness findings from optional
maintenance suggestions, visual evidence gaps and unresolved test instability. If there are no
blocking findings, say so explicitly without declaring M2/release accepted.

Trunk owns triage and any bounded correction assignment. Changed production code requires renewed
relevant verification and exact-source CI; visible changes may require another human display check.
After independent review, green final CI and human acceptance, trunk may prepare the explicit
source/base PR approval request. Post-squash content correspondence and cumulative M2 acceptance
remain separate steps. Preserve the styling branch.
