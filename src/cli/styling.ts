
import chalk from "chalk";

export interface Styling {
  spinnerGlyph(text: string): string;
  doneMarker(text: string): string;
  stageLabel(text: string): string;
  summaryHeader(text: string): string;
  warnBadge(text: string): string;
  errorBadge(text: string): string;
  fieldKey(text: string): string;
  primaryValue(text: string): string;
  unitSuffix(text: string): string;
  refsValue(text: string): string;
}

/** Plain (no-color) styling — used in non-TTY mode and tests. */
export const plainStyling: Styling = {
  spinnerGlyph: (t) => t,
  doneMarker: (t) => t,
  stageLabel: (t) => t,
  summaryHeader: (t) => t,
  warnBadge: (t) => t,
  errorBadge: (t) => t,
  fieldKey: (t) => t,
  primaryValue: (t) => t,
  unitSuffix: (t) => t,
  refsValue: (t) => t,
};

/** TTY-aware styling factory. Returns plain styling for non-TTY contexts. */
export function createStyling(isTTY: boolean): Styling {
  if (!isTTY) return plainStyling;
  return {
    spinnerGlyph: (t) => chalk.cyan(t),
    doneMarker: (t) => chalk.green.bold(t),
    stageLabel: (t) => chalk.bold(t),
    summaryHeader: (t) => chalk.green.bold(t),
    warnBadge: (t) => chalk.yellow.bold(t),
    errorBadge: (t) => chalk.red.bold(t),
    fieldKey: (t) => chalk.dim(t),
    primaryValue: (t) => chalk.whiteBright(t),
    unitSuffix: (t) => chalk.dim(t),
    refsValue: (t) => chalk.cyan(t),
  };
}
