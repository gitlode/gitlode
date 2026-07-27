import type { ExtractionState } from "../extraction-api/index.js";
import type { AbsolutePath } from "../support/index.js";

export function createEmptyState(repositoryPath: AbsolutePath): ExtractionState {
  return { version: 2, generatedAt: "", repositoryPath, refs: [] };
}
