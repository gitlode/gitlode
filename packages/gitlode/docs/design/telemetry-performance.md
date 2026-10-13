# Telemetry Performance Verification

This document defines the performance acceptance policy for the telemetry redesign. Exact
thresholds, fixture requirements, measurement fields, and environment metadata are canonical in
[`telemetry-catalog/performance.yaml`](telemetry-catalog/performance.yaml). Functional verification
is defined separately in [`telemetry-verification.md`](telemetry-verification.md).

## Comparison model

The migration compares redesigned profile-disabled execution with the pre-migration disabled
baseline, then compares redesigned profile-enabled execution with redesigned disabled execution.
The old and new enabled profilers are not compared because they intentionally collect different
signals and observation volumes.

Profile-disabled is the normal execution path and has the stricter acceptance threshold: no more
than 5 percent median wall-clock overhead and no more than the greater of 8 MiB or 5 percent peak RSS
growth. Local profile is explicitly enabled for diagnosis and permits no more than 15 percent median
wall-clock overhead and the greater of 32 MiB or 15 percent peak RSS growth.

## Reproducible measurement

Measurements use clean release builds and run the bundled or installed CLI as a child process.
`--quiet` suppresses presentation noise without disabling requested local collection. Baseline and
candidate runs use the same repository snapshot and filesystem class but separate output
directories.

Two warmups precede seven measured pairs. Pair order alternates between baseline-first and
candidate-first, and acceptance uses the median paired ratio. A fixture shorter than ten seconds is
useful for semantics and volume but is not a wall-clock gate.

High variation, environment mismatch, failed child execution, or failed output equivalence makes a
measurement inconclusive rather than passing or failing. Inconclusive measurements are rerun under
controlled conditions.

## Execution supervision

The supported reference commands run the workflow in an owned Linux process group under a separate
supervisor. WSL2 with Linux-native tools and storage is supported. The supervisor observes preparation,
child execution, and processing stages without depending on the workflow's event loop. The exact
limits, retained diagnostics, and termination policy are in the performance catalog. These deadlines
are operational safeguards, not the wall-clock performance thresholds.

Stage changes identify the fixture, adapter, quantity, warmup/measured iteration, and profile state;
child PID updates and periodic elapsed-time messages expose progress without extending deadlines.
Deadline expiry, operator SIGINT/SIGTERM, unexpected workflow termination, or supervision failure
makes the attempt inconclusive and nonzero. Cleanup targets only the supervisor-owned process group,
including descendants after the workflow exits. A grace period precedes forced termination.

Successful signal delivery is not cleanup completion. At worker launch the supervisor captures the
detached leader's PID, process group and Linux `/proc` start identity. After forced termination it
uses the existing cleanup-wait budget, starting before SIGKILL and never renewed by worker close,
to confirm both worker close and absence of live members of that owned group. Normal protocol
completion uses the same SIGKILL/confirmation path for retained descendants. Group scans distinguish
zombies (`Z`) from live states and retain observed PID/start identities across disappearance; reuse,
unreadable observation, signal failure or budget exhaustion yields cleanup uncertainty, terminal
`inconclusive` evidence and exit 2. The original failure reason and cleanup errors are retained.
`cleanupConfirmed` is true only after the barrier succeeds without cleanup errors.

IPC child PIDs remain diagnostic, never signal targets. Observation runs only at leader capture and
cleanup, outside measured execution. `/proc` scans and identity checks establish observed group
quiescence, not an atomic kernel snapshot or ownership of processes that leave the group. They
cannot eliminate the kernel race between observation and signaling or guarantee bounded kernel
I/O under the abrupt-host/uninterruptible conditions described below. Inaccessible process tables
are conservatively inconclusive rather than treated as an empty group.

Each invocation writes uniquely named atomic supervision snapshots. Completed raw runs and normalized
behavior are saved between children, alongside the existing complete-pilot artifacts. The supervisor
does not invent a pilot result when a child or repository preparation has not completed. Partial
evidence is diagnostic and cannot be resumed into a later formal attempt. Supervision completion
does not imply performance acceptance; both supervision and formal artifacts must be inspected.

