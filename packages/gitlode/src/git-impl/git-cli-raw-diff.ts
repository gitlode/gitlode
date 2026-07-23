import { GitAdapterError, type FileBlobMode } from "../git/index.js";
import type { BlobOid } from "../model/index.js";
import { captureGroupOrThrow } from "../support/index.js";

export interface CliFileBlobSnapshotDescriptor {
  readonly path: string;
  readonly oid: BlobOid;
  readonly mode: FileBlobMode;
}

export type CliFileBlobChangeDescriptor =
  | {
      readonly status: "added";
      readonly before: null;
      readonly after: CliFileBlobSnapshotDescriptor;
    }
  | {
      readonly status: "modified";
      readonly before: CliFileBlobSnapshotDescriptor;
      readonly after: CliFileBlobSnapshotDescriptor;
    }
  | {
      readonly status: "deleted";
      readonly before: CliFileBlobSnapshotDescriptor;
      readonly after: null;
    };

interface RawDiffTreeEntry {
  readonly path: string;
  readonly oldMode: string;
  readonly newMode: string;
  readonly oldOid: string;
  readonly newOid: string;
  readonly status: string;
}

export function parseRawDiffTreeOutput(output: Buffer): readonly CliFileBlobChangeDescriptor[] {
  if (output.length === 0) return [];
  const tokens = splitNullTerminatedFields(output);
  const changes: CliFileBlobChangeDescriptor[] = [];

  for (let index = 0; index < tokens.length; index += 2) {
    const header = tokens[index];
    const path = tokens[index + 1];
    if (header === undefined || path === undefined) {
      throw new GitAdapterError("Unexpected truncated diff-tree output", "UNKNOWN");
    }
    const entry = parseRawDiffTreeEntry(header, path);
    validateRawDiffTreeEntry(entry);
    const oldMode = normalizeCliFileBlobMode(entry.oldMode);
    const newMode = normalizeCliFileBlobMode(entry.newMode);

    if (oldMode !== null && newMode !== null) {
      changes.push({
        status: "modified",
        before: { path: entry.path, oid: entry.oldOid as BlobOid, mode: oldMode },
        after: { path: entry.path, oid: entry.newOid as BlobOid, mode: newMode },
      });
    } else if (newMode !== null) {
      changes.push({
        status: "added",
        before: null,
        after: { path: entry.path, oid: entry.newOid as BlobOid, mode: newMode },
      });
    } else if (oldMode !== null) {
      changes.push({
        status: "deleted",
        before: { path: entry.path, oid: entry.oldOid as BlobOid, mode: oldMode },
        after: null,
      });
    }
  }

  return changes;
}

function splitNullTerminatedFields(output: Buffer): readonly string[] {
  if (output[output.length - 1] !== 0) {
    throw new GitAdapterError("Unexpected unterminated diff-tree output", "UNKNOWN");
  }
  const fields: string[] = [];
  let start = 0;
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] !== 0) continue;
    fields.push(output.subarray(start, index).toString("utf8"));
    start = index + 1;
  }
  return fields;
}

function parseRawDiffTreeEntry(header: string, path: string): RawDiffTreeEntry {
  const match = /^:(\d{6}) (\d{6}) ([0-9a-f]+) ([0-9a-f]+) ([AMDT])$/.exec(header);
  if (!match) {
    throw new GitAdapterError(`Unexpected diff-tree entry: ${header}`, "UNKNOWN");
  }
  return {
    path,
    oldMode: captureGroupOrThrow(match, 1),
    newMode: captureGroupOrThrow(match, 2),
    oldOid: captureGroupOrThrow(match, 3),
    newOid: captureGroupOrThrow(match, 4),
    status: captureGroupOrThrow(match, 5),
  };
}

function normalizeCliFileBlobMode(mode: string): FileBlobMode | null {
  if (mode === "100644" || mode === "100755" || mode === "120000") return mode;
  if (mode === "000000" || mode === "040000" || mode === "160000") return null;
  throw new GitAdapterError(`Unexpected Git tree mode: ${mode}`, "UNKNOWN");
}

function validateRawDiffTreeEntry(entry: RawDiffTreeEntry): void {
  const oldMissing = entry.oldMode === "000000";
  const newMissing = entry.newMode === "000000";
  const valid =
    (entry.status === "A" && oldMissing && !newMissing) ||
    (entry.status === "D" && !oldMissing && newMissing) ||
    ((entry.status === "M" || entry.status === "T") && !oldMissing && !newMissing);
  if (!valid) {
    throw new GitAdapterError(
      `Unexpected diff-tree ${entry.status} modes: ${entry.oldMode} ${entry.newMode}`,
      "UNKNOWN",
    );
  }
}
