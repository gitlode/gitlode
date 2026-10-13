# Fixture CI correction before PR

## Active assignment: independent Windows ownership review (2026-10-13)

Implementation is delivered, not yet accepted. Review the COMPLETE change from
`4d985d5ddded8312f687dc4588f8b1470a218075` to fixed implementation
`b98bbe5fd5e17417ab610781d0c8f893a628aea9`, including first implementation `f0cb785`;
do not review only the final Unix correction. Outcome `1b97f90` is documentation-only.
Remain on `feature/otel-redesign_M2_fixture`, starting at this review packet's checkpoint.
Parent M2 `4f09265` and F2 refs `4ea24d5` remain fixed. GC acceptance is maintained.

1. Inspect the full 15-file diff against the authorized scope below. Verify Windows root worker
   policy applies to all projects, CLI overrides remain possible, and Linux defaults, existing
   assertions/deadlines/skips and product/formal measurement semantics are unchanged. Review the
   no-owner sidecar path, capture/provenance and supervisor notifications, not only injected tests.
2. Trace real cancellation through registered bodies, parallel I/O, child launch and both roots.
   Check creation/registration/abort races, no subsequent work after abort, absence of circular
   waits, bounded teardown, uncertain-close retention, normal cleanup failures and primary-error
   preservation. Confirm controlled regressions exercise actual Vitest timeout/teardown and the
   real shared sidecar. Expected nested failures must have meaningful passing outer assertions.
3. Review Windows process identity/tree observations and Unix private-group creation/termination.
   Kill success, promise rejection and leader close alone must not authorize unsafe disposal.
   Inspect the new owner-only spawn capture's error/close ordering, output bounds, decoding and
   rejection handling. Verify it cannot affect no-owner formal execution. Review the outer probe
   driver's own cleanup as well as the implementation, including the documented first-driver defect.
4. Independently run build, explicit fixture strict typing and the four affected suites on Windows
   and Linux where available: behavioral-baseline, repository-sidecar, fixture-lifecycle and
   fixture-timeout-ownership. Use bounded probes only for concrete uncovered concerns; restore
   mutations. Inspect saved old-behavior sensitivity/restoration evidence. Do not repeat complete
   OS/package campaigns without a new concrete reason. Failures must retain first evidence.
5. Rehash the 160-member archive and manifest against the outcome's identities. Inspect complete
   first/final Windows and Linux logs, source/clean bindings, policy probes and CI at fixed SHA.
   Check final CI 38367236232 attempt 1 and actual source/release/package execution; distinguish
   independent execution, saved logs, live metadata and reported-only evidence.
6. Assess Volta PATH correction explicitly: binary identity, resolved Node/npm versions, scope and
   reproducibility. Plain npm test succeeded in a corrected invocation environment; do not imply
   an unmodified Volta environment passed. Determine whether contributor guidance sufficiently
   describes a supported executable setup or a concrete unresolved default-command issue remains.
   Preserve initial ENOENT, Unix ESRCH and historic unrestricted Windows failures separately.

Return accepted/corrections-required for this ownership/policy slice, concrete failure paths and
remaining operational limits, plus whether the Windows PR-readiness obligation is satisfied.
One passing supported-policy campaign does not prove all historical flakiness resolved. No broad
process-framework redesign or speculative hardening is requested. Append review here, update only
necessary routing, format write/check and diff check, documentation-only commit/normal push and
actual remote/clean/parent/F2 checks. Do not repair implementation, create PR, merge, freeze, qualify,
measure formally or update acceptance. Trunk decides subsequent integration preparation.

## Historical assignment: Windows concurrency and timeout ownership (2026-10-13)

Trunk accepts the GC correction at `b002584` on the independent review delivered at
`6559570896f04a3df6074637fc579d124541ff81`. PR readiness remains blocked. The assignments below
this section are historical. This packet authorizes implementation, not PR creation or integration.

### Decision and boundaries

- Adopt Windows root Vitest `maxWorkers: 2` as the supported default, retaining Linux defaults,
  existing explicit CLI overrides, all suites/assertions and existing test deadlines. This is an
  intentional resource policy, not proof that unrestricted concurrency was repaired. Confirm the
  setting actually applies to the workspace projects and document it in build/test contributor guidance.
- Separately fix cancellation/cleanup ownership in the three affected test paths: behavioral baseline,
  repository sidecar and fixture lifecycle C2. Lower concurrency alone does not close the lifetime gap.
- Work on `feature/otel-redesign_M2_fixture`, starting at this packet's documentation checkpoint.
  Parent M2 stays `4f09265791c82452a5800cc6d9855938bf88a46e`; F2 refs stay `4ea24d5`.
  Keep GC/C1/C2/C3 acceptance and formal fixture/measurement semantics unchanged.

### Bounded implementation

1. Read the independent review below and affected test/support code. Record the ownership path from
   Vitest cancellation through Git/CLI child close, outstanding filesystem work and root disposal.
   Prefer narrow test-owned wrappers and optional cancellation seams. Do not build a general process
   framework. The invocation-local sidecar seam below is now authorized; return before broadening
   shared formal behavior beyond that scope.
2. Consume the test cancellation signal; prevent subsequent fixture operations after cancellation.
   Terminate only demonstrably owned active children, including descendants where applicable on
   Windows. Await child close and outstanding async body/filesystem settlement before deleting roots.
   An abort request or successful kill call alone does not establish quiescence. Use a bounded wait;
   if quiescence cannot be established, retain the owned root and report the limitation without deleting
   it. Preserve the primary failure and secondary cleanup diagnostics; diagnostic failure must not
   replace the primary exception. Do not delete historical leftover roots whose ownership is unknown.
3. Add finite regressions using the actual Vitest timeout/teardown boundary and controlled owned
   work. Demonstrate failure before correction and success afterward: no premature root deletion,
   no new work after cancellation, child/body settlement before successful cleanup, and retained
   evidence when termination cannot be confirmed. Cover Windows behavior, normal completion and
   primary-error preservation. Expected nested timeout failures must be distinguished from outer failures.
4. Apply the Windows concurrency policy and contributor documentation. Keep timeout values, skips,
   product code, measurement thresholds, fixture recipe and release acceptance unchanged.

### Validation and delivery

Run focused affected suites, fixture strict typing, build, lint, format write/check and diff check.
After focused success, checkpoint the implementation and run plain root `npm test` once on Windows
at that fixed source with no CLI worker override. Record effective concurrency, toolchain, exact
command, source identity, complete first log and cleanup outcome. Run the affected Linux regression
suites; use ordinary fixed-SHA CI for the full Linux/release/package chain, without redundant package
campaigns. Preserve CI source identity and step execution, including skipped steps if any.

