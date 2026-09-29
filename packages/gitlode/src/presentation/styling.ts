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

/** Identity baseline for formatter callers that request neither decoration nor padding. */
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

export interface StyleRule {
  readonly decorate: (text: string) => string;
  readonly padding: number;
}

export type StyleRules = Readonly<Record<keyof Styling, StyleRule>>;

/** Source-editable visual parameters; no theme detection or public configuration is involved. */
export const styleRules: StyleRules = {
  spinnerGlyph: { decorate: chalk.cyan, padding: 0 },
  doneMarker: { decorate: chalk.green.bold, padding: 0 },
  stageLabel: { decorate: chalk.bold, padding: 0 },
  h1: { decorate: chalk.black.bgGreen, padding: 1 },
  h2: { decorate: chalk.white.bgBlue, padding: 1 },
  h3: { decorate: chalk.black.bgCyan, padding: 1 },
  h4: { decorate: chalk.black.bgCyanBright, padding: 1 },
  warnBadge: { decorate: chalk.yellow.bold, padding: 0 },
  errorBadge: { decorate: chalk.red.bold, padding: 0 },
  fieldKey: { decorate: chalk.dim, padding: 0 },
  primaryValue: { decorate: plainStyling.primaryValue, padding: 0 },
  unitSuffix: { decorate: chalk.dim, padding: 0 },
  refsValue: { decorate: chalk.cyan, padding: 0 },
  separator: { decorate: chalk.dim, padding: 0 },
};

/** Preserve layout in every mode; apply decoration only for TTY output. */
export function createStyling(isTTY: boolean, rules: StyleRules = styleRules): Styling {
  const styling = { ...plainStyling };
  for (const role of Object.keys(rules) as (keyof Styling)[]) {
    const { decorate, padding } = rules[role];
    if (!Number.isSafeInteger(padding) || padding < 0)
      throw new RangeError(`Style padding for ${role} must be a nonnegative integer`);
    const space = " ".repeat(padding);
    styling[role] = (text) => {
      const padded = `${space}${text}${space}`;
      return isTTY ? decorate(padded) : padded;
    };
  }
  return styling;
}
