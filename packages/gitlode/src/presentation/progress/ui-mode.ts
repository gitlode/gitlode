import type { UiMode } from "./types.js";

export function resolveUiMode(quiet: boolean, isTTY: boolean): UiMode {
  if (quiet) return "quiet";
  if (isTTY) return "tty-interactive";
  return "non-tty-summary";
}
