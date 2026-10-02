# M2 styling: accepted review and remaining observations

## Current disposition ? 2026-10-02

Styling implementation review and required corrections are accepted. Independent review of
`f0558856f018f24b5766d6ed8b5d241f9cb02747` found one mandatory test-stub typing defect, fixed at
`0256c71bc3e429c13e0dc0aa938514d87858fd1b`; trunk independently verified strict typing and 8 tests.
Production behavior did not change in that fix. Supervisor cleanup correction
`97cab518ddd77667e56010ca1d902ded0f309c8d` is independently accepted at
`68daa1f1656eb02ec8f31c226ce4a274e295371d`: Linux 40/40, observer probes 4/4, build/strict checks,
saved entrypoint evidence and exact-source CI were checked. Historical CI R causation remains unknown.

Full completed review/probe narratives are preserved in this file at
`9fc0ee9c80858ca14e7cabd019421614c94fe9cf`; they are not active assignments. Keep this concise acceptance
mapping and the unresolved observations below until cumulative acceptance and final risk disposition.
The correction's immutable evidence is under
`/home/t-wakabayashi/gitlode-performance/m2-cleanup-20261001-c53206a` (76-file pre-CI manifest anchor
`ed01f92ffdd4f8b9da96f4aa41d68c0b62223d3250af801d96c805591c56e480`). Independent Linux review evidence
is under `/home/t-wakabayashi/gitlode-performance/m2-cleanup-review-20261001`.

