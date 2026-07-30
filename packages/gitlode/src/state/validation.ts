import type { ExtractionCheckpoint, RefCheckpoint } from "../extraction-api/index.js";
import { isCommitOidForProfile, isRefType, type OidProfile } from "../model/index.js";
import type { AbsolutePath } from "../support/index.js";

const INVALID_CONTENTS = "Invalid state file contents.";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validates and adapts a persisted state document into an extraction checkpoint. */
export function validateStateFileContents(document: unknown): ExtractionCheckpoint {
  if (!isObject(document)) {
    throw new Error(INVALID_CONTENTS);
  }
  const version = document.version;
  if (version !== 2) {
    throw new Error(
      `Unsupported state file version: ${String(version)}. Supported version: 2. Reinitialize the state file (for example, run without --incremental once with --state).`,
    );
  }
  if (
    typeof document.generatedAt !== "string" ||
    typeof document.repositoryPath !== "string" ||
    !Array.isArray(document.refs)
  ) {
    throw new Error(INVALID_CONTENTS);
  }

  const refs: RefCheckpoint[] = document.refs.map((entry) => {
    if (
      !isObject(entry) ||
      typeof entry.ref !== "string" ||
      typeof entry.refType !== "string" ||
      typeof entry.tipOid !== "string" ||
      typeof entry.updatedAt !== "string"
    ) {
      throw new Error(INVALID_CONTENTS);
    }
    if (!isRefType(entry.refType)) {
      throw new Error(`Invalid ref type in state file for ref "${entry.ref}": ${entry.refType}`);
    }
    return {
      ref: entry.ref,
      refType: entry.refType,
      tipOid: entry.tipOid,
      updatedAt: entry.updatedAt,
    } as RefCheckpoint;
  });

  return {
    generatedAt: document.generatedAt,
    repositoryPath: document.repositoryPath as AbsolutePath,
    refs,
  };
}

/** Validates a checkpoint against the repository used for the current extraction run. */
export function validatePriorCheckpoint(
  checkpoint: ExtractionCheckpoint,
  repoPath: string,
  oidProfile: OidProfile,
): ExtractionCheckpoint {
  if (checkpoint.repositoryPath !== repoPath) {
    throw new Error(
      `State file was created for a different repository: ${checkpoint.repositoryPath}`,
    );
  }
  for (const entry of checkpoint.refs) {
    if (!isCommitOidForProfile(entry.tipOid, oidProfile)) {
      throw new Error(`Invalid commit OID in state file for ref "${entry.ref}": ${entry.tipOid}`);
    }
  }
  return checkpoint;
}
