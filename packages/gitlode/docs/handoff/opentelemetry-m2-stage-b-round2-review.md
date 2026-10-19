# Stage B round-2 independent review and remaining audit (2026-10-19)

## Assignment

Trunk receives outcome `2709805d8ae55d83ccd25cc65a4a70e3481e2adc` as incomplete only with
respect to its reported runtime handle-audit prerequisite, not as self-accepted implementation.
Review fixed correction `a5dae83e4f55b3631061959bcf1bcd98154130e6` against assignment base
`168c0d33dfaf6e966c05c2cad63cf540a09a35d8`, preserving awareness of the whole standalone launcher.
Read [round-2 outcome](opentelemetry-m2-stage-b-correction-round2.md) and
[the five findings](opentelemetry-m2-stage-b-independent-review.md).

Stay on `feature/otel-redesign_M2_fixture` from this packet checkpoint. Parent M2 `4f09265`, F2
`4ea24d5`, product/no-owner/helper paths remain fixed. P2 remains accepted; Stage B/P1/PR readiness
remain open. Separately review the implemented correction and disposition the outstanding audit;
tool availability is not a reason to defer review of completed fixes.

## A. Independent correction review

Inspect all five failure paths and cross-path effects, including read-error handling, native work
versus cleanup cutoffs, active stop/close on stalled disposal, initial/final filesystem accounting,
and primary/secondary cleanup error and handle ownership preservation. Review actual state transitions
and unknown-settlement paths; successful short cases do not prove delayed paths. Confirm no added
budgets, unsafe close retry, helper integration or unreported post-checkpoint implementation change.

Independently run strict typing and the focused finite Node/native fault checks. Check that native
boundary substitutions exercise real production bodies without erasing the conditions under review.
Inspect saved nine-case and normal-contributor evidence with account/token and fixed-source bindings;
reverify the 127-member seal/hash lengths. Keep independently executed and saved evidence distinct.
Reusing the successful runtime campaign is appropriate absent a concrete new concern. Do not rerun
the full campaign/OS/package suites; use bounded probes only for a specific uncovered failure path.
Stop and preserve evidence if cleanup becomes unknown. Never delete historical roots.

Return accepted/corrections-required for each original finding and the correction slice. This alone
does not accept standalone Stage B, P1 or PR readiness while the separate audit gate remains open.

## B. Specify the smallest runtime handle audit

The implementation session found no existing Sysinternals enumerator. That proves tool absence,
not a handle leak and not that runtime verification is impossible. No dependency/tool installation
is authorized by this packet. Do not build a general handle inspector.

Define the precise oracle: allowed workload stdio/pipe inheritance, exclusion of the launcher job
and control handles, and observed workload absence/output settlement. Map these to concrete handles
and ownership in the actual launch path. Evaluate a narrow diagnostic using existing PowerShell/.NET
and documented Windows APIs versus a scoped external enumerator. Verify API claims with primary
documentation if needed. A numeric handle match alone is not object identity; missing output or a
failed query is not absence. State privilege/architecture prerequisites and coverage limits.

Return one executable audit plan with exact source seam, process setup, observation, positive/negative
sensitivity, identity evidence, safe cleanup and finite bounds. Prefer an invocation-local diagnostic
with no product dependency. Explain what it would prove beyond static HANDLE_LIST and the already
successful transport tests. If an external utility is essential, identify its official source,
version/integrity verification, invocation/permissions/EULA and storage scope for a subsequent decision;
do not download, accept terms, install or run it in this review.

No runtime audit is required in this assignment. If a sufficient existing supported method is already
available, a single bounded read-only audit may be used only without implementation mutation or new
prerequisites; otherwise return the plan and keep the gate pending. Do not waive runtime evidence or
extend the requirement to universal enumeration of all system handles. Any proposed replacement of
the audit oracle must be clearly identified for trunk disposition, never silently accepted.

## Delivery

Record two separate verdicts: correction slice and handle audit (executed/verified or pending with
the concrete plan). If further implementation findings exist, list exact failure paths, not speculative
framework improvements. Append the review here, update routing, format write/check and diff check,
documentation-only commit and normal push, remote/clean/unchanged parent/F2 verification. Remain on
child. Preserve temporary probe/evidence identities and original seals; restore any temporary files.
Warn before process probes about execution time. No implementation repair, helper integration,
Unix P1 repair, PR, merge, freeze, formal measurement or release acceptance update.

## Independent return (2026-10-19)

