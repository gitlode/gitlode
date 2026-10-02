import chalk from "chalk";

export interface Styling {
  active(text: string): string;
  success(text: string): string;
  label(text: string): string;
  h1(text: string): string;
  h2(text: string): string;
  h3(text: string): string;
  h4(text: string): string;
  warning(text: string): string;
  error(text: string): string;
  fieldLabel(text: string): string;
  attributeName(text: string): string;
  value(text: string): string;
  unit(text: string): string;
  reference(text: string): string;
  separator(text: string): string;
}

/** Identity baseline for formatter callers that request neither decoration nor padding. */
export const plainStyling: Styling = {
  active: (t) => t,
  success: (t) => t,
  label: (t) => t,
  h1: (t) => t,
  h2: (t) => t,
  h3: (t) => t,
  h4: (t) => t,
  warning: (t) => t,
  error: (t) => t,
  fieldLabel: (t) => t,
  attributeName: (t) => t,
  value: (t) => t,
  unit: (t) => t,
  reference: (t) => t,
  separator: (t) => t,
};

interface StyleRule {
  readonly decorate: (text: string) => string;
  readonly padding: number;
}

type StyleRules = Readonly<Record<keyof Styling, StyleRule>>;

/** Source-editable visual parameters; no theme detection or public configuration is involved. */
export const styleRules: StyleRules = {
  active: { decorate: chalk.cyan, padding: 0 },
  success: { decorate: chalk.green.bold, padding: 0 },
  label: { decorate: chalk.bold, padding: 0 },
  h1: { decorate: chalk.black.bgGreen, padding: 1 },
  h2: { decorate: chalk.white.bgBlue, padding: 1 },
  h3: { decorate: chalk.black.bgCyan, padding: 1 },
  h4: { decorate: chalk.black.bgCyanBright, padding: 1 },
  warning: { decorate: chalk.yellow.bold, padding: 0 },
  error: { decorate: chalk.red.bold, padding: 0 },
  fieldLabel: { decorate: chalk.dim, padding: 0 },
  attributeName: { decorate: plainStyling.attributeName, padding: 0 },
  value: { decorate: plainStyling.value, padding: 0 },
  unit: { decorate: chalk.dim, padding: 0 },
  reference: { decorate: chalk.cyan, padding: 0 },
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
