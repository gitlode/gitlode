---
description: Development workflow for human–LLM collaborative release cycles — session types, lifecycle stages, artifacts, and role expectations
---

# Development Workflow

## Purpose & Scope

This document defines the end-to-end development workflow for release cycles executed through human–LLM collaboration.

It is **product-agnostic**: the workflow, session types, artifacts, and role expectations described here are not specific to any single codebase. Product-specific conventions (coding standards, tech stack, architecture) belong in project-level instruction files, not here.

The primary audience is LLMs operating within the workflow. The document is also intended to be readable by humans onboarding to the same process.

## Operating Model

This workflow is designed for **human-authorized, LLM-executed collaboration**.

The core operating rule is:

> The human authorizes transitions between workflow steps. The LLM may act autonomously only within a step that has already been authorized.

This workflow is therefore **not** a specification for fully autonomous development. It is designed to preserve human judgment at step boundaries while still allowing the LLM to execute substantial work within an active step.

### Goals of this workflow

- Eliminate ambiguity about what to do at each stage — for both human and LLM.
- Ensure LLMs can autonomously execute implementation sessions with minimal mid-session design judgment.
- Enable LLMs to detect and flag omissions or inconsistencies that a human might overlook.
- Produce a repeatable process that can be adopted across different projects.

## Global Gate Rules

Human-authorization points in this workflow are represented as **completion conditions of named steps**, not as optional reminders embedded inside a step description.

These rules apply to every gate in this workflow unless a narrower local rule explicitly adds more constraints.

1. **A gated step is not complete until the required human response is received.** Producing a summary, recommendation, or draft does not by itself authorize the next step.
2. **Only explicit responses matching the gate's listed valid responses count as authorization.** By default, this workflow expects the human to reply using the stated number or option label.
3. **Ambiguous confirmations are invalid.** Replies such as "continue", "proceed", "next", "looks good", or "yes" do not satisfy a gate unless the gate explicitly lists them as valid responses.
4. **If the human response is ambiguous, omitted, or out of scope, the LLM must ask again and must not perform work from the next gated step.**
5. **A message that presents a gate must stop at that gate.** The LLM must not ask the question and then continue into the next gated step in the same response.
6. **General project-level autonomy guidance does not override workflow gates.** If `copilot-instructions.md` or another higher-level instruction favors autonomous execution, the gate rules in this workflow still control transitions between workflow steps.
7. **Stopping at a gate is a correct completion state.** In this workflow, completing the current authorized step and waiting for the human is successful behavior, not hesitation or failure.

---

## Document Ecosystem

The workflow relies on several document types. Each has a distinct role within the information flow.

```
roadmap.md          Long-horizon backlog. Items are added at any time.
    │
    ↓  (select items for a release)
plan.md             Release-level plan for the current release only.
    │
    ↓  (one file per phase, current release only)
plans/              Phase files: detailed design per phase (phase-template format).
    │
    ↓  (referenced by phase Design References)
*.instructions.md   Technical specifications: architecture, CLI, schema, traversal, etc.
    │
    ↓  (after release)
CHANGELOG.md        Released history.
```

| Document                         | Mutability during a release                                                        | Primary consumer                                               |
| -------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `roadmap.md`                     | Append-only (new items); existing items may gain standardized metadata annotations | Planning trunk session                                         |
| `plan.md`                        | Current release only; overwritten at the start of a new release planning cycle     | All sessions                                                   |
| Phase files (`plans/phase-N.md`) | Current release only; frozen before implementation; removed during release cleanup | Branch session (one phase), development trunk session (review) |
| `*.instructions.md`              | Updated during planning when phase design requires spec changes                    | Branch session, planning trunk session                         |
| `copilot-instructions.md`        | Rarely changed; project-level conventions                                          | All sessions                                                   |

### `plan.md` structure

`plan.md` contains **release-level context only**. Phase design detail lives in individual phase files under `plans/` for the current release only.

When creating a new `plan.md`, use the following structure:

```markdown
# {project} — v{X.Y.Z} Release Plan

## Overview

Brief description of the release: target version, relationship to prior releases,
breaking-change policy, and primary focus areas.

## Release Goals

- (concise goal statements — what the release achieves for users or the codebase)

## Scope Summary

### Included in v{X.Y.Z}

- (one-line summary per included item)

### Explicitly excluded from v{X.Y.Z}

- (items considered but deliberately deferred)

## Development Phases

### Phase 1: {Title}

- **File**: [`plans/phase-1.md`](plans/phase-1.md)
- **Status**: Planned | In progress | Completed

### Phase 2: {Title}

- **File**: [`plans/phase-2.md`](plans/phase-2.md)
- **Status**: Planned | In progress | Completed

(repeat for each phase)

## Release Tasks

### Documentation Update

- **Status**: Planned | In progress | Completed
- (list of documentation deliverables: changelog, README, docs/, migration notes)
- (roadmap cleanup: remove entries with `Release target: v{X.Y.Z}` that were implemented)

### Verification

- (release-level verification commands and checks)

## Final Verification Checklist

(to be filled when all phases are complete)
```

**Authoring notes**:

- The Phase List entries contain only the phase title, a link to the phase file, and the current status. No design detail.
- The Release Tasks section contains release-specific deliverables and verification work.
- The Final Verification Checklist is filled after all phases and release tasks are complete, as a last gate before handoff to the human for the release operation.

