# Stage B provisional finite validation budgets

Fixed before the first runtime validation. All eight Windows cases have a 30,000 ms test
deadline. Fresh outer and inner hosts compile once each; ordinary mkdir, host startup and
workload setup are inside the case timer. There is no prewarm or Stage A rerun.

**First execution failed and is stopped pending diagnosis/review.** The table is the planned
provisional policy, not proof that the implementation meets it. The shell runner did not enforce
the 260,000 ms matrix bound. `dispose()` applies 4,000 ms separately to shutdown and close,
so its actual maximum is 8,000 ms rather than the intended shared 4,000 ms cleanup phase;
the worst-case phase sum can exceed the test deadline. Receipt polling also keeps running
after its Promise.race deadline. These are unresolved finite-driver/settlement findings.
No deadline was extended and there was no second runtime execution. Do not run these cases
again until disposition authorizes correcting these concrete defects.

| Phase                              |                  Budget ms | Basis and allowance                                                                                                                                                           |
| ---------------------------------- | -------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh host readiness               |                 6,000 each | Prior compilation 385–457 ms and aggregate other host overhead about 820–1,283 ms; allow 2,000 ms startup/compile plus 4,000 ms scheduling. Not a proven cold bound.          |
| Native job operation               |                     15,000 | At most four launches per inner transport/race case, three real generations per orphan; short work plus protocol/output settlement and scheduling. Host detects hanging jobs. |
| Outer caller operation             |                     16,000 | Covers scenario bootstrap, inner startup, work and inner shutdown; 1,000 ms beyond native host bound for fault notification.                                                  |
| Individual normal work/output/Git  |                      4,000 | Small Node/Git command, 200,000 output bytes; 1,000 ms work and pipe settlement plus 3,000 ms scheduling.                                                                     |
| Orphan setup receipt               |          2,000 per receipt | Three tiny Node startups; includes polling and scheduling.                                                                                                                    |
| Normal orphan completion           |                      3,000 | Deliberate 800 ms lifetime plus pipe/absence settlement and 2,200 ms scheduling.                                                                                              |
| Controlled cancel/fault settlement |                      2,000 | Fault after established orphan plus 100 ms delay, or immediately after registration; short bound detects broken cancellation independent of outer timeout.                    |
| Shutdown/host close                | 4,000 shared cleanup phase | Termination, observed zero, pipe and control close, scheduling. Never authorize deletion from leader close alone.                                                             |
| Driver abandonment setup           |                     10,000 | Outer startup excluded from this phase but included in case; inner compilation + three generations + 100 ms fault delay + scheduling.                                         |
| Each Vitest case                   |                     30,000 | 6,000 readiness + 16,000 operation + 4,000 cleanup + 4,000 setup/receipt/scheduling.                                                                                          |
| Matrix driver                      |                    260,000 | Eight serial cases at 30,000 ms plus 20,000 ms Vitest bootstrap/log settlement; worker cap stays two.                                                                         |

Transport: argument/cwd/environment identity, nonzero exit, 200,000-byte drain with 65,536-byte
retention per stream, real Git. Launch-races: missing executable and three immediate repeated
cancellations. Orphan-normal/cancel: leader and intermediate exit with an established descendant.
Observation-loss/host-death/malformed: uncertainty must reject and retain roots. Driver-cleanup:
abandoned inner driver leaves real processes; independent outer job cancels and observes absence.
Fault roots and first failures are retained. An unexplained deadline failure stops this matrix
for diagnosis; no timeout extension or automatic redesign. These are hang-detection budgets,
not performance thresholds or acceptance.
