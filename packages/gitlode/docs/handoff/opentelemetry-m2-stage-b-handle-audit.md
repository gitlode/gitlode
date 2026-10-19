# Stage B creation-time handle audit assignment (2026-10-19)

## HQ priority override (2026-10-19)

The HQ-authorized test layout work supersedes the previous executable assignment. Handle-audit continuation, eligibility campaigns and formal performance runs are on hold pending HQ review. Historical outcomes and paths below remain evidence for their original revisions. Current placement and validation are tracked in [test layout](opentelemetry-m2-test-layout.md).

## Active continuation: token preflight diagnosis and conditional audit

Return `1d80f8fe73016ad62eec85388a0c46163591ff8c` is setup-inconclusive, with ZERO audited
workload launches. The missing Win32 error prevents attributing this to permissions or platform
support. Accepted correction `a5dae83` remains unchanged. Start on the same child from this packet
checkpoint. This section overrides the previous blanket no-diagnostic-repair rule for preparation
only; baseline/sensitivity and their safety/oracle/stop requirements below remain unchanged.

1. Read saved Audit.cs/preflight/receipts first. Inspect P/Invoke signature, information-class/layout,
   handle lifetime and actual requested query rights. Verify against documented GetTokenInformation
   behavior. Do not infer an API's underlying failure from a PowerShell wrapper message.
2. In a NEW retained diagnostic directory, preserve original bytes and add bounded structured error
   capture immediately after each failed native call, before any other interop/logging operation.
   Record API/class, buffer/required length, Win32 code, host PID and intended token kind without
   environment disclosure. Capture the inner exception chain safely. Do not echo complete raw logs.
3. Allow ONE no-workload diagnostic preflight on the ordinary contributor token. If its evidence
   identifies a deterministic preparation bug, allow one targeted correction and ONE confirmation
   preflight. Use proper query rights, ownership and required-length allocation as appropriate to
   the demonstrated defect; no blind shotgun changes or token privilege elevation. Establish token
   identity/integrity/elevation in the actual host; shell identity alone is not a substitute.
   If the first instrumented call succeeds, record that the old cause remains unknown and verify
   the corrected diagnostic's provenance/identity rather than claiming an established root cause.
4. Failed/unsupported/ambiguous prerequisite after this allowance returns pending. No more attempts,
   no dropped attestation, no administrator/SeDebugPrivilege fallback. Preserve all first failures.
   Static checks/compilation without launching workload are preparation, not runtime audit evidence.
5. If the explicit prerequisites pass, finish the planned diagnostic harness and run the original
   single bounded audit invocation (at most two launches: baseline then sensitivity). This is still
   the first audit invocation, not a retry of the stopped setup. Validate construction/cleanup and
   ordinary token binding before admission. Stop the first unexpected runtime failure; no runtime
   repair/retry or extra launch. The previous 52-member seal remains immutable.

Only temporary diagnostic sources may change. Existing launcher/helper/test/configuration and
accepted production bytes remain fixed; no installed utilities/dependencies or global changes.
Deliver token diagnosis/confirmation and audit verdicts separately with exact source hashes,
attempt counts, sanitized receipts and cleanup limits. Append outcome here, format write/check,
diff check, documentation-only commit/normal push, actual remote/clean/parent/F2 verification.
Keep all roots and remain on child. No self-acceptance, helper integration, PR, merge, freeze,
Unix repair, formal measurement or release acceptance update. Warn before real-process work.

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

## Limited audit return (2026-10-19)

**Inconclusive: stopped at the setup gate. Baseline and sensitivity were not launched.** Started
clean on the assigned child at `b57d3d832c32e59664b162c16df7b7d6e5fb18ad`. There was one
preparation/preflight attempt, zero runtime audit invocations and zero audited workload launches.
No retry, diagnostic repair, weaker oracle or later case was admitted after the unexpected failure.
Accepted correction implementation `a5dae83e4f55b3631061959bcf1bcd98154130e6` remains unchanged.
This return does not accept Stage B, P1, helper integration or PR readiness; P2 remains accepted.

| Boundary    | Verdict                                          | Evidence and limits                                                                                                                                                                      |
| ----------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline    | Inconclusive; not executed                       | Setup failed before any `JobProbe` construction, CreateProcess, capture, walk, object comparison or resume. No inheritance/absence claim.                                                |
| Sensitivity | Inconclusive; not executed                       | No second admission or deliberate target duplication. No sensitivity claim.                                                                                                              |
| Cleanup     | Setup settled; workload cleanup not applicable   | Preflight PowerShell exited 1; token buffer freed in `finally`, identity disposed by `using`. No audit event/duplicate, snapshot/marker, workload job or workload process was created.   |
| Token       | Inconclusive for the audit; shell check observed | Separate normal-user shell showed contributor SID ending 1002, Medium integrity and Administrators deny-only. Native-host token attestation failed; sandbox SID ending 1004 is excluded. |

### Reached preparation and first failure

Prepared retained copies under `.cache/stage-b-handle-audit/` from the fixed implementation's Git
objects. All 14 copied executable/support files matched live source after CRLF normalization;
the source manifest records original, live and diagnostic byte hashes and exact replacements.
Existing runtime/helper/test/configuration files were never temporarily edited. The outer-owner
copy preserves ordinary creation flags; only the inner diagnostic copy prepares suspension and the
creation-seam callback. JOB_LIST, HANDLE_LIST and security bytes in that copy were preserved.
The driver path was prepared, but scenario/runner construction and its runtime invocation were
not reached; this stopped setup is not a validated executable audit harness.

