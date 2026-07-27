import { describe, expect, it } from "vitest";

import type { ExtractionState } from "../../src/extraction-api/index.js";
import { validatePriorState } from "../../src/state/index.js";
import type { AbsolutePath } from "../../src/support/index.js";

describe("validatePriorState", () => {
  it("returns the prior state when the repository path and OID profile are valid", () => {
    const state: ExtractionState = {
      version: 2,
      generatedAt: "2026-01-01T00:00:00.000Z",
      repositoryPath: process.cwd() as AbsolutePath,
      refs: [
        {
          ref: "main",
          refType: "branch",
          tipOid: "1".padStart(40, "0"),
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    expect(validatePriorState(state, process.cwd(), "sha1")).toBe(state);
  });

  it("rejects states from a different repository", () => {
    const state: ExtractionState = {
      version: 2,
      generatedAt: "",
      repositoryPath: "/different-repo" as AbsolutePath,
      refs: [],
    };

    expect(() => validatePriorState(state, process.cwd(), "sha1")).toThrow(
      "State file was created for a different repository: /different-repo",
    );
  });

  it("validates repository object format specific commit OIDs", () => {
    const state = {
      version: 2,
      generatedAt: "",
      repositoryPath: process.cwd(),
      refs: [
        {
          ref: "main",
          refType: "branch",
          tipOid: "not-an-oid",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    expect(() => validatePriorState(state, process.cwd(), "sha1")).toThrow(
      'Invalid commit OID in state file for ref "main": not-an-oid',
    );
  });
});