Implementation and delivery CI for `97cab518` / `bdb929c5` passed on attempt 1:
[implementation](https://github.com/gitlode/gitlode/actions/runs/36831779393),
[delivery](https://github.com/gitlode/gitlode/actions/runs/36832084738).
This is not new evidence for a later source or final M2 candidate.

The human confirmed existing visual work is sufficient for styling integration; no additional sample
check is required. GNOME remains a pre-release obligation, not a claim of verified support. Preserve
recorded visual limits in the styling return. The existing Attributes typing issue is separate.
No new instability correction is justified by the investigations below; stop active diagnosis and
preserve recurrence evidence during ordinary validation. Required release gates remain unchanged.

## Bounded existing Windows timeout/EBUSY evidence review — 2026-10-02

**Inconclusive; original Windows failure log not found within the authorized scope.** Entry was
`ae59da12e4ef155c25e662a1b4c196b6ca4804c5` on `feature/otel-redesign_M2_styling`, clean, with
local/tracking/actual remote equality. No implementation change or new test invocation was made.

| Classification                  | Evidence and limits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmed document/source facts | The return packet's “Verification and remaining return steps” reports the event; this review already records that the original Windows failure log was unavailable. The report first appears in the packet rewrite at `f0558856f018f24b5766d6ed8b5d241f9cb02747`. Catalog correction `8123fb5b61f25398e713f4f0c94d71e7f7d5e86f` changes only `test/support/telemetry-catalog.ts`, `test/telemetry/catalog-contract.test.ts` and `test/presentation/reporting/profile-view-drift.test.ts` under `packages/gitlode`. Its diff corrects obsolete fixed-depth validation, not fixture cancellation or cleanup. |
| Report only                     | At the catalog-fix stage, one preceding Windows run encountered a 5-second repository-fixture timeout and EBUSY cleanup; a subsequent root `npm test` passed 95 files / 1277 tests / 17 skipped. “Transient” and “isolated full rerun” are the packet's descriptions, not independently established lifecycle facts. The packet also reports removal of owned failed-run temporary directories without identifying them.                                                                                                                                                                                   |
| Unknown                         | Original failing test file/name, execution OID and dirty-tree state, exact command/arguments/cwd, timeout type/configuration, exit code, EBUSY syscall/path/stack, timestamped timeout-to-cleanup order, fixture creator/users, cleanup owner/target, and cancellation/disposal/child completion are unavailable. The successful run's association with `8123fb5` and `npm test` does not establish the failed run's source or command.                                                                                                                                                                    |

### Search boundary and log/source/test correspondence

Read both named styling handoffs, searched `packages/gitlode/docs/handoff/` for the reported event,
and inspected related styling history from `76486d2` through entry, including packet history and
the catalog correction diff. Evidence inspection was limited to the explicitly named roots:

- `D:/gitlode_test/m2-fixture-20261002-68daa1f` and
  `D:/gitlode_test/m2-supervisor-20261001-c6aa33e-7f3b`: inspected artifact filenames and searched
  saved log/text/JSON/manifest evidence, excluding dependency and retained checkout trees.
- `/home/t-wakabayashi/gitlode-performance/m2-cleanup-review-20261001` and
  `/home/t-wakabayashi/gitlode-performance/m2-cleanup-20261001-c53206a`: confirmed both exist and
  searched saved log/text/JSON files for EBUSY, `8123fb5` and repository-fixture references.
  The other two Linux roots are the documented mirrors of the inspected Windows roots.

None supplied the original Windows failure log or an identifiable reference to it. No machine-wide
search or unrelated evidence archive inspection followed. Thus Windows log → source → test mapping
cannot be established. In particular, no evidence shows a fixture user still running after timeout,
or attributes a handle, writer or cleanup operation to a specific owner. No test/source file is
assigned to this failure by guessing from a fixture pattern.

The saved Linux `ci-attempt-1.log` belongs to `f0558856f018f24b5766d6ed8b5d241f9cb02747` and
`release-acceptance.test.ts` / `rejects unknown and wrong-scope checks` (ENOTEMPTY); the saved
supervisor `ci-attempt-2.log` belongs to that same source and `performance-supervisor.test.ts` /
`kills an owned grandchild that ignores TERM when the worker exits first` (observed R). Their
correspondence is recorded in the preceding diagnoses. Neither is the Windows timeout/EBUSY log.
The catalog validator correction and accepted supervisor correction remain separate; subsequent
successful logs supply no missing Windows failure facts.

**No concrete implementation defect or correction is supported by this bounded review.** This
does not establish harmlessness, pre-existence, cause, resolution or M2/release acceptance. Stop
the evidence search here and retain the Windows observation as unresolved.

### Preserve if the next ordinary validation encounters the event

Save the complete unedited stdout/stderr from command start through runner exit, with timestamps,
exact command/arguments/cwd, source OID and dirty diff, test file/full name, runner version/config,
timeout value/type, exit code, Windows/Node/Git versions and fixture filesystem/path. Preserve both
the timeout and EBUSY stacks, syscall and target path. Retain existing cancellation/disposal,
fixture creation/cleanup start/end and child/worker spawn/exit/close records, with PID/PPID and
identity/timestamps. If available at failure, save handle-owner/process observations and pending
work after timeout; absence of such records must remain explicit. Preserve the failed fixture and
its ownership record when safely possible, rather than deleting evidence or killing unrelated
processes. This is a capture checklist for recurrence during normal verification, not authorization
for a reproduction campaign, instrumentation change or retry-until-success.

Delivery changes only this review document. Root format:write/check and diff checks are performed
before its documentation checkpoint and normal push; final OID/ref equality and clean status are
returned separately. No full suite, load test, formal measurement, PR, merge, parent-ref update or
closure of unresolved matters is included.

## Bounded release fixture ENOTEMPTY diagnosis returned to trunk — 2026-10-02

**Inconclusive; ENOTEMPTY was not reproduced.** Started clean at
`68daa1f1656eb02ec8f31c226ce4a274e295371d` on `feature/otel-redesign_M2_styling`, with
local/tracking/actual remote equality. The accepted supervisor correction remains closed.
This diagnosis supplies no fixture correction, instability closure, M2 or release acceptance.

Independently retrieved the decoded saved
[attempt-1 job log](https://github.com/gitlode/gitlode/actions/runs/36805528460/job/110188893375):
checkout `f0558856f018f24b5766d6ed8b5d241f9cb02747`, Node 22.23.2, Git 2.55.0,
Ubuntu 24.04.5; the named unknown/wrong-scope test fails with ENOTEMPTY at
`/tmp/gitlode-release-acceptance-DNM8KB/.git/objects/pack`. The log supplies neither writer
identity nor process/file timeline. The historical fixture itself is unavailable; no new failed
fixture existed to preserve. The probe would retain a partially deleted fixture on cleanup failure.

### Lifecycle, bounded runs and environment differences

Fixture creation tracks its `mkdtemp` path, awaits every `promisify(execFile)` Git call, and creates
five commits including the acceptance-record commit. The two validator calls await `symbolic-ref`
before rejecting the respective record during parsing; they do not reach revision/status checks.
`afterEach` restores environment stubs, drains the tracked directory list, and awaits `Promise.all`
of recursive/force `rm`, without retries. There is one fixture in this selected test. Awaited direct
Git completion does not establish descendant completion. The selected test and validator are
byte-identical between the two sources; this does not exclude scheduling effects in the full CI suite.

New detached clones compared entry `76486d25870172528ce9af086ace756388b6c8d8` and failure
`f0558856f018f24b5766d6ed8b5d241f9cb02747`. **Exactly 3 invocations per source, 6 total**;
each selected 1 passing test / 49 skipped, with a 45-second outer deadline. Rounds 1/2 were isolated;
round 3 added exactly one Python SHA-256 loop over a fixed 1 MiB buffer, bounded to 45 seconds and
terminated after test return plus the one-second process observation. This workload was defined
before execution; it does not recreate CI's concurrent suites. No deadline fired; outer test
durations were 0.72–0.79 seconds. No additional invocation or full-suite retry followed.

Available Linux: Ubuntu 26.04, WSL2 kernel `6.18.33.1-microsoft-standard-WSL2`, Node **22.23.1**,
Git **2.53.0**, Vitest 4.1.10. Checkouts/evidence were on ext4; fixtures were on **tmpfs `/tmp`**.
Dependencies were reused through temporary symlinks after byte-equal lockfile verification.
CI's Node/Git/OS differ, and its kernel, fixture filesystem and effective maintenance config are
unknown from this log. No historical toolchain reconstruction was attempted. Effective local
system/global Git config was empty; no `maintenance.*`/`gc.*` override or Git-config environment
override was present. Each fixture's recorded config contains only core defaults and test user
identity; command arguments add `safe.directory`. Built-in defaults remain operative: absence of
configuration does not mean maintenance is disabled. No permanent Git configuration was changed.

### Process/file evidence and observation limits

- Every invocation records **five** `git maintenance run --auto --no-quiet --detach` children,
  following the five commits. Trace2 captures detach regions and launcher `child_exit` PID/code 0.
  Thus automatic maintenance launch is observed locally, rather than inferred from small fixture
  size. There are no maintenance task regions or nested task commands in these traces, and no
  observed pack-file creation. Launch/detach alone does not establish a pack-writing job or explain CI.
- Git command starts, exit/atexit and maintenance child events are timestamped. Latest recorded Git
  atexit precedes cleanup start by **1.50–2.53 ms** across the six runs. At cleanup start, each pack
  directory is empty. Recursive `fs.watch` reports only its initial directory creation and cleanup
  deletion (ENOENT afterward), with no watcher errors. These observations show no local post-command
  pack write; filesystem event delivery time is not the mutation syscall time.
- `/proc` observations record PID/PPID/PGID/start/state/cmdline/cwd for discovered descendants,
  nominally every 10 ms plus one second after runner return. No observed owned live process remained
  at the final observation. Short-lived/detached processes can escape discovery; the ledger is not
  exhaustive. Trace2's launcher PIDs and inherited session IDs do not identify every detached fork.
  No writer PID was attributable because no pack mutation was reproduced. `strace`, `inotifywait`
  and `bpftrace` were unavailable; no kernel writer attribution was collected.
- **Instrumentation gap:** attempted Node command/child-close wrapping was bypassed by `execFile`'s
  own `util.promisify.custom`, whose captured original function is retained by the wrapper. There
  are zero Node child-close records; no extra run was used to repair this gap after the six-run cap.
  Saved Node source confirms the callback resolves from its close-handler path, but that is code
  evidence, not measured close times. Git Trace2 atexit/child_exit must not be presented as Node close
  or complete descendant quiescence. The cleanup wrapper/watch instrumentation did operate.
- Trace2 writes, synchronous JSONL appends/config snapshots, recursive watch registration and process
  scans can shift scheduling; the fixed CPU worker also shifts scheduling. Watch events may coalesce,
  scans can miss short-lived/reparented work, and non-observed writers are not excluded. Both CI
  full-suite concurrency and the Node/Git/filesystem differences remain material uncertainty.

No implementation fix is justified by this evidence. If a future writer trace establishes detached
automatic maintenance as the owner, the smallest candidate is fixture-local/per-command suppression
of automatic maintenance, covering every fixture Git entrypoint. If another lifecycle owner is
identified, await that owner's completion instead. A separately authorized correction must first
demonstrate the failing order, then verify cleanup after owner completion, no post-close pack writes,
and preservation of the existing assertions/error paths. An `rm` retry, longer timeout or weakened
assertion would not resolve ownership. Next useful evidence is a corrected child-close probe and
kernel-level file/PID attribution under a bounded CI-like workload, with runtime/config/filesystem
recorded; this session's allowance is exhausted. Same-source rerun success does not close the risk.

### Evidence and documentation delivery

New evidence root: `/home/t-wakabayashi/gitlode-performance/m2-fixture-20261002-68daa1f`, mirrored
and hash-verified at `D:/gitlode_test/m2-fixture-20261002-68daa1f`. Created with exclusive directory
creation; previous evidence was untouched. `entry-{1,2,3}/` and `failure-{1,2,3}/` retain exact
commands/deadlines, Vitest logs, Trace2, fixture/pack/cleanup events, process ledgers and results.
Root artifacts retain the saved CI log, plan, probes/analysis, environment, source copies, maintenance
detail, timeline and restoration audit. Manifest covers **58 evidence files**, excluding itself and
the retained clean detached checkouts.

- `SHA256SUMS`: `c2200a2e067c0b0c3a06ef43ce4c25afed882d4d387c20ba43284c3340505c4e`
- `ci-attempt-1.log`: `b6f0b19b02e91229c9f2e2389db6c7dfe02dcf1254cef091f93019179889bdf0`
- `timeline.json`: `2a291c6e722a0acf746d5beecbc25c61b6ae36f433dae9e1557ab02b4f217e62`

Checkout sources were never edited; temporary dependency symlinks were removed and both checkouts
have empty porcelain status at their pinned OIDs. Successful tests removed their own fixtures;
the fixed workload was terminated/waited. Main-worktree temporary probes are removed at delivery.
Only this review document is returned, with documentation-only format:write/check and diff checks,
a checkpoint commit and normal push. Final local/tracking/actual remote equality and clean status
are reported with the delivery OID separately. Stay on the styling branch; trunk owns further
diagnosis/correction decisions. No Windows reproduction, Attributes/styling/display work, formal
measurement, PR, merge, parent-ref update or acceptance was performed.
