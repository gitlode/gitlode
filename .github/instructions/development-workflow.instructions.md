---
description: Development workflow for human–LLM collaborative release cycles — session types, lifecycle stages, artifacts, and role expectations
---

# Development Workflow

## Purpose & Scope

This document defines the end-to-end development workflow for release cycles executed through human–LLM collaboration.

It is **product-agnostic**: the workflow, session types, artifacts, and role expectations described here are not specific to any single codebase. Product-specific conventions (coding standards, tech stack, architecture) belong in project-level instruction files, not here.

The primary audience is LLMs operating within the workflow. The document is also intended to be readable by humans onboarding to the same process.

### Goals of this workflow

- Eliminate ambiguity about what to do at each stage — for both human and LLM.
- Ensure LLMs can autonomously execute implementation sessions with minimal mid-session design judgment.
- Enable LLMs to detect and flag omissions or inconsistencies that a human might overlook.
- Produce a repeatable process that can be adopted across different projects.

---

## Document Ecosystem

The workflow relies on several document types. Each has a distinct role within the information flow.

```
roadmap.md          Long-horizon backlog. Items are added at any time.
    │
    ↓  (select items for a release)
PLAN.md             Release-level plan: goals, scope, phase list with status.
    │
    ↓  (one file per phase)
plans/{version}/    Phase files: detailed design per phase (phase-template format).
    │
    ↓  (referenced by phase Design References)
*.instructions.md   Technical specifications: architecture, CLI, schema, traversal, etc.
    │
    ↓  (after release)
CHANGELOG.md        Released history.
```

| Document                                   | Mutability during a release                                                 | Primary consumer                                   |
| ------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------- |
| `roadmap.md`                               | Append-only (new items); existing items may gain release-target annotations | Planning session                                   |
| `PLAN.md`                                  | Phase status updates only after planning is complete                        | All sessions                                       |
| Phase files (`plans/{version}/phase-N.md`) | Frozen before implementation; status updated during/after                   | Branch session (one phase), trunk session (review) |
| `*.instructions.md`                        | Updated during planning when phase design requires spec changes             | Branch session, planning session                   |
| `copilot-instructions.md`                  | Rarely changed; project-level conventions                                   | All sessions                                       |

### PLAN.md structure

PLAN.md contains **release-level context only**. Phase design detail lives in individual phase files under `plans/{version}/`.

When creating a new PLAN.md, use the following structure:

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

- **File**: [`plans/{version}/phase-1.md`](plans/{version}/phase-1.md)
- **Status**: Planned | In progress | Completed

### Phase 2: {Title}

- **File**: [`plans/{version}/phase-2.md`](plans/{version}/phase-2.md)
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
- The Release Tasks section contains release-specific deliverables. This is where project-specific tasks (which docs to update, changelog format, roadmap cleanup) are defined.
- The Final Verification Checklist is filled after all phases and release tasks are complete, as a last gate before handoff to the human for the release operation.

### roadmap.md structure

roadmap.md is a **long-horizon backlog**. It captures ideas, improvement candidates, and deferred items at any fidelity level — from a single-sentence note to a multi-paragraph design sketch with candidate approaches.

Unlike PLAN.md and phase files, roadmap.md does **not** have a rigid section template. Detailed design is the responsibility of the planning phase; the roadmap intentionally permits loose, exploratory writing so that early-stage ideas are not inhibited by structural overhead.

**Required elements**:

- **Preamble**: A short description of what the roadmap covers and how it is organized (e.g. by priority/time horizon, not by release version).
- **Metadata convention**: Define how release targeting is annotated. The standard field is `Release target: vX.Y.Z`, added to an item when it is selected for a release during planning (Stage 1b).
- **Grouping**: Organize items into sections that reflect evaluation priority. A recommended grouping is by time horizon (Near-term / Medium-term / Long-term), but project-specific groupings (by domain area, by component) are acceptable as long as the grouping rationale is stated in the preamble.

**Entry format** (flexible):

- Each entry is a heading (typically `####`) with a descriptive title.
- Body content ranges from a single sentence to a detailed problem statement with candidate approaches — whatever level of detail is useful at the time of writing.
- When an item is selected for a release, add `Release target: vX.Y.Z` to the entry. When design decisions are resolved during planning, optionally add a **Design resolution notes** block summarizing key choices.
- Completed items are cleaned up during release tasks (Stage 3), not during planning.

