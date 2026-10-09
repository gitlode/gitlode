# M2 controlled fixture lifecycle implementation

## Active assignment: bounded correction round 1 (2026-10-09)

Trunk confirmed the three reviewed failure paths against current source. Review
`0ae8079a5a5c469dd39b7addf5e5a207acfb0798` is corrections required; the slice remains unaccepted.
This packet supersedes earlier assignments and authorizes only the corrections below on the existing
feature/otel-redesign_M2_fixture child. Record starting OID and verify intervening changes are docs only.
Parent M2 remains `4f09265791c82452a5800cc6d9855938bf88a46e`; F2 refs/runtime remain untouched.

Use stable finding IDs C1 (review P1), C2 (first P2), C3 (second P2). Do not reopen the approved
foreground/fixed-quantity policy or expand this into release-adoption implementation.

- **C1 — durable disposal barrier:** no saved completed success may precede successful required root
  disposal. Persist a non-success intent/barrier before destructive cleanup; if it cannot be saved,
  retain roots and return inconclusive/nonzero. Track disposal versus intentional retention explicitly,
  separately from process-group cleanup. Publish completed only after required disposal succeeds.
  If deletion/refusal and any later snapshot write fail, prior persisted evidence must remain
  non-success. Preserve bounded stderr, original/secondary errors and per-root outcomes, including
  multiple roots with partial disposal. Avoid increasing deadlines or retrying the worker. Retain
  existing diagnostic/final snapshot recovery guarantees without making a barrier count as a saved
  terminal success. Add combined refusal/write-failure, barrier-write-failure and final-write-failure
  regressions and a successful path; use real owned temporary roots and an outside sentinel.
- **C2 — complete evidence binding:** validate filesystem type/device against prepared identity,
  consistent embedded/layout/prepared digests, unique boundary IDs and matching operation plus ordinal
  for each pre/post pair. Bind every child/sidecar link to its actual expected operation; a different
  valid pair is not a substitute. Inspect real raw-run/pilot/sidecar projection consumers, not only
  the validator's unit fixtures. Preserve historical/aggregation read behavior without requiring live
  Git for stored evidence. Negative cases: device/type mismatch, mismatched operation pair, duplicate
  ID, inconsistent embedded digest and another child's valid pair. Retain positive real workflow,
  calibration and synthetic requalification paths. Update types/canonical contract only as needed.
- **C3 — primary failure preservation:** do not finalize an already failed lifecycle a second time.
  Cleanup and diagnostic notification failures must not replace the original exception or primary
  failure-artifact cause. Record secondary cleanup errors separately; preserve retained-root behavior.
  Exercise final-boundary failure through actual workflow failure-artifact handling, with both usable
  and unusable lifecycle failure-evidence storage. Use small fixtures and finite hooks, not the
  4,430-commit workload. Do not limit proof to calling the lifecycle API twice. Preserve original error
  identity where in-process and meaningful primary cause across serialized artifacts. If all storage
  is unavailable, report honestly via bounded best-effort operator diagnostics/nonzero status.

Expected edits are supervisor/root-cleanup, fixture lifecycle validation/types and its actual workflow
consumers/finalization, plus focused regressions and affected canonical docs. No product runtime,
dependency/threshold, live acceptance, frozen artifact or branch-strategy change is authorized.
Show fail-before/pass-after for the three concrete defects using bounded regressions; preserve first
results. Run the established ten-suite Linux batch, explicit fixture-lifecycle strict typing, build,
lint, architecture, format write/check and diff check. On Windows run affected path/validator/workflow
tests with existing bounded test limits; attribute platform skips. Do not repeat full package campaigns
or grow a mutation campaign. Newly discovered unrelated issues return to trunk with evidence.

Checkpoint implementation and outcome separately, normally push to this child, and report exact OIDs,
C1/C2/C3 mapping, finite commands/results and remaining limitations here. Verify actual remote equality,
clean status and unchanged parent/F2 refs; remain on child. Stop for independent focused re-review.
No PR, merge, new preservation refs, freeze, selected-workload generation, requalification execution,
measurement or acceptance edit. If the same obligation remains after review, return to bounded
diagnosis rather than automatically broadening correction scope.

