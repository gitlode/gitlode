import { describe, expect, it } from "vitest";

import { createBootstrapRenderer } from "../../src/presentation/bootstrap-renderer.js";

describe("createBootstrapRenderer", () => {
  it("renders user-error termination as plain message lines", () => {
    const lines: string[] = [];
    const renderer = createBootstrapRenderer({
      writeLine: (line) => lines.push(line),
    });

    renderer.renderTermination({
      kind: "user-error",
      message: "line 1\nline 2",
      exitCode: 1,
    });

    expect(lines).toEqual(["line 1", "line 2"]);
  });

  it("renders success termination with no output", () => {
    const lines: string[] = [];
    const renderer = createBootstrapRenderer({
      writeLine: (line) => lines.push(line),
    });

    renderer.renderTermination({ kind: "success", exitCode: 0 });

    expect(lines).toEqual([]);
  });

  it("renders runtime errors using the stack when available", () => {
    const lines: string[] = [];
    const renderer = createBootstrapRenderer({
      writeLine: (line) => lines.push(line),
    });
    const error = new Error("boom");
    error.stack = "line 1\nline 2";

    renderer.renderRuntimeError(error);

    expect(lines).toEqual(["line 1", "line 2"]);
  });
});