**Correction slice: accepted. Runtime handle audit: pending, not executed.** Independently reviewed
`a5dae83e4f55b3631061959bcf1bcd98154130e6` against `168c0d33dfaf6e966c05c2cad63cf540a09a35d8`,
starting clean at `d5676516003bda77279f5191c0793fe64789fac0` on the assigned child. The five original
findings are resolved within the documented cooperative/independent-owner boundary. No further
mandatory implementation finding was established. This accepts only the correction slice;
standalone Stage B, P1, helper integration and PR readiness remain open. P2 remains accepted.

### Five finding dispositions and cross-path review

| Original finding                      | Verdict  | Independently checked behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. stdout/stderr read errors          | Accepted | Both emitted-error paths enter `fail`, seal admission, reject pending work with a redacted classification and end control. Disposal attempts stop/close and retains uncertainty. Original case body failure survives cancellation, disposal and receipt failures. The thrown stream message is deliberately not retained.                                                                                                                                                                                          |
| 2. Native work versus cleanup reserve | Accepted | Existing expiry precedes input; `TryLine` checks the cutoff during framing and its caller checks again after return. Launch admission checks work expiry. Entry work/total clocks are set before `new JobProbe`; `Job.Launch` checks before construction work, before creation and after creation. A late return cannot send `started`. `Send` checks before/after serialization and after waiting, clipping to work/cleanup rather than the total ceiling. Fatal handling cancels before attempting notification. |
| 3. Stalled disposal                   | Accepted | The fallback timer requests independent stdin destroy, host kill and stdout/stderr destroy halfway through the same remaining disposal interval. All barriers use the original end. Rejection also requests fallback before caching the result; repeated dispose returns that promise, without another allowance. Delayed close does not turn a pending write or forced stop into success.                                                                                                                         |
| 4. Setup/final filesystem accounting  | Accepted | Case watchdog and both driver timers precede mkdir and remain through final receipts. CaseIO gates admission, bounds waiting, requests supported abort and retains pending identities until actual fulfillment/rejection. Initial mkdir cannot admit a late owner. Scenario read/copy and case/runner/driver receipts are bounded at their enclosing layer. Unsupported cancellation and driver death retain unknown I/O settlement.                                                                               |
| 5. Cleanup exceptions/ownership       | Accepted | Native input disposal, cancel, observation, pipe-failure observation and job disposal are independently guarded. Launch releases attempt every transient thread/pipe/NUL close and later release, retaining primary plus close errors. Failed native handle values are quarantined and never retried; dispose clears live fields before attempts. Case secondary errors accumulate rather than overwrite body/cancellation failures.                                                                               |

Checked the interactions, not only successful short paths: an expired/throwing construction leaves a
nullable entry for guarded cleanup; post-create failure remains fatal; an unsettled native write
prevents another write and is joined only within the same remainder. Completed-entry deadlines may
conservatively constrain other admitted entries until the set empties; they do not extend work.
On normal shutdown the remaining total caps cleanup. A lost owner, failed query, faulted drain or
pending filesystem operation never supplies absence. Final receipt failure retains the earlier
body/cleanup classification and does not authorize deletion.

Native calls, including input/close, remain non-preemptible: deadline checks constrain admission
and cooperative waits, not kernel execution. The Node owner encloses the native host, the outer job
encloses the scenario, and the driver encloses the runner; loss of those observers remains unknown.
The driver has no independent filesystem owner. Its final exit reports uncertainty rather than
settled I/O. Scenario-local receipt waits/writes also rely on their enclosing case/outer owner;
they are not newly claimed as cancellable kernel I/O. These limits match the round-2 exit-path table.

The complete launch boundary still uses creation-time JOB_LIST and a three-member HANDLE_LIST,
with no unassigned fallback. NUL and workload writers are separate from host control pipes;
read inheritance is cleared. Completion still requires leader exit, queried job zero and successful
stdout/stderr task results. Framing, output retention and redaction boundaries are unchanged.
No numeric budget grew, no close retry was added, and no helper/product/no-owner path was integrated.
From fixed implementation to starting checkpoint, only documentation and the aggregate correction
receipt changed; no unreported executable change was found.

### Independently executed checks versus reused evidence

Executed once in this review as sandbox SID ending `1004`: explicit launcher strict typing
(`tsc -p packages/gitlode/tsconfig.windows-launcher.json --noEmit`), focused oxlint, four focused
Node test files (**21/21**), native failure vectors and native framing. All exited zero.
Invocation times were respectively 202, 107, 1,559, 956 and 3,242 ms; these are correctness-check
costs, not formal measurements. Each subprocess had a 20-second bound. No native job/workload,
runtime campaign or package/OS suite was launched by these checks.

