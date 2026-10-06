# Bounded disabled RSS attribution experiment

## Authority and status

Trunk accepts the saved-data diagnosis at `e051a129487747e9f6680cd47eb7d73ad8e672b7` as
cause-unresolved and authorizes this diagnostic experiment only. The controlled formal RSS failure
remains unchanged. No formal third attempt, profile measurement, production repair or release
acceptance is authorized. Build/preparation and six CLI runs can take substantial execution time;
announce that before starting and provide stage/progress updates.

Read the latest RSS diagnosis in the first-target document, F preservation, performance contract,
telemetry design/verification and collaboration guidance. Fixed experimental base is product/harness
`8fffcc0d8e11bb061d70bf870f262092d559c5f2`; existing artifacts and archive refs remain immutable.

## Branch and execution boundaries

Create `experiment/otel-m2-disabled-rss` at the exact fixed base, in an isolated checkout. Never reset
an existing same-name branch; inspect and return on conflicting ownership. Shared checkout stays on
M2. Preserve variant source/patches, build/probe scripts and their identities with meaningful commits
and normal pushes on the experiment branch before executing them. Sequential variant commits are
allowed, but keep separate fixed runtime directories and explicit V0/V1/V2 OIDs/hashes.
Use a checked-in experimental note to map identities; do not place large/raw logs or runtime archives
in Git. Experiment commits are not intended for PR or merge into M2/integration/main. A later product
repair, if justified, gets a separate implementation/review packet.

The outcome is appended to this handoff in shared M2 as documentation only, after rechecking ref
movement; commit/push that separately. Do not merge experimental history to transfer the outcome.

## Variants and preparation boundary

- V0: fixed behavior plus common boundary observation hooks only.
- V1: V0 with disabled SDK provider construction replaced by API no-op behavior; keep eager SDK
  loading, nonrecording root/context semantics, wrappers and extraction logic. Verify no global
  provider can make the proposed API no-op path active; do not install an enabled global provider.
- V2: V1 plus enabled-only SDK/session/collector loading. Preserve API wrappers, catalogs and product
  behavior. Inspect both CLI and worker bundle import graphs to verify disabled execution does not
  eagerly load SDK modules. Dynamic entry loading must finish before diagnostic boundaries are read.

All variants use the same dependency/Node/tool versions, release build mode, observations, no-profile
arguments and disabled behavior checks. Record exact changes and expected limitations before runs.
Typecheck/build variants and inspect artifact graphs. Stop before workloads if safe no-op behavior,
import isolation, equal observation placement or executable cleanup cannot be established. Do not
expand into an architectural rewrite or unrelated wrapper optimization to make a variant work.

Use one freshly prepared repository from the unchanged 4,430-commit recipe on native ext4. Do not
assume deleted formal fixtures were archived. Save snapshot identity, object layout and relevant Git
configuration after preparation; avoid repacking or changing maintenance policy. Use that same
repository for all variants with separate fresh output/checkpoint paths; verify it has not changed.
No repository scans or Git configuration probes during timed CLI execution.

Establish a quiet host window with the human and preflight the operator deadline/owned-process
cleanup before long work. Preserve diagnostic runtimes outside F archives. No forced GC, heap
snapshots, runtime tuning, per-record logging, extra stressors or new monitoring framework.

## Finite runs and interpretation

Exactly six diagnostic CLI runs maximum: V0,V1,V2,V2,V1,V0, no warmups or retry. Execution and
processing deadlines are 300,000 ms each; total workload budget is 30 minutes. Setup failures before
workloads may be corrected with first logs preserved. Once workloads start, any output mismatch,
timeout, cleanup uncertainty or unexpected workload stops remaining runs; preserve partial evidence.

Observe the common boundaries proposed in the diagnosis: host after imports/before worker, worker
after module loading/before request, after disabled composition, before extraction, after extraction
before finalization, and host after worker exit. Save timestamp and process RSS plus isolate heapUsed,
heapTotal, external and arrayBuffers; process RSS must not be summed across worker/host, and arrayBuffers
must not be added to external as disjoint memory. No boundary may add per-record work. Sample external
CLI VmRSS at the existing 20 ms cadence, keeping observer code identical for all variants.

Verify all six outputs against V0 using existing normalized JSONL/checkpoint behavior checks, including
4,430 records and application result. Capture telemetry-disabled semantics; diagnostic observations
are separate from product stdout/output. Preserve command/OID/runtime/fixture hashes and raw samples.

Compare V0/V1 for provider construction and V1/V2 for import-path changes in each opposing-order block.
Apply the proposed descriptive criterion: same direction in both blocks and smaller absolute contrast
larger than maximum within-variant replicate spread, at matched pre-extraction boundaries and peak.
This is a decision aid with two replicates, not statistical significance or causal proof. Bundle/layout,
order/cache and observation effects remain confounders. Startup reduction without peak reduction
does not explain the formal failure. If contrasts overlap, stop as unresolved; do not add runs/variants.
No alternative metric overrides the formal RSS contract.

