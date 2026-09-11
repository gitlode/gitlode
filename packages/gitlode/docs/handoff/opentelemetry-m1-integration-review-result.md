# M1 cumulative integration review and merge rehearsal result

## Outcome

The cumulative redesign at proposed source
`134e475b2de9559007e11fb724298395f832c6cf` is accepted for fast-forward integration from the
reviewed local base `745d3d553e7ddbea430993602ddaa36fe816dfc4`. No concrete cumulative interaction
defect or M1 integration blocker was found. An isolated-clone `--ff-only` rehearsal produced the
exact proposed source commit and tree.

This result accepts the reviewed integration shape; it does not perform the shared-branch merge or
complete M1. It does not accept the remaining T13B/M2/T13C obligations, authorize publishing, or
constitute formal performance evidence. No shared integration/redesign ref, release-acceptance
record, production source, test, workflow, manifest, lockfile, package, or archived candidate was
changed during review. No Version PR, publisher-capable command, formal calibration, or formal
measurement was run.

## Planning checkout and refs

Review began on branch `feature/otel-redesign_T13B` at
`723d9569cd38c7c2a5c9e7df43b7f50eb2d487d9` with a clean worktree. The observed shared-repository
refs were:

- `integration/v0.13.0`: `745d3d553e7ddbea430993602ddaa36fe816dfc4`;
- `feature/otel-redesign`: `5a6a810b8621759fb9723d0617aabdf1fbbac631`; and
- `feature/otel-redesign_T13B`: `723d9569cd38c7c2a5c9e7df43b7f50eb2d487d9`.

The locally cached `origin/integration/v0.13.0` was
`1664798a9f586b1ac4e632d02d3a37cb0c6ebf0d`, while the local integration branch was the reviewed
`745d3d5...`. An uncredentialed read-only `git ls-remote` attempt could not connect to GitHub from
the review environment. Therefore neither cached tracking ref nor this review confirms the current
remote head. The integration executor must refresh or otherwise verify the authoritative ref before
acting.

## Cumulative source review

The reviewed merge base is the integration OID itself. `integration/v0.13.0` is an ancestor of the
proposed source, so the source contains the full cumulative redesign rather than only the final T13B
tail. The cumulative diff is 222 files, with 39,348 insertions and 2,967 deletions. Review followed
the accepted slice evidence while inspecting the interactions introduced by the combined result.

The combined source remains aligned with the canonical architecture and telemetry contracts:

- generic OTel lifecycle support is in `internal-foundation/otel-support`, gitlode observation and
  report policy is in `internal-contracts/telemetry`, domain recorders remain with their operation
  owners, and SDK imports remain confined to the execution telemetry implementation;
- every workspace that directly imports `@opentelemetry/api` declares it, while
  `internal-contracts` and official plugins do not acquire an unnecessary direct API dependency;
- no cross-workspace source deep import, legacy instrumentation export or legacy custom
  instrumentation contract, `ProfileSummaryEntry`, or `StageProfiler` implementation remains
  outside historical documentation;
- worker composition creates one run-scoped session, keeps the root observation active through
  application resource disposal, finalizes telemetry best-effort afterward, and transports only an
  SDK-independent `ProfileReport`;
- checkpoint persistence remains in main-process execution after successful worker output, so the
  telemetry lifecycle does not advance state or change extraction result classification;
- extraction, Git/DAG, line-diff, output, and plugin recording points preserve their distinct
  operation ownership and partial-effect rules; and
- release packaging keeps the CLI, worker entry, public declarations, private-workspace bundling,
  and external OTel runtime dependencies consistent with the installed-package contract.

The supported Changesets paths converge as intended: root `release` runs functional validation and
then the guarded `changeset:publish`; that command runs the telemetry acceptance validator before
`changeset publish`; and the Actions publish callback remains `npm run release` with complete Git
history requested. Ordinary CI, release building, and Version PR creation remain independent of the
migration gate. The live acceptance record is still exactly `blocked`.

## Candidate identity and document-only delta

The validated/frozen source and harness are
`681a1a5b53bd0aa957dae72d9fd9684da7ff467a`, tree
`a6c7389940a12ef347706f7b5453a6e348281175`. The proposed integration source has tree
`54314b434e83e17af59925d00ba44cdcf0a9495c`. Their complete file-level difference is exactly these
seven handoff documents:

- `instrumentation-opentelemetry-recovery-plan.md`;
- `instrumentation-opentelemetry-redesign-plan.md`;
- `opentelemetry-m1-cumulative-validation.md`;
- `opentelemetry-m1-g1-coverage-resolution.md`;
- `opentelemetry-m1-publish-gate-review.md`;
- `opentelemetry-m1-publish-gate.md`; and
- `opentelemetry-m1-validation-result.md`.

There is no code, package manifest, workflow, test, lockfile, acceptance-record, performance fixture,
or durable-design-contract delta after the validated implementation. The seven changes truthfully
record gate acceptance, cumulative validation, candidate preservation, and remaining work. A local
link check against the proposed source resolved all 32 relative document targets; referenced anchor
headings were also present. Diff whitespace checks passed.

Because the tested implementation and packaging inputs are unchanged, this review reuses the
accepted two-platform functional/package evidence instead of rerunning the same complete suite.

## Isolated merge rehearsal

The rehearsal used a fresh clone made from a newly created temporary complete Git bundle, not a
linked worktree or a clone sharing object alternates. The first attempt to clone the shared
repository directly was rejected by Git's ownership protection before a clone was created. The
preserved M1 validation bundle was then inspected, but it ends at planning tip `81fe902...` and
correctly does not contain the later proposed source, so it was not used as the rehearsal input.

The successful rehearsal was performed under
`C:\Users\T-WAKA~1\AppData\Local\Temp\gitlode-m1-integration-review-7bdbf86f358d4001b1d306bbf3913af6`.
The temporary review bundle SHA-256 was
`4aa664b006cb7b76be4b1e538c44f5884533336e121846199b6f5a7d3f9f5fd2`; `git bundle verify`
reported complete history. The clone had no object alternates and was clean before and after the
merge.

| Identity         | Commit OID                                 | Tree OID                                   |
| ---------------- | ------------------------------------------ | ------------------------------------------ |
| Base             | `745d3d553e7ddbea430993602ddaa36fe816dfc4` | `2ea52c9c1f1b14e0632d2927a2a1aa94051ab778` |
| Source           | `134e475b2de9559007e11fb724298395f832c6cf` | `54314b434e83e17af59925d00ba44cdcf0a9495c` |
| Rehearsed result | `134e475b2de9559007e11fb724298395f832c6cf` | `54314b434e83e17af59925d00ba44cdcf0a9495c` |

The merge base was the reviewed base. `git merge --ff-only 134e475...` succeeded without a merge
commit, conflict, or synthesized resolution. The result is byte-for-byte the proposed source tree.

## M1 conditions and evidence

| M1 condition                        | Evidence and disposition                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Result/JSONL/checkpoint equivalence | Reused accepted Windows/Linux execution of the deterministic behavioral suite at `681a1a5...`, including profile-off/on and frozen-output comparisons. Source-to-proposed delta is handoff-only. Accepted for M1 integration.                                                                                                                                                             |
| Failure isolation                   | Reused the full two-platform suite, including worker initialization/finalization/collection failure paths and application/extraction failure cases. Cumulative lifecycle inspection found no interaction defect. Accepted for M1 integration.                                                                                                                                             |
| Operation ownership                 | Accepted owner slices plus executed Git adapter, DAG, extraction, line-diff, output, plugin lifecycle/projection, and recorder/no-op tests cover the cataloged owners. Combined import and wiring inspection found no duplicate or cross-owner implementation dependency. Accepted for M1 integration.                                                                                    |
| Windows functional/package checks   | Complete rerun of `npm run validate:release` passed at `681a1a5...`: 91 files, 1,184 passed and 17 expected Linux-only skips of 1,201 tests, followed by release build, strict packed metadata, and installed-package scenarios. The earlier environment-caused 2-test failure is retained separately and was not credited. Reused because implementation is unchanged.                   |
| Linux functional/package checks     | `npm run validate:release` passed at `681a1a5...`: 91 files and all 1,201 tests passed with no skips, including Windows-skipped supervision/workflow cases; release build, strict packed metadata, and installed-package scenarios passed. Reused because implementation is unchanged.                                                                                                    |
| Installed-package behavior          | Both platforms exercised CLI/worker, both Git adapters, line diff, dynamic plugin, schema, and a NodeNext TypeScript consumer. Platform-specific package hashes remain distinct and bound to their tested bytes. Accepted for M1 integration.                                                                                                                                             |
| Domain placement/navigation         | The exact ten-file domain-local placement at `97235c3...` was independently accepted, with unchanged public names/semantics and no relaxed Rev-dep rule. Cumulative inspection confirmed nested `telemetry/` groups remain owner-local and navigation points to canonical contracts. Accepted for M1 integration.                                                                         |
| Frozen identity/dependencies        | Fixed source/harness `681a1a5...`, lockfile hash, Windows/Linux tarballs, production dependency inventory, and complete sealed Linux runtime are preserved under the M1 archive. Proposed source changes only seven handoff files. Accepted for candidate preservation and reuse.                                                                                                         |
| Known performance findings          | M0's `commit_heavy_repository/isomorphic-git` target passed calibration, legacy capture, disabled overhead, and profile overhead for older product `a97829b...`/harness `a53a5b8...`. No known performance failure is being hidden, but this is partial evidence for an older candidate and is not M1-candidate or full T13B acceptance. Remaining performance work stays blocked for M2. |
| Enforceable blocked publishing      | Gate G1/G2 and the full slice were independently accepted at `681a1a5...`; focused tests/typecheck passed on both validation platforms. The committed record remains `blocked`, root supported publish commands converge on the validator, and the release checkout requests full history. Accepted for M1 integration; publishing remains unauthorized.                                  |
| Actual integration result           | Isolated `--ff-only` rehearsal passed with exact source/result OID and tree. The shared `integration/v0.13.0` ref was not changed, so M1 is not complete.                                                                                                                                                                                                                                 |

