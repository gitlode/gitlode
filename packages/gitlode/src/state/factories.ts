import type { ExtractionCheckpoint } from "@gitlode/internal-contracts/extraction";
import type { AbsolutePath } from "@gitlode/internal-foundation/support";

export function createEmptyCheckpoint(repositoryPath: AbsolutePath): ExtractionCheckpoint {
  return { generatedAt: "", repositoryPath, refs: [] };
}
