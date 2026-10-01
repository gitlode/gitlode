# M2 terminal styling: independent review request

## Assignment and pinned scope

Trunk should assign an independent reviewer for the completed styling implementation. This document
is a request, not a review result or M2 acceptance. Read the repository AGENTS.md and the
[return packet](opentelemetry-m2-terminal-styling-design.md) first.

- Source branch: `feature/otel-redesign_M2_styling`
- Intended return base: `feature/otel-redesign_M2_profile`
- Entry/base OID: `76486d25870172528ce9af086ace756388b6c8d8`
- Implementation review OID: `f0558856f018f24b5766d6ed8b5d241f9cb02747`
- Review the full entry-to-implementation diff, not just the final cleanup commit.
- This request and its return-packet update are a subsequent documentation-only delta. Record the
  actual documentation tip and verify that it introduces no production/test/configuration changes.
  Do not attribute the implementation OID's test results to a later OID without checking its delta.

Use an isolated checkout if necessary; preserve the human's worktree and all source refs. Review is
read-only: return findings and proposed corrections rather than silently changing the implementation.
No PR creation, publishing, merge, force push, base-ref update or branch deletion is authorized here.
Only the human merges; PR creation requires separate approval naming source and base.

## Review focus

Review against the adopted contracts, not against a new preferred palette. Start with
[CLI styling](../design/cli.md), [telemetry](../design/telemetry.md),
[verification](../design/telemetry-verification.md), [profiling](../profiling.md), and the
[profile view catalog](../design/telemetry-catalog/profile-view.yaml).

1. Shared styling and all consumers: role renames, independent attributeName, undecorated values,
   heading padding, ANSI-free output, completion/progress/diagnostics and Profile consistency.
2. `reporting/profile-*.ts` and presenter integration: streaming order, empty output, progress
   interruption, error propagation and collecting-adapter equivalence. Check for dropped, duplicated
   or misassociated measurements and diagnostics during preparation/rendering.
3. Flat default (`namespaceDepth: 0`) and retained optional grouping: depth bounds, short names,
   namespace/entry collisions, ordering and styles selected solely by display depth. h3/h4 apply to
   the first two levels below Scope; deeper levels are undecorated. Do not remove grouping.
4. Maintainability refactor: observation identity brand versus display strings, readonly inputs,
   helper responsibilities and comments. Verify the intended behavior preservation independently.
5. Tests/catalog/docs: coverage of flat and grouped output, catalog default/constraint validation,
   compact number-unit tokens, stale role references, and consistency of durable contracts.
6. Cleanup: deleted preview/capture helpers have no live consumers; historical commands are clearly
   archival. Maintained production parameters and regression tests must remain.

Human visual approval covers Profile in Windows Terminal 1.24.11911.0, Campbell/Tango Light,
Cascadia Mono. See the return packet for source checkpoints. It is not evidence for every shared
consumer or terminal. GNOME Tango dark/light remain unobserved; do not prepare a VM or reinterpret
WSL in Windows Terminal as a second renderer. Real repository selection belongs to the human.

## Validation evidence and instability to report to trunk

At the implementation review OID, Windows root tests passed 95 files / 1277 tests with 17 skipped.
Format, dependency consistency, lint, architecture, schema, release build, strict publint and the
installed-package tests passed. Initial package validation required a permissions retry after
sandbox npm-cache EPERM; that was not a package assertion failure.

[GitHub Actions run 36805528460](https://github.com/gitlode/gitlode/actions/runs/36805528460)
tested the same implementation OID on all three attempts:

| Attempt | Job                                                                                          | Result                                                                                                                                                                         |
| ------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1       | [110188893375](https://github.com/gitlode/gitlode/actions/runs/36805528460/job/110188893375) | `release-acceptance.test.ts`, `rejects unknown and wrong-scope checks`: `ENOTEMPTY` removing `/tmp/gitlode-release-acceptance-DNM8KB/.git/objects/pack` during fixture cleanup |
| 2       | [110189713245](https://github.com/gitlode/gitlode/actions/runs/36805528460/job/110189713245) | `performance-supervisor.test.ts`, `kills an owned grandchild that ignores TERM when the worker exits first`: expected process state `missing` or `Z`, observed `R` at line 228 |
| 3       | [110190206529](https://github.com/gitlode/gitlode/actions/runs/36805528460/job/110190206529) | All 95 files / 1294 tests passed; release build, strict publint and installed-package tests passed                                                                             |

**Trunk must retain these two failures as unresolved observations discovered in this styling
session. Whether this session's changes caused or contributed to them is unknown.** The two test
files were not changed in the entry-to-implementation diff, but that alone does not establish absence
of an indirect regression. Unchanged-source retries passed; neither a root cause nor a fix has been
established. Do not describe these as resolved, proven pre-existing, or harmless.

The earlier Windows run at the catalog-fix stage also encountered a repository-fixture timeout
and EBUSY cleanup before a full rerun passed, as recorded in the return packet. This is separate
from the catalog validator defect, which was fixed and confirmed by the human.

Trunk should track the instability and decide whether focused Linux reproduction and process/fixture
lifecycle investigation is needed before acceptance. The reviewer should assess possible coupling to
this diff and flag concrete evidence; do not silently broaden the styling review into performance
harness or release-acceptance redesign. A successful retry does not replace this follow-up.

## Expected review response and next steps

Return the exact reviewed OIDs, checks actually run, and findings ordered by severity with file/line,
trigger, impact and a concrete suggested correction. Distinguish correctness findings from optional
maintenance suggestions, visual evidence gaps and unresolved test instability. If there are no
blocking findings, say so explicitly without declaring M2/release accepted.

Trunk owns triage and any bounded correction assignment. Changed production code requires renewed
relevant verification and exact-source CI; visible changes may require another human display check.
After independent review, green final CI and human acceptance, trunk may prepare the explicit
source/base PR approval request. Post-squash content correspondence and cumulative M2 acceptance
remain separate steps. Preserve the styling branch.
