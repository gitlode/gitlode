# Git CLI Adapter Handoff

## Status

The Git CLI adapter work planned in this handoff has completed through Phase 4. Stable behavior and
implementation contracts have been migrated to durable documentation:

- adapter selection and implementation boundaries: [`../design/git-adapters.md`](../design/git-adapters.md);
- user-facing config and workflows: [`../usage.md`](../usage.md);
- config schema and precedence: [`../design/configuration.md`](../design/configuration.md);
- profiling diagnostics: [`../profiling.md`](../profiling.md).

This file now remains only as continuation context for possible follow-up work. New design discussion
should happen in chat/review first, then be summarized here only if it remains unresolved.

## Completed decisions

- `runtime.gitAdapter` is config-only; there is no CLI flag.
- Supported values are `"isomorphic-git"` and `"git-cli"`; default is `"isomorphic-git"`.
- `git-cli` validates the Git executable with `git --version` before traversal.
- `git-cli` is a hybrid adapter: Git CLI handles traversal-oriented operations, while file-change
  expansion delegates to the existing isomorphic-git path.
- Adapter correctness is set-based. Commit/file-change output ordering is not required to match
  across adapters.
- Profiling records `git.adapter` for all runs and `git.cli.version` when the Git CLI adapter is
  selected.

## Follow-up candidates

- Consider a full CLI file-change implementation if file-granularity extraction becomes a bottleneck.
- Replace the per-commit `git diff-tree` change-discovery process with direct commit/tree object
  reads over the repository-scoped persistent `git cat-file --batch` session, then compare tree
  structure in TypeScript. Profiling on Windows showed that CLI blob reads were faster than the
  isomorphic-git path, while one `diff-tree` process per commit dominated file-granularity runtime.
  Keep this as a separate follow-up: preserve raw A/M/D facts, file modes, symlink/submodule
  transitions, consumer-paced blob materialization, and the rule that rename detection remains
  outside `GitAdapter`.
- Add benchmark fixtures or scripts for large `v9..v10` style ranges if repeatable performance
  comparisons become part of routine development.
- Revisit adapter interface decomposition only if future adapters make the current `GitAdapter`
  boundary awkward.