Release-adoption follow-up from the review is retained as a separate pre-formal gate: historical
selection bytes -> new-protocol legacy result/runtime/harness/environment -> fixture/run inventories
-> completed disposal/group supervision -> explicit reviewed adoption -> comparison/acceptance chain.
Trunk must specify the concrete record and validator/external-review binding before formal work; the
blocked live record alone does not establish enforcement. These corrections do not close that gate.

## Active assignment: independent review (2026-10-09)

Implementation is delivered, not accepted. This review-only packet supersedes the implementation
assignment below. The human starts an independent session on feature/otel-redesign_M2_fixture.

- Base/unchanged parent M2: `4f09265791c82452a5800cc6d9855938bf88a46e`.
- Fixed review target: `59e9131ed505843bf4b9a2b7a74147838a13cc5a` (entire delivered slice).
- Linux full-suite implementation: `741f951b34195b5ba332a688cb9c1950cdbd0baa`.
- Subsequent test-bound correction: `c9a1e15c94bb557cd8bed99a4d07d09018bbeae2`.
- Both F2 preservation refs remain `4ea24d53afc57778addf3f47752e0fe73a7011ea`.

Trunk inspected the 20-file base-to-delivery inventory. The post-741f951 delta includes the workflow
test limits, catalog addition and handoff; do not call that delta documentation only or claim Linux
executed the final target verbatim. Inspect exact changes and determine evidence applicability.

Read approved policy, diagnosis, full implementation/outcome, canonical design/catalog/harness guide
and affected consumers. Verify ancestry, actual local/remote identities, source equality and no product
runtime/dependency/acceptance changes. Do not reopen approved foreground or fixed-quantity policy.

### Review priorities

1. Foreground configuration must cover both generators from init and survive readers; injected Git
   configuration/repository/index/object paths must not redirect owned operations. Preserve normal
   auto-maintenance heuristics and deterministic logical history. Evaluate observed foreground/group
   behavior without claiming proof against every external/escaped writer.
2. Finished logical identity and physical inventories must match the actual repository. Check unsafe
   links/alternates/hardlinks/locks, Windows aliases, config origins, preserved copy verification and
   stable boundaries around every warmup/CLI/sidecar. Check layout drift propagation invalidates the
   whole attempt and stops dependents without replacing the reference inventory or retrying.
3. Prioritize new supervisor root deletion: ownership, registration authenticity, completion/final
   evidence ordering, symlink/path races and out-of-root sentinels. Failure, deadline, unconfirmed
   cleanup or evidence-write failure must retain necessary material. Cleanup failures must not mask
   original results or leave success evidence claiming cleanup that did not occur. Evaluate concrete
   supported paths, not an unbounded adversarial filesystem/security redesign.
4. Trace schema-4/protocol links end-to-end through real writers, pilot projections, progress/failure
   artifacts, validators and formal consumers. Missing/wrong-instance/wrong-boundary/inconsistent
   inventories must not become accepted new-protocol evidence. Preserve historical reading and
   Git-independent aggregation as distinct paths. Check data persistence before root deletion.
5. Requalification must bind historical selection, new runtime/harness/environment and lifecycle
   evidence; exactly two warmups/seven legacy children, unchanged 10–30 second/MAD/behavior gates,
   completed cleanup-confirmed supervision, and pending explicit trunk adoption. No minimum-search
   claim or automatic comparison eligibility. Examine whether described release-validator follow-up
   is an acceptable later gate or a concrete current contract defect; record the exact missing binding
   and bounded remedy if necessary. A blocked live record alone is not proof a validator is correct.

### Finite validation and reporting

