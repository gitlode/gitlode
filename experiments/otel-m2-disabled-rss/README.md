# M2 bounded disabled RSS experiment

Instruction checkpoint: 3ed250b4f89b639ff23e25312d5bb81d7d68f4ea.
Fixed product/harness base: 8fffcc0d8e11bb061d70bf870f262092d559c5f2.
Diagnostic work only; no PR, merge, formal evaluation or production acceptance.
Quiet host window: 2026-10-06 11:06–14:06 JST; hard operator stop 14:06 JST.
Execution/processing deadlines: 300000 ms each; total workload budget 1800000 ms.
Order: V0,V1,V2,V2,V1,V0. No warmups or retries.

V0 adds fixed boundary observations only. V1 replaces disabled SDK providers
with an unregistered API ProxyTracerProvider and createNoopMeter; the private
proxy never receives a delegate and cannot become active via a global provider.
V1 retains eager SDK/session loading and the existing session lifecycle.
V2 additionally routes disabled creation through a small API-only session;
enabled creation and test-only enabled creation dynamically load the existing
session. Wrappers, catalogs and extraction behavior remain unchanged.

Observations capture process RSS and isolate memory before one synchronous JSONL
append per boundary. No per-record observations. Host application-result capture
is constant-size for this fixture and occurs after extraction. It permits result
verification with quiet stdout. Shared-process RSS is never summed across isolates;
arrayBuffers overlaps external. Observation I/O, bundle layout, cache, order,
GC/native residency and two replicates limit attribution.

Each variant is committed and normally pushed before its build/probe is executed.
The identities note maps OIDs to fixed runtime inventories outside Git. All raw
evidence and runtime copies remain outside F archives and outside Git.
