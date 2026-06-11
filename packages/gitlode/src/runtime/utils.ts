import { basename } from "node:path";

import { GitAdapterError } from "../git/errors.js";
import type { RepositoryObjectFormat } from "../git/types.js";
import type { OidProfile } from "../model/types.js";

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
