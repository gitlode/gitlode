import chalk from "chalk";

export interface Styling {
  spinnerGlyph(text: string): string;
  doneMarker(text: string): string;
  stageLabel(text: string): string;
  h1(text: string): string;
  h2(text: string): string;
  h3(text: string): string;
  h4(text: string): string;
  warnBadge(text: string): string;
  errorBadge(text: string): string;
  fieldKey(text: string): string;
  primaryValue(text: string): string;
  unitSuffix(text: string): string;
  refsValue(text: string): string;
  separator(text: string): string;
}

/** Plain (no-color) styling — used in non-TTY mode and tests. */
export const plainStyling: Styling = {
  spinnerGlyph: (t) => t,
  doneMarker: (t) => t,
  stageLabel: (t) => t,
  h1: (t) => t,
  h2: (t) => t,
  h3: (t) => t,
  h4: (t) => t,
  warnBadge: (t) => t,
  errorBadge: (t) => t,
  fieldKey: (t) => t,
  primaryValue: (t) => t,
  unitSuffix: (t) => t,
  refsValue: (t) => t,
  separator: (t) => t,
};

/** TTY-aware styling factory. Returns plain styling for non-TTY contexts. */
export function createStyling(isTTY: boolean): Styling {
  if (!isTTY) return plainStyling;
  return {
    spinnerGlyph: (t) => chalk.cyan(t),
    doneMarker: (t) => chalk.green.bold(t),
    stageLabel: (t) => chalk.bold(t),
    h1: (t) => chalk.black.bgGreen(t),
    h2: (t) => chalk.white.bgBlue(t),
    h3: (t) => chalk.black.bgCyan(t),
    h4: (t) => chalk.black.bgWhite(t),
    warnBadge: (t) => chalk.yellow.bold(t),
    errorBadge: (t) => chalk.red.bold(t),
    fieldKey: (t) => chalk.dim(t),
    primaryValue: (t) => t,
    unitSuffix: (t) => chalk.dim(t),
    refsValue: (t) => chalk.cyan(t),
    separator: (t) => chalk.dim(t),
  };
}
