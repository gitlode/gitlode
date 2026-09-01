import nodeFs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMonotonicTiming, TELEMETRY_METRICS } from "@gitlode/internal-contracts/telemetry";
import { ROOT_CONTEXT, trace, type Meter } from "@opentelemetry/api";
import * as git from "isomorphic-git";
import type { FsClient } from "isomorphic-git";
import { Volume, createFsFromVolume } from "memfs";
import { afterEach, describe, expect, it } from "vitest";

import { createDagTelemetryBinding } from "../../src/git-impl/dag-metric-recorder.js";
import { createGitMetricRecorder } from "../../src/git-impl/git-metric-recorder.js";
import { IsomorphicGitAdapter } from "../../src/git-impl/isomorphic-git-adapter.js";

type Call = { name: string; value: number; attributes: Record<string, unknown> };
class MeterRecorder {
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

const asMeter = (meter: MeterRecorder) => meter as unknown as Meter;
const tempDirs: string[] = [];
const ids = [
  "git_commit_yielded",
  "git_object_read",
  "git_object_cache_lookup",
  "git_object_cache_hit",
  "git_file_change_yielded",
  "git_blob_read_duration",
  "git_blob_read_size",
  "git_blob_read_byte",
] as const;
const names = ids.map((id) => TELEMETRY_METRICS.find((metadata) => metadata.id === id)!.name);

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function productionRecorder(meter: MeterRecorder) {
  let clock = 0;
  return createGitMetricRecorder(
    asMeter(meter),
    "isomorphic-git",
    createMonotonicTiming(() => {
      const value = clock;
      clock += 100;
      return value;
    }),
  );
}

async function makeHistory(fs: FsClient, dir: string) {
  await git.init({ fs, dir, defaultBranch: "main" });
  await git.setConfig({ fs, dir, path: "user.name", value: "Failure Matrix" });
  await git.setConfig({ fs, dir, path: "user.email", value: "failure@example.com" });
  fs.writeFileSync(join(dir, "a.txt"), "one\n");
  await git.add({ fs, dir, filepath: "a.txt" });
  const first = await git.commit({
    fs,
    dir,
    message: "first",
    author: {
      name: "Failure Matrix",
      email: "failure@example.com",
      timestamp: 1,
      timezoneOffset: 0,
    },
  });
  fs.writeFileSync(join(dir, "a.txt"), "two\n");
  await git.add({ fs, dir, filepath: "a.txt" });
  const second = await git.commit({
    fs,
    dir,
    message: "second",
    author: {
      name: "Failure Matrix",
      email: "failure@example.com",
      timestamp: 2,
      timezoneOffset: 0,
    },
  });
  fs.writeFileSync(join(dir, "a.txt"), "three\n");
  await git.add({ fs, dir, filepath: "a.txt" });
  const third = await git.commit({
    fs,
    dir,
    message: "third",
    author: {
      name: "Failure Matrix",
      email: "failure@example.com",
      timestamp: 3,
      timezoneOffset: 0,
    },
  });
  return { first, second, third };
}

function calls(meter: MeterRecorder, name: string) {
  return meter.calls.filter((call) => call.name === name);
}

const noOpDag = (tracer: ReturnType<typeof trace.getTracer>, meter: MeterRecorder) =>
  createDagTelemetryBinding(tracer, asMeter(meter));

describe("production Isomorphic Git cache and partial metric matrix", () => {
  it("records exact topology/materialization cache miss and hit calls", async () => {
    const volume = new Volume();
    const fs = createFsFromVolume(volume);
    const repo = "/history";
    volume.mkdirSync(repo, { recursive: true });
    const history = await makeHistory(fs, repo);
    const meter = new MeterRecorder();
    const adapter = new IsomorphicGitAdapter({
      fs,
      tracer: trace.getTracer("cache-matrix"),
      metricRecorder: productionRecorder(meter),
      dagTelemetryBinding: noOpDag(trace.getTracer("dag-cache"), meter),
    });

    const walk = adapter.walkCommits(repo, history.third as never)[Symbol.asyncIterator]();
    const yielded: string[] = [];
    for (;;) {
      const result = await walk.next();
      if (result.done) break;
      yielded.push(result.value.oid);
    }
    expect(yielded).toEqual([history.third, history.second, history.first]);
    expect(calls(meter, "gitlode.git.commit.yielded")).toEqual([
      ...[false, false, false].map((hasExclusion) => ({
        name: "gitlode.git.commit.yielded",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.commit.walk.strategy": "certified-lazy",
          "gitlode.git.commit.walk.has_exclusion": hasExclusion,
        },
      })),
    ]);
    expect(calls(meter, "gitlode.git.object.cache.lookup")).toEqual([
      ...["materialize", "topology", "materialize", "topology", "materialize", "topology"].map(
        (purpose) => ({
          name: "gitlode.git.object.cache.lookup",
          value: 1,
          attributes: {
            "gitlode.git.adapter": "isomorphic-git",
            "gitlode.git.object.type": "commit",
            "gitlode.git.object.purpose": purpose,
          },
        }),
      ),
    ]);
    expect(calls(meter, "gitlode.git.object.cache.hit")).toEqual(
      ["topology", "topology", "topology"].map((purpose) => ({
        name: "gitlode.git.object.cache.hit",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.object.type": "commit",
          "gitlode.git.object.purpose": purpose,
        },
      })),
    );
    expect(calls(meter, "gitlode.git.object.read")).toEqual(
      ["materialize", "materialize", "materialize"].map((purpose) => ({
        name: "gitlode.git.object.read",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.object.type": "commit",
          "gitlode.git.object.purpose": purpose,
        },
      })),
    );
    expect(new Set(meter.creations.map((creation) => creation.name))).toEqual(
      new Set(
        names.concat(
          meter.creations
            .filter((creation) => creation.name.startsWith("gitlode.dag."))
            .map((creation) => creation.name),
        ),
      ),
    );
  });

  it("keeps exactly one completed commit metric after real partial cancellation", async () => {
    const volume = new Volume();
    const fs = createFsFromVolume(volume);
    const repo = "/partial";
    volume.mkdirSync(repo, { recursive: true });
    const history = await makeHistory(fs, repo);
    const meter = new MeterRecorder();
    const adapter = new IsomorphicGitAdapter({
      fs,
      tracer: trace.getTracer("partial-matrix"),
      metricRecorder: productionRecorder(meter),
      dagTelemetryBinding: noOpDag(trace.getTracer("dag-partial"), meter),
    });
    const iterator = adapter.walkCommits(repo, history.third as never)[Symbol.asyncIterator]();
    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: { oid: history.third },
    });
    const snapshot = calls(meter, "gitlode.git.commit.yielded").slice();
    await iterator.return?.();
    await iterator.next();
    await iterator.return?.();
    expect(calls(meter, "gitlode.git.commit.yielded")).toEqual(snapshot);
    expect(calls(meter, "gitlode.git.commit.yielded")).toHaveLength(1);
  });

  it("records an exclusion walk with an exact true exclusion attribute", async () => {
    const volume = new Volume();
    const fs = createFsFromVolume(volume);
    const repo = "/excluded";
    volume.mkdirSync(repo, { recursive: true });
    const history = await makeHistory(fs, repo);
    const meter = new MeterRecorder();
    const adapter = new IsomorphicGitAdapter({
      fs,
      tracer: trace.getTracer("exclusion-matrix"),
      metricRecorder: productionRecorder(meter),
      dagTelemetryBinding: noOpDag(trace.getTracer("dag-exclusion"), meter),
    });
    for await (const _commit of adapter.walkCommits(
      repo,
      history.third as never,
      history.first as never,
    )) {
      // Drain the production walk so both reachable commits are observed.
    }
    expect(calls(meter, "gitlode.git.commit.yielded")).toEqual(
      ["true", "true"].map(() => ({
        name: "gitlode.git.commit.yielded",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.commit.walk.strategy": "certified-lazy",
          "gitlode.git.commit.walk.has_exclusion": true,
        },
      })),
    );
  });

  it("does not synthesize git yield metrics before a walk can yield", async () => {
    const volume = new Volume();
    const fs = createFsFromVolume(volume);
    const repo = "/failure";
    volume.mkdirSync(repo, { recursive: true });
    await makeHistory(fs, repo);
    const meter = new MeterRecorder();
    const adapter = new IsomorphicGitAdapter({
      fs,
      tracer: trace.getTracer("failure-matrix"),
      metricRecorder: productionRecorder(meter),
      dagTelemetryBinding: noOpDag(trace.getTracer("dag-failure"), meter),
    });
    await expect(async () => {
      for await (const _commit of adapter.walkCommits(repo, "f".repeat(40) as never)) {
        // The invalid object must fail before any commit is yielded.
      }
    }).rejects.toBeInstanceOf(Error);
    expect(calls(meter, "gitlode.git.commit.yielded")).toEqual([]);
  });
});
