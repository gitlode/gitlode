import { describe, expect, it } from "vitest";

import { program } from "../../src/cli/args.js";

describe("program – help output wiring", () => {
  it("has a name and description", () => {
    expect(program.name()).toBe("gitlode");
    expect(program.description()).toBeTruthy();
  });

  it("exposes all expected option and argument definitions", () => {
    const longFlags = program.options.map((o) => o.long);

    const expectedLongFlags = [
      "--ref",
      "--incremental",
      "--output-dir",
      "--output-prefix",
      "--max-diff-size",
      "--state",
      "--missing-state",
      "--since-ref",
      "--since-date",
      "--rotate-lines",
      "--rotate-size",
      "--quiet",
      "--profile",
      "--per-file",
      "--repo-name",
      "--repo-url",
      "--config",
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

  it("assigns options to the documented help groups", () => {
    const optionsByLong = new Map(program.options.map((option) => [option.long, option]));

    expect(optionsByLong.get("--quiet")?.helpGroupHeading).toBe("Runtime and Diagnostics");
    expect(optionsByLong.get("--profile")?.helpGroupHeading).toBe("Runtime and Diagnostics");

    expect(optionsByLong.get("--ref")?.helpGroupHeading).toBe("Required Input");

    expect(optionsByLong.get("--output-dir")?.helpGroupHeading).toBe(
      "Output and Repository Metadata",
    );
    expect(optionsByLong.get("--output-prefix")?.helpGroupHeading).toBe(
      "Output and Repository Metadata",
    );
    expect(optionsByLong.get("--per-file")?.helpGroupHeading).toBe(
      "Output and Repository Metadata",
    );
    expect(optionsByLong.get("--max-diff-size")?.helpGroupHeading).toBe(
      "Output and Repository Metadata",
    );
    expect(optionsByLong.get("--repo-name")?.helpGroupHeading).toBe(
      "Output and Repository Metadata",
    );
    expect(optionsByLong.get("--repo-url")?.helpGroupHeading).toBe(
      "Output and Repository Metadata",
    );

    expect(optionsByLong.get("--since-ref")?.helpGroupHeading).toBe(
      "Extraction Range (Snapshot Mode)",
    );
    expect(optionsByLong.get("--since-date")?.helpGroupHeading).toBe(
      "Extraction Range (Snapshot Mode)",
    );

    expect(optionsByLong.get("--incremental")?.helpGroupHeading).toBe("Incremental Extraction");
    expect(optionsByLong.get("--state")?.helpGroupHeading).toBe("Incremental Extraction");
    expect(optionsByLong.get("--missing-state")?.helpGroupHeading).toBe("Incremental Extraction");

    expect(optionsByLong.get("--rotate-lines")?.helpGroupHeading).toBe("File Rotation");
    expect(optionsByLong.get("--rotate-size")?.helpGroupHeading).toBe("File Rotation");

    expect(optionsByLong.get("--config")?.helpGroupHeading).toBe("Configuration File");
  });

  it("renders grouped help headings", () => {
    const help = program.helpInformation();

    expect(help).toContain("Required Input");
    expect(help).toContain("Runtime and Diagnostics");
    expect(help).toContain("Output and Repository Metadata");
    expect(help).toContain("Extraction Range (Snapshot Mode)");
    expect(help).toContain("Incremental Extraction");
    expect(help).toContain("File Rotation");
    expect(help).toContain("Configuration File");
  });
});