### roadmap.md structure

roadmap.md is a **long-horizon backlog**. It captures ideas, improvement candidates, and deferred items at any fidelity level — from a single-sentence note to a multi-paragraph design sketch with candidate approaches.

Unlike plan.md and phase files, roadmap.md does **not** have a rigid section template. Detailed design is the responsibility of the planning phase; the roadmap intentionally permits loose, exploratory writing so that early-stage ideas are not inhibited by structural overhead.

**Required elements**:

- **Preamble**: A short description of what the roadmap covers and how it is organized (e.g. by priority/time horizon, not by release version).
- **Metadata convention**: Define how roadmap metadata is written. When metadata is used for an entry, place it immediately below the entry title and before the body content as a bullet list. The standardized metadata labels are `Release target` and `Depends on`. Projects may add additional metadata labels when useful, but the standardized labels should appear first when present.
- **Grouping**: Organize items into sections that reflect evaluation priority. A recommended grouping is by time horizon (Near-term / Medium-term / Long-term), but project-specific groupings (by domain area, by component) are acceptable as long as the grouping rationale is stated in the preamble.

**Entry format** (flexible):

- Each entry is a heading (typically `####`) with a descriptive title.
- If metadata is present, list it immediately below the title and before the body content.
- Body content ranges from a single sentence to a detailed problem statement with candidate approaches — whatever level of detail is useful at the time of writing.
- The standardized metadata labels are:
  - `Release target: vX.Y.Z` — added when an item is selected for a release during planning (Stage 1b).
  - `Depends on: <entry title>[, <entry title> ...]` — used when an item depends on one or more other roadmap entries.
- Standardized metadata may be omitted when not applicable. Additional project-specific metadata may be added after the standardized metadata lines.
- When design decisions are resolved during planning, optionally add a **Design resolution notes** block summarizing key choices.
- Completed items are cleaned up during release tasks (Stage 3), not during planning.

**Guidance for LLMs**:

- When suggesting new roadmap entries, match the tone and depth of existing entries in the file.
- Do not enforce a uniform structure across entries — some will be detailed, others deliberately terse.
- When adding metadata, place it directly below the entry title, use the standardized labels exactly, and keep any project-specific metadata after the standardized labels.
- During planning (Stage 1b), treat roadmap entries as input material, not as binding specifications. Re-evaluation is expected.

### Phase file structure

Each phase file uses the format defined in [phase-template.instructions.md](phase-template.instructions.md), lives under `plans/` as `phase-N.md`, and follows that document as the authoritative reference for section structure and fill-in timing.

### Deferred design

The default rule of this workflow is that a phase reaches **implementation-ready** design maturity during Stage 1 and then remains stable through Stage 2.

An exception is allowed when a later phase depends not merely on the intended design of an earlier phase, but on the **implemented shape** that becomes visible only after that earlier phase is built and reviewed. This workflow calls that state **deferred design**.

Deferred design is a controlled planning state. It allows a bounded remainder of design work to move to a later pre-implementation step without treating the phase as implementation-ready. It may be used only when all of the following are true:

- the phase depends on implementation evidence from one or more predecessor phases
- the unresolved portion cannot be reduced during planning to a stable interface, invariant, or other contract that would make the phase implementation-ready
- the still-open choices can be bounded explicitly in the phase file rather than left as vague TBDs
- delaying those choices to a dedicated pre-implementation design step is more correct than forcing speculative decisions during Stage 1

Deferred design should not be used to compensate for missing analysis, weak phase boundaries, or alternatives that simply have not been reviewed yet.

When a phase is marked as deferred design:

- the phase file must still define the phase purpose, fixed constraints, non-goals, predecessor dependency, refinement trigger, and the exact deferred design items
- planning must resolve everything that can already be resolved and defer only the bounded remainder
- the deferred decisions must be reopened in a dedicated **design refinement session** during Stage 2, before any implementation branch session begins
- a development branch session must not implement from a phase file that is still marked as deferred design

---

## Session Types

Five session types are used throughout a release cycle. Each has a defined lifespan, responsibility scope, and context boundary.

In this document, **planning sessions** refers to the combination of planning trunk session and planning branch session.

| Session type                   | Lifespan                                                 | Responsibility                                                                                                                                  | Context sources                                                                                                                |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Planning trunk session**     | From release intent to planning completion               | Scope decision, phase decomposition, starting prompt preparation for branch sessions, cross-phase consistency review, instructions file updates | roadmap.md, plan.md, phase files, instructions files                                                                           |
| **Planning branch session**    | Single-phase design task                                 | Focused design work for a complex phase, isolated from the full planning scope                                                                  | plan.md (overview only), target phase file, relevant instructions files                                                        |
| **Design refinement session**  | Single deferred-design phase before implementation       | Finalize deferred design from predecessor implementation evidence; update the phase file                                                        | plan.md (overview only), target phase file, predecessor phase artifacts, relevant instructions files, current repository state |
| **Development trunk session**  | Entire implementation cycle (all phases + release tasks) | Pre-execution checks, starting prompt preparation and handoff, result review, release tasks                                                     | plan.md, all phase files, design refinement summaries, branch session summaries                                                |
| **Development branch session** | Single phase implementation                              | Implementation, testing, verification                                                                                                           | plan.md (overview only), target phase file, relevant instructions files, starting prompt                                       |

