# M2 pre-measurement readiness packet

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
