# M0 supervision: R1 correction packet

Status: implementation and Linux focused verification are complete. The original assignment below
is historical. The planning owner is preserving a checkpoint under the human's subsequent commit
authorization; the implementation session's no-commit boundary below does not prohibit that action.
Next: [focused re-review](opentelemetry-m0-supervision-review.md#focused-re-review-after-r1).

## Assignment

Use a separate implementation conversation. This is correction round 1 after the
[independent review](opentelemetry-m0-supervision-review.md). Own only R1: final evidence-write
failures must remain supervision failures instead of escaping through an unhandled rejection.
The planning conversation retains milestone ownership. Do not freeze, commit, merge, run formal
calibration, or start the full matrix in this assignment. Return the verified diff for focused
re-review in the existing review conversation.

Repository: `C:\Users\t-wakabayashi\source\gitlode`, branch `feature/otel-redesign_T13B`,
base HEAD `2d164d9483c60d5f9c68a54da6b445a527d4ff01`, plus the existing uncommitted supervision work.
Record actual HEAD, changed-file inventory (including untracked files), and hashes before editing.
Preserve existing work. The archive `D:\gitlode_test\m0-supervision-20260910-2d164d9` is prior
implementation evidence, not evidence that R1 is fixed. Do not overwrite it.

Read `AGENTS.md`, the collaboration guide, review outcome, supervision exit/environment packets,
`docs/design/telemetry-performance.md`, `docs/design/telemetry-catalog/performance.yaml`, and
`docs/contributing/telemetry-performance-harness.md` under `packages/gitlode/`.

## Failure and required behavior

After worker completion and queued writes, `performance-supervisor.ts` directly awaits the final
diagnostic `writeFile` and `writeAtomicJson`. Either can reject before a supervision result returns.
The operator entrypoint also does not handle that rejection. A last snapshot can remain `running`.
Ordinary uncaught-error nonzero exit does not provide the defined inconclusive supervision result.
Owned-group cleanup currently precedes these final writes; preserve that ordering and its guarantees.

Implement a small, explicit finalization failure path with these acceptance criteria:

- A rejected final diagnostic-log write and a rejected final snapshot write each yield a defined
  inconclusive result and exit code 2, even after an otherwise successful worker completion.
- Preserve owned-process cleanup, timer/listener cleanup, and earlier completed evidence. Do not
  restart or repeat the measured workflow to repair evidence.
- If storage still permits it, write an inconclusive terminal snapshot with an identifiable reason.
  Keep recovery attempts finite; do not introduce another indefinite retry loop.
- If terminal evidence cannot be persisted at all, still return failure and report the failed
  persistence through bounded stderr diagnostics. Do not claim that an existing `running` snapshot
  is finalized, or that a terminal artifact was saved when it was not. Persistent storage failure
  makes guaranteed on-disk status replacement impossible; document this limit and operator behavior.
- A failed raw diagnostic log must not prevent an otherwise writable terminal failure snapshot.
  Preserve the separation between raw diagnostics and structured evidence.
- Preserve existing successful completion, worker exit-2 semantics, deadline behavior, and
  the distinction between supervision completion and formal performance acceptance.

Do not merely wrap the entrypoint in a catch that suppresses the rejection without preserving these
semantics. A narrowly scoped injectable writer or equivalent test seam is acceptable if needed;
choose the smallest maintainable implementation. Do not create a general storage framework.

## Scope and validation

Allowed code: `packages/gitlode/scripts/tooling/performance-supervisor.ts`,
`scripts/telemetry-performance-supervised.ts`, and their supervision/workflow tests. Update the
canonical supervision design, catalog, and operator guide only as needed to describe the failure
behavior accurately. Update the exit packet with new evidence. Related IPC changes require a direct
R1 reason. Production telemetry, measurement algorithms, thresholds, fixtures, workspace layout,
and optional event-history cleanup are outside this correction.

Add deterministic tests that independently fail the final diagnostic write and the final snapshot
write after a worker successfully completes. Cover both recoverable terminal persistence and a
persistently unwritable terminal destination; assert the defined result, available evidence,
bounded failure reporting, and lifecycle completion. Inject faults only into isolated test storage
or explicit test dependencies, never fill a disk or change permissions on shared archives.

Validate on Linux using a new isolated correction checkout/attempt with the prepared toolchain:

- supervisor focused tests, including R1 fault injection;
- actual tsx entrypoint normal/stalled-child workflow integration tests, plus operator failure
  reporting coverage appropriate to any entrypoint changes;
- strict typecheck of the three new supervision/IPC/entrypoint modules using the prior command;
- repository lint, `npm run format:write`, `npm run format:check`, and `git diff --check`.

Run the required development build for that checkout. Broaden tests only if affected dependencies
or failures justify it. No formal measurement is needed to establish this fix. Save new logs and
changed-file hashes in a distinct evidence directory, recording the actual base and correction diff.

## Return and follow-up

Return R1 behavior before/after, changed files, commands/results, evidence paths and hashes, and
remaining limitations. Keep freeze blocked pending focused re-review. The reviewer should inspect
R1 and affected lifecycle/entrypoint paths, not repeat the entire previous review absent a new
material concern. If R1 remains open, return a concrete remaining failure path.

Optional event-history consistency is deferred. The IPC/stderr measurement effect remains an
unmeasured risk to observe during the planned one-target session, not a required redesign. A passed
comparison alone cannot quantify supervision bias; if evidence suggests material interference,
return a separate diagnosis request rather than silently altering the measurement method.