### Context boundaries

- A **branch session** (planning or development) should receive only the phase file it is working on, plus release-level context from plan.md. Other phase files are excluded to minimize noise.
- A **design refinement session** should receive only the target deferred-design phase, the minimum predecessor artifacts needed to resolve the deferred decisions, and release-level context from plan.md.
- The **planning trunk session** holds the cross-phase design view during Stage 1.
- The **development trunk session** holds the cross-phase execution view during Stage 2 and Stage 3.

### Context handoff between sessions

When a session produces a handoff artifact that the human will copy into another session as chat content, place the handoff body first in the message without any wrapper prose, delimiter lines, or code fences around it.
This keeps the handoff artifact directly copy-pasteable from the top of the message without manual cleanup.

If supplemental notes for the human are necessary (e.g. a significant risk that arose, a decision that warrants human review before the next session starts), append them after the handoff body separated by `---` and a `## Notes for Human` heading. Do not embed notes inside the handoff body itself.

This rule applies to starting prompts produced for planning branch sessions, design refinement sessions, and development branch sessions, and to summaries that are intended to be copied into another session.

- **Planning → Development trunk**: plan.md and phase files are the handoff artifacts. No copy-paste or verbal summary is needed — the documents are the contract.
- **Planning trunk session → Planning branch session**: Planning trunk session produces a starting prompt for the target phase design task.
- **Planning branch session → Planning trunk session**: Branch session writes the detailed design directly into the target phase file and returns a structured Planning Branch Session Summary for unresolved questions, dependency notes, rationale, completion signaling, and other planning observations that do not belong in the phase file itself. Human copies the summary into the planning trunk session. The planning trunk session then reviews the updated phase file and summary together, checks for cross-phase and plan-level consistency, and finalizes the phase design and any affected instructions files as needed.
- **Development trunk → Design refinement session**: When a phase is marked as deferred design and its refinement trigger is satisfied, the development trunk session produces a starting prompt for the refinement session.
- **Design refinement session → Development trunk**: Refinement session resolves the deferred design directly in the phase file, updates any affected instructions files, and returns a structured Design Refinement Session Summary.
- **Development branch → Development trunk**: Branch session produces a structured summary (see Branch Session Summary below). Human copies the summary into the development trunk session.
- **Development trunk → Development branch**: Development trunk session prepares a starting prompt during Stage 2b and hands off that prepared prompt in Stage 2c (see Starting Prompt below).

---

## Development Lifecycle

### Stage 0: Roadmap Management

**When**: Any time, independent of release cycles.
**Who**: Human (primarily), LLM (may suggest entries).

- Add new ideas, improvement candidates, and deferred items to `roadmap.md`.
- No formal review required. Entries are low-commitment by design.

---

### Stage 1: Release Planning

**Session**: Planning trunk session.

#### 1a. `plan.md` preparation

Before starting any planning activities, bring `plan.md` to a clean state for the new release. `plan.md` is a single file that is overwritten at the start of each planning trunk session. Determine its current state and act accordingly:

1. **No `plan.md` exists** (first planning trunk session ever): Create `plan.md` from scratch using the template in the "`plan.md` structure" section above. Fill in the new version number; leave all content sections as empty stubs to be filled during 1c–1e.
2. **`plan.md` contains a completed prior release** (all phases marked Completed and the Final Verification Checklist cleared): Overwrite `plan.md` with a fresh skeleton for the new version. The prior release's record is already captured in CHANGELOG.md; retaining stale content adds noise without value.
3. **`plan.md` contains an incomplete or in-progress prior release**: Escalate to human before proceeding. Do not overwrite `plan.md`.

The resulting skeleton must contain: the new version title, empty stubs for Overview, Release Goals, Scope Summary, and Development Phases, and the **canonical Release Tasks template** (see note below). The Final Verification Checklist is an empty stub.

> **Release Tasks template note**: When creating the skeleton, keep the canonical Release Tasks template intact and copy it forward instead of replacing it with an empty stub.

---

#### 1b. Release intent

Human provides the release intent — a brief statement of the release's character and ambition level, along with the target version number (vX.Y.Z). Examples:

- "v0.1.5 — Patch release: small fixes and internal cleanup only"
- "v2.0.0 — Major release with breaking CLI changes to stabilize the interface"

The version number and intent together set the constraint frame for all subsequent scoping decisions.

#### 1c. Scope and item selection

Pick items from `roadmap.md` for the release. Sources of items:

- Human specifies must-have items.
- LLM proposes additional items based on: version semantics (major/minor/patch), synergy between items (shared code changes, reduced total diff), and item maturity (well-specified vs. exploratory).
- Items not in roadmap.md may be added directly if they emerge during planning.

Record selections in `plan.md` (Scope Summary: included / excluded).

Before treating this step as complete, the planning trunk session must present the full proposed scope to the human, including both included and explicitly excluded items. This presentation is the point where the human makes the final balancing judgment across human-specified items, LLM-proposed items, and release capacity. The planning trunk session must not automatically continue to 1d once a candidate item set exists.

**Required prompt:**

- "Scope selection is complete. Choose next action: (1) confirm scope and proceed to phase decomposition, (2) revise scope selection, (3) stop."

**Valid responses:**

- `1`
- `2`
- `3`
- `confirm scope and proceed to phase decomposition`
- `revise scope selection`
- `stop`

