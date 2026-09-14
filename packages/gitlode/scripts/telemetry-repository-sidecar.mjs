import { readFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";

const requestPath = process.argv[2];
if (!requestPath) throw new Error("missing sidecar request");
const request = JSON.parse(await readFile(requestPath, "utf8"));
const result = await new Promise((resolve, reject) => {
  const worker = new Worker(request.workerEntryPath);
  let settled = false;
  const finish = (value, error = false) => {
    if (settled) return;
    settled = true;
    void worker.terminate();
    (error ? reject : resolve)(value);
  };
  worker.on("message", (message) => {
    if (!message || typeof message !== "object")
      return finish(new Error("malformed worker message"), true);
    if (message.type === "result") return finish(message.result);
    if (message.type !== "progress" && message.type !== "diagnostic")
      return finish(new Error("unknown worker message"), true);
  });
  worker.once("error", (error) => finish(error, true));
  worker.once("exit", (code) => {
    if (!settled && code !== 0) finish(new Error(`worker exited with code ${String(code)}`), true);
    else if (!settled) finish(new Error("worker exited without a result"), true);
  });
  worker.postMessage(request.request);
});
process.stdout.write(`${JSON.stringify({ result })}\n`);
