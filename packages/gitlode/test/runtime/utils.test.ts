import { describe, expect, it } from "vitest";

import { assertSupportedRepositoryObjectFormat } from "../../src/runtime/index.js";
import { deriveRepoName } from "../../src/runtime/utils.js";

describe("assertSupportedRepositoryObjectFormat", () => {
  it("accepts supported repository object formats", () => {
    expect(() => assertSupportedRepositoryObjectFormat("sha1", ["sha1"])).not.toThrow();
  });

  it("rejects unsupported repository object formats", () => {
    expect(() => assertSupportedRepositoryObjectFormat("sha256", ["sha1"])).toThrow(
      "Unsupported repository object format: sha256. Supported formats: sha1.",
    );
  });
});

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
