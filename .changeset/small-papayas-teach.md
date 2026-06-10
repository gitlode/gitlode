---
"gitlode": minor
---

Runtime execution now uses a worker-thread boundary: extraction runs in an isolated worker while the main process owns bootstrap, state preflight/load, final state persistence, and process-level rendering/exit handling. Extracted JSONL data semantics and output schema remain unchanged.
