---
name: multi-session-development-setup
description: Adopt or refresh the multi-session development protocol in an existing or new Git repository. Inspect repository instructions, CI and Git conventions first, reconcile AGENTS.md and optional appendix with Human approval, and assess readiness without imposing a fixed layout.
---

# Multi-session development (Setup / Adoption)

Read `../_multi-session-shared/repository-integration-contract.md` before inspection. Read `../_multi-session-shared/core-protocol.md` only as needed to interpret ambiguities; it is not a template to copy into the repository. If shared files or runtime Skill are missing, report incomplete installation.

## Procedure

1. **Inspect read-only first.** Locate applicable `AGENTS.md` layers and any existing relevant instructions/Skills; inspect Git branches/remotes, CONTRIBUTING, architecture/coding documents, CI/test tooling, branch/PR guidance, and existing task-artifact conventions. Do not infer an undocumented policy from a filename alone.
2. **Map evidence to the Integration Contract.** Identify activation, repository bindings, and blockers. Mark uncertainty as unresolved rather than inventing repository policy.
3. **Assess readiness.** Return ready / ready-with-deferred-bindings / blocked with concise supporting evidence, material gaps, and proposed minimum edits. Lack of a project appendix or comprehensive architecture documentation is not itself a failure.
4. **Ask targeted questions.** Ask Human about unresolved consequential repository policies and conflicting instructions, grouping only necessary questions. Don't ask what can be discovered or safely deferred to Task framing.
5. **Propose and reconcile edits.** Prefer a short additive activation note in existing `AGENTS.md`; reference project docs rather than duplicating them. Create an appendix only if it materially improves clarity. Respect existing layouts and instruction hierarchy. Show the proposed changes and secure Human approval before changes to project policy or existing instructions.
6. **Apply and check.** Make only approved edits, inspect resulting diff, validate references/accessibility/conflicts, then reassess readiness. Report untested assumptions explicitly. Do not create a development Task or run application changes during setup unless separately requested.

## Deliverables

- Readiness summary: status, supporting evidence and unresolved blockers/deferred bindings.
- Minimal repository changes when approved, e.g. activation snippet in `assets/agents-activation-example.md` and optional appendix pattern in `assets/appendix-example.md`.
- List exact paths changed and follow-up questions; never claim that a file or Skill was installed merely because an example was generated.

## Constraints

- Preserve existing `AGENTS.md` semantics and other agents' instructions. Additive edits are preferred.
- Do not change branch protection, CI, Git hooks, permissions or merge policy as a side effect of onboarding.
- Don't force architecture docs, work item trackers, templates or fixed coordination paths into small repositories.
- Avoid auto-invoking Runtime to run an actual Task as a 'readiness check'.
