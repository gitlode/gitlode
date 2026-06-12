import { REF_TYPES } from "./constants.js";
import { type OidProfile, type CommitOid, type RefType } from "./types.js";

export function isCommitOidForProfile(v: unknown, profile: OidProfile): v is CommitOid {
  return typeof v === "string" && OID_PATTERN_BY_PROFILE[profile].test(v);
}

const OID_PATTERN_BY_PROFILE: Readonly<Record<OidProfile, RegExp>> = {
  sha1: /^[0-9a-f]{40}$/,
  sha256: /^[0-9a-f]{64}$/,
} as const;
export function isCommitOid(v: unknown): v is CommitOid {
  return isCommitOidForProfile(v, "sha1") || isCommitOidForProfile(v, "sha256");
}
export function isRefType(value: unknown): value is RefType {
  return typeof value === "string" && REF_TYPES.includes(value as RefType);
}
