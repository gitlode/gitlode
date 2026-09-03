import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ExtractionCheckpoint } from "@gitlode/internal-contracts/extraction";
import type { AbsoluteDirectoryPath, AbsolutePath } from "@gitlode/internal-foundation/support";
import { afterEach, describe, expect, it, vi } from "vitest";

import { executeWorkerRunRequest } from "../../src/execution/execute-run.js";
import type { ExecutionGitAdapterName, WorkerRunInput } from "../../src/execution/types.js";
import {
  createDeterministicRepository,
  repositorySemanticSnapshot,
  type DeterministicRepository,
} from "../support/deterministic-repository.js";
import {
  compareBehavioralArtifacts,
  frozenBehavioralBaseline,
  readJsonlArtifacts,
  verifyProfileEquivalence,
  type BehavioralArtifacts,
} from "../support/profile-equivalence.js";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const directories: string[] = [];
async function temporary(prefix: string): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), prefix));
  directories.push(value);
  return value;
}
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    directories
      .splice(0)
      .map(async (directory) => await rm(directory, { recursive: true, force: true })),
  );
});

function file(content: string, name = "baseline-20240203T040506000Z-000001.jsonl") {
  return { name, bytes: Buffer.from(content) };
}

function artifacts(overrides: Partial<BehavioralArtifacts> = {}): BehavioralArtifacts {
  return {
    result: {
      kind: "success",
      success: { recordsWritten: 1, elapsedMs: 1, profileReport: undefined },
    },
    checkpoint: { repositoryPath: "/tmp/repo", refs: [{ ref: "main", tipOid: "a" }] },
    jsonl: [file('{"oid":"a"}\n')],
    ...overrides,
  };
}

