export const MISSING_STATES = ["error", "snapshot"] as const;

export type MissingStatePolicy = (typeof MISSING_STATES)[number];
