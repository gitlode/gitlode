export interface PersonIdentity {
  name: string;
  email: string;
}

export interface RotationConfig {
  maxLines?: number;
  maxBytes?: number;
}

export type ExtractionRange = { type: "commit"; hash: string } | { type: "date"; since: Date };

export interface ExtractorConfig {
  repositoryPath: string;
  branches: string[];
  outputDir: string;
  outputPrefix: string;
  rotation: RotationConfig;
  range?: ExtractionRange;
  stateFilePath?: string;
}

export interface StateBranchEntry {
  name: string;
  lastCommitHash: string;
}

export interface StateFile {
  version: 1;
  generatedAt: string;
  repositoryPath: string;
  branches: StateBranchEntry[];
}

export interface ExtractionResult {
  commitsWritten: number;
  filesCreated: number;
  bytesWritten: number;
  elapsedMs: number;
  branches: string[];
}