**Invalid responses:**

- Generic confirmations such as "continue", "proceed", "looks good", or "yes"
- Any response that does not explicitly select one of the three next-action labels above

**Completion condition:**

- Step 1c is not complete until one valid next-action response is received.

**If the response is invalid or ambiguous:**

- Ask the human again.
- Do not begin 1d.
- Do not revise the scope unless that option is explicitly selected.

#### 1d. Phase decomposition and provisional ordering

Break the selected scope into phases. Each phase should be designed to be implementable in a single branch session when reasonably possible, while still preserving a clear and coherent phase boundary.

Determine a provisional execution order considering:

- Technical dependencies (phase B requires phase A's output).
- Diff overlap minimization (phases touching the same files benefit from adjacency or sequencing).
- Risk front-loading (uncertain or foundational changes earlier).

Before treating this step as complete, the planning trunk session must present the proposed phase decomposition and provisional ordering to the human for final confirmation. The purpose of this gate is consistency with the rest of the workflow: the LLM may propose the phase plan, but the human confirms it before detailed phase design begins.

**Required prompt:**

- "Phase decomposition and provisional ordering are complete. Choose next action: (1) confirm phase plan and proceed to Phase 1 design, (2) revise phase decomposition or ordering, (3) stop."

**Valid responses:**

- `1`
- `2`
- `3`
- `confirm phase plan and proceed to Phase 1 design`
- `revise phase decomposition or ordering`
- `stop`

**Invalid responses:**

- Generic confirmations such as "continue", "proceed", "looks good", or "yes"
- Any response that does not explicitly select one of the three next-action labels above

**Completion condition:**

- Step 1d is not complete until one valid next-action response is received.

**If the response is invalid or ambiguous:**

- Ask the human again.
- Do not begin 1e-1 for Phase 1.
- Do not revise the phase plan unless that option is explicitly selected.

#### 1e. Detailed design per phase loop

For each phase, the planning trunk session runs the following two-step loop:

- **1e-1. Perform detailed design for Phase N**
- **1e-2. Decide the next action after Phase N design**

The phase loop must not skip any of these steps.

##### 1e-1. Perform detailed design for Phase N

Detailed design for each phase is performed in a dedicated planning branch session.

The planning branch session is a design-only session. It must not implement code, run implementation verification as a completion target, or emit a Branch Session Summary.

- The planning trunk session creates the starting prompt for the branch session by filling the planning branch session template defined below.
- The starting prompt must explicitly identify the session as a planning branch session and state that no implementation work is allowed.
- The starting prompt must explicitly require the Planning Branch Session Summary format as the completion artifact.
- The planning branch session performs the detailed design work and writes the resulting design directly into the target phase file.
- The planning branch session must return a **Planning Branch Session Summary** in the standard format defined below.
- That summary is supplemental only. The phase file remains the canonical design artifact, and the summary carries only unresolved questions, dependency notes, rationale, completion signaling, and other observations that do not belong in the phase file.
- The human provides that summary to the planning trunk session before 1e-1 is treated as complete.
- The planning trunk session then reviews the updated phase file and summary together, checks for plan-level consistency and cross-phase impact, and finalizes any affected instructions files before moving to 1e-2.

**Human escalation during design** (applies in the planning branch session):

- If a design decision has unresolved ambiguity — including cases where two or more meaningfully different approaches are viable — pause and ask the human before writing the Design Decision as a finished choice.
- When asking, provide enough context for a clear decision: state the options, the non-obvious trade-offs, and your recommended default with a brief rationale. Do not ask open-ended questions without framing the decision space.
- Do not silently pick one option and record it as decided. An undisclosed choice made during planning carries the same risk as one made during implementation.

For each phase, the key design activities are:

- **Re-evaluate the item**: Before detailed design, confirm the item is still worth implementing and the approach is sound. Roadmap entries may be rough ideas — some may not survive scrutiny.
- **Resolve all design decisions**: Write them as finished choices, not open questions, unless a bounded subset explicitly qualifies for deferred design. Every uncontrolled missing decision is a potential mid-implementation pause.
- **Consider cross-phase impact**: Phase N is implemented on top of phases 1..(N-1). If earlier phases modify files or interfaces that phase N touches, account for that in Design Decisions and Target Files.
- **Update instructions files**: If the phase changes behavior covered by an instructions file, update the spec during planning — not during implementation.
- **Adjust phase ordering**: If design work reveals a better sequence, update the order now.

**Deferred design during Stage 1e-1**:

If a phase meets the deferred-design criteria defined above, the planning branch session may mark it as deferred design instead of forcing speculative Design Decisions.

When doing so:

- mark the phase's design maturity as `Deferred design` in the phase file
- fill the Deferred Design Controls section completely
- resolve every decision that can already be fixed and defer only the bounded subset that depends on predecessor implementation evidence
- name the predecessor phase or artifact whose completion triggers refinement
- do not treat the phase as implementation-ready; Stage 2 must run a dedicated design refinement session before the normal pre-execution check

**Completion condition:**

- Step 1e-1 is complete only when the phase design has been carried out in the planning branch session, the human has provided the Planning Branch Session Summary to the planning trunk session, and the resulting phase file and affected instructions files are updated as needed.

##### 1e-2. Decide the next action after Phase N design

After Phase N design has been summarized, the planning trunk session must obtain explicit authorization for what happens next.

**Required prompt:**

- "Phase N design is complete. Choose next action: (1) proceed to Phase N+1, (2) revise Phase N, (3) stop."

**Valid responses:**

- `1`
- `2`
- `3`
- `proceed to Phase N+1`
- `revise Phase N`
- `stop`

**Invalid responses:**

- Generic confirmations such as "continue", "looks good", or "yes"
- Any response that does not explicitly select one of the three next-action labels above

**Completion condition:**

- Step 1e-2 is complete only when one valid next-action response is received.

**If the response is invalid or ambiguous:**

- Ask the human again.
- Do not begin the next phase.
- Do not revise the current phase unless that option is explicitly selected.

Repeat this per-phase loop until all phases have detailed designs.

The planning trunk session must not merge 1e-1 and 1e-2 into a single combined confirmation flow.

#### 1f. Planning completion

Planning is complete when all of the following are true:

- Every phase file declares its design maturity and has all sections filled as required by that state (per phase-template "When to Fill Each Section").
- Every implementation-ready phase has all Design Decisions in finished form — no questions, TBDs, or open alternatives.
- Every deferred-design phase has its Deferred Design Controls section fully filled, with the predecessor dependency, refinement trigger, fixed constraints, and deferred decision set stated explicitly.
- Instructions files are consistent with the plan content.
- Cross-phase dependencies are identified and reflected in phase ordering.
- Each selected roadmap item has a `Release target: vX.Y.Z` annotation in `roadmap.md`.

Phase files created during planning are working artifacts for the current release only. They should remain stable during implementation, except when a deferred-design phase is intentionally reopened through the Stage 2 refinement flow defined below. They are not intended to be retained indefinitely after the release is completed.

After these criteria are satisfied, the planning trunk session must summarize the completed planning state and ask the human for explicit confirmation before treating planning as complete or handing off to the development trunk session. It must not automatically transition to implementation.

**Required prompt:**

- "Planning is complete. Choose next action: (1) hand off to development trunk session, (2) revise planning artifacts, (3) stop."

**Valid responses:**

- `1`
- `2`
- `3`
- `hand off to development trunk session`
- `revise planning artifacts`
- `stop`

**Completion condition:**

- Stage 1 is not complete until one valid next-action response is received.

---

### Stage 2: Implementation Cycle

**Session**: Development trunk session (orchestration) + design refinement sessions (conditional) + development branch sessions (per phase).

Repeat the following for each phase:

#### 2a. Deferred-design refinement (conditional)

If the current phase is marked as `Deferred design`, the development trunk session must run the following refinement flow before the normal pre-execution check. Otherwise skip this step.

1. **Trigger check**: Confirm that the predecessor phase implementation, review, and any other refinement-trigger conditions named in the phase file are complete.
2. **Prompt creation**: Create a starting prompt for a dedicated design refinement session using the template defined below.
3. **Design refinement**: The refinement session reads the target phase file, relevant predecessor artifacts, and the current repository state; then it resolves the deferred decisions directly in the phase file and updates any affected instructions files.
4. **No implementation**: The refinement session does not implement code. Its responsibility ends when the phase file becomes implementation-ready or when it reports that the design still cannot be finalized.
5. **Trunk review**: Review the updated phase file and the Design Refinement Session Summary. If the phase is now implementation-ready, continue to 2b. Otherwise revise the phase plan or escalate to the human.

**Required prompt after refinement:**

- "Deferred-design refinement for Phase N is complete. Choose next action: (1) run the pre-execution check for Phase N, (2) revise Phase N plan, (3) stop."

**Valid responses:**

- `1`
- `2`
- `3`
- `run the pre-execution check for Phase N`
- `revise Phase N plan`
- `stop`

**Completion condition:**

- Stage 2a for the phase is complete only when either the step is skipped because the phase is already implementation-ready, or one valid next-action response is received after refinement.

#### 2b. Pre-execution check (development trunk session)

Before starting a branch session, the development trunk session performs the following checks:

1. **Build health**: The project's build, test, and format-check commands all pass. (The specific commands are defined in the project's `copilot-instructions.md` or `package.json`, not here.)
2. **Prior-phase impact**: If the previous branch session summary contains "Deviations from Plan" or "Observations for Subsequent Phases", evaluate whether the current phase's Design Decisions or Target Files need adjustment.
3. **Phase file completeness**: The current phase must be marked as `Implementation-ready`, and all sections required by that state must be filled. If Design Decisions contain gaps, or if the phase is still marked as `Deferred design`, do not proceed to implementation.
4. **Phase sizing sanity check**: Confirm that the current phase still appears executable within one branch session at a reasonable level of scope and reviewability. If not, revise the phase plan before starting implementation.
5. **If all checks pass**: Prepare the starting prompt for the branch session and present it in the same message as the Stage 2b gate so the human can review the exact prompt before choosing the next action. Use the development branch session starting prompt template defined below.

