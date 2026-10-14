# Stage B first-failure bounded diagnosis (2026-10-14)

Returned to trunk from child `feature/otel-redesign_M2_fixture`, starting clean at
`99b54804dcf3c9fcfe38f7990f0f84aa4827fda6`, under the
[Active assignment](opentelemetry-m2-fixture-ci-correction.md#active-assignment-stage-b-bounded-diagnosis-before-correction-2026-10-14).
This is a correction plan, not acceptance. Stage B remains failed; P1, integration and PR readiness
remain blocked, P2 remains accepted. Implementation, tests/configuration and approved durations are
unchanged. No complete matrix rerun, deadline extension, PR, merge, freeze, formal measurement or
acceptance update. Remain on the child as the packet requires; “return to trunk” is delivery of this
diagnosis for assignment, not modification of the parent branch.

## Evidence identity and earliest failures

Rehashed the original archives and their listed member lengths/hashes: Stage B 56 members, Stage A
56 members and feasibility 40 members, all zero mismatches. SHA-256 identities:

| Archive in `.cache/`                                         | SHA-256                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `windows-launcher-stage-b-5268361-20261014-sealed.zip`       | `4fc01b2773ce343e43e486eceeebbbc54ff9e335d4b602a52928769f08a4482e` |
| `windows-launcher-stage-a-1feb43a-20261014-final-sealed.zip` | `fd66649728942e41b03b691b1dfc584236b99b39fccc7176ea44adfa663fad3e` |
| `windows-job-feasibility-670985a-20261014-sealed.zip`        | `72ac389d6354882e12a180af202d06fb19c8c62825198d396912f5f3dee1f546` |

The [first execution packet](../../test/support/windows-launcher/validation-receipt.json) binds
nine executed-source payloads, eight driver receipts and the log. Independently decoded/rehash-checked
all payloads and receipts plus the log: zero mismatches. Source inspection uses these executed bytes
as well as checkpoint source. Against Git bytes at the requested checkpoint, `Transport.cs` and
`host.ps1` are identical. `Job.cs` differs by newline normalization; adapter, scenario, workload,
test and strict-project JSON differ by formatting, quote normalization and import ordering. The
budget document adds the first-failure status/accounting warning. These differences introduce no
runtime encoding/detach/deadline correction. Executed and formatted identities remain distinct.

Saved raw failures contain inherited environments; they were read locally, never echoed or copied
into new evidence. New summaries whitelist filenames, identity/hash fields, receipt booleans and
classified error boundaries. Existing private evidence remains immutable; no uncertain root was
deleted. The initial archive-verifier attempt supported `files` but not older `members` manifests;
it reported lookup mismatches for the older archives. Corrected schema selection only, retained
the verifier source, then verified all three successfully. This was not a workload attempt.

| First case       | Earliest failing boundary                                                                             | Dependent assertions not reached                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| transport        | Inner host control JSON deserialization, before first workload starts                                 | Non-ASCII arguments/env, cwd, exit 7, stderr identity, capped output, real Git |
| launch-races     | Passed: missing executable and three immediate repeated cancels                                       | No extension to orphan, general transport or fault coverage                    |
| orphan-normal    | `intermediate.json` 2,000 ms receipt deadline; only leader receipt exists                             | Descendant ancestry, actual orphan, normal completion and settled receipt      |
| orphan-cancel    | Same intermediate setup failure                                                                       | Actual orphan cancellation and completion barrier                              |
| observation-loss | Same intermediate setup failure                                                                       | Observation denial, uncertainty rejection, root/primary-error behavior         |
| host-death       | Same intermediate setup failure                                                                       | Actual host kill and subsequent cleanup behavior                               |
| malformed        | Same intermediate setup failure                                                                       | Unsupported control-kind injection and fault settlement                        |
| driver-cleanup   | Outer `driver-abandoned.json` 10,000 ms setup deadline; inner scenario also failed intermediate setup | Deliberate abandonment, exit 9, independent cancellation/absence completion    |

All eight saved driver receipts verify. Seven record command completion with `absent:true` and
settled captured output (six exit 1, launch-races exit 0). Driver-cleanup has no such completion;
its `observedOuterAbsence:false` cannot be replaced by shutdown success. Failures retained roots.
The launch-races root was removed after the independent successful barriers. Calling cancel,
ending stdin, closing a job handle, or receiving shutdown requests proves no absence by itself.

## Encoding finding and smallest proposed correction

**High confidence in the missing encoding contract; the precise default code page was not measured.**
Locations: [launcher.ts](../../test/support/windows-launcher/launcher.ts), `send()` and stdout
handler; [host.ps1](../../test/support/windows-launcher/host.ps1), before Add-Type;
[Transport.cs](../../test/support/windows-launcher/Transport.cs), `Run()` input task and `Send()`.
Node JSON.stringify emits literal Japanese text, stdin string writes use UTF-8, and stdout explicitly
decodes UTF-8. Windows PowerShell/.NET `Console.ReadLine` and `Console.WriteLine` have no explicit
encoding configuration. JavaScriptSerializer consumes the already-decoded string; CreateProcessW
and the UTF-16 environment block are later boundaries, unreached by this first failure. Saved
serializer failure text has corrupted Japanese in the request. PowerShell shell redirection also
means the preserved log is not pristine child UTF-8; it cannot establish the exact raw byte/code-page
mapping. No encoding diagnostic runtime or corrected transport was executed here.

Minimal correction proposal: set Console input/output to explicit BOM-free UTF-8 before any reader
or writer is obtained, keep Node write encoding explicit, and use strict incremental decoding in
both directions. `$OutputEncoding` alone does not fix these Console calls. Keep native Unicode
arguments/environment and separate base64 workload output. Emit only a bounded error code/phase/ID
on malformed input; never serialize exception text containing the whole request/environment.

Make newline frames byte-bounded at the existing 1,048,576 limit before allocating a whole line.
The host currently checks length only after unbounded ReadLine; Node counts UTF-16 units and checks
the aggregate chunk before separating frames. Specify LF termination, optional CR removal, no BOM,
no blank/truncated frames, and reject invalid UTF-8, JSON/schema/order/ID and noncanonical base64
without admitting further work. Align serializer MaxJsonLength with the frame limit explicitly.
Retain the existing 65,536 bytes per workload stream while draining to EOF; count bytes before
base64 allocation and validate encoding rather than relying on Buffer.from's permissive decoding.
Keep control buffering and queued writes bounded, including stdin backpressure. This is a local
transport correction, not a new launcher architecture.

Fail-before/pass-after oracle: one Node command with argument and allowlisted environment value
`日本語`, returning both as JSON on stdout and the same text on stderr. Assert exact code points and
UTF-8 bytes, exit identity, job absence and both pipe settlements, then shutdown/close. Supply the
request in chunks splitting a multibyte character. Separate finite in-memory framing vectors cover
split/coalesced valid frames, malformed UTF-8/JSON, oversized/no-newline/truncated input and invalid
base64; all reject and seal admission without dumping request values. The original transport case
later covers quote/space/empty/backslash/cwd, exit 7, 200,000-byte draining and Git. The small oracle
does not count those dependent checks as passed.

## Orphan setup finding and the single diagnostic

**High confidence that the missing detached option is a concrete setup regression; moderate confidence
that it alone explains every original missing receipt.** Location:
[workload.mjs](../../test/support/windows-launcher/workload.mjs), both generation spawns.
The failed model uses absolute Node executable and `[import.meta.filename, next, root, lifetime]`,
`stdio:"ignore"`, `windowsHide:true`, `unref()`, without `detached:true` or spawn/error/exit reporting.
It records a leader then immediately relinquishes the child. `unref()` changes event-loop ownership;
it does not provide the missing detached process-launch semantics.

The preserved feasibility source uses the same Node executable/script/role/root launch model,
ignored stdio, hidden windows, **detached:true at both levels**, unref and spawn-error receipts.
Its first non-detached setup also failed. Its corrected result proves the three-generation chain,
leader/intermediate exits and ActiveProcesses=1 before normal/cancel observed zero. It differs from
Stage B in native inherited-handle/pipe transport, lifetime (1,800 versus 800 ms), extra lifetime
argument, synchronous file receipts and host arrangement. It is supporting evidence, not a Stage B
acceptance substitution. The saved spawn diagnostic proves a different normal captured-stdio child
only; it never proved the failed ignored-stdio orphan.

Consumed exactly **one** isolated diagnostic workload; no tuning/retry. Temporary copies of
checkpoint `launcher.ts`, `host.ps1`, `Transport.cs` and `Job.cs` are byte-identical to the worktree.
Temporary workload differs only by adding detached:true and identity-only spawn/error/child-exit
listeners plus leader/intermediate self-exit receipts. Ignored stdio, unref, native containment,
800 ms normal lifetime and adapter bounds are unchanged. The driver uses one fresh host, one native
leader launch, absolute arguments, an ASCII diagnostic root without spaces and only
`SystemRoot` in the supplied environment. It adds no encoding workaround. Descendant command
arrays and spawn receipts are sealed; no whole environment or private error text is logged.

Commands from repository root:

```powershell
node .cache/stage-b-diagnosis-99b548/prepare.mjs
node --import ./node_modules/tsx/dist/loader.mjs .cache/stage-b-diagnosis-99b548/runtime-driver.mjs
```

Exit 0, Node 22.23.1, compilation **440.20 ms**, ready **1,217.06 ms**, complete diagnostic
**2,324.83 ms** including setup inside the driver, fresh host, workload and shutdown/close.
Launcher input preparation and tsx bootstrap precede that driver interval; this is neither a test
cost bound nor cold suitability proof. Host reports nested-job membership. Ancestry is
23324 -> 16556 -> 9188; both parent self-exit receipts report code 0. The native host reports leader
exit at 1,357.28 ms; at 1,466.72 ms the chain and parent exits are present and completion is not.
Completion follows at 2,273.95 ms with code 0, job absent and both captured streams settled empty;
settled.json exists, shutdown and host close were awaited. The root remains preserved.

Limits: ready 6,000; each cancellable local receipt poll 2,000; normal completion 3,000; a single
4,000 ms wrapper around cleanup; a 30,000 ms last-resort host-kill timer. No limit was extended.
This diagnostic timer is not an independent owner/driver-timeout correctness proof: killing the
host on expiry would retain the root, and cannot authorize deletion. Child-exit listeners may not
fire after an unref'ed parent exits; the self-exit and native leader receipts identify what was
actually observed. No second diagnostic is permitted by this packet.

Minimal correction: restore the proven detached/ignored-stdio/unref setup at both spawns, retain
bounded spawn-error identity receipts and explicit parent exit proof. Do not change containment
code to compensate for this setup defect. Oracle: before, no intermediate/descendant within the
original receipt budget; after, exact ancestry and actual parent exits precede still-pending command
completion, then normal settled receipt and independently observed absence/output. This one
diagnostic supports the setup correction under the retained native adapter; it does not isolate
detached from diagnostic instrumentation/environment differences, nor establish cancel/fault,
normal-user transport or handle-inheritance audits. Those remain unknown until separately reached.

## Deadline and settlement findings

**High confidence from static traces.** Relevant locations:
[launcher.ts](../../test/support/windows-launcher/launcher.ts) `finite/fail/dispose`,
[scenario.mjs](../../test/support/windows-launcher/scenario.mjs) `file/try/catch/fault branch`,
[windows-launcher.test.ts](../../test/telemetry/windows-launcher.test.ts) outer setup/poller/disposal,
[Transport.cs](../../test/support/windows-launcher/Transport.cs) input/entry loop/finally, and
[Job.cs](../../test/support/windows-launcher/Job.cs) `Drain/Cancel/Dispose`.

| Timer/task       | Current accounting and unresolved boundary                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ready            | 6,000 ms separately for outer and inner; mkdir precedes outer ready; test clock includes both                                                                     |
| native operation | 15,000 ms per entry from creation, checked by the host loop; reads/writes or launch work can delay checks                                                         |
| outer completion | 16,000 ms from awaiting completion, after abandonment polling in that case; not the same start as native entry                                                    |
| transport        | Three sequential 4,000 ms completions after inner ready; all race losers continue                                                                                 |
| launch-races     | Missing-executable await has no local finite wrapper; three sequential 2,000 ms cancellations                                                                     |
| orphan           | Three sequential 2,000 ms polls, 100 ms delay, then normal 3,000 plus settled-file poll 2,000, or cancel/fault 2,000                                              |
| abandonment      | 10,000 ms poll before 16,000 ms await; ENOENT loop survives timeout                                                                                               |
| disposal         | Separate shutdown 4,000 and close 4,000; rejection of the first skips the second                                                                                  |
| fault close      | Separate 4,000 ms host close after rejecting dispose, not shared with previous cleanup                                                                            |
| case/matrix      | Vitest 30,000 per case does not cancel the async body; planned 260,000 shell driver bound was never enforced                                                      |
| pipe/input tasks | ReadLine task created again even after shutdown; background reads/drains are not joined in fatal finally; IsCompleted includes faulted tasks, whose Result throws |

`finite()` clears its own timer, not its body: receipt pollers keep 10 ms timers and reads alive,
and timed-out command/ready promises keep their work. `fail()` seals admission and rejects/clears
pending commands, then ends stdin, but ignores later control receipts and supplies no independent
absence proof. Normal host completion checks leader exit, queried job zero and both drain tasks.
Fatal finally only requests termination and disposes handles; no post-termination zero or drain-task
settlement is awaited. CloseHandle results are ignored; disposal is not observation. Do not infer
successful cleanup from these requests. A control Send failure must still enter cleanup rather than
throw from fatal serialization before preserving the original error.

Smallest coherent correction proposal:

1. Use monotonic absolute operation/test/cleanup deadlines. Every nested wait gets the remaining
   interval clipped to its existing phase ceiling; use one cached disposal promise and one absolute
   4,000 ms cleanup deadline for termination, absence observation, pipe/body settlement, shutdown
   and close. Await close/settlement even when shutdown rejects, within the remaining interval.
2. Receipt polls accept cancellation, stop scheduling and join in-flight read work. Timeout signals
   cancellation/termination and settles owned losers; cancel alone is not a settlement receipt.
   ReadLine/drain shutdown needs bounded joining, with failures recorded as uncertainty. Do not
   reuse a disposed job handle or substitute a PID snapshot for the private job barrier.
3. Enforce the existing 260,000 ms driver limit with a work cutoff that reserves cleanup and log
   settlement; similarly reserve case cleanup before the 30,000 ms watchdog. Stop case admission
   at the first unexplained boundary failure; finish only bounded cleanup of already-started work.
   Enforce admission sequentially, rather than scheduling all eight in advance.
4. If Vitest/scenario/driver times out, an independent still-live owner requests job termination,
   queries zero and joins output within the shared remainder. If that owner is unavailable, retain
   roots and report unknown. Killing only the runner never authorizes deletion. Keep the existing
   private-job architecture; no new daemon or reused-PID cleanup scheme.
5. Preserve the actual primary Error plus a separate cleanup outcome. Existing ordinary catches use
   `primary ??=` correctly, but lose secondary error identity. The fault branch currently only
   records a literal “deliberate body failure”; it never raises/captures that primary Error. Create
   a real identifiable body failure after established setup before injecting the intended fault.

Budget incompatibility to return to trunk: the documented 6+16+4+4=30 seconds assumes shared
cleanup; current outer disposal alone can consume 8 seconds. Abandonment structurally adds 10
seconds before its 16-second completion await (6+10+16+8=40 before ordinary overhead). Native
15-second operation overlaps some of this but does not make the caller's sequential timers an
enforced bound. Even with shared cleanup, inner transport's maximal 6+3*4+4=22 seconds cannot fit
the enclosing native 15/caller 16-second windows. Inner orphan phases also exceed the enclosing
window when all maxima are added. Operation ceilings are not independently spendable allowances.
No increased values are proposed/adopted. Start outer operation at launch, include the 10-second
abandonment poll within it, and propagate/clamp the enclosing deadline while reserving inner/outer
cleanup. Trunk must decide whether clipped phases are acceptable or the approved budget is
incompatible; a slow clipped execution returns failure/unknown, never an automatic extension.

Fail-before/pass-after oracles: a delayed shutdown followed by delayed close consumes one cleanup
budget, not two; timeout leaves no active receipt poll; cleanup rejection still attempts bounded
close; outer operation expiry while awaiting abandonment stops work at its absolute cutoff; a first
boundary failure prevents later case admission; an actual body error plus cleanup failure preserves
both identities and the root. Use controlled clocks/tasks where possible; one reached driver-timeout
fault later proves the independent absence barrier. Timing values remain hang-detection ceilings.

## Finite next validation order for a subsequent trunk assignment

Nothing in this table authorizes execution now. Current packet runtime count: **one isolated
diagnostic**, zero Stage B case reruns. After a separately assigned minimal correction and budget
disposition, allow at most one execution of each listed runtime entry, ordered by dependencies;
no rerun-until-green or complete automatic campaign.

| Order | Finite check                                                                                        | Required reached oracle and ceiling                                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Static strict typing, relevant lint, format/diff; one finite in-memory protocol/deadline vector set | Explicit UTF-8/byte framing, malformed handling, shared cleanup, cancelled polls, stop admission, primary/secondary errors; general unit default 5 seconds                         |
| 2     | One smallest non-ASCII round-trip                                                                   | Exact argument/env/stdout/stderr identity plus all barriers; ready 6,000, work 4,000, shared cleanup 4,000, case 30,000                                                            |
| 3     | One transport case, then one launch-races case                                                      | All original dependent transport/Git/output assertions; missing-executable and repeated cancels; existing phase ceilings, clipped to enclosing deadlines                           |
| 4     | One orphan-normal case                                                                              | Ancestry, both parent exits, live orphan before completion, settled receipt and independent absence/output; setup 2,000 per receipt, completion 3,000                              |
| 5     | One orphan-cancel case                                                                              | Same proven setup, deliberate cancel and actual absence/output within 2,000; audit only actual supported handle inheritance                                                        |
| 6     | One observation-loss, then one host-death, then one malformed case                                  | Each has setup proof and explicit fault injection receipt before claiming coverage; reject uncertainty, retain root, preserve real primary Error; fault 2,000                      |
| 7     | One driver-cleanup case including a controlled runner-timeout boundary                              | Abandonment/actual driver loss reached; independent owner observes absence/output before disposal, or retains root on unavailable observation; setup 10,000 inside outer operation |

Every process entry uses shared cleanup 4,000, case 30,000 and unchanged two-worker Windows policy;
native 15,000 and outer 16,000 are enclosing absolute ceilings, not additions after setup. Keep the
260,000 overall ceiling, including bootstrap, finite static/protocol checks as applicable, startup,
logging and reserved cleanup. If this expanded sequential plan cannot fit, return budget
incompatibility to trunk before executing; split authorized work rather than extend the ceiling.
Do not count skipped, pre-fault setup failures or supported-model limitations as tested faults.
Stop immediately on the first unexplained encoding/setup/deadline/absence/output failure, mismatched
source identity, unsupported host prerequisite or missing cleanup observation. Retain all evidence
and roots; no further admission or second tuning run. This plan does not authorize helper/Unix
integration, full OS/package testing, performance acceptance or a new architecture.

## Delivery verification

Temporary sources/results and sanitized metadata are sealed outside runtime paths in the local
diagnosis archive identified below. Original archive/source/receipt checks are independent of the
single workload result. Documentation-only delivery uses format write/check and diff check;
no build, test/configuration or implementation changes are required for this return.

Local seal: `.cache/stage-b-diagnosis-99b548-sealed.zip`, SHA-256
`e82b90b52e030b0bfd1ec6f147c5f02220fc0e6f2f37a1d3789eb290599bca3d`;
manifest SHA-256 `7491d30a54c57086e8a57ad5360d05df750f08e2a692d06e38365664916b2a60`.
Rehashed all 24 archived files/lengths, zero mismatches. Contains temporary native/adapter/workload
and driver sources, exact differences, spawn/self-exit/settled receipts, result/timeline, verifier
sources and sanitized source/first-receipt summaries. Seal verification is saved outside the archive
at `.cache/stage-b-diagnosis-99b548-seal-check.json`. Existing archives retain their original hashes.
`npm run format:write`, `npm run format:check` and `git diff --check` passed; the working tree changes
are confined to this report and packet routing. No implementation correction was formatted into
the repository. Source-copy preparation and hashing are archival work, not additional workloads.

Live remote before delivery: child matched `99b54804dcf3c9fcfe38f7990f0f84aa4827fda6`;
parent M2 `4f09265791c82452a5800cc6d9855938bf88a46e`; both F2 preservation refs
`archive/otel-m2-{harness,product}-4ea24d53afc5` matched
`4ea24d53afc57778addf3f47752e0fe73a7011ea`. Sandbox network restriction required approved
repository-specific escalation for live Git refs/normal push, with command-local safe.directory
and no global Git configuration change. Delivery stays on the child; trunk receives this report
for correction assignment. Post-push actual remote and clean-state verification is reported with
the final commit identity.
