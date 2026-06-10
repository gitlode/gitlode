import type { REF_TYPES } from "./constants.js";

declare const _commitOidBrand: unique symbol;
export type CommitOid = string & { readonly [_commitOidBrand]: "CommitOid" };

export type OidProfile = "sha1" | "sha256";

export interface PersonIdentity {
  readonly name: string;
  readonly email: string;
}

export type RefType = (typeof REF_TYPES)[number];