**Required prompt before launching the branch session:**

- "Pre-execution check for Phase N is complete. Choose next action: (1) start branch session for Phase N, (2) revise Phase N plan, (3) stop."

**Valid responses:**

- `1`
- `2`
- `3`
- `start branch session for Phase N`
- `revise Phase N plan`
- `stop`

**Completion condition:**

- Stage 2b for the phase is not complete until one valid next-action response is received.

The prompt prepared in Stage 2b is the current handoff artifact for the phase.

- If the human selects `revise Phase N plan`, or if any referenced input changes before launch (phase file, `plan.md` context, carry-forward items, or affected instructions files), discard that prepared prompt, rerun Stage 2b, and prepare a replacement prompt.
- If the human selects `start branch session for Phase N` and those inputs have not changed since the Stage 2b message, reuse the prepared prompt as-is. Do not regenerate or reprint an identical second copy.

##### When a phase does not fit in one branch session

The workflow is designed so that each phase can be completed in a single branch session when reasonably possible. However, this is a planning target, not an absolute constraint.

**Primary responsibility for this judgment belongs to the planning trunk session and development trunk session**, because phase sizing and phase boundaries are part of release orchestration rather than branch-level implementation autonomy.

There are two points at which this may be decided:

1. **During planning or pre-execution review**: if the planning trunk session or development trunk session determines that a phase is too large or too mixed in scope to be executed cleanly in one branch session, it should revise the phase decomposition before implementation starts.
2. **During implementation**: if the branch session discovers that completing the phase in one session would be unsafe, unreasonably large, or would require forcing together work that should be reviewed separately, it must not redefine the phase on its own. Instead, it should report `partially-completed` status and explain the situation in the Branch Session Summary.

