import {
  validateStateFileContents,
  type StateStore,
  type StateStoreValue,
} from "../state/index.js";

export async function loadStateFile(stateStore: StateStore): Promise<StateStoreValue | undefined> {
  const state = await stateStore.read();
  if (state === null) {
    return undefined;
  }

  return validateStateFileContents(state);
}
