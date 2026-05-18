---
description: Standard phase file template — structure, required fields, and authoring guidance
---

# Phase File Template

## Purpose

This file defines the standard structure for individual phase files under `.github/plans/`.

The goal is to ensure that every phase is specified thoroughly enough to execute, when reasonably possible, within a single implementation session with minimal design judgment at runtime. A phase file that is incomplete at planning time will force the implementer to pause and make architectural choices mid-session — which is exactly the failure mode this template is designed to prevent.

Phase files are working documents for the current release only. They are not intended to serve as permanent archival records in the repository.

Each phase file must declare its design maturity. The valid states are defined below, and only an implementation-ready phase file may be used for branch implementation.

## Pause Types in This Workflow

This workflow distinguishes three different kinds of pauses:

1. **Undesirable pause**: implementation stops because planning left a design decision unresolved.
2. **Required escalation**: implementation stops because new evidence shows that a human decision is needed.
3. **Authorization gate**: implementation or planning stops because the current step is complete and the workflow requires explicit human authorization before the next step begins.

This template is designed to reduce **undesirable pauses**. It does **not** attempt to eliminate required escalations or authorization gates.

## Relationship to Other Files

| File                                                        | Role                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `.github/plan.md`                                           | Active release plan; phase list with status and release-level context       |
| `.github/plans/phase-N.md`                                  | Individual phase files using this template                                  |
| `.github/instructions/development-workflow.instructions.md` | End-to-end development lifecycle; defines when and how phase files are used |
| `.github/roadmap.md`                                        | Long-horizon backlog; feeds into plan.md releases                           |
| `.github/instructions/*.instructions.md`                    | Technical specifications; linked from phase Design References               |
| `.github/copilot-instructions.md`                           | Project-level conventions                                                   |

## Design Maturity States

### Implementation-ready

This is the default state. The phase file contains the finished Design Decisions, Target Files, and verification expectations needed for a development branch session to execute without reopening design.

### Deferred design

Use this state only when a bounded unresolved portion of the phase depends on implementation evidence from an earlier phase and cannot be reduced during planning to a stable contract.

Deferred design is not a general TODO state. It requires a completed Deferred Design Controls section, explicit predecessor dependency, and a named refinement trigger so the remaining uncertainty stays bounded and reviewable.

## When to Fill Each Section

| Section                   | When                                                                                   | Owner                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Title, summary            | When the phase file is first created                                                   | Planning trunk session                                                   |
| Design Maturity           | When the phase file is first created; update when deferred design is resolved          | Planning branch session (design refinement session when deferred)        |
| Design References         | During detailed design                                                                 | Planning branch session                                                  |
| Design Decisions          | **Before the implementation session starts**                                           | Planning branch session                                                  |
| Deferred Design Controls  | During planning if the phase is marked deferred design; finalize before implementation | Planning branch session (design refinement session when deferred)        |
| Non-Goals                 | During detailed design                                                                 | Planning branch session                                                  |
| Target Files              | Before implementation                                                                  | Planning branch session (design refinement session when deferred)        |
| Documentation Touchpoints | During planning/design to enumerate required updates; executed during implementation   | Planning branch session (design refinement session when deferred)        |
| Implementation Notes      | When non-obvious details are known                                                     | Planning branch session or development branch session                    |
| Verification              | Before implementation (commands); after first run (behavioral checks)                  | Planning branch session (commands), development branch session (results) |

The `Owner` column identifies the session that normally edits each section. Planning trunk session creates the initial file shell and reviews plan-level consistency. During Stage 1e-1, planning branch session fills design sections. If a phase is marked deferred design, design refinement session finalizes deferred sections before implementation. Development trunk session may perform documentation-only consistency fixes during review.

Implementation progress is tracked only in `plan.md`. Do not duplicate progress status in phase files.

Sections marked "Before the implementation session starts" are the ones most likely to cause mid-session pauses if left blank.

---

## Template

Copy the block below into a new phase file at `.github/plans/phase-N.md` when creating a phase.

---

### Phase N: <Title>

_<One- or two-sentence statement of what this phase accomplishes and the specific mechanism used. Avoid vague goals; name the API, pattern, or change._

#### Design Maturity

- [ ] Implementation-ready
- [ ] Deferred design

#### Design References

_Links to instruction files or roadmap items that specify the target behavior. Omit the section entirely if no external spec applies._

- `instructions/<name>.instructions.md` — <relevant section or topic>
- Roadmap item: "<item title>"

#### Design Decisions

_Pre-resolved choices that the implementation session must not re-open. This is the most important section. Every uncontrolled missing entry here is a potential undesirable pause during implementation._

_If the phase is implementation-ready, this section must contain finished choices only. If the phase is deferred design, resolve everything that can already be fixed now and defer only the bounded remainder described in Deferred Design Controls._

Fill in all that apply:

- **Preferred API / library / Node.js built-in**: <what to use and why>
- **Owning layer**: <which layer owns the change and why other layers do not>
- **Output stream**: stdout vs stderr; format and when it is emitted
- **Timing / measurement**: approach if observability or clocks are involved
- **New runtime dependencies**: allowed, or none
- **Edge case behavior**: <e.g. what happens when the state file is missing, or input is empty>
- **Any other non-obvious decision that was consciously made**

#### Deferred Design Controls

_Include this section only when the phase is marked as deferred design. This section is required for deferred design and should not be used as a generic backlog of unresolved thoughts._

- **Why deferred**: <why the remaining design depends on predecessor implementation evidence>
- **Depends on**: <predecessor phase(s), branch summaries, diffs, or repository state that must exist first>
- **Fixed before refinement**: <constraints or decisions that are already locked and must not be reopened>
- **To be finalized in refinement**: <specific design decisions that are intentionally deferred>
- **Refinement trigger**: <the exact event that allows reopening, such as "Phase 1 implementation and review completed">
- **Required inputs**: <artifacts the refinement session must inspect>

#### Non-Goals

_Explicitly out-of-scope work. Prevents scope creep during implementation. At least one entry is expected for every phase that touches a shared module._

- <adjacent improvement that is intentionally deferred>
- <related feature that belongs to a different phase>

#### Target Files

_Files to create or modify. Enough detail to start without a workspace exploration step. If the phase is deferred design, list the files or file areas already known and mark provisional entries clearly until refinement finalizes them._

| File                   | Action | Notes                                  |
| ---------------------- | ------ | -------------------------------------- |
| `src/foo/bar.ts`       | Modify | <what changes>                         |
| `src/foo/types.ts`     | Modify | <what changes>                         |
| `test/foo/bar.test.ts` | Modify | <what test cases are added or changed> |

#### Documentation Touchpoints

_Sections in `docs/`, `instructions/`, or other markdown files that describe behavior this phase changes or resolves. Enumerate every section that will become stale or incorrect after implementation — including "known limitation", "future work", and "future enhancement" entries that the phase implements. Planning/design sessions are responsible for listing these touchpoints. Development branch sessions are responsible for applying the listed updates during implementation. If the phase is deferred design, list touchpoints known during planning and finalize them during refinement before implementation._

_Omit this section entirely if the phase makes no change to documented behavior._

| File                                       | Section           | Action                        |
| ------------------------------------------ | ----------------- | ----------------------------- |
| `docs/design/foo.md`                       | "<Section title>" | <Replace \| Update \| Remove> |
| `.github/instructions/bar.instructions.md` | "<Section title>" | <Replace \| Update \| Remove> |

#### Implementation Notes

_Non-obvious implementation details not already covered by Design Decisions. Use this section only for execution guidance, ordering constraints, or local technical notes. Do not use it to introduce, revise, or defer Design Decisions. Omit the section entirely if everything is clear from the above._

- <gotcha, ordering constraint, or subtlety worth noting>

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- <what to run and what to confirm in the output>
- <any regression to check against prior behavior>

---

## Authoring Notes

- Declare the phase's Design Maturity explicitly. The default target is `Implementation-ready`; use `Deferred design` only when the remaining design truly depends on predecessor implementation evidence.
- **Design Decisions before Non-Goals before Target Files.** This order matters: decisions constrain which files need to change, and non-goals constrain which files should not be touched.
- Write Design Decisions as finished choices, not as open questions. If a choice is still open, resolve it before marking the phase file implementation-ready. The only exception is a bounded deferred-design phase with a completed Deferred Design Controls section.
- A complete phase file should reduce undesirable pauses during implementation. It should not attempt to suppress required escalations or authorization gates defined by the workflow.
- Design each phase to fit within a single implementation session when reasonably possible. If that would require forcing unrelated work together or making the phase too ambiguous, prefer a clearer phase boundary over strict single-session sizing.
- Use Deferred Design Controls only to name the exact decisions that must wait for predecessor implementation evidence, and keep that deferred surface as small as possible.
- Behavioral verification items should cover user-visible changes. "Build and tests pass" alone is not sufficient when the phase changes CLI behavior or output format.
- Keep Implementation Notes minimal. If an implementation detail is important enough to note, consider whether it belongs in Design Decisions instead.
- Implementation Notes are for execution guidance only. If a note changes the technical approach, ownership boundary, external behavior, or any other substantive design choice, it belongs in Design Decisions instead.
- **Documentation Touchpoints are a planning/design obligation and an implementation obligation.** Planning/design sessions must list them explicitly; development branch sessions must execute those listed updates. Identify touchpoints by reading every file listed under Design References and asking: "Does this file contain text that describes the world before this phase?" Phases that resolve a roadmap item, implement a "future work" entry, or remove a "known limitation" will almost always have at least one touchpoint.
