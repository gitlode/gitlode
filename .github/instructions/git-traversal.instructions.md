---
description: Git DAG traversal, differential extraction, and state file management for gitlode
applyTo: "src/git/**,src/core/**"
---

# Git Traversal Instructions

This file is a GitHub Copilot routing shim.

Canonical source:

- `packages/gitlode/docs/design/git-traversal.md`

For related work, also read:

- `packages/gitlode/docs/design/walk-commits-strategies.md` for internal `walkCommits` strategy work
- `packages/gitlode/docs/design/architecture.md` when traversal changes affect module boundaries or ownership
- `packages/gitlode/docs/design/schema.md` when traversal changes affect emitted records or state-derived output behavior

Do not treat this file as an independent source of truth.
