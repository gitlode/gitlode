import pathlib, shutil

root = pathlib.Path('/home/t-wakabayashi/gitlode-performance/m2-rss-experiment-20261006T1106')
source = root / 'checkout/source'
experiment = source / 'experiments/otel-m2-disabled-rss'
experiment.mkdir(parents=True)
shutil.copy2(__file__, experiment / 'prepare-variants.py')
shutil.copy2('/mnt/c/Users/t-wakabayashi/source/gitlode/.cache/m2-rss-experiment/bootstrap.py', experiment / 'bootstrap.py')
shutil.copy2(root / 'launch.cjs', experiment / 'launch.cjs')
execution = source / 'packages/gitlode/src/execution'
(execution / 'rss-experiment-observation.ts').write_text('''import { appendFileSync } from "node:fs";
import { isMainThread, threadId } from "node:worker_threads";

export function observeRssExperiment(boundary: string, detail?: unknown): void {
  const path = process.env.GITLODE_RSS_EXPERIMENT_LOG;
  if (!path) return;
  const timestamp = new Date().toISOString();
  const memory = process.memoryUsage();
  appendFileSync(path, JSON.stringify({ boundary, timestamp, pid: process.pid, threadId, isMainThread, ...memory, detail }) + "\\n");
}
''')
path = execution / 'worker-entry.ts'; text = path.read_text()
text = 'import { observeRssExperiment } from "./rss-experiment-observation.js";\n' + text
text = text.replace('parentPort.once("message",', 'observeRssExperiment("worker-after-imports-before-request");\n\nparentPort.once("message",')
path.write_text(text)
path = execution / 'worker-client.ts'; text = path.read_text()
text = 'import { observeRssExperiment } from "./rss-experiment-observation.js";\n' + text
text = text.replace('    const worker = new Worker(', '    observeRssExperiment("host-after-imports-before-worker");\n    const worker = new Worker(')
text = text.replace('    worker.on("exit", (code) => {', '    worker.on("exit", (code) => {\n      observeRssExperiment("host-after-worker-exit", { code });')
text = text.replace('      resultReceived = true;', '      observeRssExperiment("host-application-result", value.result);\n      resultReceived = true;')
path.write_text(text)
path = execution / 'execute-run.ts'; text = path.read_text()
text = 'import { observeRssExperiment } from "./rss-experiment-observation.js";\n' + text
text = text.replace('  const sessionTimestamp = new Date();', '''  observeRssExperiment("worker-after-disabled-composition", {
    profile: input.profile,
    recordingEnabled: session?.recordingEnabled,
    rootRecording: session?.rootSpan.isRecording(),
  });
  const sessionTimestamp = new Date();''')
text = text.replace('      const result = await coordinator.run({', '      observeRssExperiment("worker-before-extraction");\n      const result = await coordinator.run({')
text = text.replace('  const finalized = await session.finalize(applicationResult);', '  observeRssExperiment("worker-after-extraction-before-finalization", { kind: applicationResult.kind });\n  const finalized = await session.finalize(applicationResult);')
path.write_text(text)
(experiment / 'README.md').write_text('''# M2 bounded disabled RSS experiment

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
''')
print('V0 common observations prepared')
