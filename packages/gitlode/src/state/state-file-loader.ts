import type { ExtractionCheckpoint } from "../extraction-api/index.js";
import type { StateDocumentV2, StateStore } from "./types.js";
import { validateStateFileContents } from "./validation.js";

export async function loadStateFile(
  stateStore: StateStore,
): Promise<ExtractionCheckpoint | undefined> {
  const document = await stateStore.read();
  if (document === null) {
    return undefined;
  }

  return validateStateFileContents(document);
}

export async function saveStateFile(
  stateStore: StateStore,
  checkpoint: ExtractionCheckpoint,
): Promise<void> {
  const document: StateDocumentV2 = {
    version: 2,
    generatedAt: checkpoint.generatedAt,
    repositoryPath: checkpoint.repositoryPath,
    refs: checkpoint.refs.map((entry) => ({
      ref: entry.ref,
      refType: entry.refType,
      tipOid: entry.tipOid,
      updatedAt: entry.updatedAt,
    })),
  };
  await stateStore.write(document);
}
