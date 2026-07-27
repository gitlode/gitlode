import type { PersonIdentity } from "../model/index.js";
import type { CommitFact, FileChangeFact } from "./facts.js";

export interface ProjectedPerson extends PersonIdentity {
  /** ISO 8601 timestamp retaining the commit's own timezone offset. */
  readonly timestamp: string;
}

export interface ProjectedRepository {
  readonly name: string;
  readonly url: string | null;
}

/**
 * A serialized value stored under an extension namespace.
 * `null` represents an extension that skipped or fatally rejected the fact.
 */
export type ProjectedExtensionValue =
  | string
  | number
  | boolean
  | Readonly<Record<string, unknown>>
  | null;

export interface ProjectedExtensions {
  [namespace: string]: ProjectedExtensionValue;
}

export interface ProjectedCommit {
  readonly oid: string;
  readonly message: string;
  readonly author: ProjectedPerson;
  readonly committer: ProjectedPerson;
  readonly parents: readonly string[];
  readonly repository: ProjectedRepository;
  readonly extensions?: ProjectedExtensions;
}

export interface ProjectedFileChange extends ProjectedCommit {
  readonly file: {
    readonly path: string;
    readonly status: "added" | "modified" | "deleted";
    readonly additions: number | null;
    readonly deletions: number | null;
  };
}

interface FactPairMap {
  commit: { readonly fact: CommitFact; readonly record: ProjectedCommit };
  "file-change": { readonly fact: FileChangeFact; readonly record: ProjectedFileChange };
}

export type FactType = keyof FactPairMap;

export type FactFor<Type extends FactType> = FactPairMap[Type]["fact"];

export type Fact = FactFor<FactType>;

export type ProjectedRecordFor<Type extends FactType> = FactPairMap[Type]["record"];

export type ProjectedRecord = ProjectedRecordFor<FactType>;
