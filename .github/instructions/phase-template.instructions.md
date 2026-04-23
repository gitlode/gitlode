---
description: Standard phase file template — structure, required fields, and authoring guidance
---

# Phase File Template

## Purpose

This file defines the standard structure for individual phase files under `.github/plans/`.

The goal is to ensure that every phase is specified thoroughly enough to execute, when reasonably possible, within a single implementation session with minimal design judgment at runtime. A phase file that is incomplete at planning time will force the implementer to pause and make architectural choices mid-session — which is exactly the failure mode this template is designed to prevent.

Phase files are working documents for the current release only. They are not intended to serve as permanent archival records in the repository.

## Pause Types in This Workflow

This workflow distinguishes three different kinds of pauses:

1. **Undesirable pause**: implementation stops because planning left a design decision unresolved.
2. **Required escalation**: implementation stops because new evidence shows that a human decision is needed.
3. **Authorization gate**: implementation or planning stops because the current step is complete and the workflow requires explicit human authorization before the next step begins.

This template is designed to reduce **undesirable pauses**. It does **not** attempt to eliminate required escalations or authorization gates.

## Relationship to Other Files

| File                                                        | Role                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `.github/PLAN.md`                                           | Active release plan; phase list with status and release-level context       |
| `.github/plans/phase-N.md`                                  | Individual phase files using this template                                  |
| `.github/instructions/development-workflow.instructions.md` | End-to-end development lifecycle; defines when and how phase files are used |
| `.github/roadmap.md`                                        | Long-horizon backlog; feeds into PLAN.md releases                           |
| `.github/instructions/*.instructions.md`                    | Technical specifications; linked from phase Design References               |
| `.github/copilot-instructions.md`                           | Project-level conventions                                                   |

## When to Fill Each Section

| Section                   | When                                                                  | Owner                                      |
| ------------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| Title, summary, Status    | When the phase file is first created                                  | Planning session                           |
| Design References         | Planning session                                                      | Planning session                           |
| Design Decisions          | **Before the implementation session starts**                          | Planning/pre-implementation session        |
| Non-Goals                 | Before implementation                                                 | Planning session                           |
| Target Files              | Before implementation                                                 | Planning/pre-implementation session        |
| Documentation Touchpoints | Before implementation                                                 | Planning session                           |
| Implementation Notes      | When non-obvious details are known                                    | Pre-implementation or early implementation |
| Verification              | Before implementation (commands); after first run (behavioral checks) | Pre-implementation session                 |

Sections marked "Before the implementation session starts" are the ones most likely to cause mid-session pauses if left blank.

---

## Template

Copy the block below into a new phase file at `.github/plans/phase-N.md` when creating a phase.

---

### Phase N: <Title>

_<One- or two-sentence statement of what this phase accomplishes and the specific mechanism used. Avoid vague goals; name the API, pattern, or change._

#### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

#### Design References

_Links to instruction files or roadmap items that specify the target behavior. Omit the section entirely if no external spec applies._

- [`instructions/foo.instructions.md`](foo.instructions.md) — <relevant section or topic>
- Roadmap item: "<item title>"

#### Design Decisions

_Pre-resolved choices that the implementation session must not re-open. This is the most important section. Every missing entry here is a potential undesirable pause during implementation._

Fill in all that apply:

- **Preferred API / library / Node.js built-in**: <what to use and why>
- **Owning layer**: <which layer owns the change and why other layers do not>
- **Output stream**: stdout vs stderr; format and when it is emitted
- **Timing / measurement**: approach if observability or clocks are involved
- **New runtime dependencies**: allowed, or none
- **Edge case behavior**: <e.g. what happens when the state file is missing, or input is empty>
- **Any other non-obvious decision that was consciously made**

#### Non-Goals

_Explicitly out-of-scope work. Prevents scope creep during implementation. At least one entry is expected for every phase that touches a shared module._

- <adjacent improvement that is intentionally deferred>
- <related feature that belongs to a different phase>

#### Target Files

_Files to create or modify. Enough detail to start without a workspace exploration step._

| File                   | Action | Notes                                  |
| ---------------------- | ------ | -------------------------------------- |
| `src/foo/bar.ts`       | Modify | <what changes>                         |
| `src/foo/types.ts`     | Modify | <what changes>                         |
| `test/foo/bar.test.ts` | Modify | <what test cases are added or changed> |

#### Documentation Touchpoints

_Sections in `docs/`, `instructions/`, or other markdown files that describe behavior this phase changes or resolves. Enumerate every section that will become stale or incorrect after implementation — including "known limitation", "future work", and "future enhancement" entries that the phase implements._

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

- **Design Decisions before Non-Goals before Target Files.** This order matters: decisions constrain which files need to change, and non-goals constrain which files should not be touched.
- Write Design Decisions as finished choices, not as open questions. If a choice is still open, resolve it in a planning conversation before marking the phase file ready for implementation.
- A complete phase file should reduce undesirable pauses during implementation. It should not attempt to suppress required escalations or authorization gates defined by the workflow.
- Design each phase to fit within a single implementation session when reasonably possible. If that would require forcing unrelated work together or making the phase too ambiguous, prefer a clearer phase boundary over strict single-session sizing.
- Behavioral verification items should cover user-visible changes. "Build and tests pass" alone is not sufficient when the phase changes CLI behavior or output format.
- Keep Implementation Notes minimal. If an implementation detail is important enough to note, consider whether it belongs in Design Decisions instead.
- Implementation Notes are for execution guidance only. If a note changes the technical approach, ownership boundary, external behavior, or any other substantive design choice, it belongs in Design Decisions instead.
- **Documentation Touchpoints are a planning obligation, not a post-implementation cleanup.** Identify them by reading every file listed under Design References and asking: "Does this file contain text that describes the world before this phase?" Phases that resolve a roadmap item, implement a "future work" entry, or remove a "known limitation" will almost always have at least one touchpoint. These sections must be listed explicitly — a vague "update docs/" in the Documentation Update release task is not a substitute.
