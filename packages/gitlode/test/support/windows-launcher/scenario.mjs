import assert from "node:assert/strict";
import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

import { WindowsLauncher, finite, bounds } from "./launcher.ts";

const [mode, root, git] = process.argv.slice(2);
const start = performance.now();
const host = new WindowsLauncher();
let primary;
const steps = [];
const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
async function file(name) {
  return finite(
    (async () => {
      for (;;) {
        try {
          return JSON.parse(await readFile(join(root, name), "utf8"));
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          await wait(10);
        }
      }
    })(),
    2000,
    `receipt ${name}`,
  );
}
try {
  await finite(host.ready, bounds.ready, "inner ready");
  steps.push({
    phase: "ready",
    ms: performance.now() - start,
    compileMs: host.compileMs,
    hostInJob: host.hostInJob,
  });
  if (mode === "transport") {
    const args = ["space value", 'a"b', "trailing\\", "", '\\\\"', "日本語"];
    const command = host.launch(
      process.execPath,
      [
        "-e",
        "console.log(JSON.stringify({args:process.argv.slice(1),cwd:process.cwd(),env:process.env.STAGE_B}));process.stderr.write('error identity');process.exitCode=7",
        ...args,
      ],
      root,
      { ...process.env, STAGE_B: 'space 日本語 " \\' },
    );
    const result = await finite(command.completion, 4000, "transport");
    assert.equal(result.code, 7);
    assert.equal(result.absent, true);
    const parsed = JSON.parse(result.stdout.toString());
    assert.deepEqual(parsed.args, args);
    assert.equal(parsed.cwd, root);
    assert.equal(parsed.env, 'space 日本語 " \\');
    assert.equal(result.stderr.toString(), "error identity");
    const output = await finite(
      host.launch(
        process.execPath,
        ["-e", "process.stdout.write('x'.repeat(100000));process.stderr.write('y'.repeat(100000))"],
        root,
      ).completion,
      4000,
      "bounded output",
    );
    assert.equal(output.stdout.length, 65536);
    assert.equal(output.stderr.length, 65536);
    assert.equal(output.stdout.toString(), "x".repeat(65536));
    assert.equal(output.stderr.toString(), "y".repeat(65536));
    const version = await finite(
      host.launch(git, ["--version"], root).completion,
      4000,
      "real Git",
    );
    assert.equal(version.code, 0);
    assert.match(version.stdout.toString(), /^git version /);
    steps.push({ phase: "git", version: version.stdout.toString().trim() });
  } else if (mode === "launch-races") {
    const missing = host.launch(join(root, "missing.exe"), [], root);
    await assert.rejects(missing.completion, /Win32Exception/);
    for (let i = 0; i < 3; i++) {
      const child = host.launch(process.execPath, ["-e", "setInterval(()=>{},1000)"], root);
      child.cancel();
      child.cancel();
      const result = await finite(child.completion, 2000, "abort registration race");
      assert.equal(result.absent, true);
      assert.equal(result.code, 123);
    }
  } else {
    const normal = mode === "orphan-normal";
    const child = host.launch(
      process.execPath,
      [join(import.meta.dirname, "workload.mjs"), "leader", root, normal ? "normal" : "hold"],
      root,
    );
    let completed = false;
    void child.completion.then(
      () => {
        completed = true;
      },
      () => {},
    );
    const leader = await file("leader.json"),
      intermediate = await file("intermediate.json"),
      descendant = await file("descendant.json");
    assert.equal(intermediate.parent, leader.pid);
    assert.equal(descendant.parent, intermediate.pid);
    await wait(100);
    assert.equal(completed, false);
    steps.push({ phase: "established orphan", leader, intermediate, descendant });
    if (normal) {
      await finite(child.completion, 3000, "normal descendant");
      await file("settled.json");
    } else if (mode === "orphan-cancel") {
      child.cancel();
      const result = await finite(child.completion, 2000, "cancel descendant");
      assert.equal(result.absent, true);
    } else if (mode === "driver-cleanup") {
      // The inner driver deliberately exits without disposing. The outer job still owns host and orphan.
      await writeFile(
        join(root, "driver-abandoned.json"),
        JSON.stringify({ primary: "deliberate body failure", retained: true }),
      );
      process.exit(9);
    } else {
      if (mode === "observation-loss") child.denyObservation();
      else if (mode === "host-death") host.host.kill();
      else if (mode === "malformed") host.host.stdin.write('{"kind":"unsupported"}\n');
      else throw new Error("unknown mode");
      await assert.rejects(
        finite(child.completion, 2000, "fault settlement"),
        /retain root|host lost/,
      );
      await assert.rejects(host.dispose(), /retain root|host lost/);
      await access(root);
      steps.push({ phase: "uncertainty retains root", primary: "deliberate body failure" });
      await finite(host.closed, 4000, "fault host settlement");
      await writeFile(
        join(root, "scenario.json"),
        JSON.stringify({
          mode,
          steps,
          elapsedMs: performance.now() - start,
          retained: true,
          uncertain: true,
        }),
      );
      process.exit(0);
    }
  }
} catch (error) {
  primary = error;
}
try {
  await host.dispose();
} catch (error) {
  primary ??= error;
}
await writeFile(
  join(root, "scenario.json"),
  JSON.stringify({
    mode,
    steps,
    elapsedMs: performance.now() - start,
    compileMs: host.compileMs,
    retained: Boolean(primary),
    error: primary?.stack,
  }),
);
if (primary) throw primary;
