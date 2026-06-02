import { describe, expect, it } from "vitest";

import { deriveRepoName } from "../../../src/cli/runtime/index.js";

describe("deriveRepoName", () => {
  it("uses the remote URL tail and strips .git suffix", () => {
    expect(deriveRepoName("https://example.com/org/my-repo.git", "/repos/fallback")).toBe(
      "my-repo",
    );
  });

  it("falls back to local repository directory when remote URL is missing", () => {
    expect(deriveRepoName(null, "/repos/local-repo")).toBe("local-repo");
  });

  it("falls back to local repository directory when remote URL ends with a trailing slash", () => {
    expect(deriveRepoName("https://example.com/org/", "/repos/local-repo")).toBe("local-repo");
  });
});
