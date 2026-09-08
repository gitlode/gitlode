import type {
  CalibrationEnvironmentArtifact,
  CalibrationFailureArtifact,
  CalibrationProgressArtifact,
  CalibrationSuccessArtifact,
} from "./calibration-workflow.js";

/** The production calibration artifact composition, with I/O injected for exact tests. */
export function createProductionCalibrationArtifactAdapter<Manifest, Environment>(input: {
  readonly safeKey: string;
  readonly quantities: (selectedQuantity: number) => unknown;
  readonly environmentRef: string;
  readonly updateManifest: (selectedQuantity: number) => Manifest;
  readonly recipeHash: (manifest: Manifest) => string;
  readonly sealedManifestHash: (manifest: Manifest) => string | undefined;
  readonly makeEnvironment: (
    manifest: Manifest,
    artifact: CalibrationEnvironmentArtifact,
  ) => Promise<Environment>;
  readonly writeJson: (name: string, value: unknown) => Promise<void>;
  readonly writeManifest: (manifest: Manifest) => Promise<void>;
  readonly onProgress?: (artifact: CalibrationProgressArtifact) => void;
}) {
  return {
    writeProgress: async (artifact: CalibrationProgressArtifact) => {
      await input.writeJson(`${input.safeKey}-calibration-progress.json`, artifact);
      input.onProgress?.(artifact);
    },
    writeFailure: async (artifact: CalibrationFailureArtifact) =>
      await input.writeJson(`${input.safeKey}-calibration-failure.json`, artifact),
    writeEnvironment: async (artifact: CalibrationEnvironmentArtifact) => {
      const manifest = input.updateManifest(artifact.selectedQuantity);
      await input.writeJson(
        `${input.safeKey}-environment.json`,
        await input.makeEnvironment(manifest, artifact),
      );
    },
    writeSuccess: async (artifact: CalibrationSuccessArtifact) => {
      const manifest = input.updateManifest(artifact.selectedQuantity);
      await input.writeJson(`${input.safeKey}-calibration.json`, {
        ...artifact,
        quantities: input.quantities(artifact.selectedQuantity),
        environmentRef: input.environmentRef,
        calibrationTargetRecipeHash: input.recipeHash(manifest),
        sealedManifestHash: input.sealedManifestHash(manifest),
      });
    },
    writeManifest: input.writeManifest,
  };
}