**Guidance for LLMs**:

- When suggesting new roadmap entries, match the tone and depth of existing entries in the file.
- Do not enforce a uniform structure across entries — some will be detailed, others deliberately terse.
- During planning (Stage 1b), treat roadmap entries as input material, not as binding specifications. Re-evaluation is expected.

### Phase file structure

Each phase file follows the format defined in [phase-template.instructions.md](phase-template.instructions.md). That document is the authoritative reference for section structure, fill-in timing, and authoring guidance.

---

## Session Types

Four session types are used throughout a release cycle. Each has a defined lifespan, responsibility scope, and context boundary.

| Session type                   | Lifespan                                                 | Responsibility                                                                            | Context sources                                                                          |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Planning session**           | From release intent to planning completion               | Scope decision, phase decomposition, detailed design per phase, instructions file updates | roadmap.md, PLAN.md, phase files, instructions files                                     |
| **Planning branch session**    | Single-phase design task                                 | Focused design work for a complex phase, isolated from the full planning scope            | PLAN.md (overview only), target phase file, relevant instructions files                  |
| **Development trunk session**  | Entire implementation cycle (all phases + release tasks) | Pre-execution checks, starting prompt creation, result review, release tasks              | PLAN.md, all phase files, branch session summaries                                       |
| **Development branch session** | Single phase implementation                              | Implementation, testing, verification                                                     | PLAN.md (overview only), target phase file, relevant instructions files, starting prompt |

### Context boundaries

- A **branch session** (planning or development) should receive only the phase file it is working on, plus release-level context from PLAN.md. Other phase files are excluded to minimize noise.
- The **trunk session** holds the cross-phase view and is responsible for detecting inter-phase impacts.

### Context handoff between sessions

- **Planning → Development trunk**: PLAN.md and phase files are the handoff artifacts. No copy-paste or verbal summary is needed — the documents are the contract.
- **Development branch → Development trunk**: Branch session produces a structured summary (see Branch Session Summary below). Human copies the summary into the trunk session.
- **Development trunk → Development branch**: Trunk session produces a starting prompt (see Starting Prompt below).

---

## Development Lifecycle

### Stage 0: Roadmap Management

**When**: Any time, independent of release cycles.
**Who**: Human (primarily), LLM (may suggest entries).

- Add new ideas, improvement candidates, and deferred items to `roadmap.md`.
- No formal review required. Entries are low-commitment by design.

---

### Stage 1: Release Planning

**Session**: Planning session.

#### 1a. PLAN.md preparation

Before starting any planning activities, bring PLAN.md to a clean state for the new release. PLAN.md is a single file that is overwritten at the start of each planning session. Determine its current state and act accordingly:

1. **No PLAN.md exists** (first planning session ever): Create PLAN.md from scratch using the template in the "PLAN.md structure" section above. Fill in the new version number; leave all content sections as empty stubs to be filled during 1c–1e.
2. **PLAN.md contains a completed prior release** (all phases marked Completed and the Final Verification Checklist cleared): Overwrite PLAN.md with a fresh skeleton for the new version. The prior release's record is already captured in CHANGELOG.md; retaining stale content adds noise without value.
3. **PLAN.md contains an incomplete or in-progress prior release**: Escalate to human before proceeding. Do not overwrite PLAN.md.

The resulting skeleton must contain: the new version title, empty stubs for Overview, Release Goals, Scope Summary, and Development Phases, and the **canonical Release Tasks template** (see note below). The Final Verification Checklist is an empty stub.

> **Release Tasks template note**: The "what to do" in Release Tasks (update CHANGELOG, review README, clean up roadmap, run format check) is the same for every release. Only the release-specific notes (extra docs, migration guidance) differ. When creating the skeleton, restore the Release Tasks section to its canonical template form — do not reduce it to an empty stub. The canonical form is maintained in PLAN.md itself and should be copied forward when overwriting.

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

Record selections in PLAN.md (Scope Summary: included / excluded).

#### 1d. Phase decomposition and provisional ordering

Break the selected scope into phases. Each phase should be implementable in a single branch session.

Determine a provisional execution order considering:

