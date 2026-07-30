import type { ExtractionCheckpoint } from "../extraction-api/index.js";
import type { AbsolutePath } from "../support/index.js";

export function createEmptyCheckpoint(repositoryPath: AbsolutePath): ExtractionCheckpoint {
  return { generatedAt: "", repositoryPath, refs: [] };
}
