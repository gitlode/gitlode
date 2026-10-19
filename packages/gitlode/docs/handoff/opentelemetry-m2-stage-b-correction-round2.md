# Stage B cleanup correction round 2 assignment (2026-10-19)

Trunk adopts all five mandatory findings in the
[independent review](opentelemetry-m2-stage-b-independent-review.md), delivered at `35aeff4`.
Stage B remains corrections-required; P2 remains accepted. Work on
`feature/otel-redesign_M2_fixture` from this packet's documentation checkpoint. Parent M2
`4f09265`, F2 `4ea24d5`, product/no-owner helpers and numeric budgets remain unchanged.

## Coherent repair, not a new framework

Before editing, record a compact exit-path table: trigger, admission cutoff, remaining cleanup
deadline, stop/close actions, observations still possible, primary/secondary failures and final
settled/unknown result. Cover the five findings together. Bounded waiting is not completed work:
non-preemptible native calls and pending filesystem operations cannot become settled through
Promise.race. Identify the enclosing independent owner/watchdog and retain uncertainty where
observation is impossible. Do not promise kernel-I/O preemption or treat kill/close as absence.

1. Route BOTH stdout/stderr read errors through bounded redacted failure handling; seal admission,
   preserve the original error and attempt cleanup. Add emitted-error regressions for both streams.
2. Apply actual work cutoffs to native sends/input/admission; check existing-entry expiry before new
   launch and account for construction/launch from their start. A late native return enters cleanup
   rather than sending started. Handle non-preemptible calls through the enclosing owner. Test delayed
   send/launch behavior, not only arithmetic; do not spend the cleanup reserve on ordinary work.
3. Disposal timeout actively requests stop/close within the existing shared cleanup budget. Cached
   disposal must not disable fallback close attempts. Settle controllable tasks/pipes; unknown host
   settlement remains unknown. Test stalled shutdown/write plus delayed close and primary-error
   preservation. Do not add another timeout after the first expires.
4. Arm case/campaign control before initial filesystem work and retain it through final receipts.
   Gate/bound setup and final I/O, cancel/join where supported, retain incomplete settlement elsewhere.
   Inject delayed read/write without real workloads. Receipt failure cannot erase the original
   outcome or prevent later bounded cleanup. Killing the runner is not evidence of settled I/O.
5. Guard every cleanup phase, including input.Dispose and transient thread/pipe/NUL CloseHandle.
   Attempt later phases despite exceptions within the same remainder. Preserve primary plus all
   distinct secondary failures; retain failed-handle ownership/identity without unsafe retry on
   reused handles. Inject the specified failure paths.

## Validation order and stopping boundary

Run strict typing, relevant lint, finite unit/native failure vectors, format/diff first. Demonstrate
fail-before/pass-after for the concrete paths where deterministic; use review probes as starting
evidence. Assert actual actions, uncertainty/settlement and error identity, not just helper arithmetic.
Restore temporary mutations. Expected old-source failures are not unexplained campaign failures.

Checkpoint the correction before real-process validation. Only after the injected checks pass, run
one sequential source-bound nine-entry regression campaign with existing deadlines and first-failure
admission stop. Preserve original round-1 evidence separately. No retry-until-green or duration
increase. If safe correction requires another owner architecture or cannot fit current budgets,
return that concrete limitation before runtime execution rather than expanding the platform design.

After regression success, allow one minimal normal-contributor-user transport check and one runtime
inherited-handle audit, combinable in one workload. Record actual identity/token, handle types and
ownership, job/control-handle exclusion, absence/output settlement and limitations. Use existing
tooling only. If prerequisites are unavailable, return the gate unverified. Do not disclose inherited
environment values. Sandbox/static evidence does not substitute for these checks.

Append outcome here with the exit-path table, five finding mappings, fixed OIDs, reached/unreached
assertions, primary/secondary failures, retained roots and sealed sanitized receipts. Keep prior
seals immutable. Warn before real-process execution about its elapsed work time. Commit source and
outcome separately, normal push, verify actual remote/clean/unchanged parent/F2 and remain on child.
Return for independent focused re-review only if correction gates pass; otherwise return incomplete
with the earliest failure. A recurring same-boundary finding returns to trunk diagnosis, not automatic
further repairs. No helper integration, Unix P1 repair, full OS/package campaign, PR, merge, freeze,
formal measurement or acceptance update. Do not self-accept Stage B/P1/PR readiness.

