# Standalone Windows launcher (Stage B, not integrated)

The experimental sources under `test/support/windows-launcher/` are an unfinished standalone
test boundary. The first Stage B matrix failed; do not use it for fixture disposal or interpret
its presence as P1 completion. The existing fixture helpers and Unix ownership correction are
outside this slice. See the [handoff](../handoff/opentelemetry-m2-fixture-ci-correction.md) for
the exact fixed-source evidence and unresolved findings.

`launcher.ts` owns invocation-local control, launch IDs, bounded output decoding, primary host
failure and shutdown promises. `host.ps1` starts one hidden PowerShell host with one Add-Type
compilation. `Transport.cs` owns readiness/admission and separate exit/absence/pipe completion
receipts. `Job.cs` owns native job, process and pipe handles; it assigns each workload at creation
with `PROC_THREAD_ATTRIBUTE_JOB_LIST`, without suspended/unassigned fallback. Its inherited handle
allowlist contains NUL input and workload stdout/stderr only. Private job handles are created
non-inheritable. These mechanisms require independent review and further verification.

Requirements are Windows 10+, x64 ABI, existing Windows PowerShell 5.1/.NET Add-Type and
System.Web.Extensions, installed Node/Git and repository dependencies. Restricted compiler/host
policy, unsupported ABI/OS or job assignment failure must fail with retained roots; install no
toolchain or dependency to bypass them. This session runs as the sandbox account in a nested job;
it does not establish normal-user Stage B transport behavior. Earlier prototype normal-user
evidence remains separately scoped. No cross-test daemon or shipped native binary is used.

Supported intended workloads are direct Node/Git CreateProcess descendants inheriting containment.
WMI, brokers, adversarial breakaway and other escapes are unsupported. A private job admitting one
leader is sealed for further launches before its zero observation. Exit, observed absence and pipe
settlement are separate. EOF, malformed control, missing observation, timeout or host death retains
roots and primary errors. A test driver uses an independent outer job to contain inner hosts and
workloads; fault roots remain preserved even after an independent cleanup observation. Never infer
safe deletion from leader exit or successful termination alone.

Maintenance includes x64 native layouts, Win32 error identity, command-line quoting, UTF-16
environment blocks, explicit control encoding, handle allowlists, pipe drain faults, admission and
shutdown races. Initial runtime evidence identifies missing explicit UTF-8 control encoding and
unexplained orphan setup deadlines. Inherited-handle runtime audits, actual host-death/orphan
cleanup, fault primary identity and finite matrix-driver enforcement remain unverified. Further
work must follow the handoff's stop/diagnosis rule rather than retry or extend deadlines.

New Windows cases are isolated by platform-specific skip in their own test file; strict typing
still includes the adapter on other platforms. Root Windows worker cap remains two and default
unit-test timeout remains five seconds. The provisional [case/phase budget table](../../test/support/windows-launcher/budgets.md)
records rationale, setup, scheduling and cleanup allowance. All larger timeouts belong only to
new cases, and are hang detection rather than performance acceptance. Existing-case budgets may
be proposed only in a later authorized integration slice.

Focused commands (no build needed):

```powershell
node node_modules/typescript/bin/tsc -p packages/gitlode/tsconfig.windows-launcher.json
node node_modules/oxlint/bin/oxlint packages/gitlode/test/support/windows-launcher/launcher.ts packages/gitlode/test/support/windows-launcher/scenario.mjs packages/gitlode/test/support/windows-launcher/workload.mjs packages/gitlode/test/telemetry/windows-launcher.test.ts
```

Do not repeat the runtime matrix pending disposition. First-run source bytes and retained receipt
hashes are recorded in `test/support/windows-launcher/validation-receipt.json`; local sealed
evidence includes the raw first failures. Source validation is independent from runtime success.
Before later authorized execution, warn that fresh hosts/compilation and process work take time,
enforce the outer driver budget and stop unexplained failures. Never rerun Stage A for its obsolete
gate. No full OS/package campaign, formal measurements or acceptance updates are implied.