Native vectors retain the actual `LauncherTransport.Run`/`Send` catch/finally bodies, replacing
Control and JobProbe OS boundaries and scaling only test intervals to 30/70/40 ms. Delayed
construction/launch produces no `started`; a delayed writer requests cancel before the scaled
total and retains unsettled writing. Input disposal failure preserves the exact body/input/close
exception objects and still observes/disposes. Because Control/JobProbe are substituted, those
vectors do not test actual pipe reads, CreateProcess or kernel preemption; their production
deadline checks were separately inspected. The close vectors use real CloseOwned/Dispose bodies
with a substituted CloseHandle and constructor: three ambiguous values, four later closes, zero
retries. They do not simulate actual Windows handle types or execute Launch's release loop;
that loop's call sites and guards were reviewed directly. Framing exercised two valid/five
rejected native vectors. No substituted body removes the delayed Send or guarded transport cleanup
condition it purports to test. The saved three old-source failures are reused evidence, not a new
mutation/fail-before run.

Independent logs, verifier adaptations and generated native fixtures are retained separately at
`.cache/stage-b-round2-independent-review/`. The vector script changed only its output directory
and source-directory resolution, preserving the existing `.cache/stage-b-round2-native-vectors/`.
The adapted evidence verifier writes only into the new review root and compares sealed source to
the fixed commit, allowing the already documented later contributor prose. No tracked implementation
was temporarily edited; no historical root or original evidence was overwritten.

Reopened the original round-2 ZIP and its manifest, independently checking all **127** listed
members' lengths and SHA-256, their on-disk evidence copies and the archived manifest bytes:
**zero mismatches**. ZIP SHA-256:
`5ecab09f39f4df0c2815d705ffa50df956fe122b954256ae01d878a30be38a3e`;
manifest SHA-256: `3d8710a12ac61ee2d7fab118160faa62f3b236b8a64f99c43cbdab40bcf5daa8`.
All 26 sealed source entries match normalized fixed-commit bytes; executable live bytes match their
source-manifest hashes. The committed aggregate equals the sealed outcome plus independently verified
seal metadata. Round-1 ZIP/manifest and its four original archive hashes remain unchanged;
original validation receipt matches the assignment base.

Reused, without rerunning, the sealed nine-case campaign (one attempt, 15,151 ms wall) and ordinary
contributor transport (one pass/eight skipped, 1.69 s test time). Inspected scenario assertions,
driver/scenario receipts, orphan ancestry/parent-exit/spawn identities, fault receipts and source
bindings. All nine entries were reached; driver primary/secondary failures are absent; outer
complete/absence/output settlement and shutdown are present. Driver-cleanup reaches its armed
100 ms fault and exit 123. Observation-loss/malformed/host-death retain their original body errors
and separate inner uncertainty, despite outer success. Saved receipts' own pending writes are
resolved by successful byte readback, not by treating serialization as write completion.

The campaign identity is the saved sandbox `WAKA-PC\CodexSandboxOffline`/SID ending `1004`.
The separately sealed ordinary-token record reports `WAKA-PC\t-wakabayashi`/SID ending `1002`,
Medium integrity (`S-1-16-8192`), Administrators deny-only and non-elevated. Its transport receipt
reaches quoting/Unicode/synthetic environment round-trip, bounded output, exit 7 and actual Git.
The normal-user command record is a one-attempt/exit summary, not a per-process token attestation;
its token/source association is the saved session record plus common fixed source manifest and
unchanged executable bytes. This review did not re-observe that token. No inherited environment
values were printed or added to evidence. Neither transport success establishes handle exclusion.

### Separate audit verdict and smallest executable plan

**Pending.** There is no existing invocation-local audit harness in the saved evidence. A read-only
audit cannot be executed merely by finding that Windows exports an API: binding it to the actual
creation seam and validating the diagnostic require new temporary diagnostic code. This review
therefore specifies the following single plan without building/running it. Tool absence is neither
a leak finding nor a reason to withhold the accepted correction verdict.

Use existing x64 Windows PowerShell 5.1/.NET Add-Type to bind documented Process Snapshotting APIs
and CompareObjectHandles, in an invocation-local copy of the fixed standalone sources. No product
dependency, installed utility, undocumented NtQuerySystemInformation or general system handle
inspector is needed. PowerShell `Get-Process` handle counts cannot supply object identity. A scoped
external enumerator would still need a creation seam, identity comparisons and cleanup evidence;
it adds acquisition/permission prerequisites without being essential to this plan.