describe("deterministic telemetry behavioral baseline support", () => {
  it("regenerates identical isolated SHA-1 repository semantics and tag objects", async () => {
    const first = await createDeterministicRepository(await temporary("gitlode-fixture-a-"));
    const second = await createDeterministicRepository(await temporary("gitlode-fixture-b-"));
    expect(await repositorySemanticSnapshot(first)).toEqual(
      await repositorySemanticSnapshot(second),
    );
    expect(first.objectFormat).toBe("sha1");
    expect(first.annotatedTagType).toBe("tag");
    expect(first.lightweightTagType).toBe("commit");
    expect(first.annotatedTagOid).toMatch(/^[0-9a-f]{40}$/);
    expect(first.annotatedTagObject).toContain("type commit\n");
    expect(first.annotatedTagObject).toContain("tag release-annotated\n");
    expect(first.refs["root-lightweight"]).toMatch(/^[0-9a-f]{40}$/);
    expect(first.refs["release-annotated"]).toMatch(/^[0-9a-f]{40}$/);
    expect(Object.values(first.refs).every((oid) => /^[0-9a-f]{40}$/.test(oid))).toBe(true);
    expect(first.graph.every((oid) => /^[0-9a-f]{40}$/.test(oid))).toBe(true);
    expect(first.graph).toHaveLength(5);
    expect(first.refs.main).toBe(first.refs.overlap);
  });

  it("excludes only success elapsed/profile fields and detects application diagnostics", async () => {
    await expect(
      verifyProfileEquivalence(async (profile) =>
        artifacts({
          result: {
            kind: "success",
            success: {
              recordsWritten: 1,
              elapsedMs: profile ? 99 : 1,
              profileReport: undefined,
            },
          },
        }),
      ),
    ).resolves.toBeDefined();
    const changed = artifacts({
      result: {
        kind: "success",
        success: {
          recordsWritten: 1,
          elapsedMs: 1,
          profileReport: undefined,
          diagnostics: ["changed"],
        },
      },
    });
    expect(compareBehavioralArtifacts(artifacts(), changed)).toContain(
      "application result differs",
    );
  });

  it.each([
    ["result", artifacts({ result: { kind: "user-error", message: "changed" } })],
    ["checkpoint", artifacts({ checkpoint: { repositoryPath: "/tmp/repo", refs: [] } })],
    ["JSONL", artifacts({ jsonl: [file('{"oid":"different"}\n')] })],
  ])("detects an intentional %s difference", (_name, changed) => {
    expect(compareBehavioralArtifacts(artifacts(), changed)).not.toEqual([]);
  });

  it("normalizes only the exact fixture repository path in both checkpoint locations", () => {
    const correct = artifacts({
      result: {
        kind: "success",
        success: { recordsWritten: 1, elapsedMs: 1, profileReport: undefined },
        checkpoint: { repositoryPath: "/fixture", refs: [] },
      },
      checkpoint: { repositoryPath: "/fixture", refs: [] },
    });
    const wrong = artifacts({
      result: {
        kind: "success",
        success: { recordsWritten: 1, elapsedMs: 2, profileReport: undefined },
        checkpoint: { repositoryPath: "/wrong", refs: [] },
      },
      checkpoint: { repositoryPath: "/wrong", refs: [] },
    });
    expect(compareBehavioralArtifacts(correct, wrong, "same-adapter", "/fixture")).toEqual(
      expect.arrayContaining(["application result differs", "checkpoint differs"]),
    );
    expect(frozenBehavioralBaseline(wrong, "/fixture")).not.toEqual(
      frozenBehavioralBaseline(correct, "/fixture"),
    );
  });

  it("compares result and checkpoint objects semantically while preserving arrays and values", () => {
    const left = artifacts({
      result: {
        kind: "success",
        success: {
          recordsWritten: 1,
          refs: ["main", "topic"],
          elapsedMs: 1,
          profileReport: undefined,
        },
      },
      checkpoint: {
        repositoryPath: "/fixture",
        refs: [{ tipOid: "a", ref: "main" }],
        generatedAt: "fixed",
      },
    });
    const reordered = artifacts({
      result: {
        success: {
          profileReport: undefined,
          elapsedMs: 2,
          refs: ["main", "topic"],
          recordsWritten: 1,
        },
        kind: "success",
      },
      checkpoint: {
        generatedAt: "fixed",
        refs: [{ ref: "main", tipOid: "a" }],
        repositoryPath: "/fixture",
      },
    });
    expect(compareBehavioralArtifacts(left, reordered, "same-adapter", "/fixture")).toEqual([]);
    const changedArray = artifacts({
      ...reordered,
      result: {
        kind: "success",
        success: {
          recordsWritten: 1,
          refs: ["topic", "main"],
          elapsedMs: 2,
          profileReport: undefined,
        },
      },
    });
    expect(compareBehavioralArtifacts(left, changedArray, "same-adapter", "/fixture")).toContain(
      "application result differs",
    );
    const changedValue = artifacts({
      ...reordered,
      checkpoint: {
        repositoryPath: "/fixture",
        refs: [{ ref: "main", tipOid: "b" }],
        generatedAt: "fixed",
      },
    });
    expect(compareBehavioralArtifacts(left, changedValue, "same-adapter", "/fixture")).toContain(
      "checkpoint differs",
    );
  });

  it("treats filename as same-adapter and frozen baseline data but ignores it cross-adapter", () => {
    const original = artifacts({ jsonl: [file('{"oid":"a"}\n', "first.jsonl")] });
    const renamed = artifacts({ jsonl: [file('{"oid":"a"}\n', "renamed.jsonl")] });
    expect(compareBehavioralArtifacts(original, renamed)).toContain(
      "JSONL filename, file sequence, or bytes differ",
    );
    expect(compareBehavioralArtifacts(original, renamed, "cross-adapter")).toEqual([]);
    expect(frozenBehavioralBaseline(original, "/tmp/repo")).not.toEqual(
      frozenBehavioralBaseline(renamed, "/tmp/repo"),
    );
  });

  it("canonicalizes object keys but preserves array order and record multiplicity", () => {
    const canonical = artifacts({
      jsonl: [file('{"a":1,"nested":{"x":2,"y":3},"array":[1,2]}\n{"a":1}\n')],
    });
    const reordered = artifacts({
      jsonl: [file('{"array":[1,2],"nested":{"y":3,"x":2},"a":1}\n{"a":1}\n')],
    });
    expect(compareBehavioralArtifacts(canonical, reordered, "cross-adapter")).toEqual([]);
    const arrayChanged = artifacts({
      jsonl: [file('{"a":1,"nested":{"x":2,"y":3},"array":[2,1]}\n{"a":1}\n')],
    });
    expect(compareBehavioralArtifacts(canonical, arrayChanged, "cross-adapter")).toContain(
      "JSONL semantic record sets differ",
    );
    const multiplicityChanged = artifacts({
      jsonl: [file('{"a":1,"nested":{"x":2,"y":3},"array":[1,2]}\n')],
    });
    expect(compareBehavioralArtifacts(canonical, multiplicityChanged, "cross-adapter")).toContain(
      "JSONL semantic record sets differ",
    );
  });
});

