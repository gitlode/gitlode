# Plugin and Monorepo Execution Strategy

This document is the execution-focused strategy for plugin introduction, monorepo migration, and CI/CD evolution.

- Primary audience: LLM sessions that need explicit, stable decision context.
- Secondary audience: maintainers reviewing why decisions were made and when to apply them.
- Relationship to roadmap: roadmap records backlog entries; this document records cross-version execution policy.

> Scope note: This is a strategy and operating document, not a committed release log. Final shipped outcomes are tracked in `CHANGELOG.md`.

## Decision Status Legend

- `Decided`: explicitly agreed and active.
- `Planned`: direction agreed; exact implementation may be timed later.
- `Deferred`: intentionally postponed until trigger conditions are met.

## Axis A: Policy Matrix (Topic-Based)

| Topic                          | Current policy                                                             | Status  | Future direction / trigger                                                       |
| ------------------------------ | -------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| Development model              | Use npm workspaces monorepo.                                               | Decided | Keep unless repository scale requires stronger tooling.                          |
| Distribution model             | Publish official plugins as separate npm packages.                         | Decided | Continue; no bundling into `gitlode` package.                                    |
| Core package name              | Keep core package name as `gitlode`.                                       | Decided | No rename planned.                                                               |
| Official plugin naming         | Use `@gitlode/*` scope for official plugins.                               | Decided | Scope secured; continue as baseline.                                             |
| TypeScript config sharing      | Root shared config + per-package `extends`.                                | Decided | Add project references only when needed by package growth.                       |
| Compatibility declaration      | Official plugins must declare `peerDependencies` on `gitlode`.             | Decided | Keep minor-bounded ranges and update on API boundary changes.                    |
| Runtime compatibility behavior | Version mismatch should emit warning, not fatal by default.                | Decided | Revisit only if frequent unsafe mismatches occur.                                |
| Compatibility CI matrix        | Validate plugin compatibility at lower bound + latest supported `gitlode`. | Decided | Expand matrix only when support range broadens.                                  |
| CI/CD architecture             | Start simple (integrated workflows), then evolve in stages.                | Decided | Move to split package workflows when plugin count and release frequency justify. |
| Release management tool        | Keep changesets as near-future adoption target.                            | Planned | Introduce together with CI/CD split stage.                                       |
| GitHub Web Releases            | Continue short-term as a practical operation path.                         | Planned | Reposition as summary channel after package-oriented automation matures.         |

## Axis B: Release Timeline (Timing-Based)

| Timing                                           | Intended reflection in project                                                             | Guardrails                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `v0.6.2`                                         | Monorepo migration and operational groundwork only.                                        | No intentional user-facing behavior change. Validate diffs post-migration and iterate until no unacceptable differences remain. |
| `v0.7.0`                                         | Introduce pluggable interface foundation in core.                                          | Keep plugin ecosystem initial scope controlled and explicit.                                                                    |
| Early `v0.7.x`                                   | Ship first official plugins: hello-world oriented plugin first, then general-value plugin. | Preserve compatibility signaling (`peerDependencies`, warning policy, compatibility notes).                                     |
| Plugin growth point (about 2-3 official plugins) | Adopt changesets and split CI/CD by package/release responsibility.                        | Keep migration transactional: introduce release tooling and CI/CD split together.                                               |
| Mid-term scaling                                 | Expand TS build graph and CI matrix only when needed by package scale.                     | Avoid pre-optimization before concrete pressure appears.                                                                        |

## Accepted Validation Approach for `v0.6.2`

The accepted process is post-change validation and iteration, not strict pre-definition of equality.

Allowed differences:

- version bump metadata
- publish-time metadata differences
- internal repository restructuring that does not affect published artifacts or runtime behavior

Not allowed differences:

- CLI behavior changes
- output contract changes
- unintended `npm pack` file set changes
- substantive dependency / `bin` / export behavior changes
- observable test-result regressions

## Plugin Rollout Order (Current Plan)

1. Hello-world oriented plugin: Custom Field Plugin
2. First general-value plugin: Conventional Commits Parser

Notes:

- Detailed plugin architecture and config schema are decided in the plugin-design phase, not in this strategy file.
- This file governs rollout sequencing and operating constraints across releases.

## CI/CD Stage-Transition Trigger

Transition from integrated CI/CD to split package-oriented CI/CD is recommended when both conditions are true:

1. Official plugin count reaches practical multi-package operations (about 2-3 packages).
2. Release operations begin to require per-package version coordination repeatedly.

When triggered, adopt both in one migration window:

- changesets
- package-oriented CI/CD split

## Open Items (Tracked, Not Blocking Current Direction)

- Exact workflow granularity after CI/CD split (how many workflows per package group).
- Exact GitHub Release usage pattern after package-oriented automation is active.
- Project-reference timing criteria for TypeScript once package graph grows.

## Update Rule

When a policy decision changes, update this file first, then update roadmap entry summaries as needed.