Run build and explicit tsconfig.fixture-lifecycle strict typing, plus the ten actual suites named in
the outcome on Linux against the fixed target. This includes Linux-only small maintenance/cleanup
cases; do not generate 4,430 commits or run requalification/calibration/measurements. On Windows,
independently verify the changed timeout case and path/ownership cases if available; reuse other
reported passing evidence with explicit attribution rather than rerunning both full campaigns.
Inspect that test-only limits changed, not catalog formal limits. Preserve original failed batch and
targeted corrected results as separate evidence. Use only bounded probes for concrete uncertainties;
restore them and do not mutate sealed archives or production implementation.

Inspect strict typing/build/lint/architecture/format evidence, rerun relevant checks for actual gaps,
and run format write/check plus diff check for review documentation. Distinguish copied Linux build
outputs/dependencies and temporary logs from a preserved new harness; no freeze is implied.

Append accepted or corrections required with fixed reviewed OID, concrete mandatory failure paths,
file locations/minimal remedies, optional findings and evidence attribution. Record release-adoption
follow-up explicitly so it cannot be lost before the next formal packet. Documentation-only commit
and normal push to the child are authorized; verify actual remote equality, clean status, parent and
F2 refs unchanged, and remain on the child. No repairs, PR, merge, new refs, freeze, acceptance edits
or selected-workload execution. Return to trunk; do not automatically start a correction round.

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

## Independent review result (2026-10-09): corrections required

Reviewed fixed delivery `59e9131ed505843bf4b9a2b7a74147838a13cc5a` against
`4f09265791c82452a5800cc6d9855938bf88a46e`, starting clean on the child at
`72c7495032bd143635b112d6b64763c2a52eff94`. This is an independent review, not implementation
acceptance. No implementation repair or correction round was started.

### Mandatory corrections

1. **P1: root disposal can leave saved success after disposal failed.** In
   `scripts/tooling/performance-supervisor.ts:378-415`, the supervisor persists `completed` before
   attempting disposal. If ownership rejection or removal failure is followed by failure of the
   inconclusive rewrite, the saved snapshot still says `completed` and `cleanupConfirmed: true`.
   The return value correctly says inconclusive/exit 2 and `terminalEvidenceSaved: false`, but an
   external consumer reading the required saved supervisor evidence sees success. `cleanupConfirmed`
   proves group cleanup only; it cannot rescue the misleading terminal status for the failed
   invocation. Independent Linux probe reproduced this with a registered same-owner root with the
   wrong prefix, followed by injected failure only for the cleanup-failure snapshot. The root and
   its outside sentinel survived; disk retained completed success. This is a supported refusal/write
   failure combination, not an escaped-writer attack. Minimal remedy: persist a non-success disposal
   intent/barrier before deletion, track root disposal/retention explicitly, and publish completed
   success only after disposal succeeds. If the final write fails, the prior saved record must remain
   non-success. Preserve original failure and retained-root diagnostics; add this combined regression.
2. **P2: saved lifecycle validation omits filesystem and operation boundary consistency.**
   `test/support/fixture-lifecycle.ts:228-283` recomputes inventory hashes and checks logical equality,
   but does not compare filesystem type/device across boundaries. It only tests `-pre`/`-post` suffixes,
   accepting an adjacent `cli-0-pre` / `sidecar-99-post` pair. An independent synthetic evidence probe
   changed the post-boundary device to 999 and used those mismatched labels; `validateFixtureLinks`
   returned no errors. Live `boundary()` does check filesystem equality, so this finding concerns
   acceptance of inconsistent stored/projected evidence, not an observed live repository migration.
   The same validator serves calibration, capture/comparison and requalification. Minimal remedy:
   validate filesystem equality with the prepared boundary, internal identity/layout digest agreement,
   unique boundary IDs belonging to the instance, and matching operation/ordinal for each pre/post
   pair; bind child/sidecar links to their expected operation so another valid child's pair cannot be
   substituted. Add bounded negative cases without requiring Git during historical aggregation reads.
