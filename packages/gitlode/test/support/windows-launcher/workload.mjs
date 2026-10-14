import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const [mode, root, lifetime] = process.argv.slice(2);
writeFileSync(
  join(root, `${mode}.json`),
  JSON.stringify({ pid: process.pid, parent: process.ppid }),
);
if (mode === "leader" || mode === "intermediate") {
  const next = mode === "leader" ? "intermediate" : "descendant";
  const child = spawn(process.execPath, [import.meta.filename, next, root, lifetime], {
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
} else if (lifetime === "normal") {
  setTimeout(() => writeFileSync(join(root, "settled.json"), "true"), 800);
} else {
  setInterval(() => {}, 1000);
}
