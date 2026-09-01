import { AsyncLocalStorage } from "node:async_hooks";
import nodeFs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMonotonicTiming, type TimingToken } from "@gitlode/internal-contracts/telemetry";
import {
  context,
  createContextKey,
  ROOT_CONTEXT,
  type Context,
  type Span,
  type SpanOptions,
  type Tracer,
  type Meter,
} from "@opentelemetry/api";
import * as git from "isomorphic-git";
import type { FsClient } from "isomorphic-git";
import { Volume, createFsFromVolume } from "memfs";
import { afterEach, describe, expect, it } from "vitest";

import { createDagTelemetryBinding } from "../../src/git-impl/dag-metric-recorder.js";
import { GitCliAdapter } from "../../src/git-impl/git-cli-adapter.js";
import {
  createGitMetricRecorder,
  type GitMetricRecorder,
} from "../../src/git-impl/git-metric-recorder.js";
import { IsomorphicGitAdapter } from "../../src/git-impl/isomorphic-git-adapter.js";

class RecordingSpan {
  readonly attributes: Record<string, string | boolean | number> = {};
  readonly exceptions: unknown[] = [];
  endCount = 0;
  status: { code: number } | undefined;
  setAttribute(name: string, value: string | boolean | number) {
    this.attributes[name] = value;
    return this;
  }
  setAttributes(values: Record<string, string | boolean | number>) {
    Object.assign(this.attributes, values);
    return this;
  }
  addEvent() {
    return this;
  }
  setStatus(status: { code: number }) {
    this.status = status;
    return this;
  }
  recordException(error: unknown) {
    this.exceptions.push(error);
  }
  end() {
    this.endCount++;
  }
  isRecording() {
    return this.endCount === 0;
  }
  spanContext() {
    return {
      traceId: "1".repeat(32),
      spanId: `${this.endCount + 1}`.padStart(16, "0"),
      traceFlags: 1,
    };
  }
}

class RecordingTracer {
  readonly starts: Array<{
    name: string;
    options?: SpanOptions;
    parent: Context;
    span: RecordingSpan;
  }> = [];
  startSpan(name: string, options?: SpanOptions, parent: Context = ROOT_CONTEXT) {
    const span = new RecordingSpan();
    this.starts.push({ name, options, parent, span });
    return span as unknown as Span;
  }
}

class RecordingMeter {
  readonly creations: string[] = [];
  readonly adds: Array<{ name: string; value: number; attributes: unknown }> = [];
  createCounter(name: string) {
    this.creations.push(name);
    return {
      add: (value: number, attributes: unknown) => this.adds.push({ name, value, attributes }),
    };
  }
  createHistogram(name: string) {
    this.creations.push(name);
    return {
      record: (value: number, attributes: unknown) => this.adds.push({ name, value, attributes }),
    };
  }
}

const asTracer = (value: RecordingTracer) => value as unknown as Tracer;
const asMeter = (value: RecordingMeter) => value as unknown as Meter;
const tempDirs: string[] = [];

class TestContextManager {
  private readonly storage = new AsyncLocalStorage<Context>();
  active() {
    return this.storage.getStore() ?? ROOT_CONTEXT;
  }
  with<A>(ctx: Context, fn: () => A) {
    return this.storage.run(ctx, fn);
  }
  enable() {
    return this;
  }
  disable() {
    this.storage.disable();
  }
}

context.setGlobalContextManager(new TestContextManager());

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createCommit(fs: FsClient, dir: string) {
  await git.init({ fs, dir, defaultBranch: "main" });
  await git.setConfig({ fs, dir, path: "user.name", value: "Test" });
  await git.setConfig({ fs, dir, path: "user.email", value: "test@example.com" });
  fs.writeFileSync(join(dir, "file.txt"), "hello\n");
  await git.add({ fs, dir, filepath: "file.txt" });
  return await git.commit({
    fs,
    dir,
    message: "initial",
    author: { name: "Test", email: "test@example.com", timestamp: 1, timezoneOffset: 0 },
  });
}

function makeMetrics(meter: RecordingMeter): GitMetricRecorder {
  return createGitMetricRecorder(asMeter(meter), "git-cli", createMonotonicTiming());
}

