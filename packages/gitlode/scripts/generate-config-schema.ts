import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { toJSONSchema } from "zod";

import { ProjectConfigSchema } from "../src/cli/config/loader.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, "..");
const defaultOutputPath = resolve(packageDir, "schemas", "config-v1.schema.json");
const outputPath = process.argv[2] ? resolve(process.argv[2]) : defaultOutputPath;

async function main() {
  const generated = toJSONSchema(ProjectConfigSchema, {
    target: "draft-2020-12",
    io: "input",
    unrepresentable: "throw",
  });

  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://github.com/gitlode/gitlode/schemas/config-v1.schema.json",
    title: "gitlode configuration v1",
    description: "Schema for gitlode --config files (version 1).",
    ...generated,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
  process.stdout.write(`Generated JSON Schema: ${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
  process.exitCode = 1;
});