When such a summary is returned, the development trunk session decides which of the following applies:

- **Continuation of the same phase**: the phase design remains valid, but the implementation should continue in a follow-up branch session.
- **Phase redesign or split**: the work revealed that the current phase boundary is incorrect, too broad, or misaligned with downstream phases.

A branch session may detect that one-session completion is no longer appropriate, but it must not unilaterally redefine phase boundaries. If the correct response is unclear, escalate to the human.

#### 2c. Prepared starting prompt handoff (development trunk session)

If the human selected option `1` in Stage 2b, the development trunk session hands off the most recently prepared starting prompt to the development branch session.

- Reuse the prepared prompt verbatim when its inputs are unchanged.
- If the inputs changed after the Stage 2b message, return to Stage 2b and prepare a new prompt instead of editing or re-emitting the old one informally.
- When Stage 2b already displayed the prompt and the inputs are unchanged, Stage 2c must not emit a second identical copy. The previously prepared prompt is already the handoff artifact.

The prepared starting prompt must include:

- **File references**: `plan.md` (for release-level context) and the target phase file.
- **Phase identity**: Phase number, title, and summary line — so the branch session establishes context immediately.
- **Carry-forward items**: Any observations, deviations, or refinement follow-ups from earlier work that affect this phase. Omit if none.
- **Completion instruction**: "When implementation is complete, output a Branch Session Summary in the standard format."
- **Verification reminder**: "Run all automated verification commands and include results in the summary."

The prepared starting prompt should be self-contained: a branch session that reads only the starting prompt and the referenced files should be able to execute the phase without additional guidance.

#### 2d. Implementation (branch session)

The branch session:

1. Reads the starting prompt, `plan.md`, and the phase file.
2. Implements the changes specified in Design Decisions and Target Files.
3. Runs all verification steps (automated + behavioral checks).
4. Produces a **Branch Session Summary** (see format below).

**Behavioral rules for the branch session**:

- Treat the phase file as the implementation contract. Do not reopen a Design Decision unless implementation evidence shows it is blocked, incorrect, or incomplete in a way that prevents completion.
- The branch session may make **local, design-preserving adjustments** without prior escalation when they are necessary to complete the phase as designed. Examples include:
  - additional type-driven fixes required to restore compile health after a planned change
  - small implementation adjustments to match the actual behavior of a dependency or runtime API
  - narrow target-file expansion needed to complete the already-decided change safely
- These adjustments must not change the phase's purpose, revise an owning-layer decision, alter a documented external behavior, or introduce a materially different technical approach.
- Record every such adjustment in `Deviations from Plan`, even when it was resolved autonomously.
- If an ambiguous technical decision arises that is not covered by the phase file — or if the required change appears to modify a Design Decision, public contract, cross-phase dependency, or documented behavior — pause and ask the human rather than making an architectural choice.
- Small deviations (e.g. a test helper name, an import order, or similarly local naming/organization choices) are acceptable. Record them in the summary if they are relevant to later review.
- If the phase cannot be completed, set the summary status to `blocked` and describe the blocker.

#### 2e. Summary handoff (branch → trunk)

The branch session outputs a summary. Human copies it into the development trunk session.

#### 2f. Result review (development trunk session)

The development trunk session:

1. Reviews the summary for deviations, observations, and verification results.
2. Inspects the actual project state if needed (file diffs, test output).
3. If issues are found, coordinates resolution (may involve another branch session or direct fixes).
4. Updates the phase status in `plan.md`.
5. Summarizes the current phase result, including any deviations, follow-up concerns, and the recommended next step.
6. Pauses for explicit human confirmation before advancing to the next phase, launching a follow-up branch session, or moving to Stage 3.

The development trunk session must not automatically continue past a phase boundary. At each phase transition, the human decides whether to proceed, request revision, or stop.

**Required prompt:**

- "Phase N review is complete. Choose next action: (1) proceed to the next phase, (2) run a follow-up branch session for Phase N, (3) revise planning/trunk artifacts, (4) stop."

**Valid responses:**

- `1`
- `2`
- `3`
- `4`
- `proceed to the next phase`
- `run a follow-up branch session for Phase N`
- `revise planning/trunk artifacts`
- `stop`

