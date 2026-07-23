---
"gitlode": minor
---

[Changed] Extended the config-selectable `git-cli` adapter to discover file changes and read blob content through the system Git executable instead of delegating file extraction to isomorphic-git. File-size guards, binary detection, and line-diff computation now use shared adapter-independent orchestration, and oversized files no longer invoke the line-diff engine. The default adapter, configuration shape, and file-level output contract remain unchanged.
