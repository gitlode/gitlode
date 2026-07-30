import type { Brand } from "@gitlode/internal-foundation/type-utils";

import type { REF_TYPES } from "./constants.js";
export type CommitOid = Brand<string, "CommitOid">;
export type BlobOid = Brand<string, "BlobOid">;

export type OidProfile = "sha1" | "sha256";

export interface PersonIdentity {
  readonly name: string;
  readonly email: string;
}

export type RefType = (typeof REF_TYPES)[number];
