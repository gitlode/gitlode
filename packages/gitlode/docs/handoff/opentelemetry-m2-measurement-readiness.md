# M2 pre-measurement readiness packet

## Current status: integrated (2026-10-02)

The human squash-merged PR #115 at `7696c4c1261430f9aa7e84482a976bc44186db45`, parent
`b325065d9a11b6020b2e043fa4b7a196833a49d4`. Trunk verified local/actual-remote M2 equality
and tree `17fb822329b0cca874b6370d093b24bb414f7b39`, exactly matching accepted source
`d494a332764b647811e0df22a9cbda77317622ba`. Source history is preserved locally and remotely
at `archive/otel-m2-readiness-d494a33`; the human may delete the readiness work branch, not the archive.
The assignments and reviews below are completed history, not instructions to rerun the slice.
Saved validation is reused through exact tree correspondence, not claimed as new execution on the
squash OID. Formal measurement, candidate freeze and M2/release acceptance remain pending.

## Assignment and authority

The human starts this separate implementation/readiness conversation and returns its outcome to
trunk. No formal calibration or measurement is authorized. Builds and bounded process tests can take
substantial execution time independently of model reasoning; announce stages and retain progress.

Start from `feature/otel-redesign_M2` at the document checkpoint delivering this packet. Its previous
checkpoint is `7e6dd1cb1cca426ad9be1cef34a4661dbf0c9236`; record the exact starting OID and confirm
that the delivery delta is documentation only. Create `feature/otel-redesign_M2_readiness` from that
checkpoint. If the name already exists or the base differs, inspect before proceeding; never reset it.
Commit and normally push meaningful checkpoints, including incomplete outcomes, on this child only.
Verify actual remote equality and clean status; stay on the child on return.

Trunk will assign independent focused review. Any eventual PR requires explicit human source/base
approval, and the human performs the intended squash into M2. Do not freeze product/harness candidates,
update parent refs, rewrite history, create a PR, or change release acceptance.

## Reading and fixed boundaries

