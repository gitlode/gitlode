# Repository Integration Contract — V1

This is the single authoritative interface between Runtime and Setup Skills. It describes **repository adoption requirements**, not the detailed Task execution rules (those live in `core-protocol.md`). Both Skills must read this file rather than maintain independent copies of these requirements.

## Readiness conditions

A repository is *ready* at assessment time when:

1. **Accessibility / activation:** Both Skills and shared files are readable from their installed sibling paths; suitable instructions/explicit invocation allow the runtime protocol to be used for the intended tasks. A user may explicitly invoke a Skill even when no auto-activation rule exists.
2. **Bindings:** The base/work branch assignment process and relevant project constraints can be resolved from current user instructions, repository docs/configuration, or safe defaults at Task start. Repository-specific conventions are referenced, not duplicated.
3. **No blocking conflicts:** No known unresolved conflict makes the workflow impossible or unsafe (e.g. base write required despite base protection, contradictory AGENTS.md instructions, missing Skill files).

Readiness is a point-in-time judgment, **not** permanent certification. An absent appendix or architecture document is not by itself a blocker. Information that can safely be decided at Task start need not be invented during setup. Inspect applicable constraints again during each Task.

## Repository binding surfaces

Discover before asking; bind by reference where possible:

- Activation: existing `AGENTS.md` or other supported repository instructions; keep the addition short and preserve existing content.
- Project-specific conventions: base branch defaults, branch naming, PR/merge policy, required checks, architecture/coding docs, coordination artifact placement and retention, protected branch rules. Look in existing docs, CI and tooling first.
- Optional **Project Appendix**: add only unresolved repository-specific bindings that cannot comfortably remain in existing documents. Do not duplicate repository handbooks.
- Task-specific: objective, scope, approved decisions, explicit base/work branches and other delegated authority are supplied by Human / Trunk during Task framing or assignment.

## Conflict precedence

Task-specific instructions specialize project conventions which specialize protocol defaults; they do not silently negate durable project invariants. Surface significant conflicts to Human. Platform/environment safety or permission restrictions take precedence over these documents.

## Setup Skill success criteria

- Inspect applicable existing instructions and project evidence.
- Produce a concise readiness assessment: ready / ready-with-deferred-bindings / blocked, evidence for each condition, unresolved questions and proposed minimal edits.
- Ask Human only questions that affect unresolved consequential policy; obtain approval before altering existing policy, rewriting `AGENTS.md`, or creating project governance.
- Reconcile existing files rather than overwriting. Prefer minimal activation addition and an optional appendix linking to sources.
- Reassess after edits. Do not claim a real runtime test was done unless executed.

## Runtime Skill obligations

- Check shared files are available; surface missing contract as installation issue, do not fabricate missing repository policy.
- Determine applicable repository constraints, Task base/work branches, and conflicts at start and upon meaningful change.
- Refer unresolved repository-policy conflicts or consequential ambiguities upward to Human (directly or via Trunk).
- Apply repo-specific bindings without copying full docs into Task artifacts.