3. **P2: failed finalization can be replaced by cleanup's second finalization error.**
   `scripts/telemetry-performance.ts:1179-1182` finalizes again when no final boundary exists;
   callers await cleanup in `finally` at lines 335, 595 and 691. If the original final boundary fails before appending its boundary
   (for example, an unsafe lock/link or an unreadable/missing entry), state is inconclusive and the
   second call throws `fixture attempt already inconclusive` from
   `test/support/fixture-lifecycle.ts:144`, replacing the original exception. Requalification's outer
   failure artifact can consequently record the generic replacement. `failure.json` preserves the
   first error only when its storage remains writable. Independent API sequencing probe observed the
   original filesystem ENOENT followed by that generic finalization error; the workflow connection is
   source tracing, not a claim of an independently executed requalification. Minimal remedy: skip
   finalization on an already failed lifecycle and preserve the primary exception when cleanup also
   fails; retain secondary cleanup diagnostics separately. Exercise an unsafe/unreadable final boundary through the actual workflow failure artifact,
   including unavailable failure-evidence storage. No retry or reference replacement.

### Source and contract assessment

Both generators apply foreground settings from init and persist them before the first commit.
Owned generator, inventory, timed CLI and sidecar environments remove inherited `GIT_*` overrides.
Normal maintenance heuristics remain; no product forced gc/repack was introduced. Finished history is
queried rather than using cached base refs. Prepared copies and boundary ledgers live outside the run
root; byte drift stops dependent capture without rebaselining. Linux small maintenance, retention,
unsafe-root, deadline and evidence-write cases passed. This supports the observed owned-group paths,
not immunity to every external writer, escaped group or filesystem race.

Source tracing covered raw-run projection, production pilot projection/adapter, schema-4 progress,
success/failure artifacts, formal capture/comparison, fixed-quantity validation and supervision.
`calibrationArtifactRun` preserves fixture links and production pilot evidence carries the ledger.
Historical manifest reading stays separate from `requireTarget`'s new-protocol routing; aggregation
retains its Git-independent schema-2 path. Routing strings do not validate external evidence by
themselves. The validator deficiencies above prevent acceptance of the delivered slice.

Base-to-delivery inventory is 20 files. Product `src`, private runtime packages, dependency lock and
`.release` have no changes against F2; the implementation/test closure at the starting checkpoint
matches the fixed target. Base is an ancestor of delivery. The `741f951` to delivery delta includes
synthetic test caps (30 to 60 seconds; outer 60 to 120 seconds), the filesystem catalog field and
handoff documentation. Formal catalog deadlines/counts/windows are unchanged. The earlier Linux
campaign did not execute the final delivery verbatim; the independent campaign below did.

### Evidence attribution and finite validation

**Independent executions in this review:**

- Linux native WSL Ubuntu, Node 22.23.1/npm 10.9.8/Git 2.53.0. New `--no-hardlinks` detached clone at
  `/tmp/gitlode-independent-m2-2oo_wxxr/source`, exact fixed target. Dependencies and generated `dist`
  were copied from the prior disposable `/tmp/gitlode-fixture-final-h8c2MI/source`, then
  `npm run build:dev` and explicit `node node_modules/typescript/bin/tsc -p
packages/gitlode/tsconfig.fixture-lifecycle.json` passed. These are reused setup inputs, not a new
  preserved harness or independent dependency installation; no sealed archive was overlaid.
- `node node_modules/vitest/vitest.mjs run` with the ten exact outcome paths above: **10 files,
  211 passed, zero skips, zero outer failures, 34.46 seconds**, at `59e9131`. Printed failures from
  nested retention sensitivity probes are expected; their outer tests passed. Includes Linux-only
  foreground maintenance, owned cleanup and outside sentinel checks.
- Windows Node 22.23.1/npm 11.11.0/Git 2.45.1.windows.1: `npm run build:dev` and
  `npx tsc -p packages/gitlode/tsconfig.fixture-lifecycle.json` passed. `npx vitest run` on
  `fixture-lifecycle.test.ts` and `performance-workflow.test.ts`, filtered by
  `controlled fixture lifecycle|executes disabled and profile comparison matrices`: **13 passed,
  22 skipped, zero failures, 42.76 seconds**. The skips comprise two Linux-only lifecycle cases
  and 20 unselected workflow cases. This independently exercises
  the corrected timeout and Windows small path/marker/config/copy/drift checks. Linux-only root
  disposal cannot be claimed as a Windows execution.
