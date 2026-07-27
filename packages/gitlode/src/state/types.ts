import type { ExtractionState } from "../extraction-api/index.js";

export type StateStoreValue = ExtractionState;

export interface StateStore {
  read(): Promise<StateStoreValue | null>;
  write(state: StateStoreValue): Promise<void>;
}
