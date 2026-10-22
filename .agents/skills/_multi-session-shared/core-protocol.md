# Core Protocol — V1

This document is authoritative for collaboration behavior. Project documentation supplies domain-specific rules. Do not replace concrete repository constraints with guesses.

## Principles and authority

- Human owns the Task, product intent, consequential decisions, and final closure. Human ownership means informed accountability, **not** superior technical expertise.
- Agents actively analyze, challenge, propose alternatives, and explain significant trade-offs. Consequential choices require meaningful Human participation, not ceremonial approval.
- Execution responsibility and decision authority are distinct. Agent may decide within explicitly delegated or incidental authority; surface unresolved consequential choices before acting on them.
- Human must understand consequential behavior, design, risk, and verification, not every incidental line. Scale review depth with consequence, novelty, uncertainty, and coherence; seek coherent, reviewable work units rather than merely small diffs.
- Follow applicable project architecture, instructions, policies, and checks. The core does not prescribe domain taxonomy, language, directory layout, or detailed coding standards.

## Roles and work model

- One **Task** has exactly one **logical accountable Trunk** at a time; this does not mandate one physical Trunk session.
- **Trunk** maintains coherent Task state, collaborates on design, decomposes and delegates work, reviews and integrates outcomes, identifies decisions/uncertainty, builds completion evidence. Trunk has default authority over session design, including rotation and Branch assignments; Human may shape/override it.
- **Branch** owns a bounded Assignment outcome; design, research, review, and implementation are kinds of work, not extra roles. Branch may propose consequential changes but not approve them.
- Task and Assignment are work units, not session identities. Assignments may be executed by Trunk or Branch. Session topology must not create software architecture boundaries.

## Lifecycle (iterative, not waterfall)

1. **Frame**: align on objective, bounded scope, relevant context and visible consequential questions; do not demand detailed design.
2. **Plan**: agree sufficient approach for next execution, resolve blocking decisions, define coherent Assignments where helpful, verification strategy, and provisional session design.
3. **Execute**: act within scope, authority and repository constraints; verify locally where feasible; report deviations, uncertainty, and escalations. Continue independent safe work if another part is blocked.
4. **Integrate**: Trunk independently evaluates Assignment + Result + actual diff + evidence against Task and repository constraints; checks cross-Assignment coherence; resolves/escalates and updates canonical state. Repeat incrementally and replan when necessary.
5. **Close**: Trunk confirms objective, evidence, risks and non-blocking residuals; Human makes closure decision. Promote durable project knowledge to proper docs/tests/code, not only temporary coordination artifacts.

## Canonical state and handoff

- Session history and Branch reports are not canonical Task state. Trunk maintains one current-state projection, externalized into versioned repository artifacts when cross-session continuity calls for it.
- Task state (when externalized): **Objective, Scope, Decisions, Current State, Open Items**; optional **Acceptance**. Short current projection, not chronological log.
- A non-trivial cross-session Assignment uses a single lifecycle artifact with **Goal, Scope, Constraints, Authority, Completion, Result**. It should be sufficient to execute with links to repository knowledge, rather than copying that knowledge.
- Result reports **Outcome (completed/partial/blocked), Verification, Deviations, Escalations**. Clearly surface material uncertainties. Describe semantic effects, not redundant file listings.
- Deviation within delegated authority may be handled locally but reported when material; decision beyond authority must be escalated. Do not silently repair an insufficient Assignment by changing task intent.
- Branch Result is evidence, not acceptance. Trunk integrates accepted relevant information into canonical Task state. **Assignment accepted != Task integrated**.

## Git responsibility and isolation

- Every execution session is assigned a **base branch** and a **work branch** by Human (Trunk) or Trunk (Branch). The session shall not directly modify its base branch; base is for reading and eventual approved integration.
- Every session commits its work outcome on its assigned work branch, including meaningful partial/blocked work if any exists. Never commit unrelated, secret, or user-owned changes. If there is nothing to commit, report this explicitly rather than creating an empty commit.
- A Trunk starting a Branch assignment gives it a derived work branch, never the Trunk work branch itself. One derived branch may be used by multiple sequential physical sessions for one work stream.
- Trunk independently reviews derived changes and squash-integrates accepted outcome into Trunk work branch as a coherent commit. Reconcile temporary files before integration: squashing commits does **not** exclude temporary file content automatically.
- Whoever creates a derived branch tracks its disposition (delete after integration, or explicitly retain with reason). Avoid unmanaged branches. Do not delete branches with unintegrated work; ask Human when unclear.
- The work-to-base merge policy belongs to the project. The core does not prescribe PR merge strategy, naming, or protection rules. Never bypass repo branch protection or merge into base without appropriate approval.

## Repository knowledge and artifact lifecycle

- Core invariants/defaults < repository-specific bindings/policies < Task-specific instructions for specificity, **but** surface contradictions with durable project constraints rather than silently overriding them. Higher-priority safety/platform constraints always apply.
- Coordination artifacts (Task state, Assignment packets, reports) are temporary by default, even if committed during execution. Retention/archive may be specified by the project; meaningful permanent knowledge must be promoted before closure.
- Avoid rigid artifact layouts and unnecessary scaffolding. For small single-session tasks, repository artifacts and formal decomposition may be unnecessary.

## Closure and delivery distinction

- Trunk recommends closing when objective is satisfied, integrated state is coherent and verified sufficiently, and no unresolved blocker remains. Human decides closure after reviewing consequential behavior/design/risk/verification.
- Task closure does **not** itself authorize opening, approving, or merging a PR. Follow explicit Human instruction and repository delivery policy for those operations.
