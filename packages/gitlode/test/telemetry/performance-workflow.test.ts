import { describe, expect, it } from "vitest";

import { calibrationComplete, type FixtureManifest } from "../support/performance-harness.js";
import {
  calibrationKey,
  parseAdapter,
  parseFixture,
  parseState,
  requireTarget,
} from "../support/performance-workflow.js";

const quantities = { commits: 5, files: 1, plugins: 0, rotations: 1, scale: 0 };
const manifest = (status: "complete" | "incomplete"): FixtureManifest => ({
  schemaVersion: 1,
  recipeRevision: "test",
  aggregation: { status: "fixed-recipe", integration: "pending-target-collector" },
  fixtures: { commit_heavy_repository: quantities },
  calibrationTargets: {
    "commit_heavy_repository/isomorphic-git": {
      status,
      quantities,
      ...(status === "incomplete"
        ? { reason: "pending" }
        : { environmentRef: "environment.json", artifactRef: "calibration.json" }),
    },
  },
});
describe("performance workflow routing", () => {
  it("validates fixture, adapter, state and preserves aggregation identity", () => {
    expect(parseFixture("aggregation_scale")).toBe("aggregation_scale");
    expect(parseAdapter("git-cli")).toBe("git-cli");
    expect(parseState("target_on")).toBe("target_on");
    expect(() => parseFixture("unknown")).toThrow();
    expect(() => parseAdapter("unknown")).toThrow();
    expect(() => parseState("legacy_off")).toThrow();
  });
  it("models target calibration independently and rejects incomplete formal measurement", () => {
    expect(calibrationKey("commit_heavy_repository", "isomorphic-git")).toBe(
      "commit_heavy_repository/isomorphic-git",
    );
    expect(calibrationComplete(manifest("complete"))).toBe(true);
    expect(calibrationComplete(manifest("incomplete"))).toBe(false);
    expect(() =>
      requireTarget(manifest("incomplete"), "commit_heavy_repository", "isomorphic-git", true),
    ).toThrow(/completed calibration/);
    expect(
      requireTarget(manifest("complete"), "commit_heavy_repository", "isomorphic-git", true).status,
    ).toBe("complete");
  });
  it("fixes plugin projection routing to isomorphic-git", () => {
    const value = manifest("complete");
    const plugin = {
      ...value,
      calibrationTargets: {
        "plugin_heavy_projection/isomorphic-git": { status: "complete" as const, quantities },
      },
    };
    expect(() => requireTarget(plugin, "plugin_heavy_projection", "git-cli")).toThrow(
      /requires isomorphic-git/,
    );
  });
});