If the supported Windows default still fails, preserve the first failure with test/phase/owned-child
timings and stop for trunk disposition. Do not reduce concurrency again, raise deadlines, hide EBUSY,
or repeat the campaign until green. Correcting a deterministic operator setup error requires retaining
the first evidence and explaining the correction; unexplained product/integrity failures stop work.

Record outcome and evidence hashes here, distinguishing executed, archived and reported evidence.
Keep the historical Windows failures and separate Linux fake-duration observation unresolved unless
direct evidence closes them. Use implementation and documentation checkpoints, normal push, then
verify actual remote identity, clean status and unchanged parent/F2 refs. Remain on the child and
return for independent focused review. No PR, merge, freeze, qualification, formal measurement or
acceptance record update. Warn the human before the full test campaign that execution itself takes time.

## Trunk scope disposition and resumed implementation (2026-10-13)

Reviewed the source and the scope return at `46ce72009a66fdf37c9fbc30c4b4a795439b9e5a`.
The stop was correct: runRepositoryProfileSidecar owns a private root and unconditionally removes
it in finally, beyond an outer test wrapper's control. Authorize the proposed optional invocation-local
ownership seam in `scripts/telemetry-performance.ts`, and narrow optional cancellation support in
fixture helpers required by the three assigned test paths. Resume the existing implementation packet
on the same child from this disposition's documentation checkpoint; this is not implementation acceptance.

Scope and required invariants:

- The owner is supplied explicitly by tests, with no global registry, environment switch, dependency
  on Vitest in shared tooling, or public product API. Register the private root immediately after
  creation, including the cancellation-during-creation case. Register child ownership at launch,
  before awaiting completion; keep the existing supervisor PID notification.
- Cancellation gates subsequent preparation, process launch and result I/O. Already-started I/O
  must settle before disposal. Keep result/capture parsing and provenance shared; do not substitute
  fake successful captures or duplicate the sidecar implementation in tests.
- Specify which layer owns final disposal. Avoid a circular wait: an inner finally must not await
  the outer operation whose completion depends on that finally. If disposal is delegated to the test
  owner, suppress inner removal only for that explicit ownership mode, and let outer teardown await
  registered work before removing both roots. Handle registration failure without unsafe deletion.
- Child abort/rejection and successful kill requests are not proof of process-tree quiescence.
  Bounded unconfirmed termination retains both roots and secondary diagnostics; cancellation cannot
  become an accepted capture. Preserve primary errors even if cleanup or reporting fails.
- Calls omitting the seam retain their existing execution, capture/provenance, supervisor reporting
  and cleanup contract. No changes to timed sampling, fixture recipe, formal thresholds, eligibility,
  adoption or release acceptance. No general repair of the formal supervisor is authorized here.
  The changed shared file is a new harness revision to review and preserve later, not the old frozen
  harness; existing F2 refs/artifacts remain immutable.

In addition to the active packet's tests, verify no-owner normal and error paths, owner normal disposal,
real timeout cancellation with internal-root retention/disposal, and bounded completion without a
cyclic wait. Keep existing repository-sidecar assertions and prove the real shared function uses the
owner (not only a standalone helper test). Check that formal call sites omit the seam. Document the
optional tooling ownership boundary in the contributor harness guide. No formal workload is needed.

All previous stop/validation/delivery rules remain. Complete the Windows policy and other affected
test lifetimes in this bounded session, then return for independent focused review. Windows default
tests, EBUSY and PR readiness remain unresolved until that evidence is available.

## Windows ownership implementation (2026-10-13; pending independent focused review)

Resumed from clean `4d985d5ddded8312f687dc4588f8b1470a218075` on the assigned child. The root
Windows policy is `maxWorkers: 2`; Linux configuration, CLI overrides, existing tests/assertions
and deadlines remain unchanged. A resolved Vitest 4.1.10 configuration probe observes all ten
workspace projects falling back to root 2 on this 24-available-processor host, and an explicit
option override resolving all ten to 3. This probe is configuration evidence, not a claim about
simultaneously active workers. The fixed-source ordinary Windows campaign is recorded below after
execution; the historical unrestricted Windows failures remain historical evidence.

Ownership path: the actual test context signal cancels an invocation-local `TestFixtureOwner`.
The owner registers the whole body, each fixture I/O operation, temporary roots and each Git/Node
child before awaiting its result. The three test paths use it explicitly. Gates prevent later
fixture operations after cancellation; already-started body and I/O promises remain registered
even if another parallel operation rejects. Git helpers retain their environment, foreground
flags and recipe. The sidecar retains shared capture/provenance parsing and supervisor PID
notification, registering its private root even when creation overlaps cancellation. Only explicit
owner mode delegates final disposal to outer teardown; the inner finally does not await its body.
No-owner normal/error cleanup remains covered, including an actual successful built worker capture.

Cancellation observes and terminates only owned active Windows trees, then requires child close,
post-termination identity/descendant observation and body/I/O settlement before removal. Linux owned
launches use private groups and require their disappearance. Missing observation/close, registration
failure or the bounded barrier retaining uncertainty prevents disposal and reports secondary
diagnostics without replacing the primary error. C2 uses separate invocation roots; an unconfirmed
C2 body also retains the shared source root. Normal teardown cleanup failure is an outer failure.
This narrow tooling seam is not a formal supervisor repair or a frozen harness revision.

Finite regressions use actual nested Vitest 1,500 ms timeouts with controlled descendants, pending
I/O and the real shared sidecar, including both-root retention under a controlled unavailable close.
Expected nested timeout errors are required; outer assertions and hook failures remain failures.
Additional checks cover actual baseline/C2 helper cancellation, parallel rejection settlement,
normal owner/no-owner disposal, creation cancellation and primary-error preservation during failed
registration/reporting. Sensitivity mutations restore the prior unsafe deletion order, omit the
cancellation gate, and restore unconditional inner sidecar removal: each fails its outer regression
with the relevant premature-deletion, post-cancellation-operation or internal-root-retention
assertion. Mutation bytes and restoration hashes are recorded in `sensitivity.json`. These are
finite old-behavior controls, not full campaigns at the original checkpoint.

The first sandbox timeout regression is retained in `timeout-first.log`: Windows CIM process
observation was denied to `CodexSandboxOffline`, correctly causing retention rather than deletion.
This is a deterministic operator setup limitation, not supported-default campaign evidence. A
read-only probe confirms CIM observation is available to the ordinary user; the subsequent Windows
regressions run there. Read-only exact-path inspection after runner exit found no process referring
to the two newly retained test roots/private sidecar root. Those roots are not broadly deleted.
Earlier historical residue, Windows latency attribution and the unrelated Linux fake-duration
observation are not reclassified or repaired here.

