import type { ExtractionCheckpoint } from "@gitlode/internal-contracts/extraction";
import type { AbsolutePath } from "@gitlode/internal-foundation/support";
import { describe, expect, it } from "vitest";

import { validatePriorCheckpoint } from "../../src/state/index.js";

describe("validatePriorCheckpoint", () => {
  it("returns the prior state when the repository path and OID profile are valid", () => {
    const state: ExtractionCheckpoint = {
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

    expect(validatePriorCheckpoint(state, process.cwd(), "sha1")).toBe(state);
  });

  it("rejects states from a different repository", () => {
    const state: ExtractionCheckpoint = {
      generatedAt: "",
      repositoryPath: "/different-repo" as AbsolutePath,
      refs: [],
    };

    expect(() => validatePriorCheckpoint(state, process.cwd(), "sha1")).toThrow(
      "State file was created for a different repository: /different-repo",
    );
  });

  it("validates repository object format specific commit OIDs", () => {
    const state = {
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

    expect(() => validatePriorCheckpoint(state, process.cwd(), "sha1")).toThrow(
      'Invalid commit OID in state file for ref "main": not-an-oid',
    );
  });
});
