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
