import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, cp, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { inspectRun } from "./inspection.mjs";

const [archive, destination] = process.argv.slice(2).map((value) => resolve(value));
await mkdir(destination);
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const manifestBytes = await readFile(join(archive, "sealed-manifest.json"));
assert.equal(
  sha(manifestBytes),
  "7a738d42dcdb048a49be41d728506fae141dbfc9572c2853459464b89076559f",
);
const manifest = JSON.parse(manifestBytes.toString());
for (const entry of manifest.files) {
  const bytes = await readFile(join(archive, entry.path));
  assert.equal(bytes.length, entry.bytes);
  assert.equal(sha(bytes), entry.sha256, entry.path);
}
await writeFile(
  join(destination, "source-hashes.json"),
  JSON.stringify({ manifestSha256: sha(manifestBytes), files: manifest.files }, null, 2),
);
const baseline = join(archive, "runs/1");
const candidate = join(archive, "runs/2");
const state = JSON.parse(await readFile(join(baseline, "state.json"), "utf8"));
const repository = state.repositoryPath;
const tests: any[] = [];
const original1 = JSON.parse(await readFile(join(baseline, "application-result.json"), "utf8"));
const original2 = JSON.parse(await readFile(join(candidate, "application-result.json"), "utf8"));
assert.notEqual(original1.checkpoint.generatedAt, original2.checkpoint.generatedAt);
assert.throws(() => assert.deepEqual(original1, original2));
const removed1 = structuredClone(original1),
  removed2 = structuredClone(original2);
delete removed1.checkpoint.generatedAt;
delete removed2.checkpoint.generatedAt;
assert.deepEqual(removed1, removed2);
await writeFile(
  join(destination, "original-mismatch.json"),
  JSON.stringify(
    {
      original1,
      original2,
      onlyMismatch: "checkpoint.generatedAt",
      originalRun2FailureRetained: true,
    },
    null,
    2,
  ),
);
for (const [ordinal, variant] of [
  [1, "V0"],
  [2, "V1"],
] as const) {
  await inspectRun(
    join(archive, "runs", String(ordinal)),
    repository,
    ordinal,
    variant,
    join(destination, `derived-${ordinal}`),
    ordinal > 1 ? baseline : undefined,
  );
  const directory = join(archive, "evidence", `run-${ordinal}`);
  for (const name of (await readdir(directory)).filter((name) => name.endsWith(".json"))) {
    const terminal = JSON.parse(await readFile(join(directory, name), "utf8"));
    assert.equal(terminal.cleanupConfirmed, true);
    assert.deepEqual(terminal.cleanupErrors, []);
    assert.deepEqual(terminal.finalizationErrors, []);
    if (ordinal === 2) assert.notEqual(terminal.status, "completed");
  }
}
tests.push({
  name: "saved session timestamps differ; corrected complete inspection passes both",
  passed: true,
});
for (const name of [
  "session-time",
  "missing-timestamp",
  "wrong-type",
  "wrong-timestamp",
  "both-missing",
  "malformed-timestamp",
  "changed-ref",
  "changed-count",
  "changed-jsonl",
  "enabled-profile",
  "missing-boundary",
]) {
  const disposable = join(destination, "disposable", name);
  await cp(candidate, disposable, { recursive: true });
  const checkpoint = JSON.parse(await readFile(join(disposable, "state.json"), "utf8"));
  const boundaries = (await readFile(join(disposable, "boundaries.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const result = boundaries.find((item) => item.boundary === "host-application-result").detail;
  if (name === "session-time") {
    checkpoint.generatedAt = result.checkpoint.generatedAt = "2026-10-07T06:00:00.000Z";
  }
  if (name === "missing-timestamp") delete result.checkpoint.generatedAt;
  if (name === "wrong-type") result.checkpoint.generatedAt = 42;
  if (name === "wrong-timestamp") result.checkpoint.generatedAt = "2026-10-07T06:00:00.000Z";
  if (name === "both-missing") {
    delete checkpoint.generatedAt;
    delete result.checkpoint.generatedAt;
  }
  if (name === "malformed-timestamp")
    checkpoint.generatedAt = result.checkpoint.generatedAt = "not-time";
  if (name === "changed-ref")
    checkpoint.refs[0].tipOid = result.checkpoint.refs[0].tipOid = "0".repeat(40);
  if (name === "changed-count") result.success.recordsWritten--;
  if (name === "changed-jsonl") {
    const files = await readdir(join(disposable, "output"));
    const path = join(disposable, "output", files[0]);
    const bytes = await readFile(path);
    bytes[0] ^= 1;
    await writeFile(path, bytes);
  }
  if (name === "enabled-profile")
    boundaries.find(
      (item) => item.boundary === "worker-after-disabled-composition",
    ).detail.profile = true;
  if (name === "missing-boundary") boundaries.pop();
  await writeFile(join(disposable, "state.json"), JSON.stringify(checkpoint));
  await writeFile(
    join(disposable, "boundaries.jsonl"),
    boundaries.map((item) => JSON.stringify(item)).join("\n") + "\n",
  );
  let error: string | undefined;
  try {
    await inspectRun(disposable, repository, 2, "V1", join(destination, "cases", name), baseline);
  } catch (caught) {
    error = String(caught);
  }
  assert.equal(error === undefined, name === "session-time", name);
  tests.push({ name, expected: name === "session-time" ? "pass" : "reject", passed: true, error });
}
for (const entry of manifest.files)
  assert.equal(sha(await readFile(join(archive, entry.path))), entry.sha256);
await writeFile(
  join(destination, "verification.json"),
  JSON.stringify(
    {
      passed: true,
      tests,
      sourceArchiveUnchanged: true,
      cliInvocations: 0,
      classification: "derived offline validation; original processing failure unchanged",
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ passed: true, tests: tests.length, destination }));
