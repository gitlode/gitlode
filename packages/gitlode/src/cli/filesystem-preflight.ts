import { existsSync } from "node:fs";

import {
  dirnameOfFilePath,
  type AbsolutePath,
  resolveFilePath,
} from "@gitlode/internal-foundation/support";

import type { BootstrapResult } from "./errors.js";
import type { MissingStateOption } from "./missing-state-option.js";

interface FilesystemPreflightInput {
  readonly repositoryPath: string | undefined;
  readonly outputDirectory: string;
  readonly statePath: string | undefined;
  readonly incremental: boolean;
  readonly missingState: MissingStateOption | undefined;
}

interface FilesystemPreflightResult {
  readonly repositoryPath: AbsolutePath;
  readonly outputDirectory: AbsolutePath;
  readonly statePath: AbsolutePath | undefined;
}

function userError(message: string): BootstrapResult<never> {
  return { kind: "user-error", message, exitCode: 1 };
}

export function runFilesystemPreflight(
  input: FilesystemPreflightInput,
): BootstrapResult<FilesystemPreflightResult> {
  if (!input.repositoryPath) {
    return userError("Repository path is required");
  }

  const repositoryPath = resolveFilePath(input.repositoryPath);
  if (!existsSync(repositoryPath)) {
    return userError(`Repository not found: ${input.repositoryPath}`);
  }

  const outputDirectory = resolveFilePath(input.outputDirectory);
  if (!existsSync(outputDirectory)) {
    return userError(`Output directory not found: ${input.outputDirectory}`);
  }

  let statePath: AbsolutePath | undefined;
  if (input.statePath) {
    statePath = resolveFilePath(input.statePath);
    const stateParentDirectory = dirnameOfFilePath(statePath);
    if (!existsSync(stateParentDirectory)) {
      return userError(`Parent directory for state file not found: ${stateParentDirectory}`);
    }
    if (input.incremental && input.missingState !== "snapshot" && !existsSync(statePath)) {
      return userError(`State file not found: ${statePath}`);
    }
  }

  return {
    kind: "success",
    value: {
      repositoryPath,
      outputDirectory,
      statePath,
    },
  };
}
