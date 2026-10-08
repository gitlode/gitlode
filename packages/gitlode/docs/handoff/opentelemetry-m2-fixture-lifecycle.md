# M2 controlled fixture lifecycle implementation

## Approved decision and current assignment (2026-10-08)

The human adopted trunk's recommendation after the diagnosis at
`686ef2cd02ea6a5e6aec5572f31907b26708aa6a` in
[F2 preparation](opentelemetry-m2-repaired-candidate-freeze.md): foreground automatic maintenance
during generation, attributable pre/post fixture identity/layout checks, and bounded requalification
of the historically selected 4,430 commits instead of repeating minimum-quantity search.

This is explicit approval of the preparation/provenance policy, not performance acceptance. The
requalification establishes eligibility under the new protocol, not that this quantity remains the
smallest acceptable quantity. Historical calibration remains attributed to its original protocol.
No thresholds, sample counts or behavior/sidecar requirements are relaxed.

The present assignment is harness implementation and small regression tests only. A separate
independent review, integration and new harness preservation precede any legacy requalification.
Do not run the 4,430-commit fixture or any formal/diagnostic measurement in this session.

## Branch, checkpoints and frozen inputs

Create `feature/otel-redesign_M2_fixture` from the M2 documentation checkpoint delivering this packet
(predecessor `686ef2c`). Record the exact base and verify documentation-only delta. If the branch
already exists, inspect rather than reset it. Work and normally push meaningful checkpoints on this
child, remain there on return, and leave parent M2/integration/main and all archive refs unchanged.
Intended integration is a human-approved squash into M2 before a new harness freeze; no PR or merge
is authorized here. Preserve the source history before later human deletion.

F2 product/runtime `4ea24d53afc57778addf3f47752e0fe73a7011ea` and its sealed inputs remain immutable.
Keep product runtime bytes fixed. The harness will receive a new identity and compatibility review;
never silently overlay new code onto F2's preserved harness archive.

## Implementation scope

Read repository instructions, the complete bounded diagnosis in F2, canonical performance design,
catalog and harness guide, and the actual generator/workflow/supervision and artifact consumers.

1. Apply `maintenance.autoDetach=false` and `gc.autoDetach=false` to every owned generator Git command
   from init onward in both deterministic/performance helpers; persist settings before the first
   commit. Retain normal pinned Git automatic maintenance heuristics. No final forced repack/gc,
   loose-only recipe, global Git configuration or wait-until-stable loop. Isolate inherited Git
   config/repository/object/index overrides for owned commands, record effective configuration and
   reject alternates/shared object stores or unowned links. Preserve non-performance fixture users'
   logical behavior and existing command isolation.
2. Keep fresh physical repositories per calibration pilot/capture/comparison and sharing within each
   paired workflow. Query finished repository identity, not the base helper's cached refs. Record
   logical refs/tag objects/HEAD/tree/format/count and physical path/type/size/hash inventory. Reject
   locks/gc.pid and unsafe ownership; do not infer writer absence from missing PID files alone.
3. Preserve a verified prepared fixture outside the disposable run root before warmups. Add an
   attempt-local fixture instance ID, layout digest and explicit lifecycle protocol identity separate
   from the content recipe hash. Capture pre/post boundaries for timed children and sidecars and
   final pre-destruction identity; link raw runs and artifacts to them. Deduplicate unchanged inventory
   storage by digest if useful without dropping boundaries. Inventory reads occur outside timing but
   warm caches: specify their consistent placement, including around existing warmups, in the protocol.
   Never claim cold-cache conditions or physical equivalence to old runs.
4. Any unexpected content/layout drift invalidates the whole attempt as inconclusive/nonzero. Stop
   dependent children, preserve first failure and evidence, and never regenerate/rebaseline/retry.
   Compare bytes/path sets rather than access times; avoid git status refresh or explicitly isolate
   index stat-cache effects. Delete only owned roots after confirmed child cleanup and successful
   evidence persistence; retain uncertain roots with location diagnostics. Reuse existing deadlines
   and supervision stages without renewing budgets or introducing a new framework.
5. Version the artifact/protocol binding and update actual writers, readers, validators and formal
   consumers coherently. Old artifacts stay readable as historical evidence where needed, but cannot
   masquerade as qualified new-protocol comparisons. Missing/mismatched fixture links must fail closed.
   Keep aggregation's Git-independent path separate. Do not use arbitrary new attestation strings to
   bypass release acceptance. Inspect release-gate compatibility and record any required follow-up
   before a new formal packet; live acceptance remains blocked.
6. Add the approved requalification contract to canonical docs/catalog and implement its bounded
   validation path using existing pilot/statistics/behavior machinery. Require explicit historical
   selection provenance plus new lifecycle/environment/runtime identity, exactly two warmups and seven
   legacy measured children, 10–30 second median, wall MAD <=5%, behavior/supervision and all lifecycle
   checks. No search, candidate run, automatic retry/resize, historical manifest rewrite or claim of
   renewed minimality. Keep normal fresh-target minimum-search calibration unchanged. A failed check
   returns for trunk disposition; passing still needs explicit trunk adoption before comparisons.
   This session tests the path only on small/synthetic inputs, not the selected workload.

Expected owners are both generators, telemetry-performance workflow entry, performance-harness and
performance-workflow support/types, focused tests, and canonical performance design/catalog/harness
guide. Introduce a focused support module if needed; avoid adding a new domain or broad scripts
reorganization. Product SDK/adapter/projection logic, dependencies and performance thresholds are
outside scope. If the above cannot fit existing artifact/acceptance contracts without a substantive
new policy, stop with the concrete conflict instead of silently weakening them.

## Finite verification and return

Use one small semantic fixture, small workflow/pilot tests and a bounded Linux forced-low-maintenance-
threshold case to verify command completion/owned cleanup with foreground configuration. Do not try
to prove immunity to all external writers or escaped groups. Preserve those guarantee limits.

Negative cases cover changed ref/object/pack/commit-graph, missing inventory/link, unsafe lock/alternate/
external link/config injection, preparation deadline, evidence persistence failure and uncertain
cleanup. Check no dependent run, honest inconclusive result, retained diagnostics and outside-root
sentinel survival. Requalification tests must reject wrong counts/provenance/protocol/status and
out-of-window/unstable results, preserving genuine zero and existing statistical semantics. Use
bounded positive/negative tests, not repeated empirical workloads or an exhaustive mutation campaign.

Run affected harness/workflow/catalog/artifact consumer tests, explicit strict typing for changed
tooling/tests, build, lint, architecture, format write/check and diff check. Record exact counts/skips
and first failures. Run Linux-only new lifecycle cases on Linux. No full dual-OS installed-package
campaign is assigned to this harness-only slice unless a concrete change makes it necessary; return
such a concern to trunk before expanding. Keep setup corrections attributed, stop unexplained failures.

Checkpoint implementation separately from outcome. Append here starting/fixed/final OIDs, changed-file
responsibilities, protocol/consumer mapping, positive/negative evidence, commands/results, limitations
and exact next harness-preservation obligations. Normally push to the child; confirm actual remote
equality, clean status and unchanged parent. Stop for independent review without self-acceptance,
PR/merge, frozen-ref changes, requalification execution or formal measurement.
