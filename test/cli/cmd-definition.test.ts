import { describe, expect, it } from "vitest";

import { program } from "../../src/cli/index.js";

describe("program – help output wiring", () => {
  it("has a name and description", () => {
    expect(program.name()).toBe("gitrail");
    expect(program.description()).toBeTruthy();
  });

  it("exposes all expected option and argument definitions", () => {
    const longFlags = program.options.map((o) => o.long);

    const expectedLongFlags = [
      "--ref",
      "--incremental",
      "--output-dir",
      "--output-prefix",
      "--state",
      "--missing-state",
      "--since-ref",
      "--since-date",
      "--rotate-lines",
      "--rotate-size",
      "--quiet",
      "--profile",
      "--per-file",
    ];
    for (const flag of expectedLongFlags) {
      expect(longFlags, `expected option "${flag}" to be registered`).toContain(flag);
    }

    expect(
      program.registeredArguments[0]?.name(),
      "expected positional argument 'repository-path' to be registered",
    ).toBe("repository-path");
  });

  it("each option and argument has a description string", () => {
    for (const opt of program.options) {
      expect(typeof opt.description, `option "${opt.long}" is missing a description`).toBe(
        "string",
      );
      expect(opt.description.length, `option "${opt.long}" has empty description`).toBeGreaterThan(
        0,
      );
    }
    for (const arg of program.registeredArguments) {
      expect(typeof arg.description, `argument "${arg.name()}" is missing a description`).toBe(
        "string",
      );
      expect(
        arg.description.length,
        `argument "${arg.name()}" has empty description`,
      ).toBeGreaterThan(0);
    }
  });
});
