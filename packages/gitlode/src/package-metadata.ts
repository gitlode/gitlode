import packageManifest from "../package.json" with { type: "json" };

/** Package metadata embedded into release bundles; never resolved from a runtime filesystem path. */
export const packageVersion: string = packageManifest.version;
