# Stage B creation-time handle audit assignment (2026-10-19)

## Trunk disposition and scope

Trunk accepts all five round-2 corrections at fixed implementation
`a5dae83e4f55b3631061959bcf1bcd98154130e6`, based on independent review `7574619`.
P2 remains accepted. Runtime handle audit is still pending; standalone Stage B/P1/helper integration/
PR readiness remain open. Execute the six-step plan in
[the independent review](opentelemetry-m2-stage-b-round2-review.md#separate-audit-verdict-and-smallest-executable-plan),
subject to the controlling limits below. Do not reopen accepted fixes without concrete new evidence.

Work on `feature/otel-redesign_M2_fixture` from this packet checkpoint, keeping parent M2 `4f09265`
and F2 `4ea24d5` immutable. Existing implementation/helper/test/configuration bytes must remain fixed.
Use temporary invocation-local copies and existing Windows PowerShell/.NET Add-Type only. No external
utility, new dependency, toolchain installation, privileges elevation or global settings change.

## Approved oracle

Trunk explicitly adopts creation-time inheritance of the direct audited workload as the runtime
oracle. Only the diagnostic copy adds CREATE_SUSPENDED to the existing creation-time job assignment;
JOB_LIST/HANDLE_LIST and security remain unchanged. This intentional scheduling perturbation must
be recorded, not represented as an untouched production execution. It verifies inheritance before
workload code closes/reuses handles; it does not verify every descendant or adversarial duplication.

Require complete PSS handle-table capture/walk with matching count, successful object-identity
comparisons and explained entries, not numeric identity or type/count alone. Check the three allowed
NUL/stdout/stderr objects; exclude the job, three host control std handles and parent workload read
ends. Validate API/layout/query/duplication outcomes and positive/negative comparison controls.
Unsupported entries, failed queries or invalid handles are inconclusive, never proof of absence.
Follow documented APIs and the linked review's restrictions on duplication and information capture.

## Finite execution

Prepare and compile the diagnostic without launching workloads first. Verify x64 API/layout and
normal-contributor token prerequisites, exact transformations from fixed source and cleanup paths.
Do not use sandbox execution as ordinary-token evidence. An unavailable prerequisite returns
pending with its precise reason; do not install tools or substitute a weaker oracle.

Authorize one bounded invocation containing at most TWO sequential workload launches:

1. Baseline: snapshot while suspended, prove allowed/excluded object identities, release local
   duplicates/marker/snapshot before resuming, then observe fixed output/nonzero exit, job absence,
   drain settlement and host close through the existing paths.
2. Sensitivity: verify baseline table on a second suspended workload, deliberately duplicate the
   private job and three control handles into that target, then prove the same oracle rejects all
   four objects regardless of numeric value. Never resume the contaminated workload. Establish
   drains and close parent writers, cancel through the live owner and observe absence/output.
   Expected rejection proves diagnostic sensitivity, not a production leak.

Use existing ready/work/case/driver deadlines and shared cleanup reserve; the second launch does not
receive another enclosing allowance. Check remaining time before capture/walk/second admission.
PSS/native calls are non-preemptible; the enclosing owner bounds waiting and retains roots on unknown
settlement. Guard snapshot/duplicate/thread cleanup, preserve primary and secondary errors, no unsafe
ambiguous-close retries. Stop the invocation at the first unexpected failure; no runtime retries,
timeout extension or broad process termination. A setup failure returns its evidence and diagnosis.

Keep all roots, record only bounded handle type/ownership/status data, never object paths or inherited
environment values. Preserve source/token/PID identity, original/diagnostic hashes, capture/walk
counts/statuses, comparison controls, sensitivity and actual absence/pipe/close receipts. Raw handle
values are context-bound evidence, never persistent process targets. Seal and reread evidence bytes.
Do not run the nine-case suite, full OS/package campaign or formal workload for this audit.

## Delivery and remaining decisions

Append outcome here with pass/fail/inconclusive and separate baseline, sensitivity, cleanup and
token verdicts. A successful diagnostic returns for trunk evidence review; do not self-accept
Stage B/P1/PR readiness or integrate helpers. Preserve prior seals and accepted implementation.
Commit documentation only, with exact archive/source references; no temporary diagnostic edits
in existing runtime files. Format write/check, diff check, normal push and actual remote/clean/
unchanged parent/F2 verification. Remain on child. Warn before real-process execution about time.
No PR, merge, freeze, Unix P1 repair, helper integration, formal runs or acceptance record update.