- Three temporary Linux probe assertions across two files passed, demonstrating the defects above,
  rather than validating their desired behavior. Probe files were removed; fixed clone status was
  clean afterward. No production implementation was mutated.
- Root `npm run lint` and `npm run architecture:check` passed independently; rev-dep retained its
  existing zero-error/one-warning config report. Format write/check and diff check apply to the review
  documentation before commit. Release build/strict release graph evidence remains implementation
  reported below, not a new independent release build.

Temporary Linux logs are retained outside the source at `/tmp/gitlode-independent-m2-2oo_wxxr`:

| Log                 | SHA-256                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `build.log`         | `353533507df69a47edd30dbec8a3fd7ba14a400b176a4dfb63b799938c42bd9b` |
| `strict.log`        | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `suites.log`        | `5cf068051aaa99a4815de4393be192086e9cef08c72fb56dc70b2cb766adc958` |
| `probes.log`        | `e5dfb3d52cceb6b34a767c415deb4fb2763b7213213b7fddd79727910eb6602f` |
| `cleanup-probe.log` | `0233c2df79dad34fdb85de013946580d1c48c788abbd0323e3bd2a0f132e0710` |

These temporary logs are saved independent execution evidence, not a freeze or external backup.
Windows and repository check outcomes are recorded from this session's tool results in this review.

**Saved historical evidence read, not rerun:** the Windows F2 mirror's
`evidence/compatibility.json` reports the historical 4,430 selection, schema-3 calibration and
compatible recipe/environment while leaving physical stationarity unresolved. The diagnostic mirror's
`evidence/fixture-preparation-drift.json` records removed gc.pid/loose objects and changed info/refs.
Those saved facts support the approved policy and do not establish causation of historical RSS failure
or new-protocol eligibility. No archive-wide rehash or selected-workload execution occurred.

**Implementation report reused with attribution:** Windows at `741f951` was **176 passed / 34 skips /
one failed**; the subsequent corrected single comparison case was **one passed / 20 unselected
skips**. Neither is rewritten as an initially successful full batch. The other 176 were not independently
rerun here. Earlier `7bba56c` Windows success, Linux `741f951` 211-pass campaign, release build and its
graph check remain implementation-reported evidence; the Linux fixed-target campaign above is separate.

### Required release-adoption follow-up and return boundary

The existing schema-1 release validator validates attestation/hash/revision and recipe/evidence-ID
chains, but does not read external lifecycle inventories, fixed-quantity selection bytes or a trunk
adoption record. `requireTarget` checks the routing string only; `validateHistoricalSelection` checks
hash syntax/quantity/revision, not the referenced historical bytes. Thus the missing binding is:
historical calibration/manifest hashes and selected target -> reviewed fixed-quantity result and its
new runtime/environment/harness -> instance/inventory/child links -> completed cleanup-confirmed
supervision -> explicit trunk adoption -> new manifest/capture/comparison evidence chain.

This is an acceptable separately gated release compatibility follow-up only because this packet
produces no adoption or release acceptance and the canonical docs explicitly require that independent
review before formal work. The blocked live record and fifty passing release regressions are not proof
that the new protocol is enforced. Before the next formal packet, trunk must define a concrete reviewed,
hash-bound adoption record covering that chain and decide whether the release validator must consume
it; if relying on external review, require its exact archived bytes and reviewer binding in existing
attestations. Extend validation with missing/wrong selection, lifecycle, supervision and adoption
negative cases if automated enforcement is required. No arbitrary attestation string may waive this.
This follow-up must survive integration and new harness preservation; renewed minimality is not claimed.

