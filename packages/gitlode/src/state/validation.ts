import type { ExtractionState } from "../extraction-api/index.js";
import { isCommitOidForProfile, isRefType, type OidProfile } from "../model/index.js";
import type { AbsolutePath } from "../support/index.js";

/**
 * Validates a structurally loaded state against the repository used for the
 * current extraction run.
 */
export function validatePriorState(
  state: ExtractionState,
  repoPath: string,
  oidProfile: OidProfile,
): ExtractionState {
  const recordedPath: AbsolutePath = state.repositoryPath;
  if (recordedPath !== repoPath) {
    throw new Error(`State file was created for a different repository: ${state.repositoryPath}`);
  }

  for (const entry of state.refs) {
    if (!isCommitOidForProfile(entry.tipOid, oidProfile)) {
      throw new Error(`Invalid commit OID in state file for ref "${entry.ref}": ${entry.tipOid}`);
    }
  }

  return state;
}

/** Validates state-file fields whose meaning is independent of a repository run. */
export function validateStateFileContents(state: ExtractionState): ExtractionState {
  if (state.version !== 2) {
    throw new Error(
      `Unsupported state file version: ${state.version}. Supported version: 2. Reinitialize the state file (for example, run without --incremental once with --state).`,
    );
  }

  for (const entry of state.refs) {
    if (!isRefType(entry.refType)) {
      throw new Error(
        `Invalid ref type in state file for ref "${entry.ref}": ${String(entry.refType)}`,
      );
    }
  }

  return state;
}
