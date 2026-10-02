# OpenTelemetry M2 continuation plan

## Authority and current status

The human accepted staged convergence, Linux/WSL2 reference measurement, private `tests/system`
organization, and explicit human PR/merge authority. M0 and M1 are complete. This conversation remains
the trunk planning owner; the human starts branch sessions and returns their outcomes.
Work now continues on `feature/otel-redesign_M2`, created from `integration/v0.13.0`.
Unrelated v0.13.0 development is outside this session's implementation scope.

[PR #111](https://github.com/gitlode/gitlode/pull/111) was human squash-merged at
`7e0055a3f66e38d2f2a8f3554d30c41c2fefb1c0`, parent
`1664798a9f586b1ac4e632d02d3a37cb0c6ebf0d`. Trunk confirmed the local integration branch,
actual remote and initial M2 branch match. Its tree
`d12d76daca57baa9e4d7fd21192e50ef1d96932d` exactly matches the accepted rehearsal, including
the base's domain-design link. [Post-merge CI](https://github.com/gitlode/gitlode/actions/runs/34816748419)
succeeded. Compared with validated `6fd46d3`, only handoff documents differ; existing functional/package
evidence is reused on that explicit content basis, not relabeled under the squash OID.

| Milestone | Status                                 | Remaining scope                                                            |
| --------- | -------------------------------------- | -------------------------------------------------------------------------- |
| M0        | complete, one target only              | Preserve historical evidence and environment                               |
| M1        | complete                               | Preserve corrected validation and squash attribution                       |
| M2        | Profile integrated; system design next | Full T13B, readability, system-test organization, final candidate and T13C |
| M3        | future, not v0.13.0 gates              | Separately justified capabilities and general refactoring                  |

The live publish acceptance record remains `blocked`. Integration is not formal performance or
release acceptance. The [redesign plan](instrumentation-opentelemetry-redesign-plan.md) retains the
T13B/T13C exit criteria. Canonical design, verification, performance and publish contracts own policy.

## Evidence and branch retention

- [M0 result](opentelemetry-m0-result.md) retains the Linux toolchain, baseline release, calibrated
  target and immutable archive paths. Its one-target measurements are not new-candidate evidence.
- [M1 evidence](opentelemetry-m1-validation-result.md) retains accepted R1/R2, corrected Windows/Linux
  verification, package/runtime identities and the old-versus-new revision boundary.
- The human completed old work-branch deletion and preserved final PR source `acad3ed` as
  `archive/otel-redesign`. The local archive and remote-tracking ref both resolve to
  `acad3ed56e134b1a066332cd3d42eb9c01d931b7`; the separate pre-reset archive remains at
  `b4468342c982d09be09e9c46290bb1ed2d842a36`. Preserve both archive refs.
- The corrected validation archive's `inputs/candidate.bundle` retains T13 `ec0b086`, T13B
  `08661ce` and redesign history through `e2ec15e`, including accepted `6fd46d3`. The archives
  preserve evidence history without restoring completed implementation branches.
- Preserve immutable evidence under `D:\gitlode_test`; do not overwrite archives or use them as
  mutable build directories. Old packets remain in recorded commits and bundles, not active instructions.

## Accepted profile and integration boundary

P1/P2/P3, styling, corrections and cumulative functional/package validation are complete.
[Integration evidence](opentelemetry-m2-profile-integration.md) owns accepted OIDs, styling squash
correspondence, saved command/package evidence, human display limits and the proposed PR summary.
[Remaining observations](opentelemetry-m2-profile-observations.md) owns unresolved instability and
future Span aggregation/retention questions. Completed implementation/review/trial packets are
retained in Git rather than as live work instructions.

PR #113 was human squash-merged into M2 at
`c29376b0b771efac9d736cb5315ae3d1d303984f`, parent
`12b43f911ff9d9e1c9ecab09faa0148b3db2dbe6`. Trunk verified actual remote/local M2 equality and tree
`4b9cfc312944b257799465e6ea77e2103d7fe658`, exactly matching reviewed source
`a2de670213c1791127a63b1ff8c541e512ea743b`. Source history is preserved locally and remotely at
`archive/otel-m2-profile-a2de670`. The human may delete local/remote profile work branches; keep the
archive and existing styling archive. Trunk did not delete branches. Saved candidate validation at
`f4d90d1` is reused on the reviewed handoff-only delta, not claimed as execution on the squash OID.

Current assignment: the bounded private tests/system design packet at the end of this plan.
No implementation or further PR is authorized yet. ENOTEMPTY and Windows timeout/EBUSY remain open
observations, not a new reproduction campaign. Existing Attributes fixture typing is separate.
After system design/migration/review: history/evidence freeze, full T13B, GNOME pre-release check,
final combined-candidate validation and T13C. Publish remains blocked. Additional display samples
are future tooling, not an integration/release prerequisite.

## History and parallel development boundary

The current legacy baseline `76b124e23fcc069be1278629cf01b62ae1456c7a` is an ancestor of `7e0055a`.
Old pre-squash migration candidates are not automatically ancestors of the M2 branch. The existing
publish gate requires legacy <= frozen product <= evidence source <= final candidate <= publish HEAD
for redesigned evidence, with explicit reviewed reuse bindings. Harness revisions need existence,
not product ancestry. The publish tree may differ from the final candidate only at the acceptance record.

### Working history and accepted measurement history

The human clarified that `integration/v0.13.0` enters `main` through a normal, non-squash merge
under the project's GitHub rules. Commits admitted to integration will therefore remain in main.
M2 and its child branches may use any appropriate strategy, subject to human PR/merge approval.

### Branch, checkpoint and remote preservation rules

| Ref / boundary                            | Purpose and preservation                                                     | Merge method                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `feature/otel-redesign_M2`                | Trunk planning plus accepted cumulative changes; push meaningful checkpoints | Into integration: normal merge after history review and candidate freeze |
| `feature/otel-redesign_M2_profile`        | P1-P3 and review corrections; commit/push even explicitly unfinished stages  | Into M2: human squash after cumulative acceptance                        |
| `feature/otel-redesign_M2_styling`        | Interactive visual trials; preserve source OIDs and human decisions          | Into profile: human squash after focused review, CI and visual approval  |
| `feature/otel-redesign_M2_system`         | First system workspace slice and corrections; commit/push independently      | Into M2: human squash after its acceptance                               |
| `archive/otel-m2-profile-design-20260918` | Immutable accepted design at `d87bfd6fb8d4e874bb78424111f21f78fd6c9a6d`      | Never merge as a work branch                                             |
| `archive/otel-m2-product-<oid12>`         | F records exact product OID and immutable runtime/package identities         | Never move; product OID must remain an ancestor of final/publish source  |
| `archive/otel-m2-harness-<oid12>`         | Exact harness OID; may equal product OID                                     | Never move; keep its Git object available to verification                |
| `integration/v0.13.0` -> `main`           | Approved release history                                                     | Normal non-squash merge, as the human specified                          |

Commit at meaningful boundaries and before handing off a session, including unfinished states with
clear residual work and failing/unrun checks. Push those checkpoints to the same named work branch
without force, then verify actual remote OID equality. The human explicitly requested remote
preservation; ordinary work-branch checkpoint pushes are authorized within assigned scope, not just
local commits. Avoid per-edit commits/pushes. If network/permission prevents backup, preserve locally,
report the unbacked OIDs and blocker, and do not describe the checkpoint as remotely protected.
Do not push secrets, raw operator logs or large runtime archives into Git as a substitute for artifact
preservation. Record archive paths/hashes in the outcome; external artifact backup remains distinct.

PR creation always needs explicit human approval naming source/base. Only the human approves/merges
and deletes branches. Work-branch pushes do not authorize integration/main updates. No force push,
shared-history rewrite or branch deletion is implicit in this plan. Preserve source checkpoints and
review attribution until the human confirms safe deletion after squash.

Before F, inspect commits that will become reachable from integration/main. Finished implementation,
reviewed repairs and concise planning/documentation commits may remain; avoid retaining every trial
and correction checkpoint where squash gives a clearer history. This is a SHOULD, not a reason to
lose evidence or redo valid work. Child squashes provide the normal cleanup boundary. If M2 itself
still needs rewriting, propose the exact operation after remote archival and obtain specific approval;
finish it before freezing any redesigned-product evidence. No rewrite is performed by this plan.

At F, create and push the product/harness archive refs before measurement and verify both remote OIDs.
Also preserve immutable runtime, dependencies, fixture identities and manifests. A Git archive ref
alone is neither the tested binary nor performance acceptance. Retain these refs and external archives
through final acceptance; branch deletion must not leave a referenced revision dependent on reflogs.
Measurement sessions use detached fixed inputs. Repairs create descendants, not replacement commits.

After F, default to normal M2-to-integration merge, then normal integration-to-main merge, keeping
measured ancestors. If a final M2 squash is preferred, settle it before F: integrate the coherent
implementation with publishing blocked, then freeze on that resulting history. Equal source trees
do not replace the gate's ancestry requirement. Version/lockfile changes and T13C cleanup must precede
final candidate acceptance; thereafter only the acceptance-record path may differ at publish time.

A failed measurement does not force acceptance of a defective candidate. Preserve the attempt,
implement/review a bounded repair, and create a new descendant candidate. Repeat only affected checks
when the contract and reviewed delta justify reuse; neither favorable automatic retries nor silent
reuse is permitted. Complete repair commits may remain in final history when their reason and
behavior are clear. Harness-only revisions remain separately attributable.

This session does not implement unrelated features. At planned integration/release boundaries, it must
still inspect their actual combined delta and validate the resulting candidate. A passing isolated M2
branch does not by itself establish release readiness for a later combined tree.

## Accepted scope and exclusions

R1 no-op composition and R2 finite asynchronous metric collection are complete and independently
accepted. R2's 1,000 ms SDK timeout does not cancel callbacks or preempt synchronous event-loop blocking.
These corrections are not open M2 implementation tasks. Domain ownership, OTel API contracts and
observation semantics remain unchanged unless a separate concrete issue warrants a design decision.

Do not discard the migration, restore legacy instrumentation, weaken thresholds, remove observations,
or retry automatically for a favorable measurement. The accepted calibration recipe remains in force;
replacing minimum-integer selection with greater timing headroom is not an approved change.

### C1-C6: Required portions and optional follow-up

These proposals are not blanket M2 acceptance conditions. Preserve operation-owner call sites;
take optional refactoring only through a separately justified, bounded decision.

| ID  | Observation and accepted disposition                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | YAML catalogs, runtime metadata and profile-view metadata require coordinated edits. M3 candidate: generate only needed runtime metadata from canonical YAML at development/build time, with no production YAML parser. Reduce independently maintained definitions, not just visible line counts; do not change catalog policy at M1/M2 by implication.                                                          |
| C2  | Instrument descriptions, units and histogram buckets repeat across factories. M3 candidate: small shared construction helpers, preserving semantic recorder methods. A local improvement required by existing M2 work is possible; an across-the-board rewrite is not scheduled.                                                                                                                                  |
| C3  | Span start/context/catch/end logic repeats, partly because GitAdapterError has different policy. M3 candidate: separate lifecycle mechanism from error policy while preserving context, error classification and exactly-once ending. Not a prerequisite for M1.                                                                                                                                                  |
| C4  | SDK histogram/attribute validation and report validation overlap but guard different boundaries. M2 related work may clarify ownership and document responsibility; broad consolidation is an M3 candidate. Do not remove defensive validation merely because checks resemble one another.                                                                                                                        |
| C5  | Direct no-op tests missed production selection; injected lifecycle failures missed a real async callback stall. Actual-path regression tests for R1/R2 are mandatory at M1. Wholesale removal/replacement of production test hooks is an M3 candidate, not a new release condition.                                                                                                                               |
| C6  | Migration acceptance/provenance tooling differs from lasting performance regression tooling. Incorporate ownership and retirement criteria into existing M2 system-test organization and T13C work. Preserve evidence and required checks; do not remove the gate before M2 acceptance. Record the separately reviewed gate-retirement timing after the initial release, as required by current publish guidance. |

### M2: Close the v0.13.0 release obligations

| Obligation                      | Required evidence                                                                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original performance acceptance | All repository calibration targets, legacy captures, both comparison matrices, aggregation scale, and other cataloged volume/memory/behavior checks; any exception has the required evidence and explicit acceptance |
| Profile readability             | Accepted generic display and schema v2 quality reporting implemented; real commit/file/plugin, partial/unavailable and styled/plain output reviewed by the human                                                     |
| System-test organization        | A private `tests/system` workspace with the first release-CLI workflow migration, explicit commands, dependency boundaries, and checked TypeScript for its owned tooling                                             |
| Contributor navigation          | Clear product-versus-telemetry reading routes, instrumentation placement guidance, and separate guidance for recorder changes and collection infrastructure                                                          |
| Final candidate                 | Functional/package checks and applicable formal performance acceptance on the actual release candidate; changes since the frozen migration candidate are assessed explicitly                                         |
| Closure                         | T13B accepted, T13C completed, release blockers closed, stable facts moved to durable docs, and temporary handoffs removed                                                                                           |

Stage system-test migration after the measurement path works. Pure planner/statistics tests remain
unit tests of the harness; collector tests that need internal implementation access stay with their
owning package. Do not make every existing test type error or every test-directory move a release
prerequisite. Keep the existing required checks running while their owners/commands are migrated.
Include C6's migration-only versus lasting-check ownership and gate-retirement criteria in these
existing M2/T13C tasks. C4 responsibility clarification belongs only where related work touches it;
C1-C5 general simplifications are not additional M2 release gates.

Freeze the migration candidate for attribution, and separately verify the final release candidate
for shipment. Later feature costs must not be silently attributed to telemetry or accepted by
reusing older passing results. Diagnose changed behavior against the frozen candidate; apply the
existing explicit exception process where necessary. Do not silently recalibrate a frozen fixture.

### Early follow-up outside v0.13.0

The accepted profile design identifies Span aggregation/information retention as a concrete early
priority, not merely optional cosmetic cleanup. Preserve its rationale and investigation questions
in the [remaining observations](opentelemetry-m2-profile-observations.md#future-work-outside-v0130-gates). No target release is assigned and
it is not a v0.13.0 gate. Expanding currently undetected loss and domain-specific attribute pivots
remain deferred. Do not silently fold these into P1-P3.

### M3: Future work

External export, collector/backend integration, analysis platforms, broader reusable instrumentation
abstractions, and migration of unrelated system tests belong in separately scoped future work.
Local SDK integration already exists; future work is not described as the first SDK adoption.
These ideas must not automatically become v0.13.0 blockers.
The C1-C5 follow-up candidates above also belong here except for the explicitly required R1/R2
tests and limited M2 responsibility clarification. None is an automatic implementation commitment.

## Session boundaries

Trunk owns overall scope, acceptance, dependency ordering and the next bounded packet.
The human launches implementation, review and measurement conversations. Each packet fixes its source,
scope, exclusions, finite checks and exit evidence. Implementation and formal measurement are separate;
operators return evidence or a diagnosis request rather than repairing code during a measurement run.
Use the [collaboration rules](../agents/collaborative-work.md#bounded-implementation-and-measurement-sessions).

Before every PR, present the exact source/base and obtain human permission. Only the human approves,
chooses squash/merge strategy and performs the merge or branch deletion. Current work is bounded tests/system design; later sessions need fixed inputs and
trunk handoff. No PR is authorized until the human approves its explicit source/base.

## Current assignment: first tests/system workspace design

The human starts a new branch conversation for bounded repository design, not implementation.
Read AGENTS, architecture/domain-design, build-test-release, telemetry verification/performance and
harness guidance. Inspect current root/workspace manifests, lockfile, TypeScript/Vitest/Rev-dep,
format/lint/CI configuration and installed-package test dependencies. Do not browse/rewrite unrelated
plugins or migrate every system-like test.

Base implementation is accepted M2 squash `c29376b0b771efac9d736cb5315ae3d1d303984f`; this planning
packet advances M2 by documentation only. Verify current planning tip/actual remote and record the
exact OID. Create `feature/otel-redesign_M2_system` from that verified tip, or inspect/resume an existing
matching child without resetting it. Commit/normal push meaningful design checkpoints. Do not update
M2/integration/main refs. Proposed return is human squash into M2 after implementation/review; PR
creation needs explicit source/base approval and only the human merges/deletes branches.

Accepted direction: private workspace at tests/system. First slice is the existing release/installed
CLI package workflow, currently scripts/test-installed-package.ts. Derive its exact support closure
from code. Define what remains package-owned (collector/internal-access tests, pure harness planner
and statistics units, schema/build tooling) and what the system workspace owns. Distinguish lasting
regression tools from migration-only acceptance/provenance tooling; propose placement and later
retirement criteria, without moving all performance tooling or retiring the publish gate now.

Return a concrete minimal proposal with:

- File ownership/move table and dependency inventory; tests consume the installed package/public
  contract rather than importing product internals for convenience. Identify genuine exceptions.
- Private manifest/workspace wiring, checked TypeScript for owned tooling, build/order/config
  boundaries, fixture/temp/process ownership and Windows/Linux path behavior.
- Commands before/after, compatibility wrappers if justified, CI/validate:release wiring and package
  exclusion. Preserve all existing checks; normal CI must not start formal performance measurements.
- Exact canonical contributor/navigation updates for product vs telemetry and recorder vs collection
  work. Address C6 ownership/retirement criteria without expanding optional C1-C5 refactors.
- Small implementation slices and finite acceptance checks including both adapters, plugin, schema,
  worker/CLI and TypeScript installed consumers. State lockfile/package/evidence impacts before F.
- Questions requiring human/trunk decision versus routine implementation choices. Do not reopen the
  accepted tests/system location or style/profile contracts without a concrete conflict.

Append the proposal to this plan under a clearly labeled system-design section, or compact it there
if existing material becomes stale. No source/test moves, manifest/lockfile edits, production changes,
install/release/full test campaigns, formal measurements or gate changes in this design session.
Read-only inspection is authorized; no new VM or machine-wide setup. Run format:write/check and link/
diff checks for the documentation, commit/normal push on the child, verify remote equality/clean state,
and return exact OIDs and the proposed implementation packet to trunk. Design completion does not
self-authorize implementation. Trunk reviews scope/dependencies before assigning the first slice.

## System design proposal: first private workspace slice (2026-10-02)

### Status and inspected input

Design only, pending trunk review; this section does not authorize implementation. Local M2 HEAD
and actual `origin` M2 (`git ls-remote`) both resolved to
`45944a382f2ce53eb898c73058bfc5dc1028d3bc`. The absent child was created from that exact tip as
`feature/otel-redesign_M2_system`. Accepted product base remains `c29376b`; no M2 ref is updated.

Inspection covered root/workspace manifests and lockfile v3, root/base/tooling/acceptance TypeScript
projects, Vitest projects, Rev-dep, Syncpack, Changesets, formatter/linter, CI/release workflows and
canonical architecture, domain, build, verification and performance guidance. The packet's
`scripts/test-installed-package.ts` means `packages/gitlode/scripts/test-installed-package.ts`.
That runner imports only Node built-ins: child_process, fs/promises, os and path. Its complete local
support closure is inline; it imports no existing fixture/helper module or product code.

### Ownership and dependency inventory

| Existing file or resource                                                                                                                                   | Proposed ownership/action in first slice                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/gitlode/scripts/test-installed-package.ts`                                                                                                        | Move to `tests/system/scripts/test-installed-package.ts`; retain its inline command runner, assertions and JSONL reader. Delete old source after command compatibility is wired. No helper framework extraction. |
| Inline two-commit Git recipe, plugin JS, consumer TS, configs                                                                                               | Remain generated by the moved runner, in its outside-repository temporary directory. No checked-in binary Git fixture or new support dependency.                                                                 |
| `tests/system/package.json`, `tests/system/tsconfig.json`                                                                                                   | New private workspace manifest and checked non-emitting tooling project.                                                                                                                                         |
| Root manifest/lockfile, Rev-dep, CI, gitlode command aliases                                                                                                | Future wiring changes only; not changed in this design commit.                                                                                                                                                   |
| `packages/gitlode/scripts/{generate-config-schema,check-generated-config-schema}.ts`, build invalidation and tsdown config                                  | Stay product-owned build/schema tooling.                                                                                                                                                                         |
| `packages/gitlode/test/telemetry/local-collection.test.ts`, `worker-telemetry-session.test.ts`, report/catalog/owner tests and worker fault-injection tests | Stay with implementation owner; internal seams do not become system APIs. Foundation/contracts/adapter tests also stay with their owners.                                                                        |
| `packages/gitlode/test/telemetry/{performance-harness,calibration-workflow,calibration-pilot-projection}.test.ts`, statistics/planner and support modules   | Stay harness units in current package; do not migrate merely because they support system measurements.                                                                                                           |
| All `performance:*` scripts, tooling modules, aggregation child/bundle, repository sidecar, fixture manifest and associated tests                           | Stay at existing paths in this slice; classification below governs later placement, not an immediate mass move.                                                                                                  |
| `check-telemetry-release-acceptance.ts`, checked acceptance tsconfig, `.release/telemetry-migration-acceptance.json`, ancestry/provenance helpers/tests     | Stay migration-gate owned and enforced at existing paths.                                                                                                                                                        |

Proposed manifest: `name: @gitlode/system-tests`, `version: 0.0.0`, `private: true`, `type: module`,
`engines.node: >=22.0.0`, no `main`, `exports`, `bin` or production dependencies. Declare its own
`devDependencies`: `@types/node: ^22.13.14`, `typescript: ^7.0.2`, `tsx: ^4.23.8`,
`oxfmt: ^0.62.0`, `oxlint: ^1.77.0`, aligned with current owners. No Vitest, OTel SDK/API, adapter,
internal workspace or linked `gitlode` dependency. Keep product tooling dependencies still used by
schema/performance/acceptance commands. Git, Node and npm are explicit host prerequisites.

The runner's consumer installation still installs the actual `npm pack` tarball plus
`typescript@^7.0.2`; registry access and resolved consumer compiler version are evidence inputs,
not locked by the monorepo lockfile. Keep that policy unchanged in this slice and record versions.
Product third-party runtime dependencies come from the tarball manifest. The generated plugin has
no dependencies. Consumer type imports use only installed `gitlode/plugin-api`, with
`skipLibCheck: false`; no source aliases or root node_modules fallback.

Two necessary filesystem accesses are explicit packaging exceptions, not implementation imports:
read the product manifest/version and run `npm pack` in `packages/gitlode`; inspect the installed
schema and `dist/plugin-api.d.ts` for existing public declaration assertions. Installed worker
operation is exercised through the CLI; never deep-import the worker or collector. No new exception
for product internals is needed. Generated consumer text is checked by the consumer compiler,
separately from checking the runner itself.

### TypeScript, build and configuration boundaries

Add `tests/system` to root npm workspaces. Manifest scripts: `typecheck: tsc -p tsconfig.json`,
`test:package: npm run typecheck && tsx ./scripts/test-installed-package.ts`,
`format:write: oxfmt`, `format:check: oxfmt --check`, `lint: oxlint`, `lint:fix: oxlint --fix`.
Omit generic `test`, build and publish scripts so workspace-wide commands cannot start packaging
or formal measurements accidentally.

`tests/system/tsconfig.json` extends `../../tsconfig.base.json`, explicitly sets `composite: false`,
`noCheck: false`, `noEmit: true`, `declaration: false`, `declarationMap: false`, `sourceMap: false`,
`rootDir: .`, and includes `scripts/**/*.ts` (plus future locally owned helpers only). Inherit strict,
NodeNext, ES2022, Node types and indexed-access/unused checks. No references, path mappings or emit;
no root solution reference to this non-composite project. Explicit root `typecheck:system` delegates
to its `typecheck` and is added to CI/validate:release. Package command also checks its runner so
standalone use cannot silently bypass types. Fix only owned runner errors; existing package tooling
`noCheck` and unrelated Attributes fixtures remain deferred. Editor discovery uses local tsconfig.

Product solution build remains unchanged. Required order: source/development checks, release build,
publint, checked installed-package runner. The low-level runner requires already built release output;
root `test:package` remains the build-and-validate convenience command. Do not run a development build
between release bundling and packing because both build forms share product dist.

Rev-dep: add a root module boundary for `tests/system/**` allowing only its local scripts/helpers;
add a workspace entry at `tests/system` with no production entry points, `scripts/**` dev entry points,
`followMonorepoPackages: false`, circular/unresolved/missing-module checks and script binary dependency
inspection. Retain existing product boundaries. Node built-ins require no external dependency;
filesystem paths and generated source strings need review because static import rules cannot enforce
them. Do not add allowed product src/test/dist imports. Root format/lint already traverse explicit npm
workspaces; local commands inherit root configurations. Keep the stricter lint policy for scripts
and avoid new global exclusions. Existing root Vitest projects/coverage remain unchanged.

### Fixture, path and process lifecycle

Resolve repository root from the moved script's location (`../../..` from `tests/system/scripts`),
then product root as `packages/gitlode`; never derive them from caller cwd. npm workspace commands
change cwd, so all pack/install/CLI/Git calls carry explicit cwd. Keep shell-free argument arrays,
`npm_execpath` through `process.execPath`, inherited environment plus `NO_COLOR=1`, fixed Git identity
and dates, and installed npm executable lookup. Windows paths, spaces, drive boundaries and Linux
paths must not become shell strings or POSIX-only concatenations.

The workspace owns one `mkdtemp` root under OS temp containing pack, consumer, Git repository and two
output directories. Check the resolved root is outside the resolved monorepo before any write; use
path-relative containment that handles same path, descendants and another Windows drive rather than
assuming every outside path begins with `..`. If TMP points inside the checkout, fail with an actionable
message. Delete only that verified created root in `finally`, after awaited children close. Preserve
stdout/stderr in failures and nonzero exits. Keep existing sequential scenario execution and no
automatic retry. No new timeout/process-group framework in this path-only migration: a child stall
requires external operator/CI cancellation, and existing cleanup may fail on Windows file locks.
Do not present this runner as having the formal harness's bounded descendant supervision. ENOTEMPTY,
EBUSY and timeout observations remain open; a concrete failure returns diagnosis, not silent retries
or a new reproduction campaign. Acceptance execution itself is finite as specified below.

### Commands and CI/package boundary

| Entry point                   | Before                                                                              | Proposed after                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Low-level installed check     | `npm run test:system:package -w gitlode` invokes local tsx runner                   | Canonical root `npm run test:system:package` delegates to `npm run test:package -w @gitlode/system-tests` (typecheck + runner); requires release output. |
| Existing product alias        | Same command above                                                                  | Keep `gitlode` script as `npm --prefix ../.. run test:system:package`; one-way delegation, no cycle and no duplicate runner.                             |
| Build + package convenience   | Root `npm run test:package` delegates to gitlode build, publint and installed check | Keep root and gitlode `test:package` behavior; product alias reaches new workspace after build/publint.                                                  |
| Owned TypeScript              | Runner belongs to unchecked tooling project                                         | Root `npm run typecheck:system` plus workspace `typecheck`; runner command also enforces check.                                                          |
| Functional release validation | Existing root `validate:release` chain                                              | Add `typecheck:system` before source/build checks; final installed step uses canonical root command. Preserve every other check/order.                   |
| CI installed step             | `npm run test:system:package -w gitlode` after release/publint                      | Use root canonical command, plus explicit typecheck step; retain Ubuntu Node 22, source tests and metadata steps.                                        |
| Release workflow              | Node 24 `validate:release`, Changesets publish path                                 | Inherit changed validate chain; no new publish action or gate routing.                                                                                   |

Compatibility is at the documented command boundary, not at the old script filename; the latter has
no other repository caller. Keep alias for M2 and document later removal separately. Neither CI nor
validate:release starts performance calibration, capture, measure or aggregation. Do not claim the
functional chain establishes telemetry acceptance.

`private: true` excludes publication; existing Changesets `privatePackages.version/tag: false`
already applies. Product `files: [dist, schemas]`, exports/bin, bundler inputs and runtime dependencies
must remain unchanged. The new workspace is outside product packaging and has no product build edge.
Review `npm pack --json` file inventory for absence of tests/system/tooling and installed package for
absence of runtime dependencies on private workspaces. No changeset or release version is needed.
Future lockfile synchronization records root workspace addition, workspace dev dependencies and
`node_modules/@gitlode/system-tests` link; review unrelated churn and run clean `npm ci`. Syncpack must
discover the new manifest and keep shared versions aligned; do not add it to production-private-package
pin rules merely because it has version 0.0.0.

### C6: lasting checks and migration-only tooling

Lasting ownership: installed CLI/API/schema regression is system-workspace owned; domain recorder,
collector, worker fault-injection, report validation and behavioral equivalence checks stay with
implementation owners. Reusable fixture, statistics, supervision and performance-regression machinery
may later be proposed for `tests/system/performance/` with its own support closure and checked project.
Pure planner/statistics units remain harness units; internal-access aggregation stays owner-local or
uses a separately reviewed development-only bridge. The current aggregation bundle/sidecar accesses
are genuine internal seams and are not justification for an installed-test deep import.

Migration-only ownership: legacy-versus-redesigned comparisons, calibration/provenance/ancestry
attestations and publish gate remain at current package/.release paths through M2 acceptance and
initial v0.13.0 publication. Later proposal may isolate migration orchestration under
`tests/system/migration/`; shared lasting helpers are not deleted with migration callers. Classify
individual dependencies before any later move; moving all performance tooling is not this slice.

T13C must preserve accepted manifests, exact product/harness revisions, runtime/package hashes,
external evidence references and review bindings. Gate retirement occurs only in a separate reviewed
change after the initial release, with accepted evidence preserved in history, required migration
obligations closed and replacement lasting-check ownership/commands documented. Remove publish wiring,
validator/config and only exclusively migration-owned helpers together after approval; do not remove
collector correctness, functional package checks or reusable performance machinery. This proposal
changes no gate or threshold and does not expand C1-C5 refactors.

### Canonical documentation updates during implementation

| Canonical destination                                                                                      | Exact proposed update                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/design/domain-design.md` sections 3.1, 3.2 and 4.3                                                   | Add private test-tool workspace charter outside production dependency envelope; installed/public-only access and narrowly listed filesystem exceptions; match Rev-dep rules.                                                                                      |
| `docs/contributing/build-test-release.md` tooling, installed validation, CI/publish sections               | Separate checked system tooling from deferred noCheck package tooling; document canonical commands, build prerequisite, alias, temp/process limits and unchanged migration gate.                                                                                  |
| `docs/README.md` documentation map                                                                         | Add contributor routes: product work through architecture/domain and build guide; telemetry work through telemetry, verification and harness/performance guides.                                                                                                  |
| `docs/design/telemetry.md` implementation guidance and `docs/design/telemetry-verification.md` test layers | Recorder changes: operation owner + catalogs + fake meter/clock and actual owner-path tests. Collection infrastructure: execution session/report/SDK boundaries + real-provider/fault/transport tests; link performance separately. Preserve recording placement. |
| `docs/contributing/telemetry-performance-harness.md`                                                       | Record C6 classification/current owners and deferred migration/retirement, linking build guide's publish policy without duplicating thresholds.                                                                                                                   |
| Root `CONTRIBUTING.md` Test/navigation                                                                     | Show canonical system/typecheck commands and convenience build command; link canonical guide instead of duplicating rules.                                                                                                                                        |

Paths beginning `docs/` above are under `packages/gitlode`. No end-user usage/profile change is proposed,
so no new user-facing workflow is invented. AGENTS remains routing only. Stable accepted facts move
into these homes during implementation/review; this proposal remains continuation context.

### Proposed implementation packet and finite acceptance

Trunk must first approve this scope and name the exact returned design commit as implementation base.
Reading: this proposal plus architecture/domain, build-test-release, telemetry verification/performance
and harness guidance. Separate implementation conversation on the preserved child branch; no PR,
merge, publish, formal measurement or acceptance-record edit is included. Builds/consumer installation
can take substantial time independently of reasoning; report current stage and failures.

1. Add private workspace/config/dependencies, checked project and Rev-dep/format/lint integration;
   move only the runner and fix its roots/containment and owned type errors. Wire commands/aliases and
   synchronize lockfile. Keep all existing assertions/fixture semantics. These dependent changes form
   one coherent executable checkpoint, not a half-wired migration.
2. Update canonical navigation/ownership and CI/validate wiring listed above; inspect product package
   boundaries. Commit a meaningful complete checkpoint with failed/unrun checks explicit.
3. Review fixed diff and execute finite functional acceptance; no automatic retry to hide a failure.
   Return exact commit/package/environment identities and residual blockers for trunk review.

Required finite checks on implementation (not executed in this design session):

- Once: `npm ci`, `npm run syncpack:check`, `npm run format:write`, `npm run format:check`,
  `npm run lint`, `npm run typecheck:system`, `npm run architecture:check`,
  `npm run schema:check -w gitlode`, `npm test` on the implementation candidate. No unrelated fixture
  typing cleanup. Inspect Rev-dep closed allowlists and all owned TS files included with noCheck false.
- On Windows and Linux, once per platform: `npm run build:release`,
  `npm run validate:publint -w gitlode`, then `npm run test:system:package`. Verify help/version;
  installed schema title; two-commit recipe; isomorphic per-file additions 2/deletions 1 with dynamic
  plugin enrichment; git-cli nonempty output; ordinary installed CLI/worker completion; strict NodeNext
  plugin API consumer compilation and existing Tracer/Meter/private-type declaration assertions.
  Worker coverage is indirect through extraction, not independent fault coverage.
- Once on reference Linux candidate: exercise retained `npm run test:package` end-to-end alias and
  `npm run validate:release` wiring. Repetition here verifies command integration, not new performance
  evidence. Record command exits and tarball SHA-256/pack file inventory; inspect no private runtime
  dependencies or system files in packed product. Confirm release artifact remains available before
  each low-level installed check.
- Review Windows drive/space handling and inside-checkout temp rejection; use a disposable temp
  override for the rejection path and restore environment. No VM or machine-wide setup. On any stall,
  cleanup failure or functional failure preserve diagnostic evidence and return diagnosis; do not
  enlarge the campaign. Normal CI retains Linux only; Windows evidence comes from the bounded session.

Before F, lockfile/wiring changes alter source/harness attribution even if product runtime bytes are
unchanged. Record fresh candidate OID and package hash; assess build output rather than asserting byte
identity by inspection. Preserve prior evidence and review any reuse binding; design/functional checks
are not T13B/T13C performance acceptance. F product/harness archives and runtime identities are created
later by their assigned session, not here.

Trunk/human decisions: accept this bounded proposal and assign implementation; later accept review,
name PR source/base and authorize squash; separately decide future performance placement and post-release
gate retirement. Routine implementation choices: runner typing, manifest alignment, local scripts,
path guards and documentation wording within the listed scope. Location, profile/style contracts,
thresholds and publish authority are already settled. A new dependency/internal-access requirement or
changed fixture/assertion is a scope conflict to return to trunk, not an implied authorization.

## System implementation outcome (2026-10-02)

Implementation is returned for independent review, with incomplete Windows functional evidence.
The human authorized the fixed proposal at `1b2177bbc9027e990eb32fd243dc306cd67bac79`.
Initial M2 checkout was clean. System local/tracking/actual remote matched that checkpoint before
switching. Work remains on `feature/otel-redesign_M2_system`; parent refs are untouched.

Checkpoints: executable workspace/move/wiring `a3dacf474797874cba58bc1fc63f9d24987686b6`,
canonical ownership/navigation `f024edacff073be4f7438dbb3fb1f31cc0f8ba45`.
Both were normally pushed. [Source CI](https://github.com/gitlode/gitlode/actions/runs/36971362693)
passed on f024eda, including independent system typing, source tests and installed-package checks.
This outcome-only descendant does not change implementation or public package inputs.

Inventory: root manifest/lockfile, Rev-dep and CI wiring; new private system manifest and checked
project; runner moved with repository-root and pre-creation realpath containment fixes; canonical
build/domain/telemetry/verification/harness/navigation docs and root CONTRIBUTING. Assertions,
fixture recipe, child execution and public package files/exports/bin/dependencies are retained.
No collector/internal test, performance harness, Attributes fixture or publish gate changes.

| Command boundary      | Before                                               | After                                                             |
| --------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| Installed check       | product-local tsx script                             | root `test:system:package` -> system workspace typecheck + runner |
| Product compatibility | `test:system:package -w gitlode` owns runner         | retained one-way `npm --prefix ../.. run test:system:package`     |
| Convenience           | root/product `test:package` build + publint + runner | same sequence through retained alias                              |
| Independent typing    | unchecked product tooling                            | root `typecheck:system` -> strict non-emitting local project      |
| Release/CI            | prior source/build/package checks                    | adds independent system typing and canonical installed command    |

### Evidence and finite check correspondence

Evidence paths (local, not external backup): Windows
`C:\Users\t-wakabayashi\source\gitlode\.cache\m2-system-evidence`, Linux
`/home/t-wakabayashi/gitlode-performance/m2-system-20261002-pXtjx7/{source,evidence}`.
Windows copy includes Linux evidence and source bundle through f024eda. Preserve these paths;
no prior immutable archive was modified. Windows Node v22.23.1/npm 11.11.0; Linux uses the preserved
M0 Node v22.23.1 toolchain, npm 10.9.8 and Git 2.53.0 (environment log is authoritative).

| Required check                                | Execution / reusable evidence                                                           | Result                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Clean npm ci                                  | Windows first attempt, Linux once                                                       | Windows setup EPERM; Linux pass                                   |
| syncpack / format check / lint / architecture | Linux validate:release prefix; separate format:write/check and architecture; f024eda CI | pass                                                              |
| Independent strict typing                     | Windows before ci; Linux standalone and package command; CI                             | pass                                                              |
| schema / source tests                         | f024eda CI steps, same implementation source                                            | pass in CI; local schema stopped at setup failure                 |
| Linux release / publint / installed CLI       | retained root test:package once plus CI canonical command                               | pass                                                              |
| Compatibility alias                           | Linux root -> product -> root canonical -> system                                       | pass                                                              |
| Windows release / publint / installed CLI     | not started after failed clean installation                                             | incomplete                                                        |
| validate:release end-to-end                   | once on Linux copy                                                                      | incomplete: schema needs missing .git metadata                    |
| Package inventory/hash                        | separate pack after successful Linux alias                                              | 13 files; no system/tooling files or private runtime dependencies |

Linux tarball SHA-256:
`148ffe3719aa773e12198df91b7be066e2f99084294c79ba31637e34fba8fb72`.
`pack-inventory.json`, `packed-manifest.json`, `package-boundary.txt` and the tarball are saved.
Installed help/version, schema title, two commits, isomorphic diff additions 2/deletions 1 with
plugin enrichment, git-cli nonempty output, CLI/worker completion and strict NodeNext consumer plus
Tracer/Meter/private declaration assertions passed unchanged. Each adapter returned 2 records.
The transient consumer's resolved compiler version was not retained; consumer compiler command
success is retained, and its existing registry-selected policy remains unchanged.

Strict evidence: effective config and file list show noCheck false, noEmit true, composite false,
strict/indexed/unused checks and the one owned runner included; no references/aliases. Rev-dep's
finite inserted `../../../packages/gitlode/src/index.js` import failed with a root system-tests
NOT ALLOWED violation. The exact original runner was restored and compared byte-for-byte; allowlists
were not weakened. Config lint has zero errors and one compact-syntax warning.

Containment evidence: actual implementation predicate checked with Windows win32 paths for a
different drive, spaces, same directory, descendant and sibling prefix. Linux extracted unchanged
guard executed with an outside space-containing parent and an inside-checkout TMPDIR. Inside rejection
preceded creation, leaked no directory and preserved existing sentinel data. Windows sentinel and
rejection predicate were also checked without deletion. Full Windows installed-path execution is
still missing; predicate tests are not represented as that evidence.

### First failures, deviations and return boundary

Windows npm ci failed unlinking `node_modules/@oxlint/binding-win32-x64-msvc/oxlint.win32-x64-msvc.node`
with EPERM before product/tests execution. First npm debug log and command log are saved. Its partial
installation also left local formatting unavailable. No retry, timeout relaxation, lock cleanup or
lifecycle change was attempted. Initial owned typecheck diagnostics were unused guard imports while
edits were incomplete; these were corrected before the executable checkpoint. No product failure
was observed in the successful Linux package execution.

The Linux isolation was a source copy without .git. The first validate:release reached schema check
and failed its Git status prerequisite. This agent preparation error is saved in validate-release.log;
the chain was not rerun. Later checks were independent, previously unexecuted package/alias checks,
not a retry of that chain. CI independently supplied schema/source-check evidence. Shell setup quoting
errors occurred before Linux dependency/test execution; saved scripts avoid nested shell interpolation.

Canonical additions use dedicated ownership/contributor subsections rather than modifying every
proposed subsection in place. Lockfile changes are limited to the workspace/link/devDependencies.
Formatting was run using Linux tooling after Windows setup failed, and formatted files were returned
to the main checkout. No new machine/toolchain setup, formal measurement, PR, merge, parent ref update,
release/publish or acceptance-record edit was performed.

Remaining for trunk: independent implementation review; diagnose Windows setup EPERM before assigning
any further Windows execution; decide the bounded follow-up for complete validate:release execution
with Git metadata and exact transient consumer compiler identity. These missing checks are neither
passes nor release exceptions. ENOTEMPTY/EBUSY/timeout and existing Attributes issues remain outside
this slice. This implementation is not T13B/T13C acceptance or publish readiness.

## Independent first system review (2026-10-02)

Verdict: **implementation acceptable**, with no mandatory implementation findings. Acceptance of
the complete system slice remains pending the incomplete evidence below. This review changes only
this plan; it does not repair implementation, complete missing acceptance runs, update the acceptance
record, or authorize PR/merge, parent-ref updates, formal measurements or publication.

Reviewed the complete `1b2177bbc9027e990eb32fd243dc306cd67bac79` ->
`f024edacff073be4f7438dbb3fb1f31cc0f8ba45` diff, including executable checkpoint
`a3dacf474797874cba58bc1fc63f9d24987686b6` and all canonical documentation changes.
Each named checkpoint is the direct parent of the next; handoff
`a32030ffa271d07668a374988000ae386cc32e30` is the direct descendant of f024eda and changes
only this plan. At review entry, HEAD/tracking/actual remote matched a32030f, the single worktree
was clean, and the branch was `feature/otel-redesign_M2_system`. Applicable root AGENTS and the
system proposal/outcome, architecture/domain and build/test/release guidance were read.

### Implementation assessment

- The rename diff preserves the entire fixture/assertion/child execution/finally body. Roots now
  resolve from the runner location; pack, installation, Git and CLI calls retain explicit cwd,
  argument arrays and npm_execpath handling. No fixture or consumer API policy changed.
- Realpath containment checks the existing temp parent before mkdtemp. Equality, descendants and
  `..prefix` inside the checkout are rejected; sibling prefixes, spaces and Windows drive changes
  are handled by path.relative/isAbsolute and the platform separator. Finally removes only the
  newly created fixture root. Cancellation/locks retain the documented existing lifecycle limits.
- The private workspace declares only its five development tools. No product/internal imports,
  runtime dependency, product build reference or new packaging input was introduced. The lockfile
  changes only root workspace membership, its link and manifest entry; no resolved version churn.
  Saved packed manifest/inventory and the independently hashed tarball confirm 13 product files,
  no system tooling files and no private runtime dependencies. Hash matches the outcome above.
- The sole owned TS runner is included in the independently checked project. Effective options are
  strict NodeNext, noCheck false, noEmit true and composite false, with indexed/unused checks and
  no references/aliases or type-suppression comments. Inherited skipLibCheck true concerns library
  declarations; the unchanged generated public consumer separately uses skipLibCheck false.
- Rev-dep adds a closed local-only system boundary and workspace checks without weakening existing
  product boundaries. A disposable-copy negative import independently produced the root
  `[system-tests] ... -> packages/gitlode/src/index.ts (NOT ALLOWED)` violation. Filesystem reads
  and generated consumer text remain the explicit reviewed exceptions, not static-import guarantees.
- Root/product/workspace delegation has no cycle or duplicate runner. Explicit early typing plus
  standalone package-command typing is intentional. Existing development builds precede release
  bundling; no development build intervenes before publint/pack. CI/validate retain existing checks
  and add typing; neither routes to formal measurement or publish. C6 canonical ownership and
  separately reviewed post-release retirement preserve lasting checks and the migration gate.

Optional documentation precision: the no-directory-leak statement describes the runner's fixture
creation. The tsx launcher can create its own `tsx-1000` cache in an inside-checkout TMPDIR before
the runner rejects it. Clarifying that distinction would avoid implying launcher-wide no-write
behavior; it is not a leaked installed-package fixture or unsafe cleanup of existing data.

### Evidence provenance and limitations

Independent executions used the existing isolated Linux source/dependencies at the outcome's path,
not shared Windows node_modules. Node v22.23.1, npm 10.9.8 and checked-project TypeScript 7.0.2
were recorded. Core manifest/lock/config/runner bytes matched the fixed shared implementation.
Strict typing, effective config/file enumeration, the disposable negative import and seven win32
predicate cases passed. The unchanged runner, executed with Node type stripping from unrelated
`/tmp` cwd, rejected both inside and symlink-inside space-containing temp parents before fixture
creation and preserved sentinel data. These are finite probes, not Windows installed-package runs.
Review logs are local at `.cache/m2-system-review/`; disposable Linux probes remain at the path
recorded in `probe-path.txt`. The original isolated source and shared dependencies were not repaired.

Probe preparation failures were distinguished from product failures: an incorrect Rev-dep binary
path failed before analysis; a first tsx probe observed its launcher cache; a subsequent Node probe
still contained the intentional negative import. After correcting only disposable probe setup and
restoring the copied runner, the final checks above passed. No npm ci or full suite was rerun.

Saved-log inspection confirms the first Windows npm ci unlink EPERM on the oxlint native module,
Linux local validate:release stopping at schema's missing-.git prerequisite, successful Linux
test:package alias/delegation and installed assertions, and the saved strict/negative-import results.
The Windows process snapshot does not identify the locking process or prove an ACL diagnosis.
The transient consumer compiler version remains unknown; the workspace compiler version and bundle
compiler log cannot substitute for it. Historical outside-temp success is saved-log evidence.

Live GitHub job/step and full-log inspection of
[CI run 36971594821](https://github.com/gitlode/gitlode/actions/runs/36971594821) confirms checkout
a32030f on Ubuntu 24.04.5, Node v22.23.3/npm 10.9.9, successful dependency/format/lint/type/architecture/
schema checks, 96 source files / 1312 tests, release build, publint and canonical installed check.
This descendant has identical implementation to f024eda. CI is independent hosted evidence, not
local review execution or a successful invocation of the combined validate:release command.
Outcome-reported claims were not promoted to independently executed results merely by repetition.

The saved `evidence-hashes.json` matches 21 of 24 listed files; `final-ci.json`,
`preservation-check.cjs` and `preservation-check.log` differ from their listed hashes. Their saved
bytes are not treated as checksum-attested historical evidence, and the cause is not established.
Live CI inspection and a fresh Git-base comparison independently confirm the CI/manifest/runner
claims used in this verdict. Preserve the original hash list and reconcile these three entries in
the evidence follow-up rather than overwriting the list or inferring historical integrity.

### Minimal separately assigned completion

1. Windows: preserve the first failure and diagnose the native-module lock/permissions without
   deleting or repairing shared node_modules. Use a fresh isolated checkout at the fixed reviewed
   source, record Node/npm/Git identities, and perform one clean installation after diagnosis.
   Then run build:release, validate:publint and the canonical installed-package command once in
   order, preserving exits, package inventory/hash and cleanup observations. Include a real
   space-containing outside temp path and bounded inside rejection with existing data preserved.
   Stop and return any failure; do not retry automatically or add the full suite.
2. Linux: restore genuine fixed-revision Git metadata to the existing isolated source from the
   preserved bundle, verify the complete tracked source and clean status against f024eda, and
   reuse the already installed dependencies only after identity checks. Run validate:release once
   and retain its full log/exits and package identity. This is the explicitly deferred combined-chain
   completion; successful CI constituent checks do not erase the original local failure.
3. For those future consumer executions, use an evidence-only launcher/probe to record the actual
   installed consumer typescript/package.json version and tsc --version before cleanup, together
   with its consumer lockfile and tested tarball hash. Do not pin a new version, infer the old
   consumer's version, or change fixture/assertion semantics to manufacture evidence.

Windows installed execution, Linux combined-chain completion and exact consumer compiler attribution
remain incomplete. No implementation correction is required by this review; system acceptance,
T13B/T13C and publish readiness remain separate and unaccepted here.

## Bounded system evidence completion attempt (2026-10-02)

Returned on `feature/otel-redesign_M2_system`, starting from handoff
`988815e1e3ba1e8c0b7c35084baa3fd13498e539`. Both new genuine Git clones checked out detached
`f024edacff073be4f7438dbb3fb1f31cc0f8ba45` and retained clean tracked source. No implementation,
fixture/assertion, dependency-version policy or acceptance record was changed. **Completion remains
incomplete because the evidence-only preload introduced a setup failure.** No acceptance is claimed.

### New executions and stop boundary

Windows root: `D:/gitlode_test/m2-system-completion-20261002-988815e-01`; Linux root:
`/home/t-wakabayashi/gitlode-performance/m2-system-completion-20261002-988815e-01`.
Windows Node v22.23.1/npm 11.11.0/Git 2.45.1.windows.1; Linux preserved Node v22.23.1/npm 10.9.8/Git 2.53.0
on WSL2. Environment logs own exact identities. Windows used dedicated cache and an actual existing
`outside temp` parent with protected sentinel. Root/source/cache/temp writes succeeded before ci.

| OS      | Command and count                                         | Result                                                      |
| ------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| Windows | `npm ci`, once in fresh fixed clone                       | exit 0                                                      |
| Windows | `npm run build:release`, once                             | exit 0                                                      |
| Windows | `npm run validate:publint -w gitlode`, once after release | exit 0                                                      |
| Windows | `npm run test:system:package`, one launch attempt         | wrapper exit 1; child exit unknown; empty installed log     |
| Linux   | `npm run validate:release`, once in genuine fixed clone   | exit 1 after successful syncpack; combined chain incomplete |

Linux copied existing root node_modules only after identical lockfile SHA-256
`3448b72b870baafda631d83c8d11bcdde7dc1079f8c02587b445efb858449368`, matching toolchain,
and all installed non-link package versions/integrities against the fixed lockfile were checked.
Workspace-local nested dependency completeness was not separately attested; reuse validation has
that limit. No Linux installation or validation retry occurred. The original missing-.git failure
remains preserved separately; this new failed chain does not replace it or establish a pass.

`evidence/probes/consumer-probe.cjs` intended to synchronously preserve the actual consumer manifest,
lockfile, installed TypeScript manifest, `tsc --version` and used tarball before cleanup, on successful
consumer-install close. It added only observation and a compiler-version invocation, but accidentally
omitted returning ChildProcess from its spawn wrapper. Windows deadline launcher consequently threw
`TypeError: Cannot read properties of undefined (reading 'on')`; the same faulty preload affected
Linux npm. This is agent-created probe setup failure, not evidence of product/test failure. Original
probe bytes, full available command logs, Linux exit and Windows wrapper failure are retained.
Repair condition is to return the original ChildProcess and verify transparent behavior on disposable
children before any separately assigned execution. No successful consumer snapshot exists, and no
workspace compiler identity is substituted. No commands were retried and no Windows full suite added.

Clones/source proof/pack used 120s deadlines, Windows validation commands 600s, and Linux combined
chain 1200s with 15s kill-after. The Windows installed launcher crashed before installing its deadline
and exit listeners; a finite process snapshot found no remaining matching child, but does not establish
its exit. Real outside-temp fixture success, inside rejection and consumer/package correspondence
therefore remain missing. Sentinel data survived. Runner fixture leakage and tsx's own launcher cache
are distinct; no launcher-wide no-write guarantee is claimed.

### Historical reconciliation and adopted evidence

The old manifest and three originals were not edited. `evidence/old-current/` preserves their current
bytes plus the first EPERM and syntax-error logs; `three-mismatches.json` records full old/current
SHA-256 values. Roles are CI summary (`final-ci.json`), preservation probe (`preservation-check.cjs`)
and probe output (`preservation-check.log`). The 21 other listed hashes still match. The saved syntax
failure and corrected current probe make editing plausible, but do not establish generation order
relative to the hash list. CI summary ordering is unknown. No cause is inferred from mtime. All three
remain excluded from checksum-attested historical evidence; the new hashes attest only current copies.

Fresh fixed-Git comparison independently passes for public manifest fields and the unchanged
fixture/assertion/execution/finally body after newline normalization. This is new confirmation, not
repair of old evidence. Fresh CI acquisition failed (`gh` unavailable; web API inaccessible); the
previous independent review's live CI attribution remains separate and is not newly attested here.
Read-only file/parent ACL observation permits the owner; finite module enumeration found no matching
loaded oxlint module. Neither proves the original EPERM cause or identifies a departed lock owner.
Shared node_modules was not deleted or repaired, and the historical first failure is retained.

Windows separately saved one release pack, without an intervening development build, SHA-256
`03185e8b10f01027f0c69125df56464ecea4dc2eb2e36c7f2d65ee0d28ee9bcf`.
Its pack inventory is retained; it is **not** a tested installed-package tarball. Linux did not reach
release packing. Consumer identity and tested-tarball identity remain missing on both systems.

After all evidence/probe writes ended, Linux manifest sealed 17 entries, SHA-256
`ca60002d4e20a9bae4f3c76a2bbf25fb9c0a7c0a02deb7603b721d7846b4c71a`;
Windows aggregate manifest sealed 61 entries, SHA-256
`58037d8ea561a58f431480955d71c5c7e7a616227e384f597bc4d30dc596e178`.
All entries were verified at generation and again at Linux-to-Windows and Windows-to-return-copy
destinations. Return copy: `.cache/m2-system-completion-return-988815e-01/evidence`.
These are local artifact copies, not external backup. No sealed log was appended afterward.

Remaining: a corrected, separately verified evidence launcher and separately assigned Windows
installed/outside/inside checks, Linux combined chain, and both consumer identities. Implementation
review remains acceptable; full system acceptance, T13B/T13C, formal measurement and publication are
outside this return. Only this handoff document is committed; no PR/merge or parent ref update occurs.
