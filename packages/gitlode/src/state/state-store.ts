import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  ExtractionState,
  ProgressReporter,
  StateStore,
  MISSING_STATES,
} from "../core/index.js";
import { isCommitOidForProfile, isRefType, type OidProfile } from "../model/index.js";

export interface PriorStateLoadOptions {
  readonly incremental: boolean;
  readonly missingState?: (typeof MISSING_STATES)[number];
  readonly stateFilePath?: string;
}

function emptyState(repositoryPath: string): ExtractionState {
  return { version: 2, generatedAt: "", repositoryPath, refs: [] };
}

export function validateLoadedState(
  state: ExtractionState,
  repoPath: string,
  oidProfile: OidProfile,
): ExtractionState {
  if (state.version !== 2) {
    throw new Error(
      `Unsupported state file version: ${state.version}. Supported version: 2. Reinitialize the state file (for example, run without --incremental once with --state).`,
    );
  }

  const recordedPath = resolve(state.repositoryPath);
  if (recordedPath !== repoPath) {
    throw new Error(`State file was created for a different repository: ${state.repositoryPath}`);
  }

  for (const entry of state.refs) {
    if (!isRefType(entry.refType)) {
      throw new Error(
        `Invalid ref type in state file for ref "${entry.ref}": ${String(entry.refType)}`,
      );
    }
    if (!isCommitOidForProfile(entry.tipOid, oidProfile)) {
      throw new Error(`Invalid commit OID in state file for ref "${entry.ref}": ${entry.tipOid}`);
    }
  }

  return state;
}

export class NodeStateStore implements StateStore {
  private readonly stateFilePath: string;

  constructor(stateFilePath: string) {
    this.stateFilePath = stateFilePath;
  }

  async read(): Promise<ExtractionState | null> {
    try {
      const raw = await readFile(this.stateFilePath, "utf8");
      return JSON.parse(raw) as ExtractionState;
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

  async write(state: ExtractionState): Promise<void> {
    const tmpPath = `${this.stateFilePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
    await rename(tmpPath, this.stateFilePath);
  }
}

export async function loadPriorState(
  stateStore: StateStore | undefined,
  options: PriorStateLoadOptions,
  repoPath: string,
  oidProfile: OidProfile,
  reporter: ProgressReporter,
): Promise<ExtractionState> {
  if (!stateStore || !options.incremental) {
    return emptyState(repoPath);
  }

  const state = await stateStore.read();
  if (state === null) {
    if (options.missingState === "snapshot") {
      reporter.emit({
        type: "warning",
        message: `State file not found: ${options.stateFilePath}. Falling back to full snapshot extraction.`,
      });
    }
    return emptyState(repoPath);
  }

  return validateLoadedState(state, repoPath, oidProfile);
}
