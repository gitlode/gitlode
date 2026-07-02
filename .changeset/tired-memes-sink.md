---
"gitlode": minor
---

[Changed] Profiling span names for DAG traversal are reorganized under the
`dag.traversal.*` prefix: `git.walk_commits.exclude_collect` becomes
`dag.traversal.collect_reachable`, `git.walk_commits.exclude_collect.read_commit`
becomes `dag.traversal.read_node.exclude`, and include-side node reads are now
separately instrumented as `dag.traversal.read_node.include`. The certified-lazy
fallback reason `"exclude_merge"` is renamed to `"exclude_path_split"`.