## Round-2 exit-path table (recorded before implementation)

All rows retain roots. Deadlines are absolute; no row creates a second cleanup allowance.
The native host is enclosed by the Node launcher, the scenario by the outer job, and the
case/runner by the driver. Driver filesystem calls have no further independent owner.

| Trigger                                                        | Admission cutoff                                                                               | Cleanup remainder / actions                                                                    | Possible observations                                         | Failures / terminal result                                                                                                                               |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| stdout or stderr emitted error                                 | Seal immediately                                                                               | End control; dispose under existing owner cutoff; stop/close fallback                          | Host close and settled writes, never inferred job absence     | Original body error stays primary; redacted stream failure and cleanup failures are secondary; absence unknown without complete                          |
| Existing entry expiry, delayed send, construction or launch    | Check before input/admission and after native return; native work ends at entry start + 11,000 | Entry start + 15,000 maximum; cancel, observe, close                                           | Job zero, leader exit, drain results if native call returns   | Late return cannot send started; non-preemptible call remains enclosed by Node/outer owner, settlement unknown if lost                                   |
| Shutdown/write stall or disposal expiry                        | Seal at disposal                                                                               | Active stop/close request within same 4,000 remainder, including cached-disposal fallback      | Actual host close/output close and write callbacks only       | Preserve original error and distinct stop/close errors; timeout is uncertainty, never settled                                                            |
| Setup read/mkdir or final receipt write delay                  | Arm before first filesystem call; no launch after work cutoff                                  | Abort supported I/O, bound waiting, retain outstanding operation identity through final cutoff | Fulfilled/rejected I/O, supported abort settlement            | Pending kernel I/O remains unknown even after runner kill; receipt failure cannot replace body failure                                                   |
| input.Dispose or transient thread/pipe/NUL CloseHandle failure | Seal on failure                                                                                | Guard each phase; attempt subsequent cancel/observe/close with same remainder                  | Individual close results, drain outcomes and job observations | Preserve primary plus all distinct secondary failures; quarantine failed handle identities without retry; never claim closed/absent from attempted close |

Pre-runtime gate: strict typing, focused lint, 21 Node fault/protocol tests, four finite native
transport paths (construction, launch, send, input.Dispose), three ambiguous close identities
with four later releases/no unsafe retries, and native framing (two valid/five rejected) pass.
Three deterministic old-source regressions fail as expected (both read errors and stalled
shutdown/write); the exact corrected launcher bytes were restored in finally before pass-after.
The native transport vectors compile the production bodies with replaced OS boundaries and scaled
test-only intervals; they exercise actions and failures, not real workloads or kernel preemption.

| Review finding | Implementation / injected evidence                                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1              | Both read error handlers call redacted fail; emitted-error tests assert sealing, control end, stop, cached uncertainty                                                                                                      |
| 2              | Native pre-input/admission/post-launch checks, construction-start work/total accounting, send clipping; delayed construction/launch cannot send started, delayed send requests cancel before reserve exhaustion             |
| 3              | Disposal fallback timer acts halfway through the same remainder; guarded stream/host stop, actual delayed-close/write-stall test, cached result retains uncertainty                                                         |
| 4              | Case watchdog and driver timers precede mkdir; CaseIO gates/aborts/tracks pending I/O; actual case read/setup and actual driver setup/final-write fault tests retain unknown settlement                                     |
| 5              | Native guarded cleanup collects original plus secondary exceptions; close identities quarantined without retry; actual case cancellation/disposal/receipt faults retain the original body and all secondary classifications |

Test-harness-only first failures were an omitted driver argv fixture and a case fake dispose
returning undefined/expecting one invocation after adding the independent watchdog. Corrected mocks
now return the disposal Promise and assert both watchdog and join invocations. No native workload
was admitted during these failures. The final gate contains no unhandled errors.