## Return

Seal a new Linux evidence archive and a distinct `D:/gitlode_test` copy with verified manifest hashes.
Retain all failures and exact variant provenance, before/after input inventories and cleanup evidence.
Append concise results here: six-run table (including unexecuted rows), boundary contrasts, output
equivalence, limitations and one proposed next action. No self-acceptance of a production fix, F,
T13B or M2. Report experiment and M2 documentation OIDs and actual remote equality; shared checkout
must remain clean on M2. Only trunk assigns any subsequent repair/review/formal remeasurement.

## Preparation stop (2026-10-06)

Returned to trunk before long preparation or workloads. Instruction checkpoint and actual remote M2
were both `3ed250b4f89b639ff23e25312d5bb81d7d68f4ea`; shared checkout was clean on
`feature/otel-redesign_M2`. No local or remote `experiment/otel-m2-disabled-rss` branch existed.
The fixed experimental base remains `8fffcc0d8e11bb061d70bf870f262092d559c5f2`.

The required human-established quiet host window and operator deadline were requested but not
confirmed before this return. Session startup does not establish host quietness. Therefore the
preparation gate did not pass. Sandbox WSL enumeration initially returned
`Wsl/EnumerateDistros/Service/E_ACCESSDENIED`; an authorized elevated read succeeded, identifying
Ubuntu WSL2 and Linux user `t-wakabayashi`. A read-only filesystem probe of the existing performance
root reported `ext2/ext3`; this does not establish a newly prepared ext4 fixture or runtime. The login
shell found `/usr/bin/git` but no Node on PATH; no toolchain substitution was attempted.

| Run | Variant | Outcome      |
| --- | ------- | ------------ |
| 1   | V0      | Not executed |
| 2   | V1      | Not executed |
| 3   | V2      | Not executed |
| 4   | V2      | Not executed |
| 5   | V1      | Not executed |
| 6   | V0      | Not executed |

Zero diagnostic CLI runs, builds, installs or fixture preparations were performed. No owned workload
process was launched. No experiment checkout, source commit, runtime or evidence archive was created;
there is no experiment OID or archive hash to report. Boundary contrasts, output equivalence,
disabled semantics, import isolation and cleanup preflight remain unverified. The controlled formal
RSS failure and cause-unresolved diagnosis are unchanged. No retries, extra variants, formal
measurements, PRs, merges or acceptance updates occurred.

Proposed next action: trunk obtains an explicit quiet host window and operator deadline, then assigns
the same bounded preparation gate before authorizing workload execution. This return contains setup
status only, with no allocation attribution. Documentation OID and actual remote equality are reported
in the session return after preservation.

## Preparation stop after variant preparation (2026-10-06)

**Returned to trunk before the first diagnostic CLI spawn: fixture immutability gate failed.**
The human established a quiet host window of 11:06–14:06 JST; 14:06 was also the operator hard stop.
This session used instruction checkpoint `3ed250b4f89b639ff23e25312d5bb81d7d68f4ea` and started
with shared M2 clean at `903b5a2075de6cee22c1167fee7b705bf71a7f1d`. Actual remote M2 remained at
that OID immediately before this documentation edit. Shared checkout stayed on
`feature/otel-redesign_M2`; all experiment source changes were isolated.

### Prepared variants and supervision

The isolated branch starts at the exact fixed base `8fffcc0d8e11bb061d70bf870f262092d559c5f2`.
Its final preserved OID is `55ab62db4c063516a7fd2de3404a84a437af937f`, confirmed equal to the actual
remote `experiment/otel-m2-disabled-rss`. Sources, build/probe/driver scripts, identity mapping and
the stop note were meaningfully committed and normally pushed; no experiment history was merged.

| Variant | Preserved source OID                       | Preparation result                                                     |
| ------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| V0      | `6a9edfc4c4624c9efdeef3fcd06402f174809d67` | Release build, typecheck, disabled probe and both import graphs passed |
| V1      | `bdd4864b76d88ea7f0881ced911118d33ad40ab4` | Release build, typecheck, disabled probe and both import graphs passed |
| V2      | `26d1f034557d279f9271593b4091eb5424f8d481` | Release build, typecheck, disabled probe and both import graphs passed |

V0's product build is `b487272`; the subsequent V0 commit changes preparation scripts only, verified
by an empty product diff. Each variant has its own saved dist directory and exact file hashes.
All use restored Node `22.23.1`, npm `10.9.8`, Git `2.53.0`, unchanged dependencies and release mode.
Format write/check and architecture checks passed for each product variant; the finite driver and
supervisor adapter also passed explicit TypeScript checking.

