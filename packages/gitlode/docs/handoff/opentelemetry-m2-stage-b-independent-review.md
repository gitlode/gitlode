# Independent standalone Stage B review (2026-10-14)

**Corrections required.** Reviewed the complete standalone launcher introduced since `5268361`,
fixed at `f45062df73561ea563b5b0ad078bd92694bc910f`, from clean child checkpoint
`8ca31cbd8aa12e0b83e54212cc410e4ae1ea6b0f`, under the
[review assignment](opentelemetry-m2-fixture-ci-correction.md#historical-assignment-independent-standalone-stage-b-review-2026-10-14).
The nine saved successes establish their reached oracles, but do not establish delayed-path deadline
and settlement correctness. Standalone Stage B is not ready for separately assigned optional-helper
integration. Unix P1 remains separate; P2 remains accepted. This review changes no P1, PR or release
acceptance and authorizes no implementation work or new campaign.

## Mandatory findings

1. **Host read errors escape bounded cleanup.**
   [launcher.ts](../../test/support/windows-launcher/launcher.ts), constructor, lines 67–84:
   stdin and process errors enter `fail()`, but stdout and stderr have no `error` handlers.
   A control read error therefore becomes an unhandled EventEmitter error instead of sealing admission,
   rejecting pending commands and entering the normal cleanup/uncertainty path. An independent mock
   probe emitted a real stdout Error: emission threw the same Error and stdin remained open.
   This is distinct from the saved host-death case, which delivers `close`.
   Route both read-stream failures through bounded, redacted failure handling; verify the original
   body error, cleanup uncertainty and close attempt survive a read failure. No native process was
   involved in this probe.
2. **Native sends can spend the cleanup reserve, and delayed launch/input work is not clipped.**
   [Transport.cs](../../test/support/windows-launcher/Transport.cs), `Send()` lines 45–51 and
   `Run()` lines 63–110: entry work expires at age 11,000, but `workEnd` is set to the 15,000 total
   ceiling and `Send()` clips to that total, not the 11,000 work cutoff. A send beginning near age
   11,000 can wait almost 4,000 more; the next expiry check then enters cleanup with essentially no
   reserve. New input/launch is processed before existing-entry expiry is checked. `TryLine()` and
   [Job.cs](../../test/support/windows-launcher/Job.cs) `Launch()` receive no deadline, and launch
   returning after expiry still attempts `started`. Job construction also precedes setting the
   total deadline although the entry clock has already started. These static paths contradict the
   budget's claimed 11,000 work + reserved 4,000 cleanup under delayed conditions. Short saved
   successes and arithmetic-only unit assertions do not exercise them. Apply the actual work cutoff
   to sends/input/admission, account for construction/launch, and explicitly handle non-preemptible
   native calls with an enclosing owner. A finite delayed-send/launch oracle is required before
   claiming these ceilings; no timeout extension is justified.
3. **Disposal bounds waiting, but does not stop or settle a stalled owner.**
   [launcher.ts](../../test/support/windows-launcher/launcher.ts), `cleanup()` lines 262–286,
   and [deadlines.ts](../../test/support/windows-launcher/deadlines.ts), `until()`/`settleCleanup()`:
   shutdown is sent and three barriers are awaited. If shutdown or its write stalls, expiry rejects
   those waits without ending/destroying control or requesting host termination; the pending writes
   and `closed` promise remain live. The cached rejected disposal cannot make another close attempt.
   A second independent mock probe let shutdown/close remain pending: dispose rejected at its supplied
   cutoff while stdin was still writable and stdout undestroyed. The existing unit proves close is
   _awaited_ after an explicit fatal rejection; it does not prove close on shutdown timeout.
   Provide a bounded active stop/close attempt and retain uncertainty when settlement cannot be
   observed. Root retention is already conservative; it is not a host/pipe settlement proof.
4. **Case/driver file I/O bypasses enclosing cutoffs.**
   [case.ts](../../test/support/windows-launcher/case.ts), lines 26, 74–78, 107 onward;
   [driver.mjs](../../test/support/windows-launcher/driver.mjs), lines 10 and 53 onward:
   initial mkdir, scenario read/copy and final receipt writes are ordinary unbounded awaits.
   Case expiry has no independent watchdog in `runCase`; delayed scenario I/O can hold the live
   outer owner beyond the case's work/cleanup cutoff. The campaign watchdog is armed only after
   mkdir, and both campaign timers are cleared before the final write. A stuck initial/final write
   therefore bypasses even the stated 260,000 driver ceiling. `runner.mjs` final campaign write has
   the same unbounded-await issue, although the parent can kill that runner. This is not a request
   for general filesystem hardening: setup and receipt/log settlement are explicitly inside these
   assigned budgets. Bound their waiting/admission and preserve incomplete settlement; test a delayed
   read/write without real workloads. Aborting `readFile` polling alone does not cover these paths.
5. **Cleanup exceptions can skip later cleanup or erase earlier uncertainty.**
   [Transport.cs](../../test/support/windows-launcher/Transport.cs), finally line 121: unguarded
   `input.Dispose()` precedes every termination/observation/disposal attempt. If it throws, those
   attempts are skipped and its exception replaces the original native failure. In
   [case.ts](../../test/support/windows-launcher/case.ts), lines 97 and 103, a cancellation/settlement
   error is overwritten by a subsequent dispose error. Preserve the primary and all distinct
   secondary failures while attempting later phases under the same deadline. Also reconcile
   [Job.cs](../../test/support/windows-launcher/Job.cs), lines 93 and 99: transient thread/pipe/NUL
   `CloseHandle` results are ignored, unlike job/leader closes. A failed parent pipe-writer close can
   prevent EOF yet its handle identity is discarded. Exercise these specified exception/handle-close
   paths with finite injected failures; successful native vectors do not cover them.

These findings address the assigned error/deadline/settlement contract. They do not require a new
framework or a universal containment promise. No implementation or test source was repaired.

## Whole-launcher assessment and evidence

Static containment is appropriately scoped: private unnamed non-inheritable kill-on-close jobs,
creation-time JOB_LIST assignment, no unassigned fallback, and HANDLE_LIST containing only NUL input
and workload stdout/stderr writers. Parent read ends have inheritance cleared; process/thread security
is null. Startup uses the x64 layouts and rejects non-x64/older reported Windows versions. Actual
attribute/creation/membership failures are not silently downgraded to ordinary uncontained spawning.
Post-create failures are fatal; pre-create failures have a separate launchError. The saved nested-job
report is membership evidence in that environment, not support for every ancestor-job policy.
Node/Git quoting, UTF-16 environment/cwd, actual Git execution, nonzero exit and bounded output are
covered by the source-bound transport case. Brokers, WMI and adversarial breakaway remain unsupported.

Both framing implementations bound one byte frame, decode strict UTF-8 after LF, reject BOM/blank/
oversized/truncated input, and preserve split multibyte text. Node validates receipt order/ID and
canonical bounded base64; native validates request shape/IDs. Queued Node control writes are byte
bounded; native sends retain at most one write task. Workload drains retain 65,536 bytes per stream
while reading to EOF. Diagnostics classify failures without request/environment text. EOF and native
input/schema/task failures ordinarily enter the native catch/finally; the exception gaps above remain.
Native successful completion requires leader exit, queried job zero and both drain Results, so a
faulted task cannot yield a successful completion. Handle disposal is never treated as absence.

Executed independently, once: explicit launcher strict typing (`tsc -p ... --noEmit`, exit 0),
existing protocol/deadline unit file (8/8, 146 ms tests, 485 ms invocation), and actual C# framing
vectors (two valid frames, five rejections, zero native launches, exit 0). Two additional mock probes
passed their defect-observation assertions. They reproduce errors, not successful settlement.
No runtime campaign, native workload, package/OS suite or formal measurement was executed.

Independently reopened the round-1 seal and checked all **108** listed members' SHA-256 and lengths:
zero mismatches. ZIP hash `60381f0ecac0a60c945756b37efe12c720326f5784d0a7da2176cdf934ab9d53`,
manifest hash `ae3de6a08e3515942dafba5996976aebaf91a34404e4ae3f4768f242ac447b12`.
All 17 saved source files match their manifest and normalized fixed-checkpoint bytes. Runtime sources
match live bytes; the contributor document's later explanatory changes are separately visible.
The diff from fixed implementation to starting checkpoint contains only docs and the aggregated
receipt: no unreported runtime changes. Original `validation-receipt.json` remains unchanged.

Inspected all nine saved cases, their source assertions, driver/scenario receipts and orphan identity
files. Nine outer absence/complete/shutdown receipts are present with no driver primary/secondary
errors; no unreached entries. Ancestry, spawn identities, both parent self-exits and native leader-exit/
pending-completion assertions establish the supported orphan setup. Normal completion includes settled
output; cancellation observes job zero/output. Observation-loss has both injected and native-fatal
receipts; malformed has control-kind fatal; host-death asserts successful kill request and actual host
close. Each preserves a real body Error plus separate inner cleanup uncertainty. Driver-cleanup binds
armed body error, reached 100 ms timeout and independent still-live outer-owner cancellation/complete
with exit 123. Outer success does not rewrite inner uncertainty. The campaign's 35,820.59 ms is saved
evidence, not a new run or proof of the delayed paths above.

Original one-pass/seven-failure attribution remains in the
[diagnosis](opentelemetry-m2-stage-b-first-failure-diagnosis.md); unreached original faults are not
retroactively counted as passed. Every round-1 root remains retained. Retention supplies no proof of
safe deletion by a future helper. Driver hard timeout conservatively retains roots when its owner is
lost; runner death alone remains insufficient absence evidence.

## Remaining gates and delivery

Normal-user transport and inherited-handle **runtime** audits remain unverified. This session runs as
the sandbox account; its saved successes do not establish the intended ordinary contributor token.
The static handle allowlist is useful but does not replace runtime enumeration/ownership evidence.
No real-process probe was admitted after the concrete cleanup gaps were established: exercising a
stalled owner without verified bounded cleanup would conflict with the assignment's stop rule.
After correction, a separately assigned minimal ordinary-user transport probe and supported-model
handle audit must record identity/handle types, job/control-handle exclusion and actual absence/pipe
settlement, without inherited environment disclosure. These are explicit remaining gates, not passes.

Review-only probes/verifier and sanitized evidence remain under `.cache/stage-b-independent-review/`;
the original seal and runtime paths were not mutated. No temporary changes to repository implementation
needed restoration. Delivery updates only handoff/routing and contributor status documentation, runs
format write/check and diff check, then documentation-only commit and normal child push. Before
delivery, actual remote child matched `8ca31cb`; local/remote parent M2 matched
`4f09265791c82452a5800cc6d9855938bf88a46e`, and both F2 preservation refs matched
`4ea24d53afc57778addf3f47752e0fe73a7011ea`. Post-push identities and clean state are returned with
the review commit. No PR, merge, freeze, helper integration, acceptance update or formal run.
