import nodeFs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { GitAdapterError } from "@gitlode/internal-contracts/git";
import { createMonotonicTiming, TELEMETRY_METRICS } from "@gitlode/internal-contracts/telemetry";
import { ROOT_CONTEXT, type Context, type Meter, type Span, type Tracer } from "@opentelemetry/api";
import * as git from "isomorphic-git";
import { afterEach, describe, expect, it } from "vitest";

import {
  createGitCliAdapterForTesting,
  type GitCliProcessFactory,
} from "../../src/git-impl/git-cli-adapter.js";
import type { GitCliProcess } from "../../src/git-impl/git-cli-cat-file-batch.js";
import { createGitMetricRecorder } from "../../src/git-impl/git-metric-recorder.js";

type Call = { name: string; value: number; attributes: Record<string, unknown> };

class MeterRecording {
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

class SpanRecording {
  readonly attributes: Record<string, unknown> = {};
  readonly exceptions: unknown[] = [];
  readonly events: unknown[] = [];
  readonly endSnapshots: Array<{ reaped: boolean }> = [];
  status: { code: number } | undefined;
  endCount = 0;
  reaped = false;
  setAttribute(name: string, value: unknown) {
    this.attributes[name] = value;
    return this;
  }
  setAttributes(values: Record<string, unknown>) {
    Object.assign(this.attributes, values);
    return this;
  }
  addEvent(name: string, attributes?: unknown) {
    this.events.push({ name, attributes });
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
    this.endSnapshots.push({ reaped: this.reaped });
  }
  isRecording() {
    return this.endCount === 0;
  }
  spanContext() {
    return { traceId: "1".repeat(32), spanId: "2".repeat(16), traceFlags: 1 };
  }
}

class TracerRecording {
  readonly starts: Array<{
    name: string;
    parent: Context;
    span: SpanRecording;
    attributes: Record<string, unknown>;
  }> = [];
  startSpan(
    name: string,
    options: { attributes?: Record<string, unknown> } | undefined,
    parent = ROOT_CONTEXT,
  ) {
    const span = new SpanRecording();
    const attributes = { ...(options?.attributes ?? {}) };
    span.setAttributes(attributes);
    this.starts.push({ name, parent, span, attributes });
    return span as unknown as Span;
  }
}

type FailureMode = "success" | "runtime" | "nonzero" | "malformed" | "oid" | "type";
type Fake = GitCliProcess & {
  requests: string[];
  killed: number;
  reaped: boolean;
  closed: boolean;
};

function processFactory(
  tracer: TracerRecording,
  requests: string[],
  bodies: Map<string, Buffer>,
  mode: FailureMode,
  runtimeFailure = new Error("sentinel CLI runtime failure"),
): GitCliProcessFactory {
  return () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdin = new PassThrough();
    const state = {
      stdout,
      stderr,
      stdin,
      requests,
      killed: 0,
      reaped: false,
      closed: false,
    } as Fake;
    let onError: ((error: unknown) => void) | undefined;
    let onClose: ((code: number | null) => void) | undefined;
    state.on = ((event: "error" | "close", listener: (value: never) => void) => {
      if (event === "error") onError = listener;
      else onClose = listener as unknown as (code: number | null) => void;
      return state;
    }) as Fake["on"];
    const reap = (code: number | null) => {
      if (state.closed) return;
      state.closed = true;
      state.reaped = true;
      const span = [...tracer.starts]
        .reverse()
        .find(
          (entry) => entry.name === "gitlode.git.cli.file_blob_batch" && entry.span.endCount === 0,
        );
      if (span) span.span.reaped = true;
      stdout.end();
      stderr.end();
      onClose?.(code);
    };
    state.kill = () => {
      state.killed++;
      reap(137);
      return true;
    };
    stdin.on("data", (chunk) => {
      const oid = String(chunk).trim();
      requests.push(oid);
      if (requests.length === 3 && mode !== "success") {
        if (mode === "runtime") {
          onError?.(runtimeFailure);
          reap(1);
          return;
        }
        if (mode === "nonzero") {
          reap(7);
          return;
        }
        const header =
          mode === "malformed"
            ? "sentinel CLI malformed stdout\n"
            : `${mode === "oid" ? "deadbeef" : oid} ${mode === "type" ? "tree" : "blob"} 6\n`;
        stdout.write(Buffer.from(header));
        if (mode === "oid" || mode === "type") {
          stdout.write(Buffer.from("wrong!"));
          stdout.write(Buffer.from("\n"));
        }
        stdout.end();
        return;
      }
      const body = bodies.get(oid) ?? Buffer.from("unknown");
      stdout.write(Buffer.from(`${oid} blob ${body.length}\n`));
      stdout.write(body);
      stdout.write(Buffer.from("\n"));
    });
    stdin.on("end", () => reap(0));
    return state;
  };
}

