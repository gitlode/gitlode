import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ExtractionCheckpoint } from "@gitlode/internal-contracts/extraction";
import type { AbsoluteDirectoryPath, AbsolutePath } from "@gitlode/internal-foundation/support";
import { afterEach, describe, expect, it, vi } from "vitest";

import { executeWorkerRunRequest } from "../../src/execution/execute-run.js";
import type { ExecutionGitAdapterName, WorkerRunInput } from "../../src/execution/types.js";
import {
  createDeterministicRepository,
  repositorySemanticSnapshot,
} from "../support/deterministic-repository.js";
import {
  compareBehavioralArtifacts,
  readJsonlArtifacts,
  verifyProfileEquivalence,
  type BehavioralArtifacts,
} from "../support/profile-equivalence.js";

const directories: string[] = [];
async function temporary(prefix: string): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), prefix));
  directories.push(value);
  return value;
}
afterEach(
  async () =>
    await Promise.all(
      directories
        .splice(0)
        .map(async (directory) => await rm(directory, { recursive: true, force: true })),
    ),
);

function artifacts(overrides: Partial<BehavioralArtifacts> = {}): BehavioralArtifacts {
  return {
    result: { kind: "success", elapsedMs: 1, profileEntries: [] },
    checkpoint: { refs: [{ ref: "main", tipOid: "a" }] },
    jsonl: [Buffer.from('{"oid":"a"}\n')],
    ...overrides,
  };
}

describe("deterministic telemetry behavioral baseline support", () => {
  it("regenerates identical portable repository semantics", async () => {
    const first = await createDeterministicRepository(await temporary("gitlode-fixture-a-"));
    const second = await createDeterministicRepository(await temporary("gitlode-fixture-b-"));
    expect(await repositorySemanticSnapshot(first)).toEqual(
      await repositorySemanticSnapshot(second),
    );
    expect(first.graph).toHaveLength(5);
    expect(first.refs.main).toBe(first.refs.overlap);
  });
  it("compares disabled/enabled mode while excluding legacy profile and elapsed time", async () => {
    const runs: boolean[] = [];
    await expect(
      verifyProfileEquivalence(async (profile) => {
        runs.push(profile);
        return artifacts({
          result: {
            kind: "success",
            elapsedMs: profile ? 99 : 1,
            profileEntries: profile ? [{ name: "legacy" }] : [],
          },
        });
      }),
    ).resolves.toBeDefined();
    expect(runs).toEqual([false, true]);
  });
  it.each([
    ["result", artifacts({ result: { kind: "user-error" } })],
    ["checkpoint", artifacts({ checkpoint: { refs: [] } })],
    ["JSONL", artifacts({ jsonl: [Buffer.from('{"oid":"different"}\n')] })],
  ])("detects an intentional %s difference", (_name, changed) => {
    expect(compareBehavioralArtifacts(artifacts(), changed)).not.toEqual([]);
  });
  it("uses byte comparison within adapters and order-independent semantics across adapters", () => {
    const ordered = artifacts({ jsonl: [Buffer.from('{"n":1}\n{"n":2}\n')] });
    const reversed = artifacts({ jsonl: [Buffer.from('{"n":2}\n{"n":1}\n')] });
    expect(compareBehavioralArtifacts(ordered, reversed, "same-adapter")).toContain(
      "JSONL file sequence or bytes differ",
    );
    expect(compareBehavioralArtifacts(ordered, reversed, "cross-adapter")).toEqual([]);
  });
});

const baselineScenarios = [
  { id: "commit_snapshot", input: { granularity: "commit" as const } },
  {
    id: "file_snapshot_and_built_in_projection",
    input: { granularity: "file" as const, maxDiffSize: 8 },
  },
  {
    id: "multiple_refs",
    input: { granularity: "commit" as const, refs: ["main", "overlap", "release-annotated"] },
  },
  { id: "output_rotation", input: { granularity: "commit" as const, rotation: { maxLines: 1 } } },
] as const;

async function runLegacyBaseline(
  repositoryPath: string,
  adapter: ExecutionGitAdapterName,
  profile: boolean,
  overrides: Partial<WorkerRunInput>,
  priorCheckpoint?: ExtractionCheckpoint,
): Promise<BehavioralArtifacts> {
  const outputDir = await temporary(`gitlode-baseline-${adapter}-`);
  const input: WorkerRunInput = {
    repositoryPath: repositoryPath as AbsolutePath,
    refs: ["main"],
    outputDir: outputDir as AbsolutePath,
    rotation: {},
    granularity: "commit",
    profile,
    gitAdapter: adapter,
    ...overrides,
  };
  const checkpoint = priorCheckpoint ?? {
    generatedAt: "2024-02-03T04:05:06.000Z",
    repositoryPath: repositoryPath as AbsolutePath,
    refs: [],
  };
  const result = await executeWorkerRunRequest(
    { input, priorCheckpoint: checkpoint },
    { progressReporter: { emit() {} }, diagnosticReporter: { report() {} } },
    { environment: process.env },
  );
  return {
    result,
    checkpoint: result.kind === "success" ? result.checkpoint : null,
    jsonl: await readJsonlArtifacts(outputDir),
  };
}

describe("legacy profile equivalence baselines", () => {
  it.each(["isomorphic-git", "git-cli"] as const)(
    "covers commit, file, multiple refs, rotation, and built-in projection with %s",
    async (adapter) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2024-02-03T04:05:06.000Z"));
      try {
        const repository = await createDeterministicRepository(
          await temporary(`gitlode-${adapter}-repo-`),
        );
        for (const scenario of baselineScenarios) {
          await verifyProfileEquivalence(
            async (profile) =>
              await runLegacyBaseline(repository.directory, adapter, profile, scenario.input),
          );
        }
        const prior: ExtractionCheckpoint = {
          generatedAt: repository.sessionTimestamp,
          repositoryPath: repository.directory as AbsolutePath,
          refs: [
            {
              ref: "main",
              refType: "branch",
              tipOid: repository.refs.incrementalBoundary!,
              updatedAt: repository.sessionTimestamp,
            },
          ],
        };
        await verifyProfileEquivalence(
          async (profile) =>
            await runLegacyBaseline(
              repository.directory,
              adapter,
              profile,
              { granularity: "commit" },
              prior,
            ),
        );
      } finally {
        vi.useRealTimers();
      }
    },
    30_000,
  );

  it("preserves official plugin projection output when profiling changes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2024-02-03T04:05:06.000Z"));
    try {
      const repository = await createDeterministicRepository(
        await temporary("gitlode-plugin-repo-"),
      );
      await verifyProfileEquivalence(
        async (profile) =>
          await runLegacyBaseline(repository.directory, "isomorphic-git", profile, {
            granularity: "file",
            pluginBaseDirectory: process.cwd() as AbsoluteDirectoryPath,
            pluginDeclarations: {
              fileType: { entrypoint: "@gitlode/plugin-file-type", failurePolicy: "fail-run" },
            },
          }),
      );
    } finally {
      vi.useRealTimers();
    }
  }, 30_000);
});
