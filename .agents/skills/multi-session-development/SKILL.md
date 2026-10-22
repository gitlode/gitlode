---
name: multi-session-development
description: Run a human-led software development Task using a logical Trunk and bounded Branch Assignments, Git isolation, evidence-based integration, and durable handoffs. Use for complex Codex tasks and for executing a Trunk or Branch assignment under this protocol.
---

# Multi-session development (Runtime)

Read `../_multi-session-shared/core-protocol.md` and `../_multi-session-shared/repository-integration-contract.md` before applying this workflow. Resolve paths relative to this `SKILL.md`. If missing, report an incomplete installation instead of inventing policy.

## Identify the execution role

- **Trunk**: accountable for the Task. Human supplies base branch and work branch (or authorizes creating a work branch from base). Maintain Task coherence and decision visibility.
- **Branch**: bounded Assignment. Trunk supplies base branch, derived work branch, Assignment location and decision boundary. Do not adopt Trunk-level authority.
- If role or branch identity is ambiguous and Git writes would be unsafe, ask for the missing binding before writing. In a read-only exploration, proceed without modifying repository state.

## Trunk workflow

1. Frame Task collaboratively; surface meaningful choices and reach Human agreement on consequential design decisions.
2. Discover project constraints. Create/update canonical Task state when continuity merits it, using `assets/task-template.md` as an optional lightweight starting point. Avoid mandatory ceremony on small Tasks.
3. Plan coherent Assignments and verification; decide session topology, including whether and when independent Branch or new physical Trunk sessions are useful. Do not assume tools can spawn sessions.
4. For delegated Branch work, derive an isolated branch from Trunk work state; create an Assignment artifact (see `assets/assignment-template.md`) and give Human a short launching prompt pointing to its path, base/work branches and role. Ensure each Branch session can access the committed packet. Coordinate shared-branch writes sequentially.
5. Evaluate each Branch output using actual Git changes, verification, applicable docs and Assignment Result. Do not accept by report alone. If accepted, remove/exclude ephemeral materials from selected diff and squash-integrate to Trunk work branch. Track derived branch disposition.
6. Update canonical Task state after meaningful transitions and escalation. Replan if execution or integration reveals important gaps.
7. Build completion evidence, highlight consequential review areas for Human, classify blockers/risks/future work, promote durable knowledge, clean temporary coordination artifacts and recommend closure. Human closes the Task.
8. Create a PR **only when tasked and permitted by project policy**; do not approve or merge on Human's behalf without explicit authorization.

## Branch workflow

1. Read the committed Assignment artifact and applicable repository docs; check base/work branches and worktree before editing. Do not write to base.
2. Execute the bounded Assignment within authority. Propose rather than silently decide consequential changes. Continue safe independent parts if another part is blocked.
3. Perform feasible scoped verification and inspect diffs for accidental edits/secrets.
4. Add the Result section to the Assignment artifact (or provide a report for Trunk canonicalization if writable access prevents it); commit meaningful outcome, including Result when appropriate, on assigned work branch. If no work is commit-worthy, report why.
5. Return a short Human/Trunk handoff with branch, commit SHA, artifact path, outcome, verification, material deviations and escalations. Do not treat the Result as accepted/integrated.

## Practical safeguards

- Preserve user changes, especially when switching branches/worktrees or cleaning artifacts. Never reset/rewrite shared state destructively without explicit approval.
- Commits on Branch work branch are checkpoints, not automatically accepted Task history. Squash integration requires explicit staged diff review and commit.
- A review or design Branch must not modify files outside its Assignment; a read-only Assignment can legitimately have no commit.
- Session handoff paths are accessible only if committed/shared to the target worktree; untracked files do not travel between Git branches.
