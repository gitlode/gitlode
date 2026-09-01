import nodeFs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { createMonotonicTiming, TELEMETRY_METRICS } from "@gitlode/internal-contracts/telemetry";
import { ROOT_CONTEXT, trace, type Meter } from "@opentelemetry/api";
import * as git from "isomorphic-git";
import type { FsClient } from "isomorphic-git";
import { Volume, createFsFromVolume } from "memfs";
import { afterEach, describe, expect, it } from "vitest";

import {
  GitCliAdapter,
  createGitCliAdapterForTesting,
} from "../../src/git-impl/git-cli-adapter.js";
import type { GitCliProcess } from "../../src/git-impl/git-cli-cat-file-batch.js";
import { createGitMetricRecorder } from "../../src/git-impl/git-metric-recorder.js";
import { IsomorphicGitAdapter } from "../../src/git-impl/isomorphic-git-adapter.js";

type Call = { name: string; value: number; attributes: Record<string, unknown> };
class RecordingMeter {
  readonly creations: Array<{ name: string; kind: "counter" | "histogram" }> = [];
  readonly calls: Call[] = [];
  createCounter(name: string) {
    this.creations.push({ name, kind: "counter" });
    return {
      add: (value: number, attributes: Record<string, unknown>) =>
        this.calls.push({ name, value, attributes }),
    };
  }
  createHistogram(name: string) {
    this.creations.push({ name, kind: "histogram" });
    return {
      record: (value: number, attributes: Record<string, unknown>) =>
        this.calls.push({ name, value, attributes }),
    };
  }
}

const asMeter = (meter: RecordingMeter) => meter as unknown as Meter;
const metricIds = [
  "git_commit_yielded",
  "git_object_read",
  "git_object_cache_lookup",
  "git_object_cache_hit",
  "git_file_change_yielded",
  "git_blob_read_duration",
  "git_blob_read_size",
  "git_blob_read_byte",
] as const;
const expectedNames = metricIds.map(
  (id) => TELEMETRY_METRICS.find((metadata) => metadata.id === id)!.name,
);
const tempDirs: string[] = [];

function recorder(meter: RecordingMeter, adapter: "isomorphic-git" | "git-cli") {
  let clock = 0;
  const timing = createMonotonicTiming(() => {
    const value = clock;
    clock += 100;
    return value;
  });
  return createGitMetricRecorder(asMeter(meter), adapter, timing);
}

async function fixture(fs: FsClient, dir: string) {
  await git.init({ fs, dir, defaultBranch: "main" });
  await git.setConfig({ fs, dir, path: "user.name", value: "Matrix" });
  await git.setConfig({ fs, dir, path: "user.email", value: "matrix@example.com" });
  fs.writeFileSync(join(dir, "a.txt"), "A-base\n");
  fs.writeFileSync(join(dir, "b.txt"), "B-old\n");
  await git.add({ fs, dir, filepath: "a.txt" });
  await git.add({ fs, dir, filepath: "b.txt" });
  const parent = await git.commit({
    fs,
    dir,
    message: "parent",
    author: { name: "Matrix", email: "matrix@example.com", timestamp: 1, timezoneOffset: 0 },
  });
  fs.writeFileSync(join(dir, "a.txt"), "A-change!\n");
  await git.remove({ fs, dir, filepath: "b.txt" });
  fs.writeFileSync(join(dir, "c.txt"), "C-new!\n");
  await git.add({ fs, dir, filepath: "a.txt" });
  await git.add({ fs, dir, filepath: "c.txt" });
  const child = await git.commit({
    fs,
    dir,
    message: "child",
    author: { name: "Matrix", email: "matrix@example.com", timestamp: 2, timezoneOffset: 0 },
  });
  return { parent, child };
}

function gitCalls(meter: RecordingMeter, name: string) {
  return meter.calls.filter((call) => call.name === name);
}

function assertCreationSet(meter: RecordingMeter) {
  const creations = meter.creations.filter((creation) => creation.name.startsWith("gitlode.git."));
  expect(creations.map((creation) => creation.name)).toEqual(expectedNames);
  expect(creations.map((creation) => creation.kind)).toEqual([
    "counter",
    "counter",
    "counter",
    "counter",
    "counter",
    "histogram",
    "histogram",
    "counter",
  ]);
  expect(new Set(creations.map((creation) => creation.name)).size).toBe(8);
}

