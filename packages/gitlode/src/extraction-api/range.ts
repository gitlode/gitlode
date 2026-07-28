import type { CommitOid } from "../model/index.js";

export type ExtractionRange =
  | { readonly type: "ref"; readonly since: CommitOid }
  | { readonly type: "date"; readonly since: Date };
