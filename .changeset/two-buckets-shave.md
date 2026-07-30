---
"gitlode": patch
---

[Changed] Build the public package as a validated ESM bundle while preserving the existing CLI and plugin API. Release validation now verifies the installed CLI, worker, Git adapters, plugin loading, source maps, and public TypeScript declarations from the packed artifact.