function assertPrivacy(meter: RecordingMeter) {
  const serialized = JSON.stringify(meter.calls);
  expect(serialized).not.toMatch(/A-base|A-change|B-old|C-new|\.txt|refs|gitlode-multi|--batch/);
}

describe("production multi-change metric and lazy matrix", () => {
  it("asserts exact Isomorphic Git calls and lazy 2/1/1 blob progression", async () => {
    const volume = new Volume();
    const fs = createFsFromVolume(volume);
    const repo = "/repo";
    volume.mkdirSync(repo, { recursive: true });
    const { parent, child } = await fixture(fs, repo);
    const meter = new RecordingMeter();
    const adapter = new IsomorphicGitAdapter({
      fs,
      tracer: trace.getTracer("multi-change"),
      metricRecorder: recorder(meter, "isomorphic-git"),
      dagTelemetryBinding: {
        instrumentDifference: (_strategy, _exclude, run) =>
          run({
            onOperationStart() {},
            onOperationComplete() {},
            onStep() {},
            onNodeYielded() {},
            onSuccessorExpanded() {},
            onFallback() {},
          }),
      },
    });
    const iterator = adapter
      .getFileBlobChanges(repo, child as never, parent as never)
      [Symbol.asyncIterator]();
    expect(gitCalls(meter, "gitlode.git.blob.read.duration")).toEqual([]);
    const first = await iterator.next();
    expect(first.value?.status).toBe("deleted");
    expect(gitCalls(meter, "gitlode.git.blob.read.duration")).toHaveLength(1);
    const second = await iterator.next();
    expect(second.value?.status).toBe("added");
    expect(gitCalls(meter, "gitlode.git.blob.read.duration")).toHaveLength(2);
    const third = await iterator.next();
    expect(third.value?.status).toBe("modified");
    expect(gitCalls(meter, "gitlode.git.blob.read.duration")).toHaveLength(4);
    await iterator.return?.();
    const count = meter.calls.length;
    await iterator.next();
    await iterator.return?.();
    expect(meter.calls.length).toBe(count);
    expect(gitCalls(meter, "gitlode.git.file_change.yielded")).toEqual([
      {
        name: "gitlode.git.file_change.yielded",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.file_change.type": "deleted",
        },
      },
      {
        name: "gitlode.git.file_change.yielded",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.file_change.type": "added",
        },
      },
      {
        name: "gitlode.git.file_change.yielded",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.file_change.type": "modified",
        },
      },
    ]);
    expect(gitCalls(meter, "gitlode.git.blob.read.size").sort((a, b) => a.value - b.value)).toEqual(
      [
        {
          name: "gitlode.git.blob.read.size",
          value: 6,
          attributes: { "gitlode.git.adapter": "isomorphic-git" },
        },
        {
          name: "gitlode.git.blob.read.size",
          value: 7,
          attributes: { "gitlode.git.adapter": "isomorphic-git" },
        },
        {
          name: "gitlode.git.blob.read.size",
          value: 7,
          attributes: { "gitlode.git.adapter": "isomorphic-git" },
        },
        {
          name: "gitlode.git.blob.read.size",
          value: 10,
          attributes: { "gitlode.git.adapter": "isomorphic-git" },
        },
      ],
    );
    expect(
      gitCalls(meter, "gitlode.git.blob.read.byte")
        .sort((a, b) => a.value - b.value)
        .map((call) => call.value),
    ).toEqual([6, 7, 7, 10]);
    expect(
      gitCalls(meter, "gitlode.git.blob.read.duration").sort((a, b) => a.value - b.value),
    ).toEqual([
      {
        name: "gitlode.git.blob.read.duration",
        value: 0.1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.blob.read.outcome": "success",
        },
      },
      {
        name: "gitlode.git.blob.read.duration",
        value: 0.1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.blob.read.outcome": "success",
        },
      },
      {
        name: "gitlode.git.blob.read.duration",
        value: 0.2,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.blob.read.outcome": "success",
        },
      },
      {
        name: "gitlode.git.blob.read.duration",
        value: 0.2,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.blob.read.outcome": "success",
        },
      },
    ]);
    expect(gitCalls(meter, "gitlode.git.object.read")).toEqual([
      ...["blob", "blob", "blob", "blob"].map((type) => ({
        name: "gitlode.git.object.read",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.object.type": type,
          "gitlode.git.object.purpose": "file-change",
        },
      })),
    ]);
    expect(gitCalls(meter, "gitlode.git.object.cache.lookup")).toEqual([]);
    expect(gitCalls(meter, "gitlode.git.object.cache.hit")).toEqual([]);
    expect(gitCalls(meter, "gitlode.git.commit.yielded")).toEqual([]);
    assertCreationSet(meter);
    assertPrivacy(meter);
  });

  it("asserts exact Git CLI OID requests and four production blob metric completions", async () => {
    const repo = await mkdtemp(join(tmpdir(), "gitlode-multi-change-"));
    tempDirs.push(repo);
    const { parent, child } = await fixture(nodeFs, repo);
    const meter = new RecordingMeter();
    const requests: string[] = [];
    const bodies = new Map<string, Buffer>();
    const processFactory = () => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const stdin = new PassThrough();
      let closed = false;
      const process = {
        stdout,
        stderr,
        stdin,
        on(event: "error" | "close", listener: (value: never) => void) {
          if (event === "close") stdin.once("end", () => listener(0 as never));
          return process;
        },
        kill() {
          if (!closed) {
            closed = true;
            stdin.end();
            stdout.end();
            stderr.end();
          }
          return true;
        },
      } as unknown as GitCliProcess;
      stdin.on("data", (chunk) => {
        const oid = String(chunk).trim();
        requests.push(oid);
        const body = bodies.get(oid) ?? Buffer.from(oid);
        stdout.write(Buffer.from(`${oid} blob ${body.length}\n`));
        stdout.write(body);
        stdout.write("\n");
      });
      return process;
    };
    const adapter = createGitCliAdapterForTesting(
      {
        tracer: trace.getTracer("multi-change-cli"),
        metricRecorder: recorder(meter, "git-cli"),
        parentContext: ROOT_CONTEXT,
      },
      { processFactory, pipeline: async () => undefined },
    );
    const a = Buffer.from("A-base\n");
    const a2 = Buffer.from("A-change!\n");
    const b = Buffer.from("B-old\n");
    const c = Buffer.from("C-new!\n");
    const objects = await git.readTree({ fs: nodeFs, dir: repo, oid: child });
    for (const entry of objects.tree) {
      if (entry.type === "blob") bodies.set(entry.oid, entry.path === "a.txt" ? a2 : c);
    }
    bodies.set(
      (await git.readTree({ fs: nodeFs, dir: repo, oid: parent })).tree.find(
        (entry) => entry.path === "a.txt",
      )!.oid,
      a,
    );
    bodies.set(
      (await git.readTree({ fs: nodeFs, dir: repo, oid: parent })).tree.find(
        (entry) => entry.path === "b.txt",
      )!.oid,
      b,
    );
    const iterator = adapter
      .getFileBlobChanges(repo, child as never, parent as never)
      [Symbol.asyncIterator]();
    expect(requests).toEqual([]);
    expect((await iterator.next()).value?.status).toBe("modified");
    expect(requests).toHaveLength(2);
    expect((await iterator.next()).value?.status).toBe("deleted");
    expect(requests).toHaveLength(3);
    expect((await iterator.next()).value?.status).toBe("added");
    expect(requests).toHaveLength(4);
    await iterator.return?.();
    expect(requests).toEqual(requests.slice());
    expect(
      gitCalls(meter, "gitlode.git.file_change.yielded").map(
        (call) => call.attributes["gitlode.git.file_change.type"],
      ),
    ).toEqual(["modified", "deleted", "added"]);
    expect(gitCalls(meter, "gitlode.git.blob.read.duration")).toHaveLength(4);
    expect(
      gitCalls(meter, "gitlode.git.blob.read.size")
        .sort((a, b) => a.value - b.value)
        .map((call) => call.value),
    ).toEqual([6, 7, 7, 10]);
    expect(
      gitCalls(meter, "gitlode.git.blob.read.byte")
        .sort((a, b) => a.value - b.value)
        .map((call) => call.value),
    ).toEqual([6, 7, 7, 10]);
    expect(gitCalls(meter, "gitlode.git.object.cache.lookup")).toEqual([]);
    expect(gitCalls(meter, "gitlode.git.object.cache.hit")).toEqual([]);
    assertCreationSet(meter);
    assertPrivacy(meter);
    await adapter[Symbol.asyncDispose]();
  });
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
