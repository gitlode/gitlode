import { GitAdapterError, type RawCommit, type RawPerson } from "../git/index.js";
import type { CommitOid } from "../model/index.js";
import { captureGroupOrThrow } from "../support/index.js";

export function parseGitCommitObject(oid: CommitOid, content: Uint8Array): RawCommit {
  const raw = Buffer.from(content.buffer, content.byteOffset, content.byteLength).toString("utf8");
  const separator = raw.indexOf("\n\n");
  const headerText = separator >= 0 ? raw.slice(0, separator) : raw;
  const message = separator >= 0 ? raw.slice(separator + 2) : "";
  const parents: CommitOid[] = [];
  let author: RawPerson | undefined;
  let committer: RawPerson | undefined;

  for (const line of headerText.split("\n")) {
    if (line.startsWith("parent ")) parents.push(line.slice("parent ".length) as CommitOid);
    if (line.startsWith("author ")) author = parsePersonLine(line.slice("author ".length));
    if (line.startsWith("committer ")) committer = parsePersonLine(line.slice("committer ".length));
  }

  if (author === undefined || committer === undefined) {
    throw new GitAdapterError(`Unexpected commit object format: ${oid}`, "UNKNOWN");
  }

  return { oid, message, author, committer, parents };
}

function parsePersonLine(line: string): RawPerson {
  const match = /^(.*) <([^<>]*)> (\d+) ([+-]\d{4})$/.exec(line);
  if (!match) {
    throw new GitAdapterError(`Unexpected commit identity line: ${line}`, "UNKNOWN");
  }
  const timezone = captureGroupOrThrow(match, 4);
  return {
    name: captureGroupOrThrow(match, 1),
    email: captureGroupOrThrow(match, 2),
    timestamp: Number(captureGroupOrThrow(match, 3)),
    timezoneOffset: parseTimezoneOffset(timezone),
  };
}

function parseTimezoneOffset(value: string): number {
  const match = /^([+-])(\d{2})(\d{2})$/.exec(value);
  if (!match) throw new GitAdapterError(`Unexpected timezone offset: ${value}`, "UNKNOWN");
  const sign = captureGroupOrThrow(match, 1) === "+" ? 1 : -1;
  const hours = Number(captureGroupOrThrow(match, 2));
  const minutes = Number(captureGroupOrThrow(match, 3));
  return sign * (hours * 60 + minutes);
}