The exact oracle is creation-time inheritance for the direct audited workload: its NUL stdin and
two workload pipe writers must reference the parent's three allowed objects; neither the private
job nor any of the host's three control std handles may be present under any workload handle value.
Also exclude the parent's workload read ends. Job membership is required, but is distinct from
owning a Job handle. The host owns job/leader and transient creation handles; drain tasks own read
ends; the workload owns inherited NUL/write ends. Node owns the opposite control pipe ends and
does not pass its handles directly to CreateProcess. Audit-local objects must be non-inheritable.

1. **Prepare and bind, before launching.** In a fresh retained invocation root, copy sources from
   `a5dae83`, record original and diagnostic hashes and exact transformations, and run as the same
   ordinary contributor token (record SID, integrity and elevation without environment contents).
   Require Windows 10+ x64 and matching x64 Node/PowerShell/.NET, existing compiler/dependencies,
   and successful API resolution/layout checks. Use the owned CreateProcess process/thread handles,
   with rights for query, duplication, suspension/resume, synchronization and termination; do not
   open unrelated/protected processes or enable SeDebugPrivilege. Denied access is an unmet
   prerequisite. In-process snapshot ownership uses GetCurrentProcess for freeing snapshots.
   Prepare `.cache/stage-b-handle-audit/audit-driver.mjs` as the future entrypoint, with the existing
   outer owner and driver timers; its scenario imports the invocation-local launcher/host copies
   and admits only the baseline and sensitivity launches below, not the nine-case campaign.
   The subsequent invocation is `node .cache/stage-b-handle-audit/audit-driver.mjs .cache/stage-b-handle-audit/evidence`;
   this file is a planned diagnostic artifact, not an existing command executed by this review.
2. **Exact seam.** Only in the diagnostic copy of `JobProbe.Launch`, OR `CREATE_SUSPENDED` (`0x4`)
   into the existing `0x08080400` creation flags. Immediately after successful CreateProcess and
   assignment of `leader`/`Pid`, before `CloseOwned(pi.thread)` and before closing NUL/writers,
   invoke the audit with `pi.process`, `pi.thread`, `job`, `input`, `outWrite`, `errWrite`,
   `outRead`, `errRead`, and host GetStdHandle(-10/-11/-12). Keep the original JOB_LIST,
   HANDLE_LIST, security, environment and creation-time containment unchanged. Check membership
   while the primary thread is still suspended. This prevents workload initialization from closing
   or reusing inherited slots before observation. Resume only the uncontaminated baseline after
   audit resources have been released; then run the production close/drain/receipt path.
3. **Observe a complete table and actual objects.** Call PssCaptureSnapshot on the owned workload
   process with flags `0x1c` (HANDLES, HANDLE_NAME_INFORMATION and HANDLE_BASIC_INFORMATION)
   and context flags zero; no VA clone or breakaway flags.
   Query PSS_QUERY_HANDLE_INFORMATION and walk PSS_WALK_HANDLES with a PssWalkMarker to
   ERROR_NO_MORE_ITEMS. Validate the full x64 PSS_HANDLE_ENTRY layout, flags and returned lengths;
   walked count must equal HandlesCaptured. Copy only bounded type metadata before freeing the
   marker; do not persist object paths/names. For supported file/job/process/thread/event types,
   duplicate each target handle into the auditing host with DUPLICATE_SAME_ACCESS and inheritance
   false, then CompareObjectHandles against each still-live allowed/forbidden parent reference.
   No DUPLICATE_CLOSE_SOURCE and no target close. Do not blindly duplicate socket/completion-port
   or unknown types: an unsupported or failed entry makes the audit inconclusive. Record successful
   comparisons and explicit different-object status; invalid handles/query errors cannot mean absent.
   A numeric match, type name or equal handle count alone cannot pass.
   Classify every entry as an allowed inherited object or an explained OS-created initial object;
   unexplained extras are inconclusive rather than silently expanding the inheritance allowlist.
4. **Baseline sensitivity and settlement.** Require one exact object match for each allowed
   inherited std handle, no forbidden matches across the completed table, and successful type
   evidence: NUL is FILE_TYPE_CHAR and both writers FILE_TYPE_PIPE, corroborated by creation
   provenance. Require comparison self/duplicate positives and distinct-object negatives using
   owned objects. Close every local duplicate and free marker/snapshot before resuming, since
   retained writer duplicates would themselves suppress EOF. ResumeThread must report the expected
   suspend count; close the creation thread through guarded ownership. The minimal Node workload
   reads stdin to EOF, writes distinct finite stdout/stderr markers and exits with a fixed nonzero
   code. Require production exit/complete (leader exit, queried zero, exact markers and both drain
   results), host shutdown and Node host/output close. Missing markers are failure/uncertainty.
