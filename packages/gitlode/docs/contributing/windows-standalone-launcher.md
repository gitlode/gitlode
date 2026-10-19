# Standalone Windows launcher (Stage B, not integrated)

The experimental sources under `tests/performance/support/windows-launcher/` are an unfinished standalone
test boundary. Correction round 1 implements the confirmed encoding, orphan setup and deadline
findings from the [diagnosis](../handoff/opentelemetry-m2-stage-b-first-failure-diagnosis.md), under
its [assignment](../handoff/opentelemetry-m2-fixture-ci-correction.md). Its one source-bound campaign
passed all nine entries; see the [correction return](../handoff/opentelemetry-m2-stage-b-correction-round1.md).
[Independent review](../handoff/opentelemetry-m2-stage-b-independent-review.md) returned corrections
required for error paths, enforced deadlines and settlement. The mechanism descriptions below do
not independently establish delayed-path correctness.
Round 2 repairs these paths under the [correction packet](../handoff/opentelemetry-m2-stage-b-correction-round2.md).
Its exit-path table, fault vectors and delivery outcome are the continuation record; this is not
self-acceptance or permission to integrate helpers.
Round 2 passed its injected checks, nine-entry regression and one normal-contributor transport
case, but returned incomplete because an existing runtime handle enumerator was unavailable.
Runtime handle types/ownership and job/control-handle exclusion remain unverified; see the
[return](../handoff/opentelemetry-m2-stage-b-correction-round2.md#round-2-return-incomplete-at-runtime-handle-audit-prerequisite).
The [round-2 independent review](../handoff/opentelemetry-m2-stage-b-round2-review.md#independent-return-2026-10-19)
accepts all five fixes as a correction slice and reverifies the saved campaign/ordinary-token
evidence. Runtime handle audit remains separately pending with a concrete Windows API diagnostic
plan; no new audit run or helper integration is authorized by that return.
P1, integration and PR readiness remain unaccepted;
existing fixture helpers, product/no-owner/formal helpers and the Unix repair are outside this slice.

`launcher.ts` owns invocation-local control, bounded writes, ordered launch receipts, strict output
decoding and one cached disposal promise. `protocol.ts` retains one byte-bounded newline frame
and uses strict UTF-8 decoding; both endpoints reject BOM, blank, oversized/truncated frames and
invalid schema/order/IDs. `host.ps1` explicitly sets BOM-free strict UTF-8 before Add-Type or console
stream creation, with one hidden host and one compilation per owner invocation. `Transport.cs`
peeks the control pipe before bounded reads, so shutdown leaves no background ReadLine task. Its
native input framing shares the in-memory vector implementation. Fatal errors and host diagnostics
are bounded classifications, never exception text containing requests or inherited environments.
Workload pipes remain separate: drain through EOF, retain 65,536 bytes per stream and validate
canonical base64 before decoding. Control frames/queued writes are capped at 1,048,576 bytes.

`Job.cs` assigns each direct Node/Git workload at creation using `PROC_THREAD_ATTRIBUTE_JOB_LIST`,
without suspended/unassigned fallback. Inherited handles allow only NUL input and workload
stdout/stderr; private job handles are non-inheritable. Exit, queried absence and successful drain
settlement are separate barriers. Native fatal cleanup reserves time for cancellation, observation
and pipe joining; failed observation or pipe tasks remain uncertainty. Closing handles or requesting
termination supplies no absence observation. Detached ignored-stdio/unref orphan generation records
bounded spawn/error/exit identity and parent self-exit receipts. Runtime assertions additionally
require native leader exit and a still-pending completion after ancestry/parent exits.

Requirements: Windows 10+, x64 ABI, existing Windows PowerShell 5.1/.NET Add-Type and
System.Web.Extensions, installed Node/Git and repository dependencies. Stop unsupported host,
compiler or containment prerequisites; install nothing to bypass them. Supported workloads are
direct Node/Git descendants inheriting containment; brokers, WMI and adversarial breakaway are
unsupported. Saved normal-user transport evidence is reverified; runtime inherited-handle exclusion
remains unverified.

The [budget document](../../../../tests/performance/support/windows-launcher/budgets.md) owns cutoff arithmetic.
`deadlines.ts` uses a shared monotonic origin across Node processes. Poll expiry aborts/joins the
active read and delay; all local waits clip to enclosing time. Shutdown failure still attempts
bounded close under the same 4,000 ms disposal deadline. `case.ts` supplies an independent outer
owner, retains primary/secondary errors and every runtime root for review. Killing a runner alone
cannot authorize deletion. `runner.mjs` admits cases sequentially and stops at the first unexplained
failure; `driver.mjs` enforces the 260,000 ms campaign with a 4,000 ms final reserve.

Both control read streams seal admission on error with redacted classifications. Disposal requests
active stop/pipe close halfway through its remaining allowance if normal shutdown has not settled;
forced stop remains uncertainty. Native work cutoffs include construction, input and send, with
checks before admission and after launch returns. Non-preemptible native calls are enclosed by
the Node/outer owner; a timeout never proves they returned. Cleanup guards each release and retains
ambiguous failed handle identities without retrying them. `io.mjs` gates and bounds filesystem
waiting, requests supported aborts and tracks outstanding operations separately. Case/campaign
control starts before mkdir and remains through receipts; pending kernel I/O stays unknown even
after process exit. Final receipt failure preserves the original outcome and emits a fallback
classification. Every root is retained.

Focused static commands (no build needed):

```powershell
node node_modules/typescript/bin/tsc -p tests/performance/tsconfig.windows-launcher.json
node node_modules/oxlint/bin/oxlint tests/performance/support/windows-launcher tests/performance/test/windows-launcher.test.ts tests/performance/test/windows-launcher-protocol.test.ts
node node_modules/vitest/vitest.mjs run tests/performance/test/windows-launcher-protocol.test.ts
powershell.exe -NoProfile -NonInteractive -File tests/performance/support/windows-launcher/framing-vectors.ps1
powershell.exe -NoProfile -NonInteractive -File tests/performance/support/windows-launcher/failure-vectors.ps1
```

The finite in-memory checks do not invoke native jobs or workloads. Default five-second unit
deadlines and root Windows two-worker policy remain unchanged. Runtime validation must be explicitly
authorized by the active handoff assignment, preceded by a source checkpoint and a real-time warning:

```powershell
node tests/performance/support/windows-launcher/driver.mjs .cache/stage-b-correction-round2/runtime
```

That command is one campaign, not an automatic retry. Do not repeat it after an unexplained failure.
Preserve original `validation-receipt.json` and sealed first-failure archives. Correction receipts
must bind exact source bytes, entry admission/reached assertions, timings/cutoffs and retained roots.
No full OS/package campaign, formal measurement, helper integration or acceptance update is implied.
