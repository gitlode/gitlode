import { describe, expect, it } from "vitest";
import { GitAdapterError } from "../src/git/errors.js";

describe("GitAdapterError", () => {
  it("has the correct name", () => {
    const err = new GitAdapterError("ref not found", "REF_NOT_FOUND");
    expect(err.name).toBe("GitAdapterError");
  });

  it("exposes code and message", () => {
    const err = new GitAdapterError("not a repo", "NOT_A_REPOSITORY");
    expect(err.code).toBe("NOT_A_REPOSITORY");
    expect(err.message).toBe("not a repo");
  });

  it("is an instance of Error", () => {
    const err = new GitAdapterError("unknown", "UNKNOWN");
    expect(err).toBeInstanceOf(Error);
  });
});