Initial actual `ls-remote` matched child `72c7495`, parent M2 `4f09265791c82452a5800cc6d9855938bf88a46e`
and both F2 refs `4ea24d53afc57778addf3f47752e0fe73a7011ea`. Command-scoped safe.directory and
owner-context WSL/network access resolved initial sandbox ownership/access failures without global
Git changes. This review changes this document only. The documentation commit OID and post-push
actual remote equality/clean status/unchanged parent and F2 checks are returned with the commit,
since it cannot embed its own OID. Remain on the child and return these corrections to trunk; no
automatic correction round, PR, merge, new preservation refs, freeze, acceptance edits, 4,430-commit
generation, eligibility execution, calibration or formal/diagnostic measurement was performed.

## Bounded correction round 1 outcome (2026-10-09): focused re-review pending

Started clean on `feature/otel-redesign_M2_fixture` at the requested
`ccdc5bf801d7d2aba724875916ab71b704813a7b`, matching actual `ls-remote`.
The intervening `59e9131` -> start and reviewed `0ae8079` -> start deltas are documentation only
(the handoff, handoff index and recovery plan). Implementation checkpoint:
`503112984d9a524cbfab286a59927f8234545f52`, normally pushed to this child. Outcome is checkpointed
separately after this append; its OID and final remote/clean checks are returned with the delivery.
This remains unaccepted and stops for independent focused re-review.

### C1/C2/C3 implementation and concrete before/after evidence

- **C1 (review P1):** `performance-supervisor.ts` saves an inconclusive pending-disposal barrier
  before touching roots. Barrier failure retains all roots. Completed publication follows successful
  required disposal. Separate disposal phase/per-root status/error distinguish group completion from
  retention and partial disposal. Terminal-write recovery remains one attempt; a barrier never counts
  as saved terminal success. If both final writes fail, the return and bounded diagnostics expose root
  outcomes and the prior saved record stays non-success. The prepared copy remains independent.
  Linux `performance-supervisor.test.ts -t C1` first failed **4 / 4** against unchanged starting
  implementation: refusal followed by failed rewrite left saved completed, barrier injection was never
  encountered, final-write failure had no barrier, and the positive case lacked disposal outcomes.
  After correction **4 passed / 35 unselected**, including final additional outcome assertions.
  Each case uses two real registered owned temporary roots and an outside sentinel present before
  supervision completes. Refusal after first-root disposal preserves the refused second root and its
  error; barrier-write failure preserves both; final/recovery-write failure leaves saved pending
  evidence; success disposes both. The outside sentinel survives all cases. Group cleanup, earlier
  failure, diagnostic-write failure and terminal recovery tests also passed in the ten-suite batch.
- **C2 (review first P2):** `fixture-lifecycle.ts` checks prepared filesystem type/device, embedded,
  boundary and prepared digests, sequential unique instance-owned IDs and matching pre/post operation
  and ordinal. `fixtureOperationFor` reconstructs actual CLI/sidecar ordinals from phase, pair index,
  order and baseline/candidate state independently of the supplied link. Actual capture/comparison,
  calibration pilot and fixed-quantity validators supply those expectations. Raw-run and pilot
  projections retain links; actual serialized capture and sidecar workflow tests validate positive
  bindings then reject substitution with another child's valid pair. Historical reads and
  Git-independent aggregation are unchanged; no live Git is needed to validate stored evidence.
  Windows `fixture-lifecycle.test.ts -t C2` first failed **6 / 6** against starting implementation
  (device, type, operation mismatch, duplicate ID, inconsistent embedded digest, valid-pair
  substitution), then **6 passed**. The synthetic requalification positive path now uses nine
  distinct pairs derived from one real observed pair; substitution also fails that validator.
  Real small workflow, production pilot/projection and calibration suites passed on Linux.
