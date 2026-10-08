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

## Implementation outcome (2026-10-08; independent review pending)

Started clean on parent `feature/otel-redesign_M2` at the instructed base
`4f09265791c82452a5800cc6d9855938bf88a46e`; actual remote matched. The delta from
`686ef2cd02ea6a5e6aec5572f31907b26708aa6a` to that base was documentation only: four
handoff Markdown files, 124 insertions and three deletions. Created the absent child
`feature/otel-redesign_M2_fixture` without resetting another branch.

Implementation checkpoint `c300743efe3971f776f0df4a2bfa3d0ce720e255`, validation checkpoint
`7bba56c14f55b08af36e5d871e5a0e4e3f16c33f` and fixed implementation
`741f951b34195b5ba332a688cb9c1950cdbd0baa` were separately committed and normally pushed.
The latter removes an unnecessary `GIT_OPTIONAL_LOCKS` override to retain default optional Git
operations. It is the exact source tested in the final Linux checkout and final Windows full batch.
Test-only checkpoint `c9a1e15c94bb557cd8bed99a4d07d09018bbeae2` subsequently adjusts the
synthetic comparison test command caps after the explained Windows timeout below; it was normally
pushed. Final formatting normalizes that test checkpoint's CRLF/LF-only noise.
The final outcome commit is the commit introducing this section; its exact OID and final actual-remote
checks are supplied in the return message, since a commit cannot embed its own OID.

### Responsibilities and protocol/consumer mapping

- Both repository generators now apply foreground detach settings from init onward and persist them
  before the first commit. `test/support/fixture-git.ts` removes inherited Git configuration,
  repository, object, index and other Git overrides, preserving unrelated environment and the
  generators' existing deterministic identity/signing/hooks/CRLF/file-mode isolation. Automatic
  maintenance heuristics are retained; no product preparation repack/gc or stability loop was added.
- `test/support/fixture-lifecycle.ts` owns finished logical identity, full relative byte inventories,
  filesystem type/device identity, effective config/origins, link/shared-file/ownership/lock/alternate
  rejection, the verified independent prepared copy, per-attempt instance IDs, boundary persistence,
  first-failure retention and fail-closed link validation. It does not run `git status` or compare atime.
- `scripts/telemetry-performance.ts` retains fresh repositories per pilot/capture/comparison and sharing
  inside one paired workflow. It prepares/preserves before warmups, surrounds CLI and sidecar work with
  inventory boundaries, finalizes before validation/persistence, and links raw runs, sidecars and pilot
  evidence. It checks finished commit count/format before children. Any lifecycle exception stops
  subsequent children and retains the affected root. Inventory I/O is outside timed CLI wall/RSS but
  warms caches consistently before warmups and between children; no cold/historical equivalence claim.
- Repository capture/comparison and calibration workflow artifacts now use schema 4, with lifecycle
  bindings distinct from recipe hashes. `performance-harness.ts` carries raw-run links;
  `performance-workflow.ts` keeps historical target reading separate from new-protocol formal routing.
  Production pilot projection carries links through existing safe raw-run projection; calibration
  progress/success/failure attempts carry lifecycle evidence through the existing adapter. The normal
  fresh-target doubling/binary planner and all thresholds remain unchanged. Git-independent aggregation
  keeps its separate schema-2 path and does not acquire repository lifecycle requirements.
- `scripts/tooling/fixture-root-cleanup.ts` and the existing supervisor register owned roots, then
  dispose successful attempts only after confirmed owned-group cleanup and successful terminal
  evidence persistence. Failed, uncertain or unsupervised roots remain with location diagnostics.
  Ownership checks require a physical temp child, expected prefix, current owner and invocation marker;
  paths/PIDs outside that ownership are not deletion/signal targets. No new supervision framework or
  deadline budget was introduced.
- `scripts/tooling/fixture-requalification.ts` plus supervised `requalify` routing implement one
  fixed-quantity legacy validation path. Historical hashes/protocol/quantity/revision are validated
  before generation; new runtime entry hash, complete environment/harness identity, exactly two
  warmups/seven measured legacy children, unchanged median window/MAD, behavior and lifecycle evidence
  are required. Genuine zero remains zero and fails the unchanged window. Output is eligibility pending
  trunk adoption and requires the completed, cleanup-confirmed supervisor evidence. No search, resize,
  candidate execution, retry or historical manifest mutation occurs. Tests use synthetic statistics.