Implementation/checkpoint, finite validation, first complete default-command log, Linux fixed-source
CI, archive hashes and delivery identity are recorded in the outcome section below. No independent
review, PR, merge, freeze, formal workload, qualification, eligibility, adoption or acceptance update
has occurred in this implementation session. Parent M2 and F2 refs/artifacts remain immutable.

### First implementation validation and Unix owned-launch correction

First implementation checkpoint: `f0cb78550f48583853adb12f84efd9c514ef65ab`, tree
`f19639734dda138779804506dee3cb52dee62d91`. Focused Windows: 4 files, 44 passed/3 existing skips;
strict typing, development build, lint, format write/check and diff check passed.

The first fixed-source plain root `npm test` returned 10 failures, all in the unchanged
`performance-workflow.test.ts` paths, with `spawn npm ENOENT` during npm-version fingerprinting.
It had 99 passed files, 1,339 passed/39 skipped tests, no deadline or EBUSY failure, and unchanged
clean source before/after (189.44 seconds). The complete log/binding are `windows-default-first.log`
and `windows-default-binding.json`; this failed execution is retained, not reclassified as success.

A finite diagnostic test through the same npm lifecycle reproduces the environment defect: Volta
removes its standard shim directories from worker PATH, leaving only `npm.cmd`; direct `execFile`
cannot launch it. A byte-identical existing Volta `npm.exe` copied into an invocation-local PATH
directory survives that sanitation and resolves npm 11.11.0 under the same Node 22.23.1. Saved
uncorrected/corrected worker and tsx-child PATH/result JSONs and `operator-path.json` establish this
operator setup correction. Source, deadlines, worker settings and toolchain versions did not change.
An earlier `npm exec node` diagnostic resolved a different cached Node and is explicitly excluded
from validation evidence; its JSON is retained as invalid diagnostic setup, not used by campaigns.

Under the packet's deterministic-operator-setup exception, one corrected fixed-source plain
`npm test` at clean `f0cb785` passed **100 files, 1,349 tests/39 existing skips**, 209.29 seconds.
It has no CLI worker override. Its complete log/binding are `windows-default-corrected.log` and
`windows-default-corrected-binding.json`. Expected nested timeouts have passing outer regressions;
confirmed body/I/O/child cleanup and controlled both-root retention are visible in their timelines.
Historical unrestricted Windows failures and unknown historical residue remain unresolved.

Linux fixed-source affected suites then exposed an implementation defect in the new explicit-owner
Unix launch: 45 passed/2 failed, namely the child and sidecar cancellation/disposal probes. Installed
Node 22's `execFile` implementation does not forward `detached` to `spawn`, so no private group was
created; cancellation got `kill ESRCH`, the child/body did not settle, and roots were retained rather
than unsafely removed. This is a real implementation failure, not an operator setup error or an
expected nested timeout. `linux-focused.log` preserves the first complete execution and PID/phase
timelines. The failing child/sidecar probes retain their uncertain roots. Inspection also found the
first sidecar-unconfirmed outer driver removed its roots after runner exit despite unconfirmed real
child termination. Its Linux retention/disposal result is invalid and is not claimed as success.
The final driver requires a recorded real child close AND positive tree/group termination confirmation
before disposing retained probe roots; no-PID stubs alone are settled by runner exit. Earlier logs
remain attributed to the original behavior, including this cleanup limitation.

