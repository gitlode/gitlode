import nodeFs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMonotonicTiming, TELEMETRY_METRICS } from "@gitlode/internal-contracts/telemetry";
import { context, ROOT_CONTEXT, trace, type Meter, type Tracer } from "@opentelemetry/api";
import * as git from "isomorphic-git";
import type { FsClient } from "isomorphic-git";
import { Volume, createFsFromVolume } from "memfs";
import { afterEach, describe, expect, it } from "vitest";

import { createDagTelemetryBinding } from "../../src/git-impl/dag-metric-recorder.js";
import { GitCliAdapter } from "../../src/git-impl/git-cli-adapter.js";
import { createGitMetricRecorder } from "../../src/git-impl/git-metric-recorder.js";
import { IsomorphicGitAdapter } from "../../src/git-impl/isomorphic-git-adapter.js";

type MetricCall = { name: string; value: number; attributes: Record<string, unknown> };

class RecordingMeter {
  readonly creations: Array<{ name: string; kind: "counter" | "histogram" }> = [];
  readonly calls: MetricCall[] = [];
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
const noopTracer = trace.getTracer("gitlode.metric-owner") as Tracer;
const tempDirs: string[] = [];
const metricKinds = new Map([
  ["gitlode.git.commit.yielded", "counter"],
  ["gitlode.git.object.read", "counter"],
  ["gitlode.git.object.cache.lookup", "counter"],
  ["gitlode.git.object.cache.hit", "counter"],
  ["gitlode.git.file_change.yielded", "counter"],
  ["gitlode.git.blob.read.duration", "histogram"],
  ["gitlode.git.blob.read.size", "histogram"],
  ["gitlode.git.blob.read.byte", "counter"],
]);
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
const metricNames = metricIds.map(
  (id) => TELEMETRY_METRICS.find((metadata) => metadata.id === id)!.name,
);
const deterministicTiming = () => {
  let now = 0;
  return createMonotonicTiming(() => {
    const value = now;
    now += 100;
    return value;
  });
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function makeRepo(fs: FsClient, dir: string): Promise<string> {
  await git.init({ fs, dir, defaultBranch: "main" });
  await git.setConfig({ fs, dir, path: "user.name", value: "Metric Test" });
  await git.setConfig({ fs, dir, path: "user.email", value: "metric@example.com" });
  fs.writeFileSync(join(dir, "file.txt"), "hello\n");
  await git.add({ fs, dir, filepath: "file.txt" });
  return await git.commit({
    fs,
    dir,
    message: "metric fixture",
    author: { name: "Metric Test", email: "metric@example.com", timestamp: 1, timezoneOffset: 0 },
  });
}

function assertCatalog(meter: RecordingMeter, adapter: "isomorphic-git" | "git-cli") {
  const creations = meter.creations.filter((creation) => creation.name.startsWith("gitlode.git."));
  expect(creations).toEqual(metricNames.map((name) => ({ name, kind: metricKinds.get(name) })));
  expect(new Set(creations.map((creation) => creation.name)).size).toBe(8);
  for (const call of meter.calls.filter((call) => call.name.startsWith("gitlode.git."))) {
    expect(call.attributes).toMatchObject({ "gitlode.git.adapter": adapter });
    expect(Object.keys(call.attributes).every((key) => key.startsWith("gitlode.git."))).toBe(true);
  }
}

async function exercise(kind: "isomorphic-git" | "git-cli") {
  const meter = new RecordingMeter();
  if (kind === "isomorphic-git") {
    const volume = new Volume();
    const fs = createFsFromVolume(volume);
    const repo = "/";
    const head = await makeRepo(fs, repo);
    const adapter = new IsomorphicGitAdapter({
      fs,
      tracer: noopTracer,
      metricRecorder: createGitMetricRecorder(asMeter(meter), kind, deterministicTiming()),
      dagTelemetryBinding: createDagTelemetryBinding(noopTracer, asMeter(meter)),
    });
    const walk = adapter.walkCommits(repo, head as never)[Symbol.asyncIterator]();
    await walk.next();
    await walk.return?.();
    const changes = adapter.getFileBlobChanges(repo, head as never)[Symbol.asyncIterator]();
    await changes.next();
    await changes.return?.();
    assertCatalog(meter, kind);
    const gitCalls = (name: string) => meter.calls.filter((call) => call.name === name);
    expect(gitCalls("gitlode.git.object.cache.lookup")).toEqual([
      {
        name: "gitlode.git.object.cache.lookup",
        value: 1,
        attributes: {
          "gitlode.git.adapter": kind,
          "gitlode.git.object.type": "commit",
          "gitlode.git.object.purpose": "materialize",
        },
      },
    ]);
    expect(gitCalls("gitlode.git.object.cache.hit")).toEqual([]);
    expect(gitCalls("gitlode.git.object.read")).toEqual([
      {
        name: "gitlode.git.object.read",
        value: 1,
        attributes: {
          "gitlode.git.adapter": kind,
          "gitlode.git.object.type": "commit",
          "gitlode.git.object.purpose": "materialize",
        },
      },
      {
        name: "gitlode.git.object.read",
        value: 1,
        attributes: {
          "gitlode.git.adapter": kind,
          "gitlode.git.object.type": "blob",
          "gitlode.git.object.purpose": "file-change",
        },
      },
    ]);
    expect(gitCalls("gitlode.git.commit.yielded")).toEqual([
      {
        name: "gitlode.git.commit.yielded",
        value: 1,
        attributes: {
          "gitlode.git.adapter": kind,
          "gitlode.git.commit.walk.strategy": "certified-lazy",
          "gitlode.git.commit.walk.has_exclusion": false,
        },
      },
    ]);
    expect(gitCalls("gitlode.git.file_change.yielded")).toEqual([
      {
        name: "gitlode.git.file_change.yielded",
        value: 1,
        attributes: { "gitlode.git.adapter": kind, "gitlode.git.file_change.type": "added" },
      },
    ]);
    expect(gitCalls("gitlode.git.blob.read.duration")).toEqual([
      {
        name: "gitlode.git.blob.read.duration",
        value: 0.1,
        attributes: { "gitlode.git.adapter": kind, "gitlode.git.blob.read.outcome": "success" },
      },
    ]);
    expect(gitCalls("gitlode.git.blob.read.size")).toEqual([
      { name: "gitlode.git.blob.read.size", value: 6, attributes: { "gitlode.git.adapter": kind } },
    ]);
    expect(gitCalls("gitlode.git.blob.read.byte")).toEqual([
      { name: "gitlode.git.blob.read.byte", value: 6, attributes: { "gitlode.git.adapter": kind } },
    ]);
  } else {
    const repo = await mkdtemp(join(tmpdir(), "gitlode-metric-owner-"));
    tempDirs.push(repo);
    const head = await makeRepo(nodeFs, repo);
    const adapter = new GitCliAdapter({
      tracer: noopTracer,
      metricRecorder: createGitMetricRecorder(asMeter(meter), kind, deterministicTiming()),
      parentContext: ROOT_CONTEXT,
    });
    const walk = adapter.walkCommits(repo, head as never)[Symbol.asyncIterator]();
    await walk.next();
    await walk.return?.();
    const changes = adapter.getFileBlobChanges(repo, head as never)[Symbol.asyncIterator]();
    await changes.next();
    await adapter[Symbol.asyncDispose]();
    assertCatalog(meter, kind);
    const gitCalls = (name: string) => meter.calls.filter((call) => call.name === name);
    expect(gitCalls("gitlode.git.object.cache.lookup")).toEqual([]);
    expect(gitCalls("gitlode.git.object.cache.hit")).toEqual([]);
    expect(gitCalls("gitlode.git.object.read")).toEqual([
      {
        name: "gitlode.git.object.read",
        value: 1,
        attributes: {
          "gitlode.git.adapter": kind,
          "gitlode.git.object.type": "blob",
          "gitlode.git.object.purpose": "file-change",
        },
      },
    ]);
    expect(gitCalls("gitlode.git.commit.yielded")).toEqual([
      {
        name: "gitlode.git.commit.yielded",
        value: 1,
        attributes: {
          "gitlode.git.adapter": kind,
          "gitlode.git.commit.walk.strategy": "git-cli-rev-list-stream",
          "gitlode.git.commit.walk.has_exclusion": false,
        },
      },
    ]);
    expect(gitCalls("gitlode.git.file_change.yielded")).toEqual([
      {
        name: "gitlode.git.file_change.yielded",
        value: 1,
        attributes: { "gitlode.git.adapter": kind, "gitlode.git.file_change.type": "added" },
      },
    ]);
    expect(gitCalls("gitlode.git.blob.read.duration")).toEqual([
      {
        name: "gitlode.git.blob.read.duration",
        value: 0.1,
        attributes: { "gitlode.git.adapter": kind, "gitlode.git.blob.read.outcome": "success" },
      },
    ]);
    expect(gitCalls("gitlode.git.blob.read.size")).toEqual([
      { name: "gitlode.git.blob.read.size", value: 6, attributes: { "gitlode.git.adapter": kind } },
    ]);
    expect(gitCalls("gitlode.git.blob.read.byte")).toEqual([
      { name: "gitlode.git.blob.read.byte", value: 6, attributes: { "gitlode.git.adapter": kind } },
    ]);
  }
}

describe("production Git adapter metric owners", () => {
  it.each(["isomorphic-git", "git-cli"] as const)(
    "records the cataloged instruments from %s operations exactly once",
    async (kind) => await exercise(kind),
  );
});