async function fixture(): Promise<{
  path: string;
  parent: string;
  child: string;
  bodies: Map<string, Buffer>;
  modifiedBefore: string;
  modifiedAfter: string;
  deleted: string;
  added: string;
}> {
  const path = await mkdtemp(join(tmpdir(), "gitlode-cli-failure-"));
  await git.init({ fs: nodeFs, dir: path, defaultBranch: "main" });
  await git.setConfig({ fs: nodeFs, dir: path, path: "user.name", value: "Failure" });
  await git.setConfig({ fs: nodeFs, dir: path, path: "user.email", value: "failure@example.com" });
  nodeFs.writeFileSync(join(path, "a.txt"), "A-base\n");
  nodeFs.writeFileSync(join(path, "b.txt"), "B-old\n");
  await git.add({ fs: nodeFs, dir: path, filepath: "a.txt" });
  await git.add({ fs: nodeFs, dir: path, filepath: "b.txt" });
  const parent = await git.commit({
    fs: nodeFs,
    dir: path,
    message: "parent",
    author: { name: "Failure", email: "failure@example.com", timestamp: 1, timezoneOffset: 0 },
  });
  nodeFs.writeFileSync(join(path, "a.txt"), "A-change!\n");
  await git.remove({ fs: nodeFs, dir: path, filepath: "b.txt" });
  nodeFs.writeFileSync(join(path, "c.txt"), "C-new!\n");
  await git.add({ fs: nodeFs, dir: path, filepath: "a.txt" });
  await git.add({ fs: nodeFs, dir: path, filepath: "c.txt" });
  const child = await git.commit({
    fs: nodeFs,
    dir: path,
    message: "child",
    author: { name: "Failure", email: "failure@example.com", timestamp: 2, timezoneOffset: 0 },
  });
  const bodies = new Map<string, Buffer>();
  const parentTree = await git.readTree({ fs: nodeFs, dir: path, oid: parent });
  const childTree = await git.readTree({ fs: nodeFs, dir: path, oid: child });
  const modifiedBefore = parentTree.tree.find((entry) => entry.path === "a.txt")!.oid;
  const modifiedAfter = childTree.tree.find((entry) => entry.path === "a.txt")!.oid;
  const deleted = parentTree.tree.find((entry) => entry.path === "b.txt")!.oid;
  const added = childTree.tree.find((entry) => entry.path === "c.txt")!.oid;
  for (const treeOid of [parent, child]) {
    const tree = await git.readTree({ fs: nodeFs, dir: path, oid: treeOid });
    for (const entry of tree.tree)
      if (entry.type === "blob")
        bodies.set(
          entry.oid,
          Buffer.from(
            entry.path === "a.txt"
              ? treeOid === parent
                ? "A-base\n"
                : "A-change!\n"
              : entry.path === "b.txt"
                ? "B-old\n"
                : "C-new!\n",
          ),
        );
  }
  return { path, parent, child, bodies, modifiedBefore, modifiedAfter, deleted, added };
}

const names = [
  "git_commit_yielded",
  "git_object_read",
  "git_object_cache_lookup",
  "git_object_cache_hit",
  "git_file_change_yielded",
  "git_blob_read_duration",
  "git_blob_read_size",
  "git_blob_read_byte",
] as const;
const metricNames = names.map(
  (id) => TELEMETRY_METRICS.find((metadata) => metadata.id === id)!.name,
);
const calls = (meter: MeterRecording, name: string) =>
  meter.calls.filter((call) => call.name === name);
const metricCall = (name: string, value: number, attributes: Record<string, unknown>): Call => ({
  name,
  value,
  attributes,
});
const blobDuration = (outcome: "success" | "error", value: number) =>
  metricCall("gitlode.git.blob.read.duration", value, {
    "gitlode.git.adapter": "git-cli",
    "gitlode.git.blob.read.outcome": outcome,
  });