**Completion condition:**

- Stage 2f for the phase is not complete until one valid next-action response is received.

---

### Stage 3: Release Completion

**Session**: Development trunk session.

Before entering Stage 3, the development trunk session must summarize the overall implementation state and ask the human for explicit confirmation that phase execution is complete and release-completion work should begin.

**Required prompt:**

- "All implementation phases are complete. Choose next action: (1) begin Stage 3 release completion, (2) return to phase work, (3) stop."

**Valid responses:**

- `1`
- `2`
- `3`
- `begin Stage 3 release completion`
- `return to phase work`
- `stop`

**Completion condition:**

- Stage 2 is not complete until one valid next-action response is received.

1. Execute release tasks defined in `plan.md` (documentation updates, changelog, migration notes, roadmap cleanup).
2. Run final verification checklist.
3. Remove the current release's phase files from `plans/` after their contents are no longer needed for active execution or review. Do not retain them as permanent repository records; rely on git history and CHANGELOG.md for release-history traceability.
4. Hand off to human for the actual release operation (e.g. GitHub release, npm publish).

---

## Planning Branch Session Summary Format

Every planning branch session must produce a summary in this format:

```text
## Planning Branch Session Summary
### Phase: {N} — {title}
### Status: completed | partially-completed | blocked
### Notes for Planning Trunk Session
- (planning notes that should be shared back with the planning trunk session but do not belong in the phase file; use "None" if there is nothing additional to report)
### Open Questions for Human
- (only genuinely unresolved decisions that require human judgment; "None" if everything was resolved)
### Ordering / Dependency Notes
- (any suggested change to phase ordering, newly discovered dependency, or cross-phase impact; "None" if nothing to report)
### Instructions Files Impact
- (instruction/spec files that should be updated, or confirmation that none are affected)
### Non-Obvious Rationale
- (brief reasoning that may help the planning trunk session understand why a recommendation was made)
### Risks / Follow-ups
- (planning risks, validation needs, or other items to check before implementation; "None" if nothing to report)
```

---

## Design Refinement Session Summary Format

Every design refinement session must produce a summary in this format:

```text
## Design Refinement Session Summary
### Phase: {N} — {title}
### Status: completed | partially-completed | blocked
### Design Decisions Finalized
- (the deferred decisions that were resolved in this session)
### Phase File Updates
- (sections updated in the phase file; use "None" only if blocked before updates were made)
### Instructions Files Impact
- (instruction/spec files updated, or confirmation that none were affected)
### Open Questions for Human
- (only genuinely unresolved decisions that still require human judgment; "None" if the phase is now implementation-ready)
### Risks / Follow-ups
- (remaining design risks or review items the development trunk session should check before implementation; "None" if nothing additional remains)
```

---

## Branch Session Summary Format

Every development branch session must produce a summary in this format:

```
## Branch Session Summary
### Phase: {N} — {title}
### Status: completed | partially-completed | blocked
### Changes Made
- (concise list of implemented changes)
### Deviations from Plan
- (any departure from the phase file's Design Decisions or Target Files, including autonomous local adjustments made to complete the phase without changing its design intent; "None" if fully aligned)
### Observations for Subsequent Phases
- (discoveries that may affect later phases; "None" if nothing to report)
### Verification Results
- build: pass/fail
- test: pass/fail
- format: pass/fail
- behavioral checks: (brief result for each check in the phase Verification section)
```

---

## Starting Prompt Template Formats

Starting prompts are handoff artifacts. They must be concise, session-specific, and explicit about the required outcome. Include only information that is not already covered by `plan.md`, the phase file, or the relevant instructions files.

### Planning Branch Session Starting Prompt

- **Artifact Type**: Starting Prompt
- **Session Type**: Planning Branch Session
- **Phase**: {N} — {title}
- **Purpose**: Resolve design questions for the target phase and write the resulting design into the phase file.
- **Input Files**: `plan.md`, `plans/phase-{N}.md`, relevant instructions files
- **Design References**: {relevant references}
- **Open Design Questions**: {specific design questions or ambiguity to resolve}
- **Restrictions**: No implementation work is allowed.
- **Required Output**: Planning Branch Session Summary

### Design Refinement Session Starting Prompt

- **Artifact Type**: Starting Prompt
- **Session Type**: Design Refinement Session
- **Phase**: {N} — {title}
- **Purpose**: Resolve deferred design decisions for the target phase and update the phase file.
- **Input Files**: `plan.md`, `plans/phase-{N}.md`, required predecessor artifacts, relevant instructions files, current repository state
- **Refinement Trigger**: {predecessor phase or artifact that unlocks refinement}
- **Deferred Decisions**: {bounded subset still awaiting implementation evidence}
- **Restrictions**: No implementation work is allowed.
- **Required Output**: Design Refinement Session Summary

### Development Branch Session Starting Prompt

- **Artifact Type**: Starting Prompt
- **Session Type**: Development Branch Session
- **Phase**: {N} — {title}
- **Purpose**: Implement the phase exactly as specified in the phase file.
- **Input Files**: `plan.md`, `plans/phase-{N}.md`, relevant instructions files
- **Carry-forward Items**: {observations, deviations, or follow-ups that affect this phase; omit if none}
- **Restrictions**: Follow the phase file as the implementation contract. Do not add design instructions that already belong to the phase file.
- **Completion Instruction**: When implementation is complete, output a Branch Session Summary in the standard format.
- **Verification Reminder**: Run all automated verification commands and include results in the summary.

