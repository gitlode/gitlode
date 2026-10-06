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
