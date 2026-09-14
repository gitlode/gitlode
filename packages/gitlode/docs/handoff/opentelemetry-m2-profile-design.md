# M2 profile presentation: interactive design session

## Assignment and authority

Use a separate human-started conversation for collaborative design, not autonomous implementation.
The human wants to compare v0.12.0 and the current v0.13.0 implementation, understand the problems,
explore improvements beyond restoring the old display, then converge on an implementable design.
Do not force early scope selection or treat every brainstormed idea as an accepted requirement.

Trunk owns the overall M2 dependencies, release obligations and subsequent implementation assignments.
This session owns profile presentation analysis and detailed design in dialogue with the human.
Record explicit human decisions here so trunk can adopt them without requesting the same approval
again. Return implications for other domains, release gates or milestone scope to trunk explicitly.
Do not infer acceptance from silence or from a request to explore an alternative.

Current source reference: `6a212f86b6586f5cd2876fec69b2804c295e2dfd` on
`feature/otel-redesign_M2`. This packet's later documentation checkpoint does not change that source.
Legacy reference: v0.12.0 at `76b124e23fcc069be1278629cf01b62ae1456c7a`.
Verify actual HEAD and worktree at entry; identify subsequent differences rather than assuming these
are still the live tips. A separate conversation need not create a separate Git branch: documentation
may remain on M2 while no other writer uses that worktree. This assignment creates no implementation
branch and authorizes no push, PR, merge, branch deletion or formal measurement.

## Reading and comparison inputs

Read `AGENTS.md`, the [M2 plan](instrumentation-opentelemetry-recovery-plan.md),
[profiling guide](../profiling.md), telemetry design's report/presentation and failure-isolation
sections, and verification's presentation section. Read architecture/domain guidance only as the
proposed design requires it. Relevant current source is under `src/presentation/reporting/`,
`src/presentation/success-report.ts` and `src/execution/telemetry/profile-report-builder.ts`;
the canonical display metadata is `../design/telemetry-catalog/profile-view.yaml`.
Inspect legacy source at its fixed revision rather than reconstructing its appearance from memory.

Use the existing [M0 environment/evidence](opentelemetry-m0-result.md) and
[M1 preserved packages](opentelemetry-m1-validation-result.md) when useful. Preserve sealed archives;
any new extraction/build/capture uses a separate temporary workspace. Compare similar workloads,
options and terminal conditions, and label differences that prevent direct comparison.

Start with a small representative comparison that the human can actually read. Expand to commit,
file and plugin workloads and complete/partial/unavailable data as the discussion needs them.
Record whether an example is captured CLI output, a rendering of a saved report, or a synthetic mockup.
Synthetic exceptional states are useful but must not be described as observed product failures.
Small functional output captures are allowed; this is not calibration or performance acceptance.
If capture/setup would be lengthy, explain the external work and use a bounded command with retained
failures. Do not launch a full test or benchmark matrix merely to obtain presentation examples.

## Conversation process

1. Compare actual old/current output and ask what the human uses profiling to understand. Distinguish
   information lost, information obscured by layout, and changes in the underlying observation model.
   Similar labels do not prove that old/new timing or counts have the same meaning.
2. Explore alternatives with concrete text mockups. Examples might include an overview followed by
   detail, domain-oriented grouping, signal-oriented detail, or showing detail selectively. These are
   discussion prompts, not a prescribed UI. Consider wider ideas before deciding their milestone.
3. Periodically summarize agreements and unresolved tradeoffs. Classify ideas as selected for M2,
   deferred for future consideration, declined, or still open, with short reasons. The old output is
   a comparison reference, neither a mandatory minimum layout nor the ceiling of the redesign.
4. Once the human is ready to converge, produce the detailed design and an implementation breakdown.
   Do not declare completion while material display behavior remains implicitly undecided.

Ask a small number of concrete questions at a time. Avoid an initial questionnaire covering every
possible option. Show examples before asking the human to choose abstract presentation policies.
Keep one evolving design/decision artifact, not a transcript or a new packet per round.

## Design boundaries and completion evidence

The existing M2 gate requires readable representative commit/file/plugin output, including partial
and unavailable states, reviewed by the human. Current runtime behavior includes stderr output,
success-only profile display, quiet suppression, local OTel collection and a structured ProfileReport.
These describe the baseline, not a ban on discussing changes. Any proposed CLI/visibility/report or
recording change must be explicit, human-decided and returned with its scope/dependency consequences;
do not silently incorporate it as formatting cleanup. Keep product facts, JSONL, checkpoints and
application failure semantics intact. Do not invent unavailable observations or present overlapping
span durations as additive exclusive work without a justified definition.

The final design should be sufficient for a new implementation conversation without replaying the
discussion. Include:

- the observed old/current problems, representative examples and their provenance;
- the diagnostic questions the display answers, selected reading order and concrete output examples;
- grouping, labels, units, missing/zero/partial/unavailable data and diagnostic behavior, to the degree
  needed by the selected design; plugin/unknown observations and long labels must remain interpretable;
- a mapping from displayed information to existing report fields, identifying any data-model gap;
- human-approved M2 scope, deferred ideas with reasons, and unresolved cross-domain decisions;
- bounded implementation slices, affected documentation and meaningful verification/acceptance checks.

Do not redesign collectors, recording APIs or the report schema merely to simplify a mockup.
If a useful idea needs those changes, explain it and classify its scope with the human. Broad OTel
refactoring, external export, tests/system implementation and formal T13B remain separate work.

## Files, checkpoints and return

During design, update this document with concise findings and decisions; do not implement production
or test changes. Keep canonical docs describing current behavior until implementation or an explicit
separate decision requires a contract update. Temporary render experiments must be isolated and not
committed as production changes. Save meaningful documentation checkpoints after format write/check
and diff checks; checkpoint status must distinguish a draft from human-approved design.

Return the final checkpoint, example locations/provenance, human decisions, M2/deferred scope,
implementation slices and any remaining trunk decisions. Human starts/stops the conversation and
reports completion to trunk. Design completion is not M2 acceptance or PR permission.

## Current design state

Not started. The process and references above are an assignment; no display option has been selected.