## Role Expectations

### LLM Responsibilities

#### In planning trunk sessions

- Propose scope items with rationale (synergy, risk, version semantics).
- Flag design decisions that are still in question form or contain ambiguity.
- Decide whether each phase is implementation-ready during Stage 1 or should be explicitly marked as deferred design under the criteria defined above.
- Verify cross-phase consistency: if phase N modifies an interface, check that phase N+1's Target Files account for it.
- Confirm instructions files are updated when behavior specs change.
- At planning completion, verify all completion criteria (Stage 1f) are met.
- Treat workflow gates as step-completion conditions, not as optional reminders.
- Enforce the valid-response lists for 1c, 1d, 1e-2, and 1f exactly as written; never infer authorization from generic proceed/continue language.
- Keep the phase file as the canonical design artifact and use the Planning Branch Session Summary only for information that does not belong in the phase file.
- After completing each gated planning step, stop at the gate and wait for the human's explicit response before moving on.
- When all planning-completion criteria are satisfied, ask the human to confirm that planning is complete before handing off to implementation.

#### In development trunk sessions

- If the current phase is marked as deferred design, run the refinement flow (Stage 2a) before any implementation work begins.
- Execute the pre-execution checklist (Stage 2b) completely — do not skip items.
- Prepare starting prompts that are self-contained during Stage 2b, and reuse that prepared prompt at Stage 2c unless the prompt inputs changed.
- Review refinement and branch summaries for remaining risks, deviations, and downstream impact before authorizing the next step.
- If the human does not request a pre-execution check before starting a branch session, remind them.
- After reviewing each branch-session result, summarize the current state and stop at the gate before advancing across a phase boundary.
- Before moving from phase execution to Stage 3 release-completion work, ask the human to confirm that implementation-stage work is complete.

#### In development branch sessions

- Treat the phase file as the implementation contract, and do not implement from a phase file that is still marked as `Deferred design`.
- Do not add features, refactoring, or improvements beyond what the phase file specifies.
- Produce the Branch Session Summary in the exact format specified — do not omit sections.
- If a Design Decision appears to be incorrect based on implementation evidence, report it as a deviation rather than silently changing approach.
- Treat waiting at a gate as a successful completion state when the current authorized work is finished.

### Human Responsibilities

- Provide release intent (Stage 1a).
- Make final scope decisions when LLM proposals conflict or exceed capacity.
- Review and approve phase designs before implementation begins, including deferred-design refinement results when applicable.
- Copy branch session summaries to development trunk session (context handoff).
- Perform the actual release operation (Stage 3).
- Make the final judgment when a Design Decision is contested during implementation.

---

## Escalation

### When to resolve within the branch session

- Naming choices not specified in the phase file (variable names, test helper names).
- Minor implementation details consistent with the phase's Design Decisions.
- Test structure decisions when the phase file specifies "add tests" without prescribing exact test organization.
- Additional implementation work that is directly implied by the planned change but was not exhaustively listed in Target Files, as long as it does not alter the phase's design intent.
- Small corrective adjustments required because a dependency, runtime API, or type/checking boundary behaves slightly differently from what was expected during planning, as long as the adjustment preserves the same design.

### When to escalate to the human (within the branch session)

- A Design Decision appears to be incorrect or blocked by a technical constraint.
- An ambiguous requirement that could lead to meaningfully different implementations.
- A discovered issue in a file not listed in Target Files that appears related to the phase's scope.
- A requested or discovered change appears small in code size but would rename, redefine, or otherwise change the underlying concept expressed by the design rather than merely improving local wording.

### When to escalate to the development trunk session

- The current phase is still marked as `Deferred design` and requires refinement before implementation.
- The phase cannot be completed (status: `blocked`).
- A deviation is significant enough that downstream phases may need redesign.
- An issue found in a prior phase's implementation that was not caught during its review.

---

## Future Considerations

The following improvements have been identified but are intentionally deferred. They should be revisited after one full release cycle has been executed under this documented workflow.

### A. Automated summary handoff via repository memory

**Current state**: Human copies branch session summary via copy-paste.
**Possible direction**: Branch session writes to `/memories/repo/`; development trunk session reads from there.
**Why deferred**: Observe where copy-paste actually causes friction before designing automation.

### B. Planning-to-trunk session continuity

**Current state**: Planning trunk session and development trunk session are separate conversations.
**Possible direction**: Continue in the same session to preserve context.
**Why deferred**: Phase file separation changes the amount of context trunk needs to hold. Evaluate after one cycle.

### C. Concrete escalation criteria for "plan vs. implement" boundary

**Current state**: No formal threshold for when a branch session issue requires returning to planning.
**Possible direction**: Define the boundary as "any change to a Design Decision requires trunk/planning escalation."
**Why deferred**: Need actual incidents to validate that the criterion is practical.

### D. Explicit phase dependency graph

**Current state**: Cross-phase dependencies are mentioned in prose within phase files.
**Possible direction**: Add a `Dependencies` section to phase-template listing predecessor phases and affected interfaces.
**Why deferred**: Current phase counts (5–6 per release) are manageable without formal dependency tracking. Revisit if phase count or inter-phase complexity increases.