- Canonical performance design/catalog and the contributor harness guide document layout/cache
  attribution, the schema/protocol distinction, operational retention and bounded requalification.
  Focused lifecycle, workflow, supervisor and production-artifact tests cover the new behavior.
  `tsconfig.fixture-lifecycle.json` explicitly checks changed tooling/tests with strict typing and
  `noCheck: false`; previously unchecked local typing issues were corrected without product changes.

### Finite verification

Final Windows: Node `22.23.1`, npm `11.11.0`, Git `2.45.1.windows.1`. Final Linux: native Ubuntu/WSL2,
Node `22.23.1`, npm `10.9.8`, Git `2.53.0`. Linux exact checkout:
`/tmp/gitlode-fixture-final-h8c2MI/source`, cloned with `--no-hardlinks` from the pushed child.
Its dependency tree was separately copied from the existing F2 preparation source; generated development
outputs were copied from this workspace. It is a disposable validation copy, not a preserved or sealed
new harness. F2 sealed archives were not overlaid or modified.

Final command on each OS was `vitest run` through the local Vitest executable, with these ten exact
paths under `packages/gitlode/test/telemetry/`: `fixture-lifecycle.test.ts`,
`performance-harness.test.ts`, `performance-workflow.test.ts`, `performance-supervisor.test.ts`,
`performance-process-group.test.ts`, `calibration-workflow.test.ts`,
`production-calibration-artifacts.test.ts`, `repository-sidecar.test.ts`, `catalog-contract.test.ts`
and `release-acceptance.test.ts`. Windows used `npx vitest run <paths>`; Linux used
`node node_modules/vitest/vitest.mjs run <paths>` with native Linux PATH.

- Windows full batch at `741f951`: **176 passed / 34 Linux-only skips / one failed**, 95.66 seconds.
  The sole failure was the synthetic profile-comparison command's existing 30-second test cap, not a
  formal performance threshold or supervisor deadline. After changing that test's command caps to
  60 seconds and its outer bound to 120 seconds, targeted `npx vitest run
packages/gitlode/test/telemetry/performance-workflow.test.ts -t 'executes disabled and profile
comparison matrices'` passed: **one passed / 20 unselected skips**, 40.16 seconds. The other 176
  successful tests were not repeated after this test-only bound correction. Across the bounded checks,
  all 177 applicable Windows cases have passing evidence; this is not a claim that the last full batch
  had no failure. Earlier `7bba56c` full Windows evidence was 177 passes / 34 skips, 96.98 seconds.
- Linux at `741f951`: ten files passed, **211 tests passed / zero skips**, zero failures, 37.05 seconds. The nested
  before/after-removal retention probes deliberately fail an assertion in child Vitest invocations;
  their enclosing tests pass only after observing retained diagnostics and outside sentinel survival.
  These printed child failures are expected sensitivity evidence, not outer campaign failures.
- `npx tsc -p packages/gitlode/tsconfig.fixture-lifecycle.json` on Windows and the local TypeScript
  executable with the same project on Linux: passed. Includes the workflow, lifecycle/requalification,
  changed support closure and changed tests explicitly, independent of tooling's deferred noCheck.
- `npm run build:release`: passed, including strict release-boundary typing and emitted telemetry graph
  verification. Product sources were unchanged throughout; subsequent checks use development output.
  `npm run architecture:check`, root `npm run lint`, `npm run format:write`, `npm run format:check`
  and `git diff --check`: passed. Rev-dep retains its existing zero-error/one-warning config-lint report.

The small semantic fixture has six commits. Negative copies cover changed ref, loose-object path,
pack path, commit-graph and worktree bytes; missing link/inventory; index lock/gc.pid/alternates;
external symlink/configuration include; inherited config/repository/object/index injection; evidence
write failure; and unsafe/unconfirmed root disposal. Checks assert no dependent callback after drift,
first failure retention, inconclusive/nonzero outcomes, retained roots/locations and outside sentinel
survival. Existing supervisor tests also cover preparation deadline, retained descendants and evidence
persistence failure. The bounded Linux forced-low-threshold case prepares two small reachable packs
and performs one foreground-configured automatic-maintenance commit under the existing supervisor:
pack count becomes one on command completion, finished count is eight, identity accepts no writer
marker and owned-group cleanup is confirmed. This is bounded observation, not universal writer immunity.

Requalification synthetic cases cover valid eligibility, wrong counts/selection hashes/quantity,
missing environment, wrong lifecycle protocol/status, non-legacy state, out-of-window and unstable
samples, plus genuine zero and the existing planner/statistical regression suite. No selected-workload
requalification or empirical quantity search was executed.

### First failures and attributed corrections