The normal implementation push also ran [CI 38364609223](https://github.com/gitlode/gitlode/actions/runs/38364609223),
attempt 1/job 115186624497, at the exact first OID/tree: source tests had 99 passed files,
1,386 passed/2 failed tests with the same two `ESRCH` paths. Release build, publint, installed-package
test and post-Node step were skipped; checkout post-step executed. Full decoded job log and live
run/attempt-one job metadata are saved as `ci-first-*`; no rerun of that attempt is requested.

The direct correction uses a private, bounded UTF-8 `spawn` capture only for explicit Unix fixture
owners, where `detached: true` actually establishes the owned group. Sidecar owner calls share that
launch while retaining shared result/provenance parsing and the existing supervisor PID notification.
Windows and no-owner calls retain `execFile`; formal call sites still omit the seam. No thresholds,
test deadlines, formal sampling or supervisor behavior changes. A two-file Linux overlay at the
first Git OID passes the 11 timeout/ownership tests; its exact overlay hashes and log are saved as
`linux-unix-fix-overlay.*`. This is content-bound finite evidence, not a clean final-OID campaign.
The corrected clean checkpoint and final fixed-source validation are recorded below.

### Final outcome checkpoint: independent focused review pending (2026-10-13)

Final implementation: **`b98bbe5fd5e17417ab610781d0c8f893a628aea9`**, tree
**`24f62e65df37dd13f784f8fe113a47fb3c85b663`**. The first implementation/failure checkpoint
`f0cb785` remains preserved. The Unix correction and stronger real-child disposal assertions are
new source, which justified final validation at this new checkpoint; no worker-policy reduction,
deadline increase, skip or automatic until-green retry was used.

Executed local validation:

- Windows final clean fixed-OID **plain root `npm test`**, no CLI worker override: **100 files,
  1,349 passed/39 existing skips**, exit 0, **206.03 seconds**. Node 22.23.1, npm 11.11.0,
  Git 2.45.1.windows.1, Windows 10.0.26200, 24 available processors. The documented invocation-local
  Volta executable PATH correction is retained; its binary SHA-256 is
  `7b648c48ba1473baa724d1cecf9df16e36ca12c768977d72745032349368953f`, identical to the installed shim.
  `windows-default-final-binding.json` records the exact command, environment correction, version,
  OID/tree and clean status before AND after execution. Root policy is Windows 2; the all-ten-project
  resolved configuration and explicit-option override probes are saved as `policy*.json`.
- Linux final clean fixed-OID checkout `/tmp/gitlode-windows-ownership-f0cb785` now actually holds
  `b98bbe5`/the final tree: **4 affected files/47 tests passed**, **15.93 seconds**, exit 0.
  `linux-final-fixed.log` includes exact commands, before/after OID/tree/clean checks, development
  build and explicit fixture strict typing. It uses existing Linux-native Node 22.23.1/npm 10.9.8,
  Git 2.53.0 and copied installed dependencies; the reusable preserved Node bytes were not modified.
  Linux root concurrency defaults remain unchanged. The earlier two-/four-file overlays remain
  separately content-bound evidence; they are not substituted for this fixed-OID execution.
- Windows affected suites at the first checkpoint passed 44/3 existing skips, and the corrected
  actual-timeout suite passed all 11 tests, including real close/tree confirmation before outer
  disposal. Final root Windows and CI execution also cover all these assertions. Strict fixture
  typing, development build, root lint, format write/check and diff check passed; CI independently
  executes the broader repository checks. Nested intentional timeout failures are distinct from
  their passing outer regressions. Three earlier finite old-behavior mutations each failed and
  restored their exact original bytes, as recorded in `sensitivity.json`.

Normal final implementation push ran
[CI 38367236232](https://github.com/gitlode/gitlode/actions/runs/38367236232), **attempt 1**,
job **115195172971**, at the exact final OID/tree. Live run and attempt-one job metadata report
**success**. The complete decoded job log shows the actual checkout, Git 2.55.0,
Node 22.23.3/npm 10.9.9, **100 files/1,388 source tests passed**, then actual successful release
build, strict publint/packed metadata and installed-package system test execution. Every recorded
step, including post steps, completed successfully; none was skipped. No CI rerun was requested.
The installed tarball SHA-256 is unchanged:
`e4d37c208cd6e6dba3ab887efa097e9c096ec97c41611a4ff8047732a845af45`.
This is ordinary functional CI/package evidence, not formal measurement or acceptance.

Archived evidence: **`D:/gitlode_test/windows-ownership-20261013-b98bbe5`**, **160 members**,
each copy byte-counted and SHA-256 verified against its original. Manifest SHA-256:
**`452cf60d1d536d8887148c30c6008be8901c7a738599eb635ff9844746cf730b`**;
`manifest.sha256` pins those exact manifest bytes. The archive includes complete first and final
logs, failed first CI plus its skipped-step metadata, both fixed-source tar archives, mutation
source/restoration hashes, command/exit/source bindings and the invocation-local operator shim.
It is a new regression evidence archive, not a newly frozen harness/runtime. Earlier sealed
archives and F2 artifacts were not modified. Principal archived SHA-256 receipts:

| Member                      | SHA-256                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `windows-default-first.log` | `599fe258a497b855e38fa34ce8879752a27abd9f0543718f75935bb9488ac31a` |
| `windows-default-final.log` | `863b0f2d146fab9ba322c8fd9005bce4ac8687726837e4e87b63a6687fd557c1` |
| `linux-final-fixed.log`     | `6251d936cbba32c24e1dd496ea72134bd94ce6d77e73a6f3d2a679554a5da4c0` |
| `ci-first-job.log`          | `77db1b3bad949be7db4c5ff6b31331a8ecc46701b7f8b45d6de19b32040ba935` |
| `ci-final-job.log`          | `bb50f0990fec952f6541ec0cf070ab5f0f15355c007327ab15e4bec749287cf2` |
| `source-b98bbe5.tar`        | `4b63af0b3d8def64653ec86aee6cd5a56469f670c51fa2a6324ae92fda8450eb` |

Attribution: local commands above were executed by this implementation session; CI execution was
read through live metadata/full decoded logs and archived, not rerun locally. Initial sandbox CIM
denial, first Windows operator setup failure, first Linux/CI implementation failure, invalid
diagnostic Node resolution and the first Linux driver's disposal limitation remain separately
visible. Final controlled uncertain-close cases retain evidence until actual real-child termination
is confirmed; otherwise the outer test fails and keeps the roots. No historical unknown residue is
deleted. Historical unrestricted Windows latency/EBUSY and the unrelated earlier Linux fake-duration
observation remain unresolved; supported default-policy success does not repair or explain them.

Actual remote final implementation child was verified equal to `b98bbe5`; local/remote parent M2
remained **`4f09265791c82452a5800cc6d9855938bf88a46e`** and both F2 preservation refs remained
**`4ea24d53afc57778addf3f47752e0fe73a7011ea`**. These implementation delivery checks are archived.
This outcome is a documentation-only checkpoint; its normal push and actual remote/clean/ref checks
are reported separately and retained under workspace `.cache/windows-ownership/`, after the archive
was sealed. Its automatic documentation-push CI is not substituted for the implementation CI above.

Return on the child for **independent focused review** of the complete ownership/policy change,
actual timeout boundaries, registration/primary-error paths, Windows tree and Unix group barriers,
retention and evidence/CI attribution. No independent review or self-acceptance is claimed here.
PR readiness remains for trunk disposition after review. No PR, merge, freeze, formal measurement,
qualification, eligibility, adoption, parent or acceptance record update was performed.

## Historical scope return before shared sidecar changes (2026-10-13)

Inspected on the requested child at clean source
`8b29d4dce7437b20767c69ca94411ece14ba7760`. Implementation is **not complete**; Windows
concurrency and EBUSY obligations remain open. This return follows the active assignment's instruction:
"If shared formal sidecar behavior must change, stop and return the proposed scope first."
No implementation, policy change, timeout regression, full campaign or acceptance update was made.

### Ownership findings and proposed bounded scope

- Baseline: `temporary()` registers roots; `afterEach` removes them, independently of the still
  pending test body. Deterministic fixture Git uses promisified `execFile` without a signal or an
  owned close registry. Root registration and body settlement need a test-owned lifetime wrapper;
  fixture generation needs cancellation checks between awaited operations and owned Git close tracking.
- C2: `prepared()` copies into the file-level root; `FixtureLifecycle` performs awaited inventory,
  Git identity, copy and atomic evidence work. `afterAll` deletes that root without a body registry.
  Cancellation must stop subsequent inventory/Git/evidence operations and teardown must await the
  active body and any filesystem operation already started. Optional fixture-support cancellation
  seams must preserve the behavior of formal callers that do not supply them.
- Sidecar: the test owns its repository root, but shared
  `scripts/telemetry-performance.ts:runRepositoryProfileSidecar` independently creates a second
  private root, launches the Node sidecar through a module-private promisified `execFile`, catches
  errors into an inconclusive capture, and unconditionally deletes its private root in `finally`.
  Neither the child nor that private root's disposal is exposed to a test wrapper. Waiting for the
  outer test body cannot control this inner deletion when termination is unconfirmed. A rejection
  or abort callback does not prove that the child and its Windows descendants have closed.

Recommend authorizing an optional, invocation-local sidecar ownership seam in this shared function:
accept a cancellation signal plus a narrow child execution/disposal owner supplied by these tests.
Expose the private root to that owner immediately after creation; gate later preparation/read/write
operations on cancellation; let the owner await confirmed child close and body/filesystem settlement
before root disposal. Retain both roots with secondary diagnostics on an unconfirmed bounded wait.
Keep the original failure separately from cleanup/diagnostic errors. Calls without the seam must
retain existing capture/provenance and formal timing/measurement semantics. The test owner must
terminate only children it launched, including Windows descendants, and must distinguish confirmed
close from merely successful `taskkill`. Do not introduce a global process registry or mock all Node
filesystem/process APIs to reach the private sidecar lifetime.

This is a proposed scope for trunk disposition, **not authorization inferred by this session**.
The shared sidecar's unconditional inner disposal is the reason for returning before implementation.
After scope disposition, resume the active assignment's Windows `maxWorkers: 2`, real Vitest
timeout-boundary regressions, fail-before/pass-after evidence and fixed-source validation/delivery.
Installed Vitest 4.1.10 `resolveMaxWorkers(project)` checks project configuration and then root
configuration; all current workspace configs omit worker caps. That inspection supports the root
policy route but is not an executed effective-concurrency verification.

### Evidence and delivery attribution

This session performed source inspection only. Earlier archived Windows/Linux logs remain attributed
to their original sessions and were not rerun or reclassified. No historical temporary root was
deleted. No CI or formal measurement was started. No independent review is claimed; the next gate
is sidecar scope disposition, followed by implementation and then independent focused review.
The documentation checkpoint records this proposal on the child; delivery/check results are reported
by the session separately. Parent M2/F2 and all GC/C1/C2/C3 acceptance remain unchanged.

## Historical assignment: focused CI review and Windows disposition (2026-10-13)

The Git-strategy correction is delivered, not independently accepted. PR remains blocked: Windows
default npm test still fails, even though maxWorkers=2 passes. Do not reclassify the reduced-concurrency
run as a repaired default command. Trunk verified final CI 38346905386 is attempt 1/success at
`1ece6d12cff1d1d836f10554c4ce96c3013f3af4`; local source is clean on the fixture child.

Review-only assignment on feature/otel-redesign_M2_fixture:

- Fixed implementation: `b00258475004a8d7edb1c00bfa5f3f4d69039a5b`.
- Base: `28078f639cd18d39bf895ef56a7192ba1afe869a`.
- Outcome: `1ece6d12cff1d1d836f10554c4ce96c3013f3af4` (handoff only).
- Parent M2 `4f09265` and F2 refs `4ea24d5` remain unchanged.

1. Verify complete three-file correction, source/remote identities and Git 2.54/2.55 primary evidence.
   Confirm maintenance.strategy=gc is test-local and that shared foreground flags and production
   fixture heuristics are unchanged. Review Trace2 parsing: automatic invocation, correct parent/child
   association, successful exits captured before commit return, and a meaningful negative control.
   Keep real pack-count/history/owned-cleanup assertions. Check portability across tested Git versions
   without weakening activation/completion proof or treating a skipped Linux test as Windows evidence.
2. Run build/explicit fixture strict typing and the focused lifecycle suite on available Linux Git
   2.55 (reuse preserved isolated executable if available) and 2.53 where practical. Do not rebuild Git
   or rerun complete OS/package campaigns without a concrete need. Inspect preserved fail-before and
   three sensitivity logs with hashes/source bindings; use a bounded independent probe only for an
   unresolved concrete concern. Restore all temporary changes. Verify CI SHA, first attempt and actual
   source/release/package step execution from live metadata/saved logs. Report execution versus read
   evidence separately. Corrected-source local campaigns are content-bound as documented, not clean
   fixed-OID campaigns; CI provides that separate fixed-checkout evidence.
3. Separately inspect preserved Windows default failure logs and the 2-worker success. Identify exact
   failing tests, deadline/cleanup order and resource ownership; determine what supports concurrency
   attribution and what remains uncertain. Inspect root/workspace worker configuration and test
   cancellation/teardown. Do not treat EBUSY as harmless merely because a later run passes. Record
   any leftover roots/process uncertainty without broad cleanup. Keep the earlier Linux adapter timing
   assertion in invalid setup evidence visible; do not silently mark it repaired.
4. Return a bounded recommended Windows follow-up: configuration of supported test concurrency,
   focused test lifetime/cancellation correction, or further diagnosis, according to actual evidence.
   Distinguish an intentional supported default-policy change from a temporary CLI workaround. Do not
   unilaterally waive default npm test failures, raise deadlines, skip tests, change config or run more
   full campaigns in this review. A concrete proposed fix must keep all tests/assertions and unchanged
   formal measurement policy. Trunk assigns any follow-up implementation separately.

Append accepted/corrections-required for the GC-strategy correction only, findings with precise
failure paths, evidence attribution and Windows follow-up here. PR readiness remains pending until
the Windows obligation is explicitly resolved. Format write/check and diff check; documentation-only
commit/normal push, actual remote/clean/parent/F2 checks, remain on child. No implementation repair,
PR, merge, freeze, eligibility or formal workload/acceptance changes. Do not rerun CI merely for green.

## Active assignment (2026-10-13)

The human blocked PR creation after observing local and GitHub source-test failures. The previous
source/base/tree rehearsal is historical; do not create that PR. Trunk inspected CI run
38335718829, job 115095214372, source `74fd6926934688766ccd0edfcc21597154f3da9e`:
https://github.com/gitlode/gitlode/actions/runs/38335718829

Actual outer result: 99 files, 98 passed/1 failed; 1,375 tests passed/1 failed. The failing test is
fixture-lifecycle.test.ts, "completes forced low-threshold automatic maintenance in the foreground",
line 191: expected packs: 1 after the empty commit, observed packs: 2. The preceding two-pack setup,
supervisor exit and cleanup assertions passed. Nested intentional retention-test failures are not
this failure; their outer workflow suite passed. Release build, publint and installed tests were skipped.
CI reports Git 2.55.0; previous Linux review uses 2.53.0. Trunk checked current WSL Git 2.53.0 and
Windows Git 2.45.1.windows.1. Version dependence is a hypothesis, not yet the root cause. Local user
failure identity remains to be established; do not assume every local failure is this Linux-only case.

## Bounded branch implementation session

Stay on feature/otel-redesign_M2_fixture; start at the documentation checkpoint delivering this packet
(predecessor `74fd692`). Parent M2 remains `4f09265791c82452a5800cc6d9855938bf88a46e`, F2 unchanged.
Keep accepted C1/C2/C3 and product runtime fixed except for a demonstrated directly related defect.

1. Preserve the cited complete CI log and fixed source identity. Reproduce the failing maintenance
   case or explain version-specific behavior with pinned Git source/manual evidence. Check actual
   effective repository config, commit-triggered maintenance dispatch and low-threshold setup.
   Establish local test results on supported available environments; retain first failures and exact
   Git/Node/test OIDs. Do not misclassify expected nested assertion failures as outer suite failures.
2. Correct the smallest demonstrated test/fixture or harness defect. Preserve the real proof that
   automatic maintenance is triggered and completes under foreground settings before command return,
   with owned-group cleanup and correct semantic history. A vacuous absence-of-writer check, skipping
   newer Git, pinning CI to hide the failure, accepting arbitrary pack counts or replacing automatic
   maintenance with explicit full gc does not preserve that proof. If exact pack-count assumptions
   are not portable, replace them with an observable operation/completion oracle that has meaningful
   positive activation and bounded negative sensitivity. No global Git settings, product workload
   recipe/threshold changes or broad framework expansion. If current production foreground controls
   prove insufficient, return the concrete compatibility issue before broadening implementation.
3. Preserve fail-before/pass-after. Run targeted regression plus strict fixture tooling typing, then
   root npm test on the corrected fixed implementation in local Windows and Linux where available.
   Record skips and exact scope; no retry-until-green. Run required build/lint/architecture/format
   checks without stale release dist contamination. Do not raise timeouts merely to mask this assertion.
4. Normally push the implementation checkpoint and inspect its CI. Require source tests and subsequent
   release/package steps to execute successfully; a stale green run or skipped steps do not qualify.
   If another real failure occurs, preserve and diagnose it, not automatically rerun CI. No formal
   workload, 4,430-commit generation, eligibility check or frozen runtime rebuild is assigned.
5. Record source OIDs, root cause versus hypotheses, exact changed scope, independent sensitivity,
   local/CI runs and first failures here. Make separate implementation/outcome checkpoints and push.
   Stop for focused independent review; do not self-accept, prepare/create PR, merge, freeze or update
   parent/acceptance records. Verify actual remote equality, clean status and parent/F2 unchanged.

Following review, integration preparation must refresh final source/tree and verify latest source CI
before trunk asks for PR approval again. Earlier narrow reviews remain attributed evidence, not proof
that the failing full CI passed. Human source/base approval is still required for the eventual PR.

## Correction implementation (2026-10-13)

Started on the requested branch at `28078f639cd18d39bf895ef56a7192ba1afe869a`, with clean
tracked/untracked status. Product runtime, C1/C2/C3, parent M2 and F2 are unchanged.

The CI failure is a test configuration defect, not evidence that the foreground controls are
insufficient. Git 2.54 changed the unscheduled maintenance default from `gc` to `geometric`:
[release note](https://github.com/git/git/blob/v2.55.0/Documentation/RelNotes/2.54.0.adoc),
[2.55 strategy selection](https://github.com/git/git/blob/v2.55.0/builtin/gc.c#L1858-L1866).
The old test only lowered `gc.autoPackLimit` and `gc.auto`, so its commit dispatched automatic
maintenance without selecting the task whose threshold it lowered. With 2.55 it retained two packs.
Foreground configuration still governs completion of the selected tasks; it does not select GC.

The smallest correction is test-local `maintenance.strategy=gc`. The original two-pack setup and
exact one-pack positive expectation remain. A matching disabled automatic-maintenance control keeps
exactly two packs. Shared foreground flags remain the production constants. The worker now records
configuration origins/scopes and freezes Trace2 plus pack count immediately after the empty commit
returns, before notifying the supervisor. Assertions positively identify `maintenance --auto`, `gc`
and `repack` child starts and matching successful exits in that snapshot. Owned-group cleanup and
eight reachable commits remain separate assertions. No explicit GC replaces commit dispatch.
Contributor documentation explains this probe without changing the workload recipe or thresholds.

Local evidence is retained under `.cache/fixture-ci-correction/` pending outcome archiving:

- `ci-before.log`: complete cited job 115095214372 at source `74fd6926934688766ccd0edfcc21597154f3da9e`;
  the outer suite has one real failure, and release/package steps were skipped.
- Linux Node 22.23.1/npm 10.9.8/Git 2.53.0: original focused suite 20/20;
  corrected focused suite 21/21 and full suite 99 files/1,377 tests passed.
- Pinned Git 2.55.0 from `https://www.kernel.org/pub/software/scm/git/git-2.55.0.tar.xz`:
  `git255-before.log` reproduces the exact line-191 two-pack failure at the starting source;
  `git255-after.log` has corrected focused 21/21. Final code, including worker environment sanitation,
  passes strict fixture lifecycle typing and full root `npm test`, 99 files/1,377 tests
  (`strict-final.log`, `linux255-final.log`). Linux copy is `/tmp/gitlode-fixture-ci-correction`,
  with actual starting commit fetched into its private Git database. Earlier archive-only full run
  lacked `.git` and failed source-resolution tests; `linux-before.log` retains this setup error and
  a separate adapter assertion (fake duration samples 0.1/0.3 instead of 0.2/0.2), and is not valid
  fixed-source qualification. That assertion is unrelated to maintenance dispatch; its underlying
  scheduling cause was not established, and no adapter change or workaround was made.
- Disposable independent mutations on 2.55: selecting geometric fails GC activation; overriding
  `maintenance.auto=false` only on the commit fails the positive maintenance-child assertion;
  overriding both detach flags to true fails `gc successful completion before command return`.
  Each exits 1; `sensitivity.py` restores the corrected test after the probes. Their bounded logs are
  `default-strategy.log`, `disabled-activation.log`, `detached-completion.log`. No mutation is committed.
- Windows Node 22.23.1/npm 11.11.0/Git 2.45.1.windows.1: starting full root test
  (`windows-before.log`) has 98 files passed/1 failed, 1,337 tests passed/1 failed/38 skipped.
  `behavioral-baseline` regeneration hits the unchanged five-second deadline, then cleanup gets
  EBUSY. This is distinct from CI: foreground maintenance is Linux-only. Focused unchanged baseline
  passes in 3.68 seconds (`windows-baseline-focused.log`). Default-concurrency corrected full run
  also exhibits deadline failures; preserve its complete outcome and diagnose concurrency separately.

Build/dev, lint, architecture, system typing, schema, dependency consistency and required root
format-write/check have run. Architecture reports its existing one configuration warning with zero
errors. No release build is mixed into these source checks. Source identity, final Windows scope,
normal push and implementation-OID CI results must be recorded in the outcome checkpoint below.
Independent focused review remains required; this implementation session does not self-accept.

## Outcome checkpoint (2026-10-13): pending independent focused review

Implementation OID: **`b00258475004a8d7edb1c00bfa5f3f4d69039a5b`**; tree:
`fbcb568fcfbbdfd0ed44a6d9120699edaa65dff6`. The only changed paths from the starting checkpoint are
the lifecycle test, its contributor explanation and this handoff. Final test Git blob:
`822b55c25d46c4793a2a175c540535e495222be6`; file SHA-256:
`32e0e3d460ab20f90d95af7f684aba5ee4a4baa3b52714f20bee2ef0826882b7`.
Local final Linux testing used the starting commit's actual Git database with that exact test overlay;
the Windows final run started on the final implementation working tree, and its commit was created
while the run was active. These are explicitly content-bound local results, not claims that the
entire local campaign started at a clean implementation OID. CI below checked out that actual OID.

Final Windows command `npm test -- --maxWorkers=2` exits 0: **99 files passed, 1,338 tests passed,
39 skipped**, 219.26 seconds (`windows-final-workers2.log`). The skip set is the existing platform
conditions, including the original Linux lifecycle/supervisor cases and the added Linux negative
control. No existing test was disabled. On this 24-available-processor host, the original/default
concurrency executions failed deadline assertions: initial baseline timeout/EBUSY, then corrected
default run with baseline, sidecar and three C2 cases (5 failed/1,333 passed/39 skipped).
The unchanged baseline passed focused, and all test files passed with two workers at unchanged
five-second test deadlines. This establishes the observed association with concurrency/load;
the host's precise latency cause remains unproven. Default-concurrency Windows is **not** claimed
green or repaired by this GC-test correction. The user's unspecified earlier local log was not
provided, so correspondence is limited to these newly captured exact local failure identities.

Normal implementation push produced
[CI run 38346438746](https://github.com/gitlode/gitlode/actions/runs/38346438746), attempt 1,
job **115128858071**, source **`b00258475004a8d7edb1c00bfa5f3f4d69039a5b`**. Completed **success**:
source tests **99 files/1,377 tests passed**, release build, packed metadata/publint and installed
package test all executed successfully. No required step was skipped, and no CI rerun was requested.
Runner inputs: Git 2.55.0, Node 22.23.3, npm 10.9.9. Full before/after job logs, final run metadata
and job/step conclusions are preserved; expected nested retention failures remain nested evidence.
The installed package's reported tarball SHA-256 is
`e4d37c208cd6e6dba3ab887efa097e9c096ec97c41611a4ff8047732a845af45`.
This is ordinary CI functional evidence, not a frozen runtime or formal measurement.

New regression evidence archive:
**`D:/gitlode_test/m2-fixture-ci-correction-20261013-b002584`**, **38 members**.
Every copied member was verified against its source SHA-256; `manifest.json` records byte counts,
original paths, local source bindings and CI identities. Manifest SHA-256:
**`ac05e59f2c5e0ed9c10875ebf35246b81e68a7e9204778c20631ab5eb1dc2ded`**;
`manifest.sha256` pins those bytes. Build setup failures for missing OpenSSL/Rust are preserved;
the isolated Git 2.55 reproduction build disables optional TLS/HTTP/XML/gettext/Tcl/Rust features.
Source tarball SHA-256 is `457fdb04dc8728e007d4688695e6912e6f680727920f2a40bf11eacc17505357`.
This archive preserves regression logs, not a new frozen harness, eligibility or acceptance record.
Prior sealed archives were not modified.

After the implementation push, actual remote child matched the implementation OID, parent M2
remained `4f09265791c82452a5800cc6d9855938bf88a46e`, and actual local/remote F2 product/harness
preservation refs remained `4ea24d53afc57778addf3f47752e0fe73a7011ea`. Test-created hooks were removed
by normal teardown and Git status was clean. This outcome checkpoint changes only this handoff;
verify its normal push and clean local/remote equality before returning.

Stop for an independent focused review of strategy selection, positive automatic dispatch,
return-time completion/negative sensitivity, unchanged pack/history/cleanup proof, local failure
classification and CI provenance. No independent review has been performed in this correction
session. No PR, merge, formal measurement, 4,430-commit generation, freeze, eligibility, parent or
acceptance update was performed or authorized. Review must refresh latest source/tree and CI before
any later integration/PR approval request.

## Independent focused review and Windows disposition (2026-10-13)

Reviewer: independent Codex review session, starting at
`9ba262c08337bba82f15076bb55a8a3d80a98918`. **GC-strategy correction: accepted** at fixed
implementation `b00258475004a8d7edb1c00bfa5f3f4d69039a5b`. **PR readiness: pending/blocked** by
the unresolved Windows default-command obligation. This acceptance does not waive Windows failures,
authorize integration, or establish formal performance acceptance.

### Correction scope and proof

Reviewed the complete `28078f6..b002584` three-file diff: lifecycle test, contributor harness
explanation and handoff. Shared `fixture-git.ts`, fixture generation, production heuristics and
foreground flags are unchanged. Strategy selection is command-local to the Linux GC threshold probe.
The worker additionally sanitizes Git variables case-insensitively and fixes TZ, consistent with the
shared environment helper. No explicit GC replaces automatic commit dispatch.

Primary evidence agrees with the diagnosis: the
[Git 2.54 release note](https://github.com/git/git/blob/v2.54.0/Documentation/RelNotes/2.54.0.adoc)
announces geometric as the default; the preserved 2.55 tarball's `builtin/gc.c:1970-1979` and the
[tagged upstream source](https://github.com/git/git/blob/v2.55.0/builtin/gc.c#L1970-L1979)
select geometric for unscheduled maintenance and allow the explicit strategy override. The earlier
handoff's `#L1858-L1866` source anchor is inaccurate; use the corrected anchor above. Git 2.54 itself
was not executed in this review.

Trace2 is enabled only for the triggering empty commit, after setup and configuration inspection.
Its immediate post-return snapshot precedes the supervisor finished notification; the subsequent
count-objects command disables tracing. Successful `child_exit` is matched to its preceding start
by BOTH parent session SID and child_id, so another parent's reused child number cannot satisfy it.
One `maintenance --auto` start is required, plus GC and repack starts and zero exits. The parser
does not independently assert every ancestry edge between those three commands, but this isolated
single-command trace, sanitized environment and exact operation tokens leave no unrelated setup
operation available to satisfy them. No blocking association defect was found in this bounded probe.
Completion is observed in the snapshot taken after synchronous commit return, not inferred from
later cleanup. Exact two-pack setup, one-pack positive result, two-pack disabled control, eight
reachable commits and separately confirmed owned-group cleanup all remain required.

### Evidence attribution and independent execution

Rehashed the archive manifest to the recorded
`ac05e59f2c5e0ed9c10875ebf35246b81e68a7e9204778c20631ab5eb1dc2ded`; all 38 archived members
match their listed SHA-256 values. Read the preserved 2.55 fail-before log and sensitivity script/logs:
geometric fails GC activation at test line 241; disabled commit maintenance fails the positive child
count at line 234; detach=true fails GC successful completion at line 251. Each sensitivity run
exits 1. Those are attributed implementation-session executions, not newly executed mutations.
The script restores corrected bytes in finally; the reused Linux test SHA-256 independently matches
the implementation hash `32e0e3d460ab20f90d95af7f684aba5ee4a4baa3b52714f20bee2ef0826882b7`.

New review execution used existing `/tmp/gitlode-fixture-ci-correction`, its starting Git database
and corrected test overlay, Node 22.23.1, and preserved isolated Git without rebuilding Git:
`npm run build:dev` and `npx tsc -p packages/gitlode/tsconfig.fixture-lifecycle.json` pass;
`npx vitest run packages/gitlode/test/telemetry/fixture-lifecycle.test.ts` passes 21/21 with system
Git 2.53 (9.31 seconds) and isolated Git 2.55 (9.87 seconds). The shell chain exits 0. These remain
content-bound executions, not clean fixed-OID campaigns. No source mutation was needed. The prior
Linux full runs and Windows runs were read evidence only; no complete campaign was repeated.
The archive-only invalid Linux setup still contains the separate
`test/git-impl/git-adapter-multi-change-matrix.test.ts:223` fake-duration assertion, 0.1/0.3 against
0.2/0.2. Its scheduling cause remains unestablished; this review does not mark it repaired.

Live GitHub metadata confirms [implementation CI 38346438746](https://github.com/gitlode/gitlode/actions/runs/38346438746)
is attempt 1/success at the exact fixed OID/tree. Live job 115128858071 step summaries show source
tests, release build, packed metadata and installed-package system tests all completed successfully.
The hash-verified complete saved log shows the actual checkout SHA, Git 2.55, 99 files/1,377 source
tests passed and installed tarball hash `e4d37c208cd6e6dba3ab887efa097e9c096ec97c41611a4ff8047732a845af45`.
Live status and saved execution logs are complementary evidence; this review did not rerun CI.

### Windows failure paths and bounded follow-up recommendation

The preserved default runs identify these exact failures at unchanged 5,000 ms deadlines:

- Both runs: `behavioral-baseline.test.ts:58`, regeneration of two isolated SHA-1 repositories.
  Timeout precedes afterEach's recursive removal; removal reports EBUSY on fixture-b-Y5GSIV before
  correction and fixture-b-uTara9 after correction. This is a second real cleanup failure, not noise.
- Corrected default run: `repository-sidecar.test.ts:20`, isomorphic-git commit sidecar; plus
  `fixture-lifecycle.test.ts:47`, C2 device, type and operation cases. Total: 3 failed files,
  5 failed/1,333 passed/39 skipped tests. C2 performs copy, repeated byte inventories and sequential
  Git identity queries before checking deliberately inconsistent evidence.
- The preserved two-worker run passes 99 files/1,338 tests with 39 platform skips; the focused
  unchanged baseline passes in 3.68 seconds. Linux-only maintenance skips are not Windows GC proof.

Root and workspace Vitest configs have no worker cap or timeout override. Installed Vitest 4.1.10
`resolveMaxWorkers` uses root/project maxWorkers if set, otherwise availableParallelism minus one
for a non-watch run: this 24-processor host therefore has a default ceiling of 23, not evidence that
exactly 23 workers were simultaneously active. Multiple deadline failures, focused success and
two-worker success support a concurrency/load association. No CPU, I/O, antivirus or process timeline
was captured to identify the precise latency cause or prove that lower concurrency alone is stable.

Vitest's timeout wrapper rejects and aborts the test context signal, but cannot stop an async body
that ignores it. These tests do not consume that signal. Deterministic/performance fixture Git
execFile calls and lifecycle identity queries have no cancellation signal; baseline afterEach removes
registered roots without awaiting an owned outstanding-body registry. Thus timeout can overlap
ongoing Git/filesystem work with deletion and later tests. C2 shares a file-level root removed in
afterAll. Sidecar has awaited child/finally ordering on normal completion, but its test body and child
exec are not cancelled by the outer deadline; its own finally does not establish timeout-time quiescence.
This is a concrete lifetime gap, consistent with EBUSY; the log does not identify the actual lock holder.
Read-only inspection found BOTH named Windows fixture-b roots still present. Their remaining handles
or processes were not established. No broad cleanup or deletion was attempted.

Recommend a separately assigned, bounded follow-up with two explicit responsibilities:

1. Propose a supported Windows root test policy of maxWorkers=2 in the root config, preserving Linux
   policy and all suites/assertions. Document it in contributor build/test guidance and validate
   plain `npm test` at the final clean follow-up OID. This is an intentional default-policy change
   requiring disposition by trunk, not proof that the old default parallelism was repaired. The
   existing CLI override remains diagnostic evidence only; one passing run does not prove stability.
2. Correct timeout ownership in the affected test paths: consume the context cancellation signal,
   stop launching further fixture work, terminate only owned active children (including the Windows
   child tree where applicable), await child close AND outstanding filesystem/body settlement before
   deleting owned roots. Keep first failure and cleanup diagnostics; retain an owned root when
   quiescence cannot be confirmed. Add a bounded cancellation regression that detects post-timeout
   writes and premature deletion. Prefer test-owned wrappers/seams; any shared sidecar lifetime
   change needs a separate scope review and must preserve formal measurement policy.

Do not raise deadlines, skip assertions or silently waive EBUSY. If the chosen supported default
still fails, preserve its first failure and capture owned child/phase timings before changing the
policy further. No implementation/configuration repair or new Windows full campaign is performed
here. Trunk must explicitly resolve this obligation before a PR readiness decision.

Actual remote pre-review child equals `9ba262c`; local/remote parent remains `4f09265791c82452a5800cc6d9855938bf88a46e`
and both F2 preservation refs remain `4ea24d53afc57778addf3f47752e0fe73a7011ea`. Delivery is a
documentation-only normal commit/push on the fixture child, with format write/check, diff check and
post-push actual remote/clean/ref checks. Return this disposition to trunk while remaining on the
child as assigned; no PR, merge, freeze, eligibility or formal workload execution is authorized.
