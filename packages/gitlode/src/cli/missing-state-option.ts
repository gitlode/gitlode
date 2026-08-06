export const MISSING_STATE_OPTION_VALUES = ["error", "snapshot"] as const;

export type MissingStateOption = (typeof MISSING_STATE_OPTION_VALUES)[number];
