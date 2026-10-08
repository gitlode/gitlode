/** Owned fixture commands never inherit repository locations or injected Git configuration. */
export function fixtureGitEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const environment = Object.fromEntries(
    Object.entries(source).filter(([key]) => !key.toUpperCase().startsWith("GIT_")),
  );
  return {
    ...environment,
    TZ: "UTC",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_OPTIONAL_LOCKS: "0",
  };
}

export const foregroundMaintenanceConfig = [
  "-c",
  "maintenance.autoDetach=false",
  "-c",
  "gc.autoDetach=false",
] as const;