- **C3 (review second P2):** the three workflow owners pass primary-failure presence to cleanup;
  cleanup skips finalization of an inconclusive lifecycle, records secondary errors separately and
  uses locally protected bounded synchronous retained-root diagnostics. Failure-artifact storage
  failure reports the original cause best effort and rethrows the original object.
  Windows `performance-workflow.test.ts -t C3` first failed **2 / 2** against starting implementation:
  actual requalification failure artifacts replaced the final-boundary index-lock cause with
  `fixture attempt already inconclusive`, with both usable and unusable lifecycle failure storage.
  After correction those paths and three additional finite paths passed (**5 passed / 21 unselected**):
  unavailable workflow plus lifecycle storage preserves original exception identity in-process and
  emits bounded primary/missing-artifact diagnostics; throwing cleanup IPC and throwing stderr retain
  the primary serialized lock cause and save secondary cleanup errors where possible. All cases
  invoke the actual workflow with five-commit fixtures and a hook at final-boundary entry, rather
  than merely calling finalize twice. They verify a single finalization and retained unsafe root.

Expected owners changed: supervisor/root-cleanup ordering; lifecycle evidence validation and cleanup
error recording; actual workflow finalization/consumers; operation reconstruction and requalification
consumer; the three affected test files. Canonical performance design/catalog and harness guide record
ordering, binding and failure semantics. No product source, dependencies/lock, thresholds, formal
limits, release validator or live acceptance record changed.

### Finite execution, first failures and applicability

Linux is native WSL Ubuntu, Node 22.23.1/npm 10.9.8/Git 2.53.0. A new disposable `--no-hardlinks`
clone at `/tmp/gitlode-fixture-round1/source` starts at `ccdc5bf`; modified files were copied from this
workspace. Dependencies and development outputs were reused from the independent review copy
`/tmp/gitlode-independent-m2-2oo_wxxr/source`; Node is read from the existing M0 toolchain. These
are setup inputs, not a new preserved harness, freeze or independent dependency installation.
No sealed input was modified. Final TypeScript source byte comparison against the shared workspace
found no differences.

Commands and results (all from this round):

- Linux `npm run build:dev` and `node node_modules/typescript/bin/tsc -p
packages/gitlode/tsconfig.fixture-lifecycle.json`: passed; strict typing also passed after final edits.
- Linux `node node_modules/vitest/vitest.mjs run` with the ten exact paths listed in the earlier
  outcome: **10 files / 226 passed / zero skips / zero outer failures, 47.23 seconds**. This includes
  small maintenance/group/root retention and outside sentinel cases. Expected failures printed by
  nested retention sensitivity probes are not outer failures. This batch preceded the Windows-driven
  synthetic setup correction and the final C1 outcome/diagnostic assertions; it is not relabeled as
  an exact final-checkpoint campaign. Affected Linux lifecycle/supervisor suites after the setup
  correction passed **59 / zero skips**, 9.25 seconds. Final C1 rerun passed **4 / 35 unselected**,
  and final all-storage-unavailable workflow rerun passed **1 / 25 unselected**; these cover the final
  reporting/assertion changes. No full campaign was repeated.
- Windows Node 22.23.1/npm 11.11.0/Git 2.45.1.windows.1: the affected lifecycle/workflow two-suite batch
  first returned **38 passed / 7 skips / 1 failed test**, 141.05 seconds, plus lifecycle teardown EBUSY.
  The newly expanded synthetic test performed nine real capture pairs and exceeded its existing
  5-second limit; its still-running Git work caused the teardown lock. Corrected only test setup to
  derive distinct synthetic pairs from one real pair. No test/formal deadline was raised. Corrected
  single case: **1 passed / 19 unselected**, 4.25 seconds. Final lifecycle suite: **18 passed /
  2 Linux-only skips**, 39.69 seconds. The workflow suite passed in the first affected batch
  (**21 passed / 5 Linux-only skips**, including real capture/comparison and five C3 modes).
  Final all-storage-unavailable diagnostic assertions: **1 passed / 25 unselected**, 14.97 seconds.
  Linux-only supervision/disposal is not claimed as Windows execution.
- Windows `npm run build` (release bundle): passed. Explicit strict typing, root `npm run lint`,
  `npm run format:write`, `npm run format:check` and `git diff --check`: passed, including final edits.
  Initial `npm run architecture:check` found the known generated release-chunk cycle after release
  bundling. Verified absolute workspace paths, removed only generated `packages/gitlode/dist` and
  its `.cache/tsc/gitlode.tsbuildinfo`, rebuilt development output and reran: passed, with the existing
  config report of zero errors/one warning. No runtime source fix was made for that setup issue.
