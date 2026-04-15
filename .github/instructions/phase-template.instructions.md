---
description: Standard phase section template for PLAN.md — structure, required fields, and authoring guidance
---

# Phase Section Template

## Purpose

This file defines the standard structure for phase sections in `.github/PLAN.md`.

The goal is to ensure that every phase is specified thoroughly enough to execute in a single implementation session with minimal design judgment at runtime. A phase section that is incomplete at planning time will force the implementer to pause and make architectural choices mid-session — which is exactly the failure mode this template is designed to prevent.

## Relationship to Other Files

| File                                     | Role                                                          |
| ---------------------------------------- | ------------------------------------------------------------- |
| `.github/PLAN.md`                        | Active release plan; contains one phase section per work unit |
| `.github/instructions/roadmap.md`        | Long-horizon backlog; feeds into PLAN.md releases             |
| `.github/instructions/*.instructions.md` | Technical specifications; linked from phase Design References |
| `.github/copilot-instructions.md`        | Global conventions; see "Planning & Phase-Execution Guidance" |

## When to Fill Each Section

| Section                | When                                                                  | Owner                                      |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| Title, summary, Status | When the phase is first added to PLAN.md                              | Planning session                           |
| Design References      | Planning session                                                      | Planning session                           |
| Design Decisions       | **Before the implementation session starts**                          | Planning/pre-implementation session        |
| Non-Goals              | Before implementation                                                 | Planning session                           |
| Target Files           | Before implementation                                                 | Planning/pre-implementation session        |
| Implementation Notes   | When non-obvious details are known                                    | Pre-implementation or early implementation |
| Verification           | Before implementation (commands); after first run (behavioral checks) | Pre-implementation session                 |

Sections marked "Before the implementation session starts" are the ones most likely to cause mid-session pauses if left blank.

---

## Template

Copy the block below into PLAN.md for each new phase.

---

### Phase N: \<Title\>

_\<One- or two-sentence statement of what this phase accomplishes and the specific mechanism used. Avoid vague goals; name the API, pattern, or change.\>_

#### Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

#### Design References

_Links to instruction files or roadmap items that specify the target behavior. Omit the section entirely if no external spec applies._

- [`instructions/foo.instructions.md`](foo.instructions.md) — \<relevant section or topic\>
- Roadmap item: "\<item title\>"

#### Design Decisions

_Pre-resolved choices that the implementation session must not re-open. This is the most important section. Every missing entry here is a potential pause point during implementation._

Fill in all that apply:

- **Preferred API / library / Node.js built-in**: \<what to use and why\>
- **Owning layer**: \<which layer owns the change and why other layers do not\>
- **Output stream**: stdout vs stderr; format and when it is emitted
- **Timing / measurement**: approach if observability or clocks are involved
- **New runtime dependencies**: allowed, or none
- **Edge case behavior**: \<e.g. what happens when the state file is missing, or input is empty\>
- **Any other non-obvious decision that was consciously made**

#### Non-Goals

_Explicitly out-of-scope work. Prevents scope creep during implementation. At least one entry is expected for every phase that touches a shared module._

- \<adjacent improvement that is intentionally deferred\>
- \<related feature that belongs to a different phase\>

#### Target Files

_Files to create or modify. Enough detail to start without a workspace exploration step._

| File                   | Action | Notes                                    |
| ---------------------- | ------ | ---------------------------------------- |
| `src/foo/bar.ts`       | Modify | \<what changes\>                         |
| `src/foo/types.ts`     | Modify | \<what changes\>                         |
| `test/foo/bar.test.ts` | Modify | \<what test cases are added or changed\> |

#### Implementation Notes

_Non-obvious implementation details not already covered by Design Decisions. Omit the section entirely if everything is clear from the above._

- \<gotcha, ordering constraint, or subtlety worth noting\>

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- \<what to run and what to confirm in the output\>
- \<any regression to check against prior behavior\>

---

## Authoring Notes

- **Design Decisions before Non-Goals before Target Files.** This order matters: decisions constrain which files need to change, and non-goals constrain which files should not be touched.
- Write Design Decisions as finished choices, not as open questions. If a choice is still open, resolve it in a planning conversation before adding the phase to PLAN.md.
- Behavioral verification items should cover user-visible changes. "Build and tests pass" alone is not sufficient when the phase changes CLI behavior or output format.
- Keep Implementation Notes minimal. If an implementation detail is important enough to note, consider whether it belongs in Design Decisions instead.
