import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { z } from "zod";

import {
  dirnameOfFilePath,
  type IsoDateTimeString,
  type AbsoluteDirectoryPath,
  type AbsolutePath,
} from "../support/index.js";
import {
  byteSizeString,
  ROTATION_SIZE_MAX_BYTES,
  ROTATION_SIZE_MIN_BYTES,
} from "./schema-helpers.js";
import type { ConfigDiagnosticCode, ConfigExtensionsSection, ConfigLoadResult } from "./types.js";

const NAMESPACE_PATTERN = /^[a-z0-9-]+$/;

const ConfigRangeSchema = z.union([
  z
    .object({
      sinceRef: z.string().min(1),
    })
    .strict(),
  z
    .object({
      sinceDate: z.iso.datetime({ offset: true }).transform((value) => value as IsoDateTimeString),
    })
    .strict(),
]);

const ConfigExtractionSchema = z
  .object({
    refs: z.array(z.string().min(1)).min(1).optional(),
    range: ConfigRangeSchema.optional(),
  })
  .strict();

const ConfigOutputSchema = z
  .object({
    directory: z.string().min(1).optional(),
    prefix: z.string().min(1).optional(),
    rotation: z
      .object({
        lines: z.number().int().min(1).optional(),
        size: byteSizeString({
          minBytes: ROTATION_SIZE_MIN_BYTES,
          maxBytes: ROTATION_SIZE_MAX_BYTES,
        }).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const ConfigRepositorySchema = z
  .object({
    name: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
  })
  .strict();

const ConfigRuntimeSchema = z
  .object({
    profile: z.boolean().optional(),
    gitAdapter: z.enum(["isomorphic-git", "git-cli"]).default("isomorphic-git"),
  })
  .strict();

const ConfigExtensionEntrySchema = z
  .object({
    entrypoint: z.string().min(1),
    config: z.unknown().optional(),
    failurePolicy: z.enum(["skip-fact", "fatal"]).default("skip-fact"),
  })
  .strict();

const ConfigExtensionsSchema = z.record(
  z.string().regex(NAMESPACE_PATTERN, { message: "must match pattern [a-z0-9-]+" }),
  ConfigExtensionEntrySchema,
);

export const ProjectConfigSchema = z
  .object({
    version: z.literal(1),
    extraction: ConfigExtractionSchema.optional(),
    output: ConfigOutputSchema.optional(),
    repository: ConfigRepositorySchema.optional(),
    runtime: ConfigRuntimeSchema.optional(),
    extensions: ConfigExtensionsSchema.optional(),
  })
  .strict();

type ProjectConfig = z.Infer<typeof ProjectConfigSchema>;

function failure(code: ConfigDiagnosticCode, message: string): ConfigLoadResult {
  return {
    kind: "failure",
    diagnostic: { code, message },
  };
}

function formatZodIssues(error: z.ZodError, configPath: string): string {
  const messages = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? ` at "${issue.path.join(".")}"` : "";
    return `${path}: ${issue.message}`;
  });
  return `Invalid config file${messages.join(";")} (${configPath})`;
}

function rebaseConfigPaths(
  parsed: ProjectConfig,
  configDirectory: AbsoluteDirectoryPath,
): ProjectConfig {
  const output =
    parsed.output?.directory === undefined
      ? parsed.output
      : {
          ...parsed.output,
          directory: resolve(configDirectory, parsed.output.directory),
        };

  const extensions: ConfigExtensionsSection | undefined = parsed.extensions
    ? (Object.fromEntries(
        Object.entries(parsed.extensions).map(([namespace, entry]) => {
          const rebasedEntrypoint =
            entry.entrypoint.startsWith(".") || isAbsolute(entry.entrypoint)
              ? resolve(configDirectory, entry.entrypoint)
              : entry.entrypoint;
          return [namespace, { ...entry, entrypoint: rebasedEntrypoint }];
        }),
      ) as ConfigExtensionsSection)
    : undefined;

  return {
    ...parsed,
    output,
    extensions,
  };
}
export async function loadConfigFile(configPath: AbsolutePath): Promise<ConfigLoadResult> {
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    const code =
      error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") {
      return failure("not-found", `Config file not found: ${configPath}`);
    }
    return failure("read-failed", `Failed to read config file: ${configPath}`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return failure("invalid-json", `Invalid config file: not valid JSON (${configPath})`);
  }

  const parsed = ProjectConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return failure("invalid-schema", formatZodIssues(parsed.error, configPath));
  }

  const configDirectory: AbsoluteDirectoryPath = dirnameOfFilePath(configPath);
  const loaded = rebaseConfigPaths(parsed.data, configDirectory);

  return { kind: "success", value: loaded };
}
