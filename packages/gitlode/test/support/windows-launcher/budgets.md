# Stage B correction round 1 finite validation budgets

These ceilings remain unchanged and are hang detection, not performance thresholds. The original
first failures and diagnosis are immutable; this correction awaits independent review. Existing
fixture helpers, default five-second unit timeout and Windows two-worker cap are unchanged.

| Boundary                                   |                           Maximum ms | Implemented cutoff                                                                                                                                                                             |
| ------------------------------------------ | -----------------------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh host ready                           |                                6,000 | Clip to enclosing work cutoff; compilation/startup are inside it.                                                                                                                              |
| Native entry                               |                               15,000 | Clock starts before native launch; work cutoff at 11,000 reserves 4,000 for cleanup.                                                                                                           |
| Outer scenario operation                   |                               16,000 | Starts at launch, including scenario bootstrap, inner ready, abandonment setup and inner cleanup.                                                                                              |
| Inner work                                 | Remaining outer interval minus 4,000 | Ready and every local phase clip to this cutoff; no new work after it.                                                                                                                         |
| Normal Node/output/Git or smallest Unicode |                                4,000 | Clip to inner work cutoff.                                                                                                                                                                     |
| Orphan receipt / cancel / fault            |                                2,000 | Each poll/wait clips to inner cutoff. Poll timeout aborts and joins its read/delay.                                                                                                            |
| Normal orphan completion                   |                                3,000 | Clip to inner cutoff; includes actual absence and both EOF drain tasks.                                                                                                                        |
| Abandonment setup                          |                               10,000 | Inside outer operation, clipped to operation end minus inner cleanup.                                                                                                                          |
| Controlled runner timeout                  |                                  100 | After proven live orphan and armed receipt; independent outer owner cancels and observes completion.                                                                                           |
| Cleanup                                    |                         4,000 shared | One cached disposal promise, enclosing deadline; shutdown failure still attempts close. Outer cancel and disposal share one cutoff. Native fatal send and cleanup share one cutoff too.        |
| Case watchdog                              |                               30,000 | Work stops by case start + 26,000; setup/mkdir and both hosts are included. Outer ready 6,000 + operation 16,000 fits before that cutoff; actual remaining time clips both.                    |
| Runtime campaign                           |                              260,000 | Driver starts before tsx runner bootstrap; admission stops on first unexplained failure or insufficient remaining case time. Work cutoff at 256,000 reserves 4,000 for cleanup/log settlement. |

Arithmetic: inner cutoff = outer launch + min(16,000, case work remaining) - 4,000.
Inner readiness consumes that same interval. The three transport waits, orphan polls and deliberate
100 ms delay have local maxima, never additive entitlement. Native creation/launch work uses the
entry's clock; 11,000 work + at most 4,000 cleanup stays within its 15,000 enclosing ceiling. Slow
clipped cases fail and retain roots. Sequential admission requires 30,000 remaining before the
campaign reserve; nine maximum-length cases are not promised to fit the campaign. If remaining
time cannot admit a case, report incomplete with all later entries unreached, without extension.

The process driver is separate from compilation/lint and finite in-memory vector checks. Its
watchdog cancels the runner at the work cutoff and bounds runner/pipe settlement by the final
cutoff. If the independent owner is unavailable, runner death authorizes no deletion. Every
runtime root is retained for this correction review, including successful roots. No PID-based
cleanup or deletion of historical roots occurs.

Disposal joins bounded control writes, shutdown receipts and host/output close under one deadline.
A native fatal path requests termination, tries observed job zero and drain-task settlement, then
closes handles; unavailable observation/faulted drains remain uncertainty. Handle disposal and
termination are never absence receipts. Case failure requests outer cancellation and joins its
completion within cleanup before attempting disposal. The independent outer job's complete
receipt is the only outer absence/output oracle. Main and secondary cleanup errors are separate.

Validation order: finite typing/lint/format/diff and protocol/deadline vectors, source checkpoint,
then unicode, transport, launch-races, orphan-normal, orphan-cancel, observation-loss, host-death,
malformed, driver-cleanup. At most one execution per entry; no later admission after unexplained
failure. Fault cases require established ancestry/parent-exit/live-descendant receipts, a real body
Error and reached injection receipts. Controlled runner loss is established by an armed receipt,
actual timeout rejection and independent outer cancellation/completion. No run is acceptance.