V1 uses an unregistered API `ProxyTracerProvider` whose private instance never receives a delegate,
plus `createNoopMeter`. Global provider registration cannot activate those objects. V0/V1 retain
eager SDK imports in both CLI and worker static graphs; V2 has no eager SDK imports in either graph
and dynamically loads the existing enabled session/test entry only when requested. Direct disabled
probes confirmed nonrecording roots/tracers, root context behavior, no enabled global providers,
idempotent finalization and no profile report. No enabled global provider was installed.
V2's API-only disabled session also omits empty provider finalization calls; that lifecycle/layout
difference would confound an import-only attribution. API no-op span IDs are invalid, whereas SDK
AlwaysOff spans have valid non-sampled IDs. Wrappers, catalogs and extraction logic were preserved.

The disposable external deadline preflight returned exit 124/SIGKILL after 2.067984 seconds with no
live owned group members. A separate disposable child/descendant exercised the fixed supervisor's
2-second execution deadline and successful cleanup barrier. Fixture preparation also completed
with `cleanupConfirmed=true` and no cleanup errors. Final scoped observations found no live members
of the observed operator/supervisor groups. These are scoped observations, not guarantees about
escaped groups, abrupt host loss or uninterruptible I/O. Intended CLI execution/processing limits
remained 300,000 ms each and total workload budget 30 minutes; none was used for a diagnostic CLI.

### Fixture gate and zero-run outcome

One freshly generated repository used the unchanged 4,430-commit recipe on native ext4 `/dev/sdf`.
The preparation and pre-CLI checks both found HEAD `bde84f1caca0e50284005bf96c126728dac4f9d4` and
4,430 commits. However, the preparation inventory contained `.git/gc.pid`; by the first CLI gate it
had disappeared, the commit-graph had changed and the object representation differed:

| Inventory point   | Loose objects | Packed objects | Packs | Size-pack (Git-reported KiB) |
| ----------------- | ------------: | -------------: | ----: | ---------------------------: |
| After preparation |         7,424 |          5,068 |     1 |                          607 |
| Before first CLI  |             0 |         12,492 |     2 |                        1,500 |

These observations are consistent with background automatic Git GC finishing after recipe
generation. The controller failed its full inventory equality assertion before invoking any run
supervisor, creating any per-run directory or spawning any diagnostic CLI. The `runs-started.json`
file marks entry into that controller gate, not an executed workload. No manual repack, maintenance
policy change, fixture regeneration, resnapshot accepted as a replacement input or run retry followed.

| Run | Variant | Outcome      | Peak/boundary contrast |
| --- | ------- | ------------ | ---------------------- |
| 1   | V0      | Not executed | Unavailable            |
| 2   | V1      | Not executed | Unavailable            |
| 3   | V2      | Not executed | Unavailable            |
| 4   | V2      | Not executed | Unavailable            |
| 5   | V1      | Not executed | Unavailable            |
| 6   | V0      | Not executed | Unavailable            |

Boundary contrasts and six-run normalized JSONL/checkpoint/application-result equivalence remain
unverified. Prepared disabled probes and graph inspection establish preparation properties only;
they do not establish production repair, RSS attribution or acceptance. The controlled formal RSS
failure and cause-unresolved diagnosis remain unchanged. No additional variant, diagnostic retry,
formal measurement, profile workload, PR, merge or F/T13B/M2 acceptance update occurred.

First setup failures were retained: the V0 probe initially assumed invalid IDs for SDK nonrecording
spans, one correction command had a quoting error, explicit driver checking initially lacked the
TypeScript 7 `--ignoreConfig` flag, and a WSL push did not complete before the successful normal
Windows Git push. Probe/configuration corrections occurred before any diagnostic workload; the
successful V0 product build was reused rather than rebuilt to correct its probe. Automatic approval
initially rejected the push destination as unverified; read-only checks established equality with
shared origin before the subsequent push was approved.

### Evidence preservation and next action

New Linux archive:
`/home/t-wakabayashi/gitlode-performance/m2-rss-experiment-20261006T1106/archive`.
Distinct Windows copy: `D:/gitlode_test/m2-rss-experiment-20261006T1106`.
All 93 archive files and both copies of the sealed manifest were rehashed and matched. Manifest
SHA-256: `f35802a0f203c6636fd89185a21e611c7276b344a9b6e8ee0a9adfbc62a98ddf`.
The archive retains failures, fixed runtime/source/dependency/Node inputs, preparation fixture,
variant hashes, before/at-gate/return inventories, local Git settings, object-layout drift and
cleanup evidence. The three runtime dependency links retain original absolute paths; RESTORE.md
explains relinking for an independent restoration, without claiming portable standalone runtimes.
F archive files were verified unchanged before and after preparation; dependency inventories also
matched. Existing artifacts/archive refs were not modified. These two copies remain on one host.

Proposed next action: trunk assigns one bounded fixture-preparation diagnosis to establish a stable
post-generation object-layout boundary without changing the accepted recipe or maintenance policy,
before deciding whether to assign another finite experiment. This return grants no new experiment
or formal retry. The M2 documentation OID, actual remote equality and final shared-checkout clean
state are reported separately after this documentation-only checkpoint is preserved.