describe("Git adapter production owner telemetry", () => {
  it.each(["isomorphic-git", "git-cli"] as const)(
    "records common operations and walk for %s",
    async (kind) => {
      const tracer = new RecordingTracer();
      const meter = new RecordingMeter();
      const parent = ROOT_CONTEXT.setValue(createContextKey("run"), true);
      let adapter: IsomorphicGitAdapter | GitCliAdapter;
      let repo: string;
      let head: string;
      if (kind === "isomorphic-git") {
        const volume = new Volume();
        const fs = createFsFromVolume(volume);
        repo = "/";
        head = await createCommit(fs, repo);
        adapter = new IsomorphicGitAdapter({
          fs,
          tracer: asTracer(tracer),
          metricRecorder: createGitMetricRecorder(asMeter(meter), "isomorphic-git"),
          dagTelemetryBinding: createDagTelemetryBinding(asTracer(tracer), asMeter(meter)),
        });
      } else {
        repo = await mkdtemp(join(tmpdir(), "gitlode-owner-"));
        tempDirs.push(repo);
        head = await createCommit(nodeFs, repo);
        adapter = new GitCliAdapter({
          tracer: asTracer(tracer),
          metricRecorder: makeMetrics(meter),
          parentContext: parent,
        });
      }
      await context.with(parent, async () => {
        await adapter.resolveRef(repo, "main");
        await adapter.classifyRefType(repo, "main");
        await adapter.getRepositoryObjectFormat(repo);
        await adapter.getRemoteUrl(repo);
        await adapter.findMergeBase(repo, [head as never, head as never]);
        const iterator = adapter.walkCommits(repo, head as never)[Symbol.asyncIterator]();
        expect(
          tracer.starts.find((entry) => entry.name === "gitlode.git.commit.walk"),
        ).toBeUndefined();
        await iterator.next();
        await iterator.next();
        await iterator.return?.();
        if (adapter instanceof GitCliAdapter) {
          const extractionContext = ROOT_CONTEXT.setValue(createContextKey("extraction"), true);
          await context.with(extractionContext, async () => {
            for await (const _change of adapter.getFileBlobChanges(repo, head as never)) break;
          });
          const diffTree = tracer.starts.find(
            (entry) => entry.name === "gitlode.git.cli.diff_tree",
          )!;
          expect(diffTree.parent).toBe(extractionContext);
          expect(diffTree.parent).not.toBe(parent);
          expect(diffTree.options?.attributes).toEqual({
            "gitlode.git.adapter": "git-cli",
            "gitlode.git.diff.mode": "root",
          });
          expect(diffTree.span.attributes["gitlode.git.cli.process.completion"]).toBe("exited");
          expect(diffTree.span.endCount).toBe(1);
        }
      });
      const names = tracer.starts.map((entry) => entry.name);
      expect(names).toContain("gitlode.git.resolve_ref");
      expect(names).toContain("gitlode.git.classify_ref");
      expect(names).toContain("gitlode.git.repository_object_format");
      expect(names).toContain("gitlode.git.remote_url.resolve");
      expect(names).toContain("gitlode.git.merge_base");
      const expectedInitialAttributes: Record<string, Record<string, unknown>> = {
        "gitlode.git.resolve_ref": { "gitlode.git.adapter": kind },
        "gitlode.git.classify_ref": { "gitlode.git.adapter": kind },
        "gitlode.git.repository_object_format": { "gitlode.git.adapter": kind },
        "gitlode.git.remote_url.resolve": { "gitlode.git.adapter": kind },
        "gitlode.git.merge_base": {
          "gitlode.git.adapter": kind,
          "gitlode.git.merge_base.input.count": 2,
        },
      };
      for (const [name, attributes] of Object.entries(expectedInitialAttributes)) {
        const entry = tracer.starts.find((candidate) => candidate.name === name)!;
        expect(entry.options?.attributes).toEqual(attributes);
        expect(entry.span.status).toBeUndefined();
        expect(entry.span.exceptions).toEqual([]);
        expect(entry.span.endCount).toBe(1);
      }
      const walk = tracer.starts.find((entry) => entry.name === "gitlode.git.commit.walk")!;
      expect(walk.parent).toBe(parent);
      expect(walk.options?.attributes).toMatchObject({
        "gitlode.git.adapter": kind,
        "gitlode.git.commit.walk.has_exclusion": false,
      });
      expect(walk.span.attributes["gitlode.stream.completion"]).toBe("exhausted");
      expect(walk.span.endCount).toBe(1);
      expect(walk.span.exceptions).toEqual([]);
      expect(meter.creations).toEqual(
        expect.arrayContaining([
          "gitlode.git.commit.yielded",
          "gitlode.git.object.read",
          "gitlode.git.object.cache.lookup",
          "gitlode.git.file_change.yielded",
          "gitlode.git.blob.read.duration",
        ]),
      );
      if (adapter instanceof GitCliAdapter) await adapter[Symbol.asyncDispose]();
    },
  );
});
