import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("otel-support source boundary", () => {
  it("contains no gitlode-specific attribute or scope names", async () => {
    const directory = new URL("../../src/otel-support/", import.meta.url);
    const files = (await readdir(directory)).filter((file) => file.endsWith(".ts"));
    const source = (
      await Promise.all(files.map((file) => readFile(new URL(file, directory), "utf8")))
    )
      .join("\n")
      .toLowerCase();
    expect(source).not.toContain("gitlode.");
    expect(source).not.toContain("core_instrumentation_scopes");
    expect(source).not.toContain("stream_completion_attribute");
  });
});
