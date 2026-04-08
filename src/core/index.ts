export type { ExtractorConfig, ExtractionRange, PersonIdentity, RotationConfig, StateBranchEntry, StateFile };

interface PersonIdentity {
  name: string;
  email: string;
}

interface RotationConfig {
  maxLines?: number;
  maxBytes?: number;
}

type ExtractionRange =
  | { type: "commit"; hash: string }
  | { type: "date"; since: Date };

interface ExtractorConfig {
  repositoryPath: string;
  branches: string[];
  outputDir: string;
  outputPrefix: string;
  rotation: RotationConfig;
  range?: ExtractionRange;
  stateFilePath?: string;
}

interface StateBranchEntry {
  name: string;
  lastCommitHash: string;
}

interface StateFile {
  version: 1;
  generatedAt: string;
  repositoryPath: string;
  branches: StateBranchEntry[];
}
