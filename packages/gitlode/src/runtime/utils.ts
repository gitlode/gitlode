import { basename } from "node:path";

import { type GitAdapter, GitAdapterError, type RepositoryObjectFormat } from "../git/index.js";
import type { OidProfile } from "../model/index.js";
import type { AbsolutePath } from "../support/index.js";

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
