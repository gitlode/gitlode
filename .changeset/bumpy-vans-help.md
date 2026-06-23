---
"gitlode": minor
---

[Changed] Improved `walkCommits` traversal performance for differential extraction by avoiding some unnecessary reads of older excluded history. The set of emitted commit records is unchanged, but commit output order may differ from previous versions. Depending on repository topology, traversal may be faster; cases that cannot be safely optimized fall back to the previous full exclusion behavior.
