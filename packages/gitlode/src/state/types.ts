import type { RefType } from "../model/index.js";
import type { AbsolutePath } from "../support/index.js";

interface StateDocumentRefV2 {
  readonly ref: string;
  readonly refType: RefType;
  readonly tipOid: string;
  readonly updatedAt: string;
}

export interface StateDocumentV2 {
  readonly version: 2;
  readonly generatedAt: string;
  readonly repositoryPath: AbsolutePath;
  readonly refs: readonly StateDocumentRefV2[];
}

export interface StateStore {
  read(): Promise<unknown | null>;
  write(document: StateDocumentV2): Promise<void>;
}