const blobSize = (value: number) =>
  metricCall("gitlode.git.blob.read.size", value, { "gitlode.git.adapter": "git-cli" });
const blobByte = (value: number) =>
  metricCall("gitlode.git.blob.read.byte", value, { "gitlode.git.adapter": "git-cli" });
const fileChange = (type: "modified" | "deleted" | "added") =>
  metricCall("gitlode.git.file_change.yielded", 1, {
    "gitlode.git.adapter": "git-cli",
    "gitlode.git.file_change.type": type,
  });
const timing = () => {
  let now = 0;
  return createMonotonicTiming(() => {
    const value = now;
    now += 100;
    return value;
  });
};
const temps: string[] = [];

function makeAdapter(
  tracer: TracerRecording,
  meter: MeterRecording,
  factory: GitCliProcessFactory,
) {
  return createGitCliAdapterForTesting(
    {
      tracer: tracer as unknown as Tracer,
      metricRecorder: createGitMetricRecorder(meter as unknown as Meter, "git-cli", timing()),
      parentContext: ROOT_CONTEXT,
    },
    { processFactory: factory, pipeline: async () => undefined },
  );
}

describe("Git CLI blob failure and partial cancellation evidence", () => {
  it.each(["runtime", "nonzero", "malformed", "oid", "type"] as const)(
    "records exact failed blob metrics for %s",
    async (mode) => {
      const data = await fixture();
      temps.push(data.path);
      const tracer = new TracerRecording();
      const meter = new MeterRecording();
      const requests: string[] = [];
      const runtimeFailure = new Error("sentinel CLI runtime failure");
      const adapter = makeAdapter(
        tracer,
        meter,
        processFactory(tracer, requests, data.bodies, mode, runtimeFailure),
      );
      const iterator = adapter
        .getFileBlobChanges(data.path, data.child as never, data.parent as never)
        [Symbol.asyncIterator]();
      const failure = await iterator.next();
      expect(failure.done).toBe(false);
      let outward: unknown;
      try {
        await iterator.next();
      } catch (error) {
        outward = error;
      }
      expect(outward).toBeInstanceOf(GitAdapterError);
      const adapterError = outward as GitAdapterError;
      expect(adapterError.code).toBe("UNKNOWN");
      expect(adapterError.message).toBe(
        mode === "runtime"
          ? "Unexpected error reading cat-file batch: sentinel CLI runtime failure"
          : mode === "nonzero"
            ? "Unexpected end of cat-file batch output: exit code 7"
            : mode === "malformed"
              ? "Unexpected cat-file batch header: sentinel CLI malformed stdout"
              : mode === "oid"
                ? `Unexpected cat-file response for blob ${data.deleted}: deadbeef blob`
                : `Unexpected cat-file response for blob ${data.deleted}: ${data.deleted} tree`,
      );
      expect(adapterError.cause).toBe(mode === "runtime" ? runtimeFailure : undefined);
      const requestSnapshot = requests.slice();
      const metricSnapshot = meter.calls.slice();
      try {
        await iterator.next();
      } catch {
        /* repeated terminal operation is stable */
      }
      try {
        await iterator.return?.();
      } catch {
        /* repeated terminal operation is stable */
      }
      await adapter[Symbol.asyncDispose]().catch(() => undefined);
      expect(requests).toEqual(requestSnapshot);
      expect(meter.calls).toEqual(metricSnapshot);
      expect(requests).toEqual([data.modifiedBefore, data.modifiedAfter, data.deleted]);
      expect(calls(meter, "gitlode.git.blob.read.duration")).toEqual([
        blobDuration("success", 0.2),
        blobDuration("success", 0.2),
        blobDuration("error", 0.1),
      ]);
      expect(calls(meter, "gitlode.git.blob.read.size")).toEqual([blobSize(7), blobSize(10)]);
      expect(calls(meter, "gitlode.git.blob.read.byte")).toEqual([blobByte(7), blobByte(10)]);
      expect(calls(meter, "gitlode.git.file_change.yielded")).toEqual([fileChange("modified")]);
      const span = tracer.starts.find((entry) => entry.name === "gitlode.git.cli.file_blob_batch")!;
      expect(span.span.attributes["gitlode.git.cli.process.completion"]).toBe("error");
      expect(span.span.attributes["gitlode.git.object.read.count"]).toBe(2);
      expect(span.span.attributes["gitlode.git.blob.read.size"]).toBe(17);
      expect(span.span.status?.code).toBe(2);
      expect(span.span.exceptions).toHaveLength(0);
      expect(span.span.endCount).toBe(1);
      expect(span.span.endSnapshots[0]?.reaped).toBe(true);
      expect(span.span.reaped).toBe(true);
      expect(JSON.stringify({ calls: meter.calls, span: span.span })).not.toMatch(
        /sentinel|gitlode-cli-failure|\.txt|deadbeef/,
      );
      expect(new Set(meter.creations.map((creation) => creation.name))).toEqual(
        new Set(metricNames),
      );
      expect(meter.creations).toHaveLength(8);
      await adapter[Symbol.asyncDispose]().catch(() => undefined);
      expect(requests).toEqual(requestSnapshot);
      expect(meter.calls).toEqual(metricSnapshot);
    },
  );

  it.each([1, 2] as const)(
    "cancels after %s completed change without lookahead",
    async (completed) => {
      const data = await fixture();
      temps.push(data.path);
      const tracer = new TracerRecording();
      const meter = new MeterRecording();
      const requests: string[] = [];
      const adapter = makeAdapter(
        tracer,
        meter,
        processFactory(tracer, requests, data.bodies, "success"),
      );
      const iterator = adapter
        .getFileBlobChanges(data.path, data.child as never, data.parent as never)
        [Symbol.asyncIterator]();
      expect(requests).toEqual([]);
      for (let index = 0; index < completed; index += 1)
        await expect(iterator.next()).resolves.toMatchObject({ done: false });
      const requestSnapshot = requests.slice();
      const metricSnapshot = meter.calls.slice();
      await iterator.return?.();
      await iterator.next();
      await iterator.return?.();
      try {
        await iterator.throw?.(new Error("ignored"));
      } catch {
        /* terminal operation is stable */
      }
      expect(requests).toEqual(requestSnapshot);
      expect(meter.calls).toEqual(metricSnapshot);
      expect(requests).toEqual(
        completed === 1
          ? [data.modifiedBefore, data.modifiedAfter]
          : [data.modifiedBefore, data.modifiedAfter, data.deleted],
      );
      expect(calls(meter, "gitlode.git.blob.read.duration")).toEqual(
        completed === 1
          ? [blobDuration("success", 0.2), blobDuration("success", 0.2)]
          : [
              blobDuration("success", 0.2),
              blobDuration("success", 0.2),
              blobDuration("success", 0.1),
            ],
      );
      expect(calls(meter, "gitlode.git.blob.read.size")).toEqual(
        completed === 1 ? [blobSize(7), blobSize(10)] : [blobSize(7), blobSize(10), blobSize(6)],
      );
      expect(calls(meter, "gitlode.git.blob.read.byte")).toEqual(
        completed === 1 ? [blobByte(7), blobByte(10)] : [blobByte(7), blobByte(10), blobByte(6)],
      );
      expect(calls(meter, "gitlode.git.file_change.yielded")).toEqual(
        completed === 1
          ? [fileChange("modified")]
          : [fileChange("modified"), fileChange("deleted")],
      );
      await adapter[Symbol.asyncDispose]();
      expect(requests).toEqual(requestSnapshot);
      expect(meter.calls).toEqual(metricSnapshot);
      const span = tracer.starts.find((entry) => entry.name === "gitlode.git.cli.file_blob_batch")!;
      expect(span.span.attributes["gitlode.git.cli.process.completion"]).toBe("exited");
      expect(span.span.attributes["gitlode.git.object.read.count"]).toBe(completed === 1 ? 2 : 3);
      expect(span.span.attributes["gitlode.git.blob.read.size"]).toBe(completed === 1 ? 17 : 23);
      expect(span.span.status).toBeUndefined();
      expect(span.span.exceptions).toHaveLength(0);
      expect(span.span.endCount).toBe(1);
      expect(span.span.endSnapshots[0]?.reaped).toBe(true);
    },
  );
});

afterEach(async () => {
  await Promise.all(temps.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