- An initial Windows combined name filter containing `|` was interpreted by the executable shim as
  a shell pipeline and ran no tests. Separate C2/C3 commands produced the preserved results above.
  Command-scoped safe.directory/autocrlf settings and owner-context WSL/Git execution resolved sandbox
  ownership/access/newline differences without global Git changes.

Temporary logs preserve first results separately from corrected results; they are local execution
evidence, not sealed archives or an external backup. Linux log directory: `/tmp/gitlode-fixture-round1`.
Windows log directory: `C:\Users\T-WAKA~1\AppData\Local\Temp`.

| Log                                                        | SHA-256                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Linux `before-c1.log`                                      | `f3ffc46b31289ac36051d04c327ef8b641ae4b6d910e41a0377c270ce394cc0d` |
| Linux `suites.log`                                         | `d76905d594ea9b51b7c8480e77bb9620486eec48d08623fb93bbf6f694e2c5d8` |
| Linux `corrected-targeted.log`                             | `9413df89f74439a6afd552bdd0b2af13271d001a37b5b1b18d93b11d2d7633d0` |
| Linux `final-c1-outcomes.log`                              | `c24fb7e68b7fee1c08ef4b3d5097e94096b10916ad900738e7136fcb643e7e0a` |
| Linux `final-all-unavailable.log`                          | `bf1ed66f0495a7e467189ff19086dc901516be35be7ac8a3d9877ac77c9d0a01` |
| Windows `gitlode-round1-before-c2.log`                     | `aa52cd1513e9ffa03565caf3c0c75adb7c1bc220bf462cb132eaf0d728d24ddf` |
| Windows `gitlode-round1-before-c3.log`                     | `423d9c5b73b9041efe39bfe6e7ace94d98cf0058c0059ad34bf8a3bb29e7b878` |
| Windows `gitlode-round1-windows-affected.log`              | `a2b746782bbe9e603696e87e45a5db154d73e3c2bc682971e7ad69c08f09b6d8` |
| Windows `gitlode-round1-windows-lifecycle-final.log`       | `5b989f9c287a37feded61a2bdc219c3a76355bba7cea35523498abcdbd2d16b6` |
| Windows `gitlode-round1-windows-all-unavailable-final.log` | `c648b4e9f4148cac875a23d5bc713c8be85f5ab2c21571dbd9e1250f6e0bc2f8` |

### Return boundary and remaining gate

Implementation push actual remote equals `503112984d9a524cbfab286a59927f8234545f52`, with clean shared
status on the child before the outcome append. Actual remote and local parent M2 remain
`4f09265791c82452a5800cc6d9855938bf88a46e`; both F2 preservation refs remain
`4ea24d53afc57778addf3f47752e0fe73a7011ea`. Final outcome push equality/clean/ref checks follow the
separate documentation checkpoint. Remain on the child and stop for independent focused re-review.

Release-adoption remains the separate pre-formal gate specified at the top of this packet and in the
independent review. No adoption record/validator binding was implemented or declared satisfied.
Trunk must define the hash-bound historical selection -> new runtime/environment/harness -> lifecycle
and child inventories -> completed disposal/group supervision -> reviewed adoption -> comparison and
acceptance chain before formal work. These corrections do not qualify a selected workload.

Successful disposal followed by terminal-write failure cannot restore removed roots: non-success
barrier evidence, prepared copies and available diagnostics remain, with no saved-success claim.
External/escaped writers, host loss and unavailable storage/notification retain the existing limits;
no retry or universal delivery guarantee is added. No 4,430-commit generation, live eligibility check,
calibration/measurement, PR, merge, new preservation ref, freeze or acceptance update was performed.
The small synthetic failure-workflow tests above are regression evidence only. This slice is returned
for independent focused re-review, without self-acceptance or automatic expansion into another round.
