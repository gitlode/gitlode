import { readFile, rename, writeFile } from "node:fs/promises";

import type { StateStore, StateStoreValue } from "../state/index.js";

export class NodeStateStore implements StateStore {
  private readonly stateFilePath: string;

  constructor(stateFilePath: string) {
    this.stateFilePath = stateFilePath;
  }

  async read(): Promise<StateStoreValue | null> {
    try {
      const raw = await readFile(this.stateFilePath, "utf8");
      return JSON.parse(raw) as StateStoreValue;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return null;
      }
      throw error;
    }
  }

  async write(state: StateStoreValue): Promise<void> {
    const tmpPath = `${this.stateFilePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
    await rename(tmpPath, this.stateFilePath);
  }
}
