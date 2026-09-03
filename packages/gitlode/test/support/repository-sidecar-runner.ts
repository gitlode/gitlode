import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { createEmptyCheckpoint } from "../../src/state/index.js";

const exec = promisify(execFile);
export async function runRepositorySidecarForTest(input: {
  readonly cli: string;
  readonly repository: string;
  readonly config: string;
  readonly adapter: "isomorphic-git" | "git-cli";
  readonly fileFixture?: boolean;
  readonly rotationLines?: number;
}) {
  const root = await mkdtemp(join(tmpdir(), "gitlode-sidecar-test-runner-"));
  try {
    const outputDir = join(root, "output"),
      requestPath = join(root, "request.json");
    await mkdir(outputDir);
    const config = JSON.parse(await readFile(input.config, "utf8")) as {
      extensions?: Record<string, { entrypoint: string; config?: unknown; failurePolicy?: string }>;
    };
    const pluginDeclarations = config.extensions
      ? Object.fromEntries(
          Object.entries(config.extensions).map(([namespace, declaration]) => [
            namespace,
            {
              ...declaration,
              entrypoint: declaration.entrypoint.startsWith(".")
                ? resolve(dirname(input.config), declaration.entrypoint)
                : declaration.entrypoint,
            },
          ]),
        )
      : undefined;
    await writeFile(
      requestPath,
      JSON.stringify({
        workerEntryPath: resolve(dirname(input.cli), "worker-entry.js"),
        request: {
          input: {
            repositoryPath: input.repository,
            refs: ["main"],
            outputDir,
            outputPrefix: "sidecar",
            rotation: { maxLines: input.rotationLines },
            granularity: input.fileFixture ? "file" : "commit",
            maxDiffSize: input.fileFixture ? 16 : undefined,
            profile: true,
            gitAdapter: input.adapter,
            pluginBaseDirectory: config.extensions ? dirname(input.config) : undefined,
            pluginDeclarations,
          },
          priorCheckpoint: createEmptyCheckpoint(input.repository),
        },
      }),
    );
    const script = fileURLToPath(
      new URL("../../scripts/telemetry-repository-sidecar.mjs", import.meta.url),
    );
    return JSON.parse((await exec(process.execPath, [script, requestPath])).stdout) as {
      result: { kind: string; success?: { profileReport?: unknown }; profileReport?: unknown };
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