5. **Exclusion sensitivity, once.** A second sequential disposable suspended launch in the same
   bounded invocation first passes the baseline table check. Deliberately DuplicateHandle the
   host's private job and three control handles into that target (no inheritance change or HANDLE_LIST
   edit), recording returned target identities. Repeat the walk/comparisons: the oracle must now
   reject all four forbidden objects even at different numeric values. These are diagnostic
   contamination, not a production leak or a passing production run. Do not resume this target;
   terminate its job, observe leader exit/job zero/output settlement, and let process exit release
   those target duplicates. Keep local job/control originals owned throughout. A failed sensitivity
   check invalidates the diagnostic; stop rather than retrying it into success.
   After this expected rejection, let the ordinary launch body establish drains and close parent
   writers without resuming the target, then cancel through the live transport owner. Do not
   throw out of the seam and thereby skip the output-settlement observation being tested.
6. **Bounds, containment and evidence.** Use the existing outer-job/case/driver arrangement with
   one fresh audit scenario, two sequential launches, existing ready/operation/case cutoffs
   (6,000/16,000/30,000 ms), native 11,000 work/15,000 total and the same 4,000 cleanup reserve.
   Check remaining work before each capture, entry and second launch; neither launch receives a
   new outer allowance. Native PSS/duplication calls cannot be preempted: the still-live outer
   owner must cancel/observe the enclosing job if the diagnostic stalls. Join output and all
   controllable tasks; guard every snapshot/marker/duplicate/thread release, preserve primary plus
   secondary errors and ambiguous identities, never retry an ambiguous close. Record source/token,
   PID/creation identity, per-entry type/ownership/comparison status, exact cutoffs, capture/walk
   statuses/counts, sensitivity results and absence/EOF/close receipts in bounded sanitized output.
   Seal/read back those bytes; keep all roots. Stop admission on the first unexpected failure or
   unknown settlement. Killing the diagnostic or closing a Job handle is not an absence receipt.

API basis checked against primary Microsoft documentation: the
[capture flags](https://learn.microsoft.com/en-us/windows/win32/api/processsnapshot/ne-processsnapshot-pss_capture_flags)
distinguish handle values, names and basic metadata;
[walk status](https://learn.microsoft.com/en-us/windows/win32/api/processsnapshot/nf-processsnapshot-psswalksnapshot)
and [captured count](https://learn.microsoft.com/en-us/windows/win32/api/processsnapshot/ns-processsnapshot-pss_handle_information)
provide completeness checks. [PSS_HANDLE_ENTRY](https://learn.microsoft.com/en-us/windows/win32/api/processsnapshot/ns-processsnapshot-pss_handle_entry)
and [validity flags](https://learn.microsoft.com/en-us/windows/win32/api/processsnapshot/ne-processsnapshot-pss_handle_flags)
govern metadata interpretation. [DuplicateHandle](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-duplicatehandle)
requires process duplication rights, preserves object identity and documents unsupported duplication
categories. [CompareObjectHandles](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-compareobjecthandles)
compares kernel objects on Windows 10+;
[GetFileType](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfiletype)
classifies file handles but does not establish identity.
[CREATE_SUSPENDED](https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags)
holds the primary thread until resume; [PssFreeSnapshot](https://learn.microsoft.com/en-us/windows/win32/api/processsnapshot/nf-processsnapshot-pssfreesnapshot)
uses the process containing the snapshot, not automatically the captured target. PSS itself is
documented from Windows 8.1; the launcher/identity API narrows this plan to Windows 10+.

This plan would add a complete creation-time table plus object-identity exclusion and a known-leak
sensitivity check to the static allowlist and saved transport tests. It does not assert universal
system enumeration, adversarial duplication resistance, every future descendant's handle table,
or unchanged timing under suspension. The suspended diagnostic copy and injected target handles
are explicitly observable perturbations requiring a subsequent scoped diagnostic assignment;
they are not silently accepted as evidence from untouched production scheduling. If trunk requires
a later unsuspended sampling oracle instead of creation-time inheritance, that is a different oracle
for explicit disposition. This review does not replace or waive the runtime gate.

### Delivery boundary

Review delivery changes only this handoff, routing and contributor status prose. Local/actual remote
child started at `d567651`; parent M2 remains `4f09265791c82452a5800cc6d9855938bf88a46e`, both F2
preservation refs remain `4ea24d53afc57778addf3f47752e0fe73a7011ea`. Format write/check and diff
check precede the documentation-only commit and normal child push; post-push remote/clean/ref
identities are returned with the commit. No implementation repair, helper integration, PR, merge,
freeze, formal measurement, Unix P1 repair or acceptance update is included.