## Archive checks independently performed

The preserved archive is
`D:\gitlode_test\m1-20260911T052245Z-681a1a5`. This review independently computed
`evidence.sha256` as `7454ed104bfeb89ce401ff88156e5a261fd22c64608a21d1dce94119c2e4bb08` and confirmed
that it indexes 40 files. It separately recomputed hashes for the candidate bundle, both platform
packages, the complete Linux runtime archive, the accepted M0 manifest, and the uncalibrated M1
manifest; all matched the recorded identities.

The command ledger, environment/identity record, full Linux validation tail, both Windows validation
attempt tails, both focused gate logs, and both blocked-gate logs were inspected. They preserve the
required distinctions:

- the first Windows composite stopped at 89 passing/2 failing files and did not receive credit for
  downstream package checks;
- the corrected complete Windows rerun passed 91 files with 1,184 passes and 17 skips;
- Linux passed all 1,201 tests, including the Windows-skipped cases;
- Windows and Linux package SHA-256 values differ and are recorded separately; and
- direct gate validation failed closed on both detached validation checkouts without invoking a
  publisher.

The archive's own verification log reports all 40 indexed files as `OK`; the planning owner had
already verified all entries. This review did not redundantly recompute every large log and manifest
hash, extract the sealed runtime again, or rerun the functional/package suite.

## Remaining M2 blockers

The merge must preserve these explicit blockers; none is waived by this acceptance:

- complete all five target calibrations and legacy captures, ten comparisons, aggregation N/4N,
  repository profile validity/size/prohibited-span checks, applicable Git command parity, behavioral
  checks, and review any complete exception proposal;
- complete human profile-readability review for representative and partial/unavailable output;
- stage the first private `tests/system` release-CLI migration and finish contributor navigation;
- validate the actual final release candidate on Windows and Linux, including installed packages,
  bundle identity, and reviewed delta from the frozen M1 candidate;
- accept T13B, complete T13C, move stable facts to durable documentation, remove temporary handoffs,
  and explicitly approve release authority; and
- change the migration acceptance record only after all required independent evidence exists.

## Safe merge recommendation

The integration owner may fast-forward the shared `integration/v0.13.0` branch to exactly
`134e475b2de9559007e11fb724298395f832c6cf`, but only after a final authoritative ref and worktree
check confirms that the integration tip is still exactly
`745d3d553e7ddbea430993602ddaa36fe816dfc4`, remains an ancestor of the source, and has no local
changes. Use `--ff-only`; do not merge only the final T13B tail, substitute the later planning tip,
or resolve a changed base under this review acceptance.

After the action, record the actual HEAD and tree and confirm they are respectively
`134e475b2de9559007e11fb724298395f832c6cf` and
`54314b434e83e17af59925d00ba44cdcf0a9495c`. If any ref, ancestry, source, or tree differs, stop and
return for reconciliation and validation of the actual result. Only the completed reviewed merge
may close M1; all post-M1 work must then branch from the updated integration branch while the blocked
publishing record and M2 obligations remain intact.
