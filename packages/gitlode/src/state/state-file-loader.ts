import type { StateStore, StateStoreValue } from "./types.js";
import { validateStateFileContents } from "./validation.js";

export async function loadStateFile(stateStore: StateStore): Promise<StateStoreValue | undefined> {
  const state = await stateStore.read();
  if (state === null) {
    return undefined;
  }

  return validateStateFileContents(state);
}
