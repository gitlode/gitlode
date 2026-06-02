import { describe, expect, it } from "vitest";

describe("entrypoint smoke test", () => {
  it("imports the CLI entrypoint without executing the process boundary", async () => {
    const previousExitCode = process.exitCode;
    await import("../src/index.js");
    expect(process.exitCode).toBe(previousExitCode);
  });
});
