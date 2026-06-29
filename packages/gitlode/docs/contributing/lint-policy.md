# Lint Rule Adoption Policy

## Purpose & Scope

This document defines the canonical policy for evaluating and adopting oxlint rules in the gitlode
project. It governs how rules are proposed, evaluated, and recorded in `.oxlintrc.json`.

The policy is designed to balance quality with efficiency, using a human–LLM collaborative model
where humans make value judgments and LLMs handle impact investigation and autonomous execution
within defined boundaries.

Agent-specific entrypoints such as `.github/instructions/lint-policy.instructions.md` may route to
or summarize this document, but they must not replace it as the durable source of truth for lint
rule adoption.

## Background

Community-maintained oxlint rule sets (shareable configs on npm) exist but are considered premature
to adopt wholesale due to uncertain quality and stability at this stage of the ecosystem. Instead,
rules are evaluated individually according to the policies defined here.

---

## Category Policies

The following table defines LLM autonomy boundaries per category based on violation count and
auto-fixability of the rule against the current codebase.

| Category      | violations = 0                                  | violations > 0, all auto-fixable        | violations > 0, manual fix required                 |
| ------------- | ----------------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| `correctness` | LLM adopts autonomously                         | LLM applies fix and adopts autonomously | Propose to user with fix guidance                   |
| `suspicious`  | LLM adopts autonomously                         | LLM applies fix and adopts autonomously | Propose to user with fix guidance                   |
| `style`       | LLM adopts autonomously                         | Propose fix to user for confirmation    | User confirmation required; default to not adopting |
| `perf`        | User confirmation required                      | User confirmation required              | User confirmation required                          |
| `restriction` | User confirmation required (default: not adopt) | User confirmation required              | User confirmation required (default: not adopt)     |
| `pedantic`    | Do not adopt                                    | Do not adopt                            | Do not adopt                                        |
| `nursery`     | Do not adopt (revisit at periodic review)       | Do not adopt                            | Do not adopt (revisit at periodic review)           |

### Rationale for `style` policy

oxlint reports violations only (passing locations are not reported). Therefore, exact consistency
ratios cannot be computed. The policy approximates consistency as follows:

- violations = 0 implies the codebase already conforms, or the rule has no applicable locations.
  Either way, adoption incurs no code change and is safe to automate.
- violations > 0 implies at least one inconsistency. Human judgment is required to decide whether
  the style should be enforced across the codebase.

---

## Auto-fix Precondition

A rule may only be treated as "auto-fixable" under this policy when the following precondition holds:

> The fix is semantically equivalent in the target environment: **Node.js ≥ 22**.

If the target environment changes, this precondition must be re-evaluated before applying
autonomous fixes.

---

## Severity

- Adopted rules are always set to **`"error"`**.
- Non-adopted rules are always set to **`"off"`**.
- **`"warn"` is not used.**

This two-value model avoids ambiguity about CI behavior. Any violation of an adopted rule will fail
the CI pipeline immediately.

---

## Recording Adoption Rationale

Adoption decisions are recorded as comments directly in `.oxlintrc.json` (JSONC is officially
supported).

Guidelines:

- Record why a rule is adopted or not adopted.
- For `correctness` rules where the rationale is self-evident, the comment may be omitted.
- Comments should be concise; this is not a design document.

Example:

```jsonc
{
  "rules": {
    // Prevents accidental loss of precision for integer literals exceeding Number.MAX_SAFE_INTEGER.
    "no-loss-of-precision": "error",

    // no-console: restricted to prevent debug output leaking into CLI stdout.
    "no-console": "error",
  },
}
```

---

## Rule Review Cadence

oxlint rule adoption is **not** reviewed on every version upgrade.

Rules are revisited at **development milestones** (for example phase completions or pre-release
checkpoints). At each review:

1. List all rules not currently adopted in `.oxlintrc.json`.
2. Apply the category policies above to each candidate rule.
3. Update `.oxlintrc.json` with newly adopted rules and rationale comments.

This approach also naturally surfaces any `nursery` rules that have been promoted to a stable
category since the last review.

---

## Out of Scope (deferred)

The following topics are acknowledged but deferred until after v1.0.0:

- Detailed step-by-step LLM execution flow for rule evaluation sessions
- CI branch filtering for PoC branches where lint checks may be skipped