- Initial Git ownership and protected metadata access required command-scoped `safe.directory` and
  owner-context Git writes/network access. Initial WSL discovery required owner-context access. No
  global Git setting was changed; only the requested child branch was written/pushed.
- First strict checking exposed existing workflow union narrowing, readonly mutation, branded path,
  unused-import/parameter and previously unchecked test-fixture typing. Narrowing/guards, path
  construction and test fixture types were corrected. A later production-artifact assertion still
  expected the old synthetic input shape after its typing correction; its expected unchanged input
  was corrected. The affected batch first returned one failure / 139 passes / two skips, then passed
  in the fixed final campaign. No measured threshold changed.
- Initial lifecycle tests rejected Windows TEMP's 8.3 path expansion as a link (ten failures / one pass
  / one skip). Case normalization alone did not fix it. Explicit diagnostics identified the expansion;
  ancestor `lstat` checks now reject actual links without rejecting Windows path aliases. A synthetic
  bimodal sample initially had MAD zero despite a spread; the unstable test now uses samples with
  nonzero MAD instead of changing statistical semantics.
- The first related workflow/sidecar batch returned eight failures / 100 passes / six skips: old
  synthetic manifests lacked the new routing field and development worker output was absent because
  dist contained release output. Test manifests were attributed to the new protocol and development
  output was built. One later Windows comparison test exceeded its outer 30-second test timeout after
  adding inventories; that outer test limit first became 60 seconds. The final default-operation
  correction then exposed the remaining synthetic command's 30-second cap on Windows (one failure /
  176 passes / 34 skips); the test-only command caps became 60 seconds and its outer bound 120 seconds.
  The targeted corrected case passed. Formal child/supervisor limits and acceptance counts/windows
  remain unchanged. The final Linux full campaign passed.
- Initial Linux setup failed before tests on shell argument expansion, then CRLF script execution
  selected the Windows dependency tree and could not load Linux native bindings. A file-backed LF
  script and native PATH corrected setup. Final validation uses a separate checkout/dependency copy.
  The first low-maintenance test created an unreachable object, so repack correctly left only one pack;
  its setup was corrected to make the added object reachable before testing the two-pack heuristic.
- Initial lint rejected four script non-null assertions introduced during strict-typing repair; an
  explicit missing-run guard replaced them. Initial architecture check after release/development
  builds saw leftover release chunks as a generated cycle. After verifying the absolute workspace
  `packages/gitlode/dist` target, only that generated directory and its gitlode build cache were removed;
  development output was rebuilt and architecture passed. No product source repair was made. Test-only
  checkpoint `c9a1e15` also exposed differing owner/sandbox Git newline settings; final formatting and
  command-scoped normalization restore LF without rewriting pushed history or changing global config.

### Review boundary and next preservation obligations

Implementation is returned for independent review, without self-acceptance. Source delta checks show
no product source/private-package runtime/dependency-lock or `.release` changes. Parent M2 remains
`4f09265791c82452a5800cc6d9855938bf88a46e`; both F2 product/harness archive refs remain
`4ea24d53afc57778addf3f47752e0fe73a7011ea`. Final actual-remote equality and clean status are checked
after the outcome commit/push and returned with its OID. The shared checkout remains on the child.

Release compatibility follow-up is explicit: the existing schema-1 release validator checks reviewed
attestation completeness, hashes, product/harness revisions and evidence chains, but does not parse
external lifecycle inventories or distinguish fixed-quantity requalification from old calibration.
Its fifty regression tests still pass and live `.release` acceptance remains blocked. Before a new
formal packet, trunk must review the adoption/evidence binding (and separately extend release
validation if required); a lifecycle routing string is not release acceptance or a substitute for
reviewing the referenced bytes. No new arbitrary release attestation field was introduced here.

Next: independent source/protocol/consumer review; human-approved integration; preserve the exact new
integrated harness source, dependency/toolchain closure and hashes independently of immutable F2,
including restoration/compatibility evidence for F2 and historical M0; retain this child history before
any later human deletion. Only a separately assigned packet may then execute the one nine-child
4,430-commit legacy eligibility check. Passing still requires explicit trunk adoption before any new
capture/comparison. Historical manifest/calibration are never rewritten as renewed minimum proof.

Inventories warm caches and cannot establish physical equivalence to historical runs or prove absence
of every external/escaped writer. Failed/uncertain/unsupervised root retention is intentional; prepared
copies are retained evidence. The temporary Linux validation copy is not a new archive or external
backup. No 4,430-commit generation, selected-workload eligibility check, formal/diagnostic measurement,
PR, merge, freeze, archive-ref update, integration/main change or acceptance-record update was performed.