- Technical dependencies (phase B requires phase A's output).
- Diff overlap minimization (phases touching the same files benefit from adjacency or sequencing).
- Risk front-loading (uncertain or foundational changes earlier).

This order is provisional — it may be adjusted during detailed design (1e).

#### 1e. Detailed design per phase

Phases are designed one at a time, in order. For each phase, the planning session LLM asks the human whether to proceed **in the current planning session** or in a **planning branch session**. The human chooses based on expected complexity.

**If the planning session is chosen**: the LLM fills in the phase file directly and continues to the next phase when done.

**If a planning branch session is chosen**: the planning session LLM creates a starting prompt for the branch session (analogous to Stage 2b, but for design work rather than implementation), then waits for the branch session to complete. The human provides the branch session output to the planning session before the next phase begins.

Repeat this per-phase cycle until all phases have detailed designs.

> This loop mirrors the Stage 2 implementation cycle (2a–2e), with one key difference: the branch session is optional and created only when the design work is expected to be complex enough to benefit from isolation. Simple phases are designed inline in the planning session.

**Human escalation during design** (applies in both planning session and planning branch session):

- If a design decision has unresolved ambiguity — including cases where two or more meaningfully different approaches are viable — pause and ask the human before writing the Design Decision as a finished choice.
- When asking, provide enough context for a clear decision: state the options, the non-obvious trade-offs, and your recommended default with a brief rationale. Do not ask open-ended questions without framing the decision space.
- Do not silently pick one option and record it as decided. An undisclosed choice made during planning carries the same risk as one made during implementation.

For each phase, the key design activities are:

- **Re-evaluate the item**: Before detailed design, confirm the item is still worth implementing and the approach is sound. Roadmap entries may be rough ideas — some may not survive scrutiny.
- **Resolve all design decisions**: Write them as finished choices, not open questions. Every missing decision is a potential mid-implementation pause.
- **Consider cross-phase impact**: Phase N is implemented on top of phases 1..(N-1). If earlier phases modify files or interfaces that phase N touches, account for that in Design Decisions and Target Files.
- **Update instructions files**: If the phase changes behavior covered by an instructions file, update the spec during planning — not during implementation.
- **Adjust phase ordering**: If design work reveals a better sequence, update the order now.

#### 1f. Planning completion

Planning is complete when all of the following are true:

- Every phase file has all sections filled (per phase-template "When to Fill Each Section").
- All Design Decisions are in finished form — no questions, TBDs, or open alternatives.
- Instructions files are consistent with the plan content.
- Cross-phase dependencies are identified and reflected in phase ordering.
- Each selected roadmap item has a `Release target: vX.Y.Z` annotation in `roadmap.md`.

---

### Stage 2: Implementation Cycle

**Session**: Development trunk session (orchestration) + development branch sessions (per phase).

Repeat the following for each phase:

#### 2a. Pre-execution check (trunk session)

Before starting a branch session, the trunk session performs the following checks:

1. **Build health**: The project's build, test, and format-check commands all pass. (The specific commands are defined in the project's `copilot-instructions.md` or `package.json`, not here.)
2. **Prior-phase impact**: If the previous branch session summary contains "Deviations from Plan" or "Observations for Subsequent Phases", evaluate whether the current phase's Design Decisions or Target Files need adjustment.
3. **Phase file completeness**: All sections of the current phase file are filled. If Design Decisions contain gaps, escalate to human — do not proceed to implementation.
4. **If all checks pass**: Create the starting prompt for the branch session.

#### 2b. Starting prompt creation (trunk session)

The starting prompt must include:

- **File references**: PLAN.md (for release-level context) and the target phase file.
- **Phase identity**: Phase number, title, and summary line — so the branch session establishes context immediately.
- **Carry-forward items**: Any observations or deviations from the previous phase that affect this phase. Omit if none.
- **Completion instruction**: "When implementation is complete, output a Branch Session Summary in the standard format."
- **Verification reminder**: "Run all automated verification commands and include results in the summary."

The starting prompt should be self-contained: a branch session that reads only the starting prompt and the referenced files should be able to execute the phase without additional guidance.

#### 2c. Implementation (branch session)

The branch session:

1. Reads the starting prompt, PLAN.md, and the phase file.
2. Implements the changes specified in Design Decisions and Target Files.
3. Runs all verification steps (automated + behavioral checks).
4. Produces a **Branch Session Summary** (see format below).

**Behavioral rules for the branch session**:

- Do not reopen a Design Decision unless verification evidence shows it is blocked or incorrect.
- If an ambiguous technical decision arises that is not covered by the phase file, pause and ask the human rather than making an architectural choice.
- Small deviations (e.g. a test helper name, an import order) are acceptable. Record them in the summary.
- If the phase cannot be completed, set the summary status to `blocked` and describe the blocker.