Structured supervision evidence contains identifiers rather than temporary paths or raw arguments.
Bounded raw child diagnostics are kept in a separate local log that may contain paths. They are not
embedded in, or treated as, formal calibration/comparison evidence. Abrupt supervisor SIGKILL, host
shutdown, or uninterruptible kernel I/O cannot promise orderly cleanup; remaining progress is only
diagnostic evidence in those cases.

A final raw-diagnostic or supervision-snapshot write failure is itself an inconclusive supervision
result with exit code 2. The two destinations remain independent: losing the raw log does not prevent
the supervisor from recording a structured terminal failure when snapshot storage is still writable.
After cleanup, a failed terminal snapshot receives one bounded recovery write as inconclusive
evidence; the measured workflow is never repeated to repair evidence. If persistent storage failure
also prevents that recovery, the operator receives bounded stderr diagnostics and no claim that the
last on-disk `running` snapshot or pending disposal barrier is terminal success. No software path can guarantee replacement of that
snapshot while its storage remains unwritable.

## Fixtures

The suite contains commit-heavy and file-heavy deterministic repositories for both Git adapters, a
deterministic plugin-heavy projection case, and a Git-independent aggregation scale case. Phase 0
calibrates repository sizes with a two-stage search on the reference environment. It doubles the
candidate workload to bracket the ten-second lower threshold, then uses deterministic integer binary
search to select the smallest permitted quantity whose observed legacy-disabled median is at least
ten seconds. The selected median must not exceed thirty seconds. This refinement is required even
when a doubling step jumps directly from below ten seconds to above thirty seconds.

Every calibration pilot uses the cataloged warmup and measured-run counts. Its child and behavioral
evidence must pass before its median participates in the search. A pilot whose median absolute
deviation exceeds five percent makes the attempt inconclusive. The same applies if completed pilots
classify a smaller quantity at or above ten seconds while classifying a larger quantity below ten
seconds; individual median values need not otherwise be strictly increasing. The harness must not
automatically retry or select a favorable sample. The initial manifest quantity is the minimum
permitted quantity. If it already exceeds thirty seconds, or adjacent permitted integer quantities
leave no value inside the window, calibration fails with preserved evidence rather than weakening
the accepted window.

The harness atomically persists artifact-safe progress after every completed pilot, including the
quantity, unrounded median and median absolute deviation, raw warmup and measured outcomes,
validation results, normalized behavior, revisions, and target recipe hash. A terminal failure after
workflow preparation begins must preserve all completed pilots. Temporary output and checkpoint
paths are excluded. An interrupted attempt may inform diagnosis but its measurements are not resumed
or combined with a later formal attempt. Successful quantities are then frozen in the manifest for
the entire migration.

The plugin fixture deliberately excludes network, IPC, and arbitrary script work. Such costs belong
to the injected workload and are not evidence of host telemetry overhead.

## Bounded growth and volume

The aggregation fixture runs equivalent identity and attribute sets at `N` and `4N`. Aggregate
groups, datapoints, and histogram buckets must remain constant, and profile-specific RSS growth may
increase by no more than 8 MiB. This complements point-in-time peak limits by detecting raw span or
sample retention.

Trace-volume checks reject the return of per-record, per-write, per-blob, per-diff, and per-commit
file-expansion spans. Git CLI command spans may scale only with actual command invocations and must
not cause additional commands. Plugin-created spans are reported separately from host volume.

Repository sidecar acceptance is a separate formal workflow. For `target_on`, the sidecar and a
valid `ProfileReport` are required; `legacy_off` and `target_off` are not-applicable. The repository
checks report schema, signal status, diagnostics, the 1 MiB report limit, and prohibited host
spans, and propagates fail or inconclusive to the top-level evaluation after saving the artifact.
It does not reuse aggregation N/4N/RSS evaluation. Git CLI command-start counts are not inferred
from runtime spans; any T09 command-parity result is explicitly contract evidence unless an
independent development-only command-start measurement is available.

