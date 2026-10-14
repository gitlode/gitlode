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
    detached: true,
  });
  child.once("spawn", () =>
    writeFileSync(
      join(root, `${mode}-spawn.json`),
      JSON.stringify({ event: "spawn", pid: child.pid, parent: process.pid, next }),
    ),
  );
  child.once("error", (error) =>
    writeFileSync(
      join(root, `${mode}-error.json`),
      JSON.stringify({
        event: "error",
        parent: process.pid,
        next,
        code: String(error.code).slice(0, 40),
      }),
    ),
  );
  child.once("exit", (code, signal) =>
    writeFileSync(
      join(root, `${mode}-child-exit.json`),
      JSON.stringify({ event: "exit", pid: child.pid, parent: process.pid, code, signal }),
    ),
  );
  process.once("exit", (code) =>
    writeFileSync(
      join(root, `${mode}-exit.json`),
      JSON.stringify({ event: "self-exit", pid: process.pid, code }),
    ),
  );
  child.unref();
} else if (lifetime === "normal") {
  setTimeout(() => writeFileSync(join(root, "settled.json"), "true"), 800);
} else {
  setInterval(() => {}, 1000);
}