- [Recovery plan](instrumentation-opentelemetry-recovery-plan.md), especially open risks and history.
- [Performance contract](../design/telemetry-performance.md), execution supervision.
- [Harness guide](../contributing/telemetry-performance-harness.md), reference workflow and ownership.
- [Collaboration](../agents/collaborative-work.md#bounded-implementation-and-measurement-sessions).
- `packages/gitlode/test/telemetry/performance-workflow.test.ts` and its executed workflow/supervisor.

The system slice is complete. Broader scripts organization, historical ENOTEMPTY/EBUSY attribution,
Attributes typing, thresholds, recipes, calibration selection, production telemetry and presentation
are outside this packet. Do not repeat full package/OS validation or historical reproduction campaigns.

## A. Fault-test fixture ownership

The retained `gitlode-performance-vy7lhL` under the recovery Linux outside TEMP matches the synthetic
second-child stall fixture. The killed worker cannot run its temporary-root finally, while the test
currently owns only its outer `gitlode-supervised-workflow-*` directory. Preserve that old residue and
all old evidence; no global TMP cleanup, wildcard deletion or broad process killing is authorized.

Confirm the ownership path, then implement the smallest test-only containment correction: give the
spawned workflow a fresh test-owned temporary parent via child-specific environment, beneath the
test's owned root, so outer test teardown owns generated fixtures too. Do not mutate process-global
TEMP/TMPDIR, weaken process/evidence assertions, or add retries. Ensure realpath containment and
process completion precede deletion. If the issue requires production supervisor changes or a new
cleanup guarantee beyond the existing contract, preserve findings and return a diagnosis instead.

Add meaningful regression evidence for normal and second-child-stall cases: generated workflow
fixtures use the owned parent; completed-run evidence and expected status survive; teardown removes
owned fixtures after the existing cleanup barrier; an outside sentinel remains unchanged. Avoid a
test that merely asserts the new environment assignment. Preserve an isolated fail-before observation
when feasible, never create uncontrolled leaks solely to obtain it. Document teardown limits if the
test runner itself is killed; do not claim universal cleanup.

## B. Linux operator readiness before long work

Using Linux-native Node/Git/storage on WSL2, inspect the existing operator launcher and choose a
concrete invocation for later long commands. Before this session's potentially long validations,
exercise its external deadline once on a disposable synthetic child/descendant and verify bounded
return, retained exit/log evidence and absence of live owned processes. Preflight must precede use.
Do not confuse the outer operator deadline with the harness stage deadlines or performance gates.
If a launcher needs correction, keep it a small external operator helper with exact source/hash in
the evidence archive; no new generic orchestration framework. Do not use the historical late Windows
preflight as Linux proof. Windows emergency guarantees are not added by this Linux reference packet.

Record actual tool versions, filesystem location, free-space observation, launcher command/limits,
and next-session setup steps. Inspect only known paths/processes needed for ownership; preserve old
artifacts. This is operational readiness, not environment/performance acceptance or a new calibration.

## Finite validation and exit

After successful launcher preflight, run `npm run build:dev`, then the affected Linux suites once:
`npx vitest run packages/gitlode/test/telemetry/performance-workflow.test.ts
packages/gitlode/test/telemetry/performance-supervisor.test.ts` (one command). New regression cases
must actually run on Linux; Windows skips are not substitute evidence. Run lint and format write/check,
and `git diff --check`. Use a checked TypeScript invocation covering changed code; record its exact
file closure and distinguish existing unrelated errors rather than claiming build checks all tests.
Architecture checking is needed only if boundaries/import ownership change.

Preserve first failures. A clearly identified operator/setup error may be corrected in this session
with the cause, original log and corrected command retained. Product, unexplained cleanup or timing
failures require classification and return, not repeated runs until green. Do not expand to full tests
without a concrete affected dependency. No retry of formal workloads is relevant: none are run here.

Append a concise outcome here: starting/implementation/final OIDs, changed paths, exact commands and
exit results, independent versus reported evidence, new archive path and sealed manifest hash, cleanup
ownership and residual limits, and whether the readiness questions are resolved. Verify archive copies
before reporting preservation. An implementation result awaits independent review; it is not F, T13B,
M2 or publish acceptance. Trunk next reviews the slice, then settles history and immutable candidate
preservation before assigning target-specific formal measurement sessions.

## Readiness outcome (2026-10-02, independent review pending)

Start: `b325065d9a11b6020b2e043fa4b7a196833a49d4`, clean parent
`feature/otel-redesign_M2`. Compared with `7e6dd1cb1cca426ad9be1cef34a4661dbf0c9236`,
the delivery changes only this packet, handoff README and recovery plan. The new child is
`feature/otel-redesign_M2_readiness`; implementation checkpoint
`9b518a23c2c8c23762fce221bb2a60cad41afffc` was committed and normally pushed. The final
document checkpoint OID and actual remote equality are recorded in the return record beside the
sealed archive and in the session return, avoiding a self-referential commit OID in this document.

Changed implementation paths are `packages/gitlode/test/telemetry/performance-workflow.test.ts`
and `packages/gitlode/docs/contributing/telemetry-performance-harness.md`; this outcome is the
only additional tracked change. No production supervisor, thresholds, recipes or acceptance changed.
`executePaired` creates its fixture with `mkdtemp(tmpdir()/gitlode-performance-*)`; killing its worker
prevents worker cleanup. The test now supplies a child-specific TMPDIR/TMP/TEMP under its owned root,
observes the synthetic CLI's actual fixture realpaths, and registers outer teardown only after child
completion, `cleanupConfirmed`, empty cleanup errors and realpath containment. Normal completion
leaves no fixture; the second-child stall leaves one contained fixture, then outer teardown removes it.
Completed evidence is copied outside the root before removal and compared afterwards; an outside
sentinel remains unchanged. Abrupt test-runner/host loss or an unconfirmed barrier can retain roots;
there is no universal cleanup guarantee. Existing evidence assertions remain intact.

All execution below is this session's reported evidence, not independent review or formal acceptance.
The new Linux-native clone is `/home/t-wakabayashi/gitlode-performance/m2-readiness-b325065/source`,
on WSL2 Ubuntu, Linux 6.18.33.1, Node v22.23.1, npm 10.9.8, Git 2.53.0. Initial `df -h` reported
949 GiB available on `/dev/sdf`; `stat -f` reported ext2/ext3. Exact paths, versions, commands,
timestamps, limits and exit results are retained in the archive.

Operator invocation is Linux-native `node <root>/tools/launch.cjs <command.json>` with NODE_OPTIONS
unset and the recorded Linux Node bin first in PATH. The reused external launcher SHA-256 is
`23b916a0aee69275359527875cd3a9bc6e20fc9759008bddba0d14f6c2e32c8b`.
Before clone/install/build, `node <root>/tools/preflight.cjs <root>/tools` passed: a disposable parent
and descendant hit a 2-second deadline, bounded return was 2037 ms, exit 124, SIGKILL, retained log
and result JSON, and no live owned group members. This helper uses an outer SIGKILL deadline and
close-based return; the preflight demonstrates this disposable Linux case, not arbitrary kernel I/O,
escaped process groups, host loss, Windows guarantees or performance gates. Harness stage deadlines
and cleanup semantics remain separate. Later long sessions should load the same Linux-native tools,
use native storage and a fresh owned log/config root, inspect source/hash and exercise their launcher
before work; a new session must establish its own readiness rather than infer acceptance from this one.

Bounded commands used `node <root>/tools/run.cjs <stage> <seconds> <command> <args...>`;
the exact configurations and file-backed shell scripts are preserved:

| Command                                                                                                                                      | Outer seconds | Result                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `git clone --no-hardlinks --branch feature/otel-redesign_M2_readiness /mnt/c/Users/t-wakabayashi/source/gitlode <root>/source`               |           120 | 0; clean checkpoint clone, then explicitly copied bounded test change                                                                         |
| `npm ci`                                                                                                                                     |           600 | 0                                                                                                                                             |
| `npm run build:dev`                                                                                                                          |           600 | 0; this build does not typecheck tests                                                                                                        |
| `npx vitest run packages/gitlode/test/telemetry/performance-workflow.test.ts -t 'preserves completed runs when a later child stalls: false'` |           120 | Expected 1; isolated negative version removes only child environment assignment, normal workflow cleans fixtures; containment assertion fails |
| `npx vitest run packages/gitlode/test/telemetry/performance-workflow.test.ts packages/gitlode/test/telemetry/performance-supervisor.test.ts` |           180 | 0, 2 suites / 47 tests, including both Linux regression cases; one invocation                                                                 |
| `npx tsc -p .cache/readiness-tsconfig.json --listFiles --pretty false`                                                                       |           120 | 1; four pre-existing TS2542 readonly assignments, no new diagnostics                                                                          |
| Same TypeScript command with the test restored from starting OID                                                                             |           120 | 1; same four diagnostics at original lines 207/481/487/493 (changed lines 247/521/527/533)                                                    |
| `npm run lint`                                                                                                                               |           180 | 0                                                                                                                                             |
| `npm run format:write`, then `npm run format:check`                                                                                          |      180 each | 0 / 0                                                                                                                                         |
| `git diff --check`                                                                                                                           |            30 | 0                                                                                                                                             |

The checked strict non-emitting config extends root `tsconfig.base.json`, overrides composite and
declaration emission, and roots the closure at the changed test. Exact config and 277-file closure
(including libraries/dependencies) are `typecheck-config.json` and `typecheck-closure.txt`;
baseline config/closure and first failure logs are retained. Existing readonly fixture mutations
remain outside the containment correction. This is not a green whole-test typecheck. No new module
boundary/import ownership changed, so no architecture check or full-package/OS campaign was run.
Synthetic suite commands exercise harness behavior, not formal calibration or measurement.

Post-suite owned temporary parent contains only tsx/Node compile caches; no generated workflow
fixture remains. Final observation found no live members of launcher-owned groups. The known old
`m2-system-recovery-c79ed35/outside temp/gitlode-performance-vy7lhL` was read only; its state/output
hashes and synthetic five-row/second-child ownership diagnosis are retained. No old artifact was
deleted and no historical ENOTEMPTY/EBUSY attribution was attempted.

New sealed archive: `.cache/m2-readiness-b325065/evidence/linux` (69 entries), copied from
`/home/t-wakabayashi/gitlode-performance/m2-readiness-b325065/evidence`. Manifest SHA-256:
`254f674a1e1056865fdd4a51dc4601b4b604459db45b3585b524290ef9afdfc4`.
All 69 returned copies and the manifest were rehashed against originals before preservation was
reported. Git implementation bytes and formatted Linux test bytes have matching recorded SHA-256.
These are local copies, not external backup. Do not append to sealed evidence. Final document
format/check and Git return checks are stored separately in `.cache/m2-readiness-b325065/return`.

Setup failures were preserved/classified: sandbox Git ownership/ref permissions and WSL access needed
per-command safe.directory/elevated authorized execution; a seal-only inline shell quoting failure
expanded paths incorrectly and performed no seal or workload. Its tool-output transcript excerpt is
explicitly labeled, and the corrected file-backed `seal.sh` succeeded. No product/timing failure was
retried. The negative test failure and both TypeScript failures remain visible.

Assigned containment and Linux operator-preflight questions have implementation evidence and await
independent focused review. Existing TypeScript errors and abrupt-exit cleanup limits remain explicit.
This result is not F, T13B, M2 or publish acceptance. Trunk next reviews the fixed child revision,
then settles history and immutable candidate preservation before assigning target-specific formal
measurement sessions. No formal measurement, candidate freeze, PR, merge or parent-ref update occurred.

## Independent focused review (2026-10-02)

Reviewed fixed checkpoint `bad6f90820c9ccbf556cb217af1728df3357f139`, implementation
`9b518a23c2c8c23762fce221bb2a60cad41afffc`, against starting base
`b325065d9a11b6020b2e043fa4b7a196833a49d4`. The readiness branch was clean at entry.
This is a separate focused review conversation. No implementation correction was made; the only
tracked review change is this appended outcome. Return to trunk means this report, without updating
any trunk/parent ref. The documentation checkpoint OID and local/tracking/actual-remote equality
belong in the session return record, outside this self-referential document.

### Required correction R1: failure-path retention contradicts the documented guarantee

Severity: medium; readiness retention remains unresolved. In
`performance-workflow.test.ts:154`, `temporary.push(root)` registers unconditional `afterEach`
deletion after supervisor completion, clean cleanup evidence and root/parent realpath checking,
but **before** status, completed-run, manifest, fixture-log and generated-fixture containment
assertions (`155–177`). The fixture-parent check at line 153 does not establish containment of the
actual generated fixtures checked at lines 168–171.

Concrete failure path: child completion and cleanup succeed, root/parent checking succeeds, root
is registered, then a generated fixture is outside `workflow-temp` and the relative-path assertion
fails. Vitest still invokes `afterEach`, which recursively removes root, including supervision
artifacts, `fixture-paths.jsonl`, manifest and CLI/counter. The evidence copy at lines 181–182 has
not run. An outside stalled fixture would remain outside that deletion while the mapping/evidence
needed to diagnose it disappears. An unexpected status or completed-run count has the same loss
path even when containment itself is correct. This is code-path analysis, not an independently
executed injected failure. The saved negative-normal log independently inspected in this review
already demonstrates a containment assertion failure at line 169, after teardown registration;
that log does not independently prove post-failure root retention.

The harness guide's statement “If completion or containment cannot be confirmed, the root is
retained for diagnosis” and the implementation outcome's description of registration after
realpath containment are therefore stronger than the implementation. Before readiness is treated
as resolved, reconcile the failure policy and registration/copy order, then supply a bounded
regression for assertion failure after registration that checks the intended retained evidence.
Merely moving registration after containment would still leave later assertion failures deleting
diagnostic artifacts unless the intended retention policy is narrowed explicitly. This review
does not apply that correction.

### Confirmed behavior and limits

- Child-specific TMPDIR/TMP/TEMP are passed through `execFile` without process-global mutation.
  `executePaired` uses `mkdtemp(tmpdir()/gitlode-performance-*)`; the synthetic CLI logs actual
  fixture realpaths, rather than asserting the environment assignment. Both normal and stall
  success paths check direct parent containment. Existing status/failure, completed-run count
  (9/1), unchanged manifest and cleanup-error assertions remain, with `cleanupConfirmed` added.
- On the successful path, child close precedes inspection of the supervisor cleanup barrier;
  explicit root deletion follows generated-root containment, remaining-fixture count (0/1) and
  evidence copying. Root deletion, copied JSON equality and unchanged outside sentinel are checked.
  This is meaningful regression coverage, confirmed by both Linux cases executing independently.
  It exercises explicit `rm(root)`, while `afterEach` later repeats force deletion; it does not
  establish failure-path retention. The outside directory is itself registered for teardown, so
  its evidence copy survives root deletion only until that hook, not as a durable failure archive.
  Failures before root registration retain root; abrupt runner/host loss can also retain it.
- Saved Linux launcher source/hash, setup script and result timestamps show the original preflight
  preceded clone/install/build. Its two-second deadline killed the disposable parent/group, retained
  log/result and found no live owned members. The independent preflight below reproduced this.
  Launcher return/result persistence depends on child `close`; SIGKILL delivery is not a general
  bounded completion barrier. Uninterruptible I/O, escaped/detached groups and host loss remain
  outside the demonstrated guarantee. In particular, harness workers form their own detached
  groups: an outer launcher-group kill is not proof those separate groups died. Successful suites
  supply their harness cleanup evidence; the final outer-group scan adds only its stated scope.
- Independently rehashed all 69 original manifest entries: zero hash/size mismatches, and manifest
  hash `254f674a1e1056865fdd4a51dc4601b4b604459db45b3585b524290ef9afdfc4` matches the packet.
  Git bytes at the fixed implementation, independent clone test bytes, and saved
  `implementation.test.ts`/`formatted.test.ts` all hash to
  `71943a9754dd072dd6e65b9306634c49efec690a22bef1ba713394d8c587fb0e`.
  The original Linux clone started at base with the applied diff; it was not a checkout of the
  later implementation OID. Source/diff/hash evidence establishes the test correspondence, not
  retrospective execution of that OID. Original lint, format and negative-probe results are saved
  log observations in this review, not newly executed results.
- Independently repeated strict non-emitting TypeScript with the saved config, rooted at the changed
  test and extending `tsconfig.base.json`, including its imported scripts/support closure (277
  listed files). Fixed test reports only TS2542 at 247/521/527/533; replacing that test with the
  starting-base version reports the same assignments at 207/481/487/493. Changed lines add no
  diagnostics in this closure. Both commands exit 1; build alone does not typecheck tests. This
  is neither a green whole-test typecheck nor an additional supervisor-test typecheck. Existing
  readonly mutations were not corrected.

### Independent execution and preserved review evidence

New native Linux clone: `/home/t-wakabayashi/gitlode-performance/m2-focused-review-bad6f90/source`,
verified HEAD exactly equals the fixed checkpoint. Reused the prior Linux-installed dependency
directory through a `node_modules` symlink; no install or package/OS campaign was run. Linux Node
v22.23.1 toolchain PATH was explicit and NODE_OPTIONS unset. Sandbox WSL enumeration first returned
E_ACCESSDENIED; authorized elevated WSL access succeeded before workloads, without retrying a
product failure.

Invocation: `node <review-root>/tools/launch.cjs <stage.command.json>`, via saved `run.cjs`.
Launcher SHA-256 remains `23b916a0aee69275359527875cd3a9bc6e20fc9759008bddba0d14f6c2e32c8b`.
Fresh `node <review-root>/tools/preflight.cjs <review-root>/tools` ran first: 2040 ms, exit 124,
SIGKILL, retained stdout/result, parent/descendant IDs recorded, no live observed members. Then:

| Independent command                                                                                                                          | Outer seconds | Exit/result                            |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------: | -------------------------------------- |
| Local `git clone --no-hardlinks --branch feature/otel-redesign_M2_readiness`                                                                 |           120 | 0; fixed HEAD verified                 |
| `npm run build:dev`                                                                                                                          |           600 | 0                                      |
| `npx vitest run packages/gitlode/test/telemetry/performance-workflow.test.ts packages/gitlode/test/telemetry/performance-supervisor.test.ts` |           180 | 0; 2 suites, 47 passed, one invocation |
| `npx tsc -p .cache/readiness-tsconfig.json --listFiles --pretty false`                                                                       |           120 | 1; four existing TS2542                |
| Same TypeScript command with starting-base test, then restore fixed test                                                                     |           120 | 1; same four assignments               |

Final independent clone status is clean; owned temporary parent has only runtime caches, with no
workflow fixture roots. Observed launcher groups have no remaining members. No broad process scan
for ownership beyond these recorded groups, historical residue deletion or formal workload occurred.

Review archive: `.cache/m2-focused-review/evidence/linux`, 35 sealed entries; manifest SHA-256
`531f09e057b41c990a94127624ad7f8e588220567f5ac4d3d16b8b721cfc90e0`.
Source originals remain under `<review-root>/evidence`; returned copies including the manifest were
hash-compared before preservation was reported. Scripts, exact command configs, first TypeScript
failures, closure listings, preflight evidence and scoped process observations are retained. Do not
append to either sealed archive. Documentation format/check and Git return records are separate.

Optional improvement: add a regression specifically exercising the registered teardown hook rather
than only explicit in-body removal, after the required retention policy is resolved. No additional
required correction was found in successful containment, launcher-preflight ordering, sealed-file
correspondence or the checked TypeScript delta. R1 remains a required review correction; passing
suites do not resolve it. This report changes no acceptance, candidate freeze, PR or merge state.

## R1 correction outcome (2026-10-02, independent focused re-review pending)

Started clean on `feature/otel-redesign_M2_readiness` at
`8246f950440d17c044c06e7675c509fab1406842`. Implementation checkpoint:
`0993f21a056dc09b803b56367ac47e75b9f0a7cb`. Only the supervised workflow test and
harness guide changed there; this appended outcome is the additional documentation change.
The final documentation OID and remote equality are recorded separately in the session return.
No production supervisor, acceptance, parent ref, PR, merge, freeze or formal measurement changed.

R1 removes unconditional teardown registration of both diagnostic locations before success.
Child close, cleanupConfirmed/empty cleanupErrors, realpath containment, normal/stall status,
completed-run counts, manifest, actual fixture-path checks and remaining-fixture assertions remain.
Before deleting root, the test copies its entire diagnostic contents to the outside directory,
including supervision artifacts/logs, fixture mapping, manifest, CLI and counter. Assertion failure
before removal retains root; verification failure after removal retains the copied diagnostics.
The catch reports both paths and rethrows the original error without failure-path cleanup.
Only after all assertions pass are the owned root and outside directory registered for afterEach.
Copy/storage failures, partially failing removal, abrupt runner/host loss and arbitrary abnormal
termination do not promise complete preservation. The earlier outcome's stronger registration
wording is superseded by this correction and the updated harness guide.

Two finite regression cases run the stall test in a separate Vitest process, inject an assertion
failure after process completion/before removal or after removal, require exit 1 and the intended
assertion, then inspect retention **after the child Vitest exits and its real afterEach has run**.
They verify supervision cleanup evidence, completed runs, fixture paths, manifest, CLI/counter and
unchanged outside sentinel; the post-removal case also verifies copied evidence equality and missing
root. Only after ownership, containment and process cleanup checks pass do their own afterEach hooks
dispose these newly created probe fixtures. Retention paths and original assertion output are in the
suite logs. Successful normal/stall paths still execute their existing evidence assertions and clean
both locations. This is reported implementation evidence awaiting independent review.

Fresh native Linux clone: `/home/t-wakabayashi/gitlode-performance/m2-r1-8246f95/source`.
Tool versions remain Node v22.23.1, npm 10.9.8 and Git 2.53.0; exact kernel, filesystem/free-space
observations and environment are in `environment.txt`. Before clone/build, the reused launcher
SHA-256 `23b916a0aee69275359527875cd3a9bc6e20fc9759008bddba0d14f6c2e32c8b`
passed a fresh disposable deadline preflight: 2048 ms, exit 124, SIGKILL, retained log/result,
no observed live owned processes. This demonstrates the bounded disposable case, with the prior
close-based launcher/escaped-group/kernel-I/O/host-loss limitations unchanged. Linux toolchain PATH
is explicit and NODE_OPTIONS unset. Later sessions must establish their own launcher readiness.

Commands use `node <workspace>/.cache/m2-r1-8246f95/run.cjs <root> <stage> <seconds> <command> <args>`;
exact scripts, per-stage JSON configurations, stdout/stderr and result JSON are archived.

| Validation                                                                                                                                   | Outer seconds | Result                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------: | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build:dev`                                                                                                                          |           600 | 0; test typechecking remains separate                                                                                            |
| `npx vitest run packages/gitlode/test/telemetry/performance-workflow.test.ts packages/gitlode/test/telemetry/performance-supervisor.test.ts` |           180 | Corrected setup: 0, 2 suites / 49 tests including both retention probes; final diagnostic-only code correction: 0, same 49 tests |
| `npx tsc -p .cache/readiness-tsconfig.json --listFiles --pretty false`                                                                       |           120 | Final: 1, only four existing TS2542 at 343/617/623/629                                                                           |
| Same strict command with test from starting checkpoint, then restored implementation                                                         |           120 | 1, same four readonly assignments at 247/521/527/533                                                                             |
| `npm run lint`                                                                                                                               |           180 | Final 0                                                                                                                          |
| `npm run format:write`, `npm run format:check`                                                                                               |      180 each | Final 0 / 0                                                                                                                      |
| `git diff --check`                                                                                                                           |            30 | 0                                                                                                                                |

The saved strict config matches the prior non-emitting configuration and extends root
`tsconfig.base.json`, rooted at the changed test. Final and baseline closures are identical,
277 files, including dependencies and imported scripts/support. First typecheck had four new
TS2345 diagnostics (capture indexing and inferred array tuples), and first lint had three no-console
diagnostics. These were corrected using checked capture indexing, readonly tuples and stderr writes;
first logs remain archived. Existing readonly mutations were not repaired. No architecture boundary
changed; no full suite, package/OS campaign or formal workload ran.

Two setup failures remain visible: initial shell CRLF made the final node_modules symlink name
contain CR, causing format exit 127; file-backed LF script and correctly named symlink fixed it.
First suites then reported 4 failures / 45 passes because the overly long owned TEMP produced a tsx
Unix socket path beyond Linux's path limit (`listen EADDRINUSE` before supervisor startup). The
corrected fresh owned TEMP is `/tmp/gitlode-r1-8246f95`; limits and workload assertions were unchanged.
Initial roots and outside sentinels were preserved, copied into `first-setup-residue` and left intact;
no historical residue or sealed evidence was modified. Final short TEMP contains runtime caches,
no workflow fixture roots. Scoped final observation found no live launcher-group members or command
lines referring to this session's workflow fixture paths; this is not a universal process guarantee.

Sealed new archive: `.cache/m2-r1-8246f95/evidence/linux`, 663 entries (including first setup
residue/cache copies). Manifest SHA-256:
`80c21ea8674c6ea0136b7d2d2e3b51c7cb954419895122511f64317ed3d0aff3`.
All returned files and manifest were hash-checked against native Linux originals before reporting.
Final Linux test and workspace implementation bytes share SHA-256
`e411504aa95e28e3fdfbe0337e97638061157a46e8b630ddd479b5f70c2f9efa`.
Execution used the starting-checkpoint clone with explicitly copied changes; source/hash evidence
establishes correspondence to the implementation checkpoint. These are local copies, not external
backup. Do not append to this archive. Final document formatting and Git return records are separate
under `.cache/m2-r1-8246f95/return`.

R1 now has bounded failure-retention regression evidence and reconciled documentation; readiness
remains pending independent focused re-review of the fixed branch revision. This does not establish
F, T13B, M2 or publish acceptance. Return to trunk is this report only, with no trunk ref update.

## Independent focused R1 re-review (2026-10-02)

Fixed review target: `7edd62c87384399190c7a5bf89ae4048b155347d`; implementation:
`0993f21a056dc09b803b56367ac47e75b9f0a7cb`; pre-correction:
`8246f950440d17c044c06e7675c509fab1406842`. Entry was clean on
`feature/otel-redesign_M2_readiness`. The implementation-to-target delta is this readiness
report only. This separate review changes only this document, without implementation repair.
Return to trunk means the report; the branch stays unchanged in name and no parent ref is updated.
The documentation checkpoint and remote equality are recorded separately in the session return.

### Decision and required finding R2

**R1's assertion-retention correction is confirmed, but R1 as a complete failure-policy closure
and the readiness slice are not accepted yet.** Required R2 (medium): reconcile diagnostic-output
failure with the original-error guarantee. At `performance-workflow.test.ts:212`, the catch calls
`process.stderr.write(...)` before `throw error`, without a protective catch, callback or stream-error
policy. Concrete path: an assertion, copy or removal fails, then reporting to a broken stderr fails.
A synchronous reporting exception bypasses the original rethrow; an asynchronous write failure
(for example EPIPE on a closed pipe) can introduce a stream error rather than preserve the assertion
as the sole authoritative failure. Retained files are not intentionally deleted, but the original
cause and usable path announcement are no longer guaranteed. The correction outcome says the catch
rethrows the original error, and the guide excludes copy/storage and abrupt termination from complete
retention while giving no diagnostic-output qualification. This finding is source-path analysis;
no broken-stderr injection was independently executed. The passing retention probes use healthy
captured stderr and do not establish this failure case.

Before closure, make reporting best effort with a defined original-error policy and suitable bounded
verification, or explicitly narrow the documented guarantee for diagnostic-channel failure if that
policy is accepted by trunk. No implementation change is made in this review. Copy failure already
stops before root removal; removal failure can leave a partial root but follows a completed copy.
Successful-path afterEach removal failures remain cleanup failures and can retain owned locations;
no failed body has these locations registered for cleanup. These limits do not invalidate the two
ordinary assertion-retention regressions. R2 is required; the optional items below are not blockers.

### Independently confirmed scope

- Before-removal assertion failure leaves root and outside unregistered; after-removal failure
  leaves the full diagnostic copy outside. Both new regressions passed after a separate Vitest
  child exited nonzero, so inspection really follows that child's afterEach, rather than an
  in-body simulation. They inspect supervision cleanup evidence, one completed run, manifest,
  two actual fixture paths, CLI/counter, sentinel, and post-removal copied evidence equality/root
  absence. Successful normal/stall paths preserve the existing assertions and clean both regions.
- Nested Vitest selects the exact workflow file and the stall-true test by `-t`; the regression
  names do not match that filter, preventing recursive probe execution. Child-specific injection
  occurs after supervisor completion and before/after root removal. Expected exit 1 and injected
  assertion text are required. Inner workflow timeout is 25 seconds, test timeout 30 seconds,
  nested execFile timeout 45 seconds and parent probe timeout 60 seconds. Normal probes wait for
  child close, validate cleanupConfirmed/empty errors, realpaths and owned temporary-parent/prefix
  containment before registering their two observed regions for parent afterEach disposal.
  Timeout/abrupt termination does not prove all nested descendants exited and may retain probe
  roots; no universal cleanup guarantee is inferred from execFile's timeout.
- Production supervisor, thresholds and fixture recipe are unchanged in the reviewed delta.
  The fixture quantities and existing workflow assertions remain; no architecture boundary changed.
- Saved correction archive was checked before new workloads: all 663 entries match size/hash and
  manifest `80c21ea8674c6ea0136b7d2d2e3b51c7cb954419895122511f64317ed3d0aff3` matches.
  Saved `final.test.ts`, independently executed fixed test, and implementation Git bytes all hash
  to `e411504aa95e28e3fdfbe0337e97638061157a46e8b630ddd479b5f70c2f9efa`.
  Saved `implementation.test.ts` is an earlier intermediate version, not the final implementation;
  correspondence relies on `final.test.ts`. Original execution used copied changes on a baseline
  clone; this review instead checked out the exact fixed target. Saved final suites/typecheck logs
  corroborate the prior report. Original setup failures, lint and initial corrections are saved-log
  observations only, not independently rerun historical campaigns.

### Independent execution and evidence

Native clone: `/home/t-wakabayashi/gitlode-performance/m2-r1-review-7edd62c/source`, exact fixed
HEAD, reusing the prior Linux node_modules through a symlink. Explicit Linux Node v22.23.1 PATH,
npm 10.9.8, Git 2.53.0 and unset NODE_OPTIONS; kernel/storage/free-space observations are archived.
Sandbox WSL enumeration returned E_ACCESSDENIED before workloads; elevated authorized WSL access
succeeded. Per-command safe.directory handles sandbox repository ownership without global config.

Fresh Linux launcher preflight preceded clone/build: 2052 ms, exit 124, SIGKILL, retained logs/result,
no observed live disposable parent/group members. Launcher hash and close-based/escaped-group/kernel
I/O/host-loss limits remain those recorded above. Invocation uses
`node <review-root>/tools/run.cjs <review-root> <stage> <seconds> <command> <args>` with
`TMPDIR=/tmp/gl-r1-review`. Exact configs and logs are archived.

| Independent validation                                                                                                                       | Outer seconds | Result                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------: | ------------------------------------------------------------ |
| Local clone of the readiness branch, fixed HEAD assertion                                                                                    |           120 | 0                                                            |
| `npm run build:dev`                                                                                                                          |           600 | 0                                                            |
| `npx vitest run packages/gitlode/test/telemetry/performance-workflow.test.ts packages/gitlode/test/telemetry/performance-supervisor.test.ts` |           180 | 0; 2 suites / 49 tests, including both new regressions, once |
| `npx tsc -p .cache/readiness-tsconfig.json --listFiles --pretty false`                                                                       |           120 | 1; four existing TS2542, no new diagnostics                  |
| Same strict command with pre-correction test, then restore fixed bytes                                                                       |           120 | 1; same four readonly assignments                            |
| `npm run format:check`; `git diff --check`                                                                                                   |       180; 30 | 0; 0                                                         |

The saved strict non-emitting configuration extends tsconfig.base.json and roots at the changed test.
Both imported closures contain the same 277 files. Fixed diagnostics are at 343/617/623/629;
pre-correction diagnostics at 247/521/527/533 identify the same mutations. Neither exit 1 is a success,
and build does not typecheck tests or prove a green whole-test/supervisor-test closure.
Final clone status is clean. The fresh owned TEMP contains runtime caches, no workflow fixture roots;
recorded launcher groups have no live observed members. This scoped observation does not cover all
escaped groups. Old residue and sealed archives were preserved.

Review archive: `.cache/m2-r1-review/evidence/linux`, 38 sealed entries, manifest SHA-256
`021127cdc31eebad0129ba66e3731acbf0e4a02b421644337a5521462535a8b1`.
Returned copies and manifest were hash-compared with native originals before reporting preservation.
These are local copies, not external backup. Do not append to this archive. Review scripts and final
document format/write/check and Git return evidence are separate under `.cache/m2-r1-review`.

Optional improvements: explicitly assert the nested selected-test count, and document nested timeout
residue alongside the existing abrupt-runner limit. Neither is an additional required correction.
No full suite, package/OS campaign, formal measurement or historical failure reproduction was run.
No PR, merge, parent-ref update, freeze or acceptance-record update occurred. This is focused review
only and does not establish F, T13B, M2 or publish acceptance; trunk receives the unresolved R2 report.

## R2 correction outcome (2026-10-02, trunk limited-diff review pending)

Started clean on `feature/otel-redesign_M2_readiness` at
`f8ef0bda04b5ed4fe41a5029036bbd0af96dab68`. Implementation checkpoint is `93a359d`;
the final documentation checkpoint and local/tracking/actual-remote equality are recorded in the
session return, avoiding a self-referential OID here. Changed paths are the workflow test, the harness
guide's failure-policy paragraph, and this outcome only.

R2 replaces the failure catch's stream write with a small synchronous `writeSync(2, message)` inside
a local try/catch, followed by rethrow of the original error object. The test-local writer seam adds
no production abstraction. Notification is best effort: its exception neither replaces the original
failure nor deletes retained files, and this path enqueues no asynchronous stream error. Unavailable
stderr does not guarantee a retained-path announcement; partial writes, blocked synchronous I/O and
host abnormalities do not receive universal notification or exit guarantees. No retries, fallback
destinations, logging framework or global stream handler were added. Retention registration, cleanup
barrier, normal/stall assertions and nested Vitest selection/timeouts remain unchanged.

Two local regression cases check the emitted locations on success, deterministic writer failure,
single invocation, original-error reference identity and unchanged retained file contents. They do
not break runner stderr. The existing nested before/after-removal probes still establish retention
after actual failed-test teardown, using healthy captured stderr and the real default synchronous
write. Ordinary runner/host-loss and storage/removal limitations recorded above remain in effect.

Reported execution used native Linux clone
`/home/t-wakabayashi/gitlode-performance/m2-r2-f8ef0bd/source`, asserted at the exact starting OID,
with explicitly copied changed files and the existing Linux node_modules symlink. Node v22.23.1,
npm 10.9.8, Git 2.53.0, WSL2 Linux 6.18.33.1, ext2/ext3 and 948 GiB available were observed.
PATH explicitly selected native tools and NODE_OPTIONS was unset. Sandbox WSL access returned
E_ACCESSDENIED before workloads; authorized elevated execution succeeded. Fresh external-launcher
preflight preceded clone/validation: 2-second deadline, 2053 ms return, exit 124/SIGKILL, retained
log/result, no live observed owned processes. Launcher SHA-256 and its bounded disposable-case
limitations remain those recorded above; this is not performance or environment acceptance.

Exact configurations/logs use `node <root>/tools/run.cjs <root> <stage> <seconds> <command> <args>`
with owned `TMPDIR=/tmp/gl-r2-f8ef0bd`:

| Validation                                                                                                                                      | Outer seconds | Result                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------: | ------------------------------------------------------- |
| `npm run format:write`                                                                                                                          |           180 | 0; formatted changed bytes copied back                  |
| `npx vitest run packages/gitlode/test/telemetry/performance-workflow.test.ts -t 'preserves the original failure when diagnostic writing fails'` |           120 | 0; 2 passed, 18 skipped                                 |
| `npx vitest run packages/gitlode/test/telemetry/performance-workflow.test.ts packages/gitlode/test/telemetry/performance-supervisor.test.ts`    |           180 | 0; 2 suites / 51 tests, including both retention probes |
| `npx tsc -p .cache/readiness-tsconfig.json --listFiles --pretty false`                                                                          |           120 | 1; only existing four TS2542 at 385/659/665/671         |
| `npm run lint`; `npm run format:check`; `git diff --check`                                                                                      |  180; 180; 30 | 0; 0; 0                                                 |

The strict non-emitting config extends tsconfig.base.json and roots at the changed test. Its imported
closure is 277 files, equal after native-root normalization to the saved fixed-checkpoint R1 review
closure. Comparison reuses that prior log (not a new baseline execution); the four readonly mutations
correspond to its 343/617/623/629 diagnostics and remain separate unresolved work. There are no new
diagnostics; this is not a green whole-test typecheck. No new dependency or architecture boundary
requires a repeated full build/package/OS campaign. No formal workload was run.

Sealed archive: `.cache/m2-r2-f8ef0bd/evidence/linux`, 40 entries; manifest SHA-256
`e626bb764ba72231238a761b88d24dca89c2b391eb8597c38f612998b1cd49d1`.
All returned files and manifest were hash-checked against native originals. Final executed test,
saved test and workspace bytes share SHA-256
`5da23fd1c1a10ba90acb82bf4d55045054007aca310ba062ac177343153463dd`.
These are local copies, not external backup; do not append to the sealed archive. Post-validation
owned TEMP has runtime caches and no workflow fixture roots; scoped launcher-group observation
found no live members. Old archives/residue were preserved. Final document formatting and Git return
records are separate under `.cache/m2-r2-f8ef0bd`.

R2 has limited implementation and regression evidence and awaits trunk's limited-diff review.
No PR, merge, parent-ref update, freeze, formal measurement or acceptance update was performed.
This outcome does not establish F, T13B, M2 or publish acceptance.

## Trunk limited-diff disposition (2026-10-02)

Accepted R2 at `93a359d1b8afac7eb288758f674ad0be76bef480`, delivered by
`102296f7e110613c4e097c77126e8893a1c52f55`. Combined with the independent R1 retention
review, the readiness slice is accepted for integration preparation. No mandatory finding remains
within this slice; this does not establish formal measurement, F, M2 or release acceptance.

Trunk inspected the correction: the real failure catch invokes the test-local helper, whose protected
synchronous fd-2 write is followed by rethrow of the unchanged error outside that protected block.
There is no stream enqueue, deletion, retry or global handler in this path. The injected writer tests
cover healthy and throwing writes, original-error reference identity and preserved file bytes.
Prior independently accepted retention/barrier behavior is unchanged. Notification remains best effort.

Trunk rehashed all 40 returned manifest entries without mismatch and confirmed the manifest hash and
saved/current test hash recorded above. Saved logs confirm two reporting cases, the 51-test suite,
and four TS2542 diagnostics only. These are inspected execution logs, not a new independent test run;
the already established baseline diagnostic comparison is reused. Trunk ran diff whitespace checks
and document formatting checks; no test/build or historical reproduction campaign was repeated.

The four existing readonly diagnostics, launcher/abrupt-exit limits, historical residue and unrelated
instability observations remain open with their existing scope. Integration should use a human-approved
PR from this child to `feature/otel-redesign_M2`, followed by human squash. Preserve the source before
deletion and confirm squash tree identity. Only then assign history review and fixed product/harness
preservation; no candidate is frozen by this disposition.
