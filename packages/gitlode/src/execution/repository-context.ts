import { basename } from "node:path";

import type { ExtractionRange } from "@gitlode/internal-contracts/extraction";
import {
  type GitAdapter,
  GitAdapterError,
  type RepositoryObjectFormat,
} from "@gitlode/internal-contracts/git";
import type { OidProfile } from "@gitlode/internal-contracts/model";
import { type AbsolutePath, firstOrThrow } from "@gitlode/internal-foundation/support";

import type { WorkerRunInput, WorkerRunRange } from "./types.js";

export async function validateRepositoryAccess(
  input: Pick<WorkerRunInput, "repositoryPath" | "refs">,
  repositoryPath: AbsolutePath,
  gitAdapter: GitAdapter,
): Promise<void> {
  try {
    await gitAdapter.resolveRef(repositoryPath, firstOrThrow(input.refs));
  } catch (error) {
    if (error instanceof GitAdapterError && error.code === "NOT_A_REPOSITORY") {
      throw new GitAdapterError(
        `Not a Git repository: ${input.repositoryPath}`,
        "NOT_A_REPOSITORY",
      );
    }
    if (error instanceof GitAdapterError && error.code === "REF_NOT_FOUND") {
      return;
    }
    throw error;
  }
}

export async function resolveRepositoryBasics(
  repositoryPath: string,
  gitAdapter: GitAdapter,
  explicitRepoName?: string,
  explicitRepoUrl?: string,
): Promise<{ repoName: string; repoUrl: string | null }> {
  const repoUrl =
    explicitRepoUrl !== undefined ? explicitRepoUrl : await gitAdapter.getRemoteUrl(repositoryPath);
  const repoName =
    explicitRepoName !== undefined ? explicitRepoName : deriveRepoName(repoUrl, repositoryPath);

  return {
    repoName,
    repoUrl,
  };
}

export async function resolveExtractionRange(
  range: WorkerRunRange | undefined,
  repositoryPath: AbsolutePath,
  gitAdapter: GitAdapter,
): Promise<ExtractionRange | undefined> {
  if (range === undefined) {
    return undefined;
  }
  if (range.type === "date") {
    const since = new Date(range.since);
    if (Number.isNaN(since.getTime())) {
      throw new Error(`Invalid date format in worker request: ${range.since}`);
    }
    return { type: "date", since };
  }

  try {
    const resolvedSinceRef = await gitAdapter.resolveRef(repositoryPath, range.since);
    return { type: "ref", since: resolvedSinceRef };
  } catch (error) {
    if (error instanceof GitAdapterError && error.code === "REF_NOT_FOUND") {
      throw new GitAdapterError(`Ref not found: ${range.since}`, "REF_NOT_FOUND");
    }
    throw error;
  }
}

export function resolveOutputPrefix(
  outputPrefix: string | undefined,
  repoUrl: string | null,
  repoPath: string,
): string {
  if (outputPrefix !== undefined) {
    return outputPrefix;
  }
  if (repoUrl) {
    const lastSegment = repoUrl.split("/").pop() ?? "";
    const stripped = lastSegment.replace(/\.git$/, "");
    return stripped || basename(repoPath);
  }
  return basename(repoPath);
}

export async function resolveRepositoryObjectFormat(
  repoPath: AbsolutePath,
  gitAdapter: GitAdapter,
): Promise<OidProfile> {
  const supportedObjectFormats = gitAdapter.supportedObjectFormats();
  const repositoryObjectFormat = await gitAdapter.getRepositoryObjectFormat(repoPath);
  assertSupportedRepositoryObjectFormat(repositoryObjectFormat, supportedObjectFormats);
  return repositoryObjectFormat;
}

export function assertSupportedRepositoryObjectFormat(
  format: RepositoryObjectFormat,
  supportedFormats: readonly OidProfile[],
): asserts format is OidProfile {
  if (supportedFormats.includes(format as OidProfile)) {
    return;
  }

  const supportedList = supportedFormats.join(", ");
  throw new GitAdapterError(
    `Unsupported repository object format: ${format}. Supported formats: ${supportedList}.`,
    "UNSUPPORTED_OBJECT_FORMAT",
  );
}

export function deriveRepoName(remoteUrl: string | null, repoPath: string): string {
  if (remoteUrl) {
    const lastSegment = remoteUrl.split("/").pop() ?? "";
    const stripped = lastSegment.replace(/\.git$/, "");
    return stripped || basename(repoPath);
  }

  return basename(repoPath);
}
