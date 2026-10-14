# Stage B diagnosed correction round 1 (2026-10-14)

Returned from `feature/otel-redesign_M2_fixture`, starting clean at
`baee244abcad8ff2ac00115f596bc6be296f3d1d`, under the packet's
[Active assignment](opentelemetry-m2-fixture-ci-correction.md#active-assignment-stage-b-diagnosed-correction-round-1-2026-10-14).
The bounded correction and finite validation passed and await **independent focused review**.
This is not acceptance: Stage B/P1/integration/PR readiness remain unaccepted, P2 remains accepted.
The [diagnosis](opentelemetry-m2-stage-b-first-failure-diagnosis.md) owns the original failure history.
No existing helper integration, product/no-owner/formal helper change, Unix repair, full OS/package
campaign, formal measurement, PR, merge, freeze or acceptance update occurred.

## Fixed implementation and static evidence

Source and contributor/budget documentation were checkpointed before process validation at
`f45062df73561ea563b5b0ad078bd92694bc910f`. All 17 checkpoint files were copied byte-for-byte
before execution. After the campaign, all saved/live SHA-256 identities matched, and all decoded
text matched checkpoint bytes after CRLF normalization; Git hashes and executed-byte hashes remain
separate in the [sanitized receipt](../../test/support/windows-launcher/correction-round1-receipt.json).
No executed implementation was changed after the runtime campaign.

Corrections are confined to the standalone launcher:

- Explicit BOM-free strict UTF-8 at the PowerShell endpoints, byte-bounded incremental newline
  framing at both endpoints, strict canonical bounded base64, bounded queued control writes and
  redacted failure classifications. The native reader peeks the private control pipe rather than
  retaining a background ReadLine task. Native Unicode arguments/environment and workload pipes
  remain separate. The smallest Unicode request splits within a multibyte character.
- Both orphan generation spawns now use the proved detached/ignored-stdio/unref model. Bounded
  spawn/error/child-exit and self-exit identity receipts accompany ancestry; assertions require
  native leader exit and completion still pending after both parent self-exit receipts.
- Monotonic enclosing cutoffs, one cached disposal promise and one shared 4,000 ms cleanup
  deadline. Shutdown failure still attempts close. Native fatal control-send failure cannot skip
  termination/observation/drain attempts; faulted pipe tasks are observed. Receipt expiry aborts
  and joins reads/delays. Outer cancellation/completion and disposal share their cutoff.
- Sequential case admission stops at the first unexplained failure. Campaign and case work cutoffs
  reserve cleanup; controlled runner timeout is reached while an independent outer owner is live.
  Real `stage-b-body:<mode>` Errors are raised/captured and preserved separately from secondary
  uncertainty. Runner death or job disposal never counts as absence. All roots are retained.

Strict typing, relevant lint, format write/check and diff check passed. The finite Vitest in-memory
set passed **8/8**, using the unchanged five-second default and Windows two-worker root policy;
reported test duration 151 ms, full Vitest duration 474 ms. No build was required. Native in-memory
vectors compiled the real C# sources and passed two valid frames and five rejection vectors, with
zero native launches. These checks are separate from the runtime campaign, as assigned.

Fail-before used the old launcher from the starting checkpoint, then restored the corrected bytes
in a finally block. All three selected regression assertions failed: malformed UTF-8 was accepted,
noncanonical base64 was accepted and dispose calls returned different promises. Old disposal also
produced two unhandled rejections after the failing identity assertion; that log is retained.
After correction these assertions, bounded/coalesced framing vectors, cleanup/close continuation,
poll settlement, clipped arithmetic, primary/secondary identity and stop-admission checks passed.
The expected old-source failures are not runtime campaign failures.

The native vector script's initial PowerShell array construction was incorrect. Its first log was
retained; only that script was corrected before source checkpoint and it then passed. The archive
verifier's first attempt rejected a BOM in shell-created archival JSON; its first log is retained,
and only archival parsing was adjusted. Control frames still reject BOM. Neither adjustment
invoked a native workload, retried a runtime entry or changed executed evidence bytes.

## One source-bound runtime campaign

The user was warned before execution about fresh host/compilation and real workload time. Command:

```powershell
node packages/gitlode/test/support/windows-launcher/driver.mjs .cache/stage-b-correction-round1/runtime
```

Node 22.23.1, exit 0. Driver interval including tsx bootstrap, both host startups/compilation,
workloads, receipt collection and reserved cleanup was **35,820.59 ms**; the surrounding command
stopwatch measured **35,957.84 ms**. The 260,000 ms ceiling was not reached. Each entry ran exactly
once, in dependency order; nine admitted, zero unreached, zero unexplained runtime failures.
These observations are test costs, not cold suitability or formal performance guarantees.

| Entry            |  Case ms | Reached oracle                                                                                                                                                          |
| ---------------- | -------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unicode          | 3,701.35 | Exact Japanese argument/env/stdout/stderr bytes, split request, exit 0, inner absence/output and awaited shutdown/close.                                                |
| transport        | 3,834.13 | Original quote/space/empty/backslash/Unicode/cwd/env assertions, exit 7, both 100,000-byte drains retained at 65,536, actual Git version.                               |
| launch-races     | 3,856.24 | Native missing executable rejection and three immediate repeated cancellations with exit 123 and absence.                                                               |
| orphan-normal    | 4,610.93 | Exact ancestry and spawn identities, both self-exit receipts/native leader exit, completion still pending with descendant, settled file and absence/output.             |
| orphan-cancel    | 3,895.90 | Same established orphan, deliberate cancel, absence and empty settled output.                                                                                           |
| observation-loss | 3,904.09 | Established orphan, explicit observation-loss injection receipt and native-observation fatal receipt, real primary Error and separate cleanup uncertainty.              |
| host-death       | 3,847.75 | Established orphan, successful host kill request, command rejection and actual host close asserted, real primary Error and separate cleanup uncertainty.                |
| malformed        | 3,892.30 | Established orphan, unsupported-kind input and actual control-kind fatal receipt, real primary Error and separate cleanup uncertainty.                                  |
| driver-cleanup   | 4,016.12 | Established orphan/armed body-error receipt, actual 100 ms runner timeout rejection, live independent outer owner cancel, exit 123 and complete absence/output receipt. |

Every driver receipt records independent outer observed absence, successful outer cleanup and no
unexpected primary/secondary error. Fault scenarios retain their real body errors and inner cleanup
uncertainty separately; outer observation does not rewrite inner uncertainty into success. Retained
driver-cleanup evidence is the armed receipt plus controlled timeout and outer completion, not an
inner scenario completion. All nine runtime roots remain under the stated evidence directory;
successful roots were also kept for review. No historical roots were deleted or reused-PID cleanup
performed. Normal-user execution and inherited-handle runtime audits remain unverified.

## Budget arithmetic and evidence seal

The [budget document](../../test/support/windows-launcher/budgets.md) now describes executed
behavior. Case work cutoff is start + 26,000, reserving cleanup before the 30,000 watchdog. Outer
operation starts at launch and clips its 16,000 ceiling to that cutoff. Inner work cutoff is outer
operation end minus 4,000; readiness/receipt/work phases consume and clip to that same interval.
Abandonment's 10,000 ceiling is inside outer operation. Native entry starts before launch and stops
work at 11,000 to reserve cleanup within its 15,000 ceiling. Disposal, cancellation/completion and
native fatal send/cleanup each share their respective enclosing deadline rather than adding waits.
The driver stops admission/work by 256,000 and reserves 4,000 for cleanup/log settlement. Clipped
slow cases fail/retain; no duration was increased. The campaign makes no promise that nine cases
spending every maximum independently could fit; insufficient remaining time stops admission.

The sanitized receipt contains all case/scenario timings, actual cutoff decisions, native control
event timing, reached fault/body identities, primary/secondary outcomes, retained root paths and
source/archive identities. Original `validation-receipt.json` is unchanged against the starting
checkpoint. Rehashed the original Stage A, Stage B, feasibility and diagnosis archives: all four
match the diagnosis's original SHA-256 values. Private original evidence was never copied into
this new seal or echoed; no inherited environment values appear in new receipts.

Local seal: `.cache/stage-b-correction-round1-sealed.zip`, SHA-256
`60381f0ecac0a60c945756b37efe12c720326f5784d0a7da2176cdf934ab9d53`.
Manifest SHA-256 `ae3de6a08e3515942dafba5996976aebaf91a34404e4ae3f4768f242ac447b12`.
Reopened the archive and verified all **108** manifest-listed members by hash and length: zero
mismatches. Sources, finite check/first-failure logs, verifier, runtime roots/receipts and exact
source manifest are sealed outside runtime paths. Verification output remains separately at
`.cache/stage-b-correction-round1-seal-check.json` and
`.cache/stage-b-correction-round1-verify-final.log`. Formatting the tracked aggregated receipt
does not alter these executed/archive bytes.

Before delivery the actual remote child matched the starting checkpoint, parent M2 matched
`4f09265791c82452a5800cc6d9855938bf88a46e` and both F2 preservation refs matched
`4ea24d53afc57778addf3f47752e0fe73a7011ea`. Source and outcome are separate commits, followed
by normal push and actual remote/clean/parent/F2 verification. Remain on the child and return for
independent focused review; no self-acceptance or subsequent runtime retry is authorized here.