For each fixed performance fixture, the development-only collector's JSON UTF-8 representation of `ProfileReport` must remain at
or below 1 MiB. This is a fixture acceptance limit, not a claim that an unbounded number of configured
plugin scopes consumes constant space.

## Metrics and environment

Raw artifacts retain wall time, peak RSS, output and extraction counts, report size, aggregate and
datapoint counts, diagnostics, environment fingerprint, fixture hash, script revision, and baseline
revision. Values are not rounded in stored artifacts. CPU time may be recorded for investigation but
is not an initial cross-platform gate.

Peak RSS is sampled externally from the target gitlode child process at intervals no longer than 25
milliseconds. The benchmark harness's own memory is excluded.

## Microbenchmarks

No universal nanoseconds-per-operation threshold is assigned to individual recorder calls. JIT,
CPU, and Node changes make such a gate unstable. Microbenchmarks instead verify clock reads and
instrument lifecycle and help locate regressions. Formal acceptance comes from the paired
end-to-end and bounded-growth measurements.

## Failed acceptance

A failed threshold first triggers noise, observation-volume, no-op path, allocation, clock,
instrument, SDK view, and collector-retention investigation using the unchanged manifest. Thresholds
are not relaxed automatically.

Any accepted exception records the affected fixture and adapter, raw result, cause, rationale,
impact, and reevaluation condition. Removing an observation to meet performance criteria is a design
change and cannot occur silently inside an implementation branch.

## Controlled repository fixture lifecycle

Repository workflows use the versioned lifecycle in the performance catalog independently of the
content recipe hash. Foreground automatic maintenance retains pinned Git heuristics while bounding
preparation under the existing supervisor. Each pilot and each capture/comparison creates a fresh
physical repository; all warmups, pairs and sidecars within that invocation share it. Finished refs,
tag object identities, HEAD/tree, object format and reachable count are queried after extension.
A verified prepared copy and byte inventories outside the disposable run root attribute the layout
of each individual attempt. Equal recipes do not assert equal physical packing across attempts or OSes.

Inventory reads run before existing warmups, before/after every timed child and sidecar, and at the
final pre-destruction boundary. They are outside CLI wall/RSS timing and warm filesystem/page caches.
This protocol provides no cold-cache claim or physical/cache equivalence to historical runs. It
compares bytes and path sets, ignoring access times, and does not invoke status/index refresh.
Missing links, unsafe ownership/configuration/links, writer markers or any content/layout drift make
the whole attempt inconclusive and nonzero, preventing subsequent dependent children. No regeneration,
rebaseline, retry, forced final gc/repack or wait-for-stability is permitted.

The worker retains roots until the existing supervisor confirms group cleanup and persists a
non-success disposal barrier. A barrier is not saved terminal success. Required root disposal precedes
publication of completed success; barrier-write failure retains every root and returns inconclusive.
If disposal or the final snapshot fails, earlier persisted evidence remains non-success, including
when the bounded recovery write also fails. `cleanupConfirmed` describes process-group completion;
the separate `disposal` phase and per-root status/error describe disposal or intentional retention,
including partial disposal. Only successful attempts are automatically disposed; failed, uncertain,
or unsupervised roots are retained with location diagnostics. The preserved prepared copy remains.
Failure of terminal persistence after successful disposal cannot restore removed roots: the saved
barrier remains non-success, and available return values/bounded diagnostics report per-root outcomes.

Stored lifecycle validation checks filesystem type/device against the prepared identity, embedded,
boundary and prepared digests, unique instance-owned boundary IDs and matching pre/post operation and
ordinal. Repository workflow consumers bind CLI and sidecar links to the child's ordinal reconstructed
from the fixed execution plan, rather than accepting another child's valid pair. Pilot and raw-run
projections preserve those links. Historical reads and Git-independent aggregation remain separate.