#### 2d. Summary handoff (branch → trunk)

The branch session outputs a summary. Human copies it into the trunk session.

#### 2e. Result review (trunk session)

The trunk session:

1. Reviews the summary for deviations, observations, and verification results.
2. Inspects the actual project state if needed (file diffs, test output).
3. If issues are found, coordinates resolution (may involve another branch session or direct fixes).
4. Updates the phase status in PLAN.md.
5. Proceeds to the next phase (back to 2a).

---

### Stage 3: Release Completion

**Session**: Development trunk session.

1. Execute release tasks defined in PLAN.md (documentation updates, changelog, migration notes, roadmap cleanup).
2. Run final verification checklist.
3. Hand off to human for the actual release operation (e.g. GitHub release, npm publish).

Note: The specific content of release tasks (which documentation to update, what to include in the changelog, how to clean up roadmap entries) is defined in PLAN.md's Release Tasks section, not in this workflow document. This keeps the workflow generic and the release-specific details in the plan.

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
- (any departure from the phase file's Design Decisions or Target Files; "None" if fully aligned)
### Observations for Subsequent Phases
- (discoveries that may affect later phases; "None" if nothing to report)
### Verification Results
- build: pass/fail
- test: pass/fail
- format: pass/fail
- behavioral checks: (brief result for each check in the phase Verification section)
```

**Why each section matters**:

- **Status**: Trunk session uses this to decide whether to proceed or intervene.
- **Deviations from Plan**: Trunk session evaluates whether downstream phases need adjustment.
- **Observations for Subsequent Phases**: Directly feeds into the next phase's pre-execution check (2a).
- **Verification Results**: Confirms the phase exit criteria were met.

---

## Role Expectations

### LLM Responsibilities

#### In planning sessions

- Propose scope items with rationale (synergy, risk, version semantics).
- Flag design decisions that are still in question form or contain ambiguity.
- Verify cross-phase consistency: if phase N modifies an interface, check that phase N+1's Target Files account for it.
- Confirm instructions files are updated when behavior specs change.
- At planning completion, verify all completion criteria (Stage 1f) are met.

#### In trunk sessions

- Execute the pre-execution checklist (Stage 2a) completely — do not skip items.
- Create starting prompts that are self-contained (Stage 2b).
- When reviewing branch summaries, explicitly check "Deviations" and "Observations" sections for downstream impact.
- If the human does not request a pre-execution check before starting a branch session, remind them.

#### In branch sessions

- Treat the phase file as the implementation contract.
- Do not add features, refactoring, or improvements beyond what the phase file specifies.
- Produce the Branch Session Summary in the exact format specified — do not omit sections.
- If a Design Decision appears to be incorrect based on implementation evidence, report it as a deviation rather than silently changing approach.

### Human Responsibilities

- Provide release intent (Stage 1a).
- Make final scope decisions when LLM proposals conflict or exceed capacity.
- Review and approve phase designs before implementation begins.
- Copy branch session summaries to trunk session (context handoff).
- Perform the actual release operation (Stage 3).
- Make the final judgment when a Design Decision is contested during implementation.

---

## Escalation

### When to resolve within the branch session

- Naming choices not specified in the phase file (variable names, test helper names).
- Minor implementation details consistent with the phase's Design Decisions.
- Test structure decisions when the phase file specifies "add tests" without prescribing exact test organization.

### When to escalate to the human (within the branch session)

- A Design Decision appears to be incorrect or blocked by a technical constraint.
- An ambiguous requirement that could lead to meaningfully different implementations.
- A discovered issue in a file not listed in Target Files that appears related to the phase's scope.

### When to escalate to the trunk session

- The phase cannot be completed (status: `blocked`).
- A deviation is significant enough that downstream phases may need redesign.
- An issue found in a prior phase's implementation that was not caught during its review.

---

## Future Considerations

The following improvements have been identified but are intentionally deferred. They should be revisited after one full release cycle has been executed under this documented workflow.

### A. Automated summary handoff via repository memory

**Current state**: Human copies branch session summary via copy-paste.
**Possible direction**: Branch session writes to `/memories/repo/`; trunk session reads from there.
**Why deferred**: Observe where copy-paste actually causes friction before designing automation.

### B. Planning-to-trunk session continuity

**Current state**: Planning session and development trunk session are separate conversations.
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
