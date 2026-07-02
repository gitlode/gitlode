---
"gitlode": minor
---

[Added] Added a config-selectable git-cli Git adapter for users who want gitlode to delegate traversal-heavy operations to the system Git executable. The default remains isomorphic-git, and the new git-cli mode can be enabled with runtime.gitAdapter: "git-cli" in the config file while preserving existing file-change output behavior.
