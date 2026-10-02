import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AbsolutePath } from "@gitlode/internal-foundation/support";
import { describe, expect, it } from "vitest";

import type { WorkerRunRequest, WorkerRunResult } from "../../src/execution/types.js";
import { dispatchWorkerRunRequest } from "../../src/execution/worker-client.js";
import { createPerformanceRepository } from "../support/performance-fixtures.js";

const workerEntry = new URL("../../dist/execution/worker-entry.js", import.meta.url);

function applicationResult(result: WorkerRunResult) {
  if (result.kind !== "success") return result;
  const { profileReport: _profileReport, elapsedMs: _elapsedMs, ...success } = result.success;
  return {
    kind: result.kind,
    success,
    checkpoint: {
      repositoryPath: result.checkpoint.repositoryPath,
      refs: result.checkpoint.refs.map(({ updatedAt: _updatedAt, ...ref }) => ref),
    },
  };
}

describe("profile fallback worker transport", () => {
  it("carries a real builder-body fallback through worker entry and client", async () => {
    const root = await mkdtemp(join(tmpdir(), "gitlode-worker-fallback-"));
    try {
      const repository = join(root, "repository");
      const normalOutput = join(root, "normal-output");
      const fallbackOutput = join(root, "fallback-output");
      await createPerformanceRepository(repository, "commit_heavy_repository", {
        commits: 5,
        files: 1,
        plugins: 0,
        rotations: 1,
        scale: 0,
      });
      await Promise.all([mkdir(normalOutput), mkdir(fallbackOutput)]);
      const request = (outputDir: string): WorkerRunRequest => ({
        input: {
          repositoryPath: repository as AbsolutePath,
          refs: ["main"],
          outputDir: outputDir as AbsolutePath,
          rotation: {},
          granularity: "commit",
          profile: true,
          gitAdapter: "isomorphic-git",
        },
        priorCheckpoint: {
          generatedAt: "2026-01-01T00:00:00.000Z",
          repositoryPath: repository as AbsolutePath,
          refs: [],
        },
      });
      const routed = { progress: 0, diagnostics: 0 };
      const reporters = () => ({
        progressReporter: { emit: () => routed.progress++ },
        diagnosticReporter: { report: () => routed.diagnostics++ },
      });
      const withTimeout = async (promise: Promise<WorkerRunResult>) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            promise,
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(
                () => reject(new Error("worker fallback transport timed out")),
                15_000,
              );
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      };
      const normal = await withTimeout(
        dispatchWorkerRunRequest(request(normalOutput), reporters(), { workerEntry }),
      );
      const fallback = await withTimeout(
        dispatchWorkerRunRequest(request(fallbackOutput), reporters(), {
          workerEntry,
          telemetryTestFailure: "report_builder_body",
        }),
      );
      expect(fallback.kind).toBe("success");
      if (fallback.kind !== "success") throw new Error(fallback.message);
      expect(fallback.success.profileReport).toMatchObject({
        schemaVersion: 2,
        signalStatus: {
          spans: "unavailable",
          counters: "unavailable",
          histograms: "unavailable",
        },
        spans: [],
        counters: [],
        histograms: [],
      });
      expect(fallback.success.profileReport?.diagnostics[0]).toMatchObject({
        effects: ["report_delivery_failure"],
        reportDelivery: {
          path: "fixed_fallback",
          measurementResults: "none",
        },
      });
      expect(applicationResult(fallback)).toEqual(applicationResult(normal));
      expect(routed.progress).toBeGreaterThan(0);
      expect(fileURLToPath(workerEntry)).toMatch(/dist[\\/]execution[\\/]worker-entry\.js$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);
});