interface BaselineScenario {
  readonly id: string;
  readonly input: Partial<WorkerRunInput>;
  readonly prior?: (repository: DeterministicRepository) => ExtractionCheckpoint;
}
const baselineScenarios: readonly BaselineScenario[] = [
  { id: "commit_snapshot", input: { granularity: "commit" } },
  { id: "file_snapshot", input: { granularity: "file", maxDiffSize: 8 } },
  { id: "built_in_projection", input: { granularity: "file" } },
  {
    id: "multiple_refs",
    input: { granularity: "commit", refs: ["main", "overlap", "release-annotated"] },
  },
  { id: "output_rotation", input: { granularity: "commit", rotation: { maxLines: 1 } } },
  {
    id: "incremental",
    input: { granularity: "commit" },
    prior: (repository) => ({
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
    }),
  },
  {
    id: "official_file_type_plugin",
    input: {
      granularity: "file",
      pluginBaseDirectory: packageDirectory as AbsoluteDirectoryPath,
      pluginDeclarations: {
        fileType: { entrypoint: "../plugin-file-type/src/index.ts", failurePolicy: "fail-run" },
      },
    },
  },
];

async function runLegacyBaseline(
  repository: DeterministicRepository,
  adapter: ExecutionGitAdapterName,
  profile: boolean,
  scenario: BaselineScenario,
): Promise<BehavioralArtifacts> {
  const outputDir = await temporary(`gitlode-baseline-${adapter}-`);
  const input: WorkerRunInput = {
    repositoryPath: repository.directory as AbsolutePath,
    repoName: "fixture-repository",
    repoUrl: "https://example.invalid/fixture-repository.git",
    refs: ["main"],
    outputDir: outputDir as AbsolutePath,
    outputPrefix: "baseline",
    rotation: {},
    granularity: "commit",
    profile,
    gitAdapter: adapter,
    ...scenario.input,
  };
  const priorCheckpoint = scenario.prior?.(repository) ?? {
    generatedAt: repository.sessionTimestamp,
    repositoryPath: repository.directory as AbsolutePath,
    refs: [],
  };
  const result = await executeWorkerRunRequest(
    { input, priorCheckpoint },
    { progressReporter: { emit() {} }, diagnosticReporter: { report() {} } },
    { environment: process.env },
  );
  return {
    result,
    checkpoint: result.kind === "success" ? result.checkpoint : null,
    jsonl: await readJsonlArtifacts(outputDir),
  };
}

describe("frozen migration-before legacy behavioral baselines", () => {
  it.each(["isomorphic-git", "git-cli"] as const)(
    "matches frozen baseline for every scenario with %s",
    async (adapter) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2024-02-03T04:05:06.000Z"));
      const repository = await createDeterministicRepository(
        await temporary(`gitlode-${adapter}-repo-`),
      );
      for (const scenario of baselineScenarios) {
        const modes = await verifyProfileEquivalence(
          async (profile) => await runLegacyBaseline(repository, adapter, profile, scenario),
          repository.directory,
        );
        if (scenario.id === "output_rotation") {
          expect(modes.disabled.jsonl.map((file) => file.name)).toEqual([
            "baseline-20240203T040506Z-000001.jsonl",
            "baseline-20240203T040506Z-000002.jsonl",
            "baseline-20240203T040506Z-000003.jsonl",
            "baseline-20240203T040506Z-000004.jsonl",
            "baseline-20240203T040506Z-000005.jsonl",
          ]);
        }
        expect(
          modes.disabled.result,
          `${adapter} ${scenario.id}: ${JSON.stringify(modes.disabled.result)}`,
        ).toMatchObject({ kind: "success" });
        expect(frozenBehavioralBaseline(modes.disabled, repository.directory)).toMatchSnapshot(
          `${adapter} ${scenario.id} profile disabled`,
        );
        expect(frozenBehavioralBaseline(modes.enabled, repository.directory)).toMatchSnapshot(
          `${adapter} ${scenario.id} profile enabled`,
        );
      }
    },
    30_000,
  );

  it("rejects identical drift applied to both profile modes against the frozen baseline", () => {
    const original = frozenBehavioralBaseline(artifacts(), "/tmp/repo");
    const driftedOff = artifacts({
      result: {
        kind: "success",
        success: { recordsWritten: 2, elapsedMs: 1, profileReport: undefined },
      },
    });
    const driftedOn = artifacts({
      result: {
        kind: "success",
        success: { recordsWritten: 2, elapsedMs: 2, profileReport: undefined },
      },
    });
    expect(compareBehavioralArtifacts(driftedOff, driftedOn, "same-adapter", "/tmp/repo")).toEqual(
      [],
    );
    expect(frozenBehavioralBaseline(driftedOff, "/tmp/repo")).not.toEqual(original);
    expect(frozenBehavioralBaseline(driftedOn, "/tmp/repo")).not.toEqual(original);
  });
});