Status: injected gates passed; real-process validation awaits the source checkpoint below.

## Round-2 return: incomplete at runtime handle-audit prerequisite

Implementation checkpoint: `a5dae83e4f55b3631061959bcf1bcd98154130e6`, on the assigned child,
from `168c0d33dfaf6e966c05c2cad63cf540a09a35d8`. The five mappings above are one correction;
there was no helper integration, acceptance change or runtime retry.

The single source-bound sequential campaign passed all nine entries in **15,151 ms** wall time
(driver elapsed **15,070.47 ms**). No entry was unreached. All nine outer owners observed absence,
successful command output/close settlement and shutdown, with no unexpected driver primary or
secondary failure. The fault cases retained their exact body errors plus inner cleanup uncertainty;
independent outer success does not change that uncertainty. Orphan cases reached ancestry,
parent self-exit and native leader-exit/pending-completion assertions. Observation-loss and
malformed reached their respective injected/native-fatal receipts; host-death reached kill/close;
driver-cleanup reached armed timeout and outer cancellation/completion with exit 123. Every root
remains retained. The aggregated [receipt](../../test/support/windows-launcher/correction-round2-receipt.json)
contains exact cutoffs, events, outcomes and fixed source byte identities.

One subsequent normal-contributor transport case passed (**1.69 s** test time; eight other tests
skipped). Actual identity was `WAKA-PC\t-wakabayashi`, SID ending `1002`, Administrators deny-only,
non-elevated, Medium integrity (`S-1-16-8192`). It reached quoting/Unicode/environment round-trip,
bounded stdout/stderr, nonzero exit and real Git execution, with outer observed absence and
shutdown/output settlement. Only synthetic transport values were asserted; inherited environment
values were neither saved nor disclosed. The preceding nine-case campaign ran as the sandbox
identity, SID ending `1004`; it is not the ordinary-user evidence.

**Earliest unmet boundary: runtime inherited-handle audit prerequisite.** No existing supported
enumerator (`handle.exe`, `handle64.exe`, `procexp.exe`, `procexp64.exe`) was available on PATH or
the checked standard Sysinternals/Windows locations. No tool was installed and no handle-audit
workload was launched. Runtime handle types, ownership and job/control-handle exclusion therefore
remain **unverified**. The static HANDLE_LIST and normal-user transport success do not satisfy
this gate. This return is incomplete, not Stage B/P1/PR self-acceptance or a successful all-gate
return for independent re-review. No further implementation/retry is inferred from this limitation.

Finite injected paths retained unknown settlement while I/O/native writes were pending and
observed late completion separately. Saved success receipts conservatively list their own receipt
write as pending at serialization; reopening and verifying the saved bytes establishes those
particular writes finished. It is not a kernel-I/O preemption claim. Faulted close identities remain
quarantined without retry; attempted stop/close never establishes workload absence. Legacy scenario
`UnknownError` placeholders for undefined values remain as stored, not new thrown failures.

Sanitized local seal: `.cache/stage-b-correction-round2-sealed.zip`, SHA-256
`5ecab09f39f4df0c2815d705ffa50df956fe122b954256ae01d878a30be38a3e`.
Manifest SHA-256 `3d8710a12ac61ee2d7fab118160faa62f3b236b8a64f99c43cbdab40bcf5daa8`.
Reopened and checked all **127** listed members by SHA-256/length: zero mismatches. Sources,
fault/vector logs and transformations, source manifest, verifier, runtime receipts/retained roots,
ordinary-token evidence and outcome are sealed separately from round 1. Rehashed the round-1 ZIP
and manifest plus its four original archives: all unchanged. Original `validation-receipt.json`
matches the starting checkpoint. No historical root or seal was modified.

Source and outcome are separate commits followed by normal child push. Actual remote, clean tree,
unchanged parent M2 `4f09265791c82452a5800cc6d9855938bf88a46e` and both F2 preservation refs
`4ea24d53afc57778addf3f47752e0fe73a7011ea` are checked at delivery. Remain on the child.
No PR, merge, freeze, formal measurement, acceptance update, helper integration or Unix P1 repair.
