---
"gitlode": patch
---

Fix a runtime initialization bug where constants could be accessed too early due to import timing. Constants were moved into a dedicated module to stabilize evaluation order and prevent unexpected access during startup.