Cleanup does not finalize an already inconclusive lifecycle. An active primary exception survives
cleanup, notification and failure-artifact storage failures; secondary cleanup errors are recorded
separately where storage permits. Retained-root notification is bounded synchronous best effort.
If all evidence storage is unavailable, operator diagnostics identify the primary cause and missing
artifact best effort and the workflow remains nonzero; notification itself cannot guarantee delivery.
Observed cleanup and inventory boundaries cannot prove immunity to external writers, escaped process
groups, kernel races, host loss or uninterruptible I/O.

Historical selected quantities may undergo one bounded legacy-only eligibility check under the new
protocol, with explicit original selection provenance and new runtime/environment identity. This
uses the unchanged catalog counts, window, stability, behavior and supervision requirements, performs
no search and never rewrites the historical manifest. Passing is pending explicit trunk adoption;
it does not renew minimum-quantity proof. Fresh-target doubling/binary calibration remains unchanged.
Historical artifacts remain historical evidence and cannot qualify a new-protocol comparison.
The external review contract below binds eligibility and adoption. Release attestations follow the
[build/release guide](../contributing/build-test-release.md#fixture-qualification-release-review).

## Fixture qualification and adoption review

This contract uses archived independent review and an explicit trunk decision with exact byte hashes.
It does not add automatic launch preflight, a publish archive resolver or release-schema fields.
Eligibility is a result, not authority to compare or release. A manually populated lifecycle routing
string is not approval. Fresh calibration and the remaining target matrix retain their obligations.

### Exact references and authority

Retain a version-1 `qualification-input-review.json` before execution and a separate version-1
`fixture-adoption.json` with `kind: fixture-adoption` after execution. These are external review
documents, not new workflow output or release schema. Every referenced file uses
`{archiveId, path, bytes, sha256}`: an exact relative archive member, byte count and SHA-256 of exact
bytes. The retained location/copy index resolves archiveId. Inventory runtime/dependency closure and
symlink targets; an entry-point hash, Git OID or location alone does not establish restored closure.
Rehash materialized members and compare sizes, hashes and inventory against their attributed sources.
Reject unresolved references, conflicting target identities and absent review attribution. Hash final
review/decision record bytes externally; no record contains its own hash.

Input review names the independent reviewer/date, inspected reference set, disposition and trunk's
assigned command/input packet. Adoption separately names the execution reviewer/date and reviewed
bytes, then trunk authority/date, adopted or rejected decision, rationale and target-scoped decision
evidence. Reviewer/authority strings must resolve to retained review and decision bytes; nonempty
strings and syntactically valid hashes do not authenticate them. Only explicit reviewed trunk adoption
authorizes the selected target. Final release authority remains a separate human decision.

### Required adoption bindings

The adoption record retains these distinct groups, with exact references and source attribution:

1. Target, adapter, all quantities, content recipe hash, lifecycle protocol and
   `renewedMinimality: false`. Fixed quantity includes base commits. Scope is one target, never an
   implicit adoption of the whole matrix.
2. `historical`: calibration, selected manifest, environment and separately archived exact
   `HistoricalSelection` JSON; original product/harness OIDs and legacy revision; selected pilot and
   successful selection/behavior/statistics from the complete history. The old protocol describes the
   reviewed historical procedure, not merely a string differing from the new protocol.
3. `inputs`: completed input-review reference and execution-manifest bytes; restored legacy closure inventory,
   CLI/worker/shared assets, dependencies/lock, toolchain/system support; separately preserved new
   integrated harness OID, clean source/dependency/build/toolchain inventory, restoration verification,
   catalog/command/limits and environment. F2's old harness or disposable validation copies cannot
   stand in for this new harness.
4. `execution`: sealed schema-4 requalification artifact and execution inventory. Require
   `eligible-pending-trunk-adoption`, empty validation errors, unchanged statistical/behavior gates,
   embedded selection/environment/CLI/execution-manifest hash equality and all nine raw run
   identities. For every phase/iteration/state retain complete fixture links, ledger/boundary member
   references, instance/prepared digest, logical/filesystem identity, prepared-copy inventory and final
   pre-destruction boundary. Rehash archived bytes and use existing stored validators; no live Git
   lookup is required to review stored lifecycle evidence.
5. `supervision`: terminal `supervision-<id>.json`, supervisor ID, archived invocation and complete registered-root
   to instance mapping, and saved operator exit evidence from the same execution. Require completed
   status, worker exit 0/no signal, finishedCode 0, cleanupConfirmed true, no cleanup/finalization
   errors, saved diagnostics, disposal phase disposed and all required registered roots disposed.
   Missing required roots or incomplete mappings fail review. Prepared copies remain outside disposed
   roots. `terminalEvidenceSaved` is a return flag, not a serialized snapshot field: review the actual
   terminal file and any saved return/operator evidence. A barrier, running/recovery-inconclusive
   snapshot or lifecycle verified flag cannot substitute. Supervision does not itself hash the result;
   bind invocation, registration/events and instances, rather than assuming filenames establish it.
6. `review` and `decision`: independent input/execution review references and separate explicit trunk decision as above.
7. `authorizedUse`: working-manifest bytes with selected quantities/recipe/protocol and resolved
   artifactRef/environmentRef equal to reviewed eligibility/environment evidence; allowed
   runtime/harness/environment identities and comparison types. Later unrelated target edits need
   separately reviewed manifest authorization referencing the same adoption; do not replace the
   original authorized hash silently.

Seal execution before adoption. Construct the new working manifest from that sealed execution; it
points to eligibility/environment, not adoption. Adoption references execution and manifest, and a
later launch authorization references adoption's externally computed hash. Comparison archives and
release review point backward. Neither execution inventories nor mutually hashing records refer to
future adoption. New comparison instances/layouts have their own identities: compatible
quantity/recipe/protocol does not mean reusing the eligibility repository or filesystem device.

### Temporal gates

| Gate               | Required review and authority                                                                                                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before eligibility | Independent input review verifies historical bytes/selection, fixed quantity/recipe, restored legacy closure and newly preserved harness/environment/limits; trunk assigns one exact hash-bound command packet. No successful result is required before it exists.                                             |
| After eligibility  | Seal the entire attempt including terminal supervision; independently review actual result, lifecycle, inventories and disposal. Return failed/inconclusive evidence without adoption. An eligible result permits a separate explicit scoped trunk adoption decision.                                          |
| Before comparisons | A separately reviewed trunk launch packet pins exact adoption bytes/hash, resolved working manifest, runtimes, harness and environment. Review these inputs before launch; each capture/comparison produces fresh-instance evidence and completed supervision. Preserve every unsuccessful attempt separately. |
| At release         | Bind adoption and execution to final-candidate dossiers through existing attestations under the build/release guide, including explicit release-authority approval of the qualification dossier's calibration role.                                                                                            |

No renewed minimum search, threshold change, favorable-sample retry, cold-cache claim, historical
manifest rewrite or automatic acceptance update follows eligibility. Future empirical work requires
its own assigned packet; implementation acceptance is not empirical acceptance.

### Manual enforcement limits

Supported commands do not authenticate external evidence or prevent unauthorized launch. For example,
copying a complete historical target and supplying the new protocol string plus nonempty artifact/
environment references can pass manifest routing without opening eligibility, supervision or adoption.
Similarly, internally consistent release IDs/OIDs/recipes with arbitrary syntactically valid archive
hashes and reviewer strings can pass schema-1 structural checks. External review must reject missing
or substituted adoption/bytes in both cases. These are the accepted reviewer-authority limits, not
proof of authorization by commands or by the blocked acceptance record. Do not imply automatic
preflight or archive verification exists. A concrete contract contradiction returns to trunk with its
failure path rather than silently introducing new enforcement machinery.
