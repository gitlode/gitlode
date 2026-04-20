declare const _commitHashBrand: unique symbol;
export type CommitHash = string & { readonly [_commitHashBrand]: "CommitHash" };

export function isCommitHash(v: unknown): v is CommitHash {
  return typeof v === "string" && /^[0-9a-f]{40}$/.test(v);
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}

export interface PersonIdentity {
  readonly name: string;
  readonly email: string;
}

export interface RotationConfig {
  readonly maxLines?: number;
  readonly maxBytes?: number;
}

export type ExtractionRange =
  | { readonly type: "ref"; readonly ref: CommitHash }
  | { readonly type: "date"; readonly since: Date };

export interface ExtractorConfig {
  readonly repositoryPath: string;
  readonly branches: readonly string[];
  readonly outputDir: string;
  readonly outputPrefix: string;
  readonly rotation: RotationConfig;
  readonly mode: "snapshot" | "incremental";
  readonly onMissingState?: "error" | "snapshot";
  readonly range?: ExtractionRange;
  readonly stateFilePath?: string;
  readonly outputMode: "commit" | "file";
}

export interface Reporter {
  warn(message: string): void;
  progress(recordsWritten: number): void;
  done(recordsWritten: number): void;
}

export interface StateStore {
  read(): Promise<StateFile | null>;
  write(state: StateFile): Promise<void>;
}

export type WallClock = () => Date;
export type MonotonicClock = () => number;

export interface StateBranchEntry {
  readonly name: string;
  readonly lastCommitHash: CommitHash;
}

export interface StateFile {
  readonly version: 1;
  readonly generatedAt: string;
  readonly repositoryPath: string;
  readonly branches: readonly StateBranchEntry[];
}

export interface ExtractionResult {
  readonly recordsWritten: number;
  readonly filesCreated: number;
  readonly bytesWritten: number;
  readonly elapsedMs: number;
  readonly branches: readonly string[];
}
