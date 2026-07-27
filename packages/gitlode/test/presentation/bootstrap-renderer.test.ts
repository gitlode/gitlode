import { describe, expect, it } from "vitest";

import { createBootstrapRenderer } from "../../src/presentation/bootstrap-renderer.js";

describe("presentation createBootstrapRenderer", () => {
  it("renders user errors as plain message lines", () => {
    const lines: string[] = [];
    const renderer = createBootstrapRenderer({
      writeLine: (line) => lines.push(line),
    });

    renderer.renderUserError("line 1\nline 2");

    expect(lines).toEqual(["line 1", "line 2"]);
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