The setup command ran `node .cache/stage-b-handle-audit/prepare.cjs`, then existing Windows
PowerShell with `-NoProfile -NonInteractive -File .cache/stage-b-handle-audit/preflight.ps1` as the
ordinary contributor, without administrator elevation. Preparation reported 14 files and zero
workloads. `Add-Type` compilation returned successfully. The diagnostic passed Windows 10+/x64,
all 17 declared PSS entry offsets, 136-byte entry/48-byte union sizes and required export-resolution
checks before reaching token validation. These are managed-layout/export checks, not runtime proof
of a successful PSS query/walk. The combined command returned exit 1 after 1.879 seconds; this is
setup cost, not a performance measurement.

The first unexpected failure was
`GetTokenInformation(identity.Token, TokenElevation = 20, bufferSize = 256)` returning false.
The saved PowerShell `MethodInvocationException` message is
`Exception calling "Preflight" with "0" argument(s): "token elevation"`.
The catch retained only the wrapper's message/type, so the underlying Win32 error number is
**unavailable**. No permission-denied, unsupported-API or implementation-leak diagnosis is justified
by this evidence. The precise failed call is established; its underlying cause is not. Recovering
the error by another native call/attempt was not undertaken under the stop instruction.

No native JSONL receipt was created: the first such write follows successful token queries.
Comparison controls, target PID/creation identities, handle counts/statuses, contamination and
resume/absence/drain/host-close receipts therefore do not exist for this attempt. The separate
shell observation was `WAKA-PC\t-wakabayashi`,
`S-1-5-21-4028493654-784021077-2452779405-1002`, Medium `S-1-16-8192`, Administrators deny-only,
x64, shell 7.6.7. It is not a per-host token attestation. No inherited environment values or object
paths were recorded. All invocation and historical roots were retained.

The bindings were checked against the existing plan and Microsoft's documented
[PSS entry layout](https://learn.microsoft.com/en-us/windows/win32/api/processsnapshot/ns-processsnapshot-pss_handle_entry),
[validity flags](https://learn.microsoft.com/en-us/windows/win32/api/processsnapshot/ne-processsnapshot-pss_handle_flags),
[capture flags](https://learn.microsoft.com/en-us/windows/win32/api/processsnapshot/ne-processsnapshot-pss_capture_flags)
and [object comparison API](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-compareobjecthandles).
This does not validate unexecuted diagnostic behavior. CREATE_SUSPENDED was prepared only; there
was no suspended workload execution and no claim about untouched production scheduling.

### Saved evidence and delivery

- Archive: `.cache/stage-b-handle-audit-sealed.zip`, SHA-256
  `5771091f47bd8598e8201a1afcff9a2cde044217fab2d9f0fcefd86f86e2bd7b`.
- Archived `manifest.json`, SHA-256
  `9b3be87f469a66103148ab4ebbda02906ab73e256d4e3a7db73b79275146be50`.
- Archived `source-manifest.json`, SHA-256
  `94e7485641f0c12a81a811193ebd8cea7ae244e6cb92bd55aff002a50f15d10f`.
  Original fixed sources are in `original/`; prepared copies are in `runtime/` and `outer/`.
- Archived `Audit.cs`, SHA-256
  `8ae33539e2e655a046ab6873c0a6599bf031583247b32975b2930e30da0752a9`.
  `prepare.cjs`, `preflight.ps1`, `evidence/setup.json`, `evidence/outcome.json` and
  `evidence/execution-transcript.txt` preserve construction and the stopped attempt.
- Seal readback: `.cache/stage-b-handle-audit-seal-check.json`; **52 members plus the manifest**
  verified against archived bytes and local evidence, zero hash/length mismatches. The first seal
  verifier's slash-name lookup failed because Windows .NET emitted backslash ZIP entry names.
  The original archive/manifest were preserved; the separate
  `.cache/stage-b-handle-audit-verify-seal.ps1` normalizes separators and verifies every member.
  This storage-verification correction did not repeat setup or execute a workload.

The prior round-2 archive remains SHA-256
`5ecab09f39f4df0c2815d705ffa50df956fe122b954256ae01d878a30be38a3e`; the diagnosis archive remains
`e82b90b52e030b0bfd1ec6f147c5f02220fc0e6f2f37a1d3789eb290599bca3d`. Prior evidence/seals were
not overwritten. Initial sandbox Git reads rejected repository ownership; subsequent sandbox reads
used command-local `safe.directory` only, without changing global configuration.

Delivery is this appended result only, with format write/check and diff check before a documentation
commit and normal child push. Actual remote, clean tree, unchanged parent M2
`4f09265791c82452a5800cc6d9855938bf88a46e` and both F2 preservation refs
`4ea24d53afc57778addf3f47752e0fe73a7011ea` are verified at delivery. No nine-case/full package/OS
campaign, formal workload, installation, helper integration, PR, merge, freeze, Unix repair or
acceptance update was performed. Return the failed setup to trunk for diagnosis and a separately
authorized continuation; the runtime gate remains pending.
