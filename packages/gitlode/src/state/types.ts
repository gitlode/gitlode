import type { RefType } from "@gitlode/internal-contracts/model";
import type { AbsolutePath } from "@gitlode/internal-foundation/support";

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
