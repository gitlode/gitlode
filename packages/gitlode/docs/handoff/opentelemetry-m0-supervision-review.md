# M0 supervision: independent review packet

## Focused re-review after R1

Completed: the independent reviewer accepted R1 and approved freeze at
`a53a5b83d18f9e493ebb39c4db481b762448743f`, with no required corrections. The reviewer reported
matching HEAD, a clean worktree, archive/checkpoint implementation parity, all 24 evidence-manifest
entries verified, and successful saved Linux checks. Supervisor finalization fault tests combined
with thin entrypoint code review and real entrypoint tests were judged sufficient; the setup-failure
test was not misrepresented as a finalization E2E test. No new tests or code changes were needed.
The planning owner confirmed matching HEAD and a clean worktree on receipt, accepts this outcome,
and freezes that OID as the measurement harness. M0 and formal performance acceptance remain open.
The next assignment is the [one-target measurement](opentelemetry-m0-supervision.md#next-bounded-assignment-one-repository-target).

The instructions below record the completed re-review assignment; pending/blocked wording in those
historical instructions is superseded by this outcome.

Resume the existing review conversation. R1 implementation and Linux focused checks are complete;
review acceptance is still pending. The original assignment and initial findings below are history.
The planning owner is preserving the implementation, correction, and updated handoffs in a checkpoint
commit. Use the exact checkpoint OID supplied with the review request, not a mutable working diff.
Compare actual HEAD to that OID and record any newer changes separately.

Read the [R1 outcome and evidence](opentelemetry-m0-supervision.md#r1-correction-result) and the
[correction acceptance criteria](opentelemetry-m0-supervision-correction.md). Inspect the correction-only
patch in `D:\gitlode_test\m0-supervision-r1-20260910-2d164d9\evidence\r1-correction.patch`,
then check the corrected implementation at the checkpoint. The prior review covered the surrounding
supervision implementation; concentrate on final diagnostic/snapshot persistence, recovery bounded
to one attempt, in-memory failure status, operator reporting when terminal evidence is unavailable,
and preservation of lifecycle cleanup. Inspect independent failure-injection tests and saved logs.
The operator integration failure test covers setup failure; do not mislabel it as an end-to-end
finalization-write fault test. Judge whether combined supervisor and entrypoint coverage is sufficient.

The reported `/proc` test timeout was corrected by a deterministic regular-file fault target. Inspect
the final test and its successful rerun; do not rerun the abandoned fault target. Reproduce only a
concrete unresolved concern with bounded execution. Do not repeat the full suite, formally measure,
edit code, commit, or expand optional work into blockers without a new material finding.

Return the reviewed OID, R1 accepted or still open with a concrete failure path, evidence checked,
and whether the checkpoint is ready to freeze. This checkpoint is not already frozen. The planning
owner will record acceptance and assign measurement in a separate conversation after a passing review.

## Assignment and boundary

Start this assignment in a new conversation with this packet and repository files as input; the
implementation conversation remains the planning owner. Review the existing implementation without
reimplementing it. Return findings and a freeze recommendation. Do not run formal calibration,
edit production telemetry, change thresholds, commit, merge, or start the full matrix in this review.
The human has delegated session allocation; generic continuation instructions do not cancel it.

Review state: completed in a separate branch conversation; the human returned its outcome to the
planning conversation. Freeze is blocked by R1, final evidence-write failures bypassing supervision
failure handling. The planning owner checked that failure path against the current source and
accepted the finding. See the [bounded correction packet](opentelemetry-m0-supervision-correction.md).

The reviewer reported unchanged HEAD, inventory, and hashes across the review; all implementation
files matched the archived copies. Archived validation and checksums were inspected without rerunning
formal measurements or the full suite. No files were edited in the review conversation. These are
reviewer-reported checks, not newly executed validation by the planning owner.

Required: handle final diagnostic-log and snapshot write errors as supervision failures, with
separate fault-injection tests. Optional: make current/event identity consistent; assess timing IPC
and stderr-drain effects during the one-target measurement. Neither optional item is a demonstrated
performance defect or a new freeze blocker.

## Inputs and identity

- Repository: `C:\Users\t-wakabayashi\source\gitlode`.
- Branch: `feature/otel-redesign_T13B`.
- Implementation base: `2d164d9483c60d5f9c68a54da6b445a527d4ff01`.
- Review target: the uncommitted supervision diff, including untracked files, against that base.
- Original implementation archive: `D:\gitlode_test\m0-supervision-20260910-2d164d9`.
- That archive predates this session-management update. Treat later handoff/routing edits as such,
  not as additional implementation test evidence.

Read `AGENTS.md`, `docs/agents/collaborative-work.md`, `docs/design/telemetry.md`,
`docs/design/telemetry-performance.md`, `docs/design/telemetry-catalog/performance.yaml`,
`docs/contributing/telemetry-performance-harness.md`, the recovery plan, and the
[supervision exit packet](opentelemetry-m0-supervision.md). Paths starting with `docs/` are relative
to `packages/gitlode/`.

Before reviewing, record actual HEAD, branch, changed-file inventory, and file hashes. Include new
untracked files: a plain `git diff` omits them. Compare implementation files with the archived
`changed-files/` copies and hashes. If substantive code changed since the reported test evidence,
review the actual change and identify which validation must be renewed. Do not assume the archived
tests validate newer code. Recheck hashes at review end so a moving target is not marked reviewed.
Use command-scoped `git -c safe.directory=C:/Users/t-wakabayashi/source/gitlode` if needed.

## Review scope

The implementation consists of:

- `packages/gitlode/scripts/telemetry-performance-supervised.ts`;
- `packages/gitlode/scripts/tooling/performance-supervisor.ts` and `performance-progress.ts`;
- integration changes in `scripts/telemetry-performance.ts`, `scripts/telemetry-aggregation.ts`,
  and `test/support/performance-harness.ts` under `packages/gitlode/`;
- `packages/gitlode/package.json` command routing;
- `packages/gitlode/test/telemetry/performance-supervisor.test.ts` and the workflow integration
  additions in `performance-workflow.test.ts`; and
- the supervision design/catalog/operator documentation changes.

Check these concrete acceptance questions against code and evidence:

1. Can a blocked worker event loop, failed launch, unexpected exit, or stuck descendant leave the
   command waiting beyond its stated deadlines and cleanup limits? Does termination affect only
   owned processes? Distinguish documented host/SIGKILL limitations from correctable lifecycle bugs.
2. Do preparation, CLI execution, sidecar, aggregation, artifact processing, and cleanup have correct
   stage ownership? Do progress messages preserve useful identity without extending a stalled stage?
3. Does deadline/interruption/persistence failure remain inconclusive, with completed evidence
   preserved and partial evidence excluded from formal acceptance? Verify both normal and abnormal
   completion paths, including the difference between worker completion and performance acceptance.
4. Could supervision IPC, logging, disk writes, or changed output handling materially contaminate
   timed measurements or RSS observation? Separate a demonstrated defect from an unmeasured risk.
5. Are child diagnostics bounded, drained, and separated from structured artifacts? Can errors in
   sampling, evidence writes, or IPC escape the intended failure handling?
6. Does the operator entrypoint work under Linux/WSL2 with the actual worker loader, and do the
   promised tests exercise the relevant behavior rather than only mocks of the supervisor protocol?

Prior evidence reports 90 files / 1,147 passing tests, repository lint, strict typechecking of the
three new modules, and formatting. Inspect logs and relevant tests. Do not rerun the full suite just
to reproduce a count; use a bounded focused reproduction if a finding needs evidence. Linux checks
belong in the isolated validation checkout described in the exit packet. Preserve existing archives
and immutable release trees. This review does not calibrate any fixtures.

## Return and next owner

Return a concise report containing the actual reviewed identity, required corrections with
file/line references and the affected accepted contract, optional improvements separately, evidence
checked or newly obtained, and whether the diff is ready to freeze. Every blocker needs a concrete
failure path or explicit missing requirement; passing tests alone do not prove readiness.

The planning owner consolidates corrections into one bounded implementation assignment if needed.
After correction verification and focused re-review, freeze the change in a commit and record its
actual OID in the measurement packet. Only then start the separate one-target measurement session.
Follow the existing two-round diagnosis rule; do not broaden review into redesign or M2 work.
